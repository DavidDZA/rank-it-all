import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { compactTaste, TASTE_VERSION } from '../worker/src/taste.js';
import { db, setMeta, type Answer } from '../src/lib/db';
import { diversityGroups, EXPLORE_EVERY, orderProposals, TOP_POINTS, trainModel, userPoints, type Ranked } from '../src/lib/tasteModel';
import { buildProposals, explain, hitRate, likedCount, recordRecoAnswer, RECO_STATS, type RecoStats } from '../src/lib/proposals';
import type { TasteData } from '../src/lib/taste';
import { draw } from '../src/pages/swipe/pool';
import { makeTitle } from './helpers';

// Propositions « selon tes goûts » : résumé des titres, points, modèle appris, ordre, explications, mesure.

const answer = (key: string, status: Answer['status'], tier?: Answer['tier'], updatedAt = 1): Answer => ({ key, type: key.startsWith('tv') ? 'tv' : 'movie', status, ...(tier ? { tier } : {}), updatedAt });

/** Résumé de test : caractéristiques, recommandations (ids), noms. */
const taste = (f: string[], recs: number[] = [], extra: Partial<TasteData> = {}): TasteData => ({
  v: TASTE_VERSION,
  f,
  names: {},
  votes: 2000,
  rating: 7,
  recs: recs.map((id) => ({ id, title: `Titre ${id}`, poster_path: null, vote_count: 2000, genre_ids: [80], original_language: 'en' })),
  ...extra,
});

beforeEach(async () => {
  await Promise.all([db.titles.clear(), db.answers.clear(), db.meta.clear(), db.tastes.clear()]);
});

describe('résumé d’un titre (taste.js, partagé avec le relais)', () => {
  const raw = {
    release_date: '1995-12-15',
    original_language: 'en',
    vote_count: 7000,
    vote_average: 7.9,
    genres: [{ id: 80 }, { id: 18 }],
    belongs_to_collection: { id: 12 },
    production_companies: [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }],
    keywords: { keywords: [{ id: 10, name: 'heist' }, { id: 11, name: 'los angeles' }] },
    credits: {
      cast: [{ id: 21, name: 'Robert De Niro', order: 1 }, { id: 20, name: 'Al Pacino', order: 0 }, ...Array.from({ length: 8 }, (_, i) => ({ id: 30 + i, name: `Rôle ${i}`, order: 2 + i }))],
      crew: [
        { id: 40, name: 'Michael Mann', job: 'Director' },
        { id: 40, name: 'Michael Mann', job: 'Screenplay' },
        { id: 41, name: 'Elliot Goldenthal', job: 'Original Music Composer' },
        { id: 42, name: 'Dante Spinotti', job: 'Director of Photography' },
        { id: 43, name: 'Perchman', job: 'Boom Operator' },
      ],
    },
    recommendations: { results: Array.from({ length: 25 }, (_, i) => ({ id: 100 + i, title: `Reco ${i}`, overview: 'long', poster_path: null, vote_count: 10 })) },
  };

  it('film : mots-clés, genres, décennie, langue, saga, 3 studios, équipe, 6 acteurs dans l’ordre du générique', () => {
    const t = compactTaste('movie', raw);
    expect(t.f).toEqual(
      expect.arrayContaining(['kw:10', 'kw:11', 'g:80', 'g:18', 'dec:1990', 'lang:en', 'sg:12', 'st:1', 'st:3', 'dir:40', 'wr:40', 'mu:41', 'dop:42', 'ac:20', 'ac:21']),
    );
    expect(t.f).not.toContain('st:4');
    expect(t.f.filter((f) => f.startsWith('ac:'))).toEqual(['ac:20', 'ac:21', 'ac:30', 'ac:31', 'ac:32', 'ac:33']);
    expect(t.f.some((f) => f === 'mu:43' || f === 'dop:43' || f.endsWith(':43'))).toBe(false);
    expect(t.names).toEqual(expect.objectContaining({ 'dir:40': 'Michael Mann', 'ac:20': 'Al Pacino' }));
    expect(t).toMatchObject({ v: TASTE_VERSION, votes: 7000, rating: 7.9 });
  });

  it('20 recommandations au plus, sans leur résumé ; un résumé déjà fait est rendu tel quel', () => {
    const t = compactTaste('movie', raw);
    expect(t.recs).toHaveLength(20);
    expect(t.recs[0]).toEqual({ id: 100, title: 'Reco 0', poster_path: null, vote_count: 10 });
    expect(compactTaste('movie', t)).toBe(t);
  });

  it('série : mots-clés (format des séries), chaîne, créateurs, sans les scénaristes d’épisodes', () => {
    const t = compactTaste('tv', {
      first_air_date: '2008-01-20',
      keywords: { results: [{ id: 5 }] },
      networks: [{ id: 174 }],
      created_by: [{ id: 66, name: 'Vince Gilligan' }],
      aggregate_credits: { cast: [{ id: 17, name: 'Bryan Cranston', order: 0 }], crew: [{ id: 9, jobs: [{ job: 'Writer' }] }] },
    });
    expect(t.f).toEqual(['kw:5', 'dec:2000', 'nw:174', 'cr:66', 'ac:17']);
    expect(t.names).toEqual({ 'cr:66': 'Vince Gilligan', 'ac:17': 'Bryan Cranston' });
  });
});

describe('points de tes réponses', () => {
  it('bof et pas envie 0, wishlist 0,5, bien 1 ; bien classé : de 5 (n° 1) à 1 (dernier des « bien »)', () => {
    const answers = [answer('movie:1', 'seen', 'good'), answer('movie:2', 'seen', 'good'), answer('movie:3', 'seen', 'good'), answer('movie:4', 'seen', 'meh'), answer('movie:5', 'wish'), answer('movie:6', 'unseen'), answer('movie:7', 'seen', 'good')];
    // Le bof classé au milieu ne compte pas dans les places des « bien ».
    const pts = userPoints(answers, [['movie:2', 'movie:4', 'movie:1', 'movie:3']]);
    expect(pts['movie:2']).toBe(TOP_POINTS);
    expect(pts['movie:3']).toBe(1);
    expect(pts['movie:1']).toBeCloseTo(1 + (TOP_POINTS - 1) * 0.25); // milieu : la courbe favorise le haut
    expect(pts).toMatchObject({ 'movie:4': 0, 'movie:5': 0.5, 'movie:6': 0, 'movie:7': 1 });
  });

  it('place relative : le n° 1 d’un petit classement vaut le n° 1 d’un grand ; séries et animes chacun le leur', () => {
    const answers = ['tv:1', 'tv:2', 'tv:3', 'tv:4'].map((k) => answer(k, 'seen', 'good'));
    const pts = userPoints(answers, [['tv:1', 'tv:2'], ['tv:3', 'tv:4']]);
    expect([pts['tv:1'], pts['tv:2'], pts['tv:3'], pts['tv:4']]).toEqual([TOP_POINTS, 1, TOP_POINTS, 1]);
  });
});

/** Profil de test : tu aimes les films de braquage (kw:1) de Michael Mann (dir:7), pas les comédies romantiques (kw:2). */
function profile() {
  const answers: Answer[] = [];
  const tastes = new Map<string, TasteData>();
  for (let i = 0; i < 15; i++) {
    answers.push(answer(`movie:${i}`, 'seen', 'good'));
    tastes.set(`movie:${i}`, taste(['kw:1', `kw:${100 + (i % 3)}`, i < 6 ? 'dir:7' : 'g:80'], i < 3 ? [500] : [], { names: { 'dir:7': 'Michael Mann' } }));
  }
  for (let i = 15; i < 40; i++) {
    answers.push(answer(`movie:${i}`, i % 2 ? 'unseen' : 'seen', i % 2 ? undefined : 'meh'));
    tastes.set(`movie:${i}`, taste(['kw:2', `kw:${100 + (i % 3)}`, 'g:10749']));
  }
  return { answers, tastes };
}

describe('modèle appris', () => {
  it('note plus haut ce qui ressemble à tes « bien » qu’à tes « bof » et « pas envie »', () => {
    const { answers, tastes } = profile();
    tastes.set('movie:500', taste(['kw:1', 'g:80']));
    tastes.set('movie:501', taste(['kw:2', 'g:10749']));
    const model = trainModel({ answers, points: userPoints(answers, []), tastes, type: 'movie' });
    expect(model.score('movie:500')!).toBeGreaterThan(model.score('movie:501')!);
    expect(model.probability('movie:500')!).toBeGreaterThan(0.5);
    expect(model.probability('movie:501')!).toBeLessThan(0.5);
    expect(model.weight('kw:1')).toBeGreaterThan(0);
    expect(model.weight('kw:2')).toBeLessThan(0);
    expect(model.score('movie:999')).toBeNull(); // sans résumé
  });

  it('même modèle pour les mêmes réponses (tirage reproductible)', () => {
    const { answers, tastes } = profile();
    tastes.set('movie:500', taste(['kw:1']));
    const a = trainModel({ answers, points: userPoints(answers, []), tastes, type: 'movie' });
    const b = trainModel({ answers, points: userPoints(answers, []), tastes, type: 'movie' });
    expect(a.score('movie:500')).toBe(b.score('movie:500'));
  });

  it('liens par les recommandations TMDB : tes titres aimés les mieux classés d’abord, dans les deux sens', () => {
    const { answers, tastes } = profile();
    tastes.set('movie:500', taste(['kw:1'], [5])); // le candidat recommande lui-même movie:5
    const model = trainModel({ answers, points: userPoints(answers, [['movie:2', 'movie:1', 'movie:0']]), tastes, type: 'movie' });
    expect(model.likedLinks('movie:500').slice(0, 2)).toEqual(['movie:2', 'movie:1']);
    expect(model.likedLinks('movie:500')).toEqual(expect.arrayContaining(['movie:0', 'movie:5']));
  });

  it('explication : 2 titres aimés au plus, et la personne au plus fort poids appris', () => {
    const { answers, tastes } = profile();
    tastes.set('movie:500', taste(['kw:1', 'dir:7'], [], { names: { 'dir:7': 'Michael Mann' } }));
    const model = trainModel({ answers, points: userPoints(answers, []), tastes, type: 'movie' });
    const why = explain(model, tastes.get('movie:500')!, 'movie:500', (k) => `Film ${k}`);
    expect(why?.liked).toHaveLength(2);
    expect(why?.person).toEqual({ name: 'Michael Mann', role: 'director' });
    // Aucun lien ni personne qui compte : pas d'explication.
    tastes.set('movie:501', taste(['kw:2']));
    expect(explain(model, tastes.get('movie:501')!, 'movie:501', () => 'x')).toBeNull();
  });
});

describe('ordre des propositions', () => {
  const item = (key: string, score: number, groups: string[] = [], probability = 0.9, safeBet = false): Ranked => ({ key, score, probability, groups, safeBet });

  it('les mieux notées d’abord, une carte « à découvrir » toutes les 5 : le titre sûr sur lequel le modèle hésite le plus', () => {
    const items = [item('a', 9), item('b', 8), item('c', 7), item('d', 6), item('e', 5), item('doute', 1, [], 0.52, true), item('connu-mais-sur', 0.5, [], 0.95, true), item('inconnu', 0.4, [], 0.5, false)];
    const order = orderProposals(items);
    expect(order.slice(0, 5).map((o) => o.key)).toEqual(['a', 'b', 'c', 'd', 'doute']);
    expect(order[EXPLORE_EVERY - 1]).toEqual({ key: 'doute', explore: true });
    expect(order.filter((o) => o.explore)).toHaveLength(order.length >= 10 ? 2 : 1);
  });

  it('pas plus de 2 films d’un même réalisateur ou d’une même saga parmi 20 propositions de suite', () => {
    const items = [...Array.from({ length: 6 }, (_, i) => item(`mann${i}`, 100 - i, ['dir:7'])), ...Array.from({ length: 60 }, (_, i) => item(`autre${i}`, 50 - i))];
    const order = orderProposals(items).map((o) => o.key);
    for (let i = 0; i + 20 <= order.length; i++) expect(order.slice(i, i + 20).filter((k) => k.startsWith('mann')).length).toBeLessThanOrEqual(2);
    expect(order.slice(0, 2)).toEqual(['mann0', 'mann1']);
    expect(order).toHaveLength(66); // rien de perdu
    // Plus que des films de Michael Mann à proposer : proposés quand même, plutôt que perdus.
    expect(orderProposals([item('m1', 3, ['dir:7']), item('m2', 2, ['dir:7']), item('m3', 1, ['dir:7'])]).map((o) => o.key)).toEqual(['m1', 'm2', 'm3']);
    expect(diversityGroups(['kw:1', 'sg:5', 'dir:7', 'cr:8', 'ac:9'])).toEqual(['sg:5', 'dir:7', 'cr:8']);
  });

  it('tirage ordonné du swipe : les propositions sortent dans l’ordre', () => {
    const pool = { items: [1, 2, 3].map((id) => ({ title: makeTitle(id), w: 1 })), total: 3, ordered: true };
    expect([draw(pool), draw(pool), draw(pool), draw(pool)].map((t) => t?.tmdbId ?? null)).toEqual([1, 2, 3, null]);
  });
});

describe('propositions de la catégorie (base locale, sans réseau)', () => {
  /** Profil en base : résumés déjà là (rien à télécharger), candidats venus des recommandations. */
  async function seedProfile(extraTitles = true) {
    const { answers, tastes } = profile();
    // Les titres aimés recommandent 500 (braquage), 501 (romance), 502 (déjà vu), 503 (anime, catégorie séries).
    for (let i = 0; i < 15; i++) tastes.set(`movie:${i}`, { ...tastes.get(`movie:${i}`)!, recs: taste([], [500, 501, 15]).recs });
    await db.answers.bulkPut(answers);
    if (extraTitles) await db.titles.bulkPut(answers.map((a) => makeTitle(Number(a.key.split(':')[1]), { title: `Film ${a.key.split(':')[1]}` })));
    const rows = [...tastes.entries()].map(([key, data]) => ({ key, fetchedAt: Date.now(), data }));
    rows.push({ key: 'movie:500', fetchedAt: Date.now(), data: taste(['kw:1', 'dir:7'], [], { names: { 'dir:7': 'Michael Mann' } }) });
    rows.push({ key: 'movie:501', fetchedAt: Date.now(), data: taste(['kw:2', 'g:10749']) });
    await db.tastes.bulkPut(rows);
    await setMeta('ranking:movie', ['movie:3', 'movie:4', 'movie:5']);
  }

  it('titres jamais triés, le plus proche de tes goûts en tête, avec pourquoi', async () => {
    await seedProfile();
    const progress: number[] = [];
    const list = await buildProposals('movie', (p) => progress.push(p));
    expect(list.map((p) => p.title.key)).toEqual(['movie:500', 'movie:501']); // movie:15 est déjà trié
    expect(list[0].title).toMatchObject({ title: 'Titre 500', manual: true });
    expect(list[0].why?.liked.slice(0, 2)).toEqual(['Film 3', 'Film 4']); // les mieux classés d'abord
    expect(list[0].why?.person).toEqual({ name: 'Michael Mann', role: 'director' });
    expect(progress.at(-1)).toBe(1);
  });

  it('rien de changé : propositions reprises sans recalcul ; une réponse de plus : recalculées', async () => {
    await seedProfile();
    const first = await buildProposals('movie');
    expect(await buildProposals('movie')).toBe(first);
    await db.answers.put(answer('movie:500', 'seen', 'good', 99));
    const next = await buildProposals('movie');
    expect(next).not.toBe(first);
    expect(next.map((p) => p.title.key)).toEqual(['movie:501']);
  });

  it('séries : les animes recommandés vont dans la catégorie Animes, pas dans Séries', async () => {
    const answers = Array.from({ length: 12 }, (_, i) => answer(`tv:${i}`, 'seen', 'good'));
    await db.answers.bulkPut(answers);
    const anime = { id: 700, name: 'Anime', poster_path: null, vote_count: 900, genre_ids: [16], original_language: 'ja' };
    const serie = { id: 701, name: 'Série', poster_path: null, vote_count: 900, genre_ids: [18], original_language: 'en' };
    await db.tastes.bulkPut([
      ...answers.map((a) => ({ key: a.key, fetchedAt: Date.now(), data: { ...taste(['kw:1']), recs: [anime, serie] } })),
      { key: 'tv:700', fetchedAt: Date.now(), data: taste(['kw:1']) },
      { key: 'tv:701', fetchedAt: Date.now(), data: taste(['kw:1']) },
    ]);
    expect((await buildProposals('tv')).map((p) => p.title.key)).toEqual(['tv:701']);
    expect((await buildProposals('anime')).map((p) => p.title.key)).toEqual(['tv:700']);
  });

  it('titres « bien » comptés par catégorie (seuil d’ouverture des propositions)', async () => {
    await seedProfile();
    expect(await likedCount('movie')).toBe(15);
    expect(await likedCount('tv')).toBe(0);
  });
});

describe('mesure en usage', () => {
  it('réponses aux propositions comptées à part pour les « à découvrir », « Annuler » les retire', async () => {
    await recordRecoAnswer('movie', 'seen', 'good', false);
    await recordRecoAnswer('movie', 'wish', undefined, false);
    await recordRecoAnswer('movie', 'unseen', undefined, false);
    await recordRecoAnswer('movie', 'seen', 'meh', true);
    await recordRecoAnswer('movie', 'unseen', undefined, false, -1);
    const stats = (await db.meta.get(RECO_STATS('movie')))?.value as RecoStats;
    expect(stats).toEqual({ good: 1, meh: 0, wish: 1, unseen: 0, explore: { good: 0, meh: 1, wish: 0, unseen: 0 } });
    expect(hitRate(stats)).toBe(1);
    expect(hitRate({ ...stats, good: 0, wish: 0 })).toBeNull();
  });
});
