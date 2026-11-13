import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { details, readAnswers, seed, title } from './helpers';

/** Écrans de consultation : stats et badges, tier list, partage en image, filtres du swipe. */

const NAMES = ['Le Parrain', 'Parasite', 'Inception', 'Drive', 'Her', 'Arrival', 'Whiplash', 'Amélie', 'Matrix', 'Alien'];
const films = NAMES.map((n, i) => title('movie', i + 1, n));
const seenAll = { titles: films, answers: films.map((t) => ({ key: t.key, status: 'seen' as const, tier: 'good' as const })), meta: { 'ranking:movie': films.map((t) => t.key), lastSync: Date.now() } };

const tab = (page: Page, name: string) => page.getByRole('button', { name, exact: true }).click();

test('stats sans la catégorie Animes : toujours 6 cases, « aimés » à la place des animes', async ({ page }) => {
  await seed(page, { ...seenAll, meta: { ...seenAll.meta, 'show-anime': false } }, '#/stats');
  const tile = (label: string) => page.locator('.stat-tile', { hasText: label }).locator('.stat-value');
  await expect(page.locator('.stat-tile')).toHaveCount(6);
  await expect(tile('aimés')).toHaveText('10');
  await expect(tile('classés')).toHaveText('10');
  await expect(page.locator('.stat-tile', { hasText: 'animes vus' })).toHaveCount(0);
});

test('stats : chiffres, activité, décennies, réalisateurs, badges', async ({ page }) => {
  const [a, b, c] = [title('movie', 1, 'Pulp Fiction', { year: 1994 }), title('movie', 2, 'Jackie Brown', { year: 1997 }), title('movie', 3, 'Inception', { year: 2010 })];
  const serie = title('tv', 10, 'The Office', { year: 2005 });
  const today = new Date();
  const day = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  await seed(
    page,
    {
      titles: [a, b, c, serie, films[4]],
      answers: [...[a, b, c, serie].map((t) => ({ key: t.key, status: 'seen' as const })), { key: films[4].key, status: 'wish' }],
      details: [
        { ...details(a.key), directors: ['Quentin Tarantino'], topCast: ['Samuel L. Jackson'], runtime: 154, complete: true },
        { ...details(b.key), directors: ['Quentin Tarantino'], topCast: ['Samuel L. Jackson'], runtime: 154, complete: true },
        { ...details(c.key), directors: ['Christopher Nolan'], runtime: 148, complete: true },
        { ...details(serie.key), runtime: 22, episodes: 100, complete: true },
      ],
      meta: { activity: { [day]: 12 }, 'saga:1': { name: 'Tarantino Collection', keys: [a.key, b.key] }, lastSync: Date.now() },
    },
    '#/stats',
  );
  const tile = (label: string) => page.locator('.stat-tile', { hasText: label }).locator('.stat-value');
  await expect(tile('films vus')).toHaveText('3');
  await expect(tile('séries vues')).toHaveText('1');
  await expect(tile('en wishlist')).toHaveText('1');
  await expect(tile('devant l’écran')).toHaveText('44 h'); // 154 + 154 + 148 + 22 × 100 = 2 656 minutes
  await expect(tile('classés')).toHaveText('0');
  await expect(page.locator('.stat-tile')).toHaveCount(6); // 3 lignes pleines de 2 cases
  await expect(page.getByText('🔥 Série : 1 j')).toBeVisible();
  await expect(page.getByText('⚡ Meilleur jour : 12')).toBeVisible();
  const bars = (heading: string) => page.locator('section.card', { has: page.getByRole('heading', { name: heading }) }).locator('.hbar');
  await expect(bars('🕰️ Par décennie')).toHaveText([/90s\s*2/, /2010s\s*1/]);
  await expect(bars('🎬 Réalisateurs les plus vus')).toHaveText([/Quentin Tarantino\s*2/]); // Nolan, vu une fois : absent
  await expect(bars('🌟 Acteurs les plus vus')).toHaveText([/Samuel L\. Jackson\s*2/]);
  await expect(page.locator('.badge-card.done', { hasText: 'Premier pas' })).toBeVisible();
  await expect(page.locator('.badge-card.done', { hasText: 'Saga complète' })).toBeVisible();
  await expect(page.locator('.badge-card:not(.done)', { hasText: 'Cinéphile' })).toContainText('3/100');
  await expect(page.locator('.badge-card')).toHaveCount(51);
  // 3 badges par ligne, sur téléphone comme sur PC : 17 lignes pleines.
  const columns = await page.locator('.badge-grid').evaluate((el) => getComputedStyle(el).gridTemplateColumns.split(' ').length);
  expect(columns).toBe(3);
  await expect(page.getByRole('heading', { name: /🏅 Badges \(\d+\/51\)/ })).toBeVisible();
  // Plus de rubrique « Sagas complètes » (le badge reste).
  await expect(page.getByRole('heading', { name: /Sagas complètes/ })).toHaveCount(0);
  await expect(page.getByText('Tarantino Collection')).toHaveCount(0);
  // Séries : leurs propres stats.
  await page.getByRole('button', { name: /Séries/ }).first().click();
  await expect(bars('🕰️ Par décennie')).toHaveText([/2000s\s*1/]);
});

test('tier list : S à D selon la place au classement (10 / 20 / 30 / 25 / 15 %)', async ({ page }) => {
  await seed(page, seenAll, '#/rank/movie');
  await tab(page, 'Tier list');
  const row = (label: string) => page.locator('.tier-row', { has: page.locator('.tier-label', { hasText: new RegExp(`^${label}$`) }) }).locator('.tier-poster');
  const titles = async (label: string) => (await row(label).evaluateAll((els) => els.map((e) => e.getAttribute('title')))).map((t) => t!.replace(/ \(\d{4}\)$/, ''));
  await expect(page.locator('.tier-poster')).toHaveCount(10);
  expect(await titles('S')).toEqual(['Le Parrain']);
  expect(await titles('A')).toEqual(['Parasite', 'Inception']);
  expect(await titles('B')).toEqual(['Drive', 'Her', 'Arrival']);
  expect(await titles('C')).toEqual(['Whiplash', 'Amélie', 'Matrix']);
  expect(await titles('D')).toEqual(['Alien']);
  // Toucher une affiche : sa fiche.
  await row('S').first().click();
  await expect(page.getByRole('dialog', { name: 'Fiche de Le Parrain' })).toBeVisible();
});

/** Partage du téléphone simulé : le fichier transmis est noté dans la page. */
const fakeShare = (page: Page) =>
  page.addInitScript(() => {
    Object.assign(navigator, {
      canShare: (d: { files?: File[] }) => !!d.files?.length,
      share: async (d: { files: File[]; title: string }) => {
        const f = d.files[0];
        const head = new Uint8Array(await f.slice(0, 24).arrayBuffer());
        (window as unknown as { shared: unknown }).shared = { name: f.name, type: f.type, title: d.title, png: head[1] === 0x50 && head[2] === 0x4e && head[3] === 0x47, width: (head[16] << 24) | (head[17] << 16) | (head[18] << 8) | head[19] };
      },
    });
  });
const shared = (page: Page) => page.evaluate(() => (window as unknown as { shared?: Record<string, unknown> }).shared);

test('partager son top 10 (téléphone) : une image PNG de 1 080 px envoyée au partage', async ({ page }) => {
  await fakeShare(page);
  await seed(page, seenAll, '#/rank/movie');
  await tab(page, 'Mon classement');
  await page.getByRole('button', { name: '📤 Partager mon top 10' }).click();
  await expect.poll(() => shared(page)).toEqual({ name: 'mon-top-films.png', type: 'image/png', title: 'Mon top 10', png: true, width: 1080 });
});

test('partager sa tier list (téléphone)', async ({ page }) => {
  await fakeShare(page);
  await seed(page, seenAll, '#/rank/movie');
  await tab(page, 'Tier list');
  await page.getByRole('button', { name: '📤 Partager ma tier list' }).click();
  await expect.poll(() => shared(page)).toMatchObject({ name: 'ma-tier-list-films.png', title: 'Ma tier list', png: true, width: 1080 });
});

test('partager sans partage du système (PC) : l’image est téléchargée', async ({ page }, info) => {
  await page.addInitScript(() => Object.assign(navigator, { canShare: undefined }));
  await seed(page, seenAll, '#/rank/movie');
  await tab(page, 'Mon classement');
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: '📤 Partager mon top 10' }).click()]);
  expect(download.suggestedFilename()).toBe('mon-top-films.png');
  const file = info.outputPath('top.png');
  await download.saveAs(file);
  const png = readFileSync(file);
  expect(png.subarray(1, 4).toString()).toBe('PNG');
  expect(png.readUInt32BE(16)).toBe(1080);
});

test('partager un top vide : message, pas d’image', async ({ page }) => {
  await seed(page, { titles: films.slice(0, 1), meta: { lastSync: Date.now() } }, '#/rank/movie');
  await tab(page, 'Mon classement');
  await page.getByRole('button', { name: '📤 Partager mon top 10' }).click();
  await expect(page.getByText('Classe au moins un titre pour partager ton top !')).toBeVisible();
});

test.describe('filtres du swipe', () => {
  const catalogue = [
    title('movie', 1, 'Inception', { year: 2010, genreIds: [28, 878], originalLanguage: 'en', rating: 8.4 }),
    title('movie', 2, 'Amélie', { year: 2001, genreIds: [35, 10749], originalLanguage: 'fr', rating: 7.9 }),
    title('movie', 3, 'Parasite', { year: 2019, genreIds: [35, 53, 18], originalLanguage: 'ko', rating: 8.5 }),
    title('movie', 4, 'Drive', { year: 2011, genreIds: [18], originalLanguage: 'en', rating: 7.6 }),
  ];
  const current = (page: Page) => page.locator('.swipe-card:not(.card-behind) .title-main');
  const sheet = (page: Page) => page.getByRole('dialog', { name: 'Filtres' });

  test('genre, langue, période et note : seuls les titres qui passent sont proposés, et le filtre reste', async ({ page }) => {
    await seed(page, { titles: catalogue, meta: { lastSync: Date.now() } }, '#/swipe/movie');
    await expect(current(page)).toBeVisible();
    await page.getByRole('button', { name: 'Filtres' }).click();
    await sheet(page).getByRole('button', { name: 'Comédie', exact: true }).click();
    await expect(sheet(page).getByRole('button', { name: 'C’est parti (2)' })).toBeVisible();
    await sheet(page).getByRole('button', { name: '🇫🇷 Français' }).click();
    await expect(sheet(page).getByRole('button', { name: 'C’est parti (1)' })).toBeVisible();
    // Toutes les langues (le 2e « Toutes », après celui de la période), mais seulement les années 2010 : Parasite (2019).
    await sheet(page).getByRole('button', { name: 'Toutes', exact: true }).last().click();
    await sheet(page).getByRole('button', { name: '2010s' }).click();
    await sheet(page).getByRole('button', { name: 'C’est parti (1)' }).click();
    await expect(current(page)).toHaveText('Parasite');
    await page.getByRole('button', { name: 'Vu · bien', exact: true }).click();
    await expect(page.getByText('Plus rien à trier avec ces filtres !')).toBeVisible();
    // Toujours là après un rechargement.
    await page.reload();
    await expect(page.getByText('Plus rien à trier avec ces filtres !')).toBeVisible();
    // Filtres retirés : les autres titres reviennent.
    await page.getByRole('button', { name: 'Changer les filtres' }).first().click();
    await sheet(page).getByRole('button', { name: 'Réinitialiser' }).click();
    await sheet(page).getByRole('button', { name: 'C’est parti (3)' }).click();
    await expect(current(page)).toBeVisible();
    expect(await readAnswers(page)).toEqual({ 'movie:3': 'seen:good' });
  });

  test('note minimum (curseur)', async ({ page }) => {
    await seed(page, { titles: catalogue, meta: { lastSync: Date.now() } }, '#/swipe/movie');
    await page.getByRole('button', { name: 'Filtres' }).click();
    await sheet(page).getByRole('slider', { name: 'Note TMDB minimum' }).fill('8');
    await expect(sheet(page)).toContainText('⭐ 8');
    await expect(sheet(page).getByRole('button', { name: 'C’est parti (2)' })).toBeVisible(); // Inception 8,4 et Parasite 8,5
  });
});
