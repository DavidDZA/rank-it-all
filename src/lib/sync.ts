import { db, setMeta, type MediaType, type Title } from './db';
import { EXCLUDED_GENRES, isAnimeResult, isExcluded, tmdb, toTitle, type Page, type RawResult } from './tmdb';
import type { MinVotes } from './settings';
import { forgetCategories, isAnimeTitle } from './category';
import { customImportLabel, getCustomImports, type CustomImport } from './customImports';

const MAX_PAGES = 500; // limite imposée par TMDB sur /discover
const CONCURRENCY = 6;
const DAY = 86_400_000;

const iso = (t: number) => new Date(t).toISOString().slice(0, 10);

/** Une requête /discover : un type, un seuil de votes, et des filtres TMDB en plus (langue, période). */
export interface Query {
  type: MediaType;
  minVotes: number;
  label: string; // pour la progression : « films », « films en français »…
  extra?: Record<string, string>;
  /** Première date de sortie ; par défaut, depuis 1870. */
  since?: number;
  /** Dernière date de sortie (films anciens) ; par défaut, jusqu'à l'an prochain. */
  until?: number;
  /** Tri plus fin après coup (séries et animes ont chacun leur seuil). */
  accept?: (r: RawResult) => boolean;
}

function discover(q: Query, from: number, to: number, page: number) {
  const dateField = q.type === 'movie' ? 'primary_release_date' : 'first_air_date';
  return tmdb<Page>(`/discover/${q.type}`, {
    sort_by: 'vote_count.desc',
    'vote_count.gte': q.minVotes,
    include_adult: false,
    without_genres: EXCLUDED_GENRES[q.type].join(','),
    [`${dateField}.gte`]: iso(from),
    [`${dateField}.lte`]: iso(to),
    page,
    ...(q.type === 'movie' ? { 'with_runtime.gte': 40 } : {}),
    ...q.extra,
  });
}

interface Range {
  from: number;
  to: number;
  first: Page;
}

/** Découpe la période en tranches de moins de 500 pages pour contourner la limite de TMDB. */
async function splitRanges(q: Query, from: number, to: number): Promise<Range[]> {
  const first = await discover(q, from, to, 1);
  if (first.total_pages > MAX_PAGES && to - from > DAY) {
    const mid = from + Math.floor((to - from) / 2 / DAY) * DAY;
    return [...(await splitRanges(q, from, mid)), ...(await splitRanges(q, mid + DAY, to))];
  }
  return [{ from, to, first }];
}

const since = (q: Query) => q.since ?? Date.UTC(1870, 0, 1);
const until = (q: Query) => q.until ?? Date.UTC(new Date().getUTCFullYear() + 1, 11, 31);

async function runPool(tasks: (() => Promise<void>)[], concurrency: number) {
  let next = 0;
  const worker = async () => {
    while (next < tasks.length) await tasks[next++]();
  };
  await Promise.all(Array.from({ length: concurrency }, worker));
}

/** Progression : message, et part du travail faite (0 à 1) quand on la connaît. */
export type Progress = (message: string, done?: number) => void;

/** Une requête prête à être téléchargée : ses tranches de dates, et son nombre de pages. */
interface Prepared {
  q: Query;
  ranges: Range[];
  pages: number;
}

async function prepare(q: Query, onProgress: Progress): Promise<Prepared> {
  onProgress(`Préparation des ${q.label}…`, 0);
  const ranges = await splitRanges(q, since(q), until(q));
  return { q, ranges, pages: ranges.reduce((n, r) => n + Math.min(r.first.total_pages, MAX_PAGES), 0) };
}

/** Prépare toutes les requêtes, puis les télécharge ; `seen` reçoit les clés des titres (un titre trouvé deux fois compte une fois). */
async function fetchQueries(queries: Query[], onProgress: Progress, seen: Set<string>): Promise<void> {
  const prepared: Prepared[] = [];
  for (const q of queries) prepared.push(await prepare(q, onProgress));
  const total = Math.max(1, prepared.reduce((n, p) => n + p.pages, 0));
  let fetched = 0;
  for (const p of prepared) {
    await fetchPrepared(p, seen, (count) => {
      fetched++;
      onProgress(`${count.toLocaleString('fr-FR')} ${p.q.label} récupérés…`, fetched / total);
    });
  }
}

/** Télécharge les pages d'une requête préparée ; `onPage` reçoit, à chaque page lue, le nombre de titres gardés. */
async function fetchPrepared({ q, ranges }: Prepared, seen: Set<string>, onPage: (count: number) => void): Promise<void> {
  let buffer: Title[] = [];
  let count = 0;
  const keep = (page: Page) => {
    for (const r of page.results) if (!isExcluded(q.type, r) && (!q.accept || q.accept(r))) buffer.push(toTitle(q.type, r));
  };
  const flush = async () => {
    const batch = buffer;
    buffer = [];
    batch.forEach((t) => seen.add(t.key));
    // Conserve les repères des fiches déjà lues (les fiches elles-mêmes sont rangées à part).
    const existing = await db.titles.bulkGet(batch.map((t) => t.key));
    batch.forEach((t, i) => {
      const e = existing[i];
      if (e?.detailsAt !== undefined) t.detailsAt = e.detailsAt;
      if (e?.collectionId !== undefined) t.collectionId = e.collectionId;
    });
    await db.titles.bulkPut(batch);
  };
  const read = (page: Page) => {
    const before = buffer.length;
    keep(page);
    count += buffer.length - before;
    onPage(count);
  };

  const tasks: (() => Promise<void>)[] = [];
  for (const range of ranges) {
    read(range.first);
    const pages = Math.min(range.first.total_pages, MAX_PAGES);
    for (let p = 2; p <= pages; p++) {
      tasks.push(async () => {
        read(await discover(q, range.from, range.to, p));
        if (buffer.length >= 500) await flush();
      });
    }
  }
  await runPool(tasks, CONCURRENCY);
  await flush();
}

/** Les films sortis avant cette date ont leur propre seuil (moins de votes sur TMDB, plus récent qu'eux). */
export const OLD_MOVIES_BEFORE = 1980;

/**
 * Requêtes du catalogue : chaque seuil a la sienne, et un titre est gardé s'il passe l'une d'elles.
 * Les titres en français et les vieux films ont un seuil plus bas : ils ont moins de votes sur TMDB,
 * surtout utilisé par un public international.
 */
export function catalogueQueries(v: MinVotes): Query[] {
  const fr = { with_original_language: 'fr' };
  return [
    { type: 'movie', minVotes: v.movie, label: 'films' },
    { type: 'movie', minVotes: v.frMovie, label: 'films en français', extra: fr },
    { type: 'movie', minVotes: v.oldMovie, label: `films d’avant ${OLD_MOVIES_BEFORE}`, until: Date.UTC(OLD_MOVIES_BEFORE - 1, 11, 31) },
    // Séries et animes viennent de la même liste TMDB : le plus bas des deux seuils, puis tri.
    {
      type: 'tv',
      minVotes: Math.min(v.tv, v.anime),
      label: 'séries et animes',
      accept: (r) => (r.vote_count ?? 0) >= (isAnimeResult(r) ? v.anime : v.tv),
    },
    { type: 'tv', minVotes: v.frTv, label: 'séries en français', extra: fr },
  ];
}

/** Requête d'un import sur mesure (films) : ses critères deviennent des filtres TMDB. */
export function customQuery(c: CustomImport): Query {
  const extra: Record<string, string> = {};
  if (c.genre !== null) extra.with_genres = String(c.genre);
  if (c.lang) extra.with_original_language = c.lang;
  if (c.country) extra.with_origin_country = c.country;
  return {
    type: 'movie',
    minVotes: c.minVotes,
    label: `films « ${customImportLabel(c)} »`,
    extra,
    since: c.from !== null ? Date.UTC(c.from, 0, 1) : undefined,
    until: c.to !== null ? Date.UTC(c.to, 11, 31) : undefined,
  };
}

/** Nombre de films d'un import sur mesure chez TMDB (avant exclusions), pour aider à régler le seuil. */
export async function countCustom(c: CustomImport): Promise<number> {
  const q = customQuery(c);
  return (await discover(q, since(q), until(q), 1)).total_results;
}

/** Lance un import sur mesure tout de suite : films trouvés, et combien n'étaient pas encore au catalogue. */
export async function importCustom(c: CustomImport, onProgress: Progress): Promise<{ found: number; added: number }> {
  const movies = () => db.titles.where('type').equals('movie').count();
  const before = await movies();
  const found = new Set<string>();
  await fetchQueries([customQuery(c)], onProgress, found);
  return { found: found.size, added: (await movies()) - before };
}

/**
 * Supprime les titres absents du nouveau téléchargement (seuil de votes relevé, ajout manuel…),
 * sauf ceux qu'on a vus ou mis dans sa wishlist : ils restent, avec leur place dans les classements.
 * Les titres jamais triés ou marqués « pas vu / pas envie » partent, avec leur réponse.
 */
async function removeMissing(seen: Set<string>): Promise<number> {
  return db.transaction('rw', db.titles, db.answers, db.details, async () => {
    const kept = new Set(await db.answers.where('status').anyOf('seen', 'wish').primaryKeys());
    const keys = await db.titles.filter((t) => !seen.has(t.key) && !kept.has(t.key)).primaryKeys();
    await db.titles.bulkDelete(keys);
    await db.answers.bulkDelete(keys);
    await db.details.bulkDelete(keys);
    return keys.length;
  });
}

/**
 * Télécharge ou met à jour le catalogue, imports sur mesure compris. Les titres qui n'en font plus partie
 * sont supprimés, sauf ceux déjà vus ou dans la wishlist (ajouts manuels compris).
 */
export async function syncCatalogue(minVotes: MinVotes, onProgress: Progress): Promise<{ movie: number; tv: number; anime: number; removed: number }> {
  const seen = new Set<string>();
  const queries = [...catalogueQueries(minVotes), ...(await getCustomImports()).map(customQuery)];
  await fetchQueries(queries, onProgress, seen);
  const removed = await removeMissing(seen);
  forgetCategories();
  await setMeta('lastSync', Date.now());
  await db.meta.put({ key: NEW_TITLES_META, value: { checkedAt: Date.now(), addedAt: Date.now() } satisfies NewTitlesCheck });
  // Décompte par catégorie, sur les titres gardés.
  const series = await db.titles.where('type').equals('tv').toArray();
  const anime = series.filter(isAnimeTitle).length;
  const movie = [...seen].filter((k) => k.startsWith('movie:')).length;
  return { movie, tv: series.length - anime, anime, removed };
}

// ---------- Nouveautés (au démarrage) ----------

/** Les nouveautés sont cherchées parmi les titres sortis depuis ce temps (ceux qui viennent de passer un seuil). */
export const NEW_TITLES_WINDOW = 2 * 365 * DAY;
/** Au plus une recherche de nouveautés par jour. */
export const NEW_TITLES_EVERY = DAY;

/** Meta propre à l'appareil : dernière recherche de nouveautés, et dernière fois qu'elle a ajouté des titres. */
export const NEW_TITLES_META = 'new-titles';
export interface NewTitlesCheck {
  checkedAt: number;
  addedAt: number;
}

/** Les requêtes du catalogue, réduites aux titres sortis depuis `from` (celles qui s'arrêtent avant sont retirées). */
export function recentQueries(queries: Query[], from: number): Query[] {
  return queries.filter((q) => until(q) >= from).map((q) => ({ ...q, since: Math.max(since(q), from) }));
}

/**
 * Ajoute au catalogue les titres récents qui passent désormais un seuil (mêmes requêtes que le catalogue, sur les
 * deux dernières années : quelques dizaines de demandes au lieu de 900). Ne supprime rien : c'est le rôle de la mise
 * à jour complète. Renvoie le nombre de titres ajoutés.
 */
export async function addNewTitles(minVotes: MinVotes, now = Date.now()): Promise<number> {
  const before = await db.titles.count();
  const queries = recentQueries([...catalogueQueries(minVotes), ...(await getCustomImports()).map(customQuery)], now - NEW_TITLES_WINDOW);
  await fetchQueries(queries, () => undefined, new Set());
  const added = (await db.titles.count()) - before;
  const previous = (await db.meta.get(NEW_TITLES_META))?.value as NewTitlesCheck | undefined;
  await db.meta.put({ key: NEW_TITLES_META, value: { checkedAt: now, addedAt: added ? now : (previous?.addedAt ?? 0) } satisfies NewTitlesCheck });
  if (added) forgetCategories();
  return added;
}
