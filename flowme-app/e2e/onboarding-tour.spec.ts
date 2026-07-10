import { expect, test, type Page, type BrowserContext } from '@playwright/test';

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

/** Walk the wizard to the platform tour: goals → notifications → skip WhatsApp → rituals → Continuar. */
async function reachTour(page: Page, context: BrowserContext) {
  await context.grantPermissions(['notifications'], { origin: 'http://127.0.0.1:3000' });

  await page.route('**/api/v1/onboarding/assistant', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(PROPOSAL) }),
  );
  await page.route('**/api/web-push/vapid-public-key', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ publicKey: '' }) }),
  );
  await page.route('**/api/places/autocomplete**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ predictions: [{ label: 'São Paulo, São Paulo — Brasil', description: 'São Paulo, São Paulo — Brasil', place_id: 'sp-1' }] }),
    }),
  );
  await page.route('**/api/places/timezone**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ timezone: 'America/Sao_Paulo' }) }),
  );

  await page.goto('/onboarding');

  await page.getByRole('button', { name: 'Português' }).click();
  await page.getByRole('button', { name: 'Começar minha configuração' }).click();
  await page.getByRole('button', { name: 'Continuar' }).click();
  await page.getByPlaceholder('Sua resposta...').fill('Quero correr uma maratona');
  await page.getByPlaceholder('Sua resposta...').press('Enter');
  await page.getByRole('button', { name: 'Começar minha jornada' }).click();

  await expect(page.getByText('Ative seus lembretes')).toBeVisible();
  await page.getByRole('button', { name: 'Ativar notificações' }).click();

  await expect(page.getByRole('heading', { name: 'Vincule seu WhatsApp' })).toBeVisible();
  await page.getByRole('button', { name: 'Pular por enquanto' }).click();

  // Final ritual contract → advance into the tour.
  await expect(page.getByRole('heading', { name: 'Seus Rituais Diários' })).toBeVisible();
  await page.getByLabel('Cidade, estado — país').fill('São Paulo');
  await page.getByRole('option', { name: 'São Paulo, São Paulo — Brasil' }).click();
  await expect(page.getByText('Horário local: America/Sao_Paulo')).toBeVisible();
  await page.getByRole('button', { name: 'Continuar' }).click();
}

test.describe('onboarding platform tour', () => {
  test('walks every section and finishes on the mandatory Tutorials step', async ({ page, context }) => {
    await reachTour(page, context);

    // Section 1 — Balys, with a real use case and audio/image hints.
    await expect(page.getByRole('heading', { name: 'Seu conselheiro de IA' })).toBeVisible();
    await expect(page.getByText(/Agende um standup amanhã/i)).toBeVisible();
    await page.getByRole('button', { name: 'Próximo' }).click();

    // Section 2 — Connections.
    await expect(page.getByRole('heading', { name: 'Conecte suas fontes de dados' })).toBeVisible();
    await expect(page.getByText(/Gmail/)).toBeVisible();
    await page.getByRole('button', { name: 'Próximo' }).click();

    // Section 3 — Notes & daily briefing.
    await expect(page.getByRole('heading', { name: 'Sua memória externa' })).toBeVisible();
    await expect(page.getByText(/briefing/i).first()).toBeVisible();
    await page.getByRole('button', { name: 'Próximo' }).click();

    // Section 4 — mandatory review step points to Tutorials; no skip here.
    await expect(page.getByRole('heading', { name: 'Pode rever quando quiser' })).toBeVisible();
    await expect(page.getByText(/seção Tutoriais/i)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Pular tutorial' })).toHaveCount(0);

    // Finishing persists and leaves onboarding.
    await page.route('**/api/v1/onboarding/complete', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, calendar_events_created: 0 }) }),
    );
    await page.route('**/api/briefings/preferences', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) }),
    );

    await page.getByRole('button', { name: 'Começar minha jornada' }).click();
    await page.waitForURL((url) => !url.pathname.startsWith('/onboarding'));
  });

  test('lets the user skip the tutorial straight to the mandatory step', async ({ page, context }) => {
    await reachTour(page, context);

    await expect(page.getByRole('heading', { name: 'Seu conselheiro de IA' })).toBeVisible();
    await page.getByRole('button', { name: 'Pular tutorial' }).click();

    // Jumps directly to the mandatory Tutorials step.
    await expect(page.getByRole('heading', { name: 'Pode rever quando quiser' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Pular tutorial' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Começar minha jornada' })).toBeVisible();
  });
});
