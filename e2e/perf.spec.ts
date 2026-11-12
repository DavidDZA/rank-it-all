import { expect, test, type Page, type Route } from '@playwright/test';
import { readAnswers, seed, title, type SeedTitle } from './helpers';

/**
 * Performances, dans le vrai Chrome, avec une base de gros utilisateur. Chaque test reprend une situation qui a posé
 * problème le 12/11 : classement figé pendant l'arrivée des fiches, rafales de demandes refusées par TMDB, « Annuler »
 * sans effet, stats qui ne se mettaient à jour qu'à la fin. Budgets larges (tests en parallèle, machine chargée) :
 * ils attrapent une régression nette, pas quelques %. Mesures fines : méthode dans ARCHITECTURE § 5.
 */

const films = (n: number, from = 1): SeedTitle[] => Array.from({ length: n }, (_, i) => title('movie', from + i, `Film ${from + i}`, { voteCount: 10_000 - i }));
/** Catalogue déjà téléchargé et nouveautés déjà cherchées aujourd'hui : au démarrage, rien ne part vers TMDB. */
const NO_STARTUP = { lastSync: Date.now(), 'new-titles': { checkedAt: Date.now(), addedAt: 0 } };
const seenAll = (list: SeedTitle[]) => list.map((t) => ({ key: t.key, status: 'seen' as const, tier: 'good' as const }));

/** TMDB simulé : fiches lentes (`delay` ms), demandes en cours comptées, refus « trop de demandes » au besoin. */
async function slowTmdb(page: Page, opts: { delay?: number; refuseFirst?: boolean; perSecond?: number } = {}) {
  const state = { inFlight: 0, maxInFlight: 0, calls: [] as string[], refused: 0 };
  const seenPaths = new Set<string>();
  const accepted: number[] = []; // dates des demandes acceptées (limite de débit)
  await page.route('https://api.themoviedb.org/3/**', async (route: Route) => {
    const path = new URL(route.request().url()).pathname.replace(/^\/3/, '');
    state.calls.push(path);
    state.inFlight++;
    state.maxInFlight = Math.max(state.maxInFlight, state.inFlight);
    await new Promise((r) => setTimeout(r, opts.delay ?? 100));
    state.inFlight--;
    const now = Date.now();
    while (accepted.length && accepted[0] < now - 1000) accepted.shift();
    const overLimit = opts.perSecond !== undefined && accepted.length >= opts.perSecond;
    if (!overLimit) accepted.push(now);
    if (overLimit || (opts.refuseFirst && !seenPaths.has(path))) {
      seenPaths.add(path);
      state.refused++;
      // Comme le relais jusqu'au 12/11 : un refus marqué « à garder 24 h ».
      return route.fulfill({ status: 429, headers: { 'Retry-After': '1', 'Cache-Control': 'public, max-age=86400' }, json: { status_code: 25 } });
    }
    const id = Number(path.split('/').pop());
    return route.fulfill({
      json: {
        id,
        runtime: 100 + (id % 50),
        genres: [{ id: 18, name: 'Drame' }],
        credits: { cast: [{ name: `Acteur ${id}`, order: 0 }], crew: [{ name: `Réal ${id % 40}`, job: 'Director' }] },
        videos: { results: [] },
        'watch/providers': { results: { FR: { flatrate: [{ provider_id: 8, provider_name: 'Netflix', logo_path: '/n.png' }] } } },
      },
    });
  });
  return state;
}

/**
 * Remplit la base, puis donne l'accès à TMDB (clé de test) et recharge : posée avant, la clé lançait le téléchargement
 * du catalogue (base encore vide) et des fiches pendant le remplissage.
 */
async function seedThenTmdb(page: Page, data: Parameters<typeof seed>[1], hash: string) {
  await seed(page, data, hash);
  await page.evaluate(() => localStorage.setItem('tmdb-token', 'jeton-de-test'));
  await page.reload();
}

/** Nombre de fiches enregistrées dans la base. */
const detailsCount = (page: Page) =>
  page.evaluate(
    () =>
      new Promise<number>((res) => {
        const r = indexedDB.open('rank-it-all');
        r.onsuccess = () => {
          const q = r.result.transaction('details').objectStore('details').count();
          q.onsuccess = () => (r.result.close(), res(q.result));
        };
      }),
  );

test.describe('performances', () => {
  test.describe.configure({ timeout: 120_000 });

  test('classement de 600 titres : les premières lignes tout de suite, la suite au défilement', async ({ page }) => {
    const list = films(600);
    await seed(page, { titles: list, answers: seenAll(list), meta: { 'ranking:movie': list.map((t) => t.key), ...NO_STARTUP } }, '#/rank/movie');
    const t0 = Date.now();
    await page.getByRole('button', { name: 'Mon classement', exact: true }).click();
    await page.locator('ol.list > li').first().waitFor();
    expect(Date.now() - t0).toBeLessThan(3000);
    await expect(page.locator('ol.list > li')).toHaveCount(60); // pas 600 lignes déplaçables d'un coup
    for (let i = 0; i < 20 && (await page.locator('ol.list > li').count()) < 600; i++) {
      await page.locator('ol.list > li').last().scrollIntoViewIfNeeded();
      await page.waitForTimeout(150);
    }
    await expect(page.locator('ol.list > li')).toHaveCount(600);
    await expect(page.locator('ol.list > li').last()).toContainText('Film 600');
  });

  test('classement pendant que 300 fiches arrivent : affiché et réactif (avant : « Chargement… » plus d’une minute)', async ({ page }) => {
    await slowTmdb(page, { delay: 60 });
    const list = films(600);
    await seedThenTmdb(page, { titles: list, answers: seenAll(list), meta: { 'ranking:movie': list.map((t) => t.key), ...NO_STARTUP } }, '#/stats');
    await expect(page.getByText(/Complément des infos de \d+ titres/)).toBeVisible(); // 600 fiches en arrière-plan
    await page.goto('/#/rank/movie');
    // La page Stats est quittée, mais ses fiches continuent d'arriver : celles de la wishlist prennent le relais.
    const t0 = Date.now();
    await page.getByRole('button', { name: 'Mon classement', exact: true }).click();
    await page.locator('ol.list > li').first().waitFor({ timeout: 10_000 });
    expect(Date.now() - t0).toBeLessThan(5000);
    for (let i = 0; i < 5; i++) {
      const row = page.locator('ol.list > li .row-main').nth(i * 4);
      const t = Date.now();
      await row.click();
      await expect(page.locator('.row-overview')).toBeVisible();
      expect(Date.now() - t).toBeLessThan(1500);
      await row.click();
    }
  });

  test('wishlist de 300 titres sans fiche : au plus 6 demandes à la fois, une seule par titre', async ({ page }) => {
    const tmdb = await slowTmdb(page, { delay: 80 });
    const list = films(300);
    await seedThenTmdb(page, { titles: list, answers: list.map((t) => ({ key: t.key, status: 'wish' as const })), meta: NO_STARTUP }, '#/wishlist');
    await expect.poll(() => detailsCount(page), { timeout: 60_000 }).toBe(300);
    expect(tmdb.maxInFlight).toBeLessThanOrEqual(6);
    expect(tmdb.calls).toHaveLength(300);
    expect(new Set(tmdb.calls).size).toBe(300);
    await expect(page.locator('.list-item').first().getByRole('img', { name: 'Netflix' })).toBeVisible();
  });

  test('TMDB qui limite le débit (40 demandes par seconde) : 300 fiches arrivent toutes, sans demandes en boucle', async ({ page }) => {
    const tmdb = await slowTmdb(page, { delay: 50, perSecond: 40 });
    const list = films(300);
    await seedThenTmdb(page, { titles: list, answers: list.map((t) => ({ key: t.key, status: 'wish' as const })), meta: NO_STARTUP }, '#/wishlist');
    // Avant : 300 demandes d'un coup, presque toutes refusées, chacune réessayée 5 fois au plus : des fiches perdues,
    // et la limite gardée saturée. Maintenant : la file attend la fin du refus, puis repart.
    await expect.poll(() => detailsCount(page), { timeout: 90_000 }).toBe(300);
    expect(tmdb.calls.length).toBeLessThan(300 * 1.6);
  });

  // Le navigateur ne garde pas les réponses simulées ici : que les nouveaux essais contournent sa mémoire (refus
  // marqués « à garder 24 h » par le relais jusqu'au 12/11) est vérifié dans tests/perf.test.ts.
  test('chaque fiche refusée une fois : un seul nouvel essai par fiche, toutes obtenues', async ({ page }) => {
    const tmdb = await slowTmdb(page, { delay: 30, refuseFirst: true });
    const list = films(60);
    await seedThenTmdb(page, { titles: list, answers: list.map((t) => ({ key: t.key, status: 'wish' as const })), meta: NO_STARTUP }, '#/wishlist');
    await expect.poll(() => detailsCount(page), { timeout: 60_000 }).toBe(60);
    expect(tmdb.refused).toBe(60);
    expect(tmdb.calls.length).toBeLessThanOrEqual(120 + 6); // un refus puis la fiche, pour chacune
  });

  test('duels avec 600 titres classés : choix et « Annuler » rapides ; « Annuler » juste après un choix l’annule', async ({ page }) => {
    const list = films(620);
    await seed(page, { titles: list, answers: seenAll(list), meta: { 'ranking:movie': list.slice(0, 600).map((t) => t.key), ...NO_STARTUP } }, '#/rank/movie');
    const pair = () => page.locator('.duel-card .title-main').allTextContents().then((x) => x.sort().join('|'));
    await page.locator('.duel-card').first().waitFor();
    const first = await pair();
    let t = Date.now();
    await page.locator('.duel-card').first().click();
    await expect.poll(pair).not.toBe(first);
    expect(Date.now() - t).toBeLessThan(2000); // dont 0,3 s d'animation
    // Annuler : retour au duel précédent.
    t = Date.now();
    await page.getByRole('button', { name: '↶ Annuler' }).click();
    await expect.poll(pair).toBe(first);
    expect(Date.now() - t).toBeLessThan(1000);
    // Annuler pendant l'animation du choix : le choix ne compte pas, le duel ne change à aucun moment (avant : le
    // bouton était inactif, le choix passait, et « Annuler » ne revenait en arrière qu'ensuite).
    await page.locator('.duel-card').first().click();
    await page.waitForTimeout(100);
    await page.getByRole('button', { name: '↶ Annuler' }).click({ timeout: 300 });
    for (let i = 0; i < 16; i++) {
      expect(await pair()).toBe(first);
      await page.waitForTimeout(50);
    }
    expect(await readAnswers(page)).toMatchObject({ 'movie:1': 'seen:good' });
  });

  test('stats : mises à jour pendant le complément des fiches, pas seulement à la fin', async ({ page }) => {
    await slowTmdb(page, { delay: 400 });
    const list = films(200);
    await seedThenTmdb(page, { titles: list, answers: seenAll(list), meta: NO_STARTUP }, '#/stats');
    const hours = page.locator('.stat-tile', { hasText: 'devant l’écran' }).locator('.stat-value');
    const progress = page.getByText(/Complément des infos de (\d+) titres/);
    await expect(progress).toBeVisible();
    const start = Number((await progress.textContent())!.match(/\d+/)![0]);
    await expect(hours).not.toHaveText('0 h', { timeout: 15_000 }); // des heures comptées…
    await expect(progress).toBeVisible(); // … avant la fin du complément
    expect(Number((await progress.textContent())!.match(/\d+/)![0])).toBeLessThan(start); // le compteur descend
    await expect(progress).toHaveCount(0, { timeout: 60_000 });
  });

  test('gros catalogue (14 000 titres, 3 000 réponses) : accueil, swipe et listes s’ouvrent vite', async ({ page }) => {
    const catalogue = films(14_000);
    const answers = catalogue.slice(0, 3000).map((t, i) => ({ key: t.key, status: (['seen', 'unseen', 'wish'] as const)[i % 3] }));
    await seed(page, { titles: catalogue, answers, meta: NO_STARTUP }, '#/');
    for (const [hash, sel, budget] of [
      ['#/', '.tiles', 3000],
      ['#/swipe/movie', '.swipe-card:not(.card-behind) .title-main', 4000],
      ['#/lists', '.list-item', 3000],
      ['#/wishlist', '.list-item', 3000],
      ['#/stats', '.stat-tile', 4000],
      ['#/rank/movie', '.duel-card', 3000],
    ] as const) {
      const t = Date.now();
      await page.evaluate((h) => (location.hash = h), hash);
      await page.locator(sel).first().waitFor({ timeout: 15_000 });
      expect(Date.now() - t, hash).toBeLessThan(budget);
    }
  });
});
