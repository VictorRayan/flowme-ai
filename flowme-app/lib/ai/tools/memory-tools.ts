import { z } from 'zod';
import { defineTool } from './Tool';
import { saveFact, FACT_CATEGORIES } from '@/lib/ai/memory/facts';
import { recallSimilarThreads, RECALL_DEFAULT_K, RECALL_SIMILARITY_THRESHOLD } from '@/lib/ai/memory/recall';
import { appendToDailyBriefing, appendToPersonKnowledge, isSelfReferenceName } from '@/lib/ai/memory/knowledge-graph';
import { resolveSelfIdentity } from '@/lib/ai/memory/self';

const relatedPersonObjectSchema = z.object({
  name: z.string().min(1).max(120).describe('Person name as stated by the user.'),
  relation: z.string().max(120).optional().describe('Optional relation to the user or target person, if explicitly stated.'),
  email: z.string().email().optional().describe('Optional email, only if explicitly stated.'),
});

const relatedPersonSchema = z.preprocess((value) => {
  if (typeof value === 'string') return { name: value };
  return value;
}, relatedPersonObjectSchema);

const relatedPeopleSchema = z.preprocess((value) => {
  if (value === undefined || value === null) return [];
  if (typeof value === 'string') return [{ name: value }];
  if (Array.isArray(value)) return value.map((item) => typeof item === 'string' ? { name: item } : item);
  return value;
}, z.array(relatedPersonSchema).max(8).transform((people) => people.filter((person) => !isSelfReferenceName(person.name))));

export const memorySaveFactTool = defineTool({
  name: 'memory.save_fact',
  description: `Saves a discrete, durable fact about the user to long-term memory. The fact is loaded into your system prompt on every future conversation in every thread.

WHEN TO USE: the user volunteered a piece of information that is:
- non-trivial (not "I'm hungry", which is fleeting),
- durable (true for weeks/months/years, not just today),
- about the user themselves (their relationships, work, health, preferences, important context),
- not already trivially derivable from existing memory.

Examples of good facts to save:
- "User's wife is named Anna."
- "User works at Fluencypass as Head of Revenue Ops."
- "User is allergic to penicillin."
- "User prefers concise replies and Portuguese."
- "User's daughter has a peanut allergy and her name is Sofia."

Examples of BAD facts (do NOT save these):
- "User asked about the weather today." (transient)
- "User is feeling tired." (transient)
- "User wants to delete an event." (action, not memory)
- Anything you inferred but the user did not actually say.

CONTRACT:
- fact: 3-280 characters. Phrase it as a complete, self-contained sentence in third person about the user. Do NOT use first person ("I am..." → "User is...").
- category: optional, one of: family, work, health, preference, context, other. Pick the best fit.
- Idempotent: saving the same fact twice will bump its recency, not duplicate.
- Do NOT batch-save many facts in one turn. One call per fact, max 1-2 per turn unless the user explicitly listed several.
- Confirm to the user briefly when you save ("Saved that — Anna is your wife." / "Anotei.").
- NEVER save facts the user did not actually state. NEVER save other people's private info beyond the role-name link the user volunteered.

RETURNS receipt: { fact_id, status: 'saved' | 'updated' }.
- 'saved' = new fact added.
- 'updated' = the same fact already existed; recency bumped.`,
  isReadOnly: false,
  inputSchema: z.object({
    fact: z.string().min(3).max(280).describe('A complete sentence about the user, third person, durable. 3-280 chars.'),
    category: z.enum(FACT_CATEGORIES).optional().describe('Best-fit category: family / work / health / preference / context / other.'),
  }),
  call: async (args, context) => {
    const result = await saveFact(context.supabase, context.user.id, {
      fact: args.fact,
      category: args.category,
    });
    if (!result.ok) return { ok: false, error: result.error || 'Failed to save fact' };
    return {
      ok: true,
      receipt: {
        fact_id: result.fact_id,
        status: result.status,
      },
    };
  },
});

export const memoryRecallThreadsTool = defineTool({
  name: 'memory.recall_threads',
  description: `Searches the user's PAST conversations (other threads) by semantic similarity. Read-only.

WHEN TO USE: the user signals they're referring to something from another conversation. Trigger phrases:
- "lembra", "você se lembra", "lembra que eu te falei"
- "aquela conversa", "naquele dia", "na conversa passada", "no outro dia"
- "you said before", "we talked about", "remember when", "last time we"
- The user references something specific (a name, a project, a decision) you don't have in this thread's context AND you sense the missing context could exist in a past thread.

DO NOT use for facts already loaded in your memory section (those are in your system prompt). DO NOT use for the current thread (you have full context here). DO NOT use as a default — only when the user signals past conversation OR you're missing context the user expects you to have.

CONTRACT:
- query: a free-text search phrase, ideally a short paraphrase of what you're looking for. Examples: "the salary discussion", "Anna's birthday plan", "the React bug we debugged".
- k (optional, default 4): max matches to return.
- The current thread is excluded automatically.

RETURNS receipt: { matches: [{ thread_id, summary, key_topics, similarity, summarized_at }], count }.
- summary is a 3-6 sentence dense paragraph from a past thread. Use it as context, paraphrase to the user — never quote verbatim.
- key_topics are tags. similarity is 0-1 (above 0.7 is strong, below 0.55 is filtered out automatically).
- thread_id is TECHNICAL — never read aloud.

If count = 0, tell the user you couldn't find that conversation in memory and ask them to remind you of what they meant. Do NOT fabricate.

If you find a match, weave the recalled context into your reply naturally: "Pelo que conversamos antes — você estava considerando aceitar a oferta dos 7K com adjustment em 90 dias. Continua assim, ou mudou?"`,
  isReadOnly: true,
  inputSchema: z.object({
    query: z.string().min(3).max(500).describe('Free-text search phrase. Paraphrase what you are looking for in past conversations.'),
    k: z.number().optional().describe(`Max matches. Default ${RECALL_DEFAULT_K}.`),
  }),
  call: async (args, context) => {
    const matches = await recallSimilarThreads(
      context.supabase,
      context.user.id,
      args.query,
      {
        k: args.k || RECALL_DEFAULT_K,
        threshold: RECALL_SIMILARITY_THRESHOLD,
        excludeThreadId: context.threadId,
      },
    );
    return {
      ok: true,
      receipt: {
        matches: matches.map((m) => ({
          thread_id: m.thread_id,
          summary: m.summary,
          key_topics: m.key_topics,
          similarity: Math.round(m.similarity * 100) / 100,
          summarized_at: m.summarized_at,
        })),
        count: matches.length,
      },
    };
  },
});

export const memoryAppendToPersonTool = defineTool({
  name: 'memory.append_to_person',
  description: `Append structured knowledge to a person's Profile note, creating the person and their Profile note if needed. This is a WRITE tool for the user's Notes/People knowledge graph.

WHEN TO USE:
- After saving a durable fact with memory.save_fact when the fact is about a specific person or relationship.
- When the user gives demographic/personal info about someone important ("Anna is my wife", "Sofia has peanut allergy").
- When a marked or meaningful event happened to / with a person and should be remembered on that person's note.

CONTRACT:
- APPEND ONLY. Never overwrite or replace a note. This tool appends a dated, structured section to the person's Profile note.
- It creates the person if they do not exist, creates the Profile note if missing, and inserts TipTap @mentions for related people.
- Do not infer sensitive info. Only append what the user said or explicitly asked you to remember.
- For ordinary daily events, use memory.append_to_briefing instead. For marked events involving people, call BOTH: append_to_briefing and append_to_person for each related person.

RETURNS receipt: { note_id, note_title, appended, skipped_duplicate, people }`,
  isReadOnly: false,
  inputSchema: z.object({
    person: relatedPersonSchema.optional().describe('The primary person whose Profile note should receive the append. Accepts either { name } or a plain string name.'),
    section_type: z.enum(['fact', 'personal_info', 'marked_event']).optional().default('personal_info').describe('What kind of section to append.'),
    title: z.string().min(3).max(120).optional().describe('Short section title. Example: "Family relationship" or "Health note".'),
    content: z.string().min(3).max(1200).optional().describe('The exact knowledge to append, written clearly and without unsupported inference. If omitted, title is used as fallback.'),
    related_people: relatedPeopleSchema.optional().describe('Other people related in this context. Accepts objects or plain string names. They will be @mentioned and created if missing.'),
  }),
  call: async (args, context) => {
    const targetPerson = args.person && !isSelfReferenceName(args.person.name) ? args.person : args.related_people?.[0];
    if (!targetPerson?.name?.trim() || isSelfReferenceName(targetPerson.name)) {
      return {
        ok: true,
        receipt: {
          appended: false,
          skipped_missing_person: true,
          reason: 'No real primary person was provided. Daily briefing append is enough for this event.',
        },
      };
    }
    const result = await appendToPersonKnowledge(context.supabase, context.user.id, {
      person: targetPerson,
      sectionType: args.section_type,
      title: args.title,
      content: args.content || args.title || '',
      relatedPeople: args.related_people || [],
      self: resolveSelfIdentity(context.user),
      nowIso: context.nowIso,
    });
    if (!result.ok) return { ok: false, error: result.error || 'Failed to append to person note' };
    return {
      ok: true,
      receipt: {
        note_id: result.note_id,
        note_title: result.note_title,
        appended: result.appended,
        skipped_duplicate: result.skipped_duplicate,
        people: result.people,
      },
    };
  },
});

export const memoryAppendToBriefingTool = defineTool({
  name: 'memory.append_to_briefing',
  description: `Append an event or conversation occurrence to today's Daily Briefing note. This is a WRITE tool for the user's Notes knowledge graph.

WHEN TO USE:
- The user describes an occurrence, event, decision, conflict, milestone, conversation, or thing that happened today.
- Use this even if the event is not durable enough for memory.save_fact. Facts and events are different.
- If the event is marked/important and involves people, also call memory.append_to_person for each related person.
- The user says "put on notes", "register this", "save this to my notes", "anota isso", "registra nos documentos", "coloca no briefing", "save conversation points" — ALWAYS use this tool for these phrases, never notes.create_note.

CONTRACT:
- APPEND ONLY. Never overwrite or replace the Daily Briefing note.
- Creates today's Daily Briefing note if missing.
- Creates mentioned people if missing and inserts TipTap @mentions.
- Keep content factual, concise, and grounded in what the user said.
- Call this tool ONCE per conversation event per turn. Do NOT call it multiple times for the same topic — that creates duplicates. If you already appended this topic in this turn, skip.
- The duplicate check uses the title + first ~80 chars of content. If the receipt returns skipped_duplicate=true, the entry already existed — do NOT retry with different wording, just tell the user "já estava registrado".
- title: a short label like "Council: career decision" or "Discussed CNH plan". content: 1–3 sentence factual summary.

RETURNS receipt: { note_id, note_title, appended, skipped_duplicate, people }`,
  isReadOnly: false,
  inputSchema: z.object({
    title: z.string().min(3).max(120).optional().describe('Short event title. Example: "Salary decision discussion".'),
    content: z.string().min(3).max(1200).optional().describe('A concise record of what happened or was discussed. If omitted, title is used as fallback.'),
    related_people: relatedPeopleSchema.optional().describe('People related to the event. Accepts objects or plain string names. They will be @mentioned and created if missing.'),
    marked: z.boolean().optional().describe('True if this was an important/marked event. If true and people are involved, also call memory.append_to_person.'),
  }),
  call: async (args, context) => {
    const result = await appendToDailyBriefing(context.supabase, context.user.id, {
      title: args.title,
      content: args.content || args.title || '',
      relatedPeople: args.related_people || [],
      self: resolveSelfIdentity(context.user),
      nowIso: context.nowIso,
    });
    if (!result.ok) return { ok: false, error: result.error || 'Failed to append to daily briefing' };
    return {
      ok: true,
      receipt: {
        note_id: result.note_id,
        note_title: result.note_title,
        appended: result.appended,
        skipped_duplicate: result.skipped_duplicate,
        people: result.people,
        marked: args.marked || false,
      },
    };
  },
});
