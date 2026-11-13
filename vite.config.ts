import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA, type ManifestOptions } from 'vite-plugin-pwa';
import type { Plugin } from 'vite';

/** Description de l'appli à l'installation, par langue (le français dans manifest.webmanifest, les autres à côté). */
const DESCRIPTIONS: Record<string, string> = {
  fr: 'Classer les films, séries et animes que tu as vus.',
  en: 'Rank the movies, TV shows and anime you’ve watched.',
  es: 'Clasifica las películas, series y animes que has visto.',
  de: 'Ranke die Filme, Serien und Animes, die du gesehen hast.',
  it: 'Classifica i film, le serie e gli anime che hai visto.',
  pt: 'Classifique os filmes, séries e animes que você já viu.',
};

const MANIFEST: Partial<ManifestOptions> = {
  name: 'Rank It All',
  short_name: 'Rank It All',
  description: DESCRIPTIONS.fr,
  lang: 'fr',
  display: 'standalone',
  orientation: 'portrait',
  background_color: '#12121a',
  theme_color: '#12121a',
  start_url: '.',
  scope: '.',
  icons: [
    { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
    { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
  ],
};

/**
 * Un manifeste par langue (manifest-en.webmanifest…), même contenu avec la description traduite : l'écran de
 * chargement d'index.html pointe vers celui de la langue de l'appli.
 */
function localizedManifests(): Plugin {
  return {
    name: 'manifestes-par-langue',
    apply: 'build',
    generateBundle() {
      for (const [lang, description] of Object.entries(DESCRIPTIONS)) {
        if (lang === 'fr') continue;
        this.emitFile({ type: 'asset', fileName: `manifest-${lang}.webmanifest`, source: JSON.stringify({ ...MANIFEST, lang, description }) });
      }
    },
  };
}

// BASE_PATH vaut "/<nom du dépôt>/" sur GitHub Pages ("/rank-it-all/"), "/" en local.
export default defineConfig({
  base: process.env.BASE_PATH ?? '/',
  plugins: [
    react(),
    localizedManifests(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/favicon.svg', 'icons/apple-touch-icon.png'],
      manifest: MANIFEST,
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        runtimeCaching: [
          {
            // Les affiches sont gardées en cache pour un affichage rapide et hors ligne.
            urlPattern: /^https:\/\/image\.tmdb\.org\//,
            handler: 'CacheFirst',
            options: {
              cacheName: 'posters',
              expiration: { maxEntries: 4000, maxAgeSeconds: 60 * 60 * 24 * 90 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
});
