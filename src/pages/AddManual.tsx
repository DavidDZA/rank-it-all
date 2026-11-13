import { useEffect, useState } from 'react';
import { T } from '../i18n';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type Answer, type Status, type Title } from '../lib/db';
import { changeStatus } from '../lib/ranking';
import { KNOWN_VOTES, personFilmography, search, searchPeople, type Person, type PersonRole } from '../lib/tmdb';
import { PersonAvatar, SeenButtons, TitleRow, TopBar, TypeFilter } from '../components/common';
import { Tutorial } from '../components/Tutorial';
import { tutorialSeen } from '../lib/tutorial';

type Mode = 'title' | PersonRole;

const PLACEHOLDER: Record<Mode, string> = {
  title: T.add.titlePlaceholder,
  director: T.filterSheet.directorPlaceholder,
  actor: T.filterSheet.actorPlaceholder,
};

/** Métier principal d'une personne selon TMDB. */
const DEPARTMENTS: Record<string, string> = T.add.departments;

/** Ajout manuel : par titre, ou par réalisateur / acteur (on choisit la personne, puis sa filmographie). */
export default function AddManual() {
  // Première visite : pas de focus dans la recherche, le clavier du téléphone cacherait l'astuce.
  const [focusSearch] = useState(() => tutorialSeen('add'));
  const [mode, setMode] = useState<Mode>('title');
  const [query, setQuery] = useState('');
  const [titles, setTitles] = useState<Title[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [person, setPerson] = useState<Person | null>(null);
  const [works, setWorks] = useState<Title[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Recherche (titres ou personnes) pendant la saisie.
  useEffect(() => {
    const q = query.trim();
    setPerson(null);
    if (q.length < 2) {
      setTitles([]);
      setPeople([]);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        if (mode === 'title') {
          const found = await search(q);
          if (!cancelled) setTitles(found);
        } else {
          const found = await searchPeople(q, mode);
          if (!cancelled) setPeople(found);
        }
      } catch (e) {
        if (!cancelled) setError((e as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, mode]);

  // Filmographie de la personne choisie.
  useEffect(() => {
    if (!person || mode === 'title') return;
    let cancelled = false;
    setWorks(null);
    personFilmography(person.id, mode)
      .then((list) => !cancelled && setWorks(list))
      .catch((e) => !cancelled && setError((e as Error).message));
    return () => {
      cancelled = true;
    };
  }, [person, mode]);

  const shown = person ? (works ?? []) : titles;
  const shownKeys = shown.map((r) => r.key).join('|');
  const statuses = useLiveQuery(async () => {
    const answers = await db.answers.bulkGet(shownKeys ? shownKeys.split('|') : []);
    return new Map(answers.filter((a): a is Answer => !!a).map((a) => [a.key, a]));
  }, [shownKeys]);

  const row = (t: Title) => (
    <TitleRow key={t.key} title={t} showType>
      <SeenButtons title={t} current={statuses?.get(t.key)} />
      <StatusButton title={t} status="wish" current={statuses?.get(t.key)?.status} label="♥" tip={T.fiche.wishTip} />
    </TitleRow>
  );

  const known = (works ?? []).filter((t) => t.voteCount >= KNOWN_VOTES);
  const lesser = (works ?? []).filter((t) => t.voteCount < KNOWN_VOTES);
  const seenCount = (works ?? []).filter((t) => statuses?.get(t.key)?.status === 'seen').length;

  return (
    <main className="page">
      <Tutorial id="add" />
      <TopBar title={T.add.title} />
      <TypeFilter<Mode>
        value={mode}
        options={[
          ['title', T.add.byTitle, T.add.byTitleTip],
          ['director', T.filterSheet.director, T.add.byDirectorTip],
          ['actor', T.filterSheet.actor, T.add.byActorTip],
        ]}
        onChange={(m) => {
          setMode(m);
          setPerson(null);
        }}
      />
      <input className="input" type="search" placeholder={PLACEHOLDER[mode]} value={query} onChange={(e) => setQuery(e.target.value)} autoFocus={focusSearch} />
      {loading && <p className="muted center">{T.add.searching}</p>}
      {error && <p className="error">{error}</p>}

      {mode === 'title' ? (
        <>
          {!loading && query.trim().length >= 2 && !titles.length && !error && <p className="muted center">{T.add.noResult}</p>}
          <ul className="list">{titles.map(row)}</ul>
        </>
      ) : person ? (
        <>
          <div className="person-head">
            <button className="btn small" onClick={() => setPerson(null)} title={T.add.backTip}>
              {T.add.back}
            </button>
            <PersonAvatar person={person} />
            <div className="person-name">
              <b>{person.name}</b>
              <span className="muted small">
                {works === null
                  ? T.common.loading
                  : T.add.works(works.length, mode === 'director', seenCount)}
              </span>
            </div>
          </div>
          {works !== null && !works.length && <p className="muted center">{T.add.noWorks}</p>}
          <ul className="list">{known.map(row)}</ul>
          {lesser.length > 0 && (
            <details className="lesser">
              <summary title={T.add.lesserTip}>{T.add.lesser(lesser.length)}</summary>
              <ul className="list">{lesser.map(row)}</ul>
            </details>
          )}
        </>
      ) : (
        <>
          {!loading && query.trim().length >= 2 && !people.length && !error && <p className="muted center">{T.add.noPerson}</p>}
          <ul className="list">
            {people.map((p) => (
              <li key={p.id} className="list-item person-row" role="button" tabIndex={0} onClick={() => setPerson(p)} title={T.add.filmographyTip(p.name)}>
                <PersonAvatar person={p} />
                <div className="row-text">
                  <div className="title-main">{p.name}</div>
                  <div className="title-meta">
                    {DEPARTMENTS[p.department] ?? p.department}
                    {p.knownFor.length > 0 && ` · ${p.knownFor.join(', ')}`}
                  </div>
                </div>
                <span className="person-arrow">›</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </main>
  );
}


function StatusButton({ title, status, current, label, tip }: { title: Title; status: Status; current?: Status; label: string; tip: string }) {
  const active = current === status;
  return (
    <button
      className={`btn small ${active ? 'primary' : ''}`}
      onClick={() => changeStatus(title, status)}
      disabled={active}
      title={active ? (status === 'seen' ? T.add.alreadySeen : T.add.alreadyWish) : tip}
    >
      {active && status === 'seen' ? T.fiche.status.seen : label}
    </button>
  );
}
