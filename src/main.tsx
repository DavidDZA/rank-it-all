import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import '@fontsource-variable/fredoka';
import App from './App';
import { startCloud } from './lib/cloud';
import { migrateMinVotes } from './lib/settings';
import { migrateDatabaseName } from './lib/db';
import { splitAnimeRankings } from './lib/ranking';
import './styles/index.css';

registerSW({ immediate: true });

// Avant l'affichage : base reprise sous le nouveau nom de l'appli, seuils repris de l'ancien stockage,
// animes sortis des classements de séries. Jamais plus de quelques secondes : une base qui ne répond pas ne doit
// pas laisser l'appli bloquée sur l'écran de chargement (ces reprises continuent et se terminent plus tard).
const migrations = migrateDatabaseName()
  .catch((e) => console.error('Reprise de l’ancienne base :', e)) // elle reste en place, réessayée au prochain lancement
  .then(() => Promise.allSettled([migrateMinVotes(), splitAnimeRankings()]));
const STARTUP_WAIT = 4000;

Promise.race([migrations, new Promise((resolve) => setTimeout(resolve, STARTUP_WAIT))])
  .finally(() => {
    startCloud();
    createRoot(document.getElementById('root')!).render(
      <StrictMode>
        <App />
      </StrictMode>,
    );
  });
