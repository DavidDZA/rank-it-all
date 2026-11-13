import { useState } from 'react';
import { markTutorialSeen, tutorialSeen, type TutorialId } from '../lib/tutorial';
import { T } from '../i18n';
import { Rich, Sheet } from './common';

/**
 * Astuce de l'écran, affichée à la première visite seulement. Contenu dans le dictionnaire (T.tutorial) : l'essentiel
 * de chaque écran, pas ce qui se voit déjà ; **gras** pour les mots clés.
 */
export function Tutorial({ id }: { id: TutorialId }) {
  const [open, setOpen] = useState(() => !tutorialSeen(id));
  if (!open) return null;
  const close = () => {
    markTutorialSeen(id);
    setOpen(false);
  };
  const { title, points, ordered, note } = T.tutorial[id];
  const List = ordered ? 'ol' : 'ul';
  return (
    <Sheet onClose={close} label={title}>
      <div className="tutorial">
        <h2 className="sheet-title">{title}</h2>
        {id === 'swipe-corners' && (
          <div className="tuto-corners" aria-hidden>
            <span className="tone-wish">{T.tutorial.corners.wish}</span>
            <span className="tuto-card">🎬</span>
            <span className="tone-yes">{T.tutorial.corners.good}</span>
            <span className="tone-no">{T.tutorial.corners.no}</span>
            <span className="tone-meh">{T.tutorial.corners.meh}</span>
          </div>
        )}
        <List>
          {points.map((p) => (
            <li key={p}>
              <Rich text={p} />
            </li>
          ))}
        </List>
        {note && <p className="muted small">{note}</p>}
        <button className="btn primary" onClick={close}>
          {T.common.understood}
        </button>
      </div>
    </Sheet>
  );
}
