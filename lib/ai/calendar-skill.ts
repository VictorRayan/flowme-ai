import OpenAI from 'openai';
import { createCalendarEvent, deleteCalendarEvent, getCalendarEvents, updateCalendarEvent } from '@/lib/google/google-calendar';

type Provider = 'openai' | 'gemini';

type AuthCtx = {
  supabase: any;
  user: { id: string; email?: string | null };
};

type ActiveAccount = {
  id: string;
  name: string;
  type: string;
};

type ParsedAction = {
  intent?: 'none' | 'search' | 'create' | 'edit' | 'delete';
  needs_clarification?: boolean;
  clarification_question?: string | null;
  account_name?: string | null;
  title?: string | null;
  description?: string | null;
  location?: string | null;
  start_at?: string | null;
  end_at?: string | null;
  create_meet?: boolean | null;
  participants?: string[];
  event_query?: string | null;
  event_id?: string | null;
  search_start_at?: string | null;
  search_end_at?: string | null;
  limit?: number | null;
  updates?: {
    title?: string | null;
    description?: string | null;
    location?: string | null;
    start_at?: string | null;
    end_at?: string | null;
    create_meet?: boolean | null;
    participants?: string[];
  };
};

type MappedEvent = {
  id: string;
  linked_account_id: string;
  account_name: string;
  title: string;
  description: string | null;
  location: string | null;
  start_at: string;
  end_at: string | null;
  htmlLink: string | null;
};

const ACTION_HINTS = [
  'create event', 'add event', 'schedule', 'book meeting', 'new meeting', 'new event',
  'criar evento', 'agendar', 'marcar reuniao', 'marcar reuniao', 'novo evento', 'nova reuniao',
  'edit event', 'update event', 'reschedule', 'move event',
  'editar evento', 'alterar evento', 'reagendar', 'mudar evento',
  'delete event', 'remove event', 'cancel event',
  'deletar evento', 'apagar evento', 'cancelar evento', 'excluir evento',
  'show events', 'find event', 'list events', 'calendar today', 'my schedule',
  'mostrar eventos', 'buscar evento', 'listar eventos', 'agenda hoje', 'meus compromissos',
];

const CALENDAR_TERMS = ['event', 'events', 'calendar', 'meeting', 'agenda', 'evento', 'eventos', 'calendario', 'reuniao'];
const TIME_TERMS = ['what time', 'time now', 'what day', 'today date', 'que horas', 'horas agora', 'que dia', 'data de hoje'];

function normalizeText(value: string): string {
  return (value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function isLikelyCalendarRequest(text: string): boolean {
  const normalized = normalizeText(text);
  if (!normalized) return false;
  const hasCalendarTerm = CALENDAR_TERMS.some(k => normalized.includes(k));
  const hasAction = ACTION_HINTS.some(k => normalized.includes(normalizeText(k)));
  return hasAction || (hasCalendarTerm && /(create|add|schedule|edit|update|delete|remove|cancel|find|show|list|criar|agendar|editar|alterar|deletar|apagar|cancelar|buscar|mostrar|listar)/.test(normalized));
}

function isTimeRequest(text: string): boolean {
  const normalized = normalizeText(text);
  return TIME_TERMS.some(k => normalized.includes(normalizeText(k)));
}

function formatDateTime(value: string, timezone: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: timezone,
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

function formatNow(timezone: string, nowIso: string): string {
  const now = new Date(nowIso);
  const weekday = new Intl.DateTimeFormat('en-GB', { timeZone: timezone, weekday: 'long' }).format(now);
  const date = new Intl.DateTimeFormat('en-GB', { timeZone: timezone, day: '2-digit', month: 'long', year: 'numeric' }).format(now);
  const time = new Intl.DateTimeFormat('en-GB', { timeZone: timezone, hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(now);
  return `${weekday}, ${date}, ${time} (${timezone})`;
}

function safeIso(value?: string | null): string | null {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

function extractLatestUserMessage(messages: Array<{ role: 'user' | 'assistant'; content: string }>): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === 'user') return messages[i].content || '';
  }
  return '';
}

function defaultRange(nowIso: string, beforeDays: number, afterDays: number) {
  const now = new Date(nowIso);
  const start = new Date(now);
  const end = new Date(now);
  start.setUTCDate(start.getUTCDate() - beforeDays);
  end.setUTCDate(end.getUTCDate() + afterDays);
  return { start: start.toISOString(), end: end.toISOString() };
}

async function loadActiveGoogleAccounts(auth: AuthCtx): Promise<ActiveAccount[]> {
  const { data, error } = await auth.supabase
    .from('linked_accounts')
    .select('id,name,type')
    .eq('user_id', auth.user.id)
    .eq('is_active', true)
    .eq('is_deleted', false)
    .eq('provider', 'google')
    .order('created_at', { ascending: true });

  if (error || !data) return [];
  return data;
}

function pickAccount(accounts: ActiveAccount[], accountName: string | null | undefined, userEmail?: string | null): ActiveAccount | null {
  if (!accounts.length) return null;
  const normalizedWanted = normalizeText(accountName || '');
  if (normalizedWanted) {
    const matched = accounts.find(a => normalizeText(a.name).includes(normalizedWanted) || normalizedWanted.includes(normalizeText(a.name)));
    if (matched) return matched;
  }
  if (userEmail) {
    const sameEmail = accounts.find(a => normalizeText(a.name) === normalizeText(userEmail));
    if (sameEmail) return sameEmail;
  }
  return accounts[0];
}

async function listEvents(accounts: ActiveAccount[], startIso: string, endIso: string): Promise<MappedEvent[]> {
  const batches = await Promise.all(
    accounts.map(async account => {
      try {
        const events = await getCalendarEvents(account.id, startIso, endIso);
        return (events || [])
          .filter(e => e.id && (e.start?.dateTime || e.start?.date))
          .map(e => ({
            id: e.id!,
            linked_account_id: account.id,
            account_name: account.name,
            title: e.summary || 'Untitled Event',
            description: e.description || null,
            location: e.location || null,
            start_at: (e.start?.dateTime || e.start?.date)!,
            end_at: e.end?.dateTime || e.end?.date || null,
            htmlLink: e.htmlLink || null,
          }));
      } catch {
        return [];
      }
    })
  );
  return batches.flat().sort((a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime());
}

function filterEventsByQuery(events: MappedEvent[], query: string | null | undefined): MappedEvent[] {
  const q = normalizeText(query || '');
  if (!q) return events;
  return events.filter(e => {
    const hay = normalizeText(`${e.title} ${e.description || ''} ${e.location || ''}`);
    return hay.includes(q);
  });
}

function parseJsonLoose(raw: string): ParsedAction {
  try {
    return JSON.parse(raw) as ParsedAction;
  } catch {
    const cleaned = raw.replace(/```json|```/g, '').trim();
    try {
      return JSON.parse(cleaned) as ParsedAction;
    } catch {
      return { intent: 'none' };
    }
  }
}

async function parseActionWithOpenAI(params: {
  text: string;
  nowIso: string;
  timezone: string;
}): Promise<ParsedAction | null> {
  if (!process.env.OPENAI_API_KEY) return null;
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const prompt = `Convert the user request into JSON for calendar automation.
Now (ISO): ${params.nowIso}
Timezone: ${params.timezone}

Return ONLY JSON with this shape:
{
  "intent": "none|search|create|edit|delete",
  "needs_clarification": boolean,
  "clarification_question": string|null,
  "account_name": string|null,
  "title": string|null,
  "description": string|null,
  "location": string|null,
  "start_at": string|null,
  "end_at": string|null,
  "create_meet": boolean|null,
  "participants": string[],
  "event_query": string|null,
  "event_id": string|null,
  "search_start_at": string|null,
  "search_end_at": string|null,
  "limit": number|null,
  "updates": {
    "title": string|null,
    "description": string|null,
    "location": string|null,
    "start_at": string|null,
    "end_at": string|null,
    "create_meet": boolean|null,
    "participants": string[]
  }
}

Rules:
- For relative dates (today, tomorrow, next monday), resolve to absolute ISO timestamps.
- For search requests, infer a reasonable range if user does not specify.
- If request is not about calendar CRUD/search, set intent="none".
- If data is missing for create/edit/delete, set needs_clarification=true with question.`;

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    temperature: 0,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: 'You are a precise calendar action parser.' },
      { role: 'user', content: `${prompt}\n\nUser request:\n${params.text}` },
    ],
  });

  const raw = completion.choices[0]?.message?.content || '{}';
  return parseJsonLoose(raw);
}

async function parseActionWithGemini(params: {
  text: string;
  nowIso: string;
  timezone: string;
}): Promise<ParsedAction | null> {
  if (!process.env.GEMINI_API_KEY) return null;
  const body = {
    contents: [{
      role: 'user',
      parts: [{
        text: `Convert this request into JSON for calendar automation.
Now (ISO): ${params.nowIso}
Timezone: ${params.timezone}
Return ONLY JSON with fields:
intent, needs_clarification, clarification_question, account_name, title, description, location, start_at, end_at, create_meet, participants, event_query, event_id, search_start_at, search_end_at, limit, updates.
Resolve relative dates to ISO. If not calendar CRUD/search, intent=none.
User request: ${params.text}`,
      }],
    }],
    generationConfig: { temperature: 0 },
  };
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GEMINI_API_KEY}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) return null;
  const data = await res.json();
  const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
  return parseJsonLoose(raw);
}

async function parseCalendarAction(params: {
  text: string;
  nowIso: string;
  timezone: string;
  provider: Provider;
}): Promise<ParsedAction> {
  const primary = params.provider === 'openai'
    ? await parseActionWithOpenAI(params)
    : await parseActionWithGemini(params);
  if (primary?.intent) return primary;

  const fallback = params.provider === 'openai'
    ? await parseActionWithGemini(params)
    : await parseActionWithOpenAI(params);
  if (fallback?.intent) return fallback;

  return { intent: 'none' };
}

function formatEventList(events: MappedEvent[], timezone: string): string {
  return events.map((e, idx) => (
    `${idx + 1}. ${e.title}\n` +
    `   id: ${e.id}\n` +
    `   when: ${formatDateTime(e.start_at, timezone)}${e.end_at ? ` -> ${formatDateTime(e.end_at, timezone)}` : ''}\n` +
    `   account: ${e.account_name}${e.location ? `\n   location: ${e.location}` : ''}`
  )).join('\n');
}

function selectTargetEvent(candidates: MappedEvent[], eventId?: string | null): MappedEvent[] {
  if (!eventId) return candidates;
  return candidates.filter(e => e.id === eventId);
}

export async function tryRunCalendarSkill(params: {
  auth: AuthCtx;
  messages: Array<{ role: 'user' | 'assistant'; content: string }>;
  provider: Provider;
  timezone?: string;
  clientNowIso?: string;
}): Promise<string | null> {
  const latestUser = extractLatestUserMessage(params.messages);
  const timezone = params.timezone || 'UTC';
  const nowIso = safeIso(params.clientNowIso) || new Date().toISOString();

  if (isTimeRequest(latestUser)) {
    return `Current local time: ${formatNow(timezone, nowIso)}`;
  }

  if (!isLikelyCalendarRequest(latestUser)) {
    return null;
  }

  const accounts = await loadActiveGoogleAccounts(params.auth);
  if (!accounts.length) {
    return 'No active Google Calendar account is connected. Please connect one in Settings to manage events.';
  }

  const action = await parseCalendarAction({
    text: latestUser,
    nowIso,
    timezone,
    provider: params.provider,
  });

  if (!action.intent || action.intent === 'none') return null;
  if (action.needs_clarification) {
    return action.clarification_question || 'I need one more detail to complete that calendar action.';
  }

  if (action.intent === 'search') {
    const defaults = defaultRange(nowIso, 0, 14);
    const startIso = safeIso(action.search_start_at) || defaults.start;
    const endIso = safeIso(action.search_end_at) || defaults.end;
    const account = pickAccount(accounts, action.account_name, params.auth.user.email);
    const pool = account ? [account] : accounts;
    const events = filterEventsByQuery(await listEvents(pool, startIso, endIso), action.event_query);
    const limit = Math.min(Math.max(1, action.limit || 10), 25);
    const top = events.slice(0, limit);
    if (!top.length) {
      return `No events found in the selected range (${formatDateTime(startIso, timezone)} -> ${formatDateTime(endIso, timezone)}).`;
    }
    return `Found ${events.length} event(s):\n\n${formatEventList(top, timezone)}`;
  }

  if (action.intent === 'create') {
    const account = pickAccount(accounts, action.account_name, params.auth.user.email);
    if (!account) return 'No active Google account available to create this event.';

    const startIso = safeIso(action.start_at);
    const endIso = safeIso(action.end_at);
    if (!action.title || !startIso || !endIso) {
      return 'To create an event, I need at least title, start time, and end time.';
    }

    const created = await createCalendarEvent(account.id, {
      title: action.title,
      description: action.description || undefined,
      location: action.location || undefined,
      startAt: startIso,
      endAt: endIso,
      createMeet: Boolean(action.create_meet),
      participants: Array.isArray(action.participants) ? action.participants : undefined,
    });

    return `Created event "${action.title}" on ${formatDateTime(startIso, timezone)} using account ${account.name}.` +
      `${created.meetLink ? `\nMeet link: ${created.meetLink}` : ''}` +
      `${created.htmlLink ? `\nGoogle link: ${created.htmlLink}` : ''}`;
  }

  if (action.intent === 'edit') {
    const range = defaultRange(nowIso, 30, 180);
    const account = pickAccount(accounts, action.account_name, params.auth.user.email);
    const pool = account ? [account] : accounts;
    let candidates = await listEvents(pool, range.start, range.end);
    candidates = filterEventsByQuery(candidates, action.event_query);
    candidates = selectTargetEvent(candidates, action.event_id);

    if (!candidates.length) return 'I could not find the target event to edit. Please include the event name (or id).';
    if (candidates.length > 1) {
      return `I found multiple matching events. Please specify the event id:\n\n${formatEventList(candidates.slice(0, 5), timezone)}`;
    }

    const target = candidates[0];
    const updates = action.updates || {};
    const startAt = safeIso(updates.start_at);
    const endAt = safeIso(updates.end_at);

    await updateCalendarEvent(target.linked_account_id, target.id, {
      title: updates.title || undefined,
      description: updates.description !== undefined ? (updates.description || '') : undefined,
      location: updates.location !== undefined ? (updates.location || '') : undefined,
      startAt: startAt || undefined,
      endAt: endAt || undefined,
      createMeet: updates.create_meet === null || updates.create_meet === undefined ? undefined : Boolean(updates.create_meet),
      participants: Array.isArray(updates.participants) ? updates.participants : undefined,
    });

    return `Updated event "${target.title}" (${target.id}) successfully.`;
  }

  if (action.intent === 'delete') {
    const range = defaultRange(nowIso, 30, 365);
    const account = pickAccount(accounts, action.account_name, params.auth.user.email);
    const pool = account ? [account] : accounts;
    let candidates = await listEvents(pool, range.start, range.end);
    candidates = filterEventsByQuery(candidates, action.event_query);
    candidates = selectTargetEvent(candidates, action.event_id);

    if (!candidates.length) return 'I could not find the target event to delete. Please include the event name (or id).';
    if (candidates.length > 1) {
      return `I found multiple matching events. Please specify the event id:\n\n${formatEventList(candidates.slice(0, 5), timezone)}`;
    }

    const target = candidates[0];
    await deleteCalendarEvent(target.linked_account_id, target.id);
    return `Deleted event "${target.title}" (${target.id}) from account ${target.account_name}.`;
  }

  return null;
}

export function buildNowSystemPrompt(opts: { timezone?: string; clientNowIso?: string }): string {
  const timezone = opts.timezone || 'UTC';
  const nowIso = safeIso(opts.clientNowIso) || new Date().toISOString();
  return `Current local date/time for the user: ${formatNow(timezone, nowIso)}. Use this reference for terms like today, tomorrow, this week.`;
}

