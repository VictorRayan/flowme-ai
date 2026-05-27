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

/** Walk steps 0–4 and grant browser notifications so we land on the WhatsApp step (5). */
async function reachWhatsappStep(page: Page, context: BrowserContext) {
  await context.grantPermissions(['notifications'], { origin: 'http://127.0.0.1:3000' });

  await page.route('**/api/v1/onboarding/assistant', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(PROPOSAL) }),
  );
  await page.route('**/api/web-push/vapid-public-key', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ publicKey: '' }) }),
  );

  await page.goto('/onboarding');

  await page.getByRole('button', { name: 'Português' }).click();
  await page.getByRole('button', { name: 'Começar minha configuração' }).click();
  await page.getByRole('button', { name: 'Continuar' }).click();
  await page.getByPlaceholder('Sua resposta...').fill('Quero correr uma maratona');
  await page.getByPlaceholder('Sua resposta...').press('Enter');
  await page.getByRole('button', { name: 'Começar minha jornada' }).click();

  // Step 4 — notifications, grant to advance to the WhatsApp step.
  await expect(page.getByText('Ative seus lembretes')).toBeVisible();
  await page.getByRole('button', { name: 'Ativar notificações' }).click();
  await expect(page.getByRole('heading', { name: 'Vincule seu WhatsApp' })).toBeVisible();
}

test.describe('onboarding WhatsApp linking step', () => {
  test('links a number via the verification code and shows it connected', async ({ page, context }) => {
    await page.route('**/api/whatsapp/channel', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true, sent: true, phone: '5511999999999', expires_at: new Date(Date.now() + 600000).toISOString() }),
      }),
    );
    await page.route('**/api/whatsapp/channel/verify', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, verified: true }) }),
    );

    await reachWhatsappStep(page, context);

    // Instruction explains the reminders purpose.
    await expect(page.getByText(/lembretes dos seus rituais e tarefas direto no WhatsApp/i)).toBeVisible();

    await page.getByLabel('Número do WhatsApp').fill('+5511999999999');
    await page.getByRole('button', { name: 'Enviar código' }).click();

    await expect(page.getByText(/Enviamos um código de 6 dígitos/i)).toBeVisible();
    await page.getByLabel('Código de 6 dígitos').fill('123456');
    await page.getByRole('button', { name: 'Verificar e continuar' }).click();

    // Lands on the final ritual contract with WhatsApp shown as connected.
    await expect(page.getByRole('heading', { name: 'Seus Rituais Diários' })).toBeVisible();
    await expect(page.getByText('WhatsApp conectado')).toBeVisible();
  });

  test('can be skipped and still reach the final step', async ({ page, context }) => {
    await reachWhatsappStep(page, context);

    await expect(page.getByText(/vincular o WhatsApp depois em Configurações/i)).toBeVisible();
    await page.getByRole('button', { name: 'Pular por enquanto' }).click();

    await expect(page.getByRole('heading', { name: 'Seus Rituais Diários' })).toBeVisible();
    await expect(page.getByText('Você pode conectar depois nas configurações.')).toBeVisible();
  });
});
