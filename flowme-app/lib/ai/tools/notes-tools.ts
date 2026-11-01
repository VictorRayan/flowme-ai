import { z } from 'zod';
import { ilikeAny } from '@/lib/api/safe-filters';
import { defineTool } from './Tool';

function textToTipTapDoc(text: string): object {
  const URL_REGEX = /https?:\/\/[^\s)]+/g;

  const lines = text.split('\n');
  const content: object[] = [];

  for (const line of lines) {
    if (!line.trim()) {
      content.push({ type: 'paragraph' });
      continue;
    }

    const inlineNodes: object[] = [];
    let lastIndex = 0;

    for (const match of line.matchAll(URL_REGEX)) {
      const url = match[0];
      const start = match.index!;
      if (start > lastIndex) {
        inlineNodes.push({ type: 'text', text: line.slice(lastIndex, start) });
      }
      inlineNodes.push({
        type: 'text',
        text: url,
        marks: [{ type: 'link', attrs: { href: url, target: '_blank' } }],
      });
      lastIndex = start + url.length;
    }

    if (lastIndex < line.length) {
      inlineNodes.push({ type: 'text', text: line.slice(lastIndex) });
    }

    if (inlineNodes.length === 0) {
      inlineNodes.push({ type: 'text', text: line });
    }

    content.push({ type: 'paragraph', content: inlineNodes });
  }

  return { type: 'doc', content };
}

export const notesCreateTool = defineTool({
  name: 'notes.create_note',
  description: `Creates a brand-new note in the user's Flowme notes (rich-text, dated to today).

WHEN TO USE: user says "save this as a note", "jot down…", "create a note about…", "remember this for later". Default to capturing what they said, not summarising it.

CONTRACT:
- title and content_text are REQUIRED. If the user didn't supply a title, derive a short one from the content (4-8 words, sentence case) — do not invent a topic that wasn't there.
- content_text is plain text. URLs in the text are auto-linked when saved. Line breaks become paragraphs.
- The note is dated to today (context.nowIso). There is no input to backdate.
- BEFORE creating, consider notes.list_notes with a title query — if a near-duplicate exists, prefer notes.edit_note (append) over creating a second one. The user usually does not want duplicates.
- Side effects: appears immediately in the user's Notes UI. Reversible only via the UI (no delete tool exposed to the agent).

RETURNS receipt: { status: 'created', title, date }.
- No technical IDs returned to you. Confirm in plain language ("Saved a note titled '…' for today.").

ASK THE USER FIRST IF: the request is ambiguous between "save a note" and "remember this for our chat" (the latter is just context, not a tool call), or if the content is long-form and would be better split into multiple notes.`,
  isReadOnly: false,
  inputSchema: z.object({
    title: z.string().describe('Short note title (4-8 words). Required. Derive from content if user did not supply one — do not invent unrelated topics.'),
    content_text: z.string().describe('Plain-text body. Required. URLs auto-link on save; line breaks become paragraphs.'),
  }),
  call: async (args, context) => {
    try {
      const { data: note, error } = await context.supabase
        .from('notes')
        .insert({
          user_id: context.user.id,
          title: args.title || 'Untitled',
          content_text: args.content_text,
          content: textToTipTapDoc(args.content_text),
          note_date: context.nowIso.split('T')[0],
          note_type: 'manual',
        })
        .select('id, title, note_date')
        .single();

      if (error) throw error;

      return {
        ok: true,
        receipt: { 
          status: 'created',
          title: note.title,
          date: note.note_date,
        }
      };
    } catch (e: any) {
      return { ok: false, error: e.message || 'Failed to create note' };
    }
  }
});

export const notesListTool = defineTool({
  name: 'notes.list_notes',
  description: `Searches the user's existing notes by title or content. Read-only.

WHEN TO USE: user says "find my notes about…", "what did I write about Anna last month", "do I already have a note on…"; or before notes.create_note (to avoid duplicates) or notes.edit_note (to confirm the right note exists).

CONTRACT:
- All inputs optional. With no query, returns the most recent notes (by note_date desc).
- query is matched as a case-insensitive substring against BOTH title and content_text (OR). It is not full-text-ranked — short, distinctive keywords work better than long phrases.
- limit defaults to 10.
- Read-only. Cheap. Always prefer this over creating duplicates.

RETURNS receipt: { notes[], count }. Each note: { title, date, preview }.
- preview is the first 120 chars of the body — useful to disambiguate but may be truncated mid-sentence; don't quote it as authoritative.
- date is YYYY-MM-DD — fine to surface ("your note from May 1st").
- The internal full-content payload is in data._internal_notes — TECHNICAL, never read aloud or echo back to the user. Use it only to decide your next action (e.g. which note to edit).
- If count is 0, say so plainly — never fabricate notes.

ASK THE USER FIRST IF: nothing — this is informational. But if results are ambiguous (multiple matches with similar titles), ask which one before chaining into edit_note.`,
  isReadOnly: true,
  inputSchema: z.object({
    query: z.string().optional().describe('Case-insensitive substring matched against title OR content_text. Omit to list most recent notes.'),
    limit: z.number().optional().default(10).describe('Max notes returned. Default 10.'),
  }),
  call: async (args, context) => {
    try {
      let queryBuilder = context.supabase
        .from('notes')
        .select('id, title, note_date, content_text')
        .eq('user_id', context.user.id)
        .eq('is_deleted', false)
        .order('note_date', { ascending: false });

      if (args.query) {
        queryBuilder = queryBuilder.or(ilikeAny(['title', 'content_text'], args.query));
      }

      const { data: notes, error } = await queryBuilder.limit(args.limit);

      if (error) throw error;

      return {
        ok: true,
        receipt: {
          notes: notes.map((n: any) => ({
            title: n.title,
            date: n.note_date,
            preview: n.content_text ? n.content_text.substring(0, 120) : '',
          })),
          count: notes.length,
        },
        data: { _internal_notes: notes },
      };
    } catch (e: any) {
      return { ok: false, error: e.message || 'Failed to search notes' };
    }
  }
});

export const notesEditTool = defineTool({
  name: 'notes.edit_note',
  description: `Updates an existing note's title and/or content.

WHEN TO USE: user says "rename my note…", "update the note about…", "add to my note…", "change what I wrote in…". Whenever the user mentions an EXISTING note by name, prefer this over creating a new one.

CONTRACT:
- current_title is REQUIRED. Matched case-insensitively against existing note titles.
- You MUST pass at least one of new_title or new_content. Passing neither returns an error.
- If the user wants to ADD to an existing note (e.g. "add google.com to my Victor Rayan note"), you have two options:
  (a) Simple case — just pass the new piece as new_content. It will replace the body, but for short notes this is usually what the user wants.
  (b) Append case — first call notes.list_notes with query=current_title, read the existing body from data._internal_notes[0].content_text, concatenate "\\n\\n" + addition, then pass the full text as new_content.
- note_date (YYYY-MM-DD) optional — pass it when the title is generic and multiple notes might match.

RETURNS receipt: { status: 'updated', title, date }. Confirm naturally ("Updated your Victor Rayan note.").

EXAMPLES:
- "rename my Project note to Roadmap" → current_title="Project", new_title="Roadmap"
- "add google.com to my Victor Rayan note" → current_title="Victor Rayan", new_content="google.com" (simple replace)
- "append google.com to my Victor Rayan note keeping the old content" → list_notes first, then concatenate.`,
  isReadOnly: false,
  inputSchema: z.object({
    current_title: z.string().describe('Title of the note to find. Required. Case-insensitive match.'),
    note_date: z.string().optional().describe('YYYY-MM-DD to disambiguate when multiple notes share the title.'),
    new_title: z.string().optional().describe('New title. Omit to keep current. At least one of new_title or new_content is required.'),
    new_content: z.string().optional().describe('New body text. Replaces the existing body. To preserve old content, list the note first and pass the concatenated text.'),
  }),
  call: async (args, context) => {
    try {
      if (!args.new_title && !args.new_content) {
        return { ok: false, error: 'Provide at least a new title or new content to update.' };
      }

      let findQuery = context.supabase
        .from('notes')
        .select('id, title, note_date')
        .eq('user_id', context.user.id)
        .eq('is_deleted', false)
        .ilike('title', args.current_title);

      if (args.note_date) {
        findQuery = findQuery.eq('note_date', args.note_date);
      }

      const { data: matches, error: findError } = await findQuery.order('note_date', { ascending: false }).limit(5);

      if (findError) throw findError;
      if (!matches || matches.length === 0) {
        return { ok: false, error: `No note found with title "${args.current_title}"${args.note_date ? ` on ${args.note_date}` : ''}.` };
      }

      const target = matches[0];

      const updatePayload: Record<string, unknown> = {};
      if (args.new_title) updatePayload.title = args.new_title;
      if (args.new_content) {
        updatePayload.content_text = args.new_content;
        updatePayload.content = textToTipTapDoc(args.new_content);
      }

      const { data: updated, error: updateError } = await context.supabase
        .from('notes')
        .update(updatePayload)
        .eq('id', target.id)
        .eq('user_id', context.user.id)
        .select('id, title, note_date')
        .single();

      if (updateError) throw updateError;

      return {
        ok: true,
        receipt: {
          status: 'updated',
          title: updated.title,
          date: updated.note_date,
        }
      };
    } catch (e: any) {
      return { ok: false, error: e.message || 'Failed to edit note' };
    }
  }
});

export const notesTools = [notesCreateTool, notesListTool, notesEditTool];

