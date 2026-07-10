import { expect, test } from '@playwright/test';

const viewports = [
  { name: 'mobile', width: 390, height: 844 },
  { name: 'tablet-portrait', width: 768, height: 1024 },
  { name: 'tablet-landscape', width: 1024, height: 768 },
  { name: 'desktop', width: 1440, height: 900 },
];

test.describe('onboarding foreground readability', () => {
  for (const viewport of viewports) {
    test(`keeps content readable without horizontal overflow on ${viewport.name}`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto('/onboarding');

      const stage = page.getByTestId('onboarding-stage');
      await expect(stage).toBeVisible();
      await expect(page.getByText('Please choose your language / Por favor, escolha seu idioma.')).toBeVisible();
      await expect(page.getByRole('button', { name: 'Português' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'English' })).toBeVisible();

      const layout = await page.evaluate(() => ({
        viewport: document.documentElement.clientWidth,
        content: document.documentElement.scrollWidth,
        stageBackground: getComputedStyle(document.querySelector('[data-testid="onboarding-stage"]')!).backgroundColor,
      }));
      expect(layout.content).toBeLessThanOrEqual(layout.viewport);
      expect(layout.stageBackground).not.toBe('rgba(0, 0, 0, 0)');
    });
  }
});
