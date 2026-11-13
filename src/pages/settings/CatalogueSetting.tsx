import { useEffect, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, getMeta, requestPersistentStorage } from '../../lib/db';
import { DEFAULT_MIN_VOTES, getMinVotes, getShowAnime, hasTmdbAccess, setMinVotes, setShowAnime, VOTE_FIELDS, type MinVotes, type VoteField } from '../../lib/settings';
import { CATALOGUE_LANGS, langFlag, langName } from '../../lib/language';
import { LOCALE, num, T } from '../../i18n';
import { OLD_MOVIES_BEFORE, syncCatalogue } from '../../lib/sync';
import { isAnimeTitle } from '../../lib/category';
import { syncAndWait } from '../../lib/cloud';
import { useCatalogueDownload } from '../../lib/catalogueDownload';
import { CatalogueProgress, ProgressBar } from '../../components/CatalogueProgress';

const asText = (v: MinVotes) => Object.fromEntries(VOTE_FIELDS.map((k) => [k, String(v[k])])) as Record<VoteField, string>;

/** Titre de la ligne des titres dans la langue de l'utilisateur (« 🇪🇸 Titres en espagnol (langue originale) »). */
const langRowTitle = (lang: string | null) => (lang ? T.catalogue.langRow(langFlag(lang), langName(lang)) : T.catalogue.langRowNone);

/** Réglages → Catalogue : seuils de votes, catégorie Animes, téléchargement depuis TMDB. */
export function CatalogueSetting() {
  // Seuils enregistrés (et mis à jour par la synchro tant qu'on ne les a pas modifiés ici).
  const saved = useLiveQuery(getMinVotes);
  const showAnime = useLiveQuery(getShowAnime);
  // Saisie brute (le champ peut être vidé pendant la frappe) ; valeur par défaut remise à la sortie du champ.
  const [votes, setVotes] = useState<Record<VoteField, string>>(() => asText(DEFAULT_MIN_VOTES));
  // Langue des titres qui ont leur propre seuil : celle de l'appareil au départ (voir getMinVotes) ; null : aucune.
  const [lang, setLang] = useState<string | null>(null);
  const edited = useRef(false);
  useEffect(() => {
    if (saved && !edited.current) {
      setVotes(asText(saved));
      setLang(saved.lang);
    }
  }, [saved && JSON.stringify(saved)]);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);
  const [syncDone, setSyncDone] = useState(0);
  const download = useCatalogueDownload(); // premier téléchargement, lancé au démarrage

  const info = useLiveQuery(async () => ({
    movies: await db.titles.where('type').equals('movie').count(),
    series: await db.titles.where('type').equals('tv').count(),
    animes: await db.titles.where('type').equals('tv').filter(isAnimeTitle).count(),
    lastSync: await getMeta<number | null>('lastSync', null),
  }));

  const editVotes = (field: VoteField, value: string) => {
    edited.current = true;
    setVotes((v) => ({ ...v, [field]: value }));
  };
  const editLang = (value: string) => {
    edited.current = true;
    setLang(value || null);
  };
  const minVotes = (field: VoteField) => {
    const n = Math.floor(Number(votes[field]));
    return votes[field].trim() !== '' && n >= 1 ? n : DEFAULT_MIN_VOTES[field];
  };
  const resetIfInvalid = (field: VoteField) => setVotes((v) => ({ ...v, [field]: String(minVotes(field)) }));

  /** Champs des seuils, par ligne : un titre est gardé s'il passe l'un des seuils qui le concernent. */
  const voteRows: { title: string; fields: [VoteField, string][]; lang?: true }[] = [
    { title: T.catalogue.minVotes, fields: [['movie', T.catalogue.movies], ['tv', T.catalogue.series], ['anime', T.catalogue.animes]] },
    { title: langRowTitle(lang), fields: lang ? [['langMovie', T.catalogue.movies], ['langTv', T.catalogue.series]] : [], lang: true },
    { title: T.catalogue.oldMovies(OLD_MOVIES_BEFORE), fields: [['oldMovie', T.catalogue.movies]] },
  ];

  const sync = async () => {
    setSyncing(true);
    setSyncMsg(T.sync.starting);
    setSyncDone(0);
    await requestPersistentStorage();
    try {
      // Sans saisie ici : les seuils du compte, à jour (ceux d'un autre appareil ont pu changer).
      if (!edited.current) await syncAndWait();
      const chosen: MinVotes = edited.current
        ? { ...(Object.fromEntries(VOTE_FIELDS.map((k) => [k, minVotes(k)])) as Record<VoteField, number>), lang }
        : await getMinVotes();
      setVotes(asText(chosen));
      setLang(chosen.lang);
      edited.current = false;
      await setMinVotes(chosen);
      const { movie, tv, anime, removed } = await syncCatalogue(chosen, (message, done) => {
        setSyncMsg(message);
        if (done !== undefined) setSyncDone(done);
      });
      setSyncMsg(T.catalogue.done(num(movie), num(tv), num(anime)) + (removed ? T.catalogue.removed(num(removed)) : ''));
    } catch (e) {
      setSyncMsg(`✕ ${(e as Error).message}`);
    } finally {
      setSyncing(false);
    }
  };

  const toggleShowAnime = () => {
    if (showAnime === undefined) return;
    setShowAnime(!showAnime);
    setSyncMsg(showAnime ? T.catalogue.animeHidden : T.catalogue.animeShown);
  };

  return (
    <section className="card" id="catalogue">
      <h3>{T.catalogue.title}</h3>
      <p className="muted small">
        {info ? T.catalogue.counts(num(info.movies), num(info.series - info.animes), num(info.animes)) : '…'}
        <br />
        {info?.lastSync ? T.catalogue.lastSync(new Date(info.lastSync).toLocaleString(LOCALE)) : T.catalogue.never}
      </p>
      <p className="muted small">
        {T.catalogue.explain}
      </p>
      {voteRows.map((row) => (
        <div key={row.lang ? 'lang' : row.title} className="vote-row">
          <p className="small">{row.title}</p>
          {row.lang && (
            <label className="field">
              {T.filterSheet.language}
              <select
                className="input"
                value={lang ?? ''}
                onChange={(e) => editLang(e.target.value)}
                title={T.catalogue.langTip}
              >
                <option value="">{T.catalogue.noLang}</option>
                {CATALOGUE_LANGS.map(([code, label]) => (
                  <option key={code} value={code}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
          )}
          {row.fields.length > 0 && (
            <div className="row">
              {row.fields.map(([key, label]) => (
                <label key={key} className="field">
                  {label}
                  <input className="input" type="number" min={1} value={votes[key]} onChange={(e) => editVotes(key, e.target.value)} onBlur={() => resetIfInvalid(key)} />
                </label>
              ))}
            </div>
          )}
        </div>
      ))}
      <div className="chips">
        <button
          className={`chip ${showAnime ? 'active' : ''}`}
          onClick={toggleShowAnime}
          disabled={showAnime === undefined}
          title={T.catalogue.showAnimeTip}
        >
          {T.catalogue.showAnime}
        </button>
      </div>
      <CatalogueProgress compact />
      <button
        className="btn primary"
        onClick={sync}
        disabled={syncing || download.running || !hasTmdbAccess()}
        title={T.catalogue.syncTip}
      >
        {syncing || download.running ? T.catalogue.syncing : info?.lastSync ? T.catalogue.update : T.swipe.download}
      </button>
      {syncing && <ProgressBar done={syncDone} />}
      {syncMsg && <p className="small">{syncMsg}</p>}
      <p className="muted small">{T.catalogue.removalNote}</p>
    </section>
  );
}
