import { useEffect, useMemo, useState } from 'react';
import { T } from '../../i18n';
import { db, withDetails, type Title } from '../../lib/db';
import type { Category } from '../../lib/category';
import { commonWishlist } from '../../lib/together';
import { pickWeighted } from '../../lib/tonight';
import { availableOnMine, hasMyProviders, loadMyProviders } from '../../lib/providers';
import { prefetchDetails, WEEK } from '../../lib/tmdb';
import { burst } from '../../lib/fun';
import { Poster, ProviderLine, RatingBadge, TitleText } from '../../components/common';
import { openFiche } from '../../components/Fiche';
import { NeedsSharing, type Loaded } from './shared';

export function TonightDuo({ data, category }: { data: Loaded; category: Category }) {
  const [mineOnly, setMineOnly] = useState(false);
  const [picked, setPicked] = useState<Title | null>(null);
  const mine = loadMyProviders();
  const list = useMemo(() => commonWishlist(data.me, data.them, category, data.catOf), [data, category]);
  const titles = list.map((w) => data.titles.get(w.key)).filter((t): t is Title => !!t);

  // Plateformes à jour pour le filtre « sur mes abonnements ».
  useEffect(() => {
    prefetchDetails(titles, WEEK);
  }, [list.length]);

  if (!data.friend.shareWishlist) return <NeedsSharing pseudo={data.friend.pseudo} what="sa wishlist" />;
  if (!list.length) return <p className="muted center">{T.duo.nothingToRoll}</p>;

  const candidates = list.filter((w) => {
    const t = data.titles.get(w.key);
    return t && (!mineOnly || (t.details && availableOnMine(t.details.providers.flatrate, mine)));
  });

  const roll = async () => {
    const choice = pickWeighted(candidates.filter((w) => w.key !== picked?.key).map((w) => ({ item: w.key, w: w.weight })));
    const t = choice ? data.titles.get(choice) : undefined;
    if (!t) return;
    // Fiche à jour (résumé, plateformes) pour le titre tiré.
    const stored = await db.titles.get(t.key);
    setPicked((await withDetails([stored ?? t]))[0]);
    burst(['🍿', '🎬', '✨'], undefined, 16);
  };

  return (
    <>
      {hasMyProviders(mine) && (
        <div className="chips">
          <button className={`chip ${mineOnly ? 'active' : ''}`} onClick={() => setMineOnly(!mineOnly)} title={T.tonightPage.mineTip}>
            {T.tonightPage.mine}
          </button>
        </div>
      )}
      <button className="btn primary roll-btn" onClick={roll} disabled={!candidates.length} title={T.duo.rollTip}>
        {picked ? T.tonightPage.again : T.tonightPage.roll}
      </button>
      <p className="muted small center">
        {candidates.length
          ? T.duo.candidates(candidates.length)
          : T.duo.noneOnProviders}
      </p>
      {picked && (
        <div className="tonight-card revealed">
          <div className="tonight-poster">
            <Poster title={picked} size="w342" />
            <RatingBadge title={picked} className="corner-left" />
          </div>
          <div className="tonight-info">
            <TitleText title={picked} credits />
            <ProviderLine title={picked} maxAge={WEEK} />
            <p className="tonight-overview">{picked.overview || T.common.noOverview}</p>
            <div className="row">
              <button className="btn small" onClick={() => openFiche(picked)} title={T.tonightPage.ficheTip}>
                {T.tonightPage.fiche}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
