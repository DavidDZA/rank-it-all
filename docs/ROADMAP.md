# Feuille de route — ce qui reste à faire

> État au 30/10/2026. Comment l'appli marche aujourd'hui : [ARCHITECTURE.md](ARCHITECTURE.md).
> Fait : comptes et synchro, amis et « À deux », catégorie Animes, seuils français / vieux films, classement à
> la main, refonte (fiches à part, chargement découpé, types Supabase, tests de bout en bout).

## 1. Décisions en attente

| # | Question | Recommandation |
|---|---|---|
| D7 | **Licence open source** du dépôt (fichier `LICENSE`) | MIT (simple, permissive) ; GPL-3.0 si les dérivés doivent rester open source |
| — | Contact sur la page de confidentialité : une adresse e-mail plutôt que les tickets GitHub (publics) ? | À choisir |

## 2. Appli Android

Décidé le 01/11/2026 : **TWA** sans nom de domaine (le site en plein écran ; vérification par le dépôt
`DavidDZA.github.io`), package **`io.github.daviddza.rankitall`**, nom **Rank It All**. Fonctionnement :
ARCHITECTURE § 2.1. Capacitor écarté : données séparées du site, connexion Google à refaire (Google la refuse
dans une page web intégrée), liens qui n'ouvrent pas l'appli. Il resservira peut-être pour iOS.

Reste à faire :

1. Dépôt `DavidDZA.github.io` (contenu : `tools/racine-du-site/`) et secrets `ANDROID_KEYSTORE_*`.
2. Compte Play Console, création de l'appli, premier `.aab` en test interne ; ajouter ensuite l'empreinte de la
   clé de signature Google Play dans `assetlinks.json`.
3. Test fermé (12 testeurs, 14 jours), puis production (§ 3).

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
licence libre (§ 1), une compilation reproductible sans dépendance propriétaire (Capacitor et le client Supabase
sont open source ; pas de Google Play Services), et une demande d'inclusion (merge request sur
`gitlab.com/fdroid/fdroiddata`). L'appli serait marquée « NonFreeNet » car elle dépend de services en ligne non
libres (TMDB, Supabase) — c'est autorisé. Utile aussi si le Play Store est bloqué sur un téléphone donné.

**Effort : faible en code, mais 3 à 4 semaines de délais** (vérification, test fermé, examen).

---

## 4. Petites améliorations proposées (non lancées)

- **Code ami** : nouvel essai automatique si le code tiré existe déjà (risque infime aujourd'hui : l'inscription
  échouerait) — quelques lignes dans `schema.sql`.
- **Pseudo** : le demander à la première connexion Google (aujourd'hui : le nom du compte Google, modifiable).
- **Rappel d'export** mensuel même avec un compte (en plus de la sauvegarde nocturne de la base, voir ARCHITECTURE § 4.3).
- **Statistiques d'usage** : table « sessions » dans Supabase (temps passé par compte), ou mesure d'audience sans
  cookie (GoatCounter, Umami) ; dans les deux cas, mettre à jour la page de confidentialité. En attendant, des
  requêtes SQL sur `auth.users`, `answers` et l'activité synchronisée donnent l'essentiel.
- **Relais TMDB** (fonction Supabase) pour ne plus exposer la clé dans le site — indispensable avant une appli
  publique.
- **Viralité** : lien / QR code sur l'image du top 10, carte de compatibilité à partager, demande de note sur le
  store.

## 5. Pistes plus lointaines

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
- **Clé TMDB** lisible dans le site (§ 4) ; **téléphone pro** : le Play Store peut y être restreint, garder la PWA.
