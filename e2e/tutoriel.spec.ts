import { expect, test } from '@playwright/test';

// Ici, aucune astuce n'a encore été vue.
test.use({ storageState: { cookies: [], origins: [] } });

test.describe('astuces de première visite', () => {
  test('montrée une fois, puis plus jamais', async ({ page }) => {
    await page.goto('/');
    const tip = page.getByRole('dialog', { name: '👋 Bienvenue !' });
    await expect(tip).toBeVisible();
    await tip.getByRole('button', { name: 'Compris' }).click();
    await expect(tip).toHaveCount(0);
    await page.reload();
    await expect(page.locator('.tiles')).toBeVisible();
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });

  test('swipe 4 coins : vue sur les films, pas reprise sur les séries ni les animes', async ({ page }) => {
    await page.goto('/#/swipe/movie');
    const tip = page.getByRole('dialog', { name: '🕹️ Swipe vers un coin' });
    await expect(tip).toBeVisible();
    await expect(tip.locator('.tuto-corners')).toContainText('↖ Envie');
    // Astuces à jour (13/11) : l'affiche ouvre la fiche complète, et une saga s'écarte d'un coup.
    await expect(tip).toContainText('Touche l’affiche pour sa fiche complète');
    await expect(tip).toContainText('« 💤 Pas envie de la saga »');
    await expect(tip).not.toContainText('lire le résumé');
    await tip.getByRole('button', { name: 'Fermer' }).click(); // la croix compte aussi
    await page.goto('/#/swipe/tv');
    await expect(page.locator('.swipe-page')).toBeVisible();
    await page.goto('/#/swipe/anime');
    await expect(page.locator('.swipe-page')).toBeVisible();
    await page.waitForTimeout(500);
    await expect(page.getByRole('dialog', { name: /Swipe/ })).toHaveCount(0);
  });

  test('swipe 2 directions et duels : astuces à jour (fiche complète, ℹ)', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => localStorage.setItem('swipe-mode', 'horizontal'));
    await page.goto('/#/swipe/movie');
    const swipeTip = page.getByRole('dialog', { name: '🕹️ Swipe' });
    await expect(swipeTip).toContainText('Touche l’affiche pour sa fiche complète');
    await expect(swipeTip).toContainText('« 💤 Pas envie de la saga »');
    await swipeTip.getByRole('button', { name: 'Compris' }).click();
    await page.goto('/#/rank/movie');
    const rankTip = page.getByRole('dialog', { name: '🏆 Classer par duels' });
    await expect(rankTip).toContainText('ℹ sur une affiche : sa fiche complète');
  });

  test('« Revoir les astuces » dans les réglages', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('dialog').getByRole('button', { name: 'Compris' }).click();
    await page.goto('/#/settings');
    await page.getByRole('button', { name: '💡 Revoir les astuces' }).click();
    await page.goto('/#/');
    await expect(page.getByRole('dialog', { name: '👋 Bienvenue !' })).toBeVisible();
  });
});
