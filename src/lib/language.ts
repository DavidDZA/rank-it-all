import { flagOf, languageName, rawLanguageName } from '../i18n';

/**
 * Langues originales (codes ISO 639-1 de TMDB) et langue de l'appareil.
 *
 * Le catalogue a un seuil de votes plus bas pour les titres dans la langue de l'utilisateur (ils ont moins de votes
 * sur TMDB, surtout utilisé par un public anglophone). Cette langue est celle du téléphone ou du PC, détectée à la
 * première ouverture, puis fixée avec les seuils (voir getMinVotes, settings.ts) : deux appareils d'un même compte
 * réglés différemment s'effaceraient des titres à chaque mise à jour du catalogue.
 */

/**
 * Langues originales proposées (code TMDB, pays de leur drapeau), pour l'import sur mesure et la langue du catalogue.
 * Leurs noms viennent du navigateur, dans la langue de l'interface (langLabel).
 */
export const ORIGINAL_LANG_CODES: [string, string][] = [
  ['fr', 'FR'],
  ['en', 'GB'],
  ['es', 'ES'],
  ['it', 'IT'],
  ['de', 'DE'],
  ['pt', 'PT'],
  ['nl', 'NL'],
  ['sv', 'SE'],
  ['da', 'DK'],
  ['no', 'NO'],
  ['fi', 'FI'],
  ['pl', 'PL'],
  ['cs', 'CZ'],
  ['hu', 'HU'],
  ['ro', 'RO'],
  ['el', 'GR'],
  ['ru', 'RU'],
  ['tr', 'TR'],
  ['ar', 'SA'],
  ['he', 'IL'],
  ['fa', 'IR'],
  ['hi', 'IN'],
  ['ta', 'IN'],
  ['te', 'IN'],
  ['ja', 'JP'],
  ['ko', 'KR'],
  ['zh', 'CN'],
  ['cn', 'HK'],
  ['th', 'TH'],
  ['id', 'ID'],
];

/** Les mêmes, avec leur libellé (« 🇪🇸 Espagnol ») : [code, libellé]. */
export const ORIGINAL_LANGS: [string, string][] = ORIGINAL_LANG_CODES.map(([code, country]) => [code, `${flagOf(country)} ${languageName(code)}`]);

/**
 * Langues possibles pour le seuil « titres dans ma langue » : toutes sauf l'anglais (les titres en anglais ont
 * déjà beaucoup de votes : le seuil général suffit).
 */
export const CATALOGUE_LANGS = ORIGINAL_LANGS.filter(([code]) => code !== 'en');

export const isCatalogueLang = (code: unknown): code is string => typeof code === 'string' && CATALOGUE_LANGS.some(([c]) => c === code);

/** Libellé avec drapeau (« 🇪🇸 Espagnol »). */
export const langLabel = (code: string) => ORIGINAL_LANGS.find(([c]) => c === code)?.[1] ?? code;
/** Drapeau seul (« 🇪🇸 »). */
export const langFlag = (code: string) => flagOf(ORIGINAL_LANG_CODES.find(([c]) => c === code)?.[1] ?? 'UN');
/** Nom de la langue tel qu'il s'écrit dans une phrase (« espagnol » en français, « Spanish » en anglais). */
export const langName = (code: string) => rawLanguageName(code);

/**
 * Code TMDB d'une langue du navigateur (« pt-BR » → « pt »). Quelques codes diffèrent : norvégien bokmål / nynorsk,
 * ancien code de l'hébreu, cantonais (TMDB : « cn »).
 */
export function tmdbLangOf(tag: string): string {
  const [base, region] = tag.trim().toLowerCase().replace('_', '-').split('-');
  if (base === 'nb' || base === 'nn') return 'no';
  if (base === 'iw') return 'he';
  if (base === 'yue' || (base === 'zh' && (region === 'hk' || region === 'mo'))) return 'cn';
  return base ?? '';
}

/** Langues préférées de l'appareil (téléphone ou PC), la principale d'abord. */
function deviceLanguages(): readonly string[] {
  if (typeof navigator === 'undefined') return [];
  return navigator.languages?.length ? navigator.languages : navigator.language ? [navigator.language] : [];
}

/**
 * Langue du catalogue d'après celle de l'appareil : sa langue principale si elle fait partie des langues originales
 * proposées, sinon aucune (anglais, ou langue absente de la liste).
 */
export function detectCatalogueLang(languages: readonly string[] = deviceLanguages()): string | null {
  const main = languages[0];
  if (!main) return null;
  const code = tmdbLangOf(main);
  return isCatalogueLang(code) ? code : null;
}
