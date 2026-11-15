import { beforeEach, describe, expect, it, vi } from 'vitest';

// Astuces de première visite : une astuce récrite (version 2) est remontrée une fois à qui avait vu l'ancienne.
vi.hoisted(() => {
  const store = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, String(v)),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
  });
});

import { ALL_SEEN, markTutorialSeen, resetTutorials, seenMark, TUTORIAL_REVISIONS, TUTORIALS, TUTORIALS_KEY, tutorialSeen } from '../src/lib/tutorial';

beforeEach(() => localStorage.clear());

describe('astuces : versions', () => {
  it('repère d’une astuce vue : son nom, suivi de « @version » à partir de la version 2', () => {
    expect(seenMark('home')).toBe('home');
    expect(seenMark('lists')).toBe(`lists@${TUTORIAL_REVISIONS.lists}`);
    expect(ALL_SEEN).toHaveLength(TUTORIALS.length);
  });

  it('astuce récrite (bouton d’état, 16/11) : remontrée une fois à qui avait vu l’ancienne', () => {
    localStorage.setItem(TUTORIALS_KEY, JSON.stringify(['home', 'lists', 'rank', 'wishlist', 'add', 'duo', 'swipe-corners']));
    expect(tutorialSeen('home')).toBe(true);
    expect(tutorialSeen('swipe-corners')).toBe(true); // pas récrite : pas remontrée
    for (const id of ['lists', 'rank', 'wishlist', 'add', 'duo'] as const) expect(tutorialSeen(id)).toBe(false);
    markTutorialSeen('lists');
    expect(tutorialSeen('lists')).toBe(true);
    expect(tutorialSeen('rank')).toBe(false);
  });

  it('« Revoir les astuces » les remontre toutes', () => {
    for (const id of TUTORIALS) markTutorialSeen(id);
    expect(TUTORIALS.every(tutorialSeen)).toBe(true);
    resetTutorials();
    expect(TUTORIALS.some(tutorialSeen)).toBe(false);
  });
});
