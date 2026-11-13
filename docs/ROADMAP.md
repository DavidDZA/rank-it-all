# Feuille de route — ce qui reste à faire

> État au 13/11/2026. Comment l'appli marche aujourd'hui : [ARCHITECTURE.md](ARCHITECTURE.md).
> Fait : comptes et synchro, amis et « À deux », catégorie Animes, seuils français / vieux films, classement à
> la main, refonte (fiches à part, chargement découpé, types Supabase, tests de bout en bout) ; puis (01-02/11)
> renommage en **Rank It All** (base locale migrée, ancienne adresse redirigée), filtre « dispo sur mes
> abonnements » dans les classements, import sur mesure de films, copies de titres allégées sur Supabase (÷ 5),
> sauvegarde nocturne chiffrée, e-mails par Gmail et règles du mot de passe, bouton Retour, appli Android (TWA)
> compilée et signée, fiche Play Store prête ; (08/11) appli créée dans la Play Console, version 2 en test
> interne, fiche du Store et formulaires « Contenu de l'appli » remplis (`store/fiche-play-store.md`) ; (10-11/11)
> compte de démonstration, **test fermé validé et ouvert aux testeurs**, écran « Chargement… » immédiat,
> catalogue téléchargé tout seul à la première ouverture (barre de progression), astuces à la première visite de
> chaque écran, **version 3 (1.0.2)** contre le blocage sur le logo (envoyée pour examen), **relais TMDB**
> (Cloudflare, plus de clé dans le site ; clé régénérée) ; (12/11) **12 testeurs inscrits**, premiers retours corrigés :
> fiches sans réalisateur, acteurs, plateformes ni bande-annonce (ancienne clé TMDB refusée, fiches vides), recherche
> par personne refusée par le relais, lenteurs (classement figé, « Annuler » des duels, stats lentes : ARCHITECTURE
> § 3.5) ; nouveautés ajoutées au catalogue au démarrage (une fois par jour) ; tests : sauvegarde, stats, démarrage,
> tous les parcours de bout en bout, « À deux » et synchro avec Supabase simulé, tests de perf (ARCHITECTURE § 5) ;
> (13/11) appli fluide d'après l'utilisateur, version 3 validée ; 2ᵉ série de retours des testeurs : fiche complète
> ouverte directement (swipe, listes, ℹ des duels), genres sous l'affiche, repères des directions pendant le swipe,
> « 💤 Pas envie de la saga », plus d'étiquette « ✨ Comme … » (ARCHITECTURE § 1) ; fiche qui se refermait aussitôt
> (sauf en touchant le bas de l'affiche) corrigée ; 51 badges, 6ᵉ case « classés » dans les stats, plus de rubrique
> « Sagas complètes » ; bouton saga en bas de l'affiche, rouge transparent, texte lisible ; tests de toute la session
> ajoutés (ARCHITECTURE § 5), et deux tests de la file TMDB qui échouaient parfois rendus fiables.
>
> **Reprendre ici** — test fermé en cours depuis le 11/11 (12 testeurs inscrits le 12/11) : 14 jours écoulés vers le
> 26/11 (§ 2 étapes 5-6), puis demander la production. D'abord : demander à l'utilisateur ce que les testeurs pensent
> des changements du 13/11 (repères du swipe surtout), et s'il a d'autres retours. Ensuite : **traduction**
> (§ 4, décisions à prendre au début de la session), puis musique et jeux vidéo (§ 5). Faire connaître l'appli après la sortie : [PROMOTION.md](PROMOTION.md).

## 1. Décisions en attente

Aucune. Dernière tranchée : D7, licence du dépôt → **MIT** (`LICENSE`, © Super Bobiz, le 08/11/2026).

## 2. Appli Android

Décidé le 01/11/2026 : **TWA** sans nom de domaine (le site en plein écran ; vérification par le dépôt
`DavidDZA.github.io`), package **`io.github.daviddza.rankitall`**, nom **Rank It All**. Fonctionnement :
ARCHITECTURE § 2.1. Capacitor écarté : données séparées du site, connexion Google à refaire (Google la refuse
dans une page web intégrée), liens qui n'ouvrent pas l'appli. Il resservira peut-être pour iOS.

Reste à faire :

1. ~~Dépôt `DavidDZA.github.io`, secrets `ANDROID_KEYSTORE_*`, fiche du Store, compte Play Console, appli créée,
   test interne, empreinte de la clé Google dans `assetlinks.json`~~ — fait (08/11, version 2 : la version 1
   plantait au démarrage, voir ARCHITECTURE § 2.1).
2. Test fermé (12 testeurs, 14 jours), puis production (§ 3). La traduction ne bloque pas : les fiches dans
   d'autres langues s'ajoutent dans la Play Console sans nouvelle version.

**Reprise (état au 08/11/2026 au soir)** — fait dans la Play Console : appli créée, version 2 en test interne,
fiche principale (textes, icône, bannière, 6 captures ; pas de captures tablette), catégorie Divertissement et tags,
coordonnées, accès à l'appli (compte de démonstration), annonces, classification, public cible (18 ans et plus,
sans blocage des mineurs), sécurité des données, suppression de compte et suppression partielle (lien
`confidentialite.html#suppression-partielle`), déclaration IA (rien à signaler). Groupe Google
`rank-it-all--testeurs@googlegroups.com` créé (propriétaire `rankitall.app`, l'utilisateur y est membre).
**Rien d'autre n'est fait.** Étapes suivantes, dans l'ordre :

1. ~~**Compte de démonstration** `rankitall.app+review@gmail.com`~~ — fait (09/11) : créé, adresse confirmée,
   quelques titres classés, ami du compte de l'utilisateur, identifiants (mot de passe compris) saisis dans
   « Accès à l'appli » (mot de passe dans le gestionnaire de mots de passe de l'utilisateur, jamais dans le dépôt).
2. Tableau de bord de la Play Console : toutes les tâches « Configurer votre application » en vert.
3. *Tester et publier → Tests → Test fermé → Gérer la piste* : pays (France + ceux des testeurs) ; testeurs =
   **Groupes Google** → `rank-it-all--testeurs@googlegroups.com` ; commentaires → `rankitall.app@gmail.com` ;
   **Créer une version → Ajouter depuis la bibliothèque → 2 (1.0.1)**, notes de version (texte dans la fiche) ;
   Enregistrer. — fait (10/11), version enregistrée.
4. *Vue d'ensemble de la publication* → **Envoyer les modifications pour examen** (quelques heures à quelques jours).
   — fait le 10/11 (avec la déclaration « Identifiant publicitaire : non » demandée au passage). **En attente du
   résultat de l'examen** (e-mail de Google).
5. En attendant : faire rejoindre le groupe (lien déjà actif). Après validation : envoyer le message aux testeurs
   (texte prêt dans `store/fiche-play-store.md`, § « Message aux testeurs »). Viser 15-20 testeurs.
6. 14 jours après le 12ᵉ inscrit : demander l'accès à la production (tableau de bord).

**Version 3 (1.0.2)** (11/11) : correctif du blocage sur le logo chez un testeur (voir ARCHITECTURE § 2.1). À importer
dans la Play Console (*Test fermé → Créer une version → Importer* `rank-it-all.aab` des artefacts du workflow
« Appli Android »), puis envoyer pour examen — fait le 11/11. Inscriptions des testeurs en cours.

⚠️ Téléphone professionnel de l'utilisateur : selon la politique de son entreprise, l'installation depuis le
Play Store peut être limitée (Play Store géré). La PWA reste la solution de repli.

---

## 3. Publication sur le Google Play Store

### 3.1 Google Play

1. **Compte développeur** Google Play Console : **25 $ une seule fois**, vérification d'identité (pièce
   d'identité, parfois adresse et téléphone ; délai de quelques jours).
2. **Règle des comptes personnels récents** : avant de pouvoir publier en production, un **test fermé avec au
   moins 12 testeurs inscrits pendant 14 jours d'affilée** est exigé (règle en vigueur depuis fin 2024 ;
   à vérifier au moment de la publication). Prévoir de recruter ces testeurs (proches, amis).
3. **Fiche de l'appli** : nom, description courte / longue (français), icône 512 × 512, bannière 1024 × 500,
   captures d'écran téléphone (au moins 2), catégorie (Divertissement), coordonnées.
4. **Obligations** :
   - **Politique de confidentialité** publiée à une URL (une page du site suffit) : données collectées
     (e-mail, pseudo, réponses, classements), hébergeur (Supabase), suppression ;
   - formulaire **Sécurité des données** (Data safety) cohérent avec cette politique ;
   - **suppression de compte** dans l'appli **et** depuis une page web (obligatoire pour toute appli avec
     création de compte) ;
   - questionnaire de **classification du contenu** ;
   - **niveau d'API cible** imposé par Google (Android 15 / API 35 depuis août 2025, en principe Android 16 /
     API 36 pour les nouvelles applis en 2026 — à vérifier dans la Play Console) ;
   - public cible : pas les enfants (évite les règles « Familles »).
5. **Conditions des données tierces** :
   - **TMDB** : mention « This product uses the TMDB API but is not endorsed or certified by TMDB » et logo
     TMDB visibles (déjà présents dans les réglages, à ajouter à la fiche / page « À propos »). L'appli étant
     **gratuite, sans pub ni achat intégré**, c'est un usage non commercial, couvert par la clé API gratuite —
     relire quand même les conditions d'utilisation de l'API avant publication ;
   - **JustWatch** (plateformes) : attribution « Disponibilités : JustWatch » (déjà présente).
6. Dans la Play Console : « Contient des annonces : **non** », aucun achat intégré, appli **gratuite**
   (une appli publiée gratuite ne peut plus devenir payante — sans objet ici).
7. Envoi de l'AAB en **test interne** → **test fermé** (12 testeurs, 14 jours) → demande d'accès à la
   **production** → examen Google (de quelques heures à quelques jours).
8. Ensuite : chaque mise à jour = nouvel AAB avec `versionCode` incrémenté.

### 3.2 Option : F-Droid (magasin d'applis open source)

L'appli étant open source, elle peut aussi être publiée sur **F-Droid** (gratuit, pas de compte développeur
payant, pas de test fermé de 14 jours). F-Droid compile l'appli lui-même depuis le dépôt public : il faut une
licence libre (MIT, fait), une compilation reproductible sans dépendance propriétaire (Capacitor et le client Supabase
sont open source ; pas de Google Play Services), et une demande d'inclusion (merge request sur
`gitlab.com/fdroid/fdroiddata`). L'appli serait marquée « NonFreeNet » car elle dépend de services en ligne non
libres (TMDB, Supabase) — c'est autorisé. Utile aussi si le Play Store est bloqué sur un téléphone donné.

**Effort : faible en code, mais 3 à 4 semaines de délais** (vérification, test fermé, examen).

---

## 4. Petites améliorations proposées (non lancées)

- **Traduction** (prochaine session) : environ 1 100 lignes de texte français dans une quarantaine de fichiers.
  Proposition : un dictionnaire par langue, le français en référence, typé pour que la compilation échoue s'il
  manque une traduction ; langue et pays détectés depuis le téléphone, modifiables dans les réglages. Au-delà des
  textes : langue des titres et résumés TMDB (`language: 'fr-FR'` dans `tmdb.ts` ; changer de langue demande une
  mise à jour du catalogue), **pays** des plateformes de streaming (`watch_region: 'FR'`, `results.FR`), seuils
  « titres en français » à généraliser (langue / pays de l'utilisateur), fiche du Play Store et page de
  confidentialité. **À décider** : les langues à la sortie (recommandé : français + anglais, d'autres ensuite) et
  le pays (recommandé : détecté depuis le téléphone, modifiable).

- **Code ami** : nouvel essai automatique si le code tiré existe déjà (risque infime aujourd'hui : l'inscription
  échouerait) — quelques lignes dans `schema.sql`.
- **Pseudo** : le demander à la première connexion Google (aujourd'hui : le nom du compte Google, modifiable).
- **Statistiques d'usage** : table « sessions » dans Supabase (temps passé par compte), ou mesure d'audience sans
  cookie (GoatCounter, Umami) ; dans les deux cas, mettre à jour la page de confidentialité. En attendant, des
  requêtes SQL sur `auth.users`, `answers` et l'activité synchronisée donnent l'essentiel.
- ~~**Relais TMDB**~~ — fait le 11/11 (`worker/`, ARCHITECTURE § 3.4). Clé TMDB régénérée le même jour (l'ancienne était lisible dans le site).
  Recommandation (02/11) : **Cloudflare Worker** gratuit (100 000 requêtes/jour, pas de limite de trafic), clé en
  secret, n'accepte que les demandes du site, limite le débit par appareil, cache partagé des réponses identiques
  (pages du catalogue, fiches). Tous les appels passent par `tmdb()` (`src/lib/tmdb.ts`) : seule l'adresse change ;
  l'option « ta propre clé » reste en secours. Pas Supabase : son trafic sortant gratuit (5 Go/mois) serait vite
  épuisé (≈ 900 requêtes par téléchargement du catalogue). À faire par l'utilisateur : compte Cloudflare, et jeton
  d'API en secret GitHub pour un déploiement automatique. Plus tard, si l'appli grandit : **catalogue préparé
  chaque nuit par GitHub Actions** et publié sur GitHub Pages (un téléchargement au lieu de ≈ 900 requêtes ; un
  fichier par langue avec la traduction).
- **Viralité** : lien / QR code sur l'image du top 10, carte de compatibilité à partager, demande de note sur le
  store, « Mon année en films » en décembre, import Letterboxd / SensCritique / IMDb / TV Time. Plan complet pour
  faire connaître l'appli : [PROMOTION.md](PROMOTION.md).

## 5. Pistes plus lointaines

- **Pourboire** (idée gardée, mise de côté le 02/11/2026) : page **Ko-fi** (dons ponctuels sans compte, sans
  commission de la plateforme) et bouton discret en bas des Réglages, **masqué dans l'appli Android** (Google exige
  sa facturation pour les paiements dans une appli, sauf dons à des organismes caritatifs ; des applis ont été
  retirées pour un lien « Donate »). Plus tard, éventuellement, pourboires via Google Play (15 %). Avant :
  **demander à TMDB** si des dons restent compatibles avec la clé gratuite (usage non commercial ; dons non
  traités dans leurs conditions). Pourboires = revenus à déclarer (BNC).

- **Même appli pour la musique** : catalogue Last.fm (top artistes par pays et par style, artistes similaires),
  photos et extraits de 30 s Deezer ; Spotify à éviter (restrictions depuis 2024).
- **Même appli pour les jeux vidéo** : base IGDB (Twitch) — jaquettes, plateformes, séries, jeux similaires,
  « time to beat » ; clé secrète → catalogue préparé par GitHub Actions et fiches via un relais Supabase.
- Dans les deux cas, décider d'abord : appli séparée, ou un « Rank It All » avec plusieurs espaces et un
  cœur commun (comptes, synchro, duels, amis).

## 6. Risques et points d'attention

- **Pause du projet Supabase gratuit** après 7 jours sans activité (données gardées, réactivation manuelle) ;
  pas de sauvegarde dans l'offre gratuite : sauvegarde nocturne chiffrée par GitHub Actions (ARCHITECTURE § 4.3).
- **Mise à jour du catalogue** : les titres absents qui ne sont ni vus ni en wishlist sont supprimés, et ces suppressions se propagent à tous les appareils : garder les seuils
  synchronisés.
- **Téléphone pro** : le Play Store peut y être restreint, garder la PWA. (La clé TMDB n'est plus dans le site
  depuis le relais du 11/11.)
