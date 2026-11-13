import { db, withDetails, type Title } from './db';
import { categoryOf, mediaOf, type Category } from './category';
import { bestStreak, lastDays, loadActivity, streak, todayCount } from './activity';
import { readRanking } from './ranking';
import { genreName } from './genres';
import { detailsOutdated } from './tmdb';
import { LANG, num, T } from '../i18n';

export interface Bar {
  label: string;
  count: number;
}

export interface CategoryStats {
  seen: number;
  minutes: number; // temps passé (approximatif pour les séries)
  withDetails: number; // titres vus dont la fiche est connue
  decades: Bar[];
  genres: Bar[];
  people: Bar[]; // réalisateurs (films) ou créateurs (séries)
  actors: Bar[]; // acteurs (premiers rôles)
  top: { seen: number; total: number }; // couverture des titres les plus populaires
  ranked: number;
}

export interface Stats {
  movie: CategoryStats;
  tv: CategoryStats;
  anime: CategoryStats;
  wish: number;
  unseen: number;
  today: number;
  streak: number;
  bestStreak: number;
  bestDay: number;
  totalActions: number;
  last30: { date: Date; count: number }[];
  sagas: string[]; // sagas entièrement vues (badges)
  activeDays: number; // jours avec au moins un tri
  good: number; // titres vus et aimés (👍)
  wishRanked: number; // titres priorisés dans la wishlist
  /** Pour les badges : découverte et curiosités, sur tous les titres vus. */
  discovery: {
    languages: number; // langues originales différentes
    local: number; // titres dans la langue de l'interface (en anglais : titres qui ne sont pas en anglais)
    movieGenres: number; // genres de films différents
    oldFilms: number; // films d'avant 1960
    recent: number; // titres sortis cette année ou l'an dernier
    highRated: number; // titres notés 8 ou plus sur TMDB
    lowRated: number; // titres notés moins de 5 sur TMDB (nanars)
    longFilms: number; // films de 3 h ou plus
    episodes: number; // épisodes de séries et d'animes
    maxDirector: number; // films du réalisateur le plus vu
    maxActor: number; // titres de l'acteur le plus vu (une catégorie)
  };
  missingDetails: Title[]; // titres vus sans fiche, ou fiche ancienne (pour compléter les stats)
}

export const TOP_SIZE: Record<Category, number> = { movie: 250, tv: 100, anime: 50 };

// Les titres les plus populaires changent peu : calculés une fois par session.
const topCache = new Map<Category, Promise<string[]>>();
function topKeys(type: Category): Promise<string[]> {
  let p = topCache.get(type);
  if (!p) {
    p = db.titles
      .where('type')
      .equals(mediaOf(type))
      .toArray()
      .then((all) =>
        all
          .filter((t) => !t.manual && categoryOf(t) === type)
          .sort((a, b) => b.voteCount - a.voteCount)
          .slice(0, TOP_SIZE[type])
          .map((t) => t.key),
      );
    topCache.set(type, p);
  }
  return p;
}

const count = (values: string[], limit: number): Bar[] => {
  const m = new Map<string, number>();
  for (const v of values) m.set(v, (m.get(v) ?? 0) + 1);
  return [...m.entries()]
    .map(([label, n]) => ({ label, count: n }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
};

function minutesOf(t: Title): number {
  const d = t.details;
  if (!d?.runtime) return 0;
  return t.type === 'movie' ? d.runtime : d.runtime * (d.episodes ?? 0);
}

async function categoryStats(category: Category, seen: Title[]): Promise<CategoryStats> {
  const seenKeys = new Set(seen.map((t) => t.key));
  const top = await topKeys(category);
  const decades = new Map<number, number>();
  for (const t of seen) if (t.year) decades.set(Math.floor(t.year / 10) * 10, (decades.get(Math.floor(t.year / 10) * 10) ?? 0) + 1);

  return {
    seen: seen.length,
    minutes: seen.reduce((s, t) => s + minutesOf(t), 0),
    withDetails: seen.filter((t) => t.details).length,
    decades: [...decades.entries()].sort((a, b) => a[0] - b[0]).map(([d, n]) => ({ label: d < 2000 ? `${String(d).slice(2)}s` : `${d}s`, count: n })),
    genres: count(
      seen.flatMap((t) => (t.genreIds?.length ? t.genreIds.map((g) => genreName(mediaOf(category), g)).filter(Boolean) : (t.details?.genres ?? []))),
      8,
    ),
    people: count(
      seen.flatMap((t) => t.details?.directors ?? []),
      5,
    ).filter((b) => b.count > 1),
    actors: count(
      seen.flatMap((t) => t.details?.topCast ?? t.details?.cast ?? []),
      5,
    ).filter((b) => b.count > 1),
    top: { seen: top.filter((k) => seenKeys.has(k)).length, total: top.length },
    ranked: (await readRanking({ category, list: 'seen' })).length,
  };
}

export async function computeStats(): Promise<Stats> {
  const [answers, activity, sagaRows, wishRankings] = await Promise.all([
    db.answers.toArray(),
    loadActivity(),
    db.meta.where('key').startsWith('saga:').toArray(),
    Promise.all((['movie', 'tv', 'anime'] as const).map((category) => readRanking({ category, list: 'wish' }))),
  ]);
  const seenAnswers = answers.filter((a) => a.status === 'seen');
  const seenTitles = await withDetails((await db.titles.bulkGet(seenAnswers.map((a) => a.key))).filter((t): t is Title => !!t));
  const seenKeys = new Set(seenTitles.map((t) => t.key));
  const [movie, tv, anime] = await Promise.all(
    (['movie', 'tv', 'anime'] as const).map((c) => categoryStats(c, seenTitles.filter((t) => categoryOf(t) === c))),
  );

  const sagas = sagaRows
    .map((r) => r.value as { name: string; keys: string[] })
    .filter((s) => s.keys.length >= 2 && s.keys.every((k) => seenKeys.has(k)))
    .map((s) => s.name);

  const year = new Date().getFullYear();
  const movies = seenTitles.filter((t) => t.type === 'movie');
  const language = (t: Title) => t.originalLanguage ?? t.details?.originalLanguage;
  const discovery: Stats['discovery'] = {
    languages: new Set(seenTitles.map(language).filter(Boolean)).size,
    local: seenTitles.filter((t) => (LANG === 'en' ? !!language(t) && language(t) !== 'en' : language(t) === LANG)).length,
    movieGenres: new Set(movies.flatMap((t) => t.genreIds ?? t.details?.genreIds ?? [])).size,
    oldFilms: movies.filter((t) => t.year && t.year < 1960).length,
    recent: seenTitles.filter((t) => t.year && t.year >= year - 1).length,
    highRated: seenTitles.filter((t) => (t.rating ?? t.details?.rating ?? 0) >= 8).length,
    lowRated: seenTitles.filter((t) => {
      const r = t.rating ?? t.details?.rating ?? 0;
      return r > 0 && r < 5; // 0 : pas de note
    }).length,
    longFilms: movies.filter((t) => (t.details?.runtime ?? 0) >= 180).length,
    episodes: seenTitles.reduce((n, t) => n + (t.type === 'tv' ? (t.details?.episodes ?? 0) : 0), 0),
    maxDirector: movie.people[0]?.count ?? 0,
    maxActor: Math.max(0, ...[movie, tv, anime].map((c) => c.actors[0]?.count ?? 0)),
  };

  return {
    movie,
    tv,
    anime,
    wish: answers.filter((a) => a.status === 'wish').length,
    unseen: answers.filter((a) => a.status === 'unseen').length,
    today: todayCount(activity),
    streak: streak(activity),
    bestStreak: bestStreak(activity),
    bestDay: Math.max(0, ...Object.values(activity)),
    totalActions: Object.values(activity).reduce((s, n) => s + n, 0),
    last30: lastDays(activity, 30),
    sagas,
    activeDays: Object.values(activity).filter((n) => n > 0).length,
    good: seenAnswers.filter((a) => a.tier === 'good').length,
    wishRanked: wishRankings.reduce((n, r) => n + r.length, 0),
    discovery,
    missingDetails: seenTitles.filter((t) => detailsOutdated(t.details)),
  };
}

export function formatHours(minutes: number): string {
  const h = Math.round(minutes / 60);
  if (h < 48) return T.stats.hours(num(h));
  return T.stats.hoursAndDays(num(h), Math.floor(h / 24));
}
