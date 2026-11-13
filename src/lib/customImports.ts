import { getMeta, setMeta } from './db';
import { GENRES } from './genres';
import { ORIGINAL_LANGS } from './language';

/**
 * Import sur mesure (films seulement) : une requête /discover de plus, avec ses critères et son propre seuil de
 * votes, pour récupérer ce qui manque au catalogue (un genre, un pays, une époque…). Retenu dans la meta
 * « custom-imports » (synchronisée) et relancé à chaque mise à jour du catalogue : sans ça, ses films en
 * seraient retirés.
 */
export interface CustomImport {
  id: string;
  minVotes: number;
  genre: number | null;
  from: number | null; // année de sortie minimum
  to: number | null; // année de sortie maximum
  lang: string | null; // langue originale (ISO 639-1)
  country: string | null; // pays de production (ISO 3166-1)
}

export const DEFAULT_IMPORT_VOTES = 150;

/** Langues originales proposées (code TMDB → libellé) : la liste commune (language.ts). */
export const IMPORT_LANGS = ORIGINAL_LANGS;

/** Pays de production proposés (code TMDB → libellé). */
export const IMPORT_COUNTRIES: [string, string][] = [
  ['FR', '🇫🇷 France'],
  ['BE', '🇧🇪 Belgique'],
  ['CH', '🇨🇭 Suisse'],
  ['CA', '🇨🇦 Canada'],
  ['US', '🇺🇸 États-Unis'],
  ['GB', '🇬🇧 Royaume-Uni'],
  ['IE', '🇮🇪 Irlande'],
  ['AU', '🇦🇺 Australie'],
  ['ES', '🇪🇸 Espagne'],
  ['IT', '🇮🇹 Italie'],
  ['DE', '🇩🇪 Allemagne'],
  ['PT', '🇵🇹 Portugal'],
  ['NL', '🇳🇱 Pays-Bas'],
  ['SE', '🇸🇪 Suède'],
  ['DK', '🇩🇰 Danemark'],
  ['NO', '🇳🇴 Norvège'],
  ['FI', '🇫🇮 Finlande'],
  ['PL', '🇵🇱 Pologne'],
  ['RU', '🇷🇺 Russie'],
  ['TR', '🇹🇷 Turquie'],
  ['IR', '🇮🇷 Iran'],
  ['IN', '🇮🇳 Inde'],
  ['JP', '🇯🇵 Japon'],
  ['KR', '🇰🇷 Corée du Sud'],
  ['CN', '🇨🇳 Chine'],
  ['HK', '🇭🇰 Hong Kong'],
  ['TW', '🇹🇼 Taïwan'],
  ['TH', '🇹🇭 Thaïlande'],
  ['MX', '🇲🇽 Mexique'],
  ['AR', '🇦🇷 Argentine'],
  ['BR', '🇧🇷 Brésil'],
];

const nameOf = (list: [string, string][], code: string) => list.find(([c]) => c === code)?.[1] ?? code;

export const newCustomImport = (): CustomImport => ({
  id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
  minVotes: DEFAULT_IMPORT_VOTES,
  genre: null,
  from: null,
  to: null,
  lang: null,
  country: null,
});

/** Au moins un critère : sans critère, c'est le seuil général des films qu'il faut baisser. */
export const hasCriteria = (c: CustomImport) => c.genre !== null || c.from !== null || c.to !== null || c.lang !== null || c.country !== null;

/** Mêmes critères et même seuil (un import déjà enregistré n'est pas ajouté deux fois). */
export const sameImport = (a: CustomImport, b: CustomImport) =>
  a.minVotes === b.minVotes && a.genre === b.genre && a.from === b.from && a.to === b.to && a.lang === b.lang && a.country === b.country;

/** Résumé des critères (« Horreur · 1970–1989 · 🇮🇹 Italien »). */
export function customImportLabel(c: CustomImport): string {
  const parts: string[] = [];
  if (c.genre !== null) parts.push(GENRES.movie[c.genre] ?? `genre ${c.genre}`);
  if (c.from !== null && c.to !== null) parts.push(c.from === c.to ? String(c.from) : `${c.from}–${c.to}`);
  else if (c.from !== null) parts.push(`depuis ${c.from}`);
  else if (c.to !== null) parts.push(`jusqu’à ${c.to}`);
  if (c.lang) parts.push(nameOf(IMPORT_LANGS, c.lang));
  if (c.country) parts.push(nameOf(IMPORT_COUNTRIES, c.country));
  return parts.join(' · ') || 'tous les films';
}

const IMPORTS_META = 'custom-imports';

export const getCustomImports = () => getMeta<CustomImport[]>(IMPORTS_META, []);
export const setCustomImports = (list: CustomImport[]) => setMeta(IMPORTS_META, list);
