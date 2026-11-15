import { compactTaste, TASTE_APPEND, TASTE_VERSION, type TasteData } from '../../worker/src/taste.js';
import { db, type MediaType, type TasteRow } from './db';
import { getToken } from './settings';
import { tmdb, TmdbError } from './tmdb';

export type { TasteData };

/**
 * Résumés TMDB des titres (mots-clés, équipe, recommandations) pour les propositions « selon tes goûts ».
 * Par le relais : son chemin /taste/<type>/<id> renvoie le résumé (≈ 5 Ko au lieu de 30 à 60 Ko). Avec une clé
 * personnelle, l'appli demande la fiche à TMDB et la résume elle-même (même code que le relais : taste.js).
 * Gardés dans la table `tastes` (propre à l'appareil), redemandés au bout de TASTE_MAX_AGE (les recommandations de
 * TMDB évoluent).
 */
export const TASTE_MAX_AGE = 90 * 86_400_000;
/** Un échec (hors ligne, refus) n'est pas redemandé avant ce délai. */
const RETRY_AFTER_FAILURE_MS = 2 * 60_000;
/** Résumés enregistrés par paquets (une écriture par paquet). */
const SAVE_EVERY = 100;

const failedAt = new Map<string, number>();
const pending = new Map<string, Promise<TasteData | null>>();

const parseKey = (key: string) => {
  const [type, id] = key.split(':');
  return { type: type as MediaType, id: Number(id) };
};

/** Résumé d'un titre depuis TMDB (ou le relais) ; null si TMDB ne connaît pas le titre. */
export async function fetchTaste(type: MediaType, id: number, background = true): Promise<TasteData | null> {
  const notFound = (e: unknown) => e instanceof TmdbError && e.status === 404;
  // Fiche complète, résumée par l'appli. Si une clé personnelle est refusée, tmdb() repasse par le relais avec le même
  // chemin : le résumé est le même.
  const full = async () => compactTaste(type, await tmdb<unknown>(`/${type}/${id}`, { append_to_response: TASTE_APPEND[type] }, { background }));
  try {
    if (getToken()) return await full();
    try {
      return compactTaste(type, await tmdb<TasteData>(`/taste/${type}/${id}`, {}, { background }));
    } catch (e) {
      // 404 du relais : titre inconnu de TMDB, ou relais pas encore à jour (chemin /taste inconnu, le temps de son
      // déploiement) — la fiche complète, que tout relais accepte, tranche.
      if (notFound(e)) return await full();
      throw e;
    }
  } catch (e) {
    if (notFound(e)) return null;
    throw e;
  }
}

const fresh = (row: TasteRow | undefined, now: number) =>
  !!row && now - row.fetchedAt < TASTE_MAX_AGE && (row.data === null || row.data.v === TASTE_VERSION);

/**
 * Résumés de ces titres : ceux de la base, et les autres demandés à TMDB (en arrière-plan, la file des demandes en
 * limite le nombre). `onProgress(faits, total)` suit les téléchargements. Les titres en échec sont absents du
 * résultat (ils seront redemandés plus tard).
 */
export async function ensureTastes(keys: string[], onProgress?: (done: number, total: number) => void): Promise<Map<string, TasteData>> {
  const unique = [...new Set(keys)];
  const rows = await db.tastes.bulkGet(unique);
  const now = Date.now();
  const out = new Map<string, TasteData>();
  const todo: string[] = [];
  unique.forEach((key, i) => {
    const row = rows[i];
    if (fresh(row, now)) {
      if (row!.data) out.set(key, row!.data);
    } else if (!(now - (failedAt.get(key) ?? 0) < RETRY_AFTER_FAILURE_MS)) todo.push(key);
    else if (row?.data) out.set(key, row.data); // ancien résumé : mieux que rien
  });
  let done = 0;
  onProgress?.(0, todo.length);
  let toSave: TasteRow[] = [];
  const flush = async () => {
    const batch = toSave;
    toSave = [];
    if (batch.length) await db.tastes.bulkPut(batch).catch(() => undefined);
  };
  await Promise.all(
    todo.map(async (key) => {
      let p = pending.get(key);
      if (!p) {
        const { type, id } = parseKey(key);
        p = fetchTaste(type, id).then(
          (data) => {
            failedAt.delete(key);
            toSave.push({ key, fetchedAt: Date.now(), data });
            return data;
          },
          () => {
            failedAt.set(key, Date.now());
            return null;
          },
        );
        p.finally(() => pending.delete(key));
        pending.set(key, p);
      }
      const data = await p;
      if (data) out.set(key, data);
      onProgress?.(++done, todo.length);
      if (toSave.length >= SAVE_EVERY) await flush();
    }),
  );
  await flush();
  return out;
}

/** Après une réponse au swipe : le résumé du titre est préparé en arrière-plan, pour les prochaines propositions. */
export function rememberTaste(key: string): void {
  ensureTastes([key]).catch(() => undefined);
}
