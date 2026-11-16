import { beforeEach, describe, expect, it, vi } from 'vitest';

// Petites préférences de l'appareil (localStorage) : objets complétés par les valeurs par défaut, autres valeurs rendues
// telles quelles. Bug du 16/11 : un « non » enregistré (mode « Pour toi » désactivé) était relu comme « oui ».
vi.hoisted(() => {
  const store = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, String(v)),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
  });
});

import { readPref, writePref } from '../src/lib/settings';

beforeEach(() => localStorage.clear());

describe('préférences', () => {
  it('oui / non : relu tel quel (« Pour toi » désactivé reste désactivé)', () => {
    expect(readPref('swipe-reco:movie', false)).toBe(false); // rien d'enregistré
    writePref('swipe-reco:movie', true);
    expect(readPref('swipe-reco:movie', false)).toBe(true);
    writePref('swipe-reco:movie', false);
    expect(readPref('swipe-reco:movie', false)).toBe(false);
  });

  it('objet : complété par les valeurs par défaut (champ ajouté depuis l’enregistrement)', () => {
    writePref('filtre', { genre: 18 });
    expect(readPref('filtre', { genre: null, rating: 0 })).toEqual({ genre: 18, rating: 0 });
  });

  it('valeur d’un autre type ou illisible : la valeur par défaut', () => {
    localStorage.setItem('swipe-reco:tv', '{}'); // ancien enregistrement abîmé
    expect(readPref('swipe-reco:tv', false)).toBe(false);
    writePref('filtre', 'texte');
    expect(readPref('filtre', { genre: null })).toEqual({ genre: null });
    localStorage.setItem('cassé', '{pas du json');
    expect(readPref('cassé', 3)).toBe(3);
  });
});
