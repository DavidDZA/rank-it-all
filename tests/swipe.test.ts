import { describe, expect, it } from 'vitest';
import { chainSaga, draw, removeFromPool, sagaInQueue, sagaTags, shortSagaName, type Pool } from '../src/pages/swipe/pool';
import { cardGenres } from '../src/lib/genres';
import { makeTitle } from './helpers';

const t = (id: number) => makeTitle(id);
const keys = (list: { tmdbId: number }[]) => list.map((x) => x.tmdbId);

describe('sagas enchaînées', () => {
  // Saga : 1 → 2 → 3 (ordre de sortie). File : A(10), B(11), 2 (tiré), C(12).
  const saga = [t(1), t(2), t(3)];

  it('remplace le film tiré par toute la saga, en commençant par le premier', () => {
    const queue = [t(10), t(11), t(2), t(12)];
    expect(keys(chainSaga(queue, 2, saga))).toEqual([10, 11, 1, 2, 3, 12]);
  });

  it('retire les doublons plus loin dans la file', () => {
    const queue = [t(10), t(2), t(12), t(3)];
    expect(keys(chainSaga(queue, 1, saga))).toEqual([10, 1, 2, 3, 12]);
  });

  it('garde en premier un film déjà affiché, puis enchaîne le reste dans l’ordre', () => {
    const queue = [t(2), t(10), t(11)];
    expect(keys(chainSaga(queue, 0, saga, true))).toEqual([2, 1, 3, 10, 11]);
  });

  it('ne touche pas aux cartes déjà passées devant', () => {
    // Le film 1 est déjà affiché (index 0), on enchaîne la saga détectée sur le film 3 (index 2).
    const queue = [t(1), t(10), t(3)];
    expect(keys(chainSaga(queue, 2, saga))).toEqual([1, 10, 2, 3]);
  });
});

describe('étiquettes de saga', () => {
  it('raccourcit le nom donné par TMDB', () => {
    expect(shortSagaName('Harry Potter - Saga')).toBe('Harry Potter');
    expect(shortSagaName('Star Wars – Collection')).toBe('Star Wars');
    expect(shortSagaName('Saga Matrix')).toBe('Matrix');
    expect(shortSagaName('Toy Story')).toBe('Toy Story');
  });

  it('donne à chaque film sa place dans la saga complète', () => {
    const tags = sagaTags({ id: 1, name: 'Harry Potter - Saga', parts: [t(1), t(2), t(3)] });
    expect(tags['movie:2']).toEqual({ id: 1, name: 'Harry Potter', position: 2, total: 3 });
    expect(Object.keys(tags)).toEqual(['movie:1', 'movie:2', 'movie:3']);
  });

  it('pas d’étiquette pour une « saga » d’un seul film sorti', () => {
    expect(sagaTags({ id: 2, name: 'Dune - Saga', parts: [t(1)] })).toEqual({});
  });
});

describe('« Pas envie de la saga »', () => {
  // Deux sagas (1 : films 1-3 ; 2 : films 20-21), et des films hors saga dans la file.
  const tags = { ...sagaTags({ id: 1, name: 'Saga A', parts: [t(1), t(2), t(3)] }), ...sagaTags({ id: 2, name: 'Saga B', parts: [t(20), t(21)] }) };

  it('prend les films de la saga encore dans la file, et seulement eux', () => {
    const queue = [t(2), t(3), t(10), t(20), t(21)]; // le film 1 est déjà trié
    expect(keys(sagaInQueue(queue, tags, 1))).toEqual([2, 3]);
    expect(keys(sagaInQueue(queue, tags, 2))).toEqual([20, 21]);
  });

  it('aucun film si la saga n’est plus dans la file', () => {
    expect(sagaInQueue([t(10), t(11)], tags, 1)).toEqual([]);
  });
});

describe('genres sous l’affiche', () => {
  it('noms français des genres du catalogue, 3 au plus', () => {
    expect(cardGenres(makeTitle(1, { genreIds: [878, 28, 12, 53] }))).toEqual(['Science-fiction', 'Action', 'Aventure']);
    expect(cardGenres(makeTitle(1, { genreIds: [10765] }, 'tv'))).toEqual(['SF & fantastique']);
  });

  it('sans genres au catalogue : ceux de la fiche ; sinon rien', () => {
    expect(cardGenres(makeTitle(1, { genreIds: [] }), { genres: ['Drame', 'Crime'] })).toEqual(['Drame', 'Crime']);
    expect(cardGenres(makeTitle(1), null)).toEqual([]);
  });

  it('genre inconnu ignoré', () => {
    expect(cardGenres(makeTitle(1, { genreIds: [99999, 18] }))).toEqual(['Drame']);
  });
});

describe('tirage', () => {
  it('tire selon les poids et retire le titre tiré', () => {
    const pool: Pool = { items: [{ title: t(1), w: 1 }, { title: t(2), w: 3 }], total: 4 };
    const original = Math.random;
    Math.random = () => 0.5; // 0,5 × 4 = 2 : tombe dans le poids du titre 2
    try {
      expect(draw(pool)?.tmdbId).toBe(2);
    } finally {
      Math.random = original;
    }
    expect(pool.items.map((i) => i.title.tmdbId)).toEqual([1]);
    expect(pool.total).toBe(1);
  });

  it('retire des titres du tirage et recalcule le total', () => {
    const pool: Pool = { items: [{ title: t(1), w: 1 }, { title: t(2), w: 3 }, { title: t(3), w: 2 }], total: 6 };
    removeFromPool(pool, new Set(['movie:2']));
    expect(pool.items.map((i) => i.title.tmdbId)).toEqual([1, 3]);
    expect(pool.total).toBe(3);
  });
});
