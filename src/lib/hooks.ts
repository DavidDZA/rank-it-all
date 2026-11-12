import { useEffect, useMemo, useRef, useState } from 'react';
import { db, DETAILS_SAVED, withDetails, type Title } from './db';

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

/** Relecture des titres affichés, au plus à ce rythme, quand des fiches arrivent en arrière-plan. */
export const TITLES_REFRESH_MS = 2000;

/**
 * Titres (fiches jointes) des clés données, par clé. Relus quand la liste des clés change, et au plus toutes les
 * TITLES_REFRESH_MS quand des fiches sont enregistrées.
 *
 * À la place d'une lecture « vivante » (useLiveQuery) des titres et des fiches : relancée à chaque fiche
 * enregistrée, une liste de 600 titres se relisait sans cesse pendant le téléchargement des fiches, et n'avait
 * jamais le temps de s'afficher (« Chargement… » pendant plus d'une minute sur téléphone, 12/11).
 * Pendant une relecture, la version précédente reste affichée.
 */
export function useTitleMap(keys: string[] | undefined): Map<string, Title> | undefined {
  // Les mêmes titres dans un autre ordre (déplacement, duel) : rien à relire.
  const signature = useMemo(() => keys && [...keys].sort().join('|'), [keys]);
  const [map, setMap] = useState<Map<string, Title>>();
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let last = 0;
    const onSaved = () => {
      if (timer) return;
      timer = setTimeout(() => {
        timer = undefined;
        last = Date.now();
        setTick((t) => t + 1);
      }, Math.max(0, last + TITLES_REFRESH_MS - Date.now()));
    };
    addEventListener(DETAILS_SAVED, onSaved);
    return () => {
      removeEventListener(DETAILS_SAVED, onSaved);
      clearTimeout(timer);
    };
  }, []);

  useEffect(() => {
    if (!keys) return;
    let alive = true;
    (async () => {
      const titles = await withDetails((await db.titles.bulkGet(keys)).filter((t): t is Title => !!t));
      if (alive) setMap(new Map(titles.map((t) => [t.key, t])));
    })();
    return () => {
      alive = false;
    };
  }, [signature, tick]);

  return keys ? map : undefined;
}

/** Les titres des clés, dans leur ordre (ceux absents de la base sont sautés). */
export const titlesOf = (keys: string[], map: Map<string, Title>): Title[] => keys.map((k) => map.get(k)).filter((t): t is Title => !!t);
