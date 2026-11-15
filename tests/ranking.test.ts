import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { db, setStatus } from '../src/lib/db';
import {
  changeStatus,
  duelsLeft,
  loadInsert,
  loadRanking,
  moveTitle,
  placeOf,
  moveInRanking,
  pickVerifyPair,
  priorityPool,
  readRanking,
  saveInsert,
  saveRanking,
  promote,
  sendToLast,
  unrankedKeys,
  type Scope,
} from '../src/lib/ranking';
import { makeTitle } from './helpers';

const seen: Scope = { category: 'movie', list: 'seen' };
const wish: Scope = { category: 'movie', list: 'wish' };
const k = (id: number) => `movie:${id}`;

beforeEach(async () => {
  await Promise.all([db.titles.clear(), db.answers.clear(), db.meta.clear()]);
});

describe('classement', () => {
  it('ignore les titres qui ne sont plus « vus »', async () => {
    await setStatus(makeTitle(1), 'seen');
    await setStatus(makeTitle(2), 'wish');
    await saveRanking(seen, [k(1), k(2), k(1)]);
    expect(await readRanking(seen)).toEqual([k(1)]);
    expect(await loadRanking(seen)).toEqual([k(1)]); // et enregistre la version nettoyée
  });

  it('liste les titres vus pas encore classés', async () => {
    for (const id of [1, 2, 3]) await setStatus(makeTitle(id), 'seen');
    await saveRanking(seen, [k(2)]);
    expect((await unrankedKeys(seen, [k(2)])).sort()).toEqual([k(1), k(3)]);
  });

  it('retire un titre du classement de son ancienne liste quand il change de statut', async () => {
    for (const id of [1, 2, 3]) await setStatus(makeTitle(id), 'seen');
    await saveRanking(seen, [k(1), k(2), k(3)]);
    await saveInsert(seen, { key: k(9), lo: 0, hi: 3 });
    await changeStatus(makeTitle(2), 'wish');
    expect(await loadRanking(seen)).toEqual([k(1), k(3)]);
    expect(await loadInsert(seen)).toBeNull(); // les positions ont changé : placement annulé
    expect(await unrankedKeys(wish, [])).toEqual([k(2)]);
  });

  it('change de statut sans perdre l’avis bien / bof si on ne le précise pas… (il est remis à zéro)', async () => {
    await setStatus(makeTitle(1), 'seen', 'good');
    await changeStatus(makeTitle(1), 'wish');
    expect((await db.answers.get(k(1)))?.tier).toBeUndefined();
  });
});

describe('« Vu » avec un avis', () => {
  it('enregistre l’avis donné au moment de marquer vu', async () => {
    await setStatus(makeTitle(1), 'wish');
    await changeStatus(makeTitle(1), 'seen', 'good');
    expect((await db.answers.get(k(1)))?.tier).toBe('good');
  });

  it('un vu qui change d’avis garde sa place dans le classement', async () => {
    for (const id of [1, 2, 3]) await setStatus(makeTitle(id), 'seen', 'meh');
    await saveRanking(seen, [k(1), k(2), k(3)]);
    await changeStatus(makeTitle(2), 'seen', 'good');
    expect(await loadRanking(seen)).toEqual([k(1), k(2), k(3)]);
    expect((await db.answers.get(k(2)))?.tier).toBe('good');
  });
});

describe('poubelle', () => {
  it('envoie un titre à la dernière place', () => {
    expect(sendToLast(['a', 'b', 'c'], 'x')).toEqual(['a', 'b', 'c', 'x']);
    expect(sendToLast([], 'x')).toEqual(['x']);
  });

  it('ne crée pas de doublon si le titre était déjà classé', () => {
    expect(sendToLast(['a', 'x', 'b'], 'x')).toEqual(['a', 'b', 'x']);
  });
});

describe('duels', () => {
  it('estime le nombre de duels restants (dichotomie)', () => {
    expect(duelsLeft({ key: 'x', lo: 0, hi: 1 })).toBe(1);
    expect(duelsLeft({ key: 'x', lo: 0, hi: 500 })).toBe(9);
  });

  it('choisit deux voisins pour une vérification', () => {
    const none = (n: number) => Array.from({ length: n }, () => undefined);
    expect(pickVerifyPair(none(1))).toBeNull();
    expect(pickVerifyPair(none(2), () => 0.99)).toBe(0);
    expect(pickVerifyPair(none(10), () => 0)).toBe(0);
    expect(pickVerifyPair(none(10), () => 0.999)).toBe(8); // dernier couple : 8 et 9
  });

  it('vérifie en priorité les titres « bien »', () => {
    // bien, bien, bien, bof, bof : seuls les couples 0-1 et 1-2 sont proposés.
    const tiers = ['good', 'good', 'good', 'meh', 'meh'] as const;
    expect(pickVerifyPair([...tiers], () => 0)).toBe(0);
    expect(pickVerifyPair([...tiers], () => 0.999)).toBe(1);
    // Que des « bof » : on vérifie quand même.
    expect(pickVerifyPair(['meh', 'meh', 'meh'], () => 0.999)).toBe(1);
  });

  it('place les « bien » d’abord, les « bof » en dernier', () => {
    expect(priorityPool(['a', 'b', 'c', 'd'], ['meh', 'good', undefined, 'good'])).toEqual(['b', 'd']);
    expect(priorityPool(['a', 'b', 'c'], ['meh', undefined, 'meh'])).toEqual(['b']);
    expect(priorityPool(['a', 'b'], ['meh', 'meh'])).toEqual(['a', 'b']);
  });

  it('échange deux voisins sans toucher au reste', () => {
    const r = ['a', 'b', 'c', 'd'];
    expect(promote(r, 2, 1)).toEqual(['a', 'c', 'b', 'd']);
    expect(r).toEqual(['a', 'b', 'c', 'd']); // l'original n'est pas modifié
  });

  it('fait remonter un titre au-dessus d’un voisin de la sélection filtrée', () => {
    // Sélection filtrée : a et d (b et c n'en font pas partie). d préféré à a : d passe juste avant a.
    expect(promote(['a', 'b', 'c', 'd'], 3, 0)).toEqual(['d', 'a', 'b', 'c']);
  });
});

describe('déplacement à la main', () => {
  it('place le titre à la position voulue, sans changer l’ordre des autres', async () => {
    for (const id of [1, 2, 3, 4, 5]) await setStatus(makeTitle(id), 'seen');
    await saveRanking(seen, [k(1), k(2), k(3), k(4), k(5)]);
    await saveInsert(seen, { key: k(9), lo: 0, hi: 5 });
    expect(await moveInRanking(seen, k(5), 1)).toEqual([k(1), k(5), k(2), k(3), k(4)]);
    expect(await loadInsert(seen)).toBeNull(); // positions changées : placement en cours annulé
    expect(await moveInRanking(seen, k(1), 99)).toEqual([k(5), k(2), k(3), k(4), k(1)]); // au-delà : dernier
    expect(await moveInRanking(seen, k(8), 0)).toEqual([k(5), k(2), k(3), k(4), k(1)]); // pas classé : rien
    expect(await loadRanking(seen)).toEqual([k(5), k(2), k(3), k(4), k(1)]);
  });
});

describe("état d'un titre : déplacé de n'importe quel état vers n'importe quel autre", () => {
  const heat = makeTitle(1);
  const casino = makeTitle(2);

  it('placeOf : bien, bof, vu sans avis, envie, pas envie, à trier', () => {
    expect(placeOf({ status: 'seen', tier: 'good' })).toBe('good');
    expect(placeOf({ status: 'seen', tier: 'meh' })).toBe('meh');
    expect(placeOf({ status: 'seen' })).toBe('seen');
    expect(placeOf({ status: 'seen', tier: null })).toBe('seen');
    expect(placeOf({ status: 'wish' })).toBe('wish');
    expect(placeOf({ status: 'unseen' })).toBe('unseen');
    expect(placeOf(null)).toBe('none');
    expect(placeOf(undefined)).toBe('none');
  });

  it('bien ↔ bof : le titre garde sa place au classement', async () => {
    await setStatus(heat, 'seen', 'good');
    await setStatus(casino, 'seen', 'meh');
    await saveRanking(seen, [k(1), k(2)]);
    await moveTitle(heat, 'meh');
    await moveTitle(casino, 'good');
    expect((await db.answers.get(k(1)))?.tier).toBe('meh');
    expect((await db.answers.get(k(2)))?.tier).toBe('good');
    expect(await readRanking(seen)).toEqual([k(1), k(2)]);
  });

  it('vu → envie, pas envie : retiré du classement des vus', async () => {
    await setStatus(heat, 'seen', 'good');
    await setStatus(casino, 'seen', 'good');
    await saveRanking(seen, [k(1), k(2)]);
    await moveTitle(heat, 'wish');
    await moveTitle(casino, 'unseen');
    expect(await loadRanking(seen)).toEqual([]);
    expect((await db.answers.get(k(1)))?.status).toBe('wish');
    expect((await db.answers.get(k(2)))?.status).toBe('unseen');
  });

  it('à trier : réponse effacée (le titre revient au swipe), retiré du classement de sa liste', async () => {
    await setStatus(heat, 'wish');
    await saveRanking(wish, [k(1)]);
    await moveTitle(heat, 'none');
    expect(await db.answers.get(k(1))).toBeUndefined();
    expect(await db.meta.get('ranking:wish:movie')).toMatchObject({ value: [] });
    // Déjà à trier, ou « pas envie » (sans classement) : rien ne casse.
    await moveTitle(heat, 'none');
    await setStatus(casino, 'unseen');
    await moveTitle(casino, 'none');
    expect(await db.answers.count()).toBe(0);
  });

  it('titre jamais vu dans la base (ajout manuel, ami) : ajouté avec son état', async () => {
    await moveTitle(makeTitle(3), 'meh');
    expect(await db.titles.get(k(3))).toBeTruthy();
    expect((await db.answers.get(k(3)))?.tier).toBe('meh');
  });
});
