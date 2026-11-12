// Types pour les tests de l'appli (tests/relais.test.ts).
declare const worker: {
  fetch(request: Request, env: { TMDB_TOKEN: string; LIMITER?: unknown }, ctx: { waitUntil(p: Promise<unknown>): void }): Promise<Response>;
};
export default worker;
