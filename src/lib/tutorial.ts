/**
 * Astuces montrées à la première visite d'un écran (une fois par type d'écran : vue sur les films, elle ne revient
 * pas sur les séries ni les animes). Propres à l'appareil (localStorage), comme les autres préférences d'affichage.
 * Sans dépendance : la configuration des tests de bout en bout importe `ALL_SEEN` pour les marquer toutes vues.
 */
export const TUTORIALS = ['home', 'swipe-corners', 'swipe-horizontal', 'reco', 'rank', 'wishlist', 'tonight', 'lists', 'add', 'friends', 'duo'] as const;
export type TutorialId = (typeof TUTORIALS)[number];

export const TUTORIALS_KEY = 'tutorials-seen';

/**
 * Version de chaque astuce (1 si absente). Une astuce récrite pour expliquer quelque chose de nouveau prend la version
 * suivante : elle est remontrée une fois à ceux qui avaient vu l'ancienne. Version 2 (16/11/2026) : le bouton d'état
 * des titres (vu bien, vu bof, envie, pas envie, à trier). Classement en version 3 (16/11 au soir) : « Reclasser » passe
 * dans la liste du bouton d'état ; wishlist en version 3 : « Re-prioriser » aussi.
 */
export const TUTORIAL_REVISIONS: Partial<Record<TutorialId, number>> = { rank: 3, wishlist: 3, lists: 2, add: 2, duo: 2 };

/** Repère enregistré pour une astuce vue : son identifiant, suivi de « @version » à partir de la version 2. */
export const seenMark = (id: TutorialId) => {
  const revision = TUTORIAL_REVISIONS[id] ?? 1;
  return revision > 1 ? `${id}@${revision}` : id;
};

/** Toutes les astuces vues, dans leur version actuelle (tests de bout en bout). */
export const ALL_SEEN = TUTORIALS.map(seenMark);

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

export const tutorialSeen = (id: TutorialId) => load().has(seenMark(id));

export function markTutorialSeen(id: TutorialId): void {
  const seen = load();
  seen.add(seenMark(id));
  save(seen);
}

/** Réglages → « Revoir les astuces ». */
export function resetTutorials(): void {
  save(new Set());
}
