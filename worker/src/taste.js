// Résumé d'un titre pour les propositions « selon tes goûts » : ses caractéristiques (mots-clés, genres, équipe,
// époque, langue, studio ou chaîne, saga) et les titres que TMDB recommande à partir de lui. Partagé par le relais
// (chemin /taste/<type>/<id> : environ 5 Ko au lieu de 30 à 60 Ko pour la fiche complète) et par l'appli, qui
// résume elle-même la fiche quand elle appelle TMDB directement (clé personnelle).

/** Version du résumé : un résumé d'une autre version est redemandé. */
export const TASTE_VERSION = 1;

/** Ce qu'il faut demander à TMDB avec la fiche (les séries : le casting de toutes les saisons). */
export const TASTE_APPEND = {
  movie: 'keywords,credits,recommendations',
  tv: 'keywords,aggregate_credits,recommendations',
};

const WRITER_JOBS = new Set(['Screenplay', 'Writer', 'Novel', 'Story', 'Author']);
const ACTORS = 6;
const RECS = 20;

/** Champs gardés pour chaque titre recommandé (ceux qu'utilise l'appli pour en faire un titre). */
const REC_FIELDS = [
  'id',
  'title',
  'name',
  'original_title',
  'original_name',
  'release_date',
  'first_air_date',
  'poster_path',
  'vote_count',
  'vote_average',
  'popularity',
  'genre_ids',
  'original_language',
  'origin_country',
  'adult',
];

/**
 * Résumé d'une fiche TMDB (avec TASTE_APPEND). Déjà résumée : renvoyée telle quelle.
 * Caractéristiques : « kw:<id> » mot-clé, « g: » genre, « dir: » réalisateur, « cr: » créateur de série,
 * « wr: » scénariste ou auteur, « mu: » compositeur, « dop: » chef opérateur, « ac: » acteur, « st: » studio,
 * « nw: » chaîne, « sg: » saga, « dec: » décennie, « lang: » langue originale. `names` : noms des personnes
 * (réalisateurs, créateurs, acteurs), seuls montrés dans les explications.
 */
export function compactTaste(type, raw) {
  if (raw && raw.v === TASTE_VERSION && Array.isArray(raw.f)) return raw;
  const f = [];
  const names = {};
  const add = (feature, name) => {
    if (f.includes(feature)) return;
    f.push(feature);
    if (name) names[feature] = name;
  };
  const keywords = type === 'tv' ? raw.keywords?.results : raw.keywords?.keywords;
  for (const k of keywords ?? []) add(`kw:${k.id}`);
  for (const g of raw.genres ?? []) add(`g:${g.id}`);
  const date = raw.release_date || raw.first_air_date || '';
  const year = Number(date.slice(0, 4));
  if (year) add(`dec:${Math.floor(year / 10) * 10}`);
  if (raw.original_language) add(`lang:${raw.original_language}`);
  if (raw.belongs_to_collection) add(`sg:${raw.belongs_to_collection.id}`);
  for (const c of (raw.production_companies ?? []).slice(0, 3)) add(`st:${c.id}`);
  for (const n of raw.networks ?? []) add(`nw:${n.id}`);
  for (const c of raw.created_by ?? []) add(`cr:${c.id}`, c.name);
  const credits = type === 'tv' ? (raw.aggregate_credits ?? raw.credits) : raw.credits;
  // Équipe des films seulement : celle d'une série compte des dizaines de scénaristes et de réalisateurs
  // d'épisodes ; ses créateurs (ci-dessus) la représentent mieux.
  if (type === 'movie') {
    for (const c of credits?.crew ?? []) {
      if (c.job === 'Director') add(`dir:${c.id}`, c.name);
      else if (WRITER_JOBS.has(c.job)) add(`wr:${c.id}`);
      else if (c.job === 'Original Music Composer') add(`mu:${c.id}`);
      else if (c.job === 'Director of Photography') add(`dop:${c.id}`);
    }
  }
  const cast = [...(credits?.cast ?? [])].sort((a, b) => (a.order ?? 99) - (b.order ?? 99));
  for (const c of cast.slice(0, ACTORS)) add(`ac:${c.id}`, c.name);
  const recs = (raw.recommendations?.results ?? []).slice(0, RECS).map((r) => {
    const out = {};
    for (const k of REC_FIELDS) if (r[k] !== undefined && r[k] !== null) out[k] = r[k];
    if (!('poster_path' in out)) out.poster_path = null;
    return out;
  });
  return {
    v: TASTE_VERSION,
    f,
    names,
    votes: raw.vote_count ?? 0,
    rating: raw.vote_average ?? 0,
    recs,
  };
}
