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

  it('pour les badges : jours actifs, titres aimés, wishlist priorisée', async () => {
    await setMeta('activity', { [day(0)]: 5, [day(-3)]: 2, [day(-9)]: 0 });
    await setStatus(makeTitle(1), 'seen', 'good');
    await setStatus(makeTitle(2), 'seen', 'meh');
    await setStatus(makeTitle(3), 'wish');
    await setStatus(makeTitle(4, {}, 'tv'), 'wish');
    await saveRanking({ category: 'movie', list: 'wish' }, ['movie:3']);
    await saveRanking({ category: 'tv', list: 'wish' }, ['tv:4']);
    expect(await computeStats()).toMatchObject({ activeDays: 2, good: 1, wishRanked: 2 });
  });

  it('pour les badges : langues, français, genres, vieux films, récents, bien notés, films longs, épisodes, réalisateur et acteur favoris', async () => {
    const year = new Date().getFullYear();
    await setStatus(makeTitle(1, { year: 1955, originalLanguage: 'fr', genreIds: [18, 35], rating: 8.4 }), 'seen');
    await setStatus(makeTitle(2, { year: 1999, originalLanguage: 'ja', genreIds: [16] }), 'seen');
    await setStatus(makeTitle(3, { year, originalLanguage: 'en', genreIds: [18] }), 'seen');
    await setStatus(makeTitle(10, { year: year - 1, originalLanguage: 'fr' }, 'tv'), 'seen');
    await setStatus(makeTitle(4, { year: 1950, originalLanguage: 'fr' }), 'wish'); // pas vu : ne compte pas
    await db.details.bulkPut([
      { key: 'movie:1', ...fiche({ directors: ['Melville'], topCast: ['Delon'], runtime: 185 }) },
      { key: 'movie:2', ...fiche({ directors: ['Melville'], topCast: ['Delon'], runtime: 100, rating: 9 }) },
      { key: 'movie:3', ...fiche({ directors: ['Nolan'], topCast: ['Delon'], runtime: 180 }) },
      { key: 'tv:10', ...fiche({ runtime: 50, episodes: 24 }) },
    ]);
    expect((await computeStats()).discovery).toEqual({
      languages: 3,
      french: 2,
      movieGenres: 3, // Drame, Comédie, Animation
      oldFilms: 1,
      recent: 2,
      highRated: 2, // film 1 : 8,4 au catalogue ; film 2 : pas de note au catalogue, 9 dans sa fiche
      lowRated: 0,
      longFilms: 2,
      episodes: 24,
      maxDirector: 2,
      maxActor: 3,
    });
  });

  it('nanars : titres vus notés moins de 5 (un titre sans note ne compte pas)', async () => {
    await setStatus(makeTitle(1, { rating: 3.2 }), 'seen');
    await setStatus(makeTitle(2, { rating: 4.9 }), 'seen');
    await setStatus(makeTitle(3, { rating: 5 }), 'seen');
    await setStatus(makeTitle(4), 'seen'); // sans note au catalogue…
    await db.details.put({ key: 'movie:4', ...fiche({ rating: null }) }); // … ni dans sa fiche
    await setStatus(makeTitle(5, { rating: 2 }), 'wish'); // pas vu
    expect((await computeStats()).discovery.lowRated).toBe(2);
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

  it('51 badges, chacun avec un identifiant, un nom et un emoji uniques, et un objectif atteignable', () => {
    expect(BADGES).toHaveLength(51);
    expect(BADGES.length % 3).toBe(0); // lignes pleines de 3
    for (const field of ['id', 'name', 'emoji'] as const) expect(new Set(BADGES.map((b) => b[field])).size).toBe(51);
    expect(BADGES.every((b) => b.target >= 1)).toBe(true);
  });

  it('les nouveaux badges se débloquent sur les bons chiffres', async () => {
    await setMeta('activity', { [day(0)]: 60, [day(-1)]: 30, [day(-2)]: 20 }); // 110 tris, 3 jours d'affilée, 60 un jour
    for (let i = 1; i <= 5; i++) await setStatus(makeTitle(i, { originalLanguage: ['fr', 'en', 'ja', 'ko', 'it'][i - 1] }), 'seen', 'good');
    for (let i = 1; i <= 5; i++) await db.details.put({ key: `movie:${i}`, ...fiche({ directors: ['Kurosawa'] }) });
    await saveRanking({ category: 'movie', list: 'seen' }, [1, 2, 3, 4, 5].map((i) => `movie:${i}`));
    await checkBadges();
    const unlocked = await getMeta<string[]>('badges', []);
    expect(unlocked).toEqual(expect.arrayContaining(['first', 'sort100', 'day50', 'streak3', 'langs5', 'director5']));
    expect(unlocked).not.toContain('day100');
    expect(unlocked).not.toContain('ranked10'); // 5 classés sur 10
  });
});
