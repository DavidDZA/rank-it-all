import { useRef, useState } from 'react';
import { exportData, importData } from '../../lib/backup';
import { useCloud } from '../../lib/cloud';
import { T } from '../../i18n';

/**
 * Réglages → Sauvegarde : export / import d'un fichier JSON. Rarement utile : avec un compte, tout est synchronisé
 * (et la base sauvegardée chaque nuit) ; sans compte, mieux vaut en créer un. Reste pour garder une copie à soi.
 */
export function BackupSetting() {
  const [msg, setMsg] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const signedIn = !!useCloud().user;

  const onImport = async (file: File | undefined) => {
    if (!file) return;
    if (!confirm(T.backup.confirm)) return;
    try {
      const n = await importData(file);
      setMsg(T.backup.restored(n));
    } catch (e) {
      setMsg(`✕ ${(e as Error).message}`);
    }
  };

  return (
    <section className="card">
      <h3>{T.backup.title}</h3>
      <p className="muted small">
        {signedIn
          ? T.backup.signedIn
          : T.backup.signedOut}
      </p>
      <div className="row">
        <button className="btn" onClick={() => exportData()} title={T.backup.exportTip}>
          {T.home.export}
        </button>
        <button className="btn" onClick={() => fileInput.current?.click()} title={T.backup.importTip}>
          {T.backup.import}
        </button>
        <input ref={fileInput} type="file" accept="application/json,.json" hidden onChange={(e) => onImport(e.target.files?.[0])} />
      </div>
      {msg && <p className="small">{msg}</p>}
    </section>
  );
}
