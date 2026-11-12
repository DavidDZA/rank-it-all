import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { buildBackup, importData } from '../src/lib/backup';
import { db, getMeta, setMeta, setStatus } from '../src/lib/db';
import { readRanking, saveRanking } from '../src/lib/ranking';
import { forgetCategories } from '../src/lib/category';
import { makeTitle } from './helpers';

/** Un fichier de sauvegarde, comme celui que l'utilisateur choisit dans Réglages → Sauvegarde. */
const file = (content: unknown) => new File([JSON.stringify(content)], 'sauvegarde.json', { type: 'application/json' });

const anime = (id: number) => makeTitle(id, { genreIds: [16], originalLanguage: 'ja' }, 'tv');

beforeEach(async () => {
  await Promise.all([db.titles.clear(), db.answers.clear(), db.meta.clear(), db.details.clear()]);
  forgetCategories();
});

describe('sauvegarde', () => {
  it('contient réponses, classements et titres concernés, pas le catalogue ni les réglages de l’appareil', async () => {
    await setStatus(makeTitle(1), 'seen', 'good');
    await setStatus(makeTitle(2), 'wish');
    await db.titles.put(makeTitle(3)); // catalogue, jamais trié
    await saveRanking({ category: 'movie', list: 'seen' }, ['movie:1']);
    await setMeta('activity', { '2026-11-12': 4 });
    await setMeta('lastSync', 123); // propre à l'appareil
    await setMeta('insert:movie', { key: 'movie:1', lo: 0, hi: 0 }); // placement en cours

    const b = await buildBackup();
    expect(b.app).toBe('rank-it-all');
    expect(b.titles.map((t) => t.key).sort()).toEqual(['movie:1', 'movie:2']);
    expect(b.answers.map((a) => [a.key, a.status, a.tier])).toEqual(
      expect.arrayContaining([
        ['movie:1', 'seen', 'good'],
        ['movie:2', 'wish', undefined],
      ]),
    );
    expect(b.meta.map((m) => m.key).sort()).toEqual(['activity', 'ranking:movie']);
  });

  it('aller-retour : tout revient à l’identique, et remplace ce qu’il y avait', async () => {
    await setStatus(makeTitle(1), 'seen', 'good');
    await setStatus(makeTitle(2), 'seen', 'meh');
    await saveRanking({ category: 'movie', list: 'seen' }, ['movie:2', 'movie:1']);
    const backup = JSON.parse(JSON.stringify(await buildBackup()));

    // Entre-temps, sur l'appareil : d'autres choix, un placement en cours.
    await db.answers.clear();
    await setStatus(makeTitle(9), 'seen');
    await saveRanking({ category: 'movie', list: 'seen' }, ['movie:9']);
    await setMeta('insert:movie', { key: 'movie:9', lo: 0, hi: 0 });

    expect(await importData(file(backup))).toBe(2);
    expect((await db.answers.toCollection().primaryKeys()).sort()).toEqual(['movie:1', 'movie:2']);
    expect(await readRanking({ category: 'movie', list: 'seen' })).toEqual(['movie:2', 'movie:1']);
    expect(await getMeta('insert:movie', null)).toBeNull();
    // Restaurées = modifiées maintenant : la synchro les envoie au compte.
    const row = await db.meta.get('ranking:movie');
    expect(Date.now() - (row?.updatedAt ?? 0)).toBeLessThan(5000);
  });

  it('restaure sans le catalogue : les titres de la sauvegarde suffisent', async () => {
    await setStatus(makeTitle(5, { title: 'Ajouté à la main', manual: true }), 'wish');
    const backup = JSON.parse(JSON.stringify(await buildBackup()));
    await db.titles.clear();
    await db.answers.clear();
    await importData(file(backup));
    expect((await db.titles.get('movie:5'))?.title).toBe('Ajouté à la main');
  });

  it('sauvegarde « Sort my stuffs » d’avant le 30/10 : fiches rangées à part, animes sortis des séries', async () => {
    const details = { fetchedAt: 1000, directors: ['Réal'], cast: ['A'], topCast: ['A'], genres: ['Drame'], genreIds: [18], rating: 8, runtime: 100, collection: { id: 7, name: 'Saga' }, providers: { flatrate: [], rent: [], buy: [], link: null } };
    const old = {
      app: 'sort-my-stuffs',
      version: 1,
      exportedAt: '2026-10-20T10:00:00.000Z',
      titles: [{ ...makeTitle(1), details }, makeTitle(10, {}, 'tv'), anime(11)],
      answers: [
        { key: 'movie:1', type: 'movie', status: 'seen', updatedAt: 1 },
        { key: 'tv:10', type: 'tv', status: 'seen', updatedAt: 1 },
        { key: 'tv:11', type: 'tv', status: 'seen', updatedAt: 1 },
      ],
      meta: [{ key: 'ranking:tv', value: ['tv:11', 'tv:10'] }],
    };
    expect(await importData(file(old))).toBe(3);
    expect((await db.details.get('movie:1'))?.directors).toEqual(['Réal']);
    const t = await db.titles.get('movie:1');
    expect(t?.details).toBeUndefined(); // la fiche n'est plus dans le titre
    expect(t).toMatchObject({ detailsAt: 1000, collectionId: 7 });
    expect(await readRanking({ category: 'tv', list: 'seen' })).toEqual(['tv:10']);
    expect(await readRanking({ category: 'anime', list: 'seen' })).toEqual(['tv:11']);
  });

  it('refuse un fichier qui n’est pas une sauvegarde de l’appli, sans rien effacer', async () => {
    await setStatus(makeTitle(1), 'seen');
    await expect(importData(file({ app: 'autre-appli', answers: [] }))).rejects.toThrow('invalide');
    await expect(importData(file({ app: 'rank-it-all' }))).rejects.toThrow('invalide');
    await expect(importData(new File(['pas du json'], 'x.json')))
      .rejects.toThrow();
    expect(await db.answers.count()).toBe(1);
  });
});
