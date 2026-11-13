import { useState } from 'react';
import { getSwipeMode, setSwipeMode, type SwipeMode } from '../../lib/settings';
import { T } from '../../i18n';

/** Choix du mode de swipe, avec un petit schéma de chaque geste. */
export function SwipeModeSetting() {
  const [mode, setMode] = useState<SwipeMode>(getSwipeMode());
  const choose = (m: SwipeMode) => {
    setMode(m);
    setSwipeMode(m);
  };
  return (
    <section className="card">
      <h3>{T.swipeMode.title}</h3>
      <div className="mode-options">
        <button className={`mode-option ${mode === 'corners' ? 'active' : ''}`} onClick={() => choose('corners')} title={T.swipeMode.cornersTip}>
          <span className="mode-name">
            {T.swipeMode.corners} <span className="muted tiny">{T.swipeMode.default}</span>
          </span>
          <span className="mode-diagram four">
            <span className="tone-wish">{T.tutorial.corners.wish}</span>
            <span className="tone-yes">{T.tutorial.corners.good}</span>
            <span className="tone-no">{T.tutorial.corners.no}</span>
            <span className="tone-meh">{T.tutorial.corners.meh}</span>
          </span>
          <span className="muted tiny">{T.swipeMode.cornersSub}</span>
        </button>
        <button className={`mode-option ${mode === 'horizontal' ? 'active' : ''}`} onClick={() => choose('horizontal')} title={T.swipeMode.twoTip}>
          <span className="mode-name">{T.swipeMode.two}</span>
          <span className="mode-diagram two">
            <span className="tone-no">{T.swipeMode.left}</span>
            <span className="tone-yes">{T.swipeMode.right}</span>
          </span>
          <span className="muted tiny">{T.swipeMode.twoSub}</span>
        </button>
      </div>
    </section>
  );
}
