import { useEffect, useRef, useState } from 'react';
import { clearStatus, db, setStatus, type Status, type Tier, type Title } from '../../lib/db';
import { CATEGORY_LABEL, capitalize, categoryOf, mediaOf, type Category } from '../../lib/category';
import { burst, centerOf, MILESTONES, pick, toast } from '../../lib/fun';
import { recordActivity } from '../../lib/activity';
import { boostFactor, boostFrom, loadBoosts, type Boosts } from '../../lib/recommend';
import { getSwipeMode, readPref, writePref } from '../../lib/settings';
import { isNoTheme, matchesTheme, NO_THEME, ratingMissing, themeLabel, type Theme } from '../../lib/themes';
import { BackLink, IconCaption, Poster, RatingBadge, TitleText } from '../../components/common';
import SwipeCard, { type Dir, type Tone } from '../../components/SwipeCard';
import { openFiche } from '../../components/Fiche';
import { ARROWS, CORNERS, isCorner, PHASES, TONES, type Corner, type Phase } from './config';
import {
  chainSaga,
  draw,
  loadCatalogue,
  prefetch,
  QUEUE_SIZE,
  removeFromPool,
  sagaInQueue,
  sagaKnownLocally,
  sagaOf,
  sagaTags,
  WEIGHT_EXP,
  type Pool,
  type SagaInfo,
  type SagaTag,
} from './pool';
import { FilterButton, FilterIcon, FilterSheet } from '../../components/FilterSheet';
import { ActionButton, CardTag, RecoWhy, SagaDropButton } from './controls';
import { KNOWN_VOTES, personFilmography } from '../../lib/tmdb';
import { buildProposals, likedCount, RECO_MIN_LIKED, recordRecoAnswer, type Proposal } from '../../lib/proposals';
import { rememberTaste } from '../../lib/taste';
import { ProgressBar } from '../../components/CatalogueProgress';
import { downloadCatalogue, useCatalogueDownload } from '../../lib/catalogueDownload';
import { CatalogueProgress } from '../../components/CatalogueProgress';
import { Tutorial } from '../../components/Tutorial';
import { num, T } from '../../i18n';

const FLIP_MS = 350; // durée du retournement de la carte (animation flip-in)
/** Propositions « selon tes goûts » recalculées toutes les RECO_REFRESH réponses (le modèle apprend en continu). */
const RECO_REFRESH = 10;

export default function Swipe({ category }: { category: Category }) {
  const media = mediaOf(category); // type TMDB (les animes sont des séries pour TMDB)
  const [mode] = useState(getSwipeMode);
  const themeKey = `swipe-theme:${category}`;
  const pool = useRef<Pool>({ items: [], total: 0 });
  const catalogue = useRef<Title[]>([]);
  // Titres recommandés d'après ceux que tu as aimés : tirés plus souvent.
  const boosts = useRef<Boosts>({});
  const weightOf = (t: Title) => Math.pow(Math.max(t.voteCount, 1), WEIGHT_EXP) * boostFactor(boosts.current[t.key]);
  const answered = useRef(new Set<string>());
  const [loaded, setLoaded] = useState(false);
  const [catalogueVersion, setCatalogueVersion] = useState(0); // relance le chargement après une mise à jour
  const download = useCatalogueDownload();
  const downloadSeen = useRef(download.version);
  useEffect(() => {
    if (download.version === downloadSeen.current) return;
    downloadSeen.current = download.version;
    setCatalogueVersion((v) => v + 1); // téléchargement terminé pendant qu'on est là : catalogue relu
  }, [download.version]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [theme, setTheme] = useState<Theme>(() => readPref(themeKey, NO_THEME));
  const [showThemes, setShowThemes] = useState(false);
  const [queue, setQueueState] = useState<Title[] | null>(null);
  // Copie de la file, lisible depuis les traitements asynchrones (détection des sagas).
  const queueRef = useRef<Title[] | null>(null);
  const setQueue = (q: Title[]) => {
    queueRef.current = q;
    setQueueState(q);
  };
  const [phase, setPhase] = useState<Phase>('seen');
  const [fling, setFling] = useState<Dir | null>(null);
  // Réponses à pouvoir annuler : un titre, ou toute une saga écartée d'un coup.
  const [history, setHistory] = useState<Title[][]>([]);
  const [count, setCount] = useState(0);
  // Sagas déjà enchaînées, et étiquette « 🎞️ saga · n/N » de chacun de leurs films.
  const chainedSagas = useRef(new Set<number>());
  const [tags, setTags] = useState<Record<string, SagaTag>>({});
  // Mode 2 directions : la carte de derrière attend la fin du retournement pour la 2e question.
  const [flipping, setFlipping] = useState(false);
  const cardArea = useRef<HTMLDivElement>(null);

  // Propositions « selon tes goûts » (bouton 🎯), retenues d'une visite à l'autre pour chaque catégorie.
  const recoKey = `swipe-reco:${category}`;
  const [reco, setRecoState] = useState<boolean>(() => readPref(recoKey, false));
  const recoRef = useRef(reco);
  const proposals = useRef(new Map<string, Proposal>());
  // Propositions prêtes (version, 0 : en préparation), avancement de la préparation, échec.
  const [recoVersion, setRecoVersion] = useState(0);
  const [recoProgress, setRecoProgress] = useState(0);
  const [recoError, setRecoError] = useState(false);
  const [recoAttempt, setRecoAttempt] = useState(0);
  const recoAnswers = useRef(0);
  // Réponses données aux propositions, pour les retirer de la mesure en cas d'« Annuler ».
  const recoAnswered = useRef(new Map<string, { status: Status; tier?: Tier; explore: boolean }>());
  const recoReady = recoVersion > 0;

  const fill = (q: Title[]) => {
    const next = [...q];
    while (next.length < QUEUE_SIZE) {
      const t = draw(pool.current);
      if (!t) break;
      prefetch(t);
      chainIfSaga(t);
      next.push(t);
    }
    return next;
  };

  /** Met une saga dans la file à la place du titre tiré (à `index`), du 1er film à trier au dernier. */
  const insertSaga = (q: Title[], index: number, saga: SagaInfo, keepFirst: boolean): Title[] | null => {
    chainedSagas.current.add(saga.id);
    setTags((prev) => ({ ...prev, ...sagaTags(saga) }));
    const parts = saga.parts.filter((p) => !answered.current.has(p.key));
    if (parts.length < 2) return null;
    removeFromPool(pool.current, new Set(parts.map((p) => p.key)));
    parts.forEach(prefetch);
    return chainSaga(q, index, parts, keepFirst);
  };

  /**
   * Film de saga tiré : toute la saga le remplace dans la file, pour enchaîner ses films d'un coup
   * (quelle que soit la réponse). Préparé pendant que la carte attend dans la file, donc invisible ;
   * si la carte est déjà affichée, elle reste en premier.
   */
  const chainIfSaga = async (drawn: Title) => {
    const saga = await sagaOf(drawn);
    const q = queueRef.current;
    if (!saga || !q || chainedSagas.current.has(saga.id)) return;
    const index = q.findIndex((t) => t.key === drawn.key);
    if (index === -1) return; // déjà trié ou passé
    const next = insertSaga(q, index, saga, index === 0);
    if (next) setQueue(next);
  };

  /** Ajoute au catalogue du swipe les titres connus de ce type qu'il n'a pas (filmographie d'une personne) ; renvoie les ajouts. */
  const addTitles = (titles: Title[]): Title[] => {
    const known = new Set(catalogue.current.map((t) => t.key));
    const added = titles.filter((t) => categoryOf(t) === category && t.voteCount >= KNOWN_VOTES && !known.has(t.key));
    catalogue.current.push(...added);
    // Enregistrés : ils restent là au prochain chargement, même sans réseau.
    if (added.length) db.titles.bulkPut(added).catch(() => undefined);
    return added;
  };

  // Charge le catalogue de ce type (à nouveau après une mise à jour du catalogue). Sans réseau.
  useEffect(() => {
    let cancelled = false;
    setLoaded(false);
    setLoadError(null);
    Promise.all([loadCatalogue(category), db.answers.where('type').equals(media).primaryKeys(), loadBoosts(media)])
      .then(([titles, keys, saved]) => {
        if (cancelled) return;
        catalogue.current = titles;
        answered.current = new Set(keys);
        boosts.current = saved;
        setLoaded(true);
      })
      .catch((e) => !cancelled && setLoadError((e as Error).message));
    return () => {
      cancelled = true;
    };
  }, [category, catalogueVersion]);

  // Filtre sur une personne retenu d'une visite à l'autre : sa filmographie peut compter des titres hors
  // catalogue. Récupérée en arrière-plan ; ses titres rejoignent le tirage à leur arrivée.
  useEffect(() => {
    if (!loaded) return;
    let alive = true;
    const people = [
      [theme.director, 'director'],
      [theme.actor, 'actor'],
    ] as const;
    for (const [person, role] of people) {
      if (!person) continue;
      personFilmography(person.id, role)
        .then((titles) => {
          if (!alive) return;
          const added = addTitles(titles).filter((t) => !answered.current.has(t.key) && matchesTheme(t, theme));
          if (!added.length || recoRef.current) return; // propositions : leur ordre ne bouge pas
          pool.current.items.push(...added.map((title) => ({ title, w: weightOf(title) })));
          pool.current.total = pool.current.items.reduce((s, i) => s + i.w, 0);
          if (queueRef.current && !queueRef.current.length) setQueue(fill([]));
        })
        .catch(() => undefined); // hors ligne : les titres déjà au catalogue suffisent
    }
    return () => {
      alive = false;
    };
  }, [loaded, theme]);

  /** Tirage des propositions : dans leur ordre, sans celles déjà triées, déjà dans la file ou hors des filtres. */
  const proposalPool = (skip = new Set<string>()): Pool => {
    const items = [...proposals.current.values()]
      .filter((p) => !answered.current.has(p.title.key) && !skip.has(p.title.key) && matchesTheme(p.title, theme))
      .map((p) => ({ title: p.title, w: 1 }));
    return { items, total: items.length, ordered: true };
  };

  // Prépare les propositions « selon tes goûts » (quelques secondes ; plus longtemps la première fois).
  useEffect(() => {
    if (!loaded || !reco) return;
    let alive = true;
    setRecoVersion(0);
    setRecoProgress(0);
    setRecoError(false);
    buildProposals(category, (share) => alive && setRecoProgress(Math.round(share * 100) / 100))
      .then((list) => {
        if (!alive) return;
        proposals.current = new Map(list.map((p) => [p.title.key, p]));
        recoAnswers.current = 0;
        setRecoVersion((v) => v + 1);
      })
      .catch(() => alive && setRecoError(true));
    return () => {
      alive = false;
    };
  }, [loaded, reco, category, catalogueVersion, recoAttempt]);

  /** Toutes les RECO_REFRESH réponses : le modèle réapprend, la suite des propositions change (la file ne bouge pas). */
  const refreshProposals = () => {
    buildProposals(category)
      .then((list) => {
        if (!recoRef.current) return;
        proposals.current = new Map(list.map((p) => [p.title.key, p]));
        pool.current = proposalPool(new Set((queueRef.current ?? []).map((t) => t.key)));
        if (queueRef.current && !queueRef.current.length) setQueue(fill([]));
      })
      .catch(() => undefined); // hors ligne : on garde les propositions actuelles
  };

  // (Re)construit le tirage quand le thème change, ou au passage au hasard / aux propositions.
  useEffect(() => {
    if (!loaded || (reco && !recoReady)) return;
    if (reco) pool.current = proposalPool();
    else {
      const items = catalogue.current
        .filter((t) => !answered.current.has(t.key) && matchesTheme(t, theme))
        .map((title) => ({ title, w: weightOf(title) }));
      pool.current = { items, total: items.reduce((s, i) => s + i.w, 0) };
    }
    setPhase('seen');
    // Avant d'afficher la 1re carte, on regarde si c'est un film de saga, pour commencer par le 1er film.
    // Seulement si sa fiche le dit déjà : on n'attend pas le réseau pour afficher la 1re carte
    // (sinon la saga s'enchaînera juste derrière elle).
    let alive = true;
    const first = fill([]);
    const head = first[0];
    const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), 1500));
    (head && sagaKnownLocally(head) ? Promise.race([sagaOf(head).catch(() => null), timeout]) : Promise.resolve(null)).then((saga) => {
      if (!alive) return;
      const chained = saga && !chainedSagas.current.has(saga.id) ? insertSaga(first, 0, saga, false) : null;
      setQueue(chained ?? first);
      if (head && !saga) chainIfSaga(head); // fiche pas encore arrivée : on réessaiera quand elle sera là
    });
    return () => {
      alive = false;
    };
  }, [loaded, theme, reco, recoReady]);

  const current = queue?.[0];
  const busy = fling !== null;
  // Carte de derrière : aucune au 1er swipe du mode 2 directions (la carte va revenir pour la 2e question).
  const behind = !queue || flipping || (mode === 'horizontal' && phase === 'seen') ? undefined : queue[1];

  const advance = (rest: Title[]) => {
    setPhase('seen');
    setQueue(fill(rest));
  };

  /** Titres triés (un seul, ou une saga) : compteur, activité, paliers, et de quoi annuler. */
  const counted = (group: Title[]) => {
    for (const t of group) answered.current.add(t.key);
    recordActivity(group.length);
    const n = count + group.length;
    if (Math.floor(n / 25) > Math.floor(count / 25)) {
      toast(T.swipe.milestone(pick(MILESTONES), Math.floor(n / 25) * 25));
      burst(['🎉', '🎊', '✨', '🥳'], undefined, 28);
    }
    setHistory((h) => [...h.slice(-49), group]);
    setCount(n);
  };

  const onSwipe = async (dir: Dir) => {
    setFling(null);
    if (!current || !queue) return;
    if (phase === 'seen' && (dir === 'left' || dir === 'right')) {
      // Masque la carte de derrière dans le même rendu que le changement de question.
      setFlipping(true);
      setTimeout(() => setFlipping(false), FLIP_MS);
      setPhase(dir === 'left' ? 'wish' : 'rate');
      return;
    }
    let status: Status;
    let tier: Tier | undefined;
    if (isCorner(dir)) ({ status, tier } = CORNERS[dir]);
    else if (phase === 'rate') {
      status = 'seen';
      tier = dir === 'right' ? 'good' : 'meh';
    } else status = dir === 'right' ? 'wish' : 'unseen';
    await setStatus(current, status, tier);
    rememberTaste(current.key); // résumé préparé pour les prochaines propositions
    if (reco) {
      const proposal = proposals.current.get(current.key);
      if (proposal) {
        recoAnswered.current.set(current.key, { status, tier, explore: proposal.explore });
        recordRecoAnswer(category, status, tier, proposal.explore).catch(() => undefined);
      }
      if (++recoAnswers.current >= RECO_REFRESH) {
        recoAnswers.current = 0;
        refreshProposals();
      }
    } else if (tier === 'good') boostRecommendations(current);
    const origin = centerOf(cardArea.current);
    if (status === 'seen') burst(['✅', '🍿', '⭐'], origin, 10);
    else if (status === 'wish') burst(['💖', '💕', '✨'], origin, 14);
    counted([current]);

    // La file à jour : une saga a pu s'y enchaîner pendant que la carte était affichée.
    advance((queueRef.current ?? queue).slice(1));
  };

  /** Titre aimé : ses recommandations TMDB sont tirées plus souvent (en arrière-plan). */
  const boostRecommendations = async (liked: Title) => {
    const titles = await boostFrom(liked);
    if (!titles.length) return;
    boosts.current = await loadBoosts(media);
    const inPool = new Map(pool.current.items.map((i) => [i.title.key, i]));
    const known = new Set(catalogue.current.map((t) => t.key));
    for (const t of titles) {
      if (answered.current.has(t.key)) continue;
      if (!known.has(t.key)) catalogue.current.push(t);
      const item = inPool.get(t.key);
      if (item) item.w = weightOf(item.title);
      else if (!known.has(t.key) && matchesTheme(t, theme)) pool.current.items.push({ title: t, w: weightOf(t) });
    }
    pool.current.total = pool.current.items.reduce((s, i) => s + i.w, 0);
  };

  // Saga en cours : ses films encore à trier (la carte affichée comprise).
  const saga = current ? tags[current.key] : undefined;
  const sagaLeft = saga && queue ? sagaInQueue(queue, tags, saga.id) : [];
  const canDropSaga = sagaLeft.length >= 2 && !(mode === 'horizontal' && phase === 'rate');

  /** « Pas envie de la saga » : tous ses films restant à trier en « pas vu, pas envie », d'un coup. */
  const dropSaga = async () => {
    if (busy || !saga || !canDropSaga) return;
    const group = sagaInQueue(queueRef.current ?? queue!, tags, saga.id);
    for (const t of group) await setStatus(t, 'unseen');
    counted(group);
    toast(T.swipe.sagaDropped(saga.name, group.length));
    const dropped = new Set(group.map((t) => t.key));
    advance((queueRef.current ?? queue!).filter((t) => !dropped.has(t.key)));
  };

  const skip = () => {
    if (!busy && queue?.length) advance((queueRef.current ?? queue).slice(1));
  };

  const undo = async () => {
    if (busy || !queue) return;
    if (phase !== 'seen') {
      setPhase('seen');
      return;
    }
    const last = history.at(-1);
    if (!last) return;
    for (const t of last) {
      await clearStatus(t.key);
      answered.current.delete(t.key);
      const given = recoAnswered.current.get(t.key);
      if (given) {
        recoAnswered.current.delete(t.key);
        recordRecoAnswer(category, given.status, given.tier, given.explore, -1).catch(() => undefined);
      }
    }
    recordActivity(-last.length);
    setHistory((h) => h.slice(0, -1));
    setCount((c) => Math.max(0, c - last.length));
    setQueue([...last, ...queue]);
  };

  const press = (dir: Dir) => {
    if (!busy && current) setFling(dir);
  };

  /** Bouton 🎯 : propositions selon tes goûts, ou retour au tirage au hasard. */
  const toggleReco = async () => {
    if (busy) return;
    const next = !reco;
    if (next) {
      const liked = await likedCount(category).catch(() => 0);
      if (liked < RECO_MIN_LIKED) {
        toast(T.swipe.reco.locked(RECO_MIN_LIKED - liked));
        return;
      }
    }
    writePref(recoKey, next);
    recoRef.current = next;
    setRecoVersion(0);
    setRecoState(next);
  };

  const applyTheme = (t: Theme) => {
    writePref(themeKey, t);
    setTheme(t);
    setShowThemes(false);
  };

  // Fond différent pendant la question « wishlist ? ».
  useEffect(() => {
    document.body.classList.toggle('wish-phase', phase === 'wish');
    document.body.classList.toggle('rate-phase', phase === 'rate');
    return () => document.body.classList.remove('wish-phase', 'rate-phase');
  }, [phase]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (showThemes || document.querySelector('.sheet-backdrop')) return; // fiche ou astuce ouverte
      const corner = (Object.keys(CORNERS) as Corner[]).find((c) => CORNERS[c].key === e.key);
      if (mode === 'corners' && corner) press(corner);
      else if (mode === 'horizontal' && e.key === 'ArrowRight') press('right');
      else if (mode === 'horizontal' && e.key === 'ArrowLeft') press('left');
      else if (e.key === 'ArrowDown') skip();
      else if (e.key === 'Backspace') undo();
    };
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  });

  const remaining = pool.current.items.length + (queue?.length ?? 0);
  const p = PHASES[phase];
  const labels: Partial<Record<Dir, { text: string; tone: Tone }>> =
    mode === 'corners'
      ? Object.fromEntries((Object.keys(CORNERS) as Corner[]).map((c) => [c, { text: CORNERS[c].text, tone: CORNERS[c].tone }]))
      : { left: { text: p.left, tone: TONES[phase].left }, right: { text: p.right, tone: TONES[phase].right } };
  const undoButton = (
    <ActionButton
      className="small"
      icon="↶"
      caption={T.swipe.undo}
      tip={T.swipe.undoTip}
      onClick={undo}
      disabled={phase === 'seen' && !history.length}
    />
  );
  const skipButton = <ActionButton className="small" icon="⤼" caption={T.swipe.skip} tip={T.swipe.skipTip} onClick={skip} />;
  const cornerButton = (c: Corner) => (
    <ActionButton
      className={`corner tone-${CORNERS[c].tone}`}
      icon={CORNERS[c].icon}
      badge={ARROWS[c]}
      caption={CORNERS[c].caption}
      tip={CORNERS[c].tip}
      onClick={() => press(c)}
    />
  );
  const typeTitle = `${CATEGORY_LABEL[category].emoji} ${capitalize(CATEGORY_LABEL[category].plural)}`;

  return (
    <main className={`page swipe-page ${mode} ${reco ? 'reco' : ''}`}>
      <Tutorial id={mode === 'corners' ? 'swipe-corners' : 'swipe-horizontal'} />
      {reco && <Tutorial id="reco" />}
      <header className="swipe-top">
        <BackLink />
        <h2 className={`swipe-title ${mode === 'horizontal' && current ? `question ${phase}` : ''}`}>
          {mode === 'horizontal' && current ? p.question : typeTitle}
        </h2>
        <button
          className={`icon-btn labeled reco-btn ${reco ? 'active' : ''}`}
          onClick={toggleReco}
          aria-pressed={reco}
          aria-label={T.swipe.reco.button}
          title={reco ? T.swipe.reco.offTip : T.swipe.reco.onTip}
        >
          <IconCaption icon="🎯" caption={T.actions.reco} />
        </button>
        <FilterButton
          active={!isNoTheme(theme)}
          label={T.swipe.remainingLong(themeLabel(media, theme), num(remaining))}
          onClick={() => setShowThemes(true)}
        />
        <span className="pill" title={T.swipe.countTip}>
          🔥 {count}
        </span>
      </header>
      {reco && (
        <button className="theme-strip reco-strip" onClick={toggleReco} title={T.swipe.reco.offTip}>
          {recoReady ? T.swipe.reco.strip(num(remaining), remaining) : T.swipe.reco.button}
        </button>
      )}
      {!isNoTheme(theme) && (
        <button className="theme-strip" onClick={() => setShowThemes(true)} title={T.filterSheet.changeTip}>
          <FilterIcon /> {T.swipe.remaining(themeLabel(media, theme), num(remaining))}
        </button>
      )}

      {loadError ? (
        <div className="empty">
          <span className="big-emoji">⚠️</span>
          <p>{T.swipe.loadError(loadError)}</p>
          <button className="btn primary" onClick={() => setCatalogueVersion((v) => v + 1)}>
            {T.common.retry}
          </button>
        </div>
      ) : reco && loaded && !recoReady ? (
        <div className="empty reco-preparing" aria-live="polite">
          <span className="big-emoji">🎯</span>
          {recoError ? (
            <>
              <p>{T.swipe.reco.error}</p>
              <button className="btn primary" onClick={() => setRecoAttempt((n) => n + 1)}>
                {T.common.retry}
              </button>
            </>
          ) : (
            <>
              <p>{T.swipe.reco.preparing}</p>
              <ProgressBar done={recoProgress} />
              <p className="muted small">{T.swipe.reco.preparingNote(Math.round(recoProgress * 100))}</p>
            </>
          )}
          <button className="btn" onClick={toggleReco}>
            {T.swipe.reco.backToRandom}
          </button>
        </div>
      ) : queue === null ? (
        <p className="muted center">{T.common.loading}</p>
      ) : !current ? (
        <div className="empty">
          {reco && catalogue.current.length > 0 ? (
            <>
              <span className="big-emoji">🎯</span>
              <p>{isNoTheme(theme) ? T.swipe.reco.empty : T.swipe.nothingFiltered}</p>
              <button className="btn primary" onClick={toggleReco}>
                {T.swipe.reco.backToRandom}
              </button>
            </>
          ) : catalogue.current.length === 0 ? (
            download.running || download.error ? (
              <CatalogueProgress compact />
            ) : (
              <>
                <span className="big-emoji">📦</span>
                <p>{T.swipe.emptyCatalogue}</p>
                <button className="btn primary" onClick={() => downloadCatalogue()} title={T.swipe.downloadTip}>
                  {T.swipe.download}
                </button>
              </>
            )
          ) : !isNoTheme(theme) ? (
            <>
              <span className="big-emoji">🔍</span>
              <p>{T.swipe.nothingFiltered}</p>
              <button className="btn primary" onClick={() => setShowThemes(true)}>
                {T.filterSheet.changeTip}
              </button>
            </>
          ) : (
            <>
              <span className="big-emoji">🏁</span>
              <p>{T.swipe.allSorted}</p>
            </>
          )}
          {history.length > 0 && (
            <button className="btn" onClick={undo} title={T.swipe.undoLastTip}>
              {T.duel.undo}
            </button>
          )}
        </div>
      ) : (
        <>
          <div className="card-area" ref={cardArea}>
            {behind && (
              <div key={behind.key} className="swipe-card card-behind" aria-hidden>
                <Poster title={behind} size="w500" className="card-poster" />
                <CardTag saga={tags[behind.key]} />
                <RatingBadge title={behind} />
                <TitleText title={behind} credits />
                {reco && <RecoWhy proposal={proposals.current.get(behind.key)} />}
              </div>
            )}
            <SwipeCard
              key={`${current.key}-${phase}`}
              mode={mode}
              labels={labels}
              fling={fling}
              onSwipe={onSwipe}
              onAmbiguous={() => toast(T.swipe.diagonal)}
              stay={mode === 'horizontal' && phase === 'seen' ? ['left', 'right'] : []}
              className={phase !== 'seen' ? 'flip-in' : ''}
              onTap={() => openFiche(current)}
            >
              <div className="card-poster-wrap">
                <Poster title={current} size="w500" className="card-poster" />
                {canDropSaga && <SagaDropButton left={sagaLeft.length} onDrop={dropSaga} />}
              </div>
              <CardTag saga={saga} />
              <RatingBadge title={current} />
              <TitleText title={current} credits />
              {reco && <RecoWhy proposal={proposals.current.get(current.key)} />}
            </SwipeCard>
          </div>
          {mode === 'corners' ? (
            <div className="swipe-actions corners">
              {cornerButton('dl')}
              {cornerButton('ul')}
              {undoButton}
              {skipButton}
              {cornerButton('ur')}
              {cornerButton('dr')}
            </div>
          ) : (
            <div className="swipe-actions">
              <ActionButton className={phase === 'rate' ? 'meh' : 'no'} icon={p.leftBtn} caption={p.leftCap} tip={p.leftTip} onClick={() => press('left')} />
              {undoButton}
              {skipButton}
              <ActionButton className={`yes ${phase}`} icon={p.rightBtn} caption={p.rightCap} tip={p.rightTip} onClick={() => press('right')} />
            </div>
          )}
        </>
      )}

      {showThemes && (
        <FilterSheet
          type={media}
          initial={theme}
          count={(t) => catalogue.current.filter((x) => !answered.current.has(x.key) && matchesTheme(x, t)).length}
          applyLabel={(n) => T.swipe.go(num(n))}
          hasCatalogueData={catalogue.current.some((t) => t.rating !== undefined)}
          missingRatings={catalogue.current.filter((t) => !answered.current.has(t.key) && ratingMissing(t)).length}
          onCatalogueUpdated={() => setCatalogueVersion((v) => v + 1)}
          onPersonTitles={addTitles}
          onApply={applyTheme}
          onClose={() => setShowThemes(false)}
        />
      )}
    </main>
  );
}
