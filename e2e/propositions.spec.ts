import { expect, test, type Page } from '@playwright/test';
import { mockTmdbApi, readAnswers, readMeta, seed, title } from './helpers';
import { ALL_SEEN, TUTORIALS_KEY } from '../src/lib/tutorial';

/**
 * Propositions « selon tes goûts » (bouton 🎯 du swipe), TMDB simulé (clé de test : l'appli demande les fiches à TMDB
 * et les résume elle-même). Profil : 12 films de braquage de Michael Mann aimés, 12 comédies romantiques écartées.
 * Leurs recommandations TMDB : Collateral (braquage, Michael Mann) et Love Actually (comédie romantique).
 */
const liked = Array.from({ length: 12 }, (_, i) => title('movie', i + 1, `Braquage ${i + 1}`));
const disliked = Array.from({ length: 12 }, (_, i) => title('movie', i + 13, `Romance ${i + 13}`));
const random = [title('movie', 30, 'Au hasard A'), title('movie', 31, 'Au hasard B')];
const rec = (id: number, name: string) => ({ id, title: name, original_title: name, release_date: '2004-08-06', poster_path: null, vote_count: 5000, vote_average: 7.5, genre_ids: [80], original_language: 'en' });
const RECS = [rec(500, 'Collateral'), rec(501, 'Love Actually')];

/** Fiche TMDB avec mots-clés, équipe et recommandations. */
function detail(id: number, heist: boolean, recs: unknown[] = []) {
  return {
    id,
    vote_count: 5000,
    vote_average: 7.5,
    release_date: '2000-01-01',
    original_language: 'en',
    genres: [heist ? { id: 80, name: 'Crime' } : { id: 10749, name: 'Romance' }],
    keywords: { keywords: [heist ? { id: 1, name: 'heist' } : { id: 2, name: 'romcom' }] },
    credits: { cast: [{ id: heist ? 20 : 21, name: heist ? 'Al Pacino' : 'Hugh Grant', order: 0 }], crew: heist ? [{ id: 7, name: 'Michael Mann', job: 'Director' }] : [] },
    recommendations: { results: recs },
  };
}

const ROUTES: Record<string, unknown> = {
  ...Object.fromEntries(liked.map((t) => [`/movie/${t.tmdbId}`, detail(t.tmdbId, true, RECS)])),
  ...Object.fromEntries(disliked.map((t) => [`/movie/${t.tmdbId}`, detail(t.tmdbId, false)])),
  '/movie/500': detail(500, true),
  '/movie/501': detail(501, false),
  '/person/7/combined_credits': { cast: [], crew: [] },
};

const current = (page: Page) => page.locator('.swipe-card:not(.card-behind) .title-main');
const recoButton = (page: Page) => page.locator('.reco-btn');
const strip = (page: Page) => page.locator('.reco-strip');

async function open(page: Page, likedCount = 12) {
  await page.addInitScript(() => localStorage.setItem('tmdb-token', 'jeton-de-test'));
  await mockTmdbApi(page, ROUTES);
  await seed(
    page,
    {
      titles: [...liked, ...disliked, ...random],
      answers: [
        ...liked.slice(0, likedCount).map((t) => ({ key: t.key, status: 'seen' as const, tier: 'good' as const })),
        ...disliked.map((t, i) => ({ key: t.key, status: i % 2 ? ('unseen' as const) : ('seen' as const), ...(i % 2 ? {} : { tier: 'meh' as const }) })),
      ],
      // Catalogue déjà téléchargé et nouveautés vues aujourd'hui : aucun téléchargement au démarrage.
      meta: { lastSync: Date.now(), 'new-titles': { checkedAt: Date.now(), addedAt: 0 }, 'ranking:movie': ['movie:3', 'movie:1'] },
    },
    '#/swipe/movie',
  );
  await expect(current(page)).toBeVisible();
}

test.describe('propositions selon tes goûts', () => {
  test('moins de 10 titres aimés : le bouton dit combien il en manque, rien ne change', async ({ page }) => {
    await open(page, 4);
    await recoButton(page).click();
    await expect(page.locator('.toast')).toContainText('Encore 6 titres aimés (👍)');
    await expect(recoButton(page)).toHaveAttribute('aria-pressed', 'false');
    await expect(strip(page)).toHaveCount(0);
  });

  test('🎯 : le titre le plus proche de tes goûts d’abord, avec pourquoi ; puis retour au hasard', async ({ page }) => {
    await open(page);
    await expect(current(page)).toHaveText(/Au hasard/);
    await recoButton(page).click();
    await expect(recoButton(page)).toHaveAttribute('aria-pressed', 'true');
    await expect(current(page)).toHaveText('Collateral');
    await expect(strip(page)).toHaveText('🎯 Selon tes goûts · 2 propositions');
    const why = page.locator('.swipe-card:not(.card-behind) .reco-why');
    // Les titres aimés les mieux classés d'abord, et le réalisateur qui compte.
    await expect(why).toHaveText('🎯 Tu as aimé Braquage 3 et Braquage 1 · 🎬 Michael Mann');

    await page.getByRole('button', { name: 'Vu · bien', exact: true }).click();
    await expect(current(page)).toHaveText('Love Actually');
    expect((await readAnswers(page))['movie:500']).toBe('seen:good');
    await expect.poll(() => readMeta(page, 'reco-stats:movie')).toMatchObject({ good: 1, wish: 0 });

    // « Annuler » : la proposition revient, et sort de la mesure.
    await page.getByRole('button', { name: 'Annuler', exact: true }).click();
    await expect(current(page)).toHaveText('Collateral');
    await expect.poll(() => readMeta(page, 'reco-stats:movie')).toMatchObject({ good: 0 });

    // Le bandeau ramène au hasard.
    await strip(page).click();
    await expect(strip(page)).toHaveCount(0);
    await expect(recoButton(page)).toHaveAttribute('aria-pressed', 'false');
    await expect(current(page)).toHaveText(/Au hasard/);
  });

  test('mode retenu d’une visite à l’autre ; tout trié : message et retour au hasard', async ({ page }) => {
    await open(page);
    await recoButton(page).click();
    await expect(current(page)).toHaveText('Collateral');
    await page.reload();
    await expect(strip(page)).toBeVisible();
    await expect(current(page)).toHaveText('Collateral');
    await page.getByRole('button', { name: 'Vu · bien', exact: true }).click();
    await expect(current(page)).toHaveText('Love Actually');
    await expect(strip(page)).toHaveText('🎯 Selon tes goûts · 1 proposition');
    await page.getByRole('button', { name: 'Pas envie', exact: true }).click();
    await expect(page.locator('.empty')).toContainText('Plus de propositions pour l’instant');
    await page.getByRole('button', { name: '🎲 Revenir au hasard' }).click();
    await expect(current(page)).toHaveText(/Au hasard/);
  });

  test('désactivé, il le reste : retour au menu puis au swipe, ou rechargement (bug du 16/11)', async ({ page }) => {
    await open(page);
    await recoButton(page).click();
    await expect(current(page)).toHaveText('Collateral');
    await recoButton(page).click(); // désactivé
    await expect(recoButton(page)).toHaveAttribute('aria-pressed', 'false');
    await page.getByRole('link', { name: 'Retour' }).click();
    await expect(page.locator('.tiles')).toBeVisible();
    await page.goto('/#/swipe/movie');
    await expect(current(page)).toHaveText(/Au hasard/);
    await expect(recoButton(page)).toHaveAttribute('aria-pressed', 'false');
    await expect(strip(page)).toHaveCount(0);
    await page.reload();
    await expect(current(page)).toHaveText(/Au hasard/);
    await expect(recoButton(page)).toHaveAttribute('aria-pressed', 'false');
    // Réactivé : il revient activé, lui aussi.
    await recoButton(page).click();
    await expect(current(page)).toHaveText('Collateral');
    await page.getByRole('link', { name: 'Retour' }).click();
    await page.goto('/#/swipe/movie');
    await expect(recoButton(page)).toHaveAttribute('aria-pressed', 'true');
  });

  test('mise en page : bouton, bandeau et explication tiennent dans l’écran et dans la carte', async ({ page }) => {
    await open(page);
    await recoButton(page).click();
    await expect(current(page)).toHaveText('Collateral');
    const viewport = page.viewportSize()!;
    const card = (await page.locator('.swipe-card:not(.card-behind)').boundingBox())!;
    const why = (await page.locator('.swipe-card:not(.card-behind) .reco-why').boundingBox())!;
    expect(why.y + why.height).toBeLessThanOrEqual(card.y + card.height + 1);
    expect(why.height).toBeLessThan(40); // deux lignes au plus
    for (const sel of ['.reco-btn', '.filter-btn', '.swipe-title']) {
      const box = (await page.locator(sel).boundingBox())!;
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(viewport.width);
    }
    expect((await page.locator('.swipe-title').boundingBox())!.width).toBeGreaterThan(60); // le titre reste lisible
    // Les boutons du swipe restent à l'écran sous la carte.
    const buttons = (await page.locator('.swipe-actions').boundingBox())!;
    expect(buttons.y + buttons.height).toBeLessThanOrEqual(viewport.height + 1);
  });
});

test.describe('astuce des propositions', () => {
  // Toutes les astuces vues, sauf celle des propositions.
  test.use({
    storageState: { cookies: [], origins: [{ origin: 'http://localhost:4173', localStorage: [{ name: TUTORIALS_KEY, value: JSON.stringify(ALL_SEEN.filter((t) => t !== 'reco')) }] }] },
  });

  test('montrée au premier 🎯, puis plus jamais', async ({ page }) => {
    await open(page);
    await recoButton(page).click();
    const tip = page.getByRole('dialog', { name: '🎯 Selon tes goûts' });
    await expect(tip).toContainText('choisis pour toi');
    await expect(tip).toContainText('À découvrir');
    await tip.getByRole('button', { name: 'Compris' }).click();
    await expect(current(page)).toHaveText('Collateral');
    await strip(page).click();
    await recoButton(page).click();
    await expect(current(page)).toHaveText('Collateral');
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });
});
