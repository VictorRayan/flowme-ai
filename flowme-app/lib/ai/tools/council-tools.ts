import { z } from 'zod';
import { defineTool } from './Tool';
import { CouncilMode, runAiCouncilPipeline } from '@/lib/ai/council-agents';

export const councilConveneTool = defineTool({
  name: 'council.convene',
  description: `Convenes the Balys Mastermind Council: 11 specialist agents (lawyer, accountant, doctor, psychologist, entrepreneur, RevOps, economist, politician, spiritual guide, love/relationships counselor, mechanic-as-infrastructure-metaphor) to deliberate on a hard, multi-faceted decision and return a synthesized CEO directive.

WHEN TO USE: the user is wrestling with a real decision where one expert's view is not enough. Triggers include "council", "mastermind", "board", "advisors", "conselho", "conselheiros", "what should I do", "help me decide", "I'm torn", "should I...", "is it worth...", "estou em duvida", "o que voce acha". Also use proactively for career moves, big purchases, relationship dilemmas, business strategy, ethics, and life pivots when the question genuinely benefits from multi-perspective analysis.

WHEN NOT TO USE: factual questions, simple task requests ("what's on my calendar?"), things one tool can answer, or casual chat. The council is expensive and unnecessary for most turns. Do not reach for it on every "what do you think?" - only when the user's framing signals a real dilemma.

CONTRACT:
- situation is REQUIRED. Pass the full context the council needs: what the user is deciding, options on the table, constraints (money, time, relationships), and any relevant background already gathered from notes/calendar/email in this conversation.
- Read-only from the user's perspective. The council does not modify the user's data. It only reads the situation you provide.
- The user's Settings choose the council mode: cheap is a single round plus CEO; best is multi-round debate with advisor refinement, cross-examination, and dynamic CEO moderation.
- Returns a CEO directive. Deliver it to the user in your normal voice. Do not preface with "the council says" or list each member's view unless the user explicitly asks.

RETURNS receipt: { directive, final_mode, council_mode, rounds_run, members_consulted, transcript, status: 'consulted' }.
- final_mode is one of clarification, plan, verdict.
- directive is the user-facing synthesis. Adapt it to the user's language and voice.
- transcript contains the advisor debate for technical inspection and timeline details. Do not dump it into the final answer unless the user asks for the council transcript.

ASK THE USER FIRST IF: their situation is too vague to brief the council on (e.g. "I need advice" with no context). Pull a sentence or two of context first. Do not summon the council blind.`,
  isReadOnly: true,
  inputSchema: z.object({
    situation: z.string().describe('Full briefing for the council: what the user is deciding, options, constraints, and relevant background. Multi-paragraph is fine.'),
  }),
  call: async (args, context) => {
    try {
      const councilMode = await loadCouncilMode(context.supabase, context.user.id);
      const result = await runAiCouncilPipeline(args.situation, {
        mode: councilMode,
        onProgress: context.onProgress,
      });
      return {
        ok: true,
        receipt: {
          directive: result.ceoDirective,
          final_mode: result.finalMode,
          council_mode: result.councilMode,
          rounds_run: result.roundsRun,
          advisor_count: result.individualAdvice.length,
          members_consulted: result.individualAdvice.length,
          transcript: result.transcript,
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

async function loadCouncilMode(supabase: any, userId: string): Promise<CouncilMode> {
  try {
    const { data } = await supabase
      .from('user_settings')
      .select('council_mode')
      .eq('user_id', userId)
      .maybeSingle();
    return data?.council_mode === 'best' ? 'best' : 'cheap';
  } catch (e) {
    console.warn('[council.convene] Falling back to cheap mode; failed to read user_settings.', e);
    return 'cheap';
  }
}
