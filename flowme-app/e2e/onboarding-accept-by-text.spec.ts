import { expect, test } from '@playwright/test';

const PROPOSAL = {
  response: 'Fechamos! Treinar 1h todos os dias às 19h por 6 meses.',
  type: 'proposal',
  proposalButtonText: 'Aceitar',
  proposalData: {
    annual_smart_goal: 'Ganhar 5kg de músculo em 6 meses',
    monthly_milestone: 'Ganhar ~0,8kg de músculo no mês',
    weekly_routine: 'Treinar às 19:00 por 60 minutos todos os dias',
    preferred_time: '19:00',
    default_task_duration_minutes: 60,
  },
};

test.describe('onboarding accept proposal by typing', () => {
  test('typing "aceitar proposta" confirms the proposal and advances', async ({ page }) => {
    await page.route('**/api/v1/onboarding/assistant', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(PROPOSAL) }),
    );

    await page.goto('/onboarding');
    await page.getByRole('button', { name: 'Português' }).click();
    await page.getByRole('button', { name: 'Começar minha configuração' }).click();
    await page.getByRole('button', { name: 'Continuar' }).click();
    await page.getByPlaceholder('Sua resposta...').fill('Quero ganhar 5kg de músculo');
    await page.getByPlaceholder('Sua resposta...').press('Enter');

    // The proposal (and its accept button) is now on screen.
    await expect(page.getByRole('button', { name: 'Começar minha jornada' })).toBeVisible();

    // Instead of clicking it, type an acceptance — it should confirm and advance.
    await page.getByPlaceholder('Sua resposta...').fill('aceitar proposta');
    await page.getByPlaceholder('Sua resposta...').press('Enter');

    // Reached the next step (mandatory browser-notification step).
    await expect(page.getByText('Ative seus lembretes')).toBeVisible();
  });
});
