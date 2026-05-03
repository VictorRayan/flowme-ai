import { ensureSelfPerson, SelfIdentity } from './self';

export type KnowledgeSectionType = 'fact' | 'personal_info' | 'marked_event' | 'event' | 'daily_briefing';

export type KnowledgePersonInput = {
  name: string;
  email?: string | null;
  relation?: string | null;
};

type PersonRow = {
  id: string;
  name: string;
  email?: string | null;
  person_note_id?: string | null;
};

type NoteRow = {
  id: string;
  title: string;
  content?: TipTapDoc | null;
  content_text?: string | null;
  note_date?: string | null;
  event_id?: string | null;
  note_type?: string | null;
};

export type TipTapNode = {
  type: string;
  attrs?: Record<string, unknown>;
  content?: TipTapNode[];
  text?: string;
};

export type TipTapDoc = {
  type: 'doc';
  content: TipTapNode[];
};

export type KnowledgeAppendResult = {
  ok: boolean;
  note_id?: string;
  note_title?: string;
  appended?: boolean;
  skipped_duplicate?: boolean;
  people?: Array<{ id: string; name: string }>;
  self?: { id: string; name: string };
  error?: string;
};

export const KNOWLEDGE_SECTION_LABELS: Record<KnowledgeSectionType, string> = {
  fact: 'Fact',
  personal_info: 'Personal info',
  marked_event: 'Marked event',
  event: 'Event',
  daily_briefing: 'Daily briefing',
};

export function normalizePersonName(name: string): string {
  return cleanText(name);
}

export function isSelfReferenceName(name: unknown): boolean {
  const normalized = cleanText(name)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  return new Set(['i', 'me', 'myself', 'my self', 'user', 'the user', 'eu', 'mim', 'usuario', 'usuário']).has(normalized);
}

export function todayFromIso(nowIso: string): string {
  return (nowIso || new Date().toISOString()).slice(0, 10);
}

export function toTipTapDoc(content: unknown): TipTapDoc {
  if (content && typeof content === 'object') {
    const obj = content as { type?: unknown; content?: unknown };
    if (obj.type === 'doc' && Array.isArray(obj.content)) {
      return { type: 'doc', content: obj.content as TipTapNode[] };
    }
  }
  return { type: 'doc', content: [] };
}

export function extractTipTapText(node: unknown): string {
  if (!node || typeof node !== 'object') return '';
  const obj = node as TipTapNode;
  const ownText = obj.type === 'mention'
    ? String((obj.attrs?.label || obj.attrs?.id || '') as string)
    : (obj.text || '');
  const childText = Array.isArray(obj.content) ? obj.content.map(extractTipTapText).join(' ') : '';
  return [ownText, childText].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
}

export function buildStructuredAppendNodes(args: {
  sectionType: KnowledgeSectionType;
  title?: string | null;
  content: string;
  people?: Array<{ id: string; name: string }>;
  selfPerson?: { id: string; name: string } | null;
  nowIso: string;
}): { nodes: TipTapNode[]; plainText: string; duplicateKey: string } {
  const sectionLabel = args.title?.trim() || KNOWLEDGE_SECTION_LABELS[args.sectionType];
  const dateLabel = todayFromIso(args.nowIso);
  const cleanContent = replaceSelfMentions(cleanText(args.content));
  const people = dedupePeople(args.people || []);
  // Use title-only as heading to keep duplicate detection stable across rephrased content
  const heading = `${sectionLabel} - ${dateLabel}`;
  const nodes: TipTapNode[] = [
    { type: 'horizontalRule' },
    {
      type: 'heading',
      attrs: { level: 3 },
      content: [{ type: 'text', text: heading }],
    },
    {
      type: 'paragraph',
      content: buildInlineNodesWithMentions(cleanContent, people, args.selfPerson || null),
    },
  ];

  if (people.length > 0) {
    const relatedContent: TipTapNode[] = [{ type: 'text', text: 'Related people: ' }];
    for (const [index, person] of people.entries()) {
      if (index > 0) relatedContent.push({ type: 'text', text: ', ' });
      relatedContent.push({
        type: 'mention',
        attrs: { id: person.id, label: person.name },
      });
    }
    nodes.push({ type: 'paragraph', content: relatedContent });
  }

  const relatedText = people.length ? `Related people: ${people.map((p) => p.name).join(', ')}` : '';
  const plainText = [heading, cleanContent, relatedText].filter(Boolean).join('\n');
  // Duplicate key: use heading + first 80 chars of content so near-identical entries
  // (same section title, same date, similar phrasing) are treated as duplicates
  const duplicateKey = normalizeDuplicateKey(`${heading} ${cleanContent.slice(0, 80)}`);
  return { nodes, plainText, duplicateKey };
}

export function mergeTipTapAppend(existingContent: unknown, nodes: TipTapNode[]): TipTapDoc {
  const doc = toTipTapDoc(existingContent);
  return { type: 'doc', content: [...doc.content, ...nodes] };
}

export function hasDuplicateKnowledgeEntry(existingText: string | null | undefined, existingContent: unknown, duplicateKey: string): boolean {
  const sourceText = [existingText || '', extractTipTapText(existingContent)].filter(Boolean).join(' ');
  const normalized = normalizeDuplicateKey(sourceText);
  if (!duplicateKey) return false;
  return normalized.includes(duplicateKey);
}

export async function appendToPersonKnowledge(
  supabase: any,
  userId: string,
  input: {
    person: KnowledgePersonInput;
    sectionType: Exclude<KnowledgeSectionType, 'event' | 'daily_briefing'>;
    title?: string | null;
    content: string;
    relatedPeople?: KnowledgePersonInput[];
    self?: SelfIdentity;
    nowIso: string;
  },
): Promise<KnowledgeAppendResult> {
  const content = cleanText(input.content);
  if (!content) return { ok: false, error: 'content is required for memory.append_to_person' };

  const selfPerson = input.self ? await ensureSelfPersonWithProfileNote(supabase, userId, input.self, input.nowIso) : null;
  if (selfPerson && !selfPerson.ok) return { ok: false, error: selfPerson.error || 'Failed to resolve self identity' };

  const target = isSelfReferenceName(input.person.name)
    ? selfPerson
    : await ensurePersonWithProfileNote(supabase, userId, input.person, input.nowIso);
  if (!target || !target.ok || !target.person || !target.note) return { ok: false, error: target?.error || 'Failed to resolve person note' };

  const relatedRows = await ensurePeople(
    supabase,
    userId,
    mergePersonInputs([input.person, ...(input.relatedPeople || [])], extractMentionPersonInputs(content)),
    input.nowIso,
  );
  if (!relatedRows.ok) return { ok: false, error: relatedRows.error };

  const append = await appendStructuredSection(supabase, userId, target.note.id, {
    sectionType: input.sectionType,
    title: input.title,
    content,
    people: relatedRows.people || [],
    selfPerson: selfPerson?.person || null,
    nowIso: input.nowIso,
  });
  return {
    ...append,
    note_id: target.note.id,
    note_title: target.note.title,
    people: relatedRows.people?.map((p) => ({ id: p.id, name: p.name })),
    self: selfPerson?.person ? { id: selfPerson.person.id, name: selfPerson.person.name } : undefined,
  };
}

export async function appendToDailyBriefing(
  supabase: any,
  userId: string,
  input: {
    title?: string | null;
    content: string;
    relatedPeople?: KnowledgePersonInput[];
    self?: SelfIdentity;
    nowIso: string;
  },
): Promise<KnowledgeAppendResult> {
  const content = cleanText(input.content);
  if (!content) return { ok: false, error: 'content is required for memory.append_to_briefing' };

  const note = await ensureDailyBriefingNote(supabase, userId, input.nowIso);
  if (!note.ok || !note.note) return { ok: false, error: note.error || 'Failed to resolve daily briefing' };

  const selfPerson = input.self ? await ensureSelfPersonWithProfileNote(supabase, userId, input.self, input.nowIso) : null;
  if (selfPerson && !selfPerson.ok) return { ok: false, error: selfPerson.error || 'Failed to resolve self identity' };

  const relatedRows = await ensurePeople(
    supabase,
    userId,
    mergePersonInputs(input.relatedPeople || [], extractMentionPersonInputs(content)),
    input.nowIso,
  );
  if (!relatedRows.ok) return { ok: false, error: relatedRows.error };

  const append = await appendStructuredSection(supabase, userId, note.note.id, {
    sectionType: 'daily_briefing',
    title: input.title || 'Conversation event',
    content,
    people: relatedRows.people || [],
    selfPerson: selfPerson?.person || null,
    nowIso: input.nowIso,
  });
  return {
    ...append,
    note_id: note.note.id,
    note_title: note.note.title,
    people: relatedRows.people?.map((p) => ({ id: p.id, name: p.name })),
    self: selfPerson?.person ? { id: selfPerson.person.id, name: selfPerson.person.name } : undefined,
  };
}

export async function ensureSelfPersonWithProfileNote(
  supabase: any,
  userId: string,
  self: SelfIdentity,
  nowIso: string,
): Promise<{ ok: boolean; person?: PersonRow; note?: NoteRow; error?: string }> {
  const selfResult = await ensureSelfPerson(supabase, userId, self);
  if (!selfResult.ok || !selfResult.person) return { ok: false, error: selfResult.error || 'Failed to resolve self person' };
  return ensurePersonWithProfileNote(supabase, userId, selfResult.person, nowIso);
}

export async function ensurePersonWithProfileNote(
  supabase: any,
  userId: string,
  personInput: KnowledgePersonInput,
  nowIso: string,
): Promise<{ ok: boolean; person?: PersonRow; note?: NoteRow; error?: string }> {
  const personResult = await ensurePerson(supabase, userId, personInput);
  if (!personResult.ok || !personResult.person) return { ok: false, error: personResult.error || 'Failed to resolve person' };

  let person = personResult.person;
  if (person.person_note_id) {
    const { data: byId } = await supabase
      .from('notes')
      .select('id, title, content, content_text, note_date, event_id, note_type')
      .eq('id', person.person_note_id)
      .eq('user_id', userId)
      .eq('is_deleted', false)
      .maybeSingle();
    if (byId) return { ok: true, person, note: byId };
  }

  const marker = `person:${person.id}`;
  const { data: existing, error: existingError } = await supabase
    .from('notes')
    .select('id, title, content, content_text, note_date, event_id, note_type')
    .eq('user_id', userId)
    .eq('event_id', marker)
    .eq('is_deleted', false)
    .maybeSingle();
  if (existingError) return { ok: false, error: existingError.message };
  if (existing) {
    await supabase.from('people').update({ person_note_id: existing.id }).eq('id', person.id).eq('user_id', userId);
    return { ok: true, person: { ...person, person_note_id: existing.id }, note: existing };
  }

  const date = todayFromIso(nowIso);
  const initialContent: TipTapDoc = {
    type: 'doc',
    content: [
      {
        type: 'heading',
        attrs: { level: 2 },
        content: [{ type: 'text', text: person.name }],
      },
      {
        type: 'paragraph',
        content: [{ type: 'text', text: 'Profile note created by Balys knowledge graph.' }],
      },
    ],
  };

  const { data: newNote, error: createError } = await supabase
    .from('notes')
    .insert({
      user_id: userId,
      title: person.name,
      note_type: 'manual',
      event_id: marker,
      note_date: date,
      content: initialContent,
      content_text: `${person.name}\nProfile note created by Balys knowledge graph.`,
    })
    .select('id, title, content, content_text, note_date, event_id, note_type')
    .single();
  if (createError || !newNote) return { ok: false, error: createError?.message || 'Failed to create profile note' };

  await supabase.from('people').update({ person_note_id: newNote.id }).eq('id', person.id).eq('user_id', userId);
  person = { ...person, person_note_id: newNote.id };
  return { ok: true, person, note: newNote };
}

export async function ensureDailyBriefingNote(
  supabase: any,
  userId: string,
  nowIso: string,
): Promise<{ ok: boolean; note?: NoteRow; error?: string }> {
  const date = todayFromIso(nowIso);
  const { data: existing, error: lookupError } = await supabase
    .from('notes')
    .select('id, title, content, content_text, note_date, event_id, note_type')
    .eq('user_id', userId)
    .eq('note_type', 'daily_briefing')
    .eq('note_date', date)
    .eq('is_deleted', false)
    .maybeSingle();
  if (lookupError) return { ok: false, error: lookupError.message };
  if (existing) return { ok: true, note: existing };

  const title = `Daily Briefing - ${date}`;
  const { data: newNote, error: createError } = await supabase
    .from('notes')
    .insert({
      user_id: userId,
      title,
      note_type: 'daily_briefing',
      note_date: date,
      content: { type: 'doc', content: [] },
      content_text: '',
    })
    .select('id, title, content, content_text, note_date, event_id, note_type')
    .single();
  if (createError || !newNote) return { ok: false, error: createError?.message || 'Failed to create daily briefing' };
  return { ok: true, note: newNote };
}

async function appendStructuredSection(
  supabase: any,
  userId: string,
  noteId: string,
  args: {
    sectionType: KnowledgeSectionType;
    title?: string | null;
    content: string;
    people: PersonRow[];
    selfPerson?: PersonRow | null;
    nowIso: string;
  },
): Promise<KnowledgeAppendResult> {
  const { data: note, error: fetchError } = await supabase
    .from('notes')
    .select('id, title, content, content_text')
    .eq('id', noteId)
    .eq('user_id', userId)
    .eq('is_deleted', false)
    .single();
  if (fetchError || !note) return { ok: false, error: fetchError?.message || 'Note not found' };

  const structured = buildStructuredAppendNodes({
    sectionType: args.sectionType,
    title: args.title,
    content: args.content,
    people: args.people.map((p) => ({ id: p.id, name: p.name })),
    selfPerson: args.selfPerson ? { id: args.selfPerson.id, name: args.selfPerson.name } : null,
    nowIso: args.nowIso,
  });

  if (hasDuplicateKnowledgeEntry(note.content_text, note.content, structured.duplicateKey)) {
    return { ok: true, appended: false, skipped_duplicate: true };
  }

  const mergedContent = mergeTipTapAppend(note.content, structured.nodes);
  const combinedText = [note.content_text || extractTipTapText(note.content), structured.plainText]
    .filter(Boolean)
    .join('\n\n');

  const { error: updateError } = await supabase
    .from('notes')
    .update({
      content: mergedContent,
      content_text: combinedText,
      embedding: null,
      embedding_updated_at: null,
    })
    .eq('id', noteId)
    .eq('user_id', userId);
  if (updateError) return { ok: false, error: updateError.message };

  const mentionRows = dedupePeople([...args.people, ...(args.selfPerson ? [args.selfPerson] : [])]).map((person) => ({ note_id: noteId, person_id: person.id }));
  for (const row of mentionRows) {
    const { error } = await supabase.from('note_mentions').insert(row);
    if (error && error.code !== '23505') {
      console.warn('[knowledge-graph] note_mentions insert failed:', error.message);
    }
  }

  return { ok: true, appended: true, skipped_duplicate: false };
}

async function ensurePeople(
  supabase: any,
  userId: string,
  people: KnowledgePersonInput[],
  nowIso: string,
): Promise<{ ok: boolean; people?: PersonRow[]; error?: string }> {
  const rows: PersonRow[] = [];
  for (const input of people) {
    const hasName = normalizePersonName(input.name || '');
    if (!hasName) continue;
    if (isSelfReferenceName(hasName)) continue;
    const result = await ensurePersonWithProfileNote(supabase, userId, input, nowIso);
    if (!result.ok || !result.person) return { ok: false, error: result.error || `Failed to resolve ${hasName}` };
    rows.push(result.person);
  }
  return { ok: true, people: dedupePeople(rows) };
}

async function ensurePerson(
  supabase: any,
  userId: string,
  input: KnowledgePersonInput,
): Promise<{ ok: boolean; person?: PersonRow; error?: string }> {
  const name = normalizePersonName(input.name || '');
  if (!name) return { ok: false, error: 'person.name is required' };
  if (isSelfReferenceName(name)) return { ok: false, error: `${name} is a self-reference, not a contact` };

  const { data: existing, error: lookupError } = await supabase
    .from('people')
    .select('id, name, email, person_note_id')
    .eq('user_id', userId)
    .ilike('name', name)
    .limit(1)
    .maybeSingle();
  if (lookupError) return { ok: false, error: lookupError.message };
  if (existing) {
    if (input.email && !existing.email) {
      await supabase.from('people').update({ email: input.email }).eq('id', existing.id).eq('user_id', userId);
      return { ok: true, person: { ...existing, email: input.email } };
    }
    return { ok: true, person: existing };
  }

  const { data: created, error: createError } = await supabase
    .from('people')
    .insert({
      user_id: userId,
      name,
      email: input.email || null,
    })
    .select('id, name, email, person_note_id')
    .single();
  if (createError || !created) return { ok: false, error: createError?.message || `Failed to create person ${name}` };
  return { ok: true, person: created };
}

function cleanText(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value).replace(/\s+/g, ' ').trim();
}

function normalizeDuplicateKey(value: unknown): string {
  return cleanText(value)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\p{L}\p{N}\s]/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 240);
}

function buildInlineNodesWithMentions(text: string, people: Array<{ id: string; name: string }>, selfPerson: { id: string; name: string } | null): TipTapNode[] {
  if (!text) return [];
  const mentionable = dedupePeople(people)
    .filter((person) => !isSelfReferenceName(person.name))
    .sort((a, b) => b.name.length - a.name.length);

  const names = mentionable.map((person) => escapeRegExp(person.name));
  const namePattern = names.length ? names.join('|') : '$.^';
  const selfPattern = selfPerson ? '(?:myself|my self|me|user|the user|eu|mim|usu[aá]rio)' : '$.^';
  const re = new RegExp(`@(${selfPattern}|${namePattern})(?=$|\\s|[.,!?;:)\\]])`, 'giu');
  const nodes: TipTapNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = re.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push({ type: 'text', text: text.slice(lastIndex, match.index) });
    }
    const matchedName = match[1];
    const person = selfPerson && isSelfReferenceName(matchedName)
      ? selfPerson
      : mentionable.find((p) => p.name.toLowerCase() === matchedName.toLowerCase());
    if (person) {
      nodes.push({ type: 'mention', attrs: { id: person.id, label: person.name } });
    } else {
      nodes.push({ type: 'text', text: match[0] });
    }
    lastIndex = re.lastIndex;
  }

  if (lastIndex < text.length) {
    nodes.push({ type: 'text', text: text.slice(lastIndex) });
  }
  return nodes.length ? nodes : [{ type: 'text', text }];
}

function replaceSelfMentions(text: string): string {
  return text
    .replace(/\b(?:myself|my self)\b/giu, 'myself')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractMentionPersonInputs(text: string): KnowledgePersonInput[] {
  const out: KnowledgePersonInput[] = [];
  const re = /@([\p{L}\p{N}][\p{L}\p{N}'-]{0,79})/gu;
  let match: RegExpExecArray | null;
  while ((match = re.exec(text)) !== null) {
    const name = normalizePersonName(match[1]);
    if (!name || isSelfReferenceName(name)) continue;
    out.push({ name });
  }
  return out;
}

function mergePersonInputs(primary: KnowledgePersonInput[], extra: KnowledgePersonInput[]): KnowledgePersonInput[] {
  const seen = new Set<string>();
  const out: KnowledgePersonInput[] = [];
  for (const person of [...primary, ...extra]) {
    const name = normalizePersonName(person.name || '');
    if (!name || isSelfReferenceName(name)) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ ...person, name });
  }
  return out;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function dedupePeople<T extends { id: string; name: string }>(people: T[]): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const person of people) {
    if (!person.id || seen.has(person.id)) continue;
    seen.add(person.id);
    out.push(person);
  }
  return out;
}
