import type { MediaType } from './db';

/** Genres TMDB (identifiants stables) et leur nom en français. */
export const GENRES: Record<MediaType, Record<number, string>> = {
  movie: {
    28: 'Action',
    12: 'Aventure',
    16: 'Animation',
    35: 'Comédie',
    80: 'Crime',
    18: 'Drame',
    10751: 'Familial',
    14: 'Fantastique',
    36: 'Histoire',
    27: 'Horreur',
    10402: 'Musique',
    9648: 'Mystère',
    10749: 'Romance',
    878: 'Science-fiction',
    10770: 'Téléfilm',
    53: 'Thriller',
    10752: 'Guerre',
    37: 'Western',
  },
  tv: {
    10759: 'Action & aventure',
    16: 'Animation',
    35: 'Comédie',
    80: 'Crime',
    18: 'Drame',
    10751: 'Familial',
    10762: 'Jeunesse',
    9648: 'Mystère',
    10765: 'SF & fantastique',
    10766: 'Feuilleton',
    10768: 'Guerre & politique',
    37: 'Western',
  },
};

export const genreName = (type: MediaType, id: number) => GENRES[type][id];

/**
 * Genres à afficher sous l'affiche (swipe, duels), `max` au plus : ceux du catalogue (connus sans réseau), sinon
 * ceux de la fiche détaillée.
 */
export function cardGenres(title: { type: MediaType; genreIds?: number[] }, details?: { genres: string[] } | null, max = 3): string[] {
  const known = (title.genreIds ?? []).map((id) => genreName(title.type, id)).filter(Boolean);
  return (known.length ? known : (details?.genres ?? [])).slice(0, max);
}
