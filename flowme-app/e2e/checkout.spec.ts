import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import { authenticateBrowser, getAdminClient, getTestUser, requireRealE2EEnv } from './helpers/real-flowme';

const plan = {
  code: 'pro', locale: 'pt-BR', name: 'Flow Me Pro', short_description: 'Sua vida inteira fluindo em um só lugar.',
  description: 'Desbloqueie IA ilimitada, calendário, metas, finanças, conectores, automações, reuniões e muito mais.',
  checkout_badge: 'Mais escolhido', checkout_cta: 'Desbloquear meu Flow Me',
  feature_highlights: ['Créditos de IA ilimitados', 'Calendário, Today, metas e finanças', 'Conectores, WhatsApp e automações', 'Revisões, reuniões e geração de imagens'],
  prices: [{ interval: 'monthly', currency: 'BRL', amount_cents: 5990 }, { interval: 'annual', currency: 'BRL', amount_cents: 47880 }],
  annual_savings: { amountCents: 24000, percent: 33 },
};

async function prepareCheckout(page: Page, context: BrowserContext, pixAvailable: boolean) {
  await authenticateBrowser(context, getAdminClient());
  await context.addInitScript(() => localStorage.setItem('ui_language', 'pt'));
  await page.route('**/api/billing/catalog**', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, locale: 'pt-BR', plans: [plan], payment_methods: [] }) }));
  await page.route('**/api/billing/market', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, countryCode: pixAvailable ? 'BR' : 'US', pixAvailable }) }));
}

test.describe('checkout responsive contract', () => {
  test.beforeAll(async () => {
    requireRealE2EEnv();
    await getTestUser(getAdminClient());
  });

  test('keeps the Pix/Card switch visible and mounts card fields before checkout POST', async ({ page, context }) => {
    await prepareCheckout(page, context, true);
    let checkoutPosts = 0;
    await page.route('**/api/billing/checkout', route => {
      if (route.request().method() === 'POST') checkoutPosts += 1;
      return route.continue();
    });
    await page.goto('/app/checkout?interval=monthly');

    const switcher = page.getByRole('group', { name: 'Como você quer pagar?' });
    await expect(switcher).toBeVisible();
    await expect(page.getByTestId('checkout-offer-countdown')).toBeVisible();
    await expect(page.getByRole('timer')).toHaveText(/14:5\d|15:00/);
    await expect(page.getByText('Número do cartão')).toBeVisible();
    expect(checkoutPosts).toBe(0);

    await page.getByRole('button', { name: /Pix/ }).click();
    await expect(switcher).toBeVisible();
    await expect(page.getByLabel('Nome completo')).toBeVisible();
    await page.getByRole('button', { name: /Cartão/ }).click();
    await expect(switcher).toBeVisible();
    await expect(page.getByRole('timer')).toBeVisible();
    await expect(page.getByText('Número do cartão')).toBeVisible();
  });

  test('hides Pix outside Brazil and keeps card available', async ({ page, context }) => {
    await prepareCheckout(page, context, false);
    await page.goto('/app/checkout?interval=monthly');
    await expect(page.getByRole('button', { name: /Pix/ })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /Cartão/ })).toBeVisible();
    await expect(page.getByText('Número do cartão')).toBeVisible();
  });

  test('keeps product and payment reachable without horizontal overflow', async ({ page, context }) => {
    await prepareCheckout(page, context, true);
    await page.goto('/app/checkout?interval=monthly');
    await expect(page.getByText('Sua vida inteira fluindo em um só lugar.')).toBeVisible();
    await expect(page.getByText('Revisões, reuniões e geração de imagens')).toBeVisible();
    const scroll = page.getByTestId('checkout-scroll');
    await scroll.evaluate(element => element.scrollTo({ top: element.scrollHeight }));
    await expect(page.getByText('Pagamento protegido. Cancele quando quiser.')).toBeVisible();
    await expect(page.getByTestId('checkout-offer-countdown')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  });
});
