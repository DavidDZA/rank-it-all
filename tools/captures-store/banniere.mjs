/**
 * Bannière du Play Store (« image de présentation », 1024 × 500), dans chaque langue :
 * `node tools/captures-store/banniere.mjs [en es de it pt fr]` (sans argument : les 5 langues traduites).
 *
 * Même composition que la bannière française d'origine (store/banniere-1024x500.png) : icône, nom, slogan et
 * points forts traduits, et un téléphone qui montre la tier list de la langue (store/captures/<langue>/5-tier-list.png,
 * faite par captures.mjs). Rien à télécharger. Résultat : store/bannieres/banniere-<langue>.png.
 */
import { mkdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { chromium } from '@playwright/test';

const ROOT = resolve(import.meta.dirname, '../..');

/** Slogan (deux lignes au plus) et points forts, par langue. */
export const BANNER_TEXT = {
  fr: { tagline: 'Swipe, classe et compare tes films, séries et animes', points: 'Duels · Tier list · Wishlist · Entre amis' },
  en: { tagline: 'Swipe, rank and compare your movies, TV shows and anime', points: 'Duels · Tier list · Wishlist · With friends' },
  es: { tagline: 'Desliza, clasifica y compara tus películas, series y animes', points: 'Duelos · Tier list · Wishlist · Con amigos' },
  de: { tagline: 'Swipe, ranke und vergleiche deine Filme, Serien und Animes', points: 'Duelle · Tier-List · Wishlist · Mit Freunden' },
  it: { tagline: 'Swipa, classifica e confronta i tuoi film, serie e anime', points: 'Duelli · Tier list · Wishlist · Con gli amici' },
  pt: { tagline: 'Deslize, classifique e compare seus filmes, séries e animes', points: 'Duelos · Tier list · Wishlist · Com amigos' },
};

const dataUrl = (file, type) => `data:${type};base64,${readFileSync(file).toString('base64')}`;

/** Fabrique les bannières des langues demandées ; renvoie les fichiers écrits. */
export async function makeBanners(langs, browser) {
  const own = !browser;
  browser ??= await chromium.launch({ channel: 'chrome' });
  const font = dataUrl(resolve(ROOT, 'node_modules/@fontsource-variable/fredoka/files/fredoka-latin-wght-normal.woff2'), 'font/woff2');
  const icon = dataUrl(resolve(ROOT, 'android/store_icon.png'), 'image/png');
  const outDir = resolve(ROOT, 'store/bannieres');
  mkdirSync(outDir, { recursive: true });
  const page = await browser.newPage({ viewport: { width: 1024, height: 500 }, deviceScaleFactor: 1 });
  const written = [];
  for (const lang of langs) {
    const text = BANNER_TEXT[lang];
    if (!text) throw new Error(`Langue inconnue : ${lang}`);
    const shot = dataUrl(resolve(ROOT, 'store/captures', lang === 'fr' ? '' : lang, '5-tier-list.png'), 'image/png');
    await page.setContent(`<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><style>
      @font-face { font-family: Fredoka; src: url(${font}) format('woff2'); font-weight: 300 700; }
      html, body { margin: 0; width: 1024px; height: 500px; overflow: hidden; }
      body {
        position: relative;
        background: radial-gradient(circle at 18% 30%, #2d2560 0%, #17132e 45%, #100d1f 100%);
        font-family: Fredoka, system-ui, sans-serif;
        color: #f6f4ff;
      }
      .brand { position: absolute; left: 64px; top: 110px; display: flex; align-items: center; gap: 26px; }
      .brand img { width: 120px; height: 120px; border-radius: 28px; box-shadow: 0 0 60px rgb(139 124 255 / 0.35); }
      .brand h1 {
        margin: 0; font-size: 74px; font-weight: 700; letter-spacing: -0.5px;
        background: linear-gradient(90deg, #ff5fa2, #ff9f43); -webkit-background-clip: text; background-clip: text; color: transparent;
      }
      .tagline { position: absolute; left: 64px; top: 255px; width: 520px; margin: 0; font-size: 33px; font-weight: 600; line-height: 1.25; }
      .points { position: absolute; left: 64px; top: 362px; margin: 0; font-size: 21px; font-weight: 400; color: #aaa4ca; }
      .phone {
        position: absolute; left: 652px; top: 18px; width: 300px; height: 560px;
        border: 9px solid #1d1836; border-radius: 44px; overflow: hidden;
        transform: rotate(4deg); box-shadow: 0 20px 60px rgb(0 0 0 / 0.55), 0 0 0 2px #3a3266;
        background: #100d1f url(${shot}) top center / 100% auto no-repeat;
      }
    </style></head><body>
      <div class="brand"><img src="${icon}" alt=""><h1>Rank It All</h1></div>
      <p class="tagline">${text.tagline}</p>
      <p class="points">${text.points}</p>
      <div class="phone"></div>
    </body></html>`);
    await page.evaluate(() => document.fonts.ready);
    const file = resolve(outDir, `banniere-${lang}.png`);
    await page.screenshot({ path: file });
    written.push(file);
  }
  await page.close();
  if (own) await browser.close();
  return written;
}

// Lancé directement.
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const langs = process.argv.slice(2).length ? process.argv.slice(2) : ['en', 'es', 'de', 'it', 'pt'];
  for (const file of await makeBanners(langs)) console.log(file);
}
