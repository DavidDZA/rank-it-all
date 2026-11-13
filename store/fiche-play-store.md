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

**Catégorie** : Divertissement. **Tags** (liste imposée par Google) : Films, Télévision, Divertissement. Écartés : « Billets de cinéma, critiques… » (ni billets, ni séances, ni critiques), « Programme télé », « Streaming vidéo » (on ne regarde rien dans l'appli). Téléphone : vide (public). Marketing externe : activé.

**Coordonnées** : e-mail `rankitall.app@gmail.com` (aussi l'expéditeur des e-mails de l'appli), site web
`https://daviddza.github.io/rank-it-all/`.

**Règles de confidentialité** : `https://daviddza.github.io/rank-it-all/confidentialite.html`

## Fiches dans les autres langues (*Fiche principale → Gérer les traductions → Ajouter vos propres traductions*)

L'appli est traduite en anglais, espagnol, allemand, italien et portugais (Brésil) : elle s'affiche dans la langue du
téléphone. Ajouter ces 5 langues dans la Play Console (*Gérer les traductions → Ajouter vos propres traductions* :
`en-US`, `es-ES`, `de-DE`, `it-IT`, `pt-BR`), puis coller pour chacune le nom, la description courte et la description
complète ci-dessous, et remplacer les **captures téléphone** par celles de la langue : `captures/<langue>/` (`en`, `es`,
`de`, `it`, `pt`), les 6 dans l'ordre (accueil, swipe, duel, classement, tier list, wishlist), et la **bannière**
(« image de présentation », 1024 × 500 : la grande image en haut de la fiche et dans les mises en avant de Google Play)
par `bannieres/banniere-<langue>.png`. L'icône reste la même. Aucune nouvelle version de l'appli n'est nécessaire.

Les captures se refont (après un changement visible de l'appli) avec `node tools/captures-store/captures.mjs`
(`… fr` pour le français, `… en de` pour quelques langues) : le site construit avec le relais TMDB, un téléphone
réglé sur chaque langue et son pays, le vrai catalogue (affiches et titres de la langue), un profil de démonstration,
puis les 6 écrans en 1080 × 1920, et enfin les bannières. Il faut le réseau ; quelques minutes en tout. Les bannières
seules (texte changé, sans réseau) : `node tools/captures-store/banniere.mjs` (slogans dans `BANNER_TEXT`).

La page de confidentialité est la même adresse pour toutes les langues : elle s'affiche dans la langue du navigateur.

### Anglais (en-US)

**Nom** : `Rank It All`

**Description courte** :

```
Swipe, rank and compare your favorite movies, TV shows and anime with friends.
```

**Description complète** :

```
Rank It All helps you sort out everything you've watched — movies, TV shows and anime — in short sessions of a few minutes.

🎬 SWIPE
One title at a time, picked among the best known: seen (liked it or meh), want to watch, or not interested. Your list builds itself, no typing needed.

🏆 RANK WITH DUELS
"Which one do you prefer?" Two titles, one choice: each title finds its place in a few duels. Move them by hand if you like, and get your S, A, B, C, D tier list.

💖 WISHLIST
Keep what you want to watch, prioritize it with duels and see which streaming platforms have it — with an "on my subscriptions" filter.

🍿 WHAT SHOULD I WATCH TONIGHT?
A random pick from your wishlist, based on your mood.

👫 WITH FRIENDS
Compare your rankings, find something to watch together with your shared wishlist, and swap recommendations.

✨ AND ALSO
Filters (period, genre, language, director, actor, rating), sagas in order, recommendations based on what you liked, stats and badges, share your top 10 as an image.

🔒 FREE, NO ADS, OPEN SOURCE
No ads, no trackers. Without an account, everything stays on your phone. An account (optional, email or Google) syncs your lists across your devices.

Catalog and posters: TMDB. Streaming availability: JustWatch.
This product uses the TMDB API but is not endorsed or certified by TMDB.
```

### Espagnol (es-ES)

**Nom** : `Rank It All`

**Description courte** :

```
Desliza, clasifica y compara tus películas, series y animes con tus amigos.
```

**Description complète** :

```
Rank It All te ayuda a ordenar todo lo que has visto — películas, series y animes — en sesiones cortas de unos minutos.

🎬 DESLIZA
Un título cada vez, elegido entre los más conocidos: visto (te gustó o regular), quiero verlo o no me interesa. Tu lista se crea sola, sin escribir nada.

🏆 CLASIFICA CON DUELOS
«¿Cuál prefieres?» Dos títulos, una elección: cada título encuentra su sitio en pocos duelos. Muévelos a mano si quieres y consigue tu tier list S, A, B, C, D.

💖 WISHLIST
Guarda lo que quieres ver, priorízalo con duelos y mira en qué plataformas de streaming está disponible, con un filtro «en mis suscripciones».

🍿 ¿QUÉ VEO ESTA NOCHE?
Un sorteo en tu wishlist, según lo que te apetezca.

👫 CON AMIGOS
Comparad vuestras clasificaciones, encontrad qué ver juntos gracias a vuestra wishlist común e intercambiad recomendaciones.

✨ Y ADEMÁS
Filtros (época, género, idioma, director, actor, nota), sagas en orden, recomendaciones según lo que te gustó, estadísticas e insignias, comparte tu top 10 en una imagen.

🔒 GRATIS, SIN ANUNCIOS, CÓDIGO ABIERTO
Sin anuncios ni rastreadores. Sin cuenta, todo se queda en tu móvil. Una cuenta (opcional, correo o Google) sincroniza tus listas entre tus dispositivos.

Catálogo y pósteres: TMDB. Disponibilidad en streaming: JustWatch.
This product uses the TMDB API but is not endorsed or certified by TMDB.
```

### Allemand (de-DE)

**Nom** : `Rank It All`

**Description courte** :

```
Swipe, ranke und vergleiche deine Filme, Serien und Animes mit Freunden.
```

**Description complète** :

```
Rank It All hilft dir, alles zu sortieren, was du gesehen hast — Filme, Serien und Animes — in kurzen Sessions von ein paar Minuten.

🎬 SWIPEN
Ein Titel nach dem anderen, ausgewählt unter den bekanntesten: gesehen (gut oder naja), will ich sehen oder kein Interesse. Deine Liste entsteht von selbst, ganz ohne Tippen.

🏆 RANKEN MIT DUELLEN
„Welchen findest du besser?“ Zwei Titel, eine Wahl: Jeder Titel findet in wenigen Duellen seinen Platz. Verschieb sie von Hand, wenn du willst, und hol dir deine Tier-List S, A, B, C, D.

💖 WISHLIST
Merk dir, was du sehen willst, priorisiere es mit Duellen und sieh, auf welchen Streaming-Plattformen es läuft — mit dem Filter „in meinen Abos“.

🍿 WAS SCHAUE ICH HEUTE ABEND?
Eine Auslosung aus deiner Wishlist, je nach Lust und Laune.

👫 MIT FREUNDEN
Vergleicht eure Rankings, findet mit eurer gemeinsamen Wishlist etwas für einen gemeinsamen Abend und tauscht Tipps aus.

✨ UND AUSSERDEM
Filter (Zeitraum, Genre, Sprache, Regie, Schauspieler, Bewertung), Filmreihen in der richtigen Reihenfolge, Empfehlungen nach deinem Geschmack, Statistiken und Abzeichen, deine Top 10 als Bild teilen.

🔒 KOSTENLOS, OHNE WERBUNG, OPEN SOURCE
Keine Werbung, keine Tracker. Ohne Konto bleibt alles auf deinem Handy. Ein Konto (optional, E-Mail oder Google) synchronisiert deine Listen zwischen deinen Geräten.

Katalog und Poster: TMDB. Streaming-Verfügbarkeit: JustWatch.
This product uses the TMDB API but is not endorsed or certified by TMDB.
```

### Italien (it-IT)

**Nom** : `Rank It All`

**Description courte** :

```
Swipa, classifica e confronta film, serie e anime preferiti con gli amici.
```

**Description complète** :

```
Rank It All ti aiuta a mettere in ordine tutto ciò che hai visto — film, serie e anime — in brevi sessioni di pochi minuti.

🎬 SWIPE
Un titolo alla volta, scelto tra i più conosciuti: visto (bello o così così), voglio vederlo o non mi interessa. La tua lista si crea da sola, senza scrivere niente.

🏆 CLASSIFICA CON I DUELLI
«Quale preferisci?» Due titoli, una scelta: ogni titolo trova il suo posto in pochi duelli. Spostali a mano se vuoi, e ottieni la tua tier list S, A, B, C, D.

💖 WISHLIST
Tieni ciò che vuoi vedere, dagli priorità con i duelli e scopri su quali piattaforme di streaming è disponibile, con il filtro «sui miei abbonamenti».

🍿 COSA GUARDO STASERA?
Un’estrazione a caso dalla tua wishlist, secondo l’umore del momento.

👫 CON GLI AMICI
Confrontate le vostre classifiche, trovate cosa guardare insieme grazie alla wishlist in comune e scambiatevi consigli.

✨ E INOLTRE
Filtri (epoca, genere, lingua, regista, attore, voto), saghe in ordine, consigli in base a ciò che ti è piaciuto, statistiche e badge, condivisione della tua top 10 in un’immagine.

🔒 GRATIS, SENZA PUBBLICITÀ, OPEN SOURCE
Niente pubblicità, niente tracker. Senza account, tutto resta sul tuo telefono. Un account (facoltativo, email o Google) sincronizza le tue liste tra i tuoi dispositivi.

Catalogo e locandine: TMDB. Disponibilità in streaming: JustWatch.
This product uses the TMDB API but is not endorsed or certified by TMDB.
```

### Portugais du Brésil (pt-BR)

**Nom** : `Rank It All`

**Description courte** :

```
Deslize, classifique e compare filmes, séries e animes favoritos com amigos.
```

**Description complète** :

```
O Rank It All ajuda você a organizar tudo o que já assistiu — filmes, séries e animes — em sessões curtas de poucos minutos.

🎬 DESLIZE
Um título por vez, escolhido entre os mais conhecidos: vi (gostei ou mais ou menos), quero ver ou sem interesse. Sua lista se monta sozinha, sem digitar nada.

🏆 CLASSIFIQUE COM DUELOS
“Qual você prefere?” Dois títulos, uma escolha: cada título encontra seu lugar em poucos duelos. Mova-os à mão se quiser e tenha sua tier list S, A, B, C, D.

💖 WISHLIST
Guarde o que você quer ver, priorize com duelos e veja em quais plataformas de streaming está disponível, com o filtro “nas minhas assinaturas”.

🍿 O QUE EU ASSISTO HOJE?
Um sorteio na sua wishlist, de acordo com o seu humor.

👫 COM AMIGOS
Comparem seus rankings, encontrem o que assistir juntos com a wishlist em comum e troquem dicas.

✨ E MAIS
Filtros (época, gênero, idioma, diretor, ator, nota), sagas em ordem, recomendações com base no que você curtiu, estatísticas e medalhas, compartilhe seu top 10 em uma imagem.

🔒 GRÁTIS, SEM ANÚNCIOS, CÓDIGO ABERTO
Sem anúncios, sem rastreadores. Sem conta, tudo fica no seu celular. Uma conta (opcional, e-mail ou Google) sincroniza suas listas entre seus aparelhos.

Catálogo e pôsteres: TMDB. Disponibilidade em streaming: JustWatch.
This product uses the TMDB API but is not endorsed or certified by TMDB.
```

### Notes de version (toutes langues, pour la prochaine version du test fermé ou de la production)

```
<en-US>
Now available in English, Spanish, German, Italian and Portuguese.
</en-US>
<es-ES>
Ya disponible en inglés, español, alemán, italiano y portugués.
</es-ES>
<de-DE>
Jetzt auf Englisch, Spanisch, Deutsch, Italienisch und Portugiesisch verfügbar.
</de-DE>
<it-IT>
Ora disponibile in inglese, spagnolo, tedesco, italiano e portoghese.
</it-IT>
<pt-BR>
Agora disponível em inglês, espanhol, alemão, italiano e português.
</pt-BR>
<fr-FR>
L’appli existe maintenant en anglais, espagnol, allemand, italien et portugais.
</fr-FR>
```

## Contenu de l'appli (*Règles → Contenu de l'appli*)

| Rubrique | Réponse |
|---|---|
| Règles de confidentialité | l'adresse ci-dessus |
| Annonces | Non, l'appli ne contient pas d'annonces |
| Identifiant publicitaire | **Non** (10/11/2026) : seule dépendance `androidbrowserhelper`, pas de permission `AD_ID` dans le manifeste, pas de SDK de pub ni de statistiques |
| Accès à l'appli | **Oui, une partie est limitée** (synchro, amis, « À deux » demandent un compte). Instruction : compte de démonstration par e-mail `rankitall.app+review@gmail.com` (mot de passe dans le gestionnaire de mots de passe, jamais dans le dépôt), ami de l'utilisateur ; texte en anglais : *The account is optional: every feature except sync and friends works without signing in. To sign in: Settings (gear icon) → Account → sign in with email and password (not Google). Friends: the "Together" page (À deux) shows the friend linked to this demo account. The app is in French.* |
| Classification du contenu | Questionnaire IARC (08/11/2026), e-mail `rankitall.app@gmail.com`, catégorie « Toutes les autres types d'applis ». **Package : rien** (coquille TWA). **Partage entre utilisateurs : oui** (pseudo, listes entre amis) — pas la source principale, rien de public, blocage oui (retirer l'ami, changer de code), signalement non, pas de conversation, limité aux amis invités. **Contenu en ligne : oui** (catalogue TMDB : affiches, résumés, bandes-annonces de films grand public, adultes exclus) → violence oui (jamais l'objet principal ; visuelle, sanglante possible, texte), sexualité oui (visuelle, nudité partielle possible, **jamais pornographique**, texte), langage oui, drogues oui. Produits assujettis à l'âge, position, achats, récompenses, navigateur, actualité / éducation : non. Le public cible étant 18 ans et plus, une classification 16-18 ne change rien. |
| Public cible | 18 ans et plus (évite les règles « Familles » ; l'appli n'est pas destinée aux enfants) |
| Appli d'actualité | Non |
| Applis gouvernementales, financières, santé | Non |
| Suppression de compte | Oui, dans l'appli. **Adresse web** : `https://daviddza.github.io/rank-it-all/confidentialite.html#suppression` (explique comment supprimer son compte depuis le site, sans l'appli) ; **suppression partielle des données** : oui, `https://daviddza.github.io/rank-it-all/confidentialite.html#suppression-partielle` |

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
3. *Test fermé* : testeurs = groupe Google **`rank-it-all--testeurs@googlegroups.com`** (propriétaire
   `rankitall.app`, inscription libre, membres visibles des seuls gestionnaires). Au moins **12 testeurs inscrits
   pendant 14 jours d'affilée** ; puis demander l'accès à la production. Liens à envoyer, dans l'ordre :
   groupe `https://groups.google.com/g/rank-it-all--testeurs`, inscription au test
   `https://play.google.com/apps/testing/io.github.daviddza.rankitall`, puis l'appli
   `https://play.google.com/store/apps/details?id=io.github.daviddza.rankitall` (même compte Google partout).
4. Chaque nouvelle version Android (rare : le contenu est le site) : `appVersionCode` + 1 dans
   `android/twa-manifest.json`, `npm run generate`, workflow, envoi du nouvel `.aab`.

⚠️ Les captures montrent des affiches de films (images TMDB, utilisées avec attribution, comme les autres
applis de listes de films). Si Google les refusait un jour, refaire des captures sans affiches reconnaissables.

## Message aux testeurs

À envoyer **après la validation** de la version du test fermé (avant, les liens 2 et 3 affichent une erreur ; le
lien 1 marche déjà). Notes de version du test fermé :

```
<fr-FR>
Première version de test. Merci de garder l'appli installée et de l'ouvrir de temps en temps pendant 14 jours !
</fr-FR>
```

Message :

```
Salut ! 👋

J'ai créé une appli, Rank It All, pour trier et classer les films, séries et animes qu'on a vus : on swipe (vu / pas vu / envie), puis on classe par duels (« lequel tu préfères ? »). Gratuite, sans pub.

Pour la publier sur le Play Store, Google m'oblige à la faire tester par au moins 12 personnes pendant 14 jours. Tu veux bien m'aider ? Ça prend 2 minutes, depuis ton téléphone Android :

1️⃣ Rejoins le groupe des testeurs (si ce n'est pas déjà fait) : https://groups.google.com/g/rank-it-all--testeurs (bouton « Rejoindre le groupe »)
2️⃣ Accepte le test : https://play.google.com/apps/testing/io.github.daviddza.rankitall (bouton « Devenir testeur »)
3️⃣ Installe l'appli : https://play.google.com/store/apps/details?id=io.github.daviddza.rankitall (si elle est « introuvable », réessaie dans quelques minutes)

⚠️ Utilise le même compte Google que celui de ton Play Store pour les 3 étapes.

Ensuite, garde l'appli installée au moins 14 jours et ouvre-la de temps en temps. Pas besoin de créer de compte dans l'appli. Si tu vois un bug ou si tu as une idée, dis-le-moi !

Merci 🙏
```
