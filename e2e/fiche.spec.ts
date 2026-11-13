import { expect, test, type Page } from '@playwright/test';
import { details, mockTmdbApi, openRanking, readAnswers, readMeta, seed, title } from './helpers';

/**
 * Fiche d'un titre et ajout manuel, TMDB simulé (clé de test dans les réglages). Les fiches avaient perdu réalisateur,
 * acteurs, plateformes et bande-annonce (12/11) : ici, on vérifie ce qui s'affiche vraiment.
 */
const fightClub = title('movie', 550, 'Fight Club', { year: 1999 });

/** Réponse TMDB complète d'une fiche (casting, vidéos, plateformes). */
const FULL = {
  id: 550,
  runtime: 139,
  vote_average: 8.4,
  original_language: 'en',
  genres: [{ id: 18, name: 'Drame' }],
  credits: {
    cast: [
      { name: 'Brad Pitt', order: 1 },
      { name: 'Edward Norton', order: 0 },
      { name: 'Helena Bonham Carter', order: 2 },
    ],
    crew: [{ name: 'David Fincher', job: 'Director' }],
  },
  videos: { results: [{ key: 'yt-fight', site: 'YouTube', type: 'Trailer', iso_639_1: 'fr', official: true }] },
  'watch/providers': { results: { FR: { link: 'https://www.themoviedb.org/movie/550/watch', flatrate: [{ provider_id: 8, provider_name: 'Netflix', logo_path: '/n.png' }] } } },
};

async function withTmdb(page: Page, routes: Record<string, unknown>) {
  await mockTmdbApi(page, routes);
  await page.goto('/');
  await page.evaluate(() => localStorage.setItem('tmdb-token', 'jeton-de-test'));
}

const fiche = (page: Page) => page.getByRole('dialog', { name: 'Fiche de Fight Club' });

async function expectFullFiche(page: Page) {
  const f = fiche(page);
  await expect(f).toContainText('Réalisation : David Fincher');
  await expect(f).toContainText('Avec : Edward Norton, Brad Pitt');
  await expect(f).toContainText('2 h 19');
  await expect(f).toContainText('⭐ 8,4/10');
  await expect(f.getByRole('link', { name: '▶ Bande-annonce' })).toHaveAttribute('href', 'https://www.youtube.com/watch?v=yt-fight');
  await expect(f.locator('.provider-group', { hasText: 'Abonnement' }).getByRole('img', { name: 'Netflix' })).toBeVisible();
  await expect(f.getByRole('link', { name: 'Voir toutes les offres →' })).toBeVisible();
}

test('liste : toucher une ligne ouvre directement la fiche complète (réalisateur, acteurs, durée, note, bande-annonce, plateformes)', async ({ page }) => {
  await withTmdb(page, { '/movie/550': FULL });
  await seed(page, { titles: [fightClub], answers: [{ key: fightClub.key, status: 'seen', tier: 'good' }], meta: { 'ranking:movie': [fightClub.key], lastSync: Date.now() } }, '#/rank/movie');
  await openRanking(page);
  await page.locator('.row-text', { hasText: 'Fight Club' }).click();
  await expectFullFiche(page);
  await expect(fiche(page)).toContainText('Résumé de test.');
  await expect(fiche(page)).toContainText('✓ Vu · 👍 bien');
});

test('swipe : toucher l’affiche ouvre directement la fiche complète, sans rien enregistrer', async ({ page, isMobile }) => {
  await withTmdb(page, { '/movie/550': FULL });
  await seed(page, { titles: [fightClub], meta: { lastSync: Date.now() } }, '#/swipe/movie');
  await page.locator('.swipe-card:not(.card-behind) .card-poster').click();
  await expectFullFiche(page);
  await expect(fiche(page)).toContainText('Résumé de test.');
  if (!isMobile) await page.keyboard.press('9'); // fiche ouverte : les touches du swipe ne répondent pas
  await page.getByRole('button', { name: 'Fermer' }).click();
  await expect(fiche(page)).toHaveCount(0);
  await expect(page.locator('.swipe-card:not(.card-behind) .title-main')).toHaveText('Fight Club');
  expect(await readAnswers(page)).toEqual({});
});

test('duel : ℹ ouvre la fiche de ce titre, sans le choisir', async ({ page }) => {
  const drive = title('movie', 1, 'Drive');
  await withTmdb(page, { '/movie/550': FULL });
  await seed(
    page,
    {
      titles: [fightClub, drive],
      answers: [fightClub, drive].map((t) => ({ key: t.key, status: 'seen' as const, tier: 'good' as const })),
      meta: { 'ranking:movie': [drive.key], lastSync: Date.now() },
    },
    '#/rank/movie',
  );
  await page.getByRole('button', { name: 'Fiche de « Fight Club »', exact: true }).click();
  await expectFullFiche(page);
  await page.getByRole('button', { name: 'Fermer' }).click();
  await expect(page.getByText('Lequel préfères-tu ?')).toBeVisible(); // même duel, rien de choisi
  await expect(page.locator('.duel-card')).toHaveCount(2);
  expect(await readMeta(page, 'ranking:movie')).toEqual([drive.key]);
});

test('sous l’affiche : année et genres sur une ligne, réalisateur et acteurs sur la suivante (swipe et duels)', async ({ page }) => {
  const thriller = { ...fightClub, genreIds: [18, 53] };
  await withTmdb(page, { '/movie/550': FULL });
  await seed(page, { titles: [thriller], meta: { lastSync: Date.now() } }, '#/swipe/movie');
  const card = page.locator('.swipe-card:not(.card-behind)');
  await expect(card.locator('.title-meta')).toHaveText('1999 · Drame, Thriller');
  await expect(card.locator('.title-credits')).toHaveText('De David Fincher · Avec Edward Norton, Brad Pitt');

  const drive = title('movie', 1, 'Drive', { genreIds: [80] });
  await seed(
    page,
    { titles: [thriller, drive], answers: [thriller, drive].map((t) => ({ key: t.key, status: 'seen' as const })), meta: { 'ranking:movie': [drive.key], lastSync: Date.now() } },
    '#/rank/movie',
  );
  await expect(page.locator('.duel-card', { hasText: 'Fight Club' }).locator('.title-meta')).toHaveText('1999 · Drame, Thriller');
  await expect(page.locator('.duel-card', { hasText: 'Drive' }).locator('.title-meta')).toHaveText(`${drive.year} · Crime`);
});

test('fiche enregistrée vide (appareil déjà utilisé) : redemandée et complétée', async ({ page }) => {
  let calls = 0;
  await withTmdb(page, { '/movie/550': FULL });
  page.on('request', (r) => r.url().includes('/movie/550') && calls++);
  const empty = { ...details(fightClub.key), complete: undefined }; // aucun nom, sans repère « complète »
  await seed(page, { titles: [fightClub], answers: [{ key: fightClub.key, status: 'wish' }], details: [empty], meta: { lastSync: Date.now() } }, '#/wishlist');
  // Appui long sur la ligne : la fiche.
  const row = page.locator('.list-item', { hasText: 'Fight Club' });
  const box = (await row.boundingBox())!;
  await page.mouse.move(box.x + box.width / 3, box.y + box.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(700);
  await page.mouse.up();
  await expectFullFiche(page);
  expect(calls).toBeGreaterThan(0);
});

test('carte du swipe : réalisateur et deux acteurs principaux', async ({ page }) => {
  await withTmdb(page, { '/movie/550': FULL });
  await seed(page, { titles: [fightClub], meta: { lastSync: Date.now() } }, '#/swipe/movie');
  const card = page.locator('.swipe-card:not(.card-behind)');
  await expect(card).toContainText('De David Fincher');
  await expect(card).toContainText('Avec Edward Norton, Brad Pitt');
});

test('wishlist : logos des plateformes d’abonnement', async ({ page }) => {
  await withTmdb(page, { '/movie/550': FULL });
  await seed(page, { titles: [fightClub], answers: [{ key: fightClub.key, status: 'wish' }], meta: { lastSync: Date.now() } }, '#/wishlist');
  await expect(page.locator('.list-item', { hasText: 'Fight Club' }).getByRole('img', { name: 'Netflix' })).toBeVisible();
});

test.describe('ajout manuel', () => {
  test('par titre : recherche, puis « vu, bien » et wishlist', async ({ page }) => {
    await withTmdb(page, {
      '/search/multi': {
        page: 1,
        total_pages: 1,
        total_results: 3,
        results: [
          { id: 550, media_type: 'movie', title: 'Fight Club', original_title: 'Fight Club', release_date: '1999-10-15', poster_path: null, vote_count: 30000, genre_ids: [18] },
          { id: 77, media_type: 'tv', name: 'Fight Club : la série', original_name: 'Fight Club', first_air_date: '2020-01-01', poster_path: null, vote_count: 10, genre_ids: [18] },
          { id: 1, media_type: 'person', name: 'Quelqu’un' }, // pas un titre : écarté
        ],
      },
    });
    await page.goto('/#/add');
    await page.getByPlaceholder('Titre d’un film ou d’une série…').fill('fight');
    const rows = page.locator('.list-item');
    await expect(rows).toHaveCount(2);
    await rows.filter({ hasText: 'Fight Club' }).first().getByRole('button', { name: 'Vu, bien' }).click();
    await rows.filter({ hasText: 'la série' }).getByRole('button', { name: '♥' }).click();
    await expect.poll(() => readAnswers(page)).toEqual({ 'movie:550': 'seen:good', 'tv:77': 'wish' });
  });

  test('par réalisateur : la personne, puis sa filmographie', async ({ page }) => {
    const film = (id: number, name: string, votes: number) => ({ id, media_type: 'movie', title: name, original_title: name, release_date: '2010-07-16', poster_path: null, vote_count: votes, genre_ids: [878], job: 'Director' });
    await withTmdb(page, {
      '/search/person': { results: [{ id: 525, name: 'Christopher Nolan', profile_path: null, known_for_department: 'Directing', known_for: [{ title: 'Inception' }] }] },
      '/person/525/combined_credits': { cast: [], crew: [film(27205, 'Inception', 35000), film(11660, 'Following', 1500), film(99, 'Court métrage', 10)] },
    });
    await page.goto('/#/add');
    await page.getByRole('button', { name: 'Réalisateur' }).click();
    await page.getByPlaceholder('Nom d’un réalisateur ou d’une réalisatrice…').fill('nolan');
    await page.locator('.person-row', { hasText: 'Christopher Nolan' }).click();
    await expect(page.locator('.person-name')).toContainText('3 réalisé(s) · 0 vu');
    await page.locator('.list-item', { hasText: 'Inception' }).getByRole('button', { name: 'Vu, bien' }).click();
    await expect(page.locator('.person-name')).toContainText('1 vu');
    await expect(page.getByText('Moins connus (1)')).toBeVisible(); // le court métrage, rangé à part
    expect(await readAnswers(page)).toEqual({ 'movie:27205': 'seen:good' });
  });
});
