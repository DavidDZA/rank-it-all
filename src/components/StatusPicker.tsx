import { useState } from 'react';
import { createPortal } from 'react-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type Status, type Tier, type Title } from '../lib/db';
import { moveTitle, placeOf, PLACES, type Place } from '../lib/ranking';
import { boostFrom } from '../lib/recommend';
import { toast } from '../lib/fun';
import { T } from '../i18n';
import { IconCaption, Sheet } from './common';

/**
 * État d'un titre, modifiable partout de la même façon (16/11, demande de l'utilisateur : « on devrait toujours pouvoir
 * déplacer un titre, dans n'importe quel état ») : 👍 vu · bien, 😐 vu · bof, 💖 envie (wishlist), 💤 pas envie, ↺ à
 * trier (comme jamais trié : il revient au swipe). Un seul bouton par ligne de liste (son état actuel, avec son mot) ;
 * le toucher ouvre les 5 choix. La fiche les montre directement (StatusChoices).
 */

export const PLACE_ICON: Record<Place | 'seen', string> = {
  good: '👍',
  meh: '😐',
  wish: '💖',
  unseen: '💤',
  none: '↺',
  seen: '✓',
};

/** Change l'état, avec un message ; un titre aimé met en avant ses recommandations au swipe (comme au swipe). */
async function move(title: Title, place: Place, onChanged?: () => void): Promise<void> {
  await moveTitle(title, place);
  if (place === 'good') boostFrom(title);
  toast(T.status.moved(title.title, `${PLACE_ICON[place]} ${T.status.label[place]}`));
  onChanged?.();
}

/** Lit l'état d'un titre quand l'écran ne le connaît pas déjà (fiche, pages « À deux »). */
function useAnswer(title: Title, known: PickerProps['current']): PickerProps['current'] {
  const live = useLiveQuery(
    async () => (known === undefined ? ((await db.answers.get(title.key)) ?? null) : undefined),
    [title.key, known === undefined],
  );
  return known === undefined ? live : known;
}

export interface PickerProps {
  title: Title;
  /** Réponse actuelle (null : jamais trié) ; absente : lue dans la base. */
  current?: { status: Status; tier?: Tier | null } | null;
  /** Le titre est dans le classement : le sortir des vus le retire du classement, on demande d'abord. */
  ranked?: boolean;
  onChanged?: () => void;
}

/** Bouton de l'état d'un titre dans une ligne de liste : l'état actuel et son mot ; le toucher ouvre les 5 choix. */
export function StatusButton({ title, current, ranked, onChanged }: PickerProps) {
  const answer = useAnswer(title, current);
  const [open, setOpen] = useState(false);
  const place = placeOf(answer);
  return (
    <>
      <button
        className={`btn small labeled status-btn place-${place}`}
        onClick={() => setOpen(true)}
        aria-label={T.status.buttonAria(title.title, T.status.label[place])}
        title={T.status.buttonTip}
      >
        <IconCaption icon={PLACE_ICON[place]} caption={T.status.short[place]} />
      </button>
      {open &&
        createPortal(
          <Sheet onClose={() => setOpen(false)} label={T.status.sheetTitle(title.title)}>
            <h2 className="sheet-title">{T.status.sheetTitle(title.title)}</h2>
            <StatusChoices
              title={title}
              current={answer ?? null}
              ranked={ranked}
              onChanged={() => {
                setOpen(false);
                onChanged?.();
              }}
            />
          </Sheet>,
          document.body, // hors de la ligne : une ligne déplaçable (classement) décale tout ce qu'elle contient
        )}
    </>
  );
}

/** Les 5 états d'un titre, l'actuel marqué ; `compact` : sur une ligne (fiche), sinon en liste avec leur explication. */
export function StatusChoices({ title, current, ranked, onChanged, compact = false }: PickerProps & { compact?: boolean }) {
  const answer = useAnswer(title, current);
  const place = placeOf(answer);
  const choose = async (p: Place) => {
    const leaving = ranked && (place === 'good' || place === 'meh' || place === 'seen') && p !== 'good' && p !== 'meh';
    if (leaving && !confirm(T.status.confirmLeave(title.title))) return;
    await move(title, p, onChanged);
  };
  return (
    <div className={`status-choices ${compact ? 'compact' : ''}`} role="group" aria-label={T.status.sheetTitle(title.title)}>
      {PLACES.map((p) => {
        const here = p === place;
        return compact ? (
          <button
            key={p}
            className={`btn small labeled status-choice place-${p} ${here ? 'primary' : ''}`}
            onClick={() => choose(p)}
            disabled={here}
            aria-label={T.status.label[p]}
            title={T.status.hint[p]}
          >
            <IconCaption icon={PLACE_ICON[p]} caption={T.status.short[p]} />
          </button>
        ) : (
          <button
            key={p}
            className={`status-choice place-${p} ${here ? 'here' : ''}`}
            onClick={() => choose(p)}
            disabled={here}
            aria-label={T.status.label[p]}
          >
            <span className="status-icon" aria-hidden>
              {PLACE_ICON[p]}
            </span>
            <span className="status-text">
              <b>{T.status.label[p]}</b>
              <span className="muted small">{T.status.hint[p]}</span>
            </span>
            {here && <span className="status-here">{T.status.here}</span>}
          </button>
        );
      })}
    </div>
  );
}
