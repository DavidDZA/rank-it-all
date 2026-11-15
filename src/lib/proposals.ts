import { db, getMeta, setMeta, titleKey, type Answer, type Status, type Tier, type Title } from './db';
import { CATEGORIES, categoryOf, keysOfCategory, mediaOf, type Category } from './category';
import { isExcluded, KNOWN_VOTES, personFilmography, toTitle, type RawResult } from './tmdb';
import { ensureTastes, type TasteData } from './taste';
import { diversityGroups, orderProposals, trainModel, userPoints, type Ranked, type TasteModel } from './tasteModel';

/**
 * Propositions « selon tes goûts » du swipe (bouton 🎯) : des titres jamais triés, choisis par le modèle appris sur
 * toutes tes réponses (tasteModel.ts). Candidats : les recommandations TMDB de tes titres, et les autres titres des
 * réalisateurs ou créateurs qui te plaisent le plus. Chaque proposition dit pourquoi (tes titres aimés qui la
 * recommandent, la personne qui compte le plus), sauf les cartes « à découvrir » (paris pour mieux te connaître).
 */

/** Titres « bien » nécessaires dans la catégorie pour ouvrir les propositions. */
export const RECO_MIN_LIKED = 10;
/** « Pas envie » les plus récents pris pour apprendre (au-delà, beaucoup de résumés à télécharger pour peu de gain). */
export const UNSEEN_SAMPLE = 600;
/** Candidats venus des recommandations TMDB, les plus recommandés d'abord. */
export const CANDIDATES = 400;
/** Réalisateurs ou créateurs préférés dont on va chercher les autres titres. */
export const PEOPLE = 5;
/** Une personne n'est citée dans l'explication qu'avec un poids appris d'au moins PERSON_MIN_WEIGHT. */
const PERSON_MIN_WEIGHT = 0.05;
/** Carte « à découvrir » : seulement un titre connu et bien noté. */
const SAFE_VOTES = 300;
const SAFE_RATING = 6.5;

export interface Why {
  /** Tes titres aimés qui recommandent celui-ci (ou qu'il recommande), les mieux classés d'abord. */
  liked: string[];
  /** Réalisateur, créateur ou acteur qui compte le plus pour toi parmi les siens. */
  person?: { name: string; role: 'director' | 'actor' };
}

export interface Proposal {
  title: Title;
  /** Carte « à découvrir » : un pari, sans explication. */
  explore: boolean;
  why: Why | null;
}

/** Nombre de titres « bien » de la catégorie. */
export async function likedCount(category: Category): Promise<number> {
  const keys = await db.answers
    .where('[type+status]')
    .equals([mediaOf(category), 'seen'])
    .filter((a) => a.tier === 'good')
    .primaryKeys();
  return (await keysOfCategory(category, keys)).length;
}

/** Avancement de la préparation, de 0 à 1 (résumés de tes titres, puis ceux des candidats). */
export type Progress = (share: number) => void;

const cache = new Map<Category, { signature: string; proposals: Proposal[] }>();

/** Signature des réponses et classements : rien de changé, les propositions sont reprises telles quelles. */
const signatureOf = (answers: Answer[], rankings: string[][]) =>
  `${answers.length}:${Math.max(0, ...answers.map((a) => a.updatedAt))}:${rankings.map((r) => r.join(',')).join('|')}`;

export function explain(model: TasteModel, taste: TasteData, key: string, titleOf: (key: string) => string | undefined): Why | null {
  const liked = model
    .likedLinks(key)
    .map(titleOf)
    .filter((t): t is string => !!t)
    .slice(0, 2);
  let person: Why['person'];
  let best = PERSON_MIN_WEIGHT;
  for (const f of taste.f) {
    const name = taste.names[f];
    const w = model.weight(f);
    // À poids égal, la première citée : réalisateur ou créateur avant les acteurs (ordre du résumé).
    if (name && w > best) [best, person] = [w, { name, role: f.startsWith('ac:') ? 'actor' : 'director' }];
  }
  return liked.length || person ? { liked, ...(person ? { person } : {}) } : null;
}

/** Prépare les propositions de la catégorie (quelques secondes, plus la première fois : résumés à télécharger). */
export async function buildProposals(category: Category, onProgress?: Progress): Promise<Proposal[]> {
  const media = mediaOf(category);
  const answers = await db.answers.where('type').equals(media).toArray();
  const rankings = await Promise.all(CATEGORIES.filter((c) => mediaOf(c) === media).map((c) => getMeta<string[]>(`ranking:${c}`, [])));
  const signature = signatureOf(answers, rankings);
  const cached = cache.get(category);
  if (cached?.signature === signature) return cached.proposals;

  const points = userPoints(answers, rankings);
  const unseen = answers
    .filter((a) => a.status === 'unseen')
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, UNSEEN_SAMPLE);
  const learned = [...answers.filter((a) => a.status !== 'unseen'), ...unseen];

  // 1. Tes titres résumés, puis le modèle.
  const tastes = await ensureTastes(
    learned.map((a) => a.key),
    (done, total) => onProgress?.(total ? (0.7 * done) / total : 0.7),
  );
  const model = trainModel({ answers: learned, points, tastes, type: media });

  // 2. Candidats : recommandations TMDB de tes titres, poussées par leurs points.
  const answered = new Set(answers.map((a) => a.key));
  const pushed = new Map<string, number>();
  const raws = new Map<string, RawResult>();
  for (const a of learned) {
    const w = Math.max(0.1, points[a.key] ?? 0);
    (tastes.get(a.key)?.recs ?? []).forEach((r, i) => {
      const key = titleKey(media, r.id);
      if (answered.has(key) || isExcluded(media, r)) return;
      pushed.set(key, (pushed.get(key) ?? 0) + w / (1 + i / 10));
      if (!raws.has(key)) raws.set(key, r);
    });
  }
  const fromRecs = [...pushed.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, CANDIDATES)
    .map(([key]) => key);

  // … et les autres titres des réalisateurs ou créateurs que tu préfères.
  const people = new Map<string, number>();
  for (const a of learned) {
    if (!(points[a.key] >= 1)) continue;
    for (const f of tastes.get(a.key)?.f ?? []) if (/^(dir|cr):/.test(f) && model.weight(f) > 0) people.set(f, model.weight(f));
  }
  const favorites = [...people.entries()].sort((a, b) => b[1] - a[1]).slice(0, PEOPLE);
  const filmographies = await Promise.all(favorites.map(([f]) => personFilmography(Number(f.split(':')[1]), 'director').catch(() => [] as Title[])));
  const fromPeople = filmographies.flat().filter((t) => t.type === media && !answered.has(t.key) && t.voteCount >= KNOWN_VOTES);

  const candidateKeys = [...new Set([...fromRecs, ...fromPeople.map((t) => t.key)])];
  const stored = await db.titles.bulkGet(candidateKeys);
  const peopleTitles = new Map(fromPeople.map((t) => [t.key, t]));
  const titles = new Map<string, Title>();
  candidateKeys.forEach((key, i) => {
    const raw = raws.get(key);
    const t = stored[i] ?? peopleTitles.get(key) ?? (raw ? { ...toTitle(media, raw), manual: true } : undefined);
    if (t && categoryOf(t) === category && t.voteCount >= KNOWN_VOTES) titles.set(key, t);
  });

  // 3. Candidats résumés, notés par le modèle, puis mis en ordre.
  const candidateTastes = await ensureTastes([...titles.keys()], (done, total) => onProgress?.(0.7 + (total ? (0.3 * done) / total : 0.3)));
  for (const [k, v] of candidateTastes) tastes.set(k, v);
  const ranked: Ranked[] = [];
  for (const key of titles.keys()) {
    const taste = tastes.get(key);
    const score = model.score(key);
    if (!taste || score === null) continue;
    ranked.push({
      key,
      score,
      probability: model.probability(key)!,
      groups: diversityGroups(taste.f),
      safeBet: taste.votes >= SAFE_VOTES && taste.rating >= SAFE_RATING,
    });
  }
  const answeredTitles = new Map((await db.titles.bulkGet(learned.map((a) => a.key))).filter((t): t is Title => !!t).map((t) => [t.key, t.title]));
  const proposals = orderProposals(ranked).map(({ key, explore }) => ({
    title: titles.get(key)!,
    explore,
    why: explore ? null : explain(model, tastes.get(key)!, key, (k) => answeredTitles.get(k)),
  }));
  onProgress?.(1);
  cache.set(category, { signature, proposals });
  return proposals;
}

// ---------- Mesure en usage ----------

/** Réponses données aux propositions, pour vérifier qu'elles tombent juste (meta synchronisée `reco-stats:<catégorie>`). */
export interface RecoStats {
  good: number;
  meh: number;
  wish: number;
  unseen: number;
  /** Les mêmes chiffres pour les cartes « à découvrir ». */
  explore: { good: number; meh: number; wish: number; unseen: number };
}

const emptyStats = (): RecoStats => ({ good: 0, meh: 0, wish: 0, unseen: 0, explore: { good: 0, meh: 0, wish: 0, unseen: 0 } });

export const RECO_STATS = (category: Category) => `reco-stats:${category}`;

export async function recordRecoAnswer(category: Category, status: Status, tier: Tier | undefined, explore: boolean, delta = 1): Promise<void> {
  const stats = { ...emptyStats(), ...(await getMeta<RecoStats | null>(RECO_STATS(category), null)) };
  const field = status === 'seen' ? (tier === 'meh' ? 'meh' : 'good') : status;
  const target = explore ? (stats.explore = { ...emptyStats().explore, ...stats.explore }) : stats;
  target[field] = Math.max(0, target[field] + delta);
  await setMeta(RECO_STATS(category), stats);
}

/** Part des propositions (hors « à découvrir ») swipées « bien » ou « wishlist » ; null sans réponse. */
export function hitRate(stats: RecoStats): number | null {
  const total = stats.good + stats.meh + stats.wish + stats.unseen;
  return total ? (stats.good + stats.wish) / total : null;
}
