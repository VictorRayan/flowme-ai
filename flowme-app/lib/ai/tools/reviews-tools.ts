import { z } from 'zod';
import { defineTool } from './Tool';
import { ensureCurrentWeeklyReview, refreshLatestWeeklyReviewIfOutdated, saveWeeklyBriefingAndRegenerate, type WeeklyReviewRecord } from '@/lib/reviews/weekly-review';
import { ensureMonthlyReview, getLatestMonthlyReview, type MonthlyReviewRecord } from '@/lib/reviews/monthly-review';

function visibleReview(review: WeeklyReviewRecord | null) {
  if (!review) return null;
  const metrics = review.evidence?.metrics || null;
  return {
    period: { start: review.period_start, end: review.period_end },
    status: review.status,
    needs_weekly_briefing: review.status === 'awaiting_briefing',
    briefing_prompt: review.status === 'awaiting_briefing'
      ? 'Peça ao usuário um resumo curto da semana: principais acontecimentos, dificuldades e imprevistos.'
      : null,
    metrics,
    not_done_reasons: review.evidence?.not_done_reasons || [],
    feedback: review.review_content,
    suggested_action_plan: review.suggested_action_plan,
  };
}

function visibleMonthlyReview(review: MonthlyReviewRecord | null) {
  if (!review) return null;
  const summary = review.evidence?.financial_summary || null;
  return {
    period: { start: review.period_start, end: review.period_end },
    status: review.status,
    financial_summary: summary,
    alerts: review.evidence?.alerts || [],
    feedback: review.review_content,
  };
}

export const reviewsStartWeeklyReviewTool = defineTool({
  name: 'reviews.start_weekly_review',
  description: `Starts or refreshes the user's current Weekly Review using deterministic Flow Me evidence and Council-backed interpretation.

WHEN TO USE: the user says "Iniciar Revisão semanal", "Start Weekly Review", asks to review the week, or opens the weekly-review notification.

CONTRACT:
- Gathered evidence includes task/event execution, not-done reasons, unanswered commitments, reschedules, goals, action-plan tasks, notes, daily briefings, meetings, and recent chat summaries.
- If status is awaiting_briefing, ask the user for a short weekly summary before diagnosing anything. Then call reviews.save_weekly_briefing.
- If status is ready, present the feedback naturally and offer the suggested action plan only when present. Never auto-create an action plan.
- Never expose technical IDs.`,
  isReadOnly: false,
  inputSchema: z.object({}),
  call: async (_args, context) => {
    const review = await ensureCurrentWeeklyReview(context.supabase, context.user.id, {
      now: new Date(context.nowIso),
      timezone: context.timezone,
    });
    return { ok: true, receipt: visibleReview(review) };
  },
});

export const reviewsGetLatestTool = defineTool({
  name: 'reviews.get_latest',
  description: `Reads the user's latest Weekly Review.

WHEN TO USE: the user asks what Balys learned from their last week, asks for the latest review, or needs the current review state.

RETURNS human-readable evidence and feedback only. Never expose technical IDs.`,
  isReadOnly: true,
  inputSchema: z.object({}),
  call: async (_args, context) => {
    const review = await refreshLatestWeeklyReviewIfOutdated(context.supabase, context.user.id, {
      now: new Date(context.nowIso),
      timezone: context.timezone,
    });
    return { ok: true, receipt: visibleReview(review) || { status: 'not_found', needs_weekly_briefing: false } };
  },
});

export const reviewsSaveWeeklyBriefingTool = defineTool({
  name: 'reviews.save_weekly_briefing',
  description: `Saves the user's short weekly briefing and regenerates the Weekly Review.

WHEN TO USE: reviews.start_weekly_review or reviews.get_latest returned needs_weekly_briefing=true and the user answered with a summary of their week.

CONTRACT:
- briefing must be the user's own qualitative context. Do not invent or silently expand it.
- Regenerates Council-backed feedback after saving.
- Never auto-create an action plan.`,
  isReadOnly: false,
  inputSchema: z.object({
    briefing: z.string().min(5).max(4000).describe('User-authored short weekly summary, including important events, difficulties, and surprises.'),
  }),
  call: async (args, context) => {
    const review = await saveWeeklyBriefingAndRegenerate(context.supabase, context.user.id, args.briefing, {
      now: new Date(context.nowIso),
      timezone: context.timezone,
    });
    return { ok: true, receipt: visibleReview(review) };
  },
});

export const reviewsStartMonthlyReviewTool = defineTool({
  name: 'reviews.start_monthly_review',
  description: `Generates the user's latest Monthly Finance Review from deterministic financial data for the month that just closed.

WHEN TO USE: the user asks for monthly review, revisão mensal, fechamento do mês, or financial month analysis.

CONTRACT:
- Evidence comes from finance transactions and monthly summary only.
- Never invent totals.
- If income is missing, avoid precise investment recommendations.
- Never expose technical IDs.`,
  isReadOnly: false,
  inputSchema: z.object({}),
  call: async (_args, context) => {
    const review = await ensureMonthlyReview(context.supabase, context.user.id, {
      now: new Date(context.nowIso),
      timezone: context.timezone,
    });
    return { ok: true, receipt: visibleMonthlyReview(review) };
  },
});

export const reviewsGetLatestMonthlyTool = defineTool({
  name: 'reviews.get_latest_monthly',
  description: `Reads the user's latest Monthly Finance Review. Use when the user asks what Balys learned from their last month or latest monthly financial review.`,
  isReadOnly: true,
  inputSchema: z.object({}),
  call: async (_args, context) => {
    const review = await getLatestMonthlyReview(context.supabase, context.user.id);
    return { ok: true, receipt: visibleMonthlyReview(review) || { status: 'not_found' } };
  },
});

export const REVIEWS_TOOLS = [
  reviewsStartWeeklyReviewTool,
  reviewsGetLatestTool,
  reviewsSaveWeeklyBriefingTool,
  reviewsStartMonthlyReviewTool,
  reviewsGetLatestMonthlyTool,
];
