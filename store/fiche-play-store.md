# Fiche Google Play — Rank It All

Tout ce qu'il faut recopier dans la Play Console (`io.github.daviddza.rankitall`). Langue par défaut : français
(France). Images : `captures/` (1080 × 1920, dans l'ordre), `banniere-1024x500.png`, icône
`../android/store_icon.png` (512 × 512).

## Fiche principale (*Croissance → Présence sur le Store → Fiche principale*)

**Nom de l'appli** (30 caractères max) : `Rank It All`

**Description courte** (80 max) :

```
Swipe, classe et compare tes films, séries et animes préférés avec tes amis.
```

**Description complète** (4 000 max) :

```
Rank It All t'aide à faire le tri dans tout ce que tu as vu — films, séries et animes — par petites sessions de quelques minutes.

🎬 SWIPE
Un titre à la fois, tiré parmi les plus connus : vu (bien ou bof), envie de le voir, ou pas envie. Ta liste se construit toute seule, sans rien taper.

🏆 CLASSE PAR DUELS
« Lequel préfères-tu ? » Deux titres, un choix : chaque titre trouve sa place en quelques duels. Déplace-les à la main si tu veux, et obtiens ta tier list S, A, B, C, D.

💖 WISHLIST
Garde ce que tu as envie de voir, priorise-le par duels et vois sur quelles plateformes de streaming c'est disponible — avec un filtre « dispo sur mes abonnements ».

🍿 CE SOIR, JE REGARDE QUOI ?
Un tirage au sort dans ta wishlist, selon tes envies du moment.

👫 ENTRE AMIS
Compare vos classements, trouvez quoi regarder ensemble grâce à votre wishlist commune, et échangez des conseils.

✨ ET AUSSI
Filtres (période, genre, langue, réalisateur, acteur, note), sagas dans l'ordre, recommandations d'après ce que tu as aimé, statistiques et badges, partage de ton top 10 en image.

🔒 GRATUIT, SANS PUB, OPEN SOURCE
Pas de publicité, pas de traceur. Sans compte, tout reste sur ton téléphone. Un compte (facultatif, e-mail ou Google) synchronise tes listes entre tes appareils.

Catalogue et affiches : TMDB. Disponibilités en streaming : JustWatch.
This product uses the TMDB API but is not endorsed or certified by TMDB.
```

**Images** : icône 512 × 512 (`android/store_icon.png`), bannière 1024 × 500 (`banniere-1024x500.png`),
captures téléphone : les 6 de `captures/` dans l'ordre (accueil, swipe, duel, classement, tier list, wishlist).

**Catégorie** : Divertissement. **Tags** : Films et séries, Listes.

**Coordonnées** : e-mail `rankitall.app@gmail.com` (aussi l'expéditeur des e-mails de l'appli), site web
`https://daviddza.github.io/rank-it-all/`.

**Règles de confidentialité** : `https://daviddza.github.io/rank-it-all/confidentialite.html`

## Contenu de l'appli (*Règles → Contenu de l'appli*)

| Rubrique | Réponse |
|---|---|
| Règles de confidentialité | l'adresse ci-dessus |
| Annonces | Non, l'appli ne contient pas d'annonces |
| Accès à l'appli | **Oui, une partie est limitée** (synchro, amis, « À deux » demandent un compte). Instruction : compte de démonstration par e-mail `rankitall.app+review@gmail.com` (mot de passe dans le gestionnaire de mots de passe, jamais dans le dépôt), ami de l'utilisateur ; texte en anglais : *The account is optional: every feature except sync and friends works without signing in. To sign in: Settings (gear icon) → Account → sign in with email and password (not Google). Friends: the "Together" page (À deux) shows the friend linked to this demo account. The app is in French.* |
| Classification du contenu | Questionnaire IARC (08/11/2026), e-mail `rankitall.app@gmail.com`, catégorie « Toutes les autres types d'applis ». **Package : rien** (coquille TWA). **Partage entre utilisateurs : oui** (pseudo, listes entre amis) — pas la source principale, rien de public, blocage oui (retirer l'ami, changer de code), signalement non, pas de conversation, limité aux amis invités. **Contenu en ligne : oui** (catalogue TMDB : affiches, résumés, bandes-annonces de films grand public, adultes exclus) → violence oui (jamais l'objet principal ; visuelle, sanglante possible, texte), sexualité oui (visuelle, nudité partielle possible, **jamais pornographique**, texte), langage oui, drogues oui. Produits assujettis à l'âge, position, achats, récompenses, navigateur, actualité / éducation : non. Le public cible étant 18 ans et plus, une classification 16-18 ne change rien. |
| Public cible | 18 ans et plus (évite les règles « Familles » ; l'appli n'est pas destinée aux enfants) |
| Appli d'actualité | Non |
| Applis gouvernementales, financières, santé | Non |
| Suppression de compte | Oui, dans l'appli. **Adresse web** : `https://daviddza.github.io/rank-it-all/confidentialite.html#suppression` (explique comment supprimer son compte depuis le site, sans l'appli) |

### Sécurité des données

- L'appli collecte-t-elle ou partage-t-elle des données ? **Oui** (seulement avec un compte).
- Chiffrées en transit ? **Oui** (HTTPS). Les utilisateurs peuvent-ils demander la suppression ? **Oui**.
- **Partage** avec des tiers : **aucun** (Supabase, Google et GitHub sont des prestataires qui traitent les
  données pour le compte de l'appli : ce n'est pas un « partage » au sens de Google).

| Type de données | Collectée | Facultative | Finalités |
|---|---|---|---|
| Informations personnelles → **Adresse e-mail** | Oui | Oui (compte facultatif) | Fonctionnement de l'appli, gestion du compte |
| Informations personnelles → **Nom** (pseudo) | Oui | Oui | Fonctionnement de l'appli (affiché aux amis), gestion du compte |
| Informations personnelles → **ID utilisateur** | Oui | Oui | Gestion du compte |
| Activité dans l'appli → **Interactions avec l'appli** (titres vus, wishlist, classements) | Oui | Oui | Fonctionnement de l'appli |

Non collectés : position, contacts, photos, fichiers, santé, finances, messages, identifiants de l'appareil,
journaux de plantage, diagnostics, historique de navigation. TMDB voit l'adresse IP du téléphone (téléchargement
des affiches), sans lien avec le compte : pas une collecte par l'appli.

## Tests et publication

1. *Tester et publier → Tests → Test interne* : créer une version, envoyer `rank-it-all.aab` (workflow
   *Appli Android*), accepter **Play App Signing**.
2. *Configuration → Intégrité de l'appli → Signature d'application* : copier l'**empreinte SHA-256 de la clé de
   signature d'application** → l'ajouter à `assetlinks.json` (dépôt `DavidDZA.github.io`, source
   `tools/racine-du-site/`). Sans elle, l'appli installée depuis le Play Store affiche une barre d'adresse.
3. *Test fermé* : liste de testeurs (adresses des comptes Google), au moins **12 testeurs inscrits pendant
   14 jours d'affilée** ; puis demander l'accès à la production.
4. Chaque nouvelle version Android (rare : le contenu est le site) : `appVersionCode` + 1 dans
   `android/twa-manifest.json`, `npm run generate`, workflow, envoi du nouvel `.aab`.

⚠️ Les captures montrent des affiches de films (images TMDB, utilisées avec attribution, comme les autres
applis de listes de films). Si Google les refusait un jour, refaire des captures sans affiches reconnaissables.
