// Test du relais, sans Cloudflare ni TMDB (simulés) : node worker/test.mjs
const worker = (await import('./src/index.js')).default;
const store = new Map();
globalThis.caches = { default: { match: async (r) => store.get(r.url)?.clone(), put: async (r, res) => void store.set(r.url, res) } };
let calls = [];
globalThis.fetch = async (url, init) => {
  calls.push({ url: String(url), auth: init.headers.Authorization });
  if (String(url).includes('/movie/401')) return new Response('{}', { status: 401 });
  return new Response(JSON.stringify({ ok: true, url: String(url) }), { status: 200 });
};
const pending = [];
const ctx = { waitUntil: (p) => pending.push(p) };
let allowedHits = 0;
const env = { TMDB_TOKEN: 'secret', LIMITER: { limit: async () => ({ success: ++allowedHits <= 4 }) } };
const req = (path, origin = 'https://daviddza.github.io', method = 'GET') =>
  worker.fetch(new Request('https://relais.example' + path, { method, headers: origin ? { Origin: origin } : {} }), env, ctx);
let failed = 0;
const check = (name, cond) => {
  if (!cond) failed++;
  console.log(cond ? 'ok ' : 'ÉCHEC', name);
};

let r = await req('/discover/movie?page=2&language=fr-FR&api_key=x');
await Promise.all(pending);
check('discover relayé (200)', r.status === 200);
check('clé ajoutée côté relais', calls[0].auth === 'Bearer secret');
check('paramètres triés, api_key retiré', calls[0].url === 'https://api.themoviedb.org/3/discover/movie?language=fr-FR&page=2');
check('CORS pour le site', r.headers.get('Access-Control-Allow-Origin') === 'https://daviddza.github.io');
r = await req('/discover/movie?language=fr-FR&page=2');
check('2e demande servie par le cache', r.status === 200 && calls.length === 1);
r = await req('/discover/movie', 'https://pirate.example');
check('autre site refusé (403)', r.status === 403);
r = await req('/discover/movie', null);
check('sans Origin refusé (403)', r.status === 403);
r = await req('/search/person?query=nolan&language=fr-FR');
check('recherche par personne relayée (200)', r.status === 200);
r = await req('/movie/550?language=fr-FR&append_to_response=credits%2Cvideos%2Cwatch%2Fproviders&include_video_language=fr%2Cen');
check('fiche : append_to_response transmis intact', new URL(calls.at(-1).url).searchParams.get('append_to_response') === 'credits,videos,watch/providers');
allowedHits = 2; // limite simulée de 4 : comme si seules les 2 premières demandes avaient compté
r = await req('/account');
check('chemin non relayé (404)', r.status === 404);
r = await req('/discover/movie', 'https://daviddza.github.io', 'POST');
check('POST refusé (405)', r.status === 405);
r = await req('/discover/tv', 'https://daviddza.github.io', 'OPTIONS');
check('préflight accepté (204)', r.status === 204);
r = await req('/movie/401');
check('clé du relais refusée → 502', r.status === 502);
r = await req('/movie/550');
r = await req('/movie/551');
check('limite de débit → 429', r.status === 429 && r.headers.get('Retry-After') === '10');
if (failed) process.exit(1);
