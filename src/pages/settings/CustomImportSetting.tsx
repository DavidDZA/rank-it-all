import { useEffect, useState, type ChangeEvent } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { requestPersistentStorage } from '../../lib/db';
import {
  customImportLabel,
  DEFAULT_IMPORT_VOTES,
  getCustomImports,
  hasCriteria,
  IMPORT_COUNTRIES,
  IMPORT_LANGS,
  newCustomImport,
  sameImport,
  setCustomImports,
  type CustomImport,
} from '../../lib/customImports';
import { countCustom, importCustom } from '../../lib/sync';
import { genreOptions } from '../../lib/themes';
import { hasTmdbAccess } from '../../lib/settings';

const YEAR = new Date().getFullYear();

/** Année saisie (vide ou hors bornes : pas de limite). */
const asYear = (s: string) => {
  const n = Math.floor(Number(s));
  return s.trim() !== '' && n >= 1870 && n <= YEAR + 1 ? n : null;
};

/**
 * Réglages → Import sur mesure : films d'un genre, d'une langue, d'un pays ou d'une période, avec un seuil de votes
 * plus bas que celui du catalogue. Lancé tout de suite, puis relancé à chaque mise à jour du catalogue.
 */
export function CustomImportSetting() {
  const imports = useLiveQuery(getCustomImports);
  const [draft, setDraft] = useState<CustomImport>(newCustomImport);
  // Saisie brute des champs numériques (vidables pendant la frappe).
  const [text, setText] = useState({ votes: String(DEFAULT_IMPORT_VOTES), from: '', to: '' });
  const [estimate, setEstimate] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const votes = Math.floor(Number(text.votes));
  const criteria: CustomImport = {
    ...draft,
    minVotes: text.votes.trim() !== '' && votes >= 1 ? votes : DEFAULT_IMPORT_VOTES,
    from: asYear(text.from),
    to: asYear(text.to),
  };
  const ready = hasCriteria(criteria) && !!hasTmdbAccess();

  // Nombre de films correspondants chez TMDB, mis à jour pendant la saisie.
  const key = JSON.stringify({ ...criteria, id: '' });
  useEffect(() => {
    setEstimate(null);
    if (!ready) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      countCustom(criteria)
        .then((n) => !cancelled && setEstimate(n))
        .catch(() => {});
    }, 500);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [key, ready]);

  const run = async () => {
    setBusy(true);
    setMsg('Démarrage…');
    await requestPersistentStorage();
    try {
      const { found, added } = await importCustom(criteria, setMsg);
      const saved = await getCustomImports();
      if (!saved.some((c) => sameImport(c, criteria))) await setCustomImports([...saved, criteria]);
      const n = (x: number) => x.toLocaleString('fr-FR');
      setMsg(`✓ ${n(found)} films trouvés, dont ${n(added)} nouveaux au catalogue. Ils seront gardés à chaque mise à jour.`);
      setDraft({ ...draft, id: newCustomImport().id }); // critères gardés à l'écran, pour en essayer d'autres
    } catch (e) {
      setMsg(`✕ ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  const remove = async (c: CustomImport) => {
    if (!confirm(`Supprimer l’import « ${customImportLabel(c)} » ? Ses films partiront à la prochaine mise à jour du catalogue, sauf ceux vus ou en wishlist.`)) return;
    await setCustomImports((await getCustomImports()).filter((x) => x.id !== c.id));
  };

  const pick = (field: 'lang' | 'country') => (e: ChangeEvent<HTMLSelectElement>) => setDraft({ ...draft, [field]: e.target.value || null });

  return (
    <section className="card import-form" id="import">
      <h3>🧩 Import sur mesure (films)</h3>
      <p className="muted small">
        Il te manque des films d’un genre, d’une langue, d’un pays ou d’une époque ? Récupère-les avec un seuil de votes plus bas que celui du catalogue.
        L’import est gardé et relancé à chaque mise à jour du catalogue (et suit ton compte).
      </p>
      <div className="row">
        <label className="field">
          Genre
          <select className="input" value={draft.genre ?? ''} onChange={(e) => setDraft({ ...draft, genre: e.target.value ? Number(e.target.value) : null })}>
            <option value="">Tous</option>
            {genreOptions('movie').map((g) => (
              <option key={g.id} value={g.id}>
                {g.label}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          Langue originale
          <select className="input" value={draft.lang ?? ''} onChange={pick('lang')}>
            <option value="">Toutes</option>
            {IMPORT_LANGS.map(([code, label]) => (
              <option key={code} value={code}>
                {label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="row">
        <label className="field">
          Pays de production
          <select className="input" value={draft.country ?? ''} onChange={pick('country')}>
            <option value="">Tous</option>
            {IMPORT_COUNTRIES.map(([code, label]) => (
              <option key={code} value={code}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          Votes minimum
          <input
            className="input"
            type="number"
            min={1}
            value={text.votes}
            onChange={(e) => setText({ ...text, votes: e.target.value })}
            onBlur={() => setText({ ...text, votes: String(criteria.minVotes) })}
          />
        </label>
      </div>
      <div className="row">
        <label className="field">
          Sortis à partir de
          <input className="input" type="number" min={1870} max={YEAR + 1} placeholder="1870" value={text.from} onChange={(e) => setText({ ...text, from: e.target.value })} />
        </label>
        <label className="field">
          Jusqu’à
          <input className="input" type="number" min={1870} max={YEAR + 1} placeholder={String(YEAR)} value={text.to} onChange={(e) => setText({ ...text, to: e.target.value })} />
        </label>
      </div>
      <p className="muted small">
        {!hasCriteria(criteria)
          ? 'Choisis au moins un critère. Pour tous les films, baisse plutôt le seuil du catalogue ci-dessus.'
          : estimate !== null
            ? `≈ ${estimate.toLocaleString('fr-FR')} films correspondent sur TMDB (y compris ceux déjà au catalogue).`
            : `Films « ${customImportLabel(criteria)} » avec au moins ${criteria.minVotes.toLocaleString('fr-FR')} votes.`}
      </p>
      <button className="btn primary" onClick={run} disabled={busy || !ready} title="Récupérer ces films depuis TMDB et garder cet import">
        {busy ? 'Import en cours…' : 'Importer ces films'}
      </button>
      {msg && <p className="small">{msg}</p>}
      {imports && imports.length > 0 && (
        <>
          <p className="small">Imports gardés :</p>
          <ul className="import-list">
            {imports.map((c) => (
              <li key={c.id}>
                <span>
                  {customImportLabel(c)} <span className="muted small">· {c.minVotes.toLocaleString('fr-FR')} votes min.</span>
                </span>
                <button className="btn small" onClick={() => remove(c)} title="Supprimer cet import" aria-label={`Supprimer l’import ${customImportLabel(c)}`}>
                  ✕
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
