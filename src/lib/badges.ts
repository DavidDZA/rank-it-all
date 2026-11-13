import { getMeta, setMeta } from './db';
import { computeStats, type Stats } from './stats';
import { burst, toast } from './fun';

export interface Badge {
  id: string;
  emoji: string;
  name: string;
  desc: string;
  target: number;
  value: (s: Stats) => number;
}

const seenAll = (s: Stats) => s.movie.seen + s.tv.seen + s.anime.seen;
const rankedAll = (s: Stats) => s.movie.ranked + s.tv.ranked + s.anime.ranked;
const hours = (s: Stats) => Math.floor((s.movie.minutes + s.tv.minutes + s.anime.minutes) / 60);

/** 51 badges (3 par ligne), par thème, dans l'ordre d'affichage. */
export const BADGES: Badge[] = [
  // Films
  { id: 'first', emoji: '🎬', name: 'Premier pas', desc: '1 titre vu', target: 1, value: seenAll },
  { id: 'films25', emoji: '🎟️', name: 'Ticket d’entrée', desc: '25 films vus', target: 25, value: (s) => s.movie.seen },
  { id: 'films100', emoji: '🍿', name: 'Cinéphile', desc: '100 films vus', target: 100, value: (s) => s.movie.seen },
  { id: 'films250', emoji: '🎞️', name: 'Cinévore', desc: '250 films vus', target: 250, value: (s) => s.movie.seen },
  { id: 'films500', emoji: '🏛️', name: 'Cinémathèque', desc: '500 films vus', target: 500, value: (s) => s.movie.seen },
  { id: 'films1000', emoji: '👑', name: 'Légende du grand écran', desc: '1 000 films vus', target: 1000, value: (s) => s.movie.seen },
  { id: 'top250', emoji: '⭐', name: 'Culture ciné', desc: 'La moitié des 250 films les plus populaires', target: 125, value: (s) => s.movie.top.seen },
  // Séries et animes
  { id: 'series10', emoji: '📡', name: 'Téléspectateur', desc: '10 séries vues', target: 10, value: (s) => s.tv.seen },
  { id: 'series25', emoji: '📺', name: 'Sériephile', desc: '25 séries vues', target: 25, value: (s) => s.tv.seen },
  { id: 'series100', emoji: '🛋️', name: 'Binge-watcher', desc: '100 séries vues', target: 100, value: (s) => s.tv.seen },
  { id: 'series250', emoji: '🗼', name: 'Sérievore', desc: '250 séries vues', target: 250, value: (s) => s.tv.seen },
  { id: 'toptv', emoji: '🧠', name: 'Culture séries', desc: 'La moitié des 100 séries les plus populaires', target: 50, value: (s) => s.tv.top.seen },
  { id: 'episodes1000', emoji: '📼', name: 'Mille épisodes', desc: '1 000 épisodes vus', target: 1000, value: (s) => s.discovery.episodes },
  { id: 'anime5', emoji: '🍥', name: 'Premier arc', desc: '5 animes vus', target: 5, value: (s) => s.anime.seen },
  { id: 'anime25', emoji: '🎌', name: 'Otaku', desc: '25 animes vus', target: 25, value: (s) => s.anime.seen },
  { id: 'anime100', emoji: '🐉', name: 'Sensei', desc: '100 animes vus', target: 100, value: (s) => s.anime.seen },
  { id: 'topanime', emoji: '⛩️', name: 'Culture anime', desc: 'La moitié des 50 animes les plus populaires', target: 25, value: (s) => s.anime.top.seen },
  // Tri et régularité
  { id: 'sort100', emoji: '🃏', name: 'Bon début', desc: '100 tris', target: 100, value: (s) => s.totalActions },
  { id: 'sort1000', emoji: '🗃️', name: 'Archiviste', desc: '1 000 tris', target: 1000, value: (s) => s.totalActions },
  { id: 'day50', emoji: '🚀', name: 'Sur la lancée', desc: '50 tris en un jour', target: 50, value: (s) => s.bestDay },
  { id: 'day100', emoji: '⚡', name: 'Trieur fou', desc: '100 tris en un jour', target: 100, value: (s) => s.bestDay },
  { id: 'streak3', emoji: '✨', name: 'Bonne habitude', desc: '3 jours d’affilée', target: 3, value: (s) => s.bestStreak },
  { id: 'streak7', emoji: '🔥', name: 'Semaine de feu', desc: '7 jours d’affilée', target: 7, value: (s) => s.bestStreak },
  { id: 'streak30', emoji: '☄️', name: 'Inarrêtable', desc: '30 jours d’affilée', target: 30, value: (s) => s.bestStreak },
  { id: 'streak100', emoji: '🗿', name: 'Légendaire', desc: '100 jours d’affilée', target: 100, value: (s) => s.bestStreak },
  { id: 'days30', emoji: '📆', name: 'Fidèle', desc: '30 jours d’activité', target: 30, value: (s) => s.activeDays },
  { id: 'days100', emoji: '🎖️', name: 'Vétéran', desc: '100 jours d’activité', target: 100, value: (s) => s.activeDays },
  // Classement
  { id: 'ranked10', emoji: '⚖️', name: 'Premier verdict', desc: '10 titres classés', target: 10, value: rankedAll },
  { id: 'ranked50', emoji: '🏆', name: 'Juge suprême', desc: '50 titres classés', target: 50, value: rankedAll },
  { id: 'ranked200', emoji: '📜', name: 'Grand classement', desc: '200 titres classés', target: 200, value: rankedAll },
  { id: 'good50', emoji: '👍', name: 'Bon public', desc: '50 titres aimés', target: 50, value: (s) => s.good },
  { id: 'good200', emoji: '❤️‍🔥', name: 'Passionné', desc: '200 titres aimés', target: 200, value: (s) => s.good },
  // Wishlist
  { id: 'wish25', emoji: '💖', name: 'Liste de rêve', desc: '25 titres en wishlist', target: 25, value: (s) => s.wish },
  { id: 'wish100', emoji: '🎁', name: 'Hotte du Père Noël', desc: '100 titres en wishlist', target: 100, value: (s) => s.wish },
  { id: 'wishRanked10', emoji: '🎯', name: 'Priorités claires', desc: '10 titres priorisés dans la wishlist', target: 10, value: (s) => s.wishRanked },
  // Temps devant l'écran
  { id: 'hours100', emoji: '⏳', name: 'Cent heures', desc: '100 h devant l’écran', target: 100, value: hours },
  { id: 'hours500', emoji: '🌙', name: 'Nuits blanches', desc: '500 h devant l’écran', target: 500, value: hours },
  { id: 'long5', emoji: '🏃', name: 'Marathonien', desc: '5 films de 3 h ou plus', target: 5, value: (s) => s.discovery.longFilms },
  // Découverte
  { id: 'decades6', emoji: '🧭', name: 'Voyageur du temps', desc: 'Des films vus sur 6 décennies', target: 6, value: (s) => s.movie.decades.length },
  { id: 'old10', emoji: '📽️', name: 'Noir et blanc', desc: '10 films d’avant 1960', target: 10, value: (s) => s.discovery.oldFilms },
  { id: 'recent25', emoji: '🆕', name: 'À la page', desc: '25 titres sortis cette année ou l’an dernier', target: 25, value: (s) => s.discovery.recent },
  { id: 'genres12', emoji: '🎨', name: 'Éclectique', desc: 'Des films de 12 genres différents', target: 12, value: (s) => s.discovery.movieGenres },
  { id: 'langs5', emoji: '🗺️', name: 'Polyglotte', desc: 'Des titres en 5 langues', target: 5, value: (s) => s.discovery.languages },
  { id: 'langs15', emoji: '🌍', name: 'Globe-trotter', desc: 'Des titres en 15 langues', target: 15, value: (s) => s.discovery.languages },
  { id: 'french25', emoji: '🥖', name: 'Cocorico', desc: '25 titres en français', target: 25, value: (s) => s.discovery.french },
  { id: 'rated50', emoji: '💎', name: 'Fin palais', desc: '50 titres notés 8/10 ou plus', target: 50, value: (s) => s.discovery.highRated },
  { id: 'nanar10', emoji: '🦆', name: 'Nanardeur', desc: '10 titres notés moins de 5/10', target: 10, value: (s) => s.discovery.lowRated },
  { id: 'director5', emoji: '🎥', name: 'Fan absolu', desc: '5 films du même réalisateur', target: 5, value: (s) => s.discovery.maxDirector },
  { id: 'actor10', emoji: '🌟', name: 'Groupie', desc: '10 titres avec le même acteur', target: 10, value: (s) => s.discovery.maxActor },
  // Sagas
  { id: 'saga1', emoji: '🧩', name: 'Saga complète', desc: 'Tous les films d’une saga vus', target: 1, value: (s) => s.sagas.length },
  { id: 'saga5', emoji: '🗂️', name: 'Collectionneur', desc: '5 sagas complètes', target: 5, value: (s) => s.sagas.length },
];

const KEY = 'badges';

/** Vérifie les badges et fête ceux qui viennent d'être débloqués. */
export async function checkBadges(): Promise<void> {
  const stats = await computeStats();
  const unlocked = new Set(await getMeta<string[]>(KEY, []));
  const fresh = BADGES.filter((b) => !unlocked.has(b.id) && b.value(stats) >= b.target);
  if (!fresh.length) return;
  await setMeta(KEY, [...unlocked, ...fresh.map((b) => b.id)]);
  const b = fresh[0];
  toast(`🏅 Badge débloqué : ${b.emoji} ${b.name}${fresh.length > 1 ? ` (+${fresh.length - 1})` : ''}`);
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
