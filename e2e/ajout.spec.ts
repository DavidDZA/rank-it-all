import { expect, test } from '@playwright/test';

test.describe('ajout manuel', () => {
  test.describe('première visite', () => {
    test.use({ storageState: { cookies: [], origins: [] } });
    test('pas de focus dans la recherche : le clavier cacherait l’astuce', async ({ page }) => {
      await page.goto('/#/add');
      await expect(page.getByRole('dialog', { name: '🔍 Ajout manuel' })).toBeVisible();
      await expect(page.locator('input[type=search]')).not.toBeFocused();
    });
  });

  test('visites suivantes : focus dans la recherche', async ({ page }) => {
    await page.goto('/#/add');
    await expect(page.locator('input[type=search]')).toBeFocused();
  });
});
