/**
 * Astuces montrées à la première visite d'un écran (une fois par type d'écran : vue sur les films, elle ne revient
 * pas sur les séries ni les animes). Propres à l'appareil (localStorage), comme les autres préférences d'affichage.
 * Sans dépendance : la configuration des tests de bout en bout importe `TUTORIALS` pour les marquer toutes vues.
 */
export const TUTORIALS = ['home', 'swipe-corners', 'swipe-horizontal', 'rank', 'wishlist', 'tonight', 'lists', 'add', 'friends', 'duo'] as const;
export type TutorialId = (typeof TUTORIALS)[number];

export const TUTORIALS_KEY = 'tutorials-seen';

function load(): Set<string> {
  try {
    const v = JSON.parse(localStorage.getItem(TUTORIALS_KEY) ?? '[]');
    return new Set(Array.isArray(v) ? v : []);
  } catch {
    return new Set();
  }
}

function save(seen: Set<string>) {
  try {
    localStorage.setItem(TUTORIALS_KEY, JSON.stringify([...seen]));
  } catch {
    // Stockage indisponible : l'astuce reviendra, tant pis.
  }
}

export const tutorialSeen = (id: TutorialId) => load().has(id);

export function markTutorialSeen(id: TutorialId): void {
  const seen = load();
  seen.add(id);
  save(seen);
}

/** Réglages → « Revoir les astuces ». */
export function resetTutorials(): void {
  save(new Set());
}
