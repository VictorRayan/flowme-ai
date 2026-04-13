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

type SelectedEventContext = {
  id: string;
  title: string | null;
  source: string | null;
  linkedAccountId: string | null;
};

const ACTION_HINTS = [
  'create event', 'add event', 'schedule', 'book meeting', 'new meeting', 'new event',
  'criar evento', 'agendar', 'marcar reuniao', 'marcar reuniao', 'novo evento', 'nova reuniao',
  'edit event', 'update event', 'reschedule', 'move event', 'change event',
  'editar evento', 'alterar evento', 'reagendar', 'mudar evento',
  'delete event', 'remove event', 'cancel event', 'delete this', 'remove this', 'cancel this',
  'deletar evento', 'apagar evento', 'cancelar evento', 'excluir evento',
  'deletar esse', 'apagar esse', 'cancelar esse', 'excluir esse', 'apaga isso', 'deleta isso', 'exclui isso',
  'show events', 'find event', 'list events', 'calendar today', 'my schedule', 'what do i have',
  'mostrar eventos', 'buscar evento', 'listar eventos', 'agenda hoje', 'meus compromissos', 'o que tenho',
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
  if (extractDeleteConfirmation(normalized)) return true;
  const hasCalendarTerm = CALENDAR_TERMS.some(k => normalized.includes(k));
  const hasAction = ACTION_HINTS.some(k => normalized.includes(normalizeText(k)));
  return hasAction || (hasCalendarTerm && /(create|add|schedule|edit|update|delete|remove|cancel|find|show|list|criar|agendar|editar|alterar|deletar|apagar|cancelar|buscar|mostrar|listar)/.test(normalized));
}

function isTimeRequest(text: string): boolean {
  const normalized = normalizeText(text);
  return TIME_TERMS.some(k => normalized.includes(normalizeText(k)));
}

function extractDeleteConfirmation(text: string): string | null {
  const normalized = normalizeText(text);
  const match = normalized.match(/\b(?:confirm delete|confirmar exclusao|confirmar exclusao do evento)\s+([a-z0-9_@.\-]+)/i);
  return match?.[1] || null;
}

function stripInjectedContext(message: string): string {
  const text = (message || '').trim();
  const marker = '\n\n';
  const lastMarker = text.lastIndexOf(marker);
  if (lastMarker === -1) return text;

  const prefix = text.slice(0, lastMarker);
  if (!prefix.includes('--- Event:') && !prefix.includes('--- Note:')) return text;
  return text.slice(lastMarker + marker.length).trim();
}

function extractSelectedEventContexts(text: string): SelectedEventContext[] {
  const lines = (text || '').split(/\r?\n/);
  const selected: SelectedEventContext[] = [];
  let current: SelectedEventContext | null = null;

  const flush = () => {
    if (current?.id) selected.push(current);
    current = null;
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (line.startsWith('--- Event: ') && line.endsWith(' ---')) {
      flush();
      current = {
        id: '',
        title: line.slice('--- Event: '.length, -' ---'.length).trim() || null,
        source: null,
        linkedAccountId: null,
      };
      continue;
    }

    if (!current) continue;
    if (!line) {
      flush();
      continue;
    }
    if (line.startsWith('Event ID: ')) {
      current.id = line.slice('Event ID: '.length).trim();
      continue;
    }
    if (line.startsWith('Source: ')) {
      current.source = normalizeText(line.slice('Source: '.length)) || null;
      continue;
    }
    if (line.startsWith('Linked Account ID: ')) {
      current.linkedAccountId = line.slice('Linked Account ID: '.length).trim() || null;
    }
  }

  flush();
  return selected;
}

function isDeicticEventRequest(text: string): boolean {
  const normalized = normalizeText(text);
  return [
    'this event',
    'that event',
    'selected event',
    'delete this',
    'remove this',
    'cancel this',
    'esse evento',
    'este evento',
    'evento selecionado',
    'apaga esse',
    'deleta isso',
    'exclui isso',
    'aqui',
  ].some(token => normalized.includes(token));
}

function buildUserOnlyContext(messages: Array<{ role: 'user' | 'assistant'; content: string }>): string {
  const userMessages = messages
    .filter(message => message.role === 'user')
    .slice(-4)
    .map(message => stripInjectedContext(message.content || '').trim())
    .filter(Boolean);

  if (userMessages.length <= 1) return '';
  return userMessages.slice(0, -1).map(content => `user: ${content}`).join('\n');
}

async function verifyEventDeletion(target: MappedEvent): Promise<boolean> {
  const start = new Date(target.start_at);
  const rangeStart = new Date(start);
  const rangeEnd = new Date(start);
  rangeStart.setUTCDate(rangeStart.getUTCDate() - 7);
  rangeEnd.setUTCDate(rangeEnd.getUTCDate() + 7);

  for (let attempt = 0; attempt < 3; attempt += 1) {
    if (attempt > 0) {
      await new Promise(resolve => setTimeout(resolve, attempt * 400));
    }
    const events = await listEvents([{ id: target.linked_account_id, name: target.account_name, type: 'google' }], rangeStart.toISOString(), rangeEnd.toISOString());
    if (!events.some(event => event.id === target.id)) {
      return true;
    }
  }

  return false;
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
  const exactTitleMatches = events.filter(e => normalizeText(e.title) === q);
  if (exactTitleMatches.length > 0) return exactTitleMatches;
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
  model?: string;
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
    model: params.model || 'gpt-5.4-mini',
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
  model?: string;
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

  const models = Array.from(new Set([
    params.model,
    'gemini-2.5-flash',
    'gemini-2.5-flash-lite',
    'gemini-2.5-pro',
  ].filter((value): value is string => Boolean(value))));
  for (const model of models) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) continue;
      const data = await res.json();
      const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
      const parsed = parseJsonLoose(raw);
      if (parsed?.intent && parsed.intent !== 'none') return parsed;
    } catch {
      continue;
    }
  }
  return null;
}

async function parseCalendarAction(params: {
  text: string;
  nowIso: string;
  timezone: string;
  provider: Provider;
  model?: string;
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
  model?: string;
  timezone?: string;
  clientNowIso?: string;
}): Promise<string | null> {
  const latestUser = extractLatestUserMessage(params.messages);
  const latestInstruction = stripInjectedContext(latestUser);
  const selectedEventContexts = extractSelectedEventContexts(latestUser);
  const userOnlyContext = buildUserOnlyContext(params.messages);
  const timezone = params.timezone || 'UTC';
  const nowIso = safeIso(params.clientNowIso) || new Date().toISOString();

  if (isTimeRequest(latestInstruction)) {
    return `Current local time: ${formatNow(timezone, nowIso)}`;
  }

  const hasConversationCalendarIntent = Boolean(userOnlyContext) && isLikelyCalendarRequest(userOnlyContext);
  if (!isLikelyCalendarRequest(latestInstruction) && !hasConversationCalendarIntent && selectedEventContexts.length === 0) {
    return null;
  }

  const accounts = await loadActiveGoogleAccounts(params.auth);
  if (!accounts.length) {
    return 'No active Google Calendar account is connected. Please connect one in Settings to manage events.';
  }

  const deleteConfirmationId = extractDeleteConfirmation(latestInstruction);
  if (deleteConfirmationId) {
    const range = defaultRange(nowIso, 30, 365);
    const candidates = await listEvents(accounts, range.start, range.end);
    const target = candidates.find(event => normalizeText(event.id) === deleteConfirmationId);
    if (!target) {
      return 'I could not find the event id you asked me to confirm for deletion.';
    }

    await deleteCalendarEvent(target.linked_account_id, target.id);
    const verified = await verifyEventDeletion(target);
    if (!verified) {
      return `I sent the deletion request for "${target.title}" (${target.id}), but I could not verify that Google actually removed it yet. Please refresh Calendar and, if it is still there, I can try again with the exact event id.`;
    }
    return `Deleted event "${target.title}" (${target.id}) from account ${target.account_name}.`;
  }

  const selectedEventContextBlock = selectedEventContexts.length
    ? selectedEventContexts.map(event => [
        `Selected event title: ${event.title || '(unknown)'}`,
        `Selected event id: ${event.id}`,
        event.source ? `Selected event source: ${event.source}` : '',
        event.linkedAccountId ? `Selected linked account id: ${event.linkedAccountId}` : '',
      ].filter(Boolean).join('\n')).join('\n\n')
    : '';
  const fullText = [
    userOnlyContext ? `Previous user context:\n${userOnlyContext}` : '',
    selectedEventContextBlock ? `Selected event context:\n${selectedEventContextBlock}` : '',
    `Latest user request: ${latestInstruction}`,
  ].filter(Boolean).join('\n\n');

  const action = await parseCalendarAction({
    text: fullText,
    nowIso,
    timezone,
    provider: params.provider,
    model: params.model,
  });

  if (!action.intent || action.intent === 'none') return null;
  if (action.needs_clarification) {
    return action.clarification_question || 'I need one more detail to complete that calendar action.';
  }

  if ((action.intent === 'delete' || action.intent === 'edit') && selectedEventContexts.length === 1) {
    const selectedEvent = selectedEventContexts[0];
    if (selectedEvent.source && selectedEvent.source !== 'google') {
      return `The selected item "${selectedEvent.title || selectedEvent.id}" is not a Google Calendar event, so I cannot ${action.intent} it from Balys yet.`;
    }

    if ((!action.event_id && !action.event_query) || isDeicticEventRequest(latestInstruction)) {
      action.event_id = selectedEvent.id;
      action.event_query = selectedEvent.title || action.event_query || null;
    }
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
    return `Please confirm deletion of "${target.title}" (${target.id}) scheduled for ${formatDateTime(target.start_at, timezone)}.\n\nReply with: confirm delete ${target.id}`;
  }

  return null;
}

export function buildNowSystemPrompt(opts: { timezone?: string; clientNowIso?: string }): string {
  const timezone = opts.timezone || 'UTC';
  const nowIso = safeIso(opts.clientNowIso) || new Date().toISOString();
  return `Current local date/time for the user: ${formatNow(timezone, nowIso)}. Use this reference for terms like today, tomorrow, this week.`;
}
