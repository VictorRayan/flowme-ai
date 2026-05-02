import { z } from 'zod';
import { defineTool } from './Tool';
import { runAiCouncilPipeline } from '@/lib/ai/council-agents';

export const councilConveneTool = defineTool({
  name: 'council.convene',
  description: `Convenes the Balys Mastermind Council — 11 specialist agents (lawyer, accountant, doctor, psychologist, entrepreneur, RevOps, economist, politician, spiritual guide, love/relationships counselor, mechanic-as-infrastructure-metaphor) — to deliberate on a hard, multi-faceted decision and return a synthesized "CEO directive."

WHEN TO USE: the user is wrestling with a real decision where ONE expert's view isn't enough. Triggers include "council", "mastermind", "board", "advisors", "conselho", "conselheiros", "what should I do", "help me decide", "I'm torn", "should I…", "is it worth…", "estou em dúvida", "o que você acha". Also use proactively for: career moves, big purchases, relationship dilemmas, business strategy, ethics, life pivots — even if the user didn't say "council" — when the question genuinely benefits from multi-perspective analysis.

WHEN NOT TO USE: factual questions, simple task requests ("what's on my calendar?"), things one tool can answer, casual chat. The council is expensive (~12 model calls, 5-15s) and unnecessary for most turns. Don't reach for it on every "what do you think?" — only when the user's framing signals a real dilemma.

CONTRACT:
- situation is REQUIRED. Pass the FULL context the council needs: what the user is deciding, options on the table, constraints (money, time, relationships), any relevant background you've already gathered from notes/calendar/email this conversation. Do not pass a one-liner — the council is only as good as the brief.
- Read-only from the user's perspective. The council does not modify any of the user's data. It only reads what you write into 'situation'.
- Returns a CEO directive — a synthesized verdict, not a list of opinions. Deliver it to the user in your normal voice. Do NOT preface with "the council says" or list each member's view; just answer the user's question naturally, drawing from the directive.

RETURNS receipt: { directive, members_consulted, status: 'consulted' }.
- directive is the user-facing synthesis — adapt it to the user's language and voice. You may quote or paraphrase.
- members_consulted is metadata (count of advisors that responded) — do not surface it.
- The full per-member breakdown is in data.individual_advice — TECHNICAL, never show it to the user unless they explicitly ask "what did each advisor say?".

ASK THE USER FIRST IF: their situation is too vague to brief the council on (e.g. "I need advice" with no context). Pull a sentence or two of context first. Don't summon the council blind.`,
  isReadOnly: true,
  inputSchema: z.object({
    situation: z.string().describe('Full briefing for the council — what the user is deciding, options, constraints, relevant background. Multi-paragraph is fine. The council reads only this; load it well.'),
  }),
  call: async (args, _context) => {
    try {
      const result = await runAiCouncilPipeline(args.situation);
      return {
        ok: true,
        receipt: {
          directive: result.ceoDirective,
          members_consulted: result.individualAdvice.length,
          status: 'consulted',
        },
        data: {
          individual_advice: result.individualAdvice,
        },
      };
    } catch (e: any) {
      return { ok: false, error: e.message || 'Council pipeline failed' };
    }
  },
});
