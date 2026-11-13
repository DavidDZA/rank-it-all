import { getMeta, setMeta } from './db';
import { computeStats, type Stats } from './stats';
import { burst, toast } from './fun';
import { T } from '../i18n';

interface BadgeRule {
  id: keyof typeof T.badges;
  emoji: string;
  target: number;
  value: (s: Stats) => number;
}

/** Un badge, avec son nom et sa description dans la langue de l'interface. */
export type Badge = BadgeRule & { name: string; desc: string };

const seenAll = (s: Stats) => s.movie.seen + s.tv.seen + s.anime.seen;
const rankedAll = (s: Stats) => s.movie.ranked + s.tv.ranked + s.anime.ranked;
const hours = (s: Stats) => Math.floor((s.movie.minutes + s.tv.minutes + s.anime.minutes) / 60);

/** 51 badges (3 par ligne), par thème, dans l'ordre d'affichage. */
const RULES: BadgeRule[] = [
  // Films
  { id: 'first', emoji: '🎬', target: 1, value: seenAll },
  { id: 'films25', emoji: '🎟️', target: 25, value: (s) => s.movie.seen },
  { id: 'films100', emoji: '🍿', target: 100, value: (s) => s.movie.seen },
  { id: 'films250', emoji: '🎞️', target: 250, value: (s) => s.movie.seen },
  { id: 'films500', emoji: '🏛️', target: 500, value: (s) => s.movie.seen },
  { id: 'films1000', emoji: '👑', target: 1000, value: (s) => s.movie.seen },
  { id: 'top250', emoji: '⭐', target: 125, value: (s) => s.movie.top.seen },
  // Séries et animes
  { id: 'series10', emoji: '📡', target: 10, value: (s) => s.tv.seen },
  { id: 'series25', emoji: '📺', target: 25, value: (s) => s.tv.seen },
  { id: 'series100', emoji: '🛋️', target: 100, value: (s) => s.tv.seen },
  { id: 'series250', emoji: '🗼', target: 250, value: (s) => s.tv.seen },
  { id: 'toptv', emoji: '🧠', target: 50, value: (s) => s.tv.top.seen },
  { id: 'episodes1000', emoji: '📼', target: 1000, value: (s) => s.discovery.episodes },
  { id: 'anime5', emoji: '🍥', target: 5, value: (s) => s.anime.seen },
  { id: 'anime25', emoji: '🎌', target: 25, value: (s) => s.anime.seen },
  { id: 'anime100', emoji: '🐉', target: 100, value: (s) => s.anime.seen },
  { id: 'topanime', emoji: '⛩️', target: 25, value: (s) => s.anime.top.seen },
  // Tri et régularité
  { id: 'sort100', emoji: '🃏', target: 100, value: (s) => s.totalActions },
  { id: 'sort1000', emoji: '🗃️', target: 1000, value: (s) => s.totalActions },
  { id: 'day50', emoji: '🚀', target: 50, value: (s) => s.bestDay },
  { id: 'day100', emoji: '⚡', target: 100, value: (s) => s.bestDay },
  { id: 'streak3', emoji: '✨', target: 3, value: (s) => s.bestStreak },
  { id: 'streak7', emoji: '🔥', target: 7, value: (s) => s.bestStreak },
  { id: 'streak30', emoji: '☄️', target: 30, value: (s) => s.bestStreak },
  { id: 'streak100', emoji: '🗿', target: 100, value: (s) => s.bestStreak },
  { id: 'days30', emoji: '📆', target: 30, value: (s) => s.activeDays },
  { id: 'days100', emoji: '🎖️', target: 100, value: (s) => s.activeDays },
  // Classement
  { id: 'ranked10', emoji: '⚖️', target: 10, value: rankedAll },
  { id: 'ranked50', emoji: '🏆', target: 50, value: rankedAll },
  { id: 'ranked200', emoji: '📜', target: 200, value: rankedAll },
  { id: 'good50', emoji: '👍', target: 50, value: (s) => s.good },
  { id: 'good200', emoji: '❤️‍🔥', target: 200, value: (s) => s.good },
  // Wishlist
  { id: 'wish25', emoji: '💖', target: 25, value: (s) => s.wish },
  { id: 'wish100', emoji: '🎁', target: 100, value: (s) => s.wish },
  { id: 'wishRanked10', emoji: '🎯', target: 10, value: (s) => s.wishRanked },
  // Temps devant l'écran
  { id: 'hours100', emoji: '⏳', target: 100, value: hours },
  { id: 'hours500', emoji: '🌙', target: 500, value: hours },
  { id: 'long5', emoji: '🏃', target: 5, value: (s) => s.discovery.longFilms },
  // Découverte
  { id: 'decades6', emoji: '🧭', target: 6, value: (s) => s.movie.decades.length },
  { id: 'old10', emoji: '📽️', target: 10, value: (s) => s.discovery.oldFilms },
  { id: 'recent25', emoji: '🆕', target: 25, value: (s) => s.discovery.recent },
  { id: 'genres12', emoji: '🎨', target: 12, value: (s) => s.discovery.movieGenres },
  { id: 'langs5', emoji: '🗺️', target: 5, value: (s) => s.discovery.languages },
  { id: 'langs15', emoji: '🌍', target: 15, value: (s) => s.discovery.languages },
  { id: 'french25', emoji: '🥖', target: 25, value: (s) => s.discovery.local },
  { id: 'rated50', emoji: '💎', target: 50, value: (s) => s.discovery.highRated },
  { id: 'nanar10', emoji: '🦆', target: 10, value: (s) => s.discovery.lowRated },
  { id: 'director5', emoji: '🎥', target: 5, value: (s) => s.discovery.maxDirector },
  { id: 'actor10', emoji: '🌟', target: 10, value: (s) => s.discovery.maxActor },
  // Sagas
  { id: 'saga1', emoji: '🧩', target: 1, value: (s) => s.sagas.length },
  { id: 'saga5', emoji: '🗂️', target: 5, value: (s) => s.sagas.length },
];

export const BADGES: Badge[] = RULES.map((rule) => ({ ...rule, ...T.badges[rule.id] }));

const KEY = 'badges';

/** Vérifie les badges et fête ceux qui viennent d'être débloqués. */
export async function checkBadges(): Promise<void> {
  const stats = await computeStats();
  const unlocked = new Set(await getMeta<string[]>(KEY, []));
  const fresh = BADGES.filter((b) => !unlocked.has(b.id) && b.value(stats) >= b.target);
  if (!fresh.length) return;
  await setMeta(KEY, [...unlocked, ...fresh.map((b) => b.id)]);
  const b = fresh[0];
  toast(T.badgeUnlocked(`${b.emoji} ${b.name}`, fresh.length - 1));
  burst([b.emoji, '✨', '🎉'], undefined, 24);
}

let timer: ReturnType<typeof setTimeout> | undefined;
let last = 0;

/** Au plus une vérification toutes les 8 s pendant qu'on swipe. */
export function checkBadgesSoon(): void {
  const wait = Math.max(0, last + 8000 - Date.now());
  clearTimeout(timer);
  timer = setTimeout(() => {
    last = Date.now();
    checkBadges().catch(() => undefined);
  }, wait);
}
