# Architecture — comment marche Rank It All

> **À lire en premier par toute nouvelle session de travail.** État au 13/11/2026. Ce qui reste à faire est dans
> [ROADMAP.md](ROADMAP.md).

## 1. L'appli

Web app (PWA) en français pour trier petit à petit les **films**, **séries** et **animes** qu'on a vus, sa
wishlist et ses classements, par sessions courtes. Gratuite, sans publicité, open source.

- **Swipe** (deux modes : 4 coins par défaut — ↗ vu 👍, ↘ vu 😐, ↖ envie, ↙ pas envie — ou 2 directions).
  Dès qu'on appuie sur la carte, des repères fixes et transparents montrent chaque direction (celle visée s'allume :
  `SwipeCard`, `.swipe-guide`). Tirage pondéré par les votes TMDB, filtres (période, genre, langue, note, personne),
  recommandations des titres aimés (tirées plus souvent, sans étiquette depuis le 13/11), sagas enchaînées dans
  l'ordre, avec « 💤 Pas envie de la saga » (tous ses films restant à trier en « pas envie », annulable d'un coup).
- **Fiche complète** d'un titre : en touchant la carte du swipe ou une ligne de liste, ou ℹ sur une affiche de duel
  (plus de résumé intermédiaire depuis le 13/11). ⚠️ Une fenêtre s'ouvre au **clic**, jamais au lever du doigt : le
  clic que le téléphone envoie juste après tomberait sur le fond de la fenêtre et la refermerait (bug du 13/11 : la
  fiche ne restait ouverte qu'en touchant le bas de l'affiche ; `SwipeCard` attend ce clic, 400 ms au plus). Sous l'affiche du swipe et des duels : année et genres sur une
  ligne, réalisateur et acteurs sur la suivante (`TitleText credits`, `cardGenres`).
- **Classement** par duels (insertion dichotomique), vérifications entre voisins, **déplacement à la main**
  (poignée ⠿ ou numéro), tier list, partage en image, filtre « dispo sur mes abonnements » (ce qu'on peut revoir).
  Même chose pour prioriser la wishlist.
- **Ce soir ?**, **Mes listes**, **ajout manuel**, **stats & badges** (6 cases en tête : films, séries, animes —
  ou « aimés » si la catégorie est masquée —, wishlist, classés, temps ; **51 badges** (3 par ligne) par thème dans `badges.ts`,
  calculés depuis `computeStats`, dont `discovery` pour les badges de découverte).
- **Compte optionnel** (Google ou e-mail) : synchro entre appareils ; **amis** (code ou lien d'invitation) et page
  **« À deux »** : son top, wishlist commune, tirage à deux, conseils croisés, compatibilité.

## 2. Technique

| Élément | Choix |
|---|---|
| Front | Vite, React 19, TypeScript, CSS par écran (`src/styles/`) ; pages chargées à la demande (`App.tsx`) |
| Base locale | IndexedDB via **Dexie** (`src/lib/db.ts`), base `rank-it-all`, schéma 3 : `titles`, `details`, `answers`, `meta`, `synced` |
| Catalogue | API **TMDB** depuis le navigateur (`src/lib/tmdb.ts`, `src/lib/sync.ts`) |
| Comptes | **Supabase** (auth + PostgreSQL + règles RLS), schéma dans `supabase/schema.sql`, types dans `src/lib/database.types.ts` |
| Hébergement | **GitHub Pages** (`https://daviddza.github.io/rank-it-all/`), déployé par GitHub Actions à chaque push sur `main`. L'ancienne adresse `/Sort-your-stuffs/` redirige (dépôt `Sort-your-stuffs`, fichiers dans `tools/ancienne-adresse/`, dont un `sw.js` qui retire l'ancienne version installée) |
| Secrets | GitHub : `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` (injectés au build en `VITE_…`) ; `TMDB_TOKEN`, `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` pour le relais TMDB (§ 3.4), jamais dans le site ; Android, sauvegarde : § 2.1, § 4.3. En local : `.env.local` (ignoré par git) |
| Appli Android | **TWA** (Trusted Web Activity) : le site en plein écran dans une appli Play Store, `io.github.daviddza.rankitall` (voir § 2.1) |
| Tests | **Vitest** (`tests/`, logique + base en mémoire) ; **Playwright** (`e2e/`, appli construite dans le Chrome installé, formats téléphone et PC) |

```
src/
  App.tsx            routeur par ancre (#/swipe/anime, #/rank/tv, #/duo/<id>…), pages chargées à la demande
  lib/               logique et données, sans affichage
    db.ts              base locale, migrations, fiches jointes à la lecture (withDetails)
    category.ts        catégories films / séries / animes
    tmdb.ts sync.ts    API TMDB, téléchargement du catalogue (une requête par seuil)
    ranking.ts         classement : insertion, vérifications, déplacement, séparation des animes
    cloud.ts cloudMerge.ts supabase.ts database.types.ts   compte et synchro
    friends.ts together.ts   amis, comparaison entre deux comptes
    stats badges activity themes tonight recommend tiers share backup settings fun hooks
  components/        Duel, DuelCard, RankedList, TierList, SwipeCard, Fiche, FilterSheet, common…
  pages/             un fichier par écran ; swipe/, settings/ (une rubrique par fichier), duo/ (un onglet par fichier)
supabase/schema.sql  tout le schéma serveur, relançable sans risque
tests/  e2e/         Vitest, Playwright
```

### 2.1 Appli Android (TWA)

L'appli Android ouvre `https://daviddza.github.io/rank-it-all/` en plein écran dans Chrome : mêmes données que
le site (même adresse), connexion Google inchangée, mises à jour instantanées (c'est le site). Une nouvelle
version Android n'est utile que pour changer ses réglages (nom, icône, couleurs, niveau d'API exigé par Google).

- `android/twa-manifest.json` : réglages (package, couleurs, version, clé `upload`) ; `android/generate.mjs`
  (bibliothèque Bubblewrap) génère le projet Gradle à côté, commité tel quel. Après modification :
  `cd android && npm install && npm run generate`, en augmentant `appVersionCode` pour une nouvelle version.
  ⚠️ Laisser `enableSiteSettingsShortcut` à `true` : à `false`, `androidbrowserhelper` 2.7.4 plante au démarrage
  (il désactive `ManageDataLauncherActivity`, alors absente du manifeste — version 1, corrigée en version 2).
- `generate.mjs` retouche le projet généré (version 3, 1.0.2) : plus d'image de lancement envoyée à Chrome, et
  `LauncherActivity` ouvre le site dans un onglet Chrome intégré (Custom Tab, avec barre d'adresse) si le plein
  écran n'a pas démarré au bout de 8 s. `androidbrowserhelper` n'a ni délai ni secours si Chrome ne répond pas
  pendant le lancement : l'appli restait figée sur le logo chez un testeur (Pixel 10 Pro) dont Chrome marchait.
- L'écran de lancement (grand logo) reste affiché tant que Chrome n'a rien dessiné de la page : `index.html`
  affiche donc tout de suite un écran « Chargement… » (remplacé par l'appli, ou par un message et « Réessayer »
  au bout de 15 s), et `main.tsx` n'attend pas les reprises de la base plus de 4 s avant d'afficher l'appli
  (11/11/2026, appli figée sur le logo chez un testeur sur Pixel 10 Pro).
- `.github/workflows/android.yml` compile et signe (`rank-it-all.aab` pour la Play Console, `rank-it-all.apk`
  pour tester) ; rien à installer sur le PC. Secrets `ANDROID_KEYSTORE_BASE64` / `ANDROID_KEYSTORE_PASSWORD` :
  la clé de dépôt (`upload-key.p12`, alias `upload`), gardée hors du dépôt ; Google re-signe avec sa clé
  (*Play App Signing*).
- **Digital Asset Links** : `https://daviddza.github.io/.well-known/assetlinks.json` (dépôt `DavidDZA.github.io`,
  source dans `tools/racine-du-site/`) liste les empreintes SHA-256 de la clé de dépôt **et** de la clé de
  signature de Google Play. Sans lui, l'appli affiche une barre d'adresse. Les liens `…/rank-it-all/…`
  (invitations, réinitialisation du mot de passe) ouvrent l'appli.

## 3. Données

### 3.1 Base locale (Dexie)

- Nom : `rank-it-all`. Jusqu'au 01/11/2026, l'appli s'appelait « Sort my stuffs » et sa base `sort-my-stuffs` :
  `migrateDatabaseName` (au démarrage, avant tout) la met au schéma actuel, recopie toutes ses tables en une
  transaction avec un repère `renamed-from:sort-my-stuffs` (jamais recopiée deux fois), puis la supprime. Les
  sauvegardes JSON portent `app: 'rank-it-all'` ; celles en `sort-my-stuffs` restent importables.

- `titles` : le catalogue TMDB + titres ajoutés à la main. Clé `movie:550` / `tv:1399`. **Sans les fiches
  détaillées** : elles sont dans `details` (même clé), jointes à la lecture par `withDetails` là où il en faut
  (wishlist, ce soir, stats, classement, à deux). Le titre garde deux repères : `detailsAt` (fiche à jour) et
  `collectionId` (saga). Garde-fou : un hook Dexie empêche d'enregistrer une fiche dans un titre.
  Une fiche porte `complete` quand la réponse de TMDB contenait casting et plateformes (`append_to_response`) ; une
  réponse sans eux n'est pas enregistrée. Une fiche d'avant le 12/11 sans aucun nom (ni réalisateur ni acteur) est
  redemandée à son prochain affichage (`detailsOutdated`, `tmdb.ts`) : des appareils avaient gardé des fiches vides,
  donc sans réalisateur, acteurs, plateformes ni bande-annonce, jamais rafraîchies.
- `answers` : une réponse par titre (`seen` / `unseen` / `wish`, avis `good` / `meh`, `updatedAt`).
- `meta` : classements `ranking:<catégorie>` et `ranking:wish:<catégorie>`, placement en cours `insert:…`,
  `activity`, `badges`, `boosts:movie|tv`, `saga:<id>`, `min-votes`, `show-anime`, `custom-imports`, `lastSync`, `lastExport`.
  `setMeta` date chaque écriture (`updatedAt`, pour la synchro).
- `synced` : état de la synchro (voir 4.1).
- `localStorage` : préférences propres à l'appareil (clé TMDB, abonnements, mode de swipe, filtres, astuces vues).
  Astuces de première visite : `lib/tutorial.ts` (identifiants, une par type d'écran : swipe 4 coins / 2 directions,
  classement… communes aux films, séries et animes), textes dans `components/Tutorial.tsx` ; « Revoir les astuces »
  en bas des réglages. Les tests de bout en bout les marquent toutes vues (`playwright.config.ts`), sauf
  `tutoriel.spec.ts`.

### 3.2 Catégories

Pour TMDB il n'y a que des films et des séries. L'appli distingue **films**, **séries** et **animes** : un anime
est une série TMDB du genre Animation en japonais (`category.ts`, `isAnimeTitle`). Les films d'animation japonais
restent des films. Partout où il s'agit de la catégorie de l'appli, le code dit `category` ; `type` est réservé
au type TMDB (`movie` / `tv`). Les classements anime sont séparés ; `splitAnimeRankings` sort les animes des
classements de séries sans perdre leur ordre (au démarrage, après chaque synchro, après un import).

### 3.3 Catalogue

`syncCatalogue` lance une requête `/discover` par seuil de votes (`catalogueQueries`) : films (1 000), séries
(50), animes (50), titres dans la langue de l'utilisateur (films 150, séries 20, quelle que soit la langue), films
d'avant 1980 (150). Un titre est gardé s'il passe l'un des seuils qui le concernent.

**Langue du catalogue** (13/11, `language.ts`, champ `lang` des seuils) : celle du téléphone ou du PC
(`navigator.languages[0]`, convertie en code TMDB : « pt-BR » → `pt`, « nb » → `no`, « zh-HK » → `cn`…), si elle
fait partie des langues originales de l'import sur mesure (`ORIGINAL_LANGS`) ; aucune pour l'anglais (ses titres
passent déjà le seuil général) ou une langue absente de la liste — pas de requête de langue alors. Détectée dès
l'ouverture (`getMinVotes`), puis **fixée** au premier téléchargement (`fixMinVotes`, après la lecture des seuils du
compte pour ne pas les écraser) : changer ensuite la langue de l'appareil ne change plus le catalogue, et tous les
appareils du compte ont la même. Modifiable dans Réglages → Catalogue (liste déroulante, dont « Aucune »). Les
appareils au catalogue déjà téléchargé et les seuils à l'ancienne (`frMovie`, `frTv`, sans langue : compte,
sauvegardes) restent en français (`normalizeMinVotes`). Les titres absents du nouveau téléchargement sont **supprimés** — sauf
ceux **vus ou en wishlist** (ajouts manuels compris), qui restent avec leur place dans les classements. Les titres
jamais triés ou « pas vu / pas envie » partent avec leur réponse, donc aussi sur le compte. Les seuils sont
synchronisés pour que deux appareils ne s'effacent pas des titres.

**Premier téléchargement automatique** (`catalogueDownload.ts`) : au démarrage, si le catalogue n'a jamais été
téléchargé sur l'appareil (pas de meta `lastSync` ; un téléchargement interrompu recommence donc au lancement
suivant), il part tout seul avec les seuils enregistrés (ceux du compte une fois la session lue, sinon les seuils par
défaut). Un seul onglet à la fois (verrou). Progression dans l'accueil, le swipe (catalogue vide) et Réglages →
Catalogue (`CatalogueProgress`) ; en cas d'échec, « Réessayer ». `syncCatalogue` prépare d'abord toutes les requêtes
(nombre de pages connu), d'où une progression en pourcentage. Les réglages fins (seuils, imports sur mesure) restent
dans Réglages → Catalogue.

**Nouveautés au démarrage** (`addNewTitles`, `checkNewTitles`) : quand le catalogue est déjà téléchargé, au plus une
fois par jour (meta `new-titles`, propre à l'appareil), les mêmes requêtes que le catalogue sont relancées sur les
sorties des deux dernières années (quelques dizaines de demandes au lieu de 900), en arrière-plan. Elles ajoutent
les titres qui viennent de passer un seuil, sans rien supprimer (c'est le rôle de la mise à jour complète, toujours
rappelée sur l'accueil au bout de 30 jours) ; un message seulement s'il y a des ajouts. Le swipe relit alors son
catalogue. Une mise à jour complète compte comme recherche de nouveautés.

**Imports sur mesure** (films seulement, `customImports.ts`, Réglages → Import sur mesure) : une requête de plus
par import (genre, langue originale, pays de production, années ; 150 votes par défaut), lancée tout de suite
(`importCustom`) puis relancée par chaque `syncCatalogue`. Retenus dans la meta `custom-imports` (synchronisée) :
supprimer un import laisse partir ses films à la prochaine mise à jour, sauf ceux vus ou en wishlist.

### 3.4 Accès à TMDB

Le site n'a **aucune clé TMDB** : il appelle le **relais TMDB** (Cloudflare Worker, `worker/`, voir son README),
adresse donnée au déploiement (`VITE_TMDB_RELAY`). Le relais ajoute la clé (secret `TMDB_TOKEN`), n'accepte que le
site et les chemins utilisés, limite le débit par IP et garde les réponses en cache. Une clé saisie dans Réglages →
Clé TMDB reste prioritaire : l'appli appelle alors TMDB directement ; si TMDB la refuse (clé régénérée, par exemple
l'ancienne clé du site, régénérée le 11/11), elle est oubliée et l'appli repasse par le relais. Les chemins acceptés
par le relais sont dans `worker/src/routes.js` : tout nouvel appel TMDB doit y être ajouté (`tests/relais.test.ts`
le vérifie ; `/search/person` manquait, recherche par réalisateur ou acteur en panne du 11 au 12/11). En local, sans relais, `VITE_TMDB_TOKEN` dans
`.env.local`. Les affiches (`image.tmdb.org`) ne demandent pas de clé.

### 3.5 Performances (12/11/2026)

Règles tirées des lenteurs du 12/11 (classement « Chargement… » plus d'une minute sur téléphone pendant l'arrivée des
fiches, fiches qui ne revenaient pas, « Annuler » sans effet dans les duels) :

- **Une seule file pour TMDB** (`tmdb()`, `tmdb.ts`) : au plus `MAX_IN_FLIGHT` (6) demandes à la fois ; celles de
  l'écran (fiche ouverte, recherche, carte du swipe) passent avant celles d'arrière-plan (`background` : catalogue,
  `prefetchDetails`, logos des listes). Un refus 429 met toute la file en pause (`Retry-After`), au lieu que chaque
  demande réessaie de son côté ; les nouveaux essais contournent la mémoire du navigateur (`cache: 'reload'`).
- **Relais** : seules les bonnes réponses sont marquées « à garder » ; un refus de TMDB est `no-store` (avant : gardé
  24 h par le navigateur, la fiche ne revenait jamais). Un 429 de TMDB est réessayé une fois après 1 s (les adresses
  de Cloudflare sont partagées).
- **Fiches enregistrées par lots** (`saveDetails`, toutes les `SAVE_BATCH_MS`) : une écriture par lot, puis
  l'événement `DETAILS_SAVED`. Les échecs récents ne sont pas redemandés en arrière-plan avant 2 min.
- **Pas de lecture vivante des titres et des fiches dans les listes** : `useLiveQuery` ne lit que les clés
  (classement, réponses), et `useTitleMap` (`hooks.ts`) lit les titres et fiches à part, au plus toutes les 2 s quand
  des fiches arrivent. Une lecture vivante de 600 titres relancée à chaque écriture ne finissait jamais. Utilisé par le
  classement, la tier list, la wishlist, « Ce soir », Mes listes et la page de classement.
- **Longues listes dessinées par paquets** (`RankedList` : 60 lignes, puis 100 de plus à l'approche du bas).
- **Nouveautés du démarrage** : seuls les titres absents de la base sont écrits.
- **Stats** : recalculées toutes les 3 s pendant le complément des fiches, avec un compteur qui descend.

## 4. Compte et amis (Supabase)

### 4.1 Synchro (`cloud.ts`, `cloudMerge.ts`)

Local d'abord : l'appli lit et écrit dans Dexie ; la synchro tourne en arrière-plan (au démarrage, 5 s après une
modification, au retour sur l'onglet ou du réseau, toutes les 2 min).

- Chaque ligne (`a:<clé>` réponse, `m:<clé>` meta) est comparée à son **ombre** (table `synced`, empreinte de la
  dernière version synchronisée) : différente = modifiée sur l'appareil. Marche quel que soit le chemin
  d'écriture (import, effacement, catalogue…).
- Conflit : la date la plus récente gagne (à égalité, le compte) ; activité et badges fusionnés. Suppressions en
  pierres tombales (`deleted`). Relecture de 60 s de recouvrement. La lecture filtre sur son propre `user_id`
  (les règles laissent aussi lire ce que partagent les amis).
- Meta synchronisées : `isUserMeta` (`ranking:`, `saga:`, `boosts:`, `activity`, `badges`, `min-votes`,
  `show-anime`, `custom-imports`) — les mêmes que la sauvegarde JSON.
- Chaque réponse envoyée porte une **copie allégée du titre** (`titleCopy` : clé, type, id TMDB, titres, année,
  affiche, genres, langue, note), pour l'afficher chez un ami ou sur un nouvel appareil ; aucune pour « pas vu ».
  C'est l'essentiel de la place prise sur Supabase (≈ 0,3 Ko par titre vu ou en wishlist, ≈ 0,1 Ko sinon).
  Nettoyage des anciennes copies complètes : `supabase/2026-11-01-copies-allegees.sql` (lancé une fois).
- Connexion Google en PKCE (`?code=…`, l'ancre reste au routeur).

### 4.2 Serveur (`supabase/schema.sql`)

Tables `profiles` (pseudo, code ami, partage), `answers`, `user_meta`, `friendships`. Règles RLS : chacun ses
lignes ; un ami lit en lecture seule ce qu'on partage (`share_wishlist` : wishlist et priorités ;
`share_ranking` : titres vus, avis, classements), jamais les « pas envie ». Fonctions : `add_friend`,
`find_friend_code`, `new_friend_code`, `delete_account`. Le script se relance en entier sans risque après chaque
modification (à faire par l'utilisateur dans *SQL Editor*).

Réglages du projet Supabase : URL du site et `http://localhost:5173/**` dans *Authentication → URL
Configuration* ; confirmation d'e-mail désactivée ; e-mails (réinitialisation du mot de passe) envoyés par un **compte Gmail
dédié** en SMTP (*Authentication → Emails → SMTP Settings*, mot de passe d'application), modèle en anglais ; sans
nom de domaine, Hotmail / Outlook les classent en indésirables (solution : domaine + Brevo, à décider avec Android) ;
mot de passe : 8 caractères, minuscule, majuscule, chiffre et symbole (repris dans `PASSWORD_RULES`, `cloud.ts`) ; fournisseur Google configuré (écran de consentement publié). Facebook abandonné (Meta exige une
entreprise vérifiée).

### 4.3 Sauvegarde et restauration

L'offre gratuite de Supabase n'a pas de sauvegarde. Le workflow `.github/workflows/backup.yml` en fait une chaque nuit
(rôles, schéma, données, comptes `auth.users` compris), chiffrée en AES-256 et gardée 90 jours dans GitHub Actions
(fichiers du workflow, téléchargeables par tout compte GitHub : d'où le chiffrement). Il échoue — et GitHub prévient
par e-mail — si une table manque. Secrets : `SUPABASE_DB_URL` (chaîne **Session pooler**, *Connect* dans Supabase :
les machines GitHub n'ont pas d'IPv6) et `BACKUP_PASSPHRASE` (à garder aussi dans un gestionnaire de mots de passe).
GitHub suspend les workflows planifiés d'un dépôt public sans activité depuis 60 jours (un e-mail prévient).

Restaurer (dans un projet Supabase neuf, ou le même vidé) :

1. *Actions → Sauvegarde Supabase* → une exécution → télécharger le fichier, le dézipper.
2. Déchiffrer (Git Bash) : `gpg -d rank-it-all-AAAA-MM-JJ.tar.gz.gpg | tar xzf -` → dossier `backup/`.
3. Recharger (client PostgreSQL `psql`, ou `docker run --rm -it -v "$PWD/backup:/b" postgres:17 psql …`) :
   ```sh
   psql --single-transaction --variable ON_ERROR_STOP=1      --file backup/roles.sql --file backup/schema.sql      --command 'SET session_replication_role = replica'      --file backup/data.sql --dbname "<chaîne Session pooler du projet cible>"
   ```
4. Projet neuf : refaire les réglages du § 4.2 (URL, Google) et changer les secrets `SUPABASE_URL` /
   `SUPABASE_PUBLISHABLE_KEY` (déploiement) et `SUPABASE_DB_URL` (sauvegarde).

## 5. Tests et vérifications

- `npx tsc -b`, `npm test` (Vitest), `npm run build` avant chaque push.
- `node worker/test.mjs` : le relais TMDB, avec Cloudflare et TMDB simulés. `tests/relais.test.ts` (Vitest) branche
  l'appli sur le code du relais : chaque appel TMDB du code est accepté, la fiche revient complète (réalisateur,
  acteurs, plateformes, bande-annonce), fiches vides redemandées, clé personnelle refusée remplacée par le relais.
- Vitest couvre aussi la sauvegarde (aller-retour, anciennes sauvegardes « Sort my stuffs », fichier refusé :
  `backup.test.ts`), les stats et badges (`stats.test.ts` : chiffres de découverte, jours actifs, titres aimés,
  wishlist priorisée, nanars ; 51 badges aux noms et emojis uniques, nouveaux badges débloqués aux bons chiffres), la
  décision du démarrage (premier téléchargement ou nouveautés, au plus une fois par jour : `demarrage.test.ts`), les
  sagas du swipe (films restant à écarter) et les genres sous l'affiche (`swipe.test.ts`), la langue du catalogue
  (détection de la langue de l'appareil, langue fixée, ancien format, requêtes et téléchargement en espagnol,
  japonais, français ou sans langue : `langue.test.ts`).
- `npm run e2e` : Playwright sur l'appli construite, dans le Chrome installé, formats téléphone (tactile) et PC.
  Parcours couverts : swipe (4 coins et 2 directions, boutons, vrais gestes, clavier, annuler / passer, « Annuler »
  une fois tout trié, repères pendant le glissement et tampon masqué, plus d'étiquette « Comme … » ; « Pas envie de
  la saga » : place en bas de l'affiche, texte lisible, effacé pendant le glissement, compte des films, absent à
  « aimé ? », annulation d'un coup : `swipe.spec.ts`), fiche et ajout manuel avec TMDB simulé (fiche ouverte
  directement depuis le swipe, une liste ou ℹ d'un duel, et qui reste ouverte où qu'on touche l'affiche, doigt
  immobile ou qui bouge un peu ; messages qui laissent passer le doigt ; réalisateur, acteurs, bande-annonce,
  plateformes, genres sous l'affiche, fiche vide complétée, recherche par titre et par réalisateur : `fiche.spec.ts`),
  duels, Mes listes, « Ce soir ? », sauvegarde exportée puis réimportée (`parcours.spec.ts`), stats (6 cases, aussi
  sans les animes, plus de rubrique « Sagas complètes ») et 51 badges à 3 par ligne, tier list, partage en image
  (partage du téléphone simulé, ou téléchargement), filtres du swipe (`ecrans.spec.ts`), astuces à jour
  (`tutoriel.spec.ts`), langue du catalogue avec un navigateur en espagnol, portugais, japonais, français, allemand,
  anglais ou swahili : premier téléchargement, réglages, langue choisie à la main, utilisateurs actuels restés en
  français (`langue.spec.ts`, option `locale` de Playwright). Outils communs dans `e2e/helpers.ts`
  (`seed`, `readAnswers`, `readMeta`, `mockTmdbApi`).
- **Performances** : `tests/perf.test.ts` (file des demandes, pause commune sur 429, nouvel essai sans la mémoire du
  navigateur, écritures groupées, échecs pas redemandés en boucle ; budgets de temps des calculs sur 14 000 titres :
  stats, filtres, tirage, « À deux », tier list, synchro) et `e2e/perf.spec.ts` (classement de 600 titres, classement
  pendant l'arrivée de 300 fiches, au plus 6 demandes à la fois, TMDB limité à 40/s, duels et « Annuler », stats
  progressives, gros catalogue). Budgets larges : ils attrapent une régression nette. Sur la version du 12/11 au
  matin, 6 des 8 tests de bout en bout échouent. Les tests de la file mesurent les vrais instants (refus vraiment
  renvoyé, file d'arrière-plan vraiment pleine) au lieu de les supposer : avant le 13/11, deux d'entre eux échouaient
  de temps en temps sur une machine chargée. Les budgets de temps, eux, peuvent échouer si on lance plusieurs suites
  en même temps (ils mesurent la vitesse) : relancer seul.
- **Mesurer finement** (à refaire après un changement qui touche les listes ou TMDB) : compiler avec
  `VITE_TMDB_RELAY` (le relais accepte `localhost:4173`), servir `dist` sur le port 4173, puis dans Playwright :
  profil persistant avec le vrai catalogue (≈ 14 000 titres) et des centaines de vus, `serviceWorkers: 'block'` (sinon
  le service worker ressert une ancienne version), processeur ralenti 4 fois (`Emulation.setCPUThrottlingRate`, pour
  un téléphone), et une copie du profil pour repartir des mêmes données à chaque mesure.
- **Supabase simulé** (`e2e/fakeSupabase.ts`) : session ouverte, profils, amitiés, réponses et classements, sans
  aucune demande au vrai projet (une demande non prévue est notée et fait échouer le test). Il sert à « À deux »
  (son top, wishlist commune, conseils, compatibilité, partage refusé : `duo.spec.ts`) et à la synchro (réponses
  venues d'un autre appareil, envoi avec la copie allégée : `synchro.spec.ts`). À compléter si l'appli appelle une
  nouvelle table ou fonction.
- `npm run e2e:live` : sur le vrai projet Supabase (comptes de test créés puis supprimés) — après toute
  modification de la synchro, des amis ou du schéma.

## 6. Conventions de travail

- Interface, messages de commit et commentaires **en français**, sobres.
- L'utilisateur a un **téléphone Android professionnel** (pas d'APK hors magasin) et utilise aussi l'appli sur
  **PC** : vérifier tout changement visible aux deux formats (393 × 760 tactile et PC).
- L'utilisateur demande en général de **pousser directement sur `main`** une fois vérifié ; vérifier ensuite que
  le déploiement passe. Commits terminés par la ligne `Co-Authored-By` demandée par l'outil.
- Proposer avant d'implémenter quand la demande est ouverte ; garder l'appli utilisable **sans compte** et les
  anciennes sauvegardes importables.
- Jamais de secret dans le dépôt (public) ; coûts d'hébergement à zéro (offres gratuites).
