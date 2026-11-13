import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import type { Title } from '../lib/db';
import type { Category } from '../lib/category';
import { readRanking } from '../lib/ranking';
import { tierize } from '../lib/tiers';
import { shareTierList } from '../lib/share';
import { toast } from '../lib/fun';
import { titlesOf, useLongPress, useTitleMap } from '../lib/hooks';
import { Poster } from './common';
import { openFiche } from './Fiche';
import { T } from '../i18n';

/** Classement en paliers S → D, d'après la position de chaque titre. */
export function TierList({ category, filter = null, filterLabel }: { category: Category; filter?: ((t: Title) => boolean) | null; filterLabel?: string }) {
  const [sharing, setSharing] = useState(false);
  const keys = useLiveQuery(() => readRanking({ category: category, list: 'seen' }), [category]);
  // Fiches jointes : les filtres peuvent porter sur les plateformes (« dispo sur mes abonnements »).
  const map = useTitleMap(keys);
  const titles = keys && map && titlesOf(keys, map);
  // Avec des filtres, les paliers sont recalculés sur la sélection (« ma tier list des comédies »).
  const tiers = titles && tierize(filter ? titles.filter(filter) : titles);

  if (!tiers) return <p className="muted center">{T.common.loading}</p>;
  const count = tiers.reduce((s, t) => s + t.items.length, 0);
  if (!count) return <p className="muted center">{filter ? T.tiers.noMatch : T.tiers.empty}</p>;

  const share = async () => {
    setSharing(true);
    try {
      await shareTierList(category, tiers, filter ? filterLabel : undefined);
    } catch (e) {
      toast(`✕ ${(e as Error).message}`);
    } finally {
      setSharing(false);
    }
  };

  return (
    <>
      <button className="btn primary" onClick={share} disabled={sharing} title={T.tiers.shareTip}>
        {sharing ? T.tiers.creating : T.tiers.share}
      </button>
      <div className="tier-list">
        {tiers.map((tier) => (
          <div key={tier.label} className="tier-row">
            <span className="tier-label" style={{ background: tier.color }}>
              {tier.label}
            </span>
            <div className="tier-items">
              {tier.items.length ? tier.items.map((t) => <TierPoster key={t.key} title={t} />) : <span className="muted tiny">—</span>}
            </div>
          </div>
        ))}
      </div>
      <p className="muted tiny center">{T.tiers.legend}</p>
    </>
  );
}

function TierPoster({ title }: { title: Title }) {
  const longPress = useLongPress(() => openFiche(title));
  return (
    <div className="tier-poster" {...longPress} onClick={() => openFiche(title)} title={`${title.title}${title.year ? ` (${title.year})` : ''}`}>
      <Poster title={title} size="w185" />
    </div>
  );
}
