import 'fake-indexeddb/auto';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// L'appli branchée sur le vrai code du relais (worker/), avec TMDB simulé : chaque appel de l'appli doit être
// relayé (un chemin oublié dans ROUTES = recherche par personne en panne), et la fiche détaillée doit revenir
// complète (réalisateur, acteurs, plateformes, bande-annonce).
const RELAY = 'https://relais.test';
vi.hoisted(() => {
  vi.stubEnv('VITE_TMDB_RELAY', 'https://relais.test');
  const store = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, String(v)),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
  });
});

import worker from '../worker/src/index.js';
import { ROUTES } from '../worker/src/routes.js';
import { db } from '../src/lib/db';
import { getUserToken, setToken } from '../src/lib/settings';
import { detailsOutdated, ensureDetails, fetchProviderOptions, fetchSaga, personFilmography, search, searchPeople, tmdb } from '../src/lib/tmdb';
import { boostFrom } from '../src/lib/recommend';
import { addNewTitles, syncCatalogue } from '../src/lib/sync';
import { DEFAULT_MIN_VOTES } from '../src/lib/settings';
import { makeTitle } from './helpers';

// ---------- TMDB simulé ----------

const film = (id: number, date = '2010-01-01') => ({ id, title: `Film ${id}`, original_title: `Film ${id}`, release_date: date, poster_path: null, vote_count: 5000, genre_ids: [18], original_language: 'en', media_type: 'movie' });
/** Titres de ce numéro : TMDB ignore append_to_response (réponse sans casting ni plateformes). */
const BARE = 900;

function fakeTmdb(url: URL): unknown {
  const p = url.pathname.replace('/3', '');
  let m: RegExpMatchArray | null;
  if ((m = p.match(/^\/discover\/(movie|tv)$/))) {
    const recent = (url.searchParams.get('primary_release_date.gte') ?? url.searchParams.get('first_air_date.gte') ?? '') >= '2020';
    return { page: 1, total_pages: 1, total_results: 1, results: [m[1] === 'movie' ? film(recent ? 2 : 1, recent ? '2026-06-01' : '2010-01-01') : { id: 3, name: 'Série', first_air_date: '2012-01-01', poster_path: null, vote_count: 500, genre_ids: [18], original_language: 'en' }] };
  }
  if ((m = p.match(/^\/(movie|tv)\/(\d+)$/))) {
    const append = (url.searchParams.get('append_to_response') ?? '').split(',');
    const res: Record<string, unknown> = { id: Number(m[2]), genres: [{ id: 18, name: 'Drame' }], original_language: 'en', vote_average: 8.4, runtime: 139 };
    if (Number(m[2]) === BARE) return res;
    if (m[1] === 'tv') res.created_by = [{ name: 'Créatrice' }];
    if (append.includes('credits')) res.credits = { cast: [{ name: 'Brad Pitt', order: 1 }, { name: 'Edward Norton', order: 0 }, { name: 'Helena Bonham Carter', order: 2 }], crew: [{ name: 'David Fincher', job: 'Director' }] };
    if (append.includes('videos')) res.videos = { results: [{ key: 'yt-fr', site: 'YouTube', type: 'Trailer', iso_639_1: 'fr', official: true }] };
    if (append.includes('watch/providers')) res['watch/providers'] = { results: { FR: { link: 'https://justwatch', flatrate: [{ provider_id: 8, provider_name: 'Netflix', logo_path: '/n.png' }] } } };
    return res;
  }
  if (/^\/(movie|tv)\/\d+\/recommendations$/.test(p)) return { page: 1, total_pages: 1, total_results: 1, results: [film(20)] };
  if (/^\/collection\/\d+$/.test(p)) return { name: 'Saga', parts: [film(30, '2001-01-01'), film(31, '2003-01-01')] };
  if (/^\/watch\/providers\/(movie|tv)$/.test(p)) return { results: [{ provider_id: 8, provider_name: 'Netflix', logo_path: '/n.png', display_priorities: { FR: 1 } }] };
  if (p === '/search/person') return { results: [{ id: 525, name: 'Christopher Nolan', profile_path: null, known_for_department: 'Directing', known_for: [film(40)] }] };
  if (/^\/person\/\d+\/combined_credits$/.test(p)) return { cast: [], crew: [{ ...film(41), job: 'Director' }] };
  if (p === '/search/multi') return { page: 1, total_pages: 1, total_results: 1, results: [film(50)] };
  return null;
}

/** Ce qui est arrivé au relais (chemin, réponse) et chez TMDB (adresse, clé utilisée). */
let relayed: { path: string; status: number }[] = [];
let upstream: { url: URL; auth: string }[] = [];
const cache = new Map<string, Response>();
vi.stubGlobal('caches', { default: { match: async (r: Request) => cache.get(r.url)?.clone(), put: async (r: Request, res: Response) => void cache.set(r.url, res) } });
const env = { TMDB_TOKEN: 'cle-du-relais' };
const ctx = { waitUntil: () => undefined };

vi.stubGlobal('fetch', async (input: string | URL | Request, init?: RequestInit) => {
  const url = new URL(input instanceof Request ? input.url : String(input));
  const headers = new Headers(input instanceof Request ? input.headers : init?.headers);
  if (url.origin === RELAY) {
    // Le navigateur ajoute l'origine du site.
    const res = await worker.fetch(new Request(url, { headers: { ...Object.fromEntries(headers), Origin: 'https://daviddza.github.io' } }), env, ctx);
    relayed.push({ path: url.pathname, status: res.status });
    return res;
  }
  if (url.origin === 'https://api.themoviedb.org') {
    const auth = headers.get('Authorization') ?? '';
    upstream.push({ url, auth });
    if (auth !== 'Bearer cle-du-relais' && auth !== 'Bearer cle-valide') return new Response('{}', { status: 401 });
    const body = fakeTmdb(url);
    return body ? Response.json(body) : new Response('{}', { status: 404 });
  }
  throw new Error(`Adresse inattendue : ${url}`);
});

beforeEach(async () => {
  relayed = [];
  upstream = [];
  cache.clear();
  localStorage.clear();
  await Promise.all([db.titles.clear(), db.answers.clear(), db.meta.clear(), db.details.clear()]);
});

// ---------- Chemins ----------

/** Appels TMDB écrits dans le code de l'appli (`tmdb<…>('/chemin…'`), variables remplacées par un exemple. */
function appPaths(): string[] {
  const files: string[] = [];
  const walk = (dir: string) => {
    for (const f of readdirSync(dir)) {
      const full = join(dir, f);
      if (statSync(full).isDirectory()) walk(full);
      else if (/\.tsx?$/.test(f)) files.push(full);
    }
  };
  walk(join(__dirname, '../src'));
  const paths = new Set<string>();
  for (const f of files) {
    for (const m of readFileSync(f, 'utf8').matchAll(/\btmdb(?:<[\s\S]*?>)?\(\s*([`'"])(\/[^`'"]*)\1/g)) {
      paths.add(m[2].replace(/\$\{([^}]*)\}/g, (_, expr: string) => (/type/i.test(expr) ? 'movie' : '123')));
    }
  }
  return [...paths];
}

describe('relais TMDB : chemins', () => {
  // Seule la vérification d'une clé personnelle (Réglages → Clé TMDB) va directement chez TMDB, jamais au relais.
  const DIRECT_ONLY = ['/authentication'];

  it('chaque appel TMDB de l’appli est accepté par le relais', () => {
    const paths = appPaths();
    expect(paths).toEqual(expect.arrayContaining(['/discover/movie', '/movie/123', '/search/person', '/search/multi', '/collection/123']));
    const refused = paths.filter((p) => !DIRECT_ONLY.includes(p) && !ROUTES.some(([pattern]) => pattern.test(p)));
    expect(refused).toEqual([]);
  });

  it('toutes les fonctions TMDB de l’appli passent par le relais, sans refus', async () => {
    const title = makeTitle(550);
    await db.titles.put(title);
    expect((await ensureDetails(title))?.directors).toEqual(['David Fincher']);
    expect((await fetchSaga(10))?.parts).toHaveLength(2);
    expect(await fetchProviderOptions()).toHaveLength(1);
    expect((await searchPeople('nolan', 'director'))[0].name).toBe('Christopher Nolan');
    expect(await personFilmography(525, 'director')).toHaveLength(1);
    expect(await search('fight')).toHaveLength(1);
    expect(await boostFrom(title)).toHaveLength(1);
    await syncCatalogue(DEFAULT_MIN_VOTES, () => undefined);
    await addNewTitles(DEFAULT_MIN_VOTES);
    expect(relayed.length).toBeGreaterThan(10);
    expect(relayed.filter((r) => r.status !== 200)).toEqual([]);
    expect(upstream.every((u) => u.auth === 'Bearer cle-du-relais')).toBe(true); // la clé du relais, jamais celle du site
  });
});

// ---------- Fiche détaillée ----------

describe('relais TMDB : fiche détaillée', () => {
  it('film : réalisateur, 2 acteurs principaux, bande-annonce YouTube et plateformes', async () => {
    const d = await ensureDetails(makeTitle(551));
    expect(d).toMatchObject({
      directors: ['David Fincher'],
      cast: ['Edward Norton', 'Brad Pitt'],
      trailer: 'yt-fr',
      providers: { flatrate: [{ id: 8, name: 'Netflix', logo: '/n.png' }], link: 'https://justwatch' },
      complete: true,
    });
    // append_to_response arrive intact chez TMDB.
    expect(upstream[0].url.searchParams.get('append_to_response')).toBe('credits,videos,watch/providers');
    expect((await db.details.get('movie:551'))?.cast).toEqual(['Edward Norton', 'Brad Pitt']);
  });

  it('série : créatrice et acteurs', async () => {
    const d = await ensureDetails(makeTitle(1399, {}, 'tv'));
    expect(d).toMatchObject({ directors: ['Créatrice'], cast: ['Edward Norton', 'Brad Pitt'], complete: true });
  });

  it('fiche enregistrée vide (sans aucun nom) : récupérée à nouveau', async () => {
    const empty = { key: 'movie:552', fetchedAt: Date.now(), directors: [], cast: [], topCast: [], genres: ['Drame'], genreIds: [18], rating: 8, runtime: 139, trailer: null, providers: { flatrate: [], rent: [], buy: [], link: null } };
    await db.details.put(empty);
    expect(detailsOutdated(empty)).toBe(true);
    const d = await ensureDetails(makeTitle(552));
    expect(d).toMatchObject({ directors: ['David Fincher'], trailer: 'yt-fr', complete: true });
    expect((await db.details.get('movie:552'))?.directors).toEqual(['David Fincher']);
  });

  it('ancienne fiche avec des noms : gardée, pas redemandée', async () => {
    const old = { key: 'movie:553', fetchedAt: Date.now(), directors: ['Quelqu’un'], cast: ['A', 'B'], topCast: ['A', 'B'], genres: [], genreIds: [18], rating: 7, runtime: 90, trailer: null, providers: { flatrate: [], rent: [], buy: [], link: null } };
    await db.details.put(old);
    expect(detailsOutdated(old)).toBe(false);
    expect((await ensureDetails(makeTitle(553)))?.directors).toEqual(['Quelqu’un']);
    expect(upstream).toHaveLength(0);
  });

  it('réponse sans casting ni plateformes : pas enregistrée, redemandée la fois suivante', async () => {
    const d = await ensureDetails(makeTitle(BARE));
    expect(d).toMatchObject({ directors: [], complete: false });
    expect(await db.details.get(`movie:${BARE}`)).toBeUndefined();
    await ensureDetails(makeTitle(BARE));
    expect(relayed).toHaveLength(2); // redemandée par l'appli (le relais peut la servir de son cache)
  });
});

// ---------- Clé personnelle ----------

describe('relais TMDB : clé personnelle', () => {
  it('clé refusée par TMDB (régénérée) : oubliée, le relais prend le relais', async () => {
    setToken('ancienne-cle');
    const d = await ensureDetails(makeTitle(554));
    expect(d?.directors).toEqual(['David Fincher']);
    expect(getUserToken()).toBeNull();
    expect(upstream.map((u) => u.auth)).toEqual(['Bearer ancienne-cle', 'Bearer cle-du-relais']);
  });

  it('clé valide : appel direct à TMDB, sans le relais', async () => {
    setToken('cle-valide');
    expect((await ensureDetails(makeTitle(555)))?.directors).toEqual(['David Fincher']);
    expect(relayed).toHaveLength(0);
    expect(getUserToken()).toBe('cle-valide');
  });

  it('clé essayée dans les réglages et refusée : signalée, rien d’oublié', async () => {
    setToken('cle-valide');
    await expect(tmdb('/authentication', {}, { token: 'mauvaise-cle' })).rejects.toMatchObject({ status: 401 });
    expect(getUserToken()).toBe('cle-valide');
  });
});
