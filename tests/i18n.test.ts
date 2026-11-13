import { describe, expect, it } from 'vitest';
import { resolve } from 'node:path';
import { existsSync, readFileSync } from 'node:fs';
import { scanFrench } from './frenchScan';
import { DICTS, LANGS, LANG_NAMES, REGIONS, detectLang, detectRegion, tmdbLanguageOf, type Dict } from '../src/i18n';
import { BADGES } from '../src/lib/badges';

// Traduction : 6 langues, un dictionnaire chacune (src/i18n/). La compilation vérifie déjà que chaque dictionnaire a
// toutes les clés du français ; ces tests vérifient le reste : rien d'écrit en dur hors des dictionnaires, aucun texte
// vide, les valeurs bien insérées dans les phrases, et le choix de la langue, du pays et de la langue TMDB.

const ROOT = resolve(__dirname, '..');

/** Toutes les feuilles d'un dictionnaire : [chemin, valeur]. */
function leaves(value: unknown, path = ''): [string, unknown][] {
  if (typeof value === 'string' || typeof value === 'function' || typeof value === 'boolean') return [[path, value]];
  if (Array.isArray(value)) return value.flatMap((v, i) => leaves(v, `${path}[${i}]`));
  return Object.entries(value as object).flatMap(([k, v]) => leaves(v, path ? `${path}.${k}` : k));
}

describe('textes écrits en dur', () => {
  it('aucun texte français hors des dictionnaires (sinon il resterait en français dans les autres langues)', () => {
    expect(scanFrench(ROOT)).toEqual([]);
  });
});

describe('dictionnaires', () => {
  const fr = leaves(DICTS.fr).map(([p]) => p);

  it.each(LANGS)('%s : exactement les mêmes clés que le français', (lang) => {
    expect(leaves(DICTS[lang]).map(([p]) => p)).toEqual(fr);
  });

  it.each(LANGS)('%s : aucun texte vide (hors notes facultatives des astuces)', (lang) => {
    const empty = leaves(DICTS[lang]).filter(([p, v]) => v === '' && !/^tutorial\..*\.note$/.test(p));
    expect(empty).toEqual([]);
  });

  it.each(LANGS.filter((l) => l !== 'fr'))('%s : vraiment traduit (pas une copie du français)', (lang) => {
    const same = leaves(DICTS[lang]).filter(([p, v]) => typeof v === 'string' && v.length > 12 && v === leaves(DICTS.fr).find(([q]) => q === p)?.[1]);
    // Quelques textes identiques sont normaux (noms propres, « Wishlist », sigles) : jamais une part notable.
    expect(same.length).toBeLessThan(5);
  });

  it.each(LANGS)('%s : les valeurs sont bien insérées dans les phrases', (lang) => {
    const t: Dict = DICTS[lang];
    expect(t.duel.ranked('Alien', 3)).toContain('Alien');
    expect(t.duel.ranked('Alien', 3)).toContain('3');
    expect(t.swipe.dropSaga(4)).toContain('4');
    expect(t.friendsPage.added('Léa')).toContain('Léa');
    expect(t.sync.ready('10', '20', '30')).toMatch(/10.*20.*30/);
    expect(t.statsPage.top(250, 'movie')).toContain('250');
    expect(t.duo.notEnough('tv')).toContain(t.cat.tv.plural.split(' ').pop()!);
    expect(t.catalogue.langRow('🇪🇸', 'X-LANGUE')).toContain('X-LANGUE');
    expect(t.badgeUnlocked('🎬 X', 2)).toContain('+2');
    expect(t.badgeUnlocked('🎬 X', 0)).not.toContain('+');
    expect(t.filterSheet.missingRatings('12')).toMatch(/\*\*.*12.*\*\*/); // le nombre en gras
  });

  it.each(LANGS)('%s : singulier et pluriel', (lang) => {
    const t: Dict = DICTS[lang];
    expect(t.fiche.seasons(1)).not.toBe(t.fiche.seasons(2).replace('2', '1'));
    expect(t.home.streak(1)).not.toBe(t.home.streak(2).replace('2', '1'));
  });

  it.each(LANGS)('%s : 51 badges aux noms tous différents', (lang) => {
    const names = Object.values(DICTS[lang].badges).map((b) => b.name);
    expect(names).toHaveLength(BADGES.length);
    expect(new Set(names).size).toBe(BADGES.length);
  });

  it('noms des langues écrits dans leur propre langue', () => {
    expect(LANG_NAMES).toEqual({ fr: 'Français', en: 'English', es: 'Español', de: 'Deutsch', it: 'Italiano', pt: 'Português (Brasil)' });
  });

  it('les menus cités par la page de confidentialité existent bien dans l’appli (suppression du compte)', () => {
    expect(DICTS.en.accountPage.delete).toBe('Delete my account');
    expect(DICTS.es.accountPage.delete).toBe('Eliminar mi cuenta');
    expect(DICTS.de.accountPage.delete).toBe('Mein Konto löschen');
    expect(DICTS.it.accountPage.delete).toBe('Elimina il mio account');
    expect(DICTS.pt.accountPage.delete).toBe('Excluir minha conta');
    expect(DICTS.en.danger.button).toContain('Erase all my choices');
    expect(DICTS.pt.danger.button).toContain('Apagar todas as minhas escolhas');
  });
});

describe('langue de l’interface', () => {
  it('la première langue préférée qui est traduite', () => {
    expect(detectLang(['fr-FR'])).toBe('fr');
    expect(detectLang(['es-MX'])).toBe('es');
    expect(detectLang(['de-AT', 'en'])).toBe('de');
    expect(detectLang(['pt-PT'])).toBe('pt');
    expect(detectLang(['it_IT'])).toBe('it');
    expect(detectLang(['nl-NL', 'fr-BE'])).toBe('fr'); // le néerlandais n'est pas traduit : langue suivante
  });

  it('aucune langue traduite : l’anglais', () => {
    expect(detectLang(['ja-JP'])).toBe('en');
    expect(detectLang(['sw'])).toBe('en');
    expect(detectLang([])).toBe('en');
  });
});

describe('pays des plateformes', () => {
  it('celui de l’appareil', () => {
    expect(detectRegion(['fr-BE'])).toBe('BE');
    expect(detectRegion(['en-GB'])).toBe('GB');
    expect(detectRegion(['pt-BR'])).toBe('BR');
    expect(detectRegion(['es-MX'])).toBe('MX');
    expect(detectRegion(['zh-Hant-TW'])).toBe('TW');
  });

  it('sans pays : celui de la langue', () => {
    expect(detectRegion(['fr'], 'fr')).toBe('FR');
    expect(detectRegion(['en'], 'en')).toBe('US');
    expect(detectRegion(['pt'], 'pt')).toBe('BR');
    expect(detectRegion([], 'de')).toBe('DE');
  });

  it('pays non couvert par les plateformes : celui de la langue', () => {
    expect(detectRegion(['fr-SN'], 'fr')).toBe('FR'); // Sénégal : pas dans la liste
  });

  it('liste des pays : codes ISO valides, sans doublon', () => {
    expect(REGIONS.every((r) => /^[A-Z]{2}$/.test(r))).toBe(true);
    expect(new Set(REGIONS).size).toBe(REGIONS.length);
    expect(REGIONS).toEqual(expect.arrayContaining(['FR', 'BE', 'CH', 'CA', 'US', 'GB', 'ES', 'MX', 'DE', 'IT', 'BR', 'PT']));
  });
});

describe('langue des titres TMDB', () => {
  it('celle de l’interface, avec la variante du pays pour l’espagnol et le portugais', () => {
    expect(tmdbLanguageOf('fr', 'FR')).toBe('fr-FR');
    expect(tmdbLanguageOf('fr', 'BE')).toBe('fr-FR');
    expect(tmdbLanguageOf('en', 'GB')).toBe('en-US');
    expect(tmdbLanguageOf('es', 'ES')).toBe('es-ES');
    expect(tmdbLanguageOf('es', 'MX')).toBe('es-MX');
    expect(tmdbLanguageOf('es', 'AR')).toBe('es-MX');
    expect(tmdbLanguageOf('pt', 'BR')).toBe('pt-BR');
    expect(tmdbLanguageOf('pt', 'PT')).toBe('pt-PT');
    expect(tmdbLanguageOf('de', 'AT')).toBe('de-DE');
    expect(tmdbLanguageOf('it', 'IT')).toBe('it-IT');
  });
});

describe('captures du Play Store', () => {
  // Faites par tools/captures-store/captures.mjs : les 6 écrans de la fiche, dans chaque langue, au format du Store.
  const SHOTS = ['1-accueil', '2-swipe', '3-duel', '4-classement', '5-tier-list', '6-wishlist'];
  /** Largeur et hauteur d'une image PNG (lues dans son en-tête). */
  const pngSize = (file: string) => {
    const b = readFileSync(file);
    expect(b.subarray(1, 4).toString()).toBe('PNG');
    return [b.readUInt32BE(16), b.readUInt32BE(20)];
  };

  it('français : dans store/captures/, en 1080 × 1920', () => {
    for (const shot of SHOTS) expect(pngSize(resolve(ROOT, 'store/captures', `${shot}.png`))).toEqual([1080, 1920]);
  });

  it.each(LANGS.filter((l) => l !== 'fr'))('%s : bannière (image de présentation) en 1024 × 500, différente de la française', (lang) => {
    const file = resolve(ROOT, 'store/bannieres', `banniere-${lang}.png`);
    expect(existsSync(file), file).toBe(true);
    expect(pngSize(file)).toEqual([1024, 500]);
    expect(readFileSync(file).equals(readFileSync(resolve(ROOT, 'store/banniere-1024x500.png')))).toBe(false);
  });

  it.each(LANGS.filter((l) => l !== 'fr'))('%s : les 6 captures, en 1080 × 1920, différentes du français', (lang) => {
    for (const shot of SHOTS) {
      const file = resolve(ROOT, 'store/captures', lang, `${shot}.png`);
      expect(existsSync(file), file).toBe(true);
      expect(pngSize(file)).toEqual([1080, 1920]);
      expect(readFileSync(file).equals(readFileSync(resolve(ROOT, 'store/captures', `${shot}.png`)))).toBe(false);
    }
  });
});
