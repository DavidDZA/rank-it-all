import { useSyncExternalStore } from 'react';
import { getMeta, requestPersistentStorage } from './db';
import { getMinVotes, hasTmdbAccess } from './settings';
import { syncCatalogue } from './sync';
import { syncAndWait, whenCloudReady } from './cloud';
import { toast } from './fun';

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

const n = (x: number) => x.toLocaleString('fr-FR');

/** Télécharge le catalogue avec les seuils enregistrés (ceux du compte, s'il y en a un). Sans effet s'il est déjà en cours. */
export async function downloadCatalogue(): Promise<void> {
  if (state.running) return;
  setState({ running: true, message: 'Démarrage…', done: 0, error: null });
  try {
    await requestPersistentStorage();
    await whenCloudReady();
    await syncAndWait().catch(() => undefined); // seuils du compte ; sans réseau vers le compte, ceux de l'appareil
    const { movie, tv, anime } = await syncCatalogue(await getMinVotes(), (message, done) =>
      setState({ message, ...(done !== undefined ? { done } : {}) }),
    );
    setState({ running: false, message: null, done: 1, version: state.version + 1 });
    toast(`🎬 Catalogue prêt : ${n(movie)} films, ${n(tv)} séries et ${n(anime)} animes à swiper !`);
  } catch (e) {
    setState({ running: false, message: null, error: (e as Error).message });
  }
}

/**
 * Au démarrage : premier téléchargement si le catalogue n'a jamais été téléchargé sur cet appareil (un téléchargement
 * interrompu recommence au lancement suivant). Un seul onglet à la fois.
 */
export async function startFirstCatalogue(): Promise<void> {
  const needed = async () => !!hasTmdbAccess() && (await getMeta<number | null>('lastSync', null).catch(() => 0)) === null;
  const run = async () => {
    const go = await needed();
    setState({ checked: true });
    if (go) await downloadCatalogue();
  };
  const locks = typeof navigator !== 'undefined' ? navigator.locks : undefined;
  if (!locks) return run();
  await locks.request('rank-it-all:first-catalogue', { ifAvailable: true }, async (lock) => {
    if (lock) await run();
    else setState({ checked: true }); // un autre onglet s'en charge
  });
}
