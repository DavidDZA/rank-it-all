import { useEffect, useState } from 'react';
import type { MediaType, Title } from '../lib/db';
import { genreOptions, LANGS, NO_THEME, PERIODS, type PersonFilter, type Theme } from '../lib/themes';
import { personFilmography, searchPeople, type Person, type PersonRole } from '../lib/tmdb';
import { fixMinVotes, readPref, writePref } from '../lib/settings';
import { requestPersistentStorage } from '../lib/db';
import { syncCatalogue } from '../lib/sync';
import { syncAndWait } from '../lib/cloud';
import { PersonAvatar, Rich, Sheet } from './common';
import { num, T } from '../i18n';

/**
 * Fenêtre des filtres (swipe, classement, wishlist) : note minimum, période, genre, langue.
 * Le nombre de titres concernés se met à jour en direct ; les boutons restent visibles en bas.
 */
export function FilterSheet(props: {
  /** null : films et séries mélangés (pas de filtre par genre, les genres diffèrent). */
  type: MediaType | null;
  initial: Theme;
  count: (t: Theme) => number;
  /** Texte du bouton d'application, avec le nombre de titres (« C'est parti (1 234) »). */
  applyLabel: (n: number) => string;
  /** Le catalogue a-t-il les genres, langues et notes (sinon : mise à jour à faire) ? */
  hasCatalogueData: boolean;
  /** Titres dont les infos (genre, langue, note) sont en cours de récupération. */
  pendingInfo?: number;
  /** Titres du catalogue sans note (téléchargés avant qu'on l'enregistre) : mise à jour proposée sur place. */
  missingRatings?: number;
  /** Appelé après une mise à jour du catalogue faite depuis cette fenêtre. */
  onCatalogueUpdated?: () => void;
  /** Filmographie d'une personne choisie, reçue avant le filtre (le swipe y ajoute les titres hors catalogue). */
  onPersonTitles?: (titles: Title[]) => void;
  onApply: (t: Theme) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<Theme>({ ...props.initial, genre: props.type ? props.initial.genre : null });
  const [sync, setSync] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const n = props.count(draft);

  const updateCatalogue = async () => {
    setSyncing(true);
    setSync(T.sync.starting);
    await requestPersistentStorage();
    try {
      await syncAndWait(); // seuils de votes du compte
      const { movie, tv, anime } = await syncCatalogue(await fixMinVotes(), setSync);
      setSync(T.filterSheet.updated(num(movie + tv + anime)));
      props.onCatalogueUpdated?.();
    } catch (e) {
      setSync(`✕ ${(e as Error).message}`);
    } finally {
      setSyncing(false);
    }
  };

  return (
    <Sheet onClose={props.onClose} label={T.filterSheet.title}>
      <h2 className="sheet-title">
        <FilterIcon /> {T.filterSheet.title}
      </h2>
      {(props.missingRatings ?? 0) > 0 || sync ? (
        <div className="banner-soft small catalogue-update">
          {sync ?? (
            <Rich text={T.filterSheet.missingRatings(num(props.missingRatings!))} />
          )}
          {!syncing && !sync?.startsWith('✓') && (
            <button className="btn small primary" onClick={updateCatalogue} title={T.filterSheet.updateTip}>
              {T.filterSheet.update}
            </button>
          )}
        </div>
      ) : props.pendingInfo ? (
        <p className="banner-soft small">
          {T.filterSheet.pending(num(props.pendingInfo))}
        </p>
      ) : (
        !props.hasCatalogueData && <p className="banner-soft small">{T.filterSheet.noData}</p>
      )}

      <h3 className="sheet-label">
        {T.filterSheet.minRating} <b className="rating-value">{draft.minRating > 0 ? `⭐ ${num(draft.minRating)}` : T.filterSheet.anyRating}</b>
      </h3>
      <input
        className="rating-slider"
        type="range"
        min={0}
        max={10}
        step={0.5}
        value={draft.minRating}
        onChange={(e) => setDraft({ ...draft, minRating: Number(e.target.value) })}
        aria-label={T.filterSheet.minRatingAria}
      />
      <div className="rating-scale muted tiny">
        <span>0</span>
        <span>5</span>
        <span>10</span>
      </div>

      <h3 className="sheet-label">{T.filterSheet.period}</h3>
      <div className="chips">
        {PERIODS.map((p) => (
          <button key={p.id} className={`chip ${draft.period === p.id ? 'active' : ''}`} onClick={() => setDraft({ ...draft, period: p.id })}>
            {p.label}
          </button>
        ))}
      </div>

      <h3 className="sheet-label">{T.filterSheet.director}</h3>
      <PersonField role="director" value={draft.director ?? null} onChange={(p) => setDraft({ ...draft, director: p })} onTitles={props.onPersonTitles} />

      <h3 className="sheet-label">{T.filterSheet.actor}</h3>
      <PersonField role="actor" value={draft.actor ?? null} onChange={(p) => setDraft({ ...draft, actor: p })} onTitles={props.onPersonTitles} />

      <h3 className="sheet-label">{T.filterSheet.genre}</h3>
      {props.type ? (
        <div className="chips">
          <button className={`chip ${draft.genre === null ? 'active' : ''}`} onClick={() => setDraft({ ...draft, genre: null })}>
            {T.filterSheet.allGenres}
          </button>
          {genreOptions(props.type).map((g) => (
            <button key={g.id} className={`chip ${draft.genre === g.id ? 'active' : ''}`} onClick={() => setDraft({ ...draft, genre: g.id })}>
              {g.label}
            </button>
          ))}
        </div>
      ) : (
        <p className="muted small">{T.filterSheet.chooseType}</p>
      )}

      <h3 className="sheet-label">{T.filterSheet.language}</h3>
      <div className="chips">
        {LANGS.map((l) => (
          <button key={l.id} className={`chip ${draft.lang === l.id ? 'active' : ''}`} onClick={() => setDraft({ ...draft, lang: l.id })}>
            {l.label}
          </button>
        ))}
      </div>

      <div className="row center sheet-actions">
        <button className="btn" onClick={() => setDraft(NO_THEME)} title={T.filterSheet.resetTip}>
          {T.filterSheet.reset}
        </button>
        <button className="btn primary" onClick={() => props.onApply(draft)} disabled={n === 0} title={T.filterSheet.applyTip}>
          {props.applyLabel(n)}
        </button>
      </div>
    </Sheet>
  );
}

const PERSON_TEXT: Record<PersonRole, { icon: string; placeholder: string }> = {
  director: { icon: '🎥', placeholder: T.filterSheet.directorPlaceholder },
  actor: { icon: '🎭', placeholder: T.filterSheet.actorPlaceholder },
};

/** Choix d'une personne (recherche TMDB) ; sa filmographie devient le filtre. */
function PersonField(props: {
  role: PersonRole;
  value: PersonFilter | null;
  onChange: (p: PersonFilter | null) => void;
  onTitles?: (titles: Title[]) => void;
}) {
  const { icon, placeholder } = PERSON_TEXT[props.role];
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Person[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(() => {
      searchPeople(q, props.role)
        .then((found) => !cancelled && setResults(found.slice(0, 5)))
        .catch((e) => !cancelled && setError((e as Error).message));
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, props.role]);

  const choose = async (p: Person) => {
    setBusy(p.name);
    setError(null);
    try {
      const titles = await personFilmography(p.id, props.role);
      props.onTitles?.(titles);
      props.onChange({ id: p.id, name: p.name, keys: titles.map((t) => t.key) });
      setQuery('');
      setResults([]);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  if (props.value) {
    return (
      <div className="chips">
        <button className="chip active person-chip" onClick={() => props.onChange(null)} title={T.filterSheet.removeTip}>
          {icon} {props.value.name} <span aria-hidden>✕</span>
        </button>
      </div>
    );
  }
  return (
    <div className="person-field">
      <input className="input" type="search" placeholder={placeholder} value={query} onChange={(e) => setQuery(e.target.value)} />
      {busy && <p className="muted small">{T.filterSheet.filmography(busy)}</p>}
      {error && <p className="error small">{error}</p>}
      {!busy && results.length > 0 && (
        <ul className="person-results">
          {results.map((p) => (
            <li key={p.id}>
              <button onClick={() => choose(p)} title={T.filterSheet.filterOn(p.name)}>
                <PersonAvatar person={p} />
                <span className="person-result-text">
                  <b>{p.name}</b>
                  {p.knownFor.length > 0 && <span className="muted tiny">{p.knownFor.join(', ')}</span>}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Entonnoir de filtre (dessiné, comme dans un tableur). */
export function FilterIcon() {
  return (
    <svg className="icon-svg filter-icon" viewBox="0 0 24 24" aria-hidden>
      <path d="M4 5h16l-6 7.5V19l-4-2v-4.5z" />
    </svg>
  );
}

/** Bouton rond d'ouverture des filtres, en couleur quand un filtre est actif. */
export function FilterButton({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button className={`icon-btn filter-btn ${active ? 'active' : ''}`} onClick={onClick} aria-label={T.filterSheet.title} title={T.filterSheet.buttonTip(label)}>
      <FilterIcon />
    </button>
  );
}

/** Bandeau du filtre actif, sous la barre du haut ; le toucher rouvre les filtres. */
export function FilterStrip({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button className="theme-strip" onClick={onClick} title={T.filterSheet.changeTip}>
      <FilterIcon /> {label}
    </button>
  );
}

/** Filtre d'un écran, retenu d'une visite à l'autre (préférence locale). */
export function useSavedFilter(key: string): [Theme, (t: Theme) => void] {
  const [theme, setTheme] = useState<Theme>(() => readPref(key, NO_THEME));
  const save = (t: Theme) => {
    writePref(key, t);
    setTheme(t);
  };
  return [theme, save];
}
