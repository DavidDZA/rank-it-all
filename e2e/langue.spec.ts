import { expect, test, type Page } from '@playwright/test';
import { readMeta, seed } from './helpers';

/**
 * Langue des « titres dans ta langue » (seuil de votes plus bas) : celle du téléphone ou du PC, détectée dès la
 * première ouverture, avant le téléchargement automatique du catalogue. L'appli est ouverte ici dans un navigateur
 * réglé sur différentes langues (l'utilisateur, lui, reste en français).
 */

// Ces tests portent sur la langue du catalogue (titres dans la langue de l'appareil), pas sur celle de l'interface :
// l'interface reste en français (choisie dans les Réglages), quelle que soit la langue du navigateur.
test.beforeEach(async ({ context }) => {
  await context.addInitScript(() => localStorage.setItem('app-lang', 'fr'));
});

/** TMDB simulé : listes vides ; note la langue originale demandée par chaque requête du catalogue. */
async function mockDiscover(page: Page): Promise<(string | null)[]> {
  const langs: (string | null)[] = [];
  await page.route('https://api.themoviedb.org/3/discover/**', (route) => {
    langs.push(new URL(route.request().url()).searchParams.get('with_original_language'));
    return route.fulfill({ json: { page: 1, total_pages: 1, total_results: 0, results: [] } });
  });
  return langs;
}

/** Première ouverture de l'appli (avec une clé TMDB) : le catalogue se télécharge tout seul. */
async function firstOpen(page: Page): Promise<(string | null)[]> {
  const langs = await mockDiscover(page);
  await page.goto('/');
  await page.evaluate(() => localStorage.setItem('tmdb-token', 'jeton-de-test'));
  await page.reload();
  await expect.poll(() => readMeta(page, 'lastSync'), { timeout: 20_000 }).not.toBeUndefined();
  return langs;
}

const catalogue = (page: Page) => page.locator('section#catalogue');
const langSelect = (page: Page) => catalogue(page).getByRole('combobox', { name: 'Langue originale' });

async function openCatalogueSettings(page: Page) {
  await page.goto('/#/settings');
  await expect(catalogue(page)).toBeVisible();
}

for (const [locale, code, title] of [
  ['es-ES', 'es', '🇪🇸 Titres en espagnol (langue originale) :'],
  ['pt-BR', 'pt', '🇵🇹 Titres en portugais (langue originale) :'],
  ['ja-JP', 'ja', '🇯🇵 Titres en japonais (langue originale) :'],
  ['fr-FR', 'fr', '🇫🇷 Titres en français (langue originale) :'],
] as const) {
  test.describe(`appareil en ${locale}`, () => {
    test.use({ locale });

    test(`premier téléchargement avec les titres en « ${code} », et réglages adaptés`, async ({ page }) => {
      const langs = await firstOpen(page);
      expect(langs).toContain(code);
      expect(langs.filter((l) => l !== null && l !== code)).toEqual([]); // aucune autre langue (ni le français)
      expect(await readMeta(page, 'min-votes')).toMatchObject({ lang: code, langMovie: 150, langTv: 20 }); // fixée
      await openCatalogueSettings(page);
      await expect(catalogue(page).getByText(title)).toBeVisible();
      await expect(langSelect(page)).toHaveValue(code);
      const row = catalogue(page).locator('.vote-row', { hasText: title });
      await expect(row.getByRole('spinbutton', { name: '🎬 Films' })).toHaveValue('150');
      await expect(row.getByRole('spinbutton', { name: '📺 Séries' })).toHaveValue('20');
    });
  });
}

for (const [locale, why] of [
  ['en-US', 'anglais'],
  ['en-GB', 'anglais'],
  ['sw-KE', 'swahili : absent de la liste des langues originales'],
] as const) {
  test.describe(`appareil en ${locale}`, () => {
    test.use({ locale });

    test(`aucune langue (${why}) : pas de requête de langue, pas de seuil à part`, async ({ page }) => {
      const langs = await firstOpen(page);
      expect(langs.length).toBeGreaterThan(0);
      expect(langs.every((l) => l === null)).toBe(true);
      expect(await readMeta(page, 'min-votes')).toMatchObject({ lang: null });
      await openCatalogueSettings(page);
      await expect(catalogue(page).getByText('Titres en français')).toHaveCount(0);
      await expect(catalogue(page).getByText('🗣️ Titres dans ta langue :')).toBeVisible();
      await expect(langSelect(page)).toHaveValue('');
      // Pas de champs de seuil pour une langue : seulement les votes minimum et les vieux films.
      await expect(catalogue(page).getByRole('spinbutton', { name: '🎬 Films' })).toHaveCount(2);
    });
  });
}

test.describe('appareil en anglais, langue choisie à la main', () => {
  test.use({ locale: 'en-US' });

  test('choisir l’italien dans les réglages : seuils affichés, puis catalogue mis à jour avec les titres italiens', async ({ page }) => {
    const langs = await firstOpen(page);
    await openCatalogueSettings(page);
    await langSelect(page).selectOption('it');
    await expect(catalogue(page).getByText('🇮🇹 Titres en italien (langue originale) :')).toBeVisible();
    await expect(catalogue(page).getByRole('spinbutton', { name: '🎬 Films' })).toHaveCount(3);
    langs.length = 0;
    await catalogue(page).getByRole('button', { name: 'Mettre à jour le catalogue' }).click();
    await expect(catalogue(page).getByText(/✓ Terminé/)).toBeVisible({ timeout: 20_000 });
    expect(langs).toContain('it');
    expect(await readMeta(page, 'min-votes')).toMatchObject({ lang: 'it' });
    // Revenir à « Aucune » : plus de requête de langue.
    await langSelect(page).selectOption('');
    langs.length = 0;
    await catalogue(page).getByRole('button', { name: 'Mettre à jour le catalogue' }).click();
    await expect(catalogue(page).getByText(/✓ Terminé/)).toBeVisible({ timeout: 20_000 });
    expect(langs.every((l) => l === null)).toBe(true);
    expect(await readMeta(page, 'min-votes')).toMatchObject({ lang: null });
  });
});

test.describe('appareil déjà utilisé avant le 13/11, aujourd’hui en anglais', () => {
  test.use({ locale: 'en-US' });

  test('catalogue déjà téléchargé : reste en français (rien ne change pour les utilisateurs actuels)', async ({ page }) => {
    await seed(page, { meta: { lastSync: Date.now(), 'new-titles': { checkedAt: Date.now(), addedAt: 0 } } });
    await openCatalogueSettings(page);
    await expect(catalogue(page).getByText('🇫🇷 Titres en français (langue originale) :')).toBeVisible();
    await expect(langSelect(page)).toHaveValue('fr');
  });

  test('seuils enregistrés à l’ancienne (« titres en français ») : repris en français avec leurs valeurs', async ({ page }) => {
    await seed(page, { meta: { lastSync: Date.now(), 'new-titles': { checkedAt: Date.now(), addedAt: 0 }, 'min-votes': { movie: 900, tv: 50, anime: 50, frMovie: 120, frTv: 15, oldMovie: 150 } } });
    await openCatalogueSettings(page);
    await expect(langSelect(page)).toHaveValue('fr');
    const row = catalogue(page).locator('.vote-row', { hasText: 'Titres en français' });
    await expect(row.getByRole('spinbutton', { name: '🎬 Films' })).toHaveValue('120');
    await expect(row.getByRole('spinbutton', { name: '📺 Séries' })).toHaveValue('15');
  });
});

test.describe('langue de l’appareil changée après le premier téléchargement', () => {
  test.use({ locale: 'de-DE' });

  test('la langue fixée au premier téléchargement est gardée', async ({ page, context }) => {
    await firstOpen(page);
    expect(await readMeta(page, 'min-votes')).toMatchObject({ lang: 'de' });
    // Même appareil, langue changée ensuite (simulée : la langue du navigateur ne change pas en cours de test).
    await context.addInitScript(() => Object.defineProperty(navigator, 'languages', { get: () => ['ko-KR'] }));
    await page.reload();
    await openCatalogueSettings(page);
    await expect(langSelect(page)).toHaveValue('de');
  });
});
