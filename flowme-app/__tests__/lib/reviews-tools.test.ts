jest.mock('@/lib/reviews/weekly-review', () => ({
  ensureCurrentWeeklyReview: jest.fn(),
  getLatestWeeklyReview: jest.fn(),
  saveWeeklyBriefingAndRegenerate: jest.fn(),
}));

import { reviewsGetLatestTool, reviewsSaveWeeklyBriefingTool, reviewsStartWeeklyReviewTool } from '@/lib/ai/tools/reviews-tools';
import { ensureCurrentWeeklyReview, getLatestWeeklyReview, saveWeeklyBriefingAndRegenerate } from '@/lib/reviews/weekly-review';

const context: any = {
  supabase: {},
  user: { id: 'user-1' },
  timezone: 'America/Sao_Paulo',
  nowIso: '2026-05-31T18:00:00-03:00',
};

describe('reviews tools', () => {
  beforeEach(() => jest.clearAllMocks());

  it('starts the current weekly review and returns human-readable feedback', async () => {
    (ensureCurrentWeeklyReview as jest.Mock).mockResolvedValue({
      period_start: '2026-05-25',
      period_end: '2026-05-31',
      status: 'ready',
      review_content: { recommendation: 'Proteja blocos de foco.' },
      suggested_action_plan: null,
    });
    const result = await reviewsStartWeeklyReviewTool.call({}, context);
    expect(result.ok).toBe(true);
    expect(result.receipt).toEqual(expect.objectContaining({ status: 'ready' }));
    expect(JSON.stringify(result.receipt)).not.toContain('review_id');
  });

  it('asks for a short briefing when qualitative context is missing', async () => {
    (getLatestWeeklyReview as jest.Mock).mockResolvedValue({
      period_start: '2026-05-25',
      period_end: '2026-05-31',
      status: 'awaiting_briefing',
      review_content: null,
      suggested_action_plan: null,
    });
    const result = await reviewsGetLatestTool.call({}, context);
    expect(result.receipt).toEqual(expect.objectContaining({ needs_weekly_briefing: true }));
  });

  it('saves the weekly briefing and regenerates feedback', async () => {
    (saveWeeklyBriefingAndRegenerate as jest.Mock).mockResolvedValue({
      period_start: '2026-05-25',
      period_end: '2026-05-31',
      status: 'ready',
      review_content: { recommendation: 'Planeje margens.' },
      suggested_action_plan: null,
    });
    const result = await reviewsSaveWeeklyBriefingTool.call({ briefing: 'Tive imprevistos durante três dias.' }, context);
    expect(result.ok).toBe(true);
    expect(saveWeeklyBriefingAndRegenerate).toHaveBeenCalledWith(expect.anything(), 'user-1', 'Tive imprevistos durante três dias.', expect.anything());
  });
});
