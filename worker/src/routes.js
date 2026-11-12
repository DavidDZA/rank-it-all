// Chemins TMDB relayés, et durée de leur cache. Chaque appel de l'appli (src/lib/tmdb.ts, src/lib/sync.ts,
// src/lib/recommend.ts) doit y figurer : tests/relais.test.ts le vérifie, appli et relais branchés ensemble.

const HOUR = 3600;
const DAY = 24 * HOUR;

export const ROUTES = [
  [/^\/discover\/(movie|tv)$/, 12 * HOUR], // catalogue : les mêmes pages pour tout le monde
  [/^\/(movie|tv)\/\d+$/, DAY], // fiches détaillées
  [/^\/(movie|tv)\/\d+\/recommendations$/, DAY],
  [/^\/collection\/\d+$/, DAY], // sagas
  [/^\/person\/\d+\/combined_credits$/, DAY],
  [/^\/watch\/providers\/(movie|tv)$/, DAY], // plateformes de streaming
  [/^\/search\/multi$/, HOUR],
  [/^\/search\/person$/, HOUR], // ajout manuel et filtres par réalisateur ou acteur
];
