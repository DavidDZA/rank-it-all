import { useMemo } from 'react';
import { T } from '../../i18n';
import { type Category } from '../../lib/category';
import { compatibility } from '../../lib/together';
import { TitleRow } from '../../components/common';
import { NeedsSharing, type Loaded } from './shared';

function verdict(p: number): string {
  if (p >= 80) return T.duo.verdict[0];
  if (p >= 65) return T.duo.verdict[1];
  if (p >= 55) return T.duo.verdict[2];
  if (p >= 45) return T.duo.verdict[3];
  return T.duo.verdict[4];
}

export function MatchView({ data, category }: { data: Loaded; category: Category }) {
  const pseudo = data.friend.pseudo;
  const match = useMemo(() => compatibility(data.me, data.them, category), [data, category]);
  if (!data.friend.shareRanking) return <NeedsSharing pseudo={pseudo} what={T.duo.theirRanking} />;
  if (!match) {
    return (
      <p className="muted center">
        {T.duo.notEnough(category)}
      </p>
    );
  }
  const list = (items: typeof match.agree) => (
    <ul className="list">
      {items.map((x) => {
        const t = data.titles.get(x.key);
        return t && <TitleRow key={x.key} title={t} below={<span className="muted tiny">{T.duo.positions(T.duo.nth(x.mine), pseudo, T.duo.nth(x.theirs))}</span>} />;
      })}
    </ul>
  );
  return (
    <>
      <section className="card duo-match">
        <p className="duo-percent">{match.percent} %</p>
        <p>{verdict(match.percent)}</p>
        <p className="muted small">
          {T.duo.basedOn(match.common, category)}
        </p>
      </section>
      {match.agree.length > 0 && (
        <section className="duo-section">
          <h3>{T.duo.agree}</h3>
          {list(match.agree)}
        </section>
      )}
      {match.disagree.length > 0 && (
        <section className="duo-section">
          <h3>{T.duo.disagree}</h3>
          {list(match.disagree)}
        </section>
      )}
    </>
  );
}
