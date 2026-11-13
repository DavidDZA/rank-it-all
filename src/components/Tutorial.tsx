import { useState, type ReactNode } from 'react';
import { markTutorialSeen, tutorialSeen, type TutorialId } from '../lib/tutorial';
import { Sheet } from './common';

/** Contenu des astuces : l'essentiel de chaque écran, pas ce qui se voit déjà. */
const CONTENT: Record<TutorialId, { title: string; body: ReactNode }> = {
  home: {
    title: '👋 Bienvenue !',
    body: (
      <ol>
        <li>
          <b>Swipe</b> les films, séries et animes : vu, pas vu, envie de le voir.
        </li>
        <li>
          <b>Classe</b> ceux que tu as vus par duels : « lequel tu préfères ? ».
        </li>
        <li>
          Ta <b>wishlist</b> se remplit au passage. « Ce soir, je regarde quoi ? » y tire un titre au sort.
        </li>
      </ol>
    ),
  },
  'swipe-corners': {
    title: '🕹️ Swipe vers un coin',
    body: (
      <>
        <div className="tuto-corners" aria-hidden>
          <span className="tone-wish">↖ Envie</span>
          <span className="tuto-card">🎬</span>
          <span className="tone-yes">Vu 👍 ↗</span>
          <span className="tone-no">↙ Pas envie</span>
          <span className="tone-meh">Vu 😐 ↘</span>
        </div>
        <ul>
          <li>
            Glisse la carte <b>en diagonale</b> : à droite ce que tu as vu, à gauche ce que tu n’as pas vu ; en haut le positif.
          </li>
          <li>
            <b>👍 / 😐</b> pré-classe tes titres vus : moins de duels ensuite. Un 👍 fait aussi remonter des titres proches.
          </li>
          <li>Touche l’affiche pour sa fiche complète (résumé, bande-annonce, où regarder). Pas sûr ? « Passer » : il reviendra plus tard.</li>
          <li>Les films d’une saga s’enchaînent dans l’ordre ; « 💤 Pas envie de la saga » les écarte tous d’un coup.</li>
          <li>L’entonnoir filtre par genre, époque, note, ou par acteur et réalisateur.</li>
        </ul>
        <p className="muted small">Préfère deux gestes simples (vu / pas vu) ? Réglages → Mode de swipe.</p>
      </>
    ),
  },
  'swipe-horizontal': {
    title: '🕹️ Swipe',
    body: (
      <ul>
        <li>
          <b>→ Vu</b>, <b>← Pas vu</b>. Puis une deuxième question : aimé ou bof si tu l’as vu, envie ou pas sinon.
        </li>
        <li>Touche l’affiche pour sa fiche complète (résumé, bande-annonce, où regarder). Pas sûr ? « Passer » : il reviendra plus tard.</li>
        <li>Les films d’une saga s’enchaînent dans l’ordre ; « 💤 Pas envie de la saga » les écarte tous d’un coup.</li>
        <li>L’entonnoir filtre par genre, époque, note, ou par acteur et réalisateur.</li>
      </ul>
    ),
  },
  rank: {
    title: '🏆 Classer par duels',
    body: (
      <ul>
        <li>Choisis ton préféré entre deux titres : chacun trouve sa place en quelques duels, même avec des centaines de titres.</li>
        <li>
          <b>ℹ</b> sur une affiche : sa fiche complète (résumé, bande-annonce…).
        </li>
        <li>
          <b>Égalité</b> si tu ne sais pas départager, <b>Passer</b> pour le garder pour plus tard.
        </li>
        <li>
          Dans <b>Mon classement</b>, déplace un titre avec la poignée ⠿, ou touche son numéro pour lui donner une place.
        </li>
      </ul>
    ),
  },
  wishlist: {
    title: '💖 Ta wishlist',
    body: (
      <ul>
        <li>
          <b>Prioriser</b> : des duels pour mettre en tête ce que tu veux voir en premier.
        </li>
        <li>Tes priorités servent au tirage « Ce soir, je regarde quoi ? » et à la wishlist commune avec tes amis.</li>
      </ul>
    ),
  },
  tonight: {
    title: '🍿 Ce soir',
    body: (
      <ul>
        <li>Un titre tiré au sort dans ta wishlist : ceux que tu as priorisés ont plus de chances de sortir.</li>
        <li>Les filtres (durée, abonnements) se règlent avant le tirage.</li>
      </ul>
    ),
  },
  lists: {
    title: '📚 Mes listes',
    body: (
      <ul>
        <li>Tout ce que tu as trié, pour corriger une erreur : un titre peut être remis en wishlist, ou reproposé au swipe.</li>
      </ul>
    ),
  },
  add: {
    title: '🔍 Ajout manuel',
    body: (
      <ul>
        <li>Pour un titre absent du catalogue (peu connu, très récent…).</li>
        <li>Cherche aussi une personne (acteur, réalisateur) : sa filmographie s’affiche.</li>
      </ul>
    ),
  },
  friends: {
    title: '👥 Amis',
    body: (
      <ul>
        <li>Envoie ton lien d’invitation : en l’ouvrant, ton ami t’ajoute.</li>
        <li>Tu choisis ce que tes amis voient (wishlist, classement). Tes « pas envie » restent privés.</li>
      </ul>
    ),
  },
  duo: {
    title: '👥 À deux',
    body: (
      <ul>
        <li>
          <b>En commun</b> : ce que vous voulez voir tous les deux. <b>Ce soir</b> y tire un titre au sort.
        </li>
        <li>
          <b>Conseils</b> : ce que l’autre a aimé et que tu n’as pas vu. <b>Compatibilité</b> : vos classements se ressemblent-ils ?
        </li>
      </ul>
    ),
  },
};

/** Astuce de l'écran, affichée à la première visite seulement. */
export function Tutorial({ id }: { id: TutorialId }) {
  const [open, setOpen] = useState(() => !tutorialSeen(id));
  if (!open) return null;
  const close = () => {
    markTutorialSeen(id);
    setOpen(false);
  };
  const { title, body } = CONTENT[id];
  return (
    <Sheet onClose={close} label={title}>
      <div className="tutorial">
        <h2 className="sheet-title">{title}</h2>
        {body}
        <button className="btn primary" onClick={close}>
          Compris
        </button>
      </div>
    </Sheet>
  );
}
