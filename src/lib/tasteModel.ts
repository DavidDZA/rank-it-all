import type { Answer } from './db';
import type { TasteData } from './taste';

/**
 * Modèle des goûts de l'utilisateur, appris sur toutes ses réponses (propositions « selon tes goûts »).
 *
 * Choisi le 15/11/2026 par un test hors ligne sur un vrai profil (4 116 réponses) : réponses cachées par cinquième,
 * puis devinées à partir des autres. Parmi les 20 titres non vus mis en tête, part de ceux mis en wishlist plutôt
 * qu'en « pas envie » : au hasard 34 % (films) / 11 % (séries), ancien « ✨ Comme … » (recommandations TMDB du
 * dernier titre aimé) 46 % / 29 %, recommandations TMDB additionnées 60 % / 36 %, profil de contenu 71 % / 45 %,
 * ce modèle 75-77 % / 51-53 %. Points selon la place au classement, paires du classement ou deux modèles séparés
 * (« ça te tente ? », « tu vas aimer ? ») : écarts dans le bruit, la version la plus simple est gardée.
 *
 * Régression logistique : « bien » ou wishlist (1) contre « bof » ou « pas envie » (0), chaque titre aimé compté
 * selon ses points. Caractéristiques : celles du résumé TMDB (mots-clés, genres, équipe, époque, langue, studio,
 * chaîne, saga : taste.js), la note et la popularité TMDB, et les recommandations TMDB de tes titres additionnées.
 */

// ---------- Points ----------

/** Points d'un titre aimé tout en haut du classement ; le dernier des « bien » classés en a 1. */
export const TOP_POINTS = 5;

/**
 * Points de chaque réponse : « bof » 0, « pas envie » 0, wishlist 0,5, « bien » 1, et un « bien » classé de 1 (le
 * dernier des « bien ») à TOP_POINTS (le premier), en favorisant le haut du classement. La place est relative (rang
 * parmi les « bien » classés) : 30 ou 500 titres classés se comparent. `rankings` : les classements de la
 * catégorie (séries et animes pour les séries TMDB), du premier au dernier.
 */
export function userPoints(answers: Answer[], rankings: string[][]): Record<string, number> {
  const pts: Record<string, number> = {};
  const good = new Set<string>();
  for (const a of answers) {
    if (a.status === 'seen' && a.tier === 'good') {
      pts[a.key] = 1;
      good.add(a.key);
    } else pts[a.key] = a.status === 'wish' ? 0.5 : 0;
  }
  for (const ranking of rankings) {
    const ranked = ranking.filter((k) => good.has(k));
    ranked.forEach((k, i) => {
      const p = ranked.length > 1 ? i / (ranked.length - 1) : 0; // 0 = premier
      pts[k] = 1 + (TOP_POINTS - 1) * (1 - p) ** 2;
    });
  }
  return pts;
}

const isLiked = (a: Answer) => (a.status === 'seen' && a.tier === 'good') || a.status === 'wish';

// ---------- Modèle ----------

export interface TasteModel {
  /** Score d'un titre (plus haut = plus susceptible de te plaire) ; null sans son résumé. */
  score(key: string): number | null;
  /** Probabilité estimée (0 à 1) qu'il te plaise. */
  probability(key: string): number | null;
  /** Poids appris d'une caractéristique (« dir:525 »…), 0 si inconnue. */
  weight(feature: string): number;
  /** Tes titres aimés (les mieux notés d'abord) liés à ce titre par les recommandations TMDB. */
  likedLinks(key: string): string[];
}

export interface TrainInput {
  /** Réponses de la catégorie (films, ou séries et animes). */
  answers: Answer[];
  points: Record<string, number>;
  /** Résumés des titres (réponses et candidats). */
  tastes: Map<string, TasteData>;
  /** Type TMDB des clés recommandées (« movie », « tv »). */
  type: 'movie' | 'tv';
}

const EPOCHS = 12;
const L2 = 1e-4;
const LEARNING_RATE = 0.1;
/** Valeur d'une caractéristique présente. */
const ON = 0.5;
/** Une caractéristique compte si elle revient dans au moins MIN_DF titres répondus. */
const MIN_DF = 2;

type Vector = Record<string, number>;

/** Tirage pseudo-aléatoire reproductible (même modèle pour les mêmes réponses). */
function seeded(seed: number) {
  let s = seed;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

/** Recommandations TMDB additionnées : chaque titre répondu pousse ceux qu'il recommande, selon ses points. */
function recsScorer(input: TrainInput) {
  const { answers, points, tastes, type } = input;
  const byKey = new Map(answers.map((a) => [a.key, a]));
  const w = (a: Answer) => points[a.key] - (a.status === 'unseen' ? 0.3 : 0) - (a.status === 'seen' && a.tier === 'meh' ? 0.15 : 0);
  const pushed = new Map<string, number>();
  for (const a of answers) {
    const recs = tastes.get(a.key)?.recs ?? [];
    recs.forEach((r, i) => {
      const k = `${type}:${r.id}`;
      pushed.set(k, (pushed.get(k) ?? 0) + w(a) / (1 + i / 10));
    });
  }
  return (key: string) => {
    let s = pushed.get(key) ?? 0;
    // Dans l'autre sens : le titre recommande lui-même des titres que tu as notés.
    (tastes.get(key)?.recs ?? []).forEach((r, i) => {
      const a = byKey.get(`${type}:${r.id}`);
      if (a) s += w(a) / (1 + i / 10);
    });
    return s;
  };
}

export function trainModel(input: TrainInput): TasteModel {
  const { answers, points, tastes, type } = input;
  const train = answers.filter((a) => tastes.has(a.key));
  const df = new Map<string, number>();
  for (const a of train) for (const f of tastes.get(a.key)!.f) df.set(f, (df.get(f) ?? 0) + 1);
  const recs = recsScorer(input);

  const vector = (key: string): Vector | null => {
    const t = tastes.get(key);
    if (!t) return null;
    const x: Vector = {
      bias: 1,
      votes: Math.log10(1 + t.votes) / 4,
      rating: ((t.rating || 6) - 6.5) / 1.5,
      recs: Math.log1p(Math.max(0, recs(key))),
    };
    for (const f of t.f) if ((df.get(f) ?? 0) >= MIN_DF) x[f] = ON;
    return x;
  };

  const W = new Map<string, number>();
  const G = new Map<string, number>();
  const dot = (x: Vector) => {
    let z = 0;
    for (const f in x) z += (W.get(f) ?? 0) * x[f];
    return z;
  };
  const rows = train.map((a) => {
    const y = isLiked(a) ? 1 : 0;
    return { x: vector(a.key)!, y, weight: y ? Math.max(1, points[a.key] ?? 1) : 1 };
  });
  const rnd = seeded(7);
  for (let e = 0; e < EPOCHS; e++) {
    // Mélange de Fisher-Yates, reproductible.
    for (let i = rows.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      [rows[i], rows[j]] = [rows[j], rows[i]];
    }
    for (const r of rows) {
      const p = 1 / (1 + Math.exp(-dot(r.x)));
      const g = (p - r.y) * r.weight;
      for (const f in r.x) {
        const wf = W.get(f) ?? 0;
        const grad = g * r.x[f] + L2 * wf;
        const acc = (G.get(f) ?? 1e-8) + grad * grad;
        G.set(f, acc);
        W.set(f, wf - (LEARNING_RATE * grad) / Math.sqrt(acc));
      }
    }
  }

  const byKey = new Map(answers.map((a) => [a.key, a]));
  const liked = answers.filter((a) => a.status === 'seen' && a.tier === 'good');
  const score = (key: string) => {
    const x = vector(key);
    return x ? dot(x) : null;
  };
  return {
    score,
    probability: (key) => {
      const z = score(key);
      return z === null ? null : 1 / (1 + Math.exp(-z));
    },
    weight: (f) => W.get(f) ?? 0,
    likedLinks: (key) => {
      const own = new Set((tastes.get(key)?.recs ?? []).map((r) => `${type}:${r.id}`));
      return liked
        .filter((a) => own.has(a.key) || (tastes.get(a.key)?.recs ?? []).some((r) => `${type}:${r.id}` === key))
        .sort((a, b) => (points[b.key] ?? 0) - (points[a.key] ?? 0))
        .map((a) => a.key)
        .filter((k) => byKey.has(k));
    },
  };
}

// ---------- Ordre des propositions ----------

export interface Ranked {
  key: string;
  score: number;
  probability: number;
  /** Caractéristiques qui ne doivent pas trop se répéter (saga, réalisateur, créateur). */
  groups: string[];
  /** Titre connu et bien noté : candidat pour une carte « à découvrir ». */
  safeBet: boolean;
}

/** Une saga, un réalisateur ou un créateur : au plus MAX_PER_GROUP titres parmi les GROUP_WINDOW derniers. */
export const MAX_PER_GROUP = 2;
export const GROUP_WINDOW = 20;
/** Une carte sur EXPLORE_EVERY est un « pari » : un titre sur lequel le modèle hésite. */
export const EXPLORE_EVERY = 5;

export const diversityGroups = (features: string[]) => features.filter((f) => /^(sg|dir|cr):/.test(f));

/**
 * Ordre des propositions : les mieux notées d'abord, en évitant qu'une saga ou un réalisateur revienne trop
 * souvent, avec une carte « à découvrir » toutes les EXPLORE_EVERY (le titre connu et bien noté sur lequel le
 * modèle hésite le plus : ta réponse lui apprend le plus).
 */
export function orderProposals(items: Ranked[]): { key: string; explore: boolean }[] {
  const rest = [...items].sort((a, b) => b.score - a.score);
  const out: { key: string; explore: boolean; groups: string[] }[] = [];
  const tooFrequent = (r: Ranked) => {
    const recent = out.slice(-GROUP_WINDOW + 1);
    return r.groups.some((g) => recent.filter((o) => o.groups.includes(g)).length >= MAX_PER_GROUP);
  };
  while (rest.length) {
    let index = -1;
    let explore = false;
    if ((out.length + 1) % EXPLORE_EVERY === 0) {
      let best = Infinity;
      rest.forEach((r, i) => {
        const doubt = Math.abs(r.probability - 0.5);
        if (r.safeBet && doubt < best && !tooFrequent(r)) [best, index] = [doubt, i];
      });
      explore = index !== -1;
    }
    if (index === -1) index = rest.findIndex((r) => !tooFrequent(r));
    if (index === -1) index = 0; // tous trop fréquents : le mieux noté quand même
    const [picked] = rest.splice(index, 1);
    out.push({ key: picked.key, explore, groups: picked.groups });
  }
  return out.map(({ key, explore }) => ({ key, explore }));
}
