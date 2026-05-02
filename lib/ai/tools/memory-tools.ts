import { z } from 'zod';
import { defineTool } from './Tool';
import { saveFact, FACT_CATEGORIES } from '@/lib/ai/memory/facts';
import { recallSimilarThreads, RECALL_DEFAULT_K, RECALL_SIMILARITY_THRESHOLD } from '@/lib/ai/memory/recall';

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
