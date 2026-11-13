import type { Title } from '../lib/db';
import { useLongPress } from '../lib/hooks';
import { Poster, RatingBadge, TitleText } from './common';
import { openFiche } from './Fiche';
import { T } from '../i18n';

/** Une des deux affiches d'un duel : toucher pour choisir ; ℹ (ou appui long) pour la fiche complète. */
export function DuelCard(props: { title: Title; state: string; onPick: (el: HTMLElement) => void }) {
  const { title: t } = props;
  const longPress = useLongPress(() => openFiche(t));
  return (
    <div
      role="button"
      tabIndex={0}
      className={`duel-card ${props.state}`}
      {...longPress}
      onClick={(e) => props.onPick(e.currentTarget)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          props.onPick(e.currentTarget);
        }
      }}
      title={T.duelCard.pickTip(t.title)}
    >
      <div className="duel-poster">
        <Poster title={t} size="w342" />
        <RatingBadge title={t} className="corner-left" />
        <button
          className="info-btn"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            openFiche(t);
          }}
          title={T.fiche.openTip}
          aria-label={T.duelCard.ficheOf(t.title)}
        >
          ℹ
        </button>
      </div>
      <TitleText title={t} credits />
    </div>
  );
}
