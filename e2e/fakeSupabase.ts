import { readFileSync } from 'node:fs';
import type { Page, Route } from '@playwright/test';

/**
 * Faux Supabase pour les tests de bout en bout : une session déjà ouverte, des profils, des amitiés, et les réponses /
 * classements de chacun (les miens, venus d'un autre appareil, et ceux d'un ami). Toutes les demandes au vrai projet
 * sont interceptées ; une demande inconnue répond 501 (et est notée dans `unknown`), rien ne part vers le vrai projet.
 * Les tests sur le vrai projet : comptes.live.spec.ts.
 */

/** Adresse du projet compilée dans le site (lue comme le fait Vite, dans .env.local). */
export const SUPABASE_URL = (() => {
  try {
    return readFileSync('.env.local', 'utf8').match(/^VITE_SUPABASE_URL=(.*)$/m)?.[1]?.trim() ?? '';
  } catch {
    return '';
  }
})();

export interface FakeUser {
  id: string;
  pseudo: string;
  friendCode: string;
  shareWishlist?: boolean;
  shareRanking?: boolean;
  answers?: { key: string; status: 'seen' | 'wish' | 'unseen'; tier?: 'good' | 'meh'; title?: unknown }[];
  meta?: Record<string, unknown>;
}

export interface FakeSupabase {
  /** Demandes sans réponse prévue (méthode et chemin). */
  unknown: string[];
  /** Lignes envoyées par la synchro de l'appareil (table → lignes). */
  pushed: Record<string, unknown[]>;
}

const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url');

/** Ouvre une session au nom de `me`, ami avec `friends`, et branche le faux serveur. */
export async function fakeSupabase(page: Page, me: FakeUser, friends: FakeUser[]): Promise<FakeSupabase> {
  const state: FakeSupabase = { unknown: [], pushed: {} };
  const users = [me, ...friends];
  const now = Math.floor(Date.now() / 1000);
  const user = { id: me.id, aud: 'authenticated', role: 'authenticated', email: 'moi@test.invalid', app_metadata: { provider: 'email', providers: ['email'] }, user_metadata: {}, created_at: new Date().toISOString() };
  const session = {
    access_token: `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: me.id, exp: now + 86_400, role: 'authenticated', aud: 'authenticated' })}.signature`,
    token_type: 'bearer',
    expires_in: 86_400,
    expires_at: now + 86_400,
    refresh_token: 'jeton-de-test',
    user,
  };
  const ref = new URL(SUPABASE_URL).hostname.split('.')[0];
  await page.addInitScript(([key, value]) => localStorage.setItem(key, value), [`sb-${ref}-auth-token`, JSON.stringify(session)]);

  const profile = (u: FakeUser) => ({ id: u.id, pseudo: u.pseudo, friend_code: u.friendCode, share_wishlist: u.shareWishlist ?? true, share_ranking: u.shareRanking ?? true });
  const at = new Date().toISOString();
  const rows = (table: string, u: FakeUser): Record<string, unknown>[] =>
    table === 'answers'
      ? (u.answers ?? []).map((a) => ({ user_id: u.id, key: a.key, type: a.key.split(':')[0], status: a.status, tier: a.tier ?? null, title: a.title ?? null, deleted: false, updated_at: at, client_updated_at: at }))
      : Object.entries(u.meta ?? {}).map(([key, value]) => ({ user_id: u.id, key, value, deleted: false, updated_at: at, client_updated_at: at }));

  /** Filtres PostgREST utilisés par l'appli : colonne=eq.valeur, colonne=in.(a,b), key=like.prefix%. */
  const filter = (list: Record<string, unknown>[], params: URLSearchParams) =>
    list.filter((r) =>
      [...params.entries()].every(([col, cond]) => {
        if (['select', 'order', 'offset', 'limit', 'on_conflict', 'columns'].includes(col)) return true;
        const [op, ...rest] = cond.split('.');
        const v = rest.join('.');
        if (op === 'eq') return String(r[col]) === v;
        if (op === 'in') return v.replace(/^\(|\)$/g, '').split(',').includes(String(r[col]));
        if (op === 'like') return String(r[col]).startsWith(v.replace(/%$/, ''));
        if (op === 'gt') return String(r[col]) > v;
        return true;
      }),
    );

  const reply = (route: Route, body: unknown, status = 200) => {
    const one = route.request().headers()['accept']?.includes('vnd.pgrst.object');
    if (one && Array.isArray(body)) {
      if (body.length !== 1) return route.fulfill({ status: 406, json: { code: 'PGRST116', message: 'not one row' } });
      return route.fulfill({ status, json: body[0] });
    }
    return route.fulfill({ status, json: body });
  };

  await page.route(`${SUPABASE_URL}/**`, async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const path = url.pathname;
    const method = req.method();
    if (path === '/auth/v1/user') return route.fulfill({ json: user });
    if (path === '/auth/v1/logout') return route.fulfill({ status: 204 });
    const table = path.match(/^\/rest\/v1\/([a-z_]+)$/)?.[1];
    if (table && method === 'GET') {
      if (table === 'profiles') return reply(route, filter(users.map(profile), url.searchParams));
      if (table === 'friendships') return reply(route, friends.map((f) => ({ user_a: me.id, user_b: f.id, created_at: at })));
      if (table === 'answers' || table === 'user_meta') return reply(route, filter(users.flatMap((u) => rows(table, u)), url.searchParams));
    }
    if (table && (method === 'POST' || method === 'PATCH')) {
      const body = req.postDataJSON();
      (state.pushed[table] ??= []).push(...(Array.isArray(body) ? body : [body]));
      return route.fulfill({ status: 201, json: [] });
    }
    state.unknown.push(`${method} ${path}`);
    return route.fulfill({ status: 501, json: { message: 'non simulé' } });
  });
  return state;
}

/** Copie allégée d'un titre, comme celle que la synchro joint aux réponses (cloud.ts, titleCopy). */
export const copyOf = (t: { key: string; type: string; tmdbId: number; title: string; originalTitle: string; year: number; posterPath: null; genreIds: number[]; originalLanguage: string }) => ({
  key: t.key,
  type: t.type,
  tmdbId: t.tmdbId,
  title: t.title,
  originalTitle: t.originalTitle,
  year: t.year,
  posterPath: t.posterPath,
  genreIds: t.genreIds,
  originalLanguage: t.originalLanguage,
});
