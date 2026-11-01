import { useEffect, useRef, useState } from 'react';
import type { Title } from './db';

/** Appui long (0,5 s) sans déplacement ; le clic qui suit est annulé. */
export function useLongPress(onLongPress: () => void, ms = 500) {
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const start = useRef<{ x: number; y: number } | null>(null);
  const fired = useRef(false);
  const cancel = () => clearTimeout(timer.current);

  return {
    onPointerDown: (e: React.PointerEvent) => {
      fired.current = false;
      start.current = { x: e.clientX, y: e.clientY };
      timer.current = setTimeout(() => {
        fired.current = true;
        onLongPress();
      }, ms);
    },
    onPointerMove: (e: React.PointerEvent) => {
      if (start.current && Math.hypot(e.clientX - start.current.x, e.clientY - start.current.y) > 10) cancel();
    },
    onPointerUp: cancel,
    onPointerLeave: cancel,
    onPointerCancel: cancel,
    onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
    onClickCapture: (e: React.MouseEvent) => {
      if (fired.current) {
        e.stopPropagation();
        e.preventDefault();
        fired.current = false;
      }
    },
  };
}

/** Texte sans accents ni majuscules, pour la recherche. */
export const normalize = (s: string) =>
  s
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();

export function matchesSearch(title: Title, query: string): boolean {
  const q = normalize(query.trim());
  return !q || normalize(title.title).includes(q) || normalize(title.originalTitle).includes(q);
}

/** Pilotage à la souris (PC) plutôt qu'au doigt (téléphone, tablette). */
const DESKTOP = '(hover: hover) and (pointer: fine)';

export function useIsDesktop(): boolean {
  const [desktop, setDesktop] = useState(() => matchMedia(DESKTOP).matches);
  useEffect(() => {
    const query = matchMedia(DESKTOP);
    const onChange = () => setDesktop(query.matches);
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);
  return desktop;
}

/*
 * Bouton Retour (téléphone, appli Android, navigateur) : chaque fenêtre ou panneau ouvert ajoute une entrée à
 * l'historique, pour que Retour ferme celui du dessus au lieu de quitter l'écran. Fermé autrement (✕, Échap,
 * toucher à côté), il retire son entrée. L'ancre ne change pas : le routeur (hashchange) n'est pas concerné.
 */
const backStack: (() => void)[] = [];
let ignoredPops = 0;

if (typeof window !== 'undefined') {
  addEventListener('popstate', () => {
    if (ignoredPops > 0) ignoredPops--;
    else backStack[backStack.length - 1]?.();
  });
}

/** Ferme (`onClose`) au bouton Retour tant que le composant est affiché. */
export function useCloseOnBack(onClose: () => void): void {
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    let byBack = false;
    const onBack = () => {
      byBack = true;
      backStack.splice(backStack.indexOf(onBack), 1);
      close.current();
    };
    backStack.push(onBack);
    const depth = backStack.length;
    history.pushState({ ...history.state, back: depth }, '');
    return () => {
      if (byBack) return;
      const i = backStack.indexOf(onBack);
      if (i !== -1) backStack.splice(i, 1);
      // Toujours sur l'entrée ajoutée (pas de changement de page entre-temps) : on la retire.
      if (history.state?.back === depth) {
        ignoredPops++;
        history.back();
      }
    };
  }, []);
}
