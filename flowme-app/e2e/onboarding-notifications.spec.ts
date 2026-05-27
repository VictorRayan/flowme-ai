import { expect, test } from '@playwright/test';

const PROPOSAL = {
  response: 'Perfeito! Estruturei seu objetivo e podemos seguir.',
  type: 'proposal',
  proposalButtonText: 'Aceitar',
  proposalData: {
    annual_smart_goal: 'Correr uma maratona em 2026',
    monthly_milestone: 'Treinar 4x por semana',
    weekly_routine: 'Correr às 06:00 por 45 minutos todos os dias',
    preferred_time: '06:00',
    default_task_duration_minutes: 45,
  },
};

test.describe('onboarding browser notifications step', () => {
  test('prompts for browser notifications after goals and advances once granted', async ({ page, context }) => {
    // Simulate the user accepting the native browser permission prompt.
    await context.grantPermissions(['notifications'], { origin: 'http://127.0.0.1:3000' });

    // Stub Balys so we deterministically reach the notification step without live AI.
    await page.route('**/api/v1/onboarding/assistant', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(PROPOSAL) }),
    );
    // Keep the background push registration from contacting a real push service.
    await page.route('**/api/web-push/vapid-public-key', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ publicKey: '' }) }),
    );

    await page.goto('/onboarding');

    // Step 0 — language
    await page.getByRole('button', { name: 'Português' }).click();
    // Step 1 — prelude
    await page.getByRole('button', { name: 'Começar minha configuração' }).click();
    // Step 2 — goal quantity (default 1)
    await page.getByRole('button', { name: 'Continuar' }).click();
    // Step 3 — AI consultation: submit a goal, accept the proposal
    await page.getByPlaceholder('Sua resposta...').fill('Quero correr uma maratona');
    await page.getByPlaceholder('Sua resposta...').press('Enter');
    await page.getByRole('button', { name: 'Começar minha jornada' }).click();

    // Step 4 — mandatory notification instruction (no opt-out toggle)
    const notifTitle = page.getByText('Ative seus lembretes');
    await expect(notifTitle).toBeVisible();
    await expect(page.getByText(/lembretes pelo navegador/i)).toBeVisible();
    // No toggle to opt out — the only path forward is the enable button.
    await page.getByRole('button', { name: 'Ativar notificações' }).click();

    // Granting advances past the notification step without showing a denial error.
    await expect(notifTitle).toBeHidden();
    await expect(page.getByText('Você bloqueou a permissão. Habilite nas configurações do navegador e tente de novo.')).toHaveCount(0);
  });
});
