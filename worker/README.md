# Relais TMDB

Cloudflare Worker entre l'appli et TMDB : le site l'appelle **sans clé**, le relais ajoute la clé TMDB (secret
`TMDB_TOKEN`, que lui seul connaît) et transmet la demande.

- Adresse : `https://rank-it-all-tmdb.rankitall.workers.dev` (compte Cloudflare de l'utilisateur, sous-domaine
  `rankitall`).
- N'accepte que les demandes venant du site (`ALLOWED_ORIGINS`) et les chemins utilisés par l'appli (`ROUTES`).
- Limite de débit : 1 500 demandes par minute et par adresse IP (`wrangler.toml`).
- Cache partagé entre utilisateurs : 12 h pour les pages du catalogue, 24 h pour les fiches, 1 h pour les recherches.
- Offre gratuite : 100 000 demandes par jour ; un premier téléchargement du catalogue en fait environ 900.

Déploiement automatique à chaque modification de ce dossier (`.github/workflows/worker.yml`), ou à la main :
*Actions → Relais TMDB → Run workflow*. Secrets GitHub : `CLOUDFLARE_API_TOKEN` (jeton « Edit Cloudflare
Workers », sans expiration), `CLOUDFLARE_ACCOUNT_ID`, `TMDB_TOKEN` (recopié dans le relais à chaque déploiement :
après avoir changé la clé TMDB, relancer ce déploiement).
