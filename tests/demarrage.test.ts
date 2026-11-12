import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Au démarrage : premier téléchargement du catalogue, ou recherche des nouveautés (au plus une fois par jour).
// Le téléchargement lui-même et le compte sont simulés ; seule la décision est testée ici.
const calls = vi.hoisted(() => ({ full: 0, recent: 0, added: 0, access: true }));
vi.mock('../src/lib/sync', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../src/lib/sync')>()),
  syncCatalogue: vi.fn(async () => {
    calls.full++;
    return { movie: 10, tv: 5, anime: 2, removed: 0 };
  }),
  addNewTitles: vi.fn(async () => {
    calls.recent++;
    return calls.added;
  }),
}));
vi.mock('../src/lib/cloud', () => ({ whenCloudReady: async () => undefined, syncAndWait: async () => undefined }));
vi.mock('../src/lib/settings', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../src/lib/settings')>()),
  hasTmdbAccess: () => calls.access,
}));
const toasts: string[] = [];
vi.stubGlobal('dispatchEvent', (e: CustomEvent) => (toasts.push(e.detail), true));

import { db, setMeta } from '../src/lib/db';
import { checkNewTitles, startFirstCatalogue } from '../src/lib/catalogueDownload';
import { NEW_TITLES_META } from '../src/lib/sync';
import { customImportLabel, hasCriteria, newCustomImport, sameImport } from '../src/lib/customImports';

const HOUR = 3_600_000;

beforeEach(async () => {
  await db.meta.clear();
  Object.assign(calls, { full: 0, recent: 0, added: 0, access: true });
  toasts.length = 0;
});

describe('démarrage', () => {
  it('catalogue jamais téléchargé : premier téléchargement complet', async () => {
    await startFirstCatalogue();
    expect(calls).toMatchObject({ full: 1, recent: 0 });
    expect(toasts[0]).toMatch(/Catalogue prêt : 10 films, 5 séries et 2 animes/);
  });

  it('sans accès à TMDB : rien', async () => {
    calls.access = false;
    await startFirstCatalogue();
    expect(calls).toMatchObject({ full: 0, recent: 0 });
  });

  it('catalogue téléchargé, nouveautés jamais cherchées : recherche de nouveautés, pas de téléchargement complet', async () => {
    await setMeta('lastSync', Date.now() - 40 * 24 * HOUR);
    await startFirstCatalogue();
    expect(calls).toMatchObject({ full: 0, recent: 1 });
  });

  it('nouveautés cherchées il y a moins d’un jour : rien', async () => {
    await setMeta('lastSync', Date.now() - 40 * 24 * HOUR);
    await setMeta(NEW_TITLES_META, { checkedAt: Date.now() - 23 * HOUR, addedAt: 0 });
    await startFirstCatalogue();
    expect(calls).toMatchObject({ full: 0, recent: 0 });
  });

  it('nouveautés cherchées il y a plus d’un jour : cherchées à nouveau', async () => {
    await setMeta('lastSync', Date.now() - 40 * 24 * HOUR);
    await setMeta(NEW_TITLES_META, { checkedAt: Date.now() - 25 * HOUR, addedAt: 0 });
    await startFirstCatalogue();
    expect(calls.recent).toBe(1);
  });

  it('message seulement s’il y a des nouveautés', async () => {
    expect(await checkNewTitles()).toBe(0);
    expect(toasts).toEqual([]);
    await db.meta.clear();
    calls.added = 1;
    expect(await checkNewTitles()).toBe(1);
    expect(toasts).toEqual(['🆕 1 nouveauté au catalogue !']);
    await db.meta.clear();
    calls.added = 42;
    await checkNewTitles();
    expect(toasts.at(-1)).toBe('🆕 42 nouveautés au catalogue !');
  });
});

describe('imports sur mesure', () => {
  const c = (extra: Partial<ReturnType<typeof newCustomImport>>) => ({ ...newCustomImport(), ...extra });

  it('résume les critères', () => {
    expect(customImportLabel(c({ genre: 27, from: 1970, to: 1989, lang: 'it' }))).toBe('Horreur · 1970–1989 · 🇮🇹 Italien');
    expect(customImportLabel(c({ from: 2000, to: 2000 }))).toBe('2000');
    expect(customImportLabel(c({ from: 2000 }))).toBe('depuis 2000');
    expect(customImportLabel(c({ to: 1960, country: 'JP' }))).toBe('jusqu’à 1960 · 🇯🇵 Japon');
    expect(customImportLabel(c({}))).toBe('tous les films');
  });

  it('au moins un critère, et pas deux fois le même import', () => {
    expect(hasCriteria(c({}))).toBe(false);
    expect(hasCriteria(c({ country: 'FR' }))).toBe(true);
    expect(sameImport(c({ lang: 'ko' }), c({ lang: 'ko' }))).toBe(true); // identifiants différents, mêmes critères
    expect(sameImport(c({ lang: 'ko' }), c({ lang: 'ko', minVotes: 50 }))).toBe(false);
  });
});
