import { expect, test } from '@playwright/test';
import {
  authenticateBrowser,
  cleanupE2EData,
  createOnboardingPlan,
  E2E_TIMEZONE,
  findCalendarLink,
  getAdminClient,
  getGoogleEventSummary,
  getTestUser,
  requireRealE2EEnv,
} from './helpers/real-flowme';

test.describe.serial('real onboarding calendar flow', () => {
  test.beforeAll(() => {
    requireRealE2EEnv();
  });

  test('creates a contextual Google Calendar event and renders event-only product surfaces', async ({ page, context }) => {
    const admin = getAdminClient();
    const user = await getTestUser(admin);
    const prefix = `Playwright EventOnly ${new Date().toISOString().slice(0, 16)}`;

    await cleanupE2EData(admin, user.id, prefix);
    await authenticateBrowser(context, admin);

    try {
      await createOnboardingPlan(page, prefix);

      const link = await findCalendarLink(admin, user.id, prefix);
      const eventTitle = link.title;
      expect(eventTitle).toContain(prefix);
      await expect.poll(async () => getGoogleEventSummary(admin, link)).toBe(eventTitle);
      expect(eventTitle).not.toContain('Dedicar para');
      expect(eventTitle).not.toContain('Goal task');

      const todayApi = await page.request.get(`/api/tasks/range?from=${todayIso()}&to=${todayIso()}&timezone=${encodeURIComponent(E2E_TIMEZONE)}`);
      const todayBody = await todayApi.json();
      expect(todayApi.ok(), JSON.stringify(todayBody)).toBe(true);
      const matchingTasks = todayBody.days.flatMap((day: any) => day.tasks).filter((task: any) => task.title === eventTitle);
      expect(matchingTasks).toHaveLength(1);
      expect(matchingTasks[0]).toEqual(expect.objectContaining({
        source_type: 'calendar_event',
        execution_type: 'event',
      }));
      expect(matchingTasks[0]).not.toHaveProperty('priority_label');

      await page.goto('/app/today');
      await page.getByLabel(eventTitle, { exact: true }).first().click();
      await expect(page.getByText(eventTitle, { exact: true })).toBeVisible();
      await expect(page.locator('body')).not.toContainText('non_negotiable');
      await expect(page.locator('body')).not.toContainText('negotiable');
      await expect(page.locator('body')).not.toContainText('microactivities');

      await page.goto('/app/goals');
      await expect(page.getByText(prefix, { exact: false }).first()).toBeVisible();
      await expect(page.locator('body')).not.toContainText('non_negotiable');
      await expect(page.locator('body')).not.toContainText('negotiable');
      await expect(page.locator('body')).not.toContainText('routine');
      await expect(page.locator('body')).not.toContainText('microactivities');

      const actionPlans = await page.request.get('/api/action-plans');
      const actionPlanBody = await actionPlans.json();
      expect(actionPlans.ok(), JSON.stringify(actionPlanBody)).toBe(true);
      const matchingPlan = actionPlanBody.action_plans.find((plan: any) => String(plan.title || '').includes(prefix));
      expect(matchingPlan).toBeTruthy();
      expect(matchingPlan).not.toHaveProperty('priority_label');
    } finally {
      await cleanupE2EData(admin, user.id, prefix);
    }
  });
});

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}
