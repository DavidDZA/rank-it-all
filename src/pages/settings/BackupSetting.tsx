import { useRef, useState } from 'react';
import { exportData, importData } from '../../lib/backup';
import { useCloud } from '../../lib/cloud';

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
    if (!confirm('Remplacer toutes tes réponses et classements actuels par cette sauvegarde ?')) return;
    try {
      const n = await importData(file);
      setMsg(`✓ ${n} réponses restaurées.`);
    } catch (e) {
      setMsg(`✕ ${(e as Error).message}`);
    }
  };

  return (
    <section className="card">
      <h3>💾 Sauvegarde</h3>
      <p className="muted small">
        {signedIn
          ? 'Rien à faire : tes données sont enregistrées sur ton compte. Ce fichier ne sert qu’à en garder une copie à toi.'
          : 'Sans compte, tes données ne sont que sur cet appareil : connecte-toi (en haut de la page) pour ne plus jamais les perdre, ou garde-en une copie dans un fichier.'}
      </p>
      <div className="row">
        <button className="btn" onClick={() => exportData()} title="Télécharger un fichier avec tes réponses et classements">
          Exporter
        </button>
        <button className="btn" onClick={() => fileInput.current?.click()} title="Restaurer une sauvegarde (remplace les données actuelles)">
          Importer
        </button>
        <input ref={fileInput} type="file" accept="application/json,.json" hidden onChange={(e) => onImport(e.target.files?.[0])} />
      </div>
      {msg && <p className="small">{msg}</p>}
    </section>
  );
}
