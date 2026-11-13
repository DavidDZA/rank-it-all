import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Performances : la file des demandes à TMDB, l'enregistrement groupé des fiches, et des budgets de temps pour les
// calculs faits sur toute la base (volumes d'un gros utilisateur : 14 000 titres au catalogue, des milliers de vus).
// Les budgets sont larges (machine lente, tests en parallèle) : ils attrapent un calcul devenu quadratique, pas 10 %.

vi.hoisted(() => {
  const store = new Map<string, string>([['tmdb-token', 'cle-de-test']]); // appels directs à TMDB, simulés ci-dessous
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, String(v)),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
  });
});

import { db, setStatus, type Details, type Title } from '../src/lib/db';
import { ensureDetails, MAX_IN_FLIGHT, prefetchDetails, queueState, SAVE_BATCH_MS, tmdb } from '../src/lib/tmdb';
import { computeStats } from '../src/lib/stats';
import { matchesTheme, NO_THEME } from '../src/lib/themes';
import { draw, removeFromPool, type Pool } from '../src/pages/swipe/pool';
import { compatibility, advice, commonWishlist, type Side } from '../src/lib/together';
import { tierize } from '../src/lib/tiers';
import { plan, type Row } from '../src/lib/cloudMerge';
import { forgetCategories } from '../src/lib/category';
import { makeTitle } from './helpers';

// ---------- TMDB simulé : réponses lentes, refus à la demande ----------

let inFlight = 0;
let maxInFlight = 0;
let calls: { path: string; cache?: RequestCache; at: number }[] = [];
/** Chemins refusés (429) la prochaine fois qu'ils sont demandés, avec ce Retry-After. */
const refuseOnce = new Map<string, string>();
/** Moment où chaque refus est vraiment renvoyé (et non pas supposé : machine chargée, réponses en retard). */
let refusedAt: Record<string, number> = {};
let delayMs = 20;
let failAll = false;

const fiche = (id: number) => ({
  id,
  genres: [{ id: 18, name: 'Drame' }],
  credits: { cast: [{ name: 'A', order: 0 }], crew: [{ name: 'R', job: 'Director' }] },
  videos: { results: [] },
  'watch/providers': { results: {} },
});

vi.stubGlobal('fetch', async (input: string | URL, init?: RequestInit) => {
  const url = new URL(String(input));
  const path = url.pathname.replace('/3', '');
  calls.push({ path, cache: init?.cache, at: Date.now() });
  inFlight++;
  maxInFlight = Math.max(maxInFlight, inFlight);
  try {
    await new Promise((r) => setTimeout(r, delayMs));
    if (failAll) return new Response('{}', { status: 500 });
    const refuse = refuseOnce.get(path);
    if (refuse !== undefined) {
      refuseOnce.delete(path);
      refusedAt[path] = Date.now();
      return new Response('{"status_code":25}', { status: 429, headers: { 'Retry-After': refuse } });
    }
    const id = Number(path.split('/').pop());
    return Response.json(path.startsWith('/discover') ? { page: 1, total_pages: 1, total_results: 0, results: [] } : fiche(id));
  } finally {
    inFlight--;
  }
});

beforeEach(async () => {
  await Promise.all([db.titles.clear(), db.answers.clear(), db.meta.clear(), db.details.clear()]);
  forgetCategories();
  inFlight = 0;
  maxInFlight = 0;
  calls = [];
  refuseOnce.clear();
  refusedAt = {};
  delayMs = 20;
  failAll = false;
});

const movies = (n: number, from = 1) => Array.from({ length: n }, (_, i) => makeTitle(from + i));

/** Temps d'exécution de `fn`, en ms. */
async function timed(fn: () => unknown | Promise<unknown>): Promise<number> {
  const t0 = performance.now();
  await fn();
  return performance.now() - t0;
}

describe('file des demandes à TMDB', () => {
  it(`300 fiches demandées d'un coup : jamais plus de ${MAX_IN_FLIGHT} demandes à la fois, une seule par titre`, async () => {
    const titles = movies(300);
    await db.titles.bulkPut(titles);
    await Promise.all(titles.map((t) => ensureDetails(t))); // comme 300 lignes affichées en même temps
    expect(maxInFlight).toBeLessThanOrEqual(MAX_IN_FLIGHT);
    expect(calls).toHaveLength(300);
    expect(await db.details.count()).toBe(300);
    expect(queueState()).toMatchObject({ inFlight: 0, waiting: 0 });
  });

  it('une fiche ouverte passe devant les fiches d’arrière-plan', async () => {
    // Réponses lentes, et fiche ouverte une fois la file d'arrière-plan vraiment pleine : sinon, sur une machine
    // chargée, des fiches d'arrière-plan finissaient pendant que la fiche ouverte lisait la base, et le test échouait
    // sans que la file soit en cause.
    delayMs = 150;
    const background = movies(60);
    const urgent = makeTitle(999);
    const all = prefetchDetails(background);
    await vi.waitFor(() => expect(queueState().waiting).toBeGreaterThan(0), { interval: 2 });
    const opened = ensureDetails(urgent); // fiche ouverte pendant le téléchargement de la wishlist
    await opened;
    const position = calls.findIndex((c) => c.path === '/movie/999');
    expect(position).toBeGreaterThanOrEqual(0);
    expect(position).toBeLessThanOrEqual(MAX_IN_FLIGHT + 1); // juste après les demandes déjà parties
    await all;
  });

  it('refus « trop de demandes » : toute la file attend le temps indiqué, au lieu de réessayer en boucle', async () => {
    const titles = movies(30);
    refuseOnce.set('/movie/1', '0.3'); // le serveur demande 300 ms de pause
    const t0 = Date.now();
    await Promise.all(titles.map((t) => ensureDetails(t)));
    expect(calls).toHaveLength(31); // 30 + un seul nouvel essai
    // Aucune demande pendant la pause (hors celles déjà parties au moment du refus). L'instant du refus est celui où
    // la réponse a vraiment été renvoyée : le supposer (départ + 20 ms) faisait échouer le test sur une machine chargée.
    const at = refusedAt['/movie/1'];
    const during = calls.filter((c) => c.at > at + 5 && c.at < at + 280);
    expect(during).toEqual([]);
    expect(Date.now() - t0).toBeGreaterThanOrEqual(300);
  });

  it('nouvel essai : sans la réponse gardée par le navigateur (refus marqués « à garder 24 h »)', async () => {
    refuseOnce.set('/movie/7', '0.05');
    await tmdb('/movie/7');
    expect(calls.map((c) => c.cache)).toEqual([undefined, 'reload']);
  });

  it('fiches en échec : pas redemandées en boucle par un écran qui se redessine', async () => {
    const titles = movies(20);
    failAll = true;
    await prefetchDetails(titles);
    expect(calls).toHaveLength(20);
    for (let i = 0; i < 5; i++) await prefetchDetails(titles); // la wishlist relancée à chaque écriture
    expect(calls).toHaveLength(20);
    // Une fiche ouverte (demande de l'écran) réessaie quand même.
    failAll = false;
    expect((await ensureDetails(titles[0]))?.directors).toEqual(['R']);
  });
});

describe('enregistrement des fiches', () => {
  it(`fiches arrivées ensemble : enregistrées en une écriture (pas une par fiche), au plus ${SAVE_BATCH_MS} ms après`, async () => {
    const titles = movies(100);
    await db.titles.bulkPut(titles);
    const bulkPut = vi.spyOn(db.details, 'bulkPut');
    const put = vi.spyOn(db.details, 'put');
    delayMs = 5;
    await Promise.all(titles.map((t) => ensureDetails(t)));
    expect(put).not.toHaveBeenCalled();
    expect(bulkPut.mock.calls.length).toBeLessThanOrEqual(5);
    expect(await db.details.count()).toBe(100);
    // Les repères sur les titres sont posés dans la même écriture.
    expect((await db.titles.get('movie:1'))?.detailsAt).toBeGreaterThan(0);
    bulkPut.mockRestore();
    put.mockRestore();
  });

  it('une lecture de la base affichée à l’écran n’est relancée que quelques fois pour 100 fiches', async () => {
    const { liveQuery } = await import('dexie');
    const titles = movies(100);
    await db.titles.bulkPut(titles);
    let runs = 0;
    const sub = liveQuery(() => db.details.bulkGet(titles.map((t) => t.key))).subscribe(() => runs++);
    await new Promise((r) => setTimeout(r, 50));
    const before = runs;
    delayMs = 5;
    await Promise.all(titles.map((t) => ensureDetails(t)));
    await new Promise((r) => setTimeout(r, 100));
    sub.unsubscribe();
    expect(runs - before).toBeLessThanOrEqual(6); // avant : une par fiche, donc 100
  });
});

// ---------- Budgets de temps des calculs ----------

const details = (i: number): Details => ({
  fetchedAt: Date.now(),
  directors: [`Réal ${i % 300}`],
  cast: [`Acteur ${i % 500}`, `Actrice ${i % 700}`],
  topCast: Array.from({ length: 8 }, (_, k) => `Rôle ${(i * 7 + k) % 900}`),
  genres: ['Drame'],
  genreIds: [18, 35],
  rating: 7,
  runtime: 110,
  providers: { flatrate: [], rent: [], buy: [], link: null },
  complete: true,
});

describe('budgets de temps', () => {
  it('stats d’un gros utilisateur (3 000 vus avec fiches, 14 000 titres) : moins de 3 s', async () => {
    const catalogue = movies(14_000).map((t, i) => ({ ...t, year: 1950 + (i % 75), voteCount: 14_000 - i, genreIds: [18, 35] }));
    await db.titles.bulkPut(catalogue);
    await db.details.bulkPut(catalogue.slice(0, 3000).map((t, i) => ({ ...details(i), key: t.key })));
    await db.answers.bulkPut(catalogue.slice(0, 3000).map((t) => ({ key: t.key, type: 'movie' as const, status: 'seen' as const, tier: 'good' as const, updatedAt: 1 })));
    const ms = await timed(computeStats);
    expect(ms).toBeLessThan(3000);
  }, 30_000);

  it('filtres du swipe sur 14 000 titres : moins de 150 ms', async () => {
    const catalogue: Title[] = movies(14_000).map((t, i) => ({ ...t, year: 1950 + (i % 75), genreIds: [i % 2 ? 18 : 35], originalLanguage: i % 3 ? 'en' : 'fr', rating: 5 + (i % 5) }));
    const theme = { ...NO_THEME, genre: 35, period: '1990', lang: 'fr', minRating: 6 };
    const ms = await timed(() => catalogue.filter((t) => matchesTheme(t, theme)));
    expect(ms).toBeLessThan(150);
  });

  it('tirage du swipe : 500 cartes tirées dans 14 000 titres en moins de 300 ms', async () => {
    const pool: Pool = { items: movies(14_000).map((t, i) => ({ title: t, w: 1 + (i % 100) })), total: 0 };
    pool.total = pool.items.reduce((s, x) => s + x.w, 0);
    const ms = await timed(() => {
      for (let i = 0; i < 500; i++) {
        const t = draw(pool);
        if (t) removeFromPool(pool, new Set([t.key]));
      }
    });
    expect(ms).toBeLessThan(300);
  });

  it('« À deux » avec 2 000 titres classés de chaque côté : moins de 500 ms', async () => {
    const keys = movies(2000).map((t) => t.key);
    const side = (ranking: string[]): Side => ({
      answers: new Map(keys.map((k, i) => [k, { status: i % 10 === 0 ? 'wish' : 'seen', tier: 'good' }] as const)),
      rankings: { movie: ranking, 'wish:movie': keys.filter((_, i) => i % 10 === 0) },
    });
    const me = side(keys);
    const them = side([...keys].reverse());
    const ms = await timed(() => {
      compatibility(me, them, 'movie');
      advice(me, them, 'movie', () => 'movie');
      commonWishlist(me, them, 'movie', () => 'movie');
    });
    expect(ms).toBeLessThan(500);
  });

  it('tier list de 5 000 titres : moins de 20 ms', async () => {
    const ms = await timed(() => tierize(movies(5000)));
    expect(ms).toBeLessThan(20);
  });

  it('synchro : comparaison de 10 000 lignes avec le compte en moins de 1 s', async () => {
    const local = new Map<string, Row>();
    const shadow = new Map<string, string>();
    const remote: Row[] = [];
    for (let i = 0; i < 10_000; i++) {
      const id = `a:movie:${i}`;
      local.set(id, { id, data: { status: 'seen', tier: 'good' }, at: 1000 + i });
      if (i % 2) shadow.set(id, '{"status":"seen","tier":"good"}');
      if (i % 3 === 0) remote.push({ id, data: { status: 'wish', tier: null }, at: 2000 + i });
    }
    const ms = await timed(() => plan(local, shadow, remote, Date.now()));
    expect(ms).toBeLessThan(1000);
  });

  it('enregistrer une réponse dans une base de 14 000 titres : moins de 50 ms', async () => {
    await db.titles.bulkPut(movies(14_000));
    const ms = await timed(() => setStatus(makeTitle(5), 'seen', 'good'));
    expect(ms).toBeLessThan(50);
  }, 30_000);
});
