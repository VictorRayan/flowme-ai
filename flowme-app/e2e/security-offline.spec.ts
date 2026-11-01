import { expect, test } from '@playwright/test';

test.beforeEach(async ({ context }) => {
  await context.route('**/*', route => {
    const hostname = new URL(route.request().url()).hostname;
    if (hostname === '127.0.0.1' || hostname === 'localhost') return route.continue();
    return route.abort();
  });
});

test('public pages render and protected pages redirect to login', async ({ page }) => {
  await page.goto('/login');
  await expect(page).toHaveURL(/\/login/);
  await page.goto('/app/notes');
  await expect(page).toHaveURL(/\/login/);
});

test('spoofed scheduler headers cannot invoke cross-user jobs', async ({ request }) => {
  for (const endpoint of ['check-connectors', 'send-reminders', 'summarize-stale-threads']) {
    const response = await request.get(`/api/cron/${endpoint}`, {
      headers: { 'x-vercel-cron': '1' },
    });
    expect(response.status(), endpoint).toBe(401);
  }
});

test('uncredentialed API and fake payment webhook are rejected', async ({ request }) => {
  const documents = await request.get('/api/v1/documents');
  expect(documents.status()).toBe(401);

  const webhook = await request.post('/api/webhooks/asaas', {
    data: { id: 'fake-event', event: 'PAYMENT_RECEIVED', payment: { id: 'fake-payment' } },
    headers: { 'asaas-access-token': 'wrong-token' },
  });
  expect(webhook.status()).toBe(401);
});
