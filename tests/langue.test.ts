import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { db, getMeta, setMeta } from '../src/lib/db';
import { catalogueQueries, syncCatalogue } from '../src/lib/sync';
import { DEFAULT_MIN_VOTES, fixMinVotes, getMinVotes, migrateMinVotes, normalizeMinVotes, type MinVotes } from '../src/lib/settings';
import { CATALOGUE_LANGS, detectCatalogueLang, langName, ORIGINAL_LANGS, tmdbLangOf } from '../src/lib/language';
import { IMPORT_LANGS } from '../src/lib/customImports';

// Langue des « titres dans ta langue » du catalogue (seuil de votes plus bas) : celle du téléphone ou du PC, détectée
// à la première ouverture, puis fixée avec les seuils (synchronisés avec le compte).

// Un faux TMDB : il applique les filtres de /discover (votes, langue originale) et note les langues demandées.
const MOVIES = [
  { id: 1, title: 'Blockbuster', vote_count: 5000, original_language: 'en', release_date: '2010-05-01' },
  { id: 2, title: 'Comédie française', vote_count: 200, original_language: 'fr', release_date: '2015-03-01' },
  { id: 3, title: 'Película española', vote_count: 200, original_language: 'es', release_date: '2015-03-01' },
  { id: 4, title: 'Film japonais', vote_count: 200, original_language: 'ja', release_date: '2015-03-01' },
];
const SERIES = [
  { id: 10, name: 'Série française', vote_count: 30, genre_ids: [18], original_language: 'fr', first_air_date: '2012-01-01' },
  { id: 11, name: 'Serie española', vote_count: 30, genre_ids: [18], original_language: 'es', first_air_date: '2012-01-01' },
];
const requestedLangs: (string | undefined)[] = [];
vi.mock('../src/lib/tmdb', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/lib/tmdb')>();
  return {
    ...actual,
    tmdb: vi.fn(async (path: string, params: Record<string, string | number>) => {
      const lang = params.with_original_language as string | undefined;
      requestedLangs.push(lang);
      const movie = path.includes('movie');
      const field = movie ? 'primary_release_date' : 'first_air_date';
      const results = (movie ? MOVIES : SERIES).filter((r) => {
        const date = 'release_date' in r ? r.release_date : r.first_air_date;
        return (
          r.vote_count >= Number(params['vote_count.gte']) &&
          (!lang || r.original_language === lang) &&
          date >= String(params[`${field}.gte`]) &&
          date <= String(params[`${field}.lte`])
        );
      });
      return { page: 1, total_pages: 1, total_results: results.length, results };
    }),
  };
});

/** Appareil réglé sur ces langues (la principale d'abord). */
function deviceIn(...languages: string[]) {
  vi.stubGlobal('navigator', { languages, language: languages[0] });
}

const movieKeys = async () => (await db.titles.where('type').equals('movie').primaryKeys()).sort();

beforeEach(async () => {
  await Promise.all([db.titles.clear(), db.answers.clear(), db.meta.clear()]);
  requestedLangs.length = 0;
});
afterEach(() => vi.unstubAllGlobals());

describe('langue de l’appareil', () => {
  it('langues de la liste des langues originales : gardées (« pt-BR » → portugais)', () => {
    expect(detectCatalogueLang(['fr-FR'])).toBe('fr');
    expect(detectCatalogueLang(['fr-CA'])).toBe('fr');
    expect(detectCatalogueLang(['es-ES'])).toBe('es');
    expect(detectCatalogueLang(['es-419'])).toBe('es');
    expect(detectCatalogueLang(['pt-BR'])).toBe('pt');
    expect(detectCatalogueLang(['de'])).toBe('de');
    expect(detectCatalogueLang(['ja-JP'])).toBe('ja');
    expect(detectCatalogueLang(['ko-KR'])).toBe('ko');
    expect(detectCatalogueLang(['it_IT'])).toBe('it');
  });

  it('anglais : aucune (les titres en anglais passent déjà le seuil général)', () => {
    expect(detectCatalogueLang(['en-US'])).toBeNull();
    expect(detectCatalogueLang(['en-GB', 'fr-FR'])).toBeNull(); // seule la langue principale compte
    expect(detectCatalogueLang(['en'])).toBeNull();
  });

  it('langue absente de la liste : aucune', () => {
    expect(detectCatalogueLang(['sw-KE'])).toBeNull(); // swahili
    expect(detectCatalogueLang(['ca-ES'])).toBeNull(); // catalan
    expect(detectCatalogueLang(['uk-UA'])).toBeNull(); // ukrainien
    expect(detectCatalogueLang([])).toBeNull();
  });

  it('codes du navigateur différents de ceux de TMDB', () => {
    expect(tmdbLangOf('nb-NO')).toBe('no'); // norvégien bokmål
    expect(tmdbLangOf('nn')).toBe('no'); // nynorsk
    expect(tmdbLangOf('iw')).toBe('he'); // ancien code de l'hébreu
    expect(tmdbLangOf('zh-HK')).toBe('cn'); // cantonais
    expect(tmdbLangOf('yue')).toBe('cn');
    expect(tmdbLangOf('zh-CN')).toBe('zh'); // mandarin
    expect(tmdbLangOf('zh-TW')).toBe('zh');
    expect(detectCatalogueLang(['nb-NO'])).toBe('no');
    expect(detectCatalogueLang(['zh-HK'])).toBe('cn');
  });

  it('lue sur l’appareil (navigator.languages, sinon navigator.language)', () => {
    deviceIn('it-IT', 'en-US');
    expect(detectCatalogueLang()).toBe('it');
    vi.stubGlobal('navigator', { language: 'ko-KR' });
    expect(detectCatalogueLang()).toBe('ko');
    vi.stubGlobal('navigator', {});
    expect(detectCatalogueLang()).toBeNull();
  });

  it('la liste : celle de l’import sur mesure, sans l’anglais', () => {
    expect(IMPORT_LANGS).toBe(ORIGINAL_LANGS);
    expect(CATALOGUE_LANGS.map(([c]) => c)).toEqual(ORIGINAL_LANGS.map(([c]) => c).filter((c) => c !== 'en'));
    expect(langName('es')).toBe('espagnol');
    expect(langName('zh')).toBe('chinois'); // noms donnés par le navigateur (Intl.DisplayNames)
    expect(langName('cn')).toBe('cantonais'); // « cn » : le code TMDB du cantonais
  });
});

describe('seuils du catalogue selon la langue', () => {
  it('première ouverture : la langue de l’appareil, avec les seuils par défaut (les mêmes pour toutes)', async () => {
    deviceIn('es-ES');
    expect(await getMinVotes()).toEqual({ ...DEFAULT_MIN_VOTES, lang: 'es' });
    deviceIn('en-US');
    expect((await getMinVotes()).lang).toBeNull();
    deviceIn('sw-KE');
    expect((await getMinVotes()).lang).toBeNull();
    deviceIn('fr-FR');
    expect((await getMinVotes()).lang).toBe('fr');
  });

  it('fixée au premier téléchargement : changer ensuite la langue de l’appareil ne change plus rien', async () => {
    deviceIn('de-DE');
    expect((await fixMinVotes()).lang).toBe('de');
    expect((await getMeta<MinVotes | null>('min-votes', null))?.lang).toBe('de'); // enregistrée, donc synchronisée avec le compte
    deviceIn('ja-JP');
    expect((await getMinVotes()).lang).toBe('de');
    expect((await fixMinVotes()).lang).toBe('de');
  });

  it('les seuils du compte (déjà reçus) ne sont pas écrasés par la langue de l’appareil', async () => {
    await setMeta('min-votes', { ...DEFAULT_MIN_VOTES, lang: 'it', langMovie: 80 });
    deviceIn('en-US');
    expect(await fixMinVotes()).toMatchObject({ lang: 'it', langMovie: 80 });
  });

  it('appareil déjà utilisé avant le 13/11 (catalogue téléchargé, seuils jamais modifiés) : reste en français', async () => {
    await setMeta('lastSync', Date.now());
    deviceIn('en-US');
    expect((await getMinVotes()).lang).toBe('fr');
  });

  it('ancien format (compte, sauvegarde) : « titres en français » repris avec ses seuils', async () => {
    await setMeta('min-votes', { movie: 800, tv: 50, anime: 50, frMovie: 120, frTv: 15, oldMovie: 150 });
    deviceIn('es-ES');
    const v = await getMinVotes();
    expect(v).toEqual({ movie: 800, tv: 50, anime: 50, lang: 'fr', langMovie: 120, langTv: 15, oldMovie: 150 });
    expect(v).not.toHaveProperty('frMovie');
  });

  it('langue « aucune » choisie : gardée ; langue inconnue : aucune', () => {
    expect(normalizeMinVotes({ lang: null }).lang).toBeNull();
    expect(normalizeMinVotes({ lang: 'xx' }).lang).toBeNull();
    expect(normalizeMinVotes({ lang: 'en' }).lang).toBeNull(); // l'anglais n'a pas de seuil à part
    expect(normalizeMinVotes({ lang: 'ko' }).lang).toBe('ko');
  });

  it('seuils d’avant la synchro (localStorage) : repris dans la base en français', async () => {
    const store = new Map([['min-votes', JSON.stringify({ movie: 500, frMovie: 90 })]]);
    vi.stubGlobal('localStorage', { getItem: (k: string) => store.get(k) ?? null, removeItem: (k: string) => store.delete(k) });
    await migrateMinVotes();
    expect(await getMeta('min-votes', null)).toMatchObject({ movie: 500, lang: 'fr', langMovie: 90 });
  });
});

describe('requêtes du catalogue', () => {
  it('une langue : ses films et séries ont leur requête, avec un libellé dans cette langue', () => {
    const queries = catalogueQueries({ ...DEFAULT_MIN_VOTES, lang: 'es' });
    const local = queries.filter((q) => q.extra?.with_original_language);
    expect(local.map((q) => [q.type, q.label, q.minVotes, q.extra?.with_original_language])).toEqual([
      ['movie', 'films en espagnol', 150, 'es'],
      ['tv', 'séries en espagnol', 20, 'es'],
    ]);
  });

  it('aucune langue (anglais…) : pas de requête de langue', () => {
    const queries = catalogueQueries({ ...DEFAULT_MIN_VOTES, lang: null });
    expect(queries.some((q) => q.extra?.with_original_language)).toBe(false);
    expect(queries.map((q) => q.label)).toEqual(['films', 'films d’avant 1980', 'séries et animes']);
  });

  it('téléchargement en espagnol : les titres espagnols peu votés entrent, pas les français', async () => {
    await syncCatalogue({ ...DEFAULT_MIN_VOTES, lang: 'es' }, () => {});
    expect(await movieKeys()).toEqual(['movie:1', 'movie:3']);
    expect(await db.titles.get('tv:11')).toBeDefined();
    expect(await db.titles.get('tv:10')).toBeUndefined();
    expect(requestedLangs).toContain('es');
    expect(requestedLangs).not.toContain('fr');
  });

  it('téléchargement en français : comme avant', async () => {
    await syncCatalogue({ ...DEFAULT_MIN_VOTES, lang: 'fr' }, () => {});
    expect(await movieKeys()).toEqual(['movie:1', 'movie:2']);
    expect(await db.titles.get('tv:10')).toBeDefined();
  });

  it('téléchargement sans langue (appareil en anglais) : seulement les titres au-dessus du seuil général', async () => {
    await syncCatalogue({ ...DEFAULT_MIN_VOTES, lang: null }, () => {});
    expect(await movieKeys()).toEqual(['movie:1']);
    expect(requestedLangs.every((l) => l === undefined)).toBe(true);
  });

  it('en japonais : les films japonais peu votés entrent', async () => {
    await syncCatalogue({ ...DEFAULT_MIN_VOTES, lang: 'ja' }, () => {});
    expect(await movieKeys()).toEqual(['movie:1', 'movie:4']);
  });
});
