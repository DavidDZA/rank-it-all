import { useSyncExternalStore } from 'react';
import { getMeta, requestPersistentStorage } from './db';
import { fixMinVotes, getMinVotes, hasTmdbAccess } from './settings';
import { addNewTitles, catalogueLanguageOutdated, NEW_TITLES_EVERY, NEW_TITLES_META, type NewTitlesCheck, syncCatalogue } from './sync';
import { syncAndWait, whenCloudReady } from './cloud';
import { toast } from './fun';
import { num, T } from '../i18n';

/**
 * Téléchargement du catalogue, partagé par toute l'appli : lancé tout seul au démarrage tant qu'il n'a jamais été
 * fait sur cet appareil (personne n'a à comprendre les seuils de votes pour commencer), ou depuis le swipe et les
 * réglages. L'accueil, le swipe et les réglages affichent sa progression.
 */
export interface CatalogueDownload {
  running: boolean;
  message: string | null;
  /** Part du travail faite, de 0 à 1. */
  done: number;
  error: string | null;
  /** Augmente à chaque téléchargement terminé : les écrans relisent alors le catalogue. */
  version: number;
  /** Le démarrage a décidé s'il fallait un premier téléchargement (évite d'afficher un instant le bouton). */
  checked: boolean;
}

let state: CatalogueDownload = { running: false, message: null, done: 0, error: null, version: 0, checked: false };
const listeners = new Set<() => void>();

function setState(patch: Partial<CatalogueDownload>) {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
}

export function useCatalogueDownload(): CatalogueDownload {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => state,
  );
}

const n = num;

/** Télécharge le catalogue avec les seuils enregistrés (ceux du compte, s'il y en a un). Sans effet s'il est déjà en cours. */
export async function downloadCatalogue(): Promise<void> {
  if (state.running) return;
  setState({ running: true, message: T.sync.starting, done: 0, error: null });
  try {
    await requestPersistentStorage();
    await whenCloudReady();
    await syncAndWait().catch(() => undefined); // seuils du compte ; sans réseau vers le compte, ceux de l'appareil
    // Seuils fixés (avec la langue de l'appareil) s'ils ne l'étaient pas : après ceux du compte, pour ne pas les écraser.
    const { movie, tv, anime } = await syncCatalogue(await fixMinVotes(), (message, done) =>
      setState({ message, ...(done !== undefined ? { done } : {}) }),
    );
    setState({ running: false, message: null, done: 1, version: state.version + 1 });
    toast(T.sync.ready(n(movie), n(tv), n(anime)));
  } catch (e) {
    setState({ running: false, message: null, error: (e as Error).message });
  }
}

/**
 * Nouveautés au catalogue (titres récents qui passent désormais un seuil), au plus une fois par jour, sans bruit :
 * un message seulement si des titres ont été ajoutés. Hors ligne ou en erreur : réessayé au lancement suivant.
 */
export async function checkNewTitles(): Promise<number> {
  if (state.running) return 0;
  const last = await getMeta<NewTitlesCheck | null>(NEW_TITLES_META, null);
  if (last && Date.now() - last.checkedAt < NEW_TITLES_EVERY) return 0;
  try {
    await whenCloudReady();
    const added = await addNewTitles(await getMinVotes());
    if (added) {
      setState({ version: state.version + 1 });
      toast(T.sync.newTitles(added, n(added)));
    }
    return added;
  } catch {
    return 0;
  }
}

/**
 * Au démarrage : premier téléchargement si le catalogue n'a jamais été téléchargé sur cet appareil (un téléchargement
 * interrompu recommence au lancement suivant), sinon recherche des nouveautés. Un seul onglet à la fois.
 */
export async function startFirstCatalogue(): Promise<void> {
  const lastSync = async () => getMeta<number | null>('lastSync', null).catch(() => 0);
  const run = async () => {
    if (!hasTmdbAccess()) return setState({ checked: true });
    const first = (await lastSync()) === null;
    setState({ checked: true });
    // Langue de l'interface changée depuis le dernier téléchargement : titres et résumés retraduits (mise à jour complète).
    if (first || (await catalogueLanguageOutdated().catch(() => false))) await downloadCatalogue();
    else await checkNewTitles();
  };
  const locks = typeof navigator !== 'undefined' ? navigator.locks : undefined;
  if (!locks) return run();
  await locks.request('rank-it-all:first-catalogue', { ifAvailable: true }, async (lock) => {
    if (lock) await run();
    else setState({ checked: true }); // un autre onglet s'en charge
  });
}
