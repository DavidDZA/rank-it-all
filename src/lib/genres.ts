import type { MediaType } from './db';
import { T } from '../i18n';

/** Genres TMDB (identifiants stables) et leur nom dans la langue de l'interface. */
export const GENRES: Record<MediaType, Record<number, string>> = T.genres;

export const genreName = (type: MediaType, id: number) => GENRES[type][id];

/**
 * Genres à afficher sous l'affiche (swipe, duels), `max` au plus : ceux du catalogue (connus sans réseau), sinon
 * ceux de la fiche détaillée.
 */
export function cardGenres(title: { type: MediaType; genreIds?: number[] }, details?: { genres: string[] } | null, max = 3): string[] {
  const known = (title.genreIds ?? []).map((id) => genreName(title.type, id)).filter(Boolean);
  return (known.length ? known : (details?.genres ?? [])).slice(0, max);
}
