import { useMemo } from 'react';
import { T } from '../../i18n';
import { type Category } from '../../lib/category';
import { commonWishlist } from '../../lib/together';
import { WEEK } from '../../lib/tmdb';
import { ProviderLine, TitleRow } from '../../components/common';
import { NeedsSharing, nth, type Loaded } from './shared';

export function CommonWishlist({ data, category }: { data: Loaded; category: Category }) {
  const list = useMemo(() => commonWishlist(data.me, data.them, category, data.catOf), [data, category]);
  const pseudo = data.friend.pseudo;
  if (!data.friend.shareWishlist) return <NeedsSharing pseudo={pseudo} what="sa wishlist" />;
  if (!list.length) return <p className="muted center">{T.duo.noCommon(category)}</p>;
  return (
    <>
      <p className="muted small center">
        {T.duo.common(list.length)}
      </p>
      <ul className="list">
        {list.map((w) => {
          const t = data.titles.get(w.key);
          return (
            t && (
              <TitleRow
                key={w.key}
                title={t}
                below={
                  <>
                    <span className="muted tiny">
                      {T.duo.positions(nth(w.mine), pseudo, nth(w.theirs))}
                    </span>
                    <ProviderLine title={t} maxAge={WEEK} />
                  </>
                }
              />
            )
          );
        })}
      </ul>
    </>
  );
}
