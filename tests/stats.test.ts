import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { db, getMeta, setMeta, setStatus, type Details } from '../src/lib/db';
import { computeStats, formatHours } from '../src/lib/stats';
import { BADGES, checkBadges } from '../src/lib/badges';
import { saveRanking } from '../src/lib/ranking';
import { forgetCategories } from '../src/lib/category';
import { makeTitle } from './helpers';

// Les badges débloqués s'annoncent par un message (événement « app-toast ») et une explosion d'emojis.
const toasts: string[] = [];
vi.stubGlobal('dispatchEvent', (e: CustomEvent) => {
  if (e.type === 'app-toast') toasts.push(e.detail);
  return true;
});
vi.stubGlobal('matchMedia', () => ({ matches: true })); // animations réduites : pas d'explosion à dessiner

const fiche = (extra: Partial<Details>): Details => ({
  fetchedAt: Date.now(),
  directors: [],
  cast: [],
  topCast: [],
  genres: [],
  genreIds: [18],
  rating: 7,
  runtime: null,
  providers: { flatrate: [], rent: [], buy: [], link: null },
  complete: true,
  ...extra,
});

const day = (offset: number) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

beforeEach(async () => {
  await Promise.all([db.titles.clear(), db.answers.clear(), db.meta.clear(), db.details.clear()]);
  forgetCategories();
  toasts.length = 0;
});

describe('stats', () => {
  it('compte par catégorie : vus, wishlist, pas vus, classés', async () => {
    await setStatus(makeTitle(1), 'seen');
    await setStatus(makeTitle(2), 'seen');
    await setStatus(makeTitle(3), 'wish');
    await setStatus(makeTitle(4), 'unseen');
    await setStatus(makeTitle(10, {}, 'tv'), 'seen');
    await setStatus(makeTitle(11, { genreIds: [16], originalLanguage: 'ja' }, 'tv'), 'seen');
    await saveRanking({ category: 'movie', list: 'seen' }, ['movie:2']);
    const s = await computeStats();
    expect([s.movie.seen, s.tv.seen, s.anime.seen]).toEqual([2, 1, 1]);
    expect([s.wish, s.unseen]).toEqual([1, 1]);
    expect(s.movie.ranked).toBe(1);
  });

  it('décennies, genres, réalisateurs et acteurs (seulement ceux vus plus d’une fois)', async () => {
    await setStatus(makeTitle(1, { year: 1994, genreIds: [18, 80] }), 'seen');
    await setStatus(makeTitle(2, { year: 1999, genreIds: [18] }), 'seen');
    await setStatus(makeTitle(3, { year: 2010, genreIds: [28] }), 'seen');
    await db.details.bulkPut([
      { key: 'movie:1', ...fiche({ directors: ['Tarantino'], topCast: ['Uma Thurman', 'Samuel L. Jackson'] }) },
      { key: 'movie:2', ...fiche({ directors: ['Tarantino'], topCast: ['Samuel L. Jackson'] }) },
      { key: 'movie:3', ...fiche({ directors: ['Nolan'], topCast: ['Uma Thurman'] }) },
    ]);
    const { movie } = await computeStats();
    expect(movie.decades).toEqual([
      { label: '90s', count: 2 },
      { label: '2010s', count: 1 },
    ]);
    expect(movie.genres[0]).toEqual({ label: 'Drame', count: 2 });
    expect(movie.people).toEqual([{ label: 'Tarantino', count: 2 }]);
    expect(movie.actors.map((a) => a.label).sort()).toEqual(['Samuel L. Jackson', 'Uma Thurman']);
    expect(movie.withDetails).toBe(3);
  });

  it('temps passé : durée du film, ou d’un épisode × nombre d’épisodes', async () => {
    await setStatus(makeTitle(1), 'seen');
    await setStatus(makeTitle(10, {}, 'tv'), 'seen');
    await db.details.bulkPut([
      { key: 'movie:1', ...fiche({ runtime: 120 }) },
      { key: 'tv:10', ...fiche({ runtime: 50, episodes: 10 }) },
    ]);
    const s = await computeStats();
    expect(s.movie.minutes).toBe(120);
    expect(s.tv.minutes).toBe(500);
    expect(formatHours(90)).toBe('2 h');
    expect(formatHours(60 * 50)).toBe('50 h (2 jours)');
  });

  it('sagas complètes : tous les films vus, et au moins deux films', async () => {
    await setStatus(makeTitle(1), 'seen');
    await setStatus(makeTitle(2), 'seen');
    await setMeta('saga:1', { name: 'Complète', keys: ['movie:1', 'movie:2'] });
    await setMeta('saga:2', { name: 'Incomplète', keys: ['movie:1', 'movie:3'] });
    await setMeta('saga:3', { name: 'Un seul film', keys: ['movie:2'] });
    expect((await computeStats()).sagas).toEqual(['Complète']);
  });

  it('activité : série en cours, record, meilleur jour, total', async () => {
    await setMeta('activity', { [day(0)]: 5, [day(-1)]: 3, [day(-2)]: 120, [day(-10)]: 1 });
    const s = await computeStats();
    expect(s).toMatchObject({ today: 5, streak: 3, bestStreak: 3, bestDay: 120, totalActions: 129 });
    expect(s.last30).toHaveLength(30);
    expect(s.last30.at(-1)?.count).toBe(5);
  });

  it('titres vus à compléter : sans fiche, ou fiche vide', async () => {
    await setStatus(makeTitle(1), 'seen'); // sans fiche
    await setStatus(makeTitle(2), 'seen');
    await setStatus(makeTitle(3), 'seen');
    await db.details.bulkPut([
      { key: 'movie:2', ...fiche({ directors: ['X'] }) },
      { key: 'movie:3', ...fiche({ complete: undefined }) }, // vide, d'avant le 12/11
    ]);
    expect((await computeStats()).missingDetails.map((t) => t.key).sort()).toEqual(['movie:1', 'movie:3']);
  });
});

describe('badges', () => {
  it('débloque « Premier pas » au premier titre vu, une seule fois, avec un message', async () => {
    await checkBadges();
    expect(await getMeta('badges', [])).toEqual([]);
    await setStatus(makeTitle(1), 'seen');
    await checkBadges();
    expect(await getMeta('badges', [])).toEqual(['first']);
    expect(toasts).toEqual(['🏅 Badge débloqué : 🎬 Premier pas']);
    await checkBadges();
    expect(toasts).toHaveLength(1);
  });

  it('plusieurs badges d’un coup : un seul message, avec le nombre des autres', async () => {
    for (let i = 1; i <= 25; i++) await setStatus(makeTitle(i), 'wish');
    await setStatus(makeTitle(100), 'seen');
    await checkBadges();
    expect(await getMeta('badges', [])).toEqual(['first', 'wish25']);
    expect(toasts).toEqual(['🏅 Badge débloqué : 🎬 Premier pas (+1)']);
  });

  it('chaque badge a un identifiant unique et un objectif atteignable', () => {
    expect(new Set(BADGES.map((b) => b.id)).size).toBe(BADGES.length);
    expect(BADGES.every((b) => b.target >= 1)).toBe(true);
  });
});
