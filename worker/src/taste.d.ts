// Types pour l'appli (src/lib/taste.ts) et ses tests.
import type { RawResult } from '../../src/lib/tmdb';

export interface TasteData {
  v: number;
  /** Caractéristiques du titre (« kw:123 », « dir:525 »…). */
  f: string[];
  /** Noms des personnes parmi les caractéristiques (réalisateurs, créateurs, acteurs). */
  names: Record<string, string>;
  votes: number;
  rating: number;
  /** Titres recommandés par TMDB à partir de celui-ci, dans l'ordre de TMDB. */
  recs: RawResult[];
}

export const TASTE_VERSION: number;
export const TASTE_APPEND: { movie: string; tv: string };
export function compactTaste(type: 'movie' | 'tv', raw: unknown): TasteData;
