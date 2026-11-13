import { downloadCatalogue, useCatalogueDownload } from '../lib/catalogueDownload';
import { T } from '../i18n';

/** Barre de progression (0 à 1), avec le pourcentage pour les lecteurs d'écran. */
export function ProgressBar({ done }: { done: number }) {
  const pct = Math.round(Math.min(1, Math.max(0, done)) * 100);
  return (
    <span className="progress-bar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
      <span style={{ width: `${pct}%` }} />
    </span>
  );
}

/**
 * Téléchargement du catalogue en cours (ou en échec) : titre, barre, détail. Rien sinon.
 * `compact` : sans la phrase d'explication (swipe, réglages).
 */
export function CatalogueProgress({ compact = false }: { compact?: boolean }) {
  const d = useCatalogueDownload();
  if (d.error)
    return (
      <div className="banner-soft catalogue-progress">
        <p>
          <b>{T.progress.failed}</b>
        </p>
        <p className="small muted">✕ {d.error}</p>
        <button className="btn small primary" onClick={() => downloadCatalogue()} title={T.progress.retryTip}>
          {T.common.retry}
        </button>
      </div>
    );
  if (!d.running) return null;
  return (
    <div className="banner-soft catalogue-progress" aria-live="polite">
      <p className="catalogue-progress-head">
        <b>{T.progress.preparing}</b>
        <span className="muted">{Math.round(d.done * 100)} %</span>
      </p>
      <ProgressBar done={d.done} />
      <p className="small muted">
        {d.message}
        {!compact && T.progress.firstTime}
      </p>
    </div>
  );
}
