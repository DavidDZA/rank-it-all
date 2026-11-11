# Faire connaître Rank It All — plan à petit budget

> Idées notées le 11/11/2026, à mettre en œuvre une fois l'appli en production sur le Play Store. Budget visé :
> **0 €**, du temps plutôt que de l'argent. Le reste à faire est dans [ROADMAP.md](ROADMAP.md).

## Ce qui rend l'appli facile à montrer

- **Les duels et la tier list** : « lequel tu préfères ? », puis un classement S à D. Le format tier list est
  très populaire en vidéo courte.
- **« À deux »** : il faut un ami pour en profiter, donc chaque utilisateur a une raison d'en inviter un autre.
- **Gratuite, sans pub, open source** : un argument rare, qui ouvre les portes des communautés du logiciel libre.

## Les trois leviers prioritaires

1. **Vidéos courtes** (TikTok, Instagram Reels, YouTube Shorts) : enregistrement d'écran avec voix ou texte, 20 à
   40 s. C'est le canal gratuit qui peut toucher le plus de monde. Voir « Vidéos » plus bas.
2. **Partages intégrés à l'appli** : chaque image partagée porte le nom de l'appli et un lien. À développer avant
   le lancement (voir « Dans l'appli »).
3. **Import depuis Letterboxd, SensCritique, IMDb ou TV Time** : la première barrière pour un cinéphile, c'est de
   ressaisir tout ce qu'il a déjà noté ailleurs. Un import le fait arriver avec ses titres vus en une minute.
   À vérifier pour chaque site : format d'export (CSV en général) et conditions d'utilisation.

## Avant le lancement (pendant le test fermé)

### Fiche du Play Store (référencement dans le Store)

- **Nom** : ajouter un descriptif, dans la limite de 30 caractères, par exemple `Rank It All : films et séries`.
  Google interdit l'accumulation de mots-clés, mais un descriptif court est accepté.
- **Description courte** : y placer les mots que les gens tapent (« classement », « films », « séries »,
  « animes », « que regarder ce soir »).
- **Captures** : une phrase en grand sur chaque capture (« Classe tes films par duels », « Trouve quoi regarder
  ce soir »…). C'est ce qu'on lit en faisant défiler le Store.
- **Traduction** (prévue dans la roadmap) : chaque langue ajoutée rend l'appli visible dans un nouveau Store.

### Dans l'appli

- **Image du top 10** : y ajouter le lien et un QR code vers l'appli (déjà noté dans la roadmap, « Viralité »).
- **Carte de compatibilité à partager** : « Nous sommes compatibles à 78 % sur les films ». Elle donne envie à
  celui qui la reçoit de faire le test.
- **« Mon année en films »** (sur le modèle de Spotify Wrapped) : à publier en décembre. Titres vus dans l'année,
  top 5, genres, nombre d'heures, en une image à partager. L'activité est déjà datée dans l'appli. C'est le
  moment de l'année où ce genre d'image circule le plus.
- **Demande d'avis sur le Store** : un message discret après un moment positif (par exemple le 50ᵉ duel), avec
  un lien vers la fiche. La fenêtre d'avis intégrée de Google demanderait du code Android natif, absent d'une TWA.
- **Badge « Disponible sur Google Play »** sur le site, pour ceux qui le découvrent dans un navigateur.

### Matériel à préparer

- 5 à 10 vidéos courtes d'avance, pour ne pas partir de zéro le jour du lancement.
- Un **dossier de presse** d'une page : ce que fait l'appli, 3 captures, le lien, qui l'a faite, pourquoi.
- Une **liste de contacts** : médias, communautés, créateurs (voir plus bas), avec leurs règles de publication.

## Semaine de lancement

1. **Testeurs, proches** : leur demander une note et un avis sur le Play Store dès la sortie publique. Les
   premiers avis comptent beaucoup pour le classement dans le Store.
2. **Communautés** (en lisant d'abord les règles de chacune : beaucoup interdisent l'autopromotion ou la
   limitent à un jour par semaine) :
   - Reddit en français : r/france (fil des projets perso), r/cinema, r/animefr ;
   - Reddit en anglais, après la traduction : r/androidapps, r/SideProject, r/movies (souvent interdit),
     r/Letterboxd, r/anime (règles strictes) ;
   - serveurs Discord de cinéma et d'anime (demander aux modérateurs avant de poster).
3. **Logiciel libre** : LinuxFr.org (une dépêche ou un journal sur le projet), Journal du hacker, et plus tard
   « Show HN » sur Hacker News (en anglais). L'angle qui intéresse : appli gratuite et libre, TWA, Supabase,
   coût d'hébergement nul.
4. **Annuaires d'applis** : AlternativeTo (fiche « alternative à Letterboxd, TV Time, Trakt, SensCritique »), et
   F-Droid (déjà envisagé dans la roadmap, § 3.2).
5. **Presse tech française** : un e-mail court avec le dossier de presse à Frandroid, Phonandroid, Presse-citron,
   Numerama, Korben (sensible au libre). Les rubriques du type « appli de la semaine » sont faites pour ça.

## Ensuite, en continu

### Vidéos

- Rythme réaliste : 2 à 3 par semaine, plutôt que beaucoup d'un coup puis plus rien.
- Formats qui marchent pour ce genre d'appli :
  - « Je classe les 20 films Marvel par duels » ;
  - « Tier list des animes de la saison » ;
  - « On a testé notre compatibilité cinéma en couple » ;
  - « Je laisse l'appli choisir mon film ce soir ».
- Se caler sur l'actualité : sorties au cinéma, nouvelles saisons Netflix, Oscars (mars), Césars (février), fin
  d'année.
- Toujours finir par le nom de l'appli et « gratuite, sans pub ».

### Créateurs

- Contacter des **petits créateurs** cinéma et anime (5 000 à 50 000 abonnés) : ils répondent plus souvent que
  les gros, et leur public est plus engagé. Proposer simplement d'essayer l'appli, ou de faire une tier list en
  vidéo avec elle. Sans budget, pas de contrepartie à offrir : rester bref et sincère.

### Suivi

- **Play Console**, rapports d'acquisition : d'où viennent les installations. Ajouter un repère `utm_source` aux
  liens du Store pour distinguer les canaux (Reddit, vidéos, presse…).
- **Supabase** : nombre de comptes créés et actifs (requêtes SQL ; voir « Statistiques d'usage » dans la roadmap).
- Répondre à **tous les avis** du Store, surtout les mauvais : Google et les futurs utilisateurs le voient.

## Si un jour un petit budget

- Campagnes « Application » de Google Ads : quelques euros par jour, avec un ciblage automatique. À tester
  seulement quand la fiche et les avis sont bons, sinon l'argent est gaspillé.
- Avant tout, un nom de domaine (une dizaine d'euros par an) : une adresse plus mémorisable que
  `daviddza.github.io/rank-it-all`, et des e-mails qui ne finissent plus en indésirables.

## Points d'attention

- **TMDB** : la clé gratuite est réservée à un usage non commercial. Pas de publicité payante qui mettrait en
  avant TMDB, et toujours la mention « This product uses the TMDB API but is not endorsed or certified by TMDB ».
- **Affiches** : elles appartiennent aux studios. Les montrer dans l'appli et dans les captures du Store est
  courant, mais il vaut mieux éviter d'en faire le cœur d'une publicité payante.
- **Pas de spam** : un message par communauté, en tant que créateur qui demande un avis, plutôt qu'une annonce
  copiée-collée partout.
- **Données personnelles** : une liste d'e-mails (newsletter) imposerait un consentement et une mise à jour de la
  page de confidentialité. Inutile au début.
