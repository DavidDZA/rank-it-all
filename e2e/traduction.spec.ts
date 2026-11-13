import { expect, test, type Page } from '@playwright/test';
import { readMeta, seed, title } from './helpers';

/**
 * Traduction : l'appli ouverte dans un navigateur réglé sur chaque langue (l'utilisateur, lui, reste en français).
 * Chaque écran doit être dans la langue de l'appareil, sans texte français oublié ; titres TMDB dans cette langue,
 * plateformes de son pays ; langue et pays modifiables dans les Réglages.
 */

const films = ['Inception', 'Parasite', 'Drive'].map((n, i) => title('movie', i + 1, n));
const seenData = {
  titles: films,
  answers: [
    { key: films[0].key, status: 'seen' as const, tier: 'good' as const },
    { key: films[1].key, status: 'seen' as const, tier: 'good' as const },
    { key: films[2].key, status: 'wish' as const },
  ],
  meta: { 'ranking:movie': [films[0].key], lastSync: Date.now(), 'catalogue-language': 'fr-FR' },
};

/** Mots qui trahissent un texte français oublié (aucun n'existe tel quel dans les autres langues). */
const FRENCH = /Swiper les|Classer les|Réglages|Mes listes|Chargement|Ajout manuel|Ce soir|Pas envie|Annuler|Égalité|Fermer|à découvrir|Compris|Rechercher|Télécharger|Mettre à jour|Lequel|Tirer au sort|Retour|Mon classement|Abonnement|Supprimer|Connecte-toi|tes amis|Aucun|Pas encore|devant l’écran|Badges débloqués/;

const SCREENS = ['#/', '#/swipe/movie', '#/rank/movie', '#/wishlist', '#/stats', '#/settings', '#/lists', '#/add', '#/tonight', '#/friends'];

/** Texte visible de l'écran, une fois chargé (plus de « Chargement… » dans la langue testée). */
async function screenText(page: Page, hash: string, loading: string): Promise<string> {
  await page.goto(`/${hash}`);
  await expect(page.locator('main')).toBeVisible();
  await expect(page.getByText(loading, { exact: true })).toHaveCount(0, { timeout: 10_000 });
  await page.waitForTimeout(300);
  return page.locator('body').innerText();
}

const LANGUAGES = [
  { locale: 'en-US', lang: 'en', loading: 'Loading…', home: 'Swipe movies', settings: '⚙️ Settings', duel: 'Which one do you prefer?', badge: 'First step' },
  { locale: 'es-ES', lang: 'es', loading: 'Cargando…', home: 'Deslizar películas', settings: '⚙️ Ajustes', duel: '¿Cuál prefieres?', badge: 'Primer paso' },
  { locale: 'de-DE', lang: 'de', loading: 'Wird geladen…', home: 'Filme swipen', settings: '⚙️ Einstellungen', duel: 'Welchen findest du besser?', badge: 'Erster Schritt' },
  { locale: 'it-IT', lang: 'it', loading: 'Caricamento…', home: 'Swipa i film', settings: '⚙️ Impostazioni', duel: 'Quale preferisci?', badge: 'Primo passo' },
  { locale: 'pt-BR', lang: 'pt', loading: 'Carregando…', home: 'Deslizar filmes', settings: '⚙️ Configurações', duel: 'Qual você prefere?', badge: 'Primeiro passo' },
] as const;

for (const l of LANGUAGES) {
  test.describe(`appareil en ${l.locale}`, () => {
    test.use({ locale: l.locale });

    test(`tous les écrans en ${l.lang}, sans texte français oublié`, async ({ page }) => {
      await seed(page, seenData);
      await expect(page.locator('html')).toHaveAttribute('lang', l.lang);
      await expect(page.locator('.tile', { hasText: l.home })).toBeVisible();
      for (const hash of SCREENS) {
        const text = await screenText(page, hash, l.loading);
        expect(text.match(FRENCH)?.[0], `texte français sur ${hash}`).toBeUndefined();
      }
      // Quelques textes clés, dans la bonne langue.
      await page.goto('/#/settings');
      await expect(page.getByRole('heading', { name: l.settings })).toBeVisible();
      await page.goto('/#/rank/movie');
      await expect(page.getByText(l.duel)).toBeVisible();
      await page.goto('/#/stats');
      await expect(page.locator('.badge-card', { hasText: l.badge })).toBeVisible();
    });

    test('installation : le manifeste de la langue', async ({ page }) => {
      await page.goto('/');
      await expect(page.locator('link[rel="manifest"]')).toHaveAttribute('href', new RegExp(`manifest-${l.lang}\\.webmanifest$`));
      const manifest = await page.evaluate(() => fetch(document.querySelector('link[rel="manifest"]')!.getAttribute('href')!).then((r) => r.json()));
      expect(manifest).toMatchObject({ lang: l.lang, name: 'Rank It All' });
      expect(manifest.description).not.toBe('Classer les films, séries et animes que tu as vus.');
    });

    test('page de confidentialité dans la langue de l’appareil', async ({ page }) => {
      await page.goto('/confidentialite.html');
      await expect(page.locator('html')).toHaveAttribute('lang', l.lang);
      await expect(page.locator('h1')).not.toHaveText('Politique de confidentialité');
      await expect(page.locator('#suppression')).toBeVisible(); // ancre de la Play Console
      await expect(page.locator('#suppression-partielle')).toBeVisible();
    });
  });
}

test.describe('appareil en français', () => {
  test('page de confidentialité : en français par défaut, dans la langue demandée par l’appli (?lang=)', async ({ page }) => {
    await page.goto('/confidentialite.html');
    await expect(page.locator('h1')).toHaveText('Politique de confidentialité');
    await page.goto('/confidentialite.html?lang=de#suppression');
    await expect(page.locator('h1')).toHaveText('Datenschutzerklärung');
    await expect(page.locator('#suppression')).toContainText('Deine Daten löschen');
  });

  test('Réglages → Langue : passer en anglais (tout l’écran change), puis revenir à la langue de l’appareil', async ({ page }) => {
    await seed(page, seenData, '#/settings');
    const select = page.locator('#langue').getByRole('combobox', { name: 'Langue' });
    await expect(select).toHaveValue('');
    await select.selectOption('en');
    await expect(page.getByRole('heading', { name: '⚙️ Settings' })).toBeVisible({ timeout: 10_000 }); // l'appli a redémarré
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    expect(await page.evaluate(() => localStorage.getItem('app-lang'))).toBe('en');
    await page.locator('#langue').getByRole('combobox', { name: 'Language' }).selectOption('');
    await expect(page.getByRole('heading', { name: '⚙️ Réglages' })).toBeVisible({ timeout: 10_000 });
    expect(await page.evaluate(() => localStorage.getItem('app-lang'))).toBeNull();
  });

  test('Réglages → Pays : choisir la Belgique (gardé, et l’appareil reste en français)', async ({ page }) => {
    await seed(page, seenData, '#/settings');
    await page.locator('#langue').getByRole('combobox', { name: 'Pays (plateformes de streaming)' }).selectOption('BE');
    await expect(page.getByRole('heading', { name: '⚙️ Réglages' })).toBeVisible({ timeout: 10_000 });
    expect(await page.evaluate(() => localStorage.getItem('app-region'))).toBe('BE');
    await expect(page.locator('#langue').getByRole('combobox', { name: 'Pays (plateformes de streaming)' })).toHaveValue('BE');
  });
});

/**
 * Clé TMDB de test, donnée après les données de test (sinon l'appli, voyant un catalogue vide, lancerait un premier
 * téléchargement avant qu'elles soient écrites) ; l'appli redémarre avec.
 */
async function withToken(page: Page) {
  await page.evaluate(() => localStorage.setItem('tmdb-token', 'jeton-de-test'));
  await page.reload();
}

/** TMDB simulé : note la langue et le pays demandés ; fiche avec des plateformes en France, aux États-Unis et en Belgique. */
async function mockTmdb(page: Page) {
  const requests: URL[] = [];
  await page.route('https://api.themoviedb.org/3/**', (route) => {
    const url = new URL(route.request().url());
    requests.push(url);
    const path = url.pathname.replace(/^\/3/, '');
    if (path.startsWith('/discover/')) return route.fulfill({ json: { page: 1, total_pages: 1, total_results: 0, results: [] } });
    if (path === '/movie/1') {
      const fr = url.searchParams.get('language') === 'fr-FR';
      return route.fulfill({
        json: {
          id: 1,
          title: fr ? 'Inception (FR)' : 'Inception (EN)',
          overview: fr ? 'Résumé en français.' : 'English summary.',
          runtime: 148,
          vote_average: 8.4,
          genres: [{ id: 878, name: fr ? 'Science-Fiction' : 'Science Fiction' }],
          credits: { cast: [{ name: 'Leonardo DiCaprio', order: 0 }], crew: [{ name: 'Christopher Nolan', job: 'Director' }] },
          videos: { results: [] },
          'watch/providers': {
            results: {
              FR: { flatrate: [{ provider_id: 381, provider_name: 'Canal+', logo_path: '/c.png' }] },
              US: { flatrate: [{ provider_id: 15, provider_name: 'Hulu', logo_path: '/h.png' }] },
              BE: { flatrate: [{ provider_id: 311, provider_name: 'Streamz', logo_path: '/s.png' }] },
            },
          },
        },
      });
    }
    return route.fulfill({ status: 404, json: {} });
  });
  return requests;
}

test.describe('TMDB en anglais, États-Unis', () => {
  test.use({ locale: 'en-US' });

  test('fiche : titre, résumé et genres en anglais, plateformes des États-Unis', async ({ page }) => {
    const requests = await mockTmdb(page);
    await seed(page, { ...seenData, meta: { ...seenData.meta, 'catalogue-language': 'en-US' } }, '#/lists');
    await withToken(page);
    await page.locator('.row-text', { hasText: 'Inception' }).click();
    const fiche = page.getByRole('dialog');
    await expect(fiche.getByRole('img', { name: 'Hulu' })).toBeVisible();
    await expect(fiche.getByRole('img', { name: 'Canal+' })).toHaveCount(0);
    await expect(fiche).toContainText('Directed by: Christopher Nolan');
    expect(requests.find((u) => u.pathname.endsWith('/movie/1'))?.searchParams.get('language')).toBe('en-US');
    // Le titre ajouté avant (en français) prend son nom anglais avec la fiche.
    await expect.poll(() => page.evaluate(() => new Promise((r) => {
      const req = indexedDB.open('rank-it-all');
      req.onsuccess = () => {
        const g = req.result.transaction('titles').objectStore('titles').get('movie:1');
        g.onsuccess = () => r((g.result as { title: string }).title);
      };
    }))).toBe('Inception (EN)');
  });

  test('catalogue téléchargé en français : retéléchargé en anglais au démarrage', async ({ page }) => {
    const requests = await mockTmdb(page);
    await seed(page, seenData); // catalogue-language : fr-FR
    requests.length = 0;
    await withToken(page);
    await expect.poll(() => readMeta(page, 'catalogue-language'), { timeout: 20_000 }).toBe('en-US');
    const discover = requests.filter((u) => u.pathname.includes('/discover/'));
    expect(discover.length).toBeGreaterThan(0);
    expect(discover.every((u) => u.searchParams.get('language') === 'en-US')).toBe(true);
  });
});

test.describe('appareil en français de Belgique', () => {
  test.use({ locale: 'fr-BE' });

  test('interface en français, plateformes de Belgique', async ({ page }) => {
    await mockTmdb(page);
    await seed(page, seenData, '#/lists');
    await withToken(page);
    await expect(page.getByRole('heading', { name: '📚 Mes listes' })).toBeVisible();
    await page.locator('.row-text', { hasText: 'Inception' }).click();
    const fiche = page.getByRole('dialog');
    await expect(fiche.getByRole('img', { name: 'Streamz' })).toBeVisible();
    await expect(fiche.getByRole('img', { name: 'Canal+' })).toHaveCount(0);
  });

  test('un utilisateur actuel (catalogue en français) n’est pas retéléchargé', async ({ page }) => {
    const requests = await mockTmdb(page);
    const meta: Record<string, unknown> = { ...seenData.meta, 'new-titles': { checkedAt: Date.now(), addedAt: 0 } };
    delete meta['catalogue-language']; // catalogue téléchargé avant la traduction : sans repère de langue
    await seed(page, { ...seenData, meta });
    requests.length = 0;
    await withToken(page);
    await expect(page.locator('.tiles')).toBeVisible();
    await page.waitForTimeout(1500);
    expect(requests.filter((u) => u.pathname.includes('/discover/'))).toEqual([]);
  });
});
