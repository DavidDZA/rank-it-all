import { useEffect, useState, type ChangeEvent } from 'react';
import { num, T } from '../../i18n';
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
    setMsg(T.sync.starting);
    await requestPersistentStorage();
    try {
      const { found, added } = await importCustom(criteria, setMsg);
      const saved = await getCustomImports();
      if (!saved.some((c) => sameImport(c, criteria))) await setCustomImports([...saved, criteria]);
      setMsg(T.customImport.done(num(found), num(added)));
      setDraft({ ...draft, id: newCustomImport().id }); // critères gardés à l'écran, pour en essayer d'autres
    } catch (e) {
      setMsg(`✕ ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  const remove = async (c: CustomImport) => {
    if (!confirm(T.customImport.confirmRemove(customImportLabel(c)))) return;
    await setCustomImports((await getCustomImports()).filter((x) => x.id !== c.id));
  };

  const pick = (field: 'lang' | 'country') => (e: ChangeEvent<HTMLSelectElement>) => setDraft({ ...draft, [field]: e.target.value || null });

  return (
    <section className="card import-form" id="import">
      <h3>{T.customImport.title}</h3>
      <p className="muted small">
        {T.customImport.text}
      </p>
      <div className="row">
        <label className="field">
          {T.filterSheet.genre}
          <select className="input" value={draft.genre ?? ''} onChange={(e) => setDraft({ ...draft, genre: e.target.value ? Number(e.target.value) : null })}>
            <option value="">{T.customImport.all}</option>
            {genreOptions('movie').map((g) => (
              <option key={g.id} value={g.id}>
                {g.label}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          {T.filterSheet.language}
          <select className="input" value={draft.lang ?? ''} onChange={pick('lang')}>
            <option value="">{T.customImport.allLangs}</option>
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
          {T.customImport.country}
          <select className="input" value={draft.country ?? ''} onChange={pick('country')}>
            <option value="">{T.customImport.allCountries}</option>
            {IMPORT_COUNTRIES.map(([code, label]) => (
              <option key={code} value={code}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          {T.customImport.minVotes}
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
          {T.customImport.from}
          <input className="input" type="number" min={1870} max={YEAR + 1} placeholder="1870" value={text.from} onChange={(e) => setText({ ...text, from: e.target.value })} />
        </label>
        <label className="field">
          {T.customImport.to}
          <input className="input" type="number" min={1870} max={YEAR + 1} placeholder={String(YEAR)} value={text.to} onChange={(e) => setText({ ...text, to: e.target.value })} />
        </label>
      </div>
      <p className="muted small">
        {!hasCriteria(criteria)
          ? T.customImport.noCriteria
          : estimate !== null
            ? T.customImport.estimate(num(estimate))
            : T.customImport.summary(customImportLabel(criteria), num(criteria.minVotes))}
      </p>
      <button className="btn primary" onClick={run} disabled={busy || !ready} title={T.customImport.runTip}>
        {busy ? T.customImport.running : T.customImport.run}
      </button>
      {msg && <p className="small">{msg}</p>}
      {imports && imports.length > 0 && (
        <>
          <p className="small">{T.customImport.saved}</p>
          <ul className="import-list">
            {imports.map((c) => (
              <li key={c.id}>
                <span>
                  {customImportLabel(c)} <span className="muted small">{T.customImport.votesMin(num(c.minVotes))}</span>
                </span>
                <button className="btn small" onClick={() => remove(c)} title={T.customImport.removeTip} aria-label={T.customImport.removeAria(customImportLabel(c))}>
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
