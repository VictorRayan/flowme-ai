import { expect, test } from '@playwright/test';
import { authenticateBrowser, getAdminClient, getTestUser, requireRealE2EEnv } from './helpers/real-flowme';

test.describe('support cancellation flow layout', () => {
  test.beforeAll(() => {
    requireRealE2EEnv();
  });

  test('keeps the cancellation form reachable without horizontal overflow', async ({ page, context }) => {
    const admin = getAdminClient();
    await getTestUser(admin);
    await authenticateBrowser(context, admin);
    await context.addInitScript(() => localStorage.setItem('ui_language', 'en'));

    await page.goto('/app/support?intent=cancel_subscription');
    await expect(page.getByRole('heading', { name: 'Support', exact: true })).toBeVisible();

    for (const label of ['Payment and recurrence', 'Cancel subscription']) {
      const button = page.getByRole('button', { name: label });
      if (await button.isVisible().catch(() => false)) await button.click();
    }

    await expect(page.getByRole('heading', { name: 'Detailed cancellation request' })).toBeVisible();
    await expect(page.getByLabel('Explain your reason in detail')).toBeVisible();

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(2);
  });
});
