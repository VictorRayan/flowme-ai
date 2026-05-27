import { expect, test } from '@playwright/test';
import { authenticateBrowser, getAdminClient, getTestUser, requireRealE2EEnv } from './helpers/real-flowme';

// Requires real Supabase env (authenticated /app routes). Skipped automatically without it.
test.describe('tutorials section', () => {
  test.beforeAll(() => {
    requireRealE2EEnv();
  });

  test('opens a tutorial from the menu and returns to the list', async ({ page, context }) => {
    const admin = getAdminClient();
    await getTestUser(admin);
    await authenticateBrowser(context, admin);
    await context.addInitScript(() => localStorage.setItem('ui_language', 'pt'));

    await page.goto('/app/tutorials');

    // Landing states the boost purpose and lists the feature cards.
    await expect(page.getByRole('heading', { name: 'Tutoriais' })).toBeVisible();
    await expect(page.getByText(/dar um boost na sua produtividade/i)).toBeVisible();
    await expect(page.getByRole('link', { name: /Conversando com o Balys/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /Trilha do dia/i })).toBeVisible();

    // The track guide explains completing tasks on the Today tab.
    await page.getByRole('link', { name: /Trilha do dia/i }).click();
    await expect(page.getByRole('heading', { name: /Trilha do dia/ })).toBeVisible();
    await expect(page.getByText(/Clique em "Feito"/i)).toBeVisible();
    await page.getByRole('link', { name: 'Voltar aos tutoriais' }).first().click();
    await expect(page.getByRole('heading', { name: 'Tutoriais' })).toBeVisible();

    // Open the Notes guide.
    await page.getByRole('link', { name: /Notas: sua memória externa/i }).click();
    await expect(page.getByRole('heading', { name: 'Notas: sua memória externa' })).toBeVisible();
    // Step-by-step content with the precise "where it is" instruction.
    await expect(page.getByText(/No menu lateral à esquerda, clique em "Notas"/i)).toBeVisible();
    await expect(page.getByText(/canto inferior direito/i)).toBeVisible();

    // The user can go back to the tutorials home.
    await page.getByRole('link', { name: 'Voltar aos tutoriais' }).first().click();
    await expect(page.getByRole('heading', { name: 'Tutoriais' })).toBeVisible();
  });
});
