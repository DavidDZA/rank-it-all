import type { SagaTag } from './pool';
import { T } from '../../i18n';

/** Bouton rond du swipe, avec sa légende et (option) la flèche de son coin. */
export function ActionButton(props: {
  className: string;
  icon: string;
  badge?: string;
  caption: string;
  tip: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <div className="action">
      <button className={`round-btn ${props.className}`} onClick={props.onClick} disabled={props.disabled} title={props.tip} aria-label={props.caption}>
        {props.icon}
        {props.badge && <span className="btn-badge">{props.badge}</span>}
      </button>
      <span className="action-caption">{props.caption}</span>
    </div>
  );
}

/** En haut à gauche de l'affiche d'un film de saga : « 🎞️ Harry Potter · 2/8 ». */
export function CardTag({ saga }: { saga?: SagaTag }) {
  if (!saga) return null;
  return (
    <span className="card-tag saga-tag" title={T.swipe.sagaTip(saga.name, saga.position, saga.total)}>
      <span className="saga-name">🎞️ {saga.name}</span>
      <span className="saga-count">
        · {saga.position}/{saga.total}
      </span>
    </span>
  );
}

/** En bas de l'affiche d'un film de saga : écarte d'un coup les `left` films de la saga restant à trier. */
export function SagaDropButton({ left, onDrop }: { left: number; onDrop: () => void }) {
  return (
    <button
      className="saga-drop"
      // Le bouton est sur la carte : l'appui ne doit pas commencer un glissement.
      onPointerDown={(e) => e.stopPropagation()}
      onClick={onDrop}
      title={T.swipe.dropSagaTip(left)}
    >
      {T.swipe.dropSaga(left)}
    </button>
  );
}
