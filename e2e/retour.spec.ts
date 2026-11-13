import { expect, test } from '@playwright/test';
import { openRanking, seed, title } from './helpers';

/** Bouton Retour (téléphone, appli Android, navigateur) : il ferme la fenêtre du dessus avant de quitter l'écran. */
const films = ['Inception', 'Parasite', 'Drive'].map((n, i) => title('movie', i + 1, n));
const back = (page: import('@playwright/test').Page) => page.evaluate(() => history.back());

test.beforeEach(async ({ page }) => {
  await seed(page, { titles: films, answers: films.map((t) => ({ key: t.key, status: 'seen' as const })), meta: { 'ranking:movie': films.map((t) => t.key) } }, '#/');
  await page.goto('/#/rank/movie');
  await openRanking(page);
});

test('Retour ferme les filtres, puis quitte l’écran', async ({ page }) => {
  await page.getByRole('button', { name: 'Filtres' }).click();
  await expect(page.getByRole('dialog', { name: 'Filtres' })).toBeVisible();
  await back(page);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(new URL(page.url()).hash).toBe('#/rank/movie'); // toujours sur le classement
  await back(page);
  await expect.poll(() => new URL(page.url()).hash).not.toBe('#/rank/movie');
});

test('fermée avec ✕, la fenêtre ne laisse rien dans l’historique', async ({ page }) => {
  await page.getByRole('button', { name: 'Filtres' }).click();
  await page.getByRole('button', { name: 'Fermer' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await back(page); // un seul Retour suffit pour quitter le classement
  await expect.poll(() => new URL(page.url()).hash).not.toBe('#/rank/movie');
});

test('Retour ferme la fiche d’un titre', async ({ page }) => {
  await page.locator('.row-text', { hasText: 'Parasite' }).click(); // la fiche, directement
  await expect(page.getByRole('dialog', { name: 'Fiche de Parasite' })).toBeVisible();
  await back(page);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(new URL(page.url()).hash).toBe('#/rank/movie');
});
