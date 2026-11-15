import { expect, test, type Page } from '@playwright/test';
import { mockTmdbApi, moveTo, seed, title } from './helpers';

/**
 * Mots courts sous les icônes (16/11) : chaque petit bouton à icône dit ce qu'il fait (« Bien », « Envie », « Filtres »,
 * « Pour toi »…), sans élargir les lignes : tout tient dans l'écran du téléphone.
 */
const films = ['Heat', 'Collateral', 'Casino', 'Memento', 'Matrix', 'Alien'].map((n, i) => title('movie', i + 1, n));

async function open(page: Page, hash: string) {
  await seed(
    page,
    {
      titles: films,
      answers: [
        { key: films[0].key, status: 'seen', tier: 'good' },
        { key: films[1].key, status: 'seen', tier: 'good' },
        { key: films[2].key, status: 'seen', tier: 'meh' },
        { key: films[3].key, status: 'wish' },
        { key: films[4].key, status: 'unseen' },
      ],
      meta: { lastSync: Date.now(), 'new-titles': { checkedAt: Date.now(), addedAt: 0 }, 'ranking:movie': [films[0].key] },
    },
    hash,
  );
}

/** Mots sous les icônes des boutons d'une ligne. */
const captions = (page: Page, row: string) => page.locator('.list-item', { hasText: row }).first().locator('.btn-cap');

/** Taille du texte (px) d'un élément. */
const fontSize = async (page: Page, sel: string) => parseFloat(await page.locator(sel).first().evaluate((el) => getComputedStyle(el).fontSize));

/** Les boutons d'une ligne restent dans la ligne, et la ligne dans l'écran. */
async function fits(page: Page) {
  const width = page.viewportSize()!.width;
  for (const row of await page.locator('.list-item').all()) {
    const box = (await row.boundingBox())!;
    expect(box.x + box.width).toBeLessThanOrEqual(width + 1);
    for (const btn of await row.locator('.btn.labeled').all()) {
      const b = (await btn.boundingBox())!;
      expect(b.x + b.width).toBeLessThanOrEqual(box.x + box.width + 1);
      expect(b.height).toBeLessThan(44); // pas plus haut qu'une ligne de liste ne le permet
    }
  }
}

test.describe('mots sous les icônes', () => {
  test('swipe : « Pour toi » sous 🎯, « Filtres » sous l’entonnoir, dans la barre du haut', async ({ page }) => {
    await open(page, '#/swipe/movie');
    await expect(page.locator('.reco-btn .btn-cap')).toHaveText('Pour toi');
    await expect(page.locator('.filter-btn .btn-cap')).toHaveText('Filtres');
    expect(await fontSize(page, '.filter-btn .btn-cap')).toBeGreaterThanOrEqual(10); // lisible (16/11 : agrandi)
    // Noms complets inchangés (lecteurs d'écran, et tests).
    await expect(page.getByRole('button', { name: '🎯 Selon tes goûts' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Filtres' })).toBeVisible();
    const width = page.viewportSize()!.width;
    for (const sel of ['.reco-btn', '.filter-btn', '.swipe-top .pill']) expect((await page.locator(sel).boundingBox())!.x + (await page.locator(sel).boundingBox())!.width).toBeLessThanOrEqual(width);
  });

  test('mon classement : « Reclasser » et l’état (« Bien ») ; filtres de la barre du haut', async ({ page }) => {
    await open(page, '#/rank/movie');
    await page.locator('button.chip', { hasText: 'Mon classement' }).click();
    await expect(captions(page, 'Heat')).toHaveText(['Reclasser', 'Bien']);
    await expect(captions(page, 'Collateral')).toHaveText(['Bien']); // pas encore classé
    await expect(page.locator('.topbar .filter-btn .btn-cap')).toHaveText('Filtres');
    await fits(page);
  });

  test('wishlist : l’état « Envie »', async ({ page }) => {
    await open(page, '#/wishlist');
    await expect(captions(page, 'Memento')).toHaveText(['Envie']);
    await fits(page);
  });

  test('mes listes : l’état de chaque titre (« Bien », « Bof », « Pas envie »)', async ({ page }) => {
    await open(page, '#/lists');
    await expect(captions(page, 'Heat')).toHaveText(['Bien']);
    await expect(captions(page, 'Casino')).toHaveText(['Bof']);
    expect(await fontSize(page, '.list-item .btn-cap')).toBeGreaterThanOrEqual(10.5);
    await fits(page);
    await page.locator('button.chip', { hasText: 'Pas vus' }).click();
    await expect(captions(page, 'Matrix')).toHaveText(['Pas envie']);
    await fits(page);
  });

  test('ajout manuel : « À trier » pour un titre jamais trié, puis son nouvel état', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('tmdb-token', 'jeton-de-test'));
    await mockTmdbApi(page, {
      '/search/multi': { page: 1, total_pages: 1, total_results: 1, results: [{ id: 99, media_type: 'movie', title: 'Thief', release_date: '1981-03-27', poster_path: null, vote_count: 900, genre_ids: [80] }] },
    });
    await open(page, '#/add');
    await page.locator('input[type=search]').fill('thief');
    await expect(captions(page, 'Thief')).toHaveText(['À trier']);
    await moveTo(page, page.locator('.list-item', { hasText: 'Thief' }), 'Envie (wishlist)');
    await expect(captions(page, 'Thief')).toHaveText(['Envie']);
    await fits(page);
  });
});
