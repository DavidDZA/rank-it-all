import { expect, test, type Page } from '@playwright/test';

test.describe('accueil', () => {
  test('une ligne par catégorie : swiper à gauche, classer à droite', async ({ page }) => {
    await page.goto('/');
    const labels = page.locator('.tile-label');
    await expect(labels.first()).toBeVisible();
    await expect(labels).toHaveText([
      'Swiper les films',
      'Classer les films',
      'Swiper les séries',
      'Classer les séries',
      'Swiper les animes',
      'Classer les animes',
      'Wishlist',
      'Ajout manuel',
      'Mes listes',
      'Stats & badges',
    ]);
  });

  test('sans compte : la bannière mène à la connexion', async ({ page }) => {
    await page.goto('/');
    await page.locator('a.banner-soft', { hasText: 'Connecte-toi' }).click();
    await expect(page).toHaveURL(/#\/settings$/);
    await expect(page.getByText('Continuer avec Google')).toBeVisible();
  });

  test('rubrique Catalogue ouverte directement : en haut de l’écran', async ({ page }) => {
    await page.goto('/#/settings/catalogue');
    await page.waitForTimeout(2500); // les rubriques du dessus finissent de se charger
    const top = await page.locator('#catalogue').evaluate((el) => el.getBoundingClientRect().top);
    expect(Math.abs(top)).toBeLessThan(20);
  });

  test('catalogue jamais téléchargé : téléchargé tout seul à l’ouverture, avec sa progression', async ({ page }) => {
    await mockTmdb(page);
    await page.goto('/');
    await page.evaluate(() => localStorage.setItem('tmdb-token', 'jeton-de-test'));
    await page.reload();
    const progress = page.locator('.catalogue-progress');
    await expect(progress).toContainText('Préparation du catalogue');
    await expect(progress.getByRole('progressbar')).toBeVisible();
    await expect(page.getByText(/Catalogue prêt : 60 films/)).toBeVisible({ timeout: 20_000 });
    await expect(progress).toHaveCount(0);
    await expect(page.locator('.tile', { hasText: 'Swiper les films' })).toContainText('60 à découvrir');
    // Pas de second téléchargement au lancement suivant.
    let calls = 0;
    page.on('request', (r) => r.url().includes('api.themoviedb.org') && calls++);
    await page.reload();
    await expect(page.locator('.tile', { hasText: 'Swiper les films' })).toContainText('60 à découvrir');
    await page.waitForTimeout(1000);
    expect(calls).toBe(0);
  });

  test('téléchargement en échec : message et « Réessayer »', async ({ page }) => {
    await page.route('https://api.themoviedb.org/**', (r) => r.fulfill({ status: 500, body: '{}' }));
    await page.goto('/');
    await page.evaluate(() => localStorage.setItem('tmdb-token', 'jeton-de-test'));
    await page.reload();
    const progress = page.locator('.catalogue-progress');
    await expect(progress).toContainText('n’a pas pu être téléchargé', { timeout: 20_000 });
    await page.unroute('https://api.themoviedb.org/**');
    await mockTmdb(page);
    await progress.getByRole('button', { name: 'Réessayer' }).click();
    await expect(page.locator('.tile', { hasText: 'Swiper les films' })).toContainText('60 à découvrir', { timeout: 20_000 });
  });
});

/** TMDB simulé : 3 pages de 20 titres par liste (les mêmes pour chaque requête), réponses un peu lentes. */
async function mockTmdb(page: Page) {
  await page.route('https://api.themoviedb.org/3/discover/**', async (route) => {
    const url = new URL(route.request().url());
    const tv = url.pathname.endsWith('/tv');
    const p = Number(url.searchParams.get('page') ?? 1);
    const results = Array.from({ length: 20 }, (_, i) => {
      const id = p * 100 + i;
      return tv
        ? { id, name: `Série ${id}`, original_name: `Série ${id}`, first_air_date: '2010-01-01', genre_ids: [18], original_language: 'en', vote_count: 5000, popularity: 1 }
        : { id, title: `Film ${id}`, original_title: `Film ${id}`, release_date: '2010-01-01', genre_ids: [18], original_language: 'en', vote_count: 5000, popularity: 1 };
    });
    await new Promise((r) => setTimeout(r, 150));
    await route.fulfill({ json: { page: p, total_pages: 3, total_results: 60, results } });
  });
}
