/**
 * Captures du Play Store, dans chaque langue : `node tools/captures-store/captures.mjs [en es de it pt fr]`
 * (sans argument : les 5 langues traduites ; le français existe déjà dans store/captures/).
 *
 * Construit le site avec le relais TMDB (dossier dist-captures, servi sur localhost:5173, adresse acceptée par le
 * relais), puis pour chaque langue : un téléphone (360 × 640, densité 3 → 1080 × 1920) réglé sur la langue et le pays,
 * l'appli télécharge le vrai catalogue (vraies affiches, titres traduits), reçoit un profil plausible (titres vus et
 * aimés, wishlist, classement, quelques jours d'activité), et les 6 écrans de la fiche sont capturés dans
 * store/captures/<langue>/ : accueil, swipe, duel, classement, tier list, wishlist. Puis les bannières (banniere.mjs).
 *
 * Demande le réseau (relais TMDB, environ 900 demandes par langue) ; quelques minutes en tout.
 */
import { execSync, spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium } from '@playwright/test';
import { makeBanners } from './banniere.mjs';

const ROOT = resolve(import.meta.dirname, '../..');
const RELAY = 'https://rank-it-all-tmdb.rankitall.workers.dev';
const PORT = 5173;
const BASE = `http://localhost:${PORT}`;

/** Langue → locale du téléphone (donc pays des plateformes et langue TMDB). */
const LOCALES = { fr: 'fr-FR', en: 'en-US', es: 'es-ES', de: 'de-DE', it: 'it-IT', pt: 'pt-BR' };
const TMDB = { fr: 'fr-FR', en: 'en-US', es: 'es-ES', de: 'de-DE', it: 'it-IT', pt: 'pt-BR' };
const SHOTS = ['1-accueil', '2-swipe', '3-duel', '4-classement', '5-tier-list', '6-wishlist'];

const langs = process.argv.slice(2).length ? process.argv.slice(2) : ['en', 'es', 'de', 'it', 'pt'];
for (const l of langs) if (!LOCALES[l]) throw new Error(`Langue inconnue : ${l}`);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

console.log('Construction du site avec le relais TMDB…');
execSync('npx vite build --outDir dist-captures', { cwd: ROOT, stdio: 'inherit', env: { ...process.env, VITE_TMDB_RELAY: RELAY } });
const server = spawn(`npx vite preview --outDir dist-captures --port ${PORT} --strictPort`, { cwd: ROOT, shell: true });
const stop = () => {
  if (process.platform === 'win32') execSync(`taskkill /pid ${server.pid} /T /F`, { stdio: 'ignore' });
  else server.kill();
};

try {
  for (let i = 0; i < 60; i++) {
    if (await fetch(BASE).then((r) => r.ok).catch(() => false)) break;
    await sleep(500);
  }
  const browser = await chromium.launch({ channel: 'chrome' });
  for (const lang of langs) {
    console.log(`\n${lang} : téléchargement du catalogue…`);
    const context = await browser.newContext({
      locale: LOCALES[lang],
      viewport: { width: 360, height: 640 },
      deviceScaleFactor: 3,
      isMobile: true,
      hasTouch: true,
    });
    const page = await context.newPage();
    // Astuces de première visite déjà vues (elles masqueraient les écrans).
    await page.addInitScript(() => localStorage.setItem('tutorials-seen', JSON.stringify(['home', 'swipe-corners', 'swipe-horizontal', 'rank', 'wishlist', 'tonight', 'lists', 'add', 'friends', 'duo'])));
    await page.goto(`${BASE}/`);
    await waitForCatalogue(page, TMDB[lang]);
    console.log(`${lang} : profil de démonstration…`);
    await page.evaluate(seedProfile);
    await page.reload(); // l'accueil relit ses compteurs (titres vus, activité)
    const dir = resolve(ROOT, 'store/captures', lang);
    mkdirSync(dir, { recursive: true });
    for (const shot of SHOTS) {
      await capture(page, shot);
      await page.screenshot({ path: resolve(dir, `${shot}.png`) });
      console.log(`  ${shot}.png`);
    }
    await context.close();
  }
  // Bannières du Store, avec les nouvelles captures de la tier list (store/bannieres/).
  for (const file of await makeBanners(langs.filter((l) => l !== 'fr'), browser)) console.log(file);
  await browser.close();
} finally {
  stop();
}

/** Attend la fin du premier téléchargement du catalogue, dans la langue voulue (meta lastSync et catalogue-language). */
async function waitForCatalogue(page, tmdbLanguage) {
  for (let i = 0; i < 600; i++) {
    const done = await page.evaluate(
      (lang) =>
        new Promise((resolve) => {
          const req = indexedDB.open('rank-it-all');
          req.onerror = () => resolve(false);
          req.onsuccess = () => {
            try {
              const store = req.result.transaction('meta').objectStore('meta');
              const a = store.get('lastSync');
              const b = store.get('catalogue-language');
              b.onsuccess = () => resolve(!!a.result?.value && b.result?.value === lang);
            } catch {
              resolve(false);
            }
          };
        }),
      tmdbLanguage,
    );
    if (done) return;
    await sleep(1000);
  }
  throw new Error('Catalogue pas téléchargé au bout de 10 minutes');
}

/**
 * Profil de démonstration, le même dans chaque langue (mêmes titres TMDB) : les films les plus connus vus et aimés,
 * les 30 premiers classés (par note), 10 en attente de duel, une wishlist, des séries vues, 12 jours d'activité.
 */
function seedProfile() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('rank-it-all');
    req.onsuccess = () => {
      const db = req.result;
      const read = db.transaction('titles').objectStore('titles').getAll();
      read.onsuccess = () => {
        const all = read.result;
        const byVotes = (type) => all.filter((t) => t.type === type && t.posterPath).sort((a, b) => b.voteCount - a.voteCount);
        const movies = byVotes('movie');
        const tv = byVotes('tv').filter((t) => !(t.genreIds ?? []).includes(16));
        const seen = movies.slice(0, 40);
        const wish = movies.slice(40, 56);
        const ranked = seen.slice(0, 30).sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
        const now = Date.now();
        const answers = [
          ...seen.map((t, i) => ({ key: t.key, type: 'movie', status: 'seen', tier: i % 7 === 6 ? 'meh' : 'good', updatedAt: now })),
          ...wish.map((t) => ({ key: t.key, type: 'movie', status: 'wish', updatedAt: now })),
          ...tv.slice(0, 15).map((t) => ({ key: t.key, type: 'tv', status: 'seen', tier: 'good', updatedAt: now })),
        ];
        const day = (offset) => {
          const d = new Date(now - offset * 86_400_000);
          return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        };
        const activity = Object.fromEntries(Array.from({ length: 12 }, (_, i) => [day(i), i === 0 ? 15 : 8 + ((i * 7) % 23)]));
        const tx = db.transaction(['answers', 'meta'], 'readwrite');
        for (const a of answers) tx.objectStore('answers').put(a);
        const meta = tx.objectStore('meta');
        meta.put({ key: 'ranking:movie', value: ranked.map((t) => t.key), updatedAt: now });
        meta.put({ key: 'ranking:wish:movie', value: wish.slice(0, 10).map((t) => t.key), updatedAt: now });
        meta.put({ key: 'activity', value: activity, updatedAt: now });
        tx.oncomplete = () => resolve(answers.length);
        tx.onerror = () => reject(tx.error);
      };
    };
    req.onerror = () => reject(req.error);
  });
}

/** Ouvre l'écran à capturer et attend que ses affiches soient chargées. */
async function capture(page, shot) {
  const hideNoise = () =>
    page.addStyleTag({ content: '.toast, .particle { display: none !important; } * { animation: none !important; transition: none !important; }' });
  if (shot === '1-accueil') await page.goto(`${BASE}/#/`);
  if (shot === '2-swipe') {
    await page.goto(`${BASE}/#/swipe/movie`);
    await page.locator('.swipe-card:not(.card-behind) .card-poster img').waitFor();
    // Un titre bien connu, avec son affiche : on passe les autres (flèche ↓ = « Passer »).
    for (let i = 0; i < 20; i++) {
      const votes = await page.evaluate(async () => {
        const name = document.querySelector('.swipe-card:not(.card-behind) .title-main')?.textContent;
        const titles = await new Promise((resolve) => {
          const req = indexedDB.open('rank-it-all');
          req.onsuccess = () => {
            const all = req.result.transaction('titles').objectStore('titles').getAll();
            all.onsuccess = () => resolve(all.result);
          };
        });
        return titles.find((t) => t.title === name)?.voteCount ?? 0;
      });
      if (votes > 8000) break;
      await page.keyboard.press('ArrowDown');
      await sleep(400);
    }
  }
  if (shot === '3-duel') {
    await page.goto(`${BASE}/#/rank/movie`);
    await page.locator('.duel-card img').first().waitFor();
  }
  if (shot === '4-classement' || shot === '5-tier-list') {
    await page.goto(`${BASE}/#/rank/movie`);
    await page.locator('.chips').first().locator('button').nth(shot === '4-classement' ? 1 : 2).click();
    await page.locator(shot === '4-classement' ? 'ol.list img' : '.tier-items img').first().waitFor();
  }
  if (shot === '6-wishlist') {
    await page.goto(`${BASE}/#/wishlist`);
    await page.locator('.list-item img').first().waitFor();
  }
  await hideNoise();
  await page.evaluate(() => window.scrollTo(0, 0));
  // Affiches visibles chargées, et un peu de temps pour les fiches (réalisateur, note, plateformes).
  await page.waitForFunction(() => [...document.images].filter((img) => img.getBoundingClientRect().top < innerHeight).every((img) => img.complete), null, { timeout: 30_000 });
  await sleep(2500);
}
