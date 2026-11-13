/**
 * Langue de l'interface, pays des plateformes de streaming, et dictionnaire des textes.
 *
 * - Langue : celle de l'appareil si elle est traduite (sinon l'anglais), modifiable dans les Réglages. Propre à
 *   l'appareil (localStorage), pas synchronisée avec le compte.
 * - Pays : celui de l'appareil (« fr-BE » → Belgique), sinon celui de la langue ; modifiable dans les Réglages.
 *   Il choisit les plateformes de streaming (« où regarder », « mes abonnements »).
 * - Titres et résumés TMDB : dans la langue de l'interface (variante régionale pour l'espagnol et le portugais).
 *
 * Tout est lu une fois, au démarrage : changer de langue ou de pays recharge l'appli (voir applyLanguage). Ainsi
 * chaque texte, même calculé hors des écrans (messages, libellés de lib/), est dans la bonne langue.
 *
 * Les textes sont dans un dictionnaire par langue (fr.ts en référence, typé : la compilation échoue s'il manque un
 * texte dans une autre langue). Un test refuse tout texte français écrit en dur hors des dictionnaires.
 */
import { fr, type Dict } from './fr';
import { en } from './en';
import { es } from './es';
import { de } from './de';
import { it } from './it';
import { pt } from './pt';

export type { Dict };

export const LANGS = ['fr', 'en', 'es', 'de', 'it', 'pt'] as const;
export type Lang = (typeof LANGS)[number];

export const DICTS: Record<Lang, Dict> = { fr, en, es, de, it, pt };

/** Nom de chaque langue dans cette langue (pour le choix dans les Réglages). */
export const LANG_NAMES: Record<Lang, string> = {
  fr: 'Français',
  en: 'English',
  es: 'Español',
  de: 'Deutsch',
  it: 'Italiano',
  pt: 'Português (Brasil)',
};

/** Pays par défaut d'une langue, quand l'appareil ne dit pas le sien (« fr » sans région). */
const DEFAULT_REGION: Record<Lang, string> = { fr: 'FR', en: 'US', es: 'ES', de: 'DE', it: 'IT', pt: 'BR' };

/** Pays d'Amérique latine : espagnol d'Amérique pour les titres TMDB (es-MX). */
const LATAM = ['MX', 'AR', 'CO', 'CL', 'PE', 'VE', 'EC', 'GT', 'CU', 'BO', 'DO', 'HN', 'PY', 'SV', 'NI', 'CR', 'PA', 'UY', 'PR', 'US'];

/**
 * Pays proposés pour les plateformes (couverts par JustWatch, donc par TMDB). Leurs noms viennent du navigateur
 * (Intl.DisplayNames), dans la langue de l'interface.
 */
export const REGIONS = [
  'AR', 'AT', 'AU', 'BE', 'BR', 'CA', 'CH', 'CL', 'CO', 'CZ', 'DE', 'DK', 'EC', 'ES', 'FI', 'FR', 'GB', 'GR', 'HU',
  'ID', 'IE', 'IN', 'IT', 'JP', 'KR', 'LU', 'MX', 'NL', 'NO', 'NZ', 'PE', 'PH', 'PL', 'PT', 'RO', 'SE', 'SG', 'TH',
  'TR', 'TW', 'US', 'ZA',
];

const LANG_KEY = 'app-lang';
const REGION_KEY = 'app-region';

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string | null): void {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    // Stockage indisponible (navigation privée…) : le choix ne sera pas retenu.
  }
}

/** Langues préférées de l'appareil, la principale d'abord. */
function devicePrefs(): readonly string[] {
  if (typeof navigator === 'undefined') return [];
  return navigator.languages?.length ? navigator.languages : navigator.language ? [navigator.language] : [];
}

const isLang = (s: unknown): s is Lang => typeof s === 'string' && (LANGS as readonly string[]).includes(s);

/** Langue de l'interface d'après l'appareil : la première de ses langues préférées qui est traduite, sinon l'anglais. */
export function detectLang(prefs: readonly string[] = devicePrefs()): Lang {
  for (const tag of prefs) {
    const base = tag.toLowerCase().split(/[-_]/)[0];
    if (isLang(base)) return base;
  }
  return 'en';
}

/** Pays d'après l'appareil (« fr-BE » → BE), sinon celui de la langue. */
export function detectRegion(prefs: readonly string[] = devicePrefs(), language: Lang = detectLang(prefs)): string {
  for (const tag of prefs) {
    const region = tag.split(/[-_]/).find((part, i) => i > 0 && /^[A-Za-z]{2}$/.test(part));
    if (region && REGIONS.includes(region.toUpperCase())) return region.toUpperCase();
  }
  return DEFAULT_REGION[language];
}

/** Langue de l'interface : celle choisie dans les Réglages, sinon celle de l'appareil. */
export function getLang(): Lang {
  const chosen = read(LANG_KEY);
  return isLang(chosen) ? chosen : detectLang();
}

/** Pays des plateformes : celui choisi dans les Réglages, sinon celui de l'appareil. */
export function getRegion(): string {
  const chosen = read(REGION_KEY);
  return chosen && REGIONS.includes(chosen) ? chosen : detectRegion(devicePrefs(), getLang());
}

/** Langue choisie dans les Réglages (null : celle de l'appareil). */
export const chosenLang = (): Lang | null => {
  const v = read(LANG_KEY);
  return isLang(v) ? v : null;
};
/** Pays choisi dans les Réglages (null : celui de l'appareil). */
export const chosenRegion = (): string | null => {
  const v = read(REGION_KEY);
  return v && REGIONS.includes(v) ? v : null;
};

/**
 * Enregistre la langue et le pays choisis (null : ceux de l'appareil), puis recharge l'appli pour tout afficher dans
 * la nouvelle langue. Les titres du catalogue sont retraduits au démarrage suivant (voir catalogueDownload.ts).
 */
export function applyLanguage(language: Lang | null, region: string | null, reload = true): void {
  write(LANG_KEY, language);
  write(REGION_KEY, region);
  if (reload && typeof location !== 'undefined') location.reload();
}

/** Langue de TMDB (titres, résumés, genres) pour une langue d'interface et un pays. */
export function tmdbLanguageOf(language: Lang, country: string): string {
  if (language === 'pt') return country === 'PT' ? 'pt-PT' : 'pt-BR';
  if (language === 'es') return LATAM.includes(country) ? 'es-MX' : 'es-ES';
  return { fr: 'fr-FR', en: 'en-US', de: 'de-DE', it: 'it-IT' }[language];
}

// ---------- Valeurs de la session (relues au rechargement) ----------

/** Langue de l'interface. */
export const LANG: Lang = getLang();
/** Pays des plateformes de streaming (code ISO 3166-1). */
export const REGION: string = getRegion();
/** Locale des nombres et des dates (« fr-FR », « en-US », « pt-BR »…). */
export const LOCALE = `${LANG}-${LANG === 'pt' && REGION !== 'PT' ? 'BR' : REGION}`;
/** Langue des titres, résumés et genres demandés à TMDB. */
export const TMDB_LANGUAGE = tmdbLanguageOf(LANG, REGION);
/** Les textes, dans la langue de l'interface. */
export const T: Dict = DICTS[LANG];

/** Nombre formaté pour la langue (« 1 234 », « 1,234 »). */
export const num = (n: number) => n.toLocaleString(LOCALE);
/** Note sur 10 (« 7,5 » / « 7.5 »). */
export const decimal = (n: number, digits = 1) => n.toLocaleString(LOCALE, { minimumFractionDigits: digits, maximumFractionDigits: digits });

const displayNames = (type: 'region' | 'language') => {
  try {
    return new Intl.DisplayNames([LOCALE], { type });
  } catch {
    return null;
  }
};
const regionNames = displayNames('region');
const languageNames = displayNames('language');

/** Nom d'un pays dans la langue de l'interface (« Belgique », « Belgium »). */
export const regionName = (code: string) => regionNames?.of(code) ?? code;

/** Nom d'une langue (code TMDB) dans la langue de l'interface, tel qu'il s'écrit dans une phrase (« espagnol »). */
export const rawLanguageName = (code: string) => languageNames?.of(code === 'cn' ? 'yue' : code) ?? code; // « cn » : cantonais chez TMDB

/** Nom d'une langue avec une majuscule, pour une liste (« Espagnol », « Spanish »). */
export function languageName(code: string): string {
  const name = rawLanguageName(code);
  return name.charAt(0).toLocaleUpperCase(LOCALE) + name.slice(1);
}

/** Drapeau d'un pays (« FR » → 🇫🇷). */
export const flagOf = (country: string) =>
  String.fromCodePoint(...country.toUpperCase().split('').map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));
