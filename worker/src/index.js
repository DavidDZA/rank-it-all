// Relais TMDB (Cloudflare Worker) : le site appelle ce relais sans clé ; lui seul connaît la clé TMDB (secret
// TMDB_TOKEN), transmet la demande à TMDB et garde la réponse en cache, partagée entre tous les utilisateurs.
// Seuls les chemins utilisés par l'appli sont acceptés, seulement depuis le site, avec une limite de débit
// par adresse IP. Déployé par .github/workflows/worker.yml.

import { ROUTES } from './routes.js';

const TMDB = 'https://api.themoviedb.org/3';
/** Pause avant de redemander à TMDB après un refus « trop de demandes ». */
const RETRY_PAUSE_MS = 1000;

/** Sites autorisés à appeler le relais (le site publié, et le site lancé en local pour le développement). */
const ALLOWED_ORIGINS = ['https://daviddza.github.io', 'http://localhost:5173', 'http://localhost:4173'];

export default {
  async fetch(request, env, ctx) {
    const origin = request.headers.get('Origin');
    const allowed = origin !== null && ALLOWED_ORIGINS.includes(origin);
    const cors = allowed ? { 'Access-Control-Allow-Origin': origin, Vary: 'Origin' } : {};

    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: allowed ? 204 : 403,
        headers: { ...cors, 'Access-Control-Allow-Methods': 'GET', 'Access-Control-Allow-Headers': 'accept', 'Access-Control-Max-Age': '86400' },
      });
    }
    if (request.method !== 'GET') return error(405, 'Méthode non acceptée', cors);
    if (!allowed) return error(403, 'Relais réservé à Rank It All', cors);

    const url = new URL(request.url);
    const route = ROUTES.find(([pattern]) => pattern.test(url.pathname));
    if (!route) return error(404, 'Chemin non relayé', cors);

    // Limite de débit par adresse IP (un téléchargement du catalogue fait environ 900 demandes en une minute ou deux).
    if (env.LIMITER) {
      const { success } = await env.LIMITER.limit({ key: request.headers.get('CF-Connecting-IP') ?? 'inconnue' });
      if (!success) return error(429, 'Trop de demandes, réessaie dans un instant', { ...cors, 'Retry-After': '10' });
    }

    // Adresse TMDB, paramètres triés : deux demandes identiques partagent la même entrée du cache.
    const target = new URL(TMDB + url.pathname);
    [...url.searchParams.entries()]
      .filter(([key]) => key !== 'api_key')
      .sort(([a], [b]) => a.localeCompare(b))
      .forEach(([key, value]) => target.searchParams.append(key, value));
    const cacheKey = new Request(target.toString());
    const cache = caches.default;

    let response = await cache.match(cacheKey);
    if (!response) {
      let upstream;
      try {
        const ask = () => fetch(target, { headers: { Authorization: `Bearer ${env.TMDB_TOKEN}`, accept: 'application/json' } });
        upstream = await ask();
        // TMDB limite le débit par adresse, et celles de Cloudflare sont partagées : un refus passager est réessayé
        // une fois, après une courte pause, avant d'être transmis à l'appli.
        if (upstream.status === 429) {
          await new Promise((r) => setTimeout(r, RETRY_PAUSE_MS));
          upstream = await ask();
        }
      } catch {
        return error(502, 'TMDB injoignable', cors);
      }
      // Clé refusée par TMDB : problème du relais, pas de l'utilisateur (l'appli dirait « vérifie ta clé »).
      if (upstream.status === 401) return error(502, 'Le relais TMDB est mal configuré', cors);
      // Seules les bonnes réponses se gardent. Un refus de TMDB (trop de demandes, 404…) marqué « à garder 24 h »
      // était resservi par le navigateur pendant 24 h, sans redemander : la fiche ne revenait jamais (12/11).
      const headers = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': upstream.ok ? `public, max-age=${route[1]}` : 'no-store' };
      if (upstream.status === 429) headers['Retry-After'] = upstream.headers.get('Retry-After') ?? '2';
      response = new Response(upstream.body, { status: upstream.status, headers });
      if (upstream.ok) ctx.waitUntil(cache.put(cacheKey, response.clone()));
    }

    const headers = new Headers(response.headers);
    for (const [key, value] of Object.entries(cors)) headers.set(key, value);
    return new Response(response.body, { status: response.status, headers });
  },
};

function error(status, message, headers) {
  return new Response(JSON.stringify({ status_message: message }), {
    status,
    headers: { ...headers, 'Content-Type': 'application/json; charset=utf-8' },
  });
}
