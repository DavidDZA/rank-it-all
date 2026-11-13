import { useMemo, type ReactNode } from 'react';
import { T } from '../../i18n';
import type { Title } from '../../lib/db';
import type { Category } from '../../lib/category';
import { advice, type Advice } from '../../lib/together';
import { TitleRow } from '../../components/common';
import { addToWishlist, NeedsSharing, type Loaded } from './shared';

export function AdviceLists({ data, category, onWish }: { data: Loaded; category: Category; onWish: () => void }) {
  const pseudo = data.friend.pseudo;
  const forMe = useMemo(() => advice(data.them, data.me, category, data.catOf), [data, category]);
  const forThem = useMemo(() => advice(data.me, data.them, category, data.catOf), [data, category]);
  if (!data.friend.shareRanking) return <NeedsSharing pseudo={pseudo} what={T.duo.theirSeen} />;

  const wish = (t: Title) => addToWishlist(t, onWish);

  const rows = (list: Advice[], who: string, action?: (t: Title, a: Advice) => ReactNode) => (
    <ul className="list">
      {list.map((a) => {
        const t = data.titles.get(a.key);
        return (
          t && (
            <TitleRow
              key={a.key}
              title={t}
              below={
                <span className="muted tiny">
                  {[a.good && T.duo.good, a.rank && T.duo.rankFor(a.rank, who)].filter(Boolean).join(' · ')}
                </span>
              }
            >
              {action?.(t, a)}
            </TitleRow>
          )
        );
      })}
    </ul>
  );

  return (
    <>
      <section className="duo-section">
        <h3>{T.duo.advises(pseudo)}</h3>
        {forMe.length ? (
          rows(forMe, pseudo, (t, a) =>
            a.inWishlist ? (
              <span className="muted tiny">{T.duo.inYourWishlist}</span>
            ) : (
              <button className="btn small" onClick={() => wish(t)} title={T.duo.addToWish} aria-label={T.duo.addToWish}>
                💖
              </button>
            ),
          )
        ) : (
          <p className="muted small">{T.duo.nothingNew(pseudo)}</p>
        )}
      </section>
      <section className="duo-section">
        <h3>{T.duo.toAdvise(pseudo)}</h3>
        {forThem.length ? (
          rows(forThem, T.duo.you, (_t, a) => a.inWishlist && <span className="muted tiny">{T.duo.inTheirWishlist}</span>)
        ) : (
          <p className="muted small">{T.duo.allSeen(pseudo)}</p>
        )}
      </section>
    </>
  );
}
