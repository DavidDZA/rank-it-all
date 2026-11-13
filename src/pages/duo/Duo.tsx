import { useEffect, useState } from 'react';
import { T } from '../../i18n';
import { db, withDetails, type Title } from '../../lib/db';
import { categoryOf, categoryOptions, useCategories, type Category } from '../../lib/category';
import { useCloud } from '../../lib/cloud';
import { listFriends, loadFriendData, loadMySide } from '../../lib/friends';
import { TopBar, TypeFilter } from '../../components/common';
import type { Loaded } from './shared';
import { FriendTop } from './FriendTop';
import { CommonWishlist } from './CommonWishlist';
import { TonightDuo } from './TonightDuo';
import { AdviceLists } from './AdviceLists';
import { MatchView } from './MatchView';
import { Tutorial } from '../../components/Tutorial';

type Tab = 'top' | 'wish' | 'tonight' | 'advice' | 'match';
/** « À deux » avec un ami : wishlist commune, tirage du soir, conseils croisés, compatibilité des classements. */
export default function Duo({ friendId }: { friendId: string }) {
  const cloud = useCloud();
  const [data, setData] = useState<Loaded | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [category, setCategory] = useState<Category>('movie');
  const categories = useCategories();
  const [tab, setTab] = useState<Tab>('top');

  const load = async (fresh = false) => {
    try {
      const [friends, them, me] = await Promise.all([listFriends(), loadFriendData(friendId, fresh), loadMySide()]);
      const friend = friends.find((f) => f.id === friendId);
      if (!friend) throw new Error(T.duo.notFriend);
      // Mes titres locaux (avec fiches) d'abord, sinon les copies jointes aux réponses de l'ami.
      const keys = [...new Set([...them.answers.keys(), ...me.answers.keys()])];
      const titles = new Map(them.titles);
      (await withDetails((await db.titles.bulkGet(keys)).filter((t): t is Title => !!t))).forEach((t) => titles.set(t.key, t));
      const catOf = (key: string) => {
        const t = titles.get(key);
        return t && categoryOf(t);
      };
      setData({ friend, me, them, titles, catOf });
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  useEffect(() => {
    if (cloud.user) load();
  }, [cloud.user?.id, friendId]);

  /** Après un ajout à ma wishlist : relire mon côté. */
  const refreshMe = async () => {
    const me = await loadMySide();
    setData((d) => d && { ...d, me });
  };

  const pseudo = data?.friend.pseudo ?? '…';

  return (
    <main className="page">
      <Tutorial id="duo" />
      <TopBar title={T.duo.title(pseudo)} />
      {!cloud.ready ? (
        <p className="muted center">{T.common.loading}</p>
      ) : !cloud.user ? (
        <p className="center">
          <a className="btn primary" href="#/friends">
            {T.home.signIn}
          </a>
        </p>
      ) : error ? (
        <div className="empty">
          <p>✕ {error}</p>
          <a className="btn" href="#/friends">
            {T.duo.backToFriends}
          </a>
        </div>
      ) : !data ? (
        <p className="muted center">{T.duo.loadingFriend}</p>
      ) : (
        <>
          <TypeFilter<Tab>
            value={tab}
            options={[
              ['top', T.duo.tabs.top, T.duo.tabs.topTip],
              ['wish', T.duo.tabs.common, T.duo.tabs.commonTip],
              ['tonight', T.duo.tabs.tonight, T.duo.rollTip],
              ['advice', T.duo.tabs.advice, T.duo.tabs.adviceTip],
              ['match', T.duo.tabs.match, T.duo.tabs.matchTip],
            ]}
            onChange={setTab}
          />
          <TypeFilter<Category>
            value={category}
            options={categoryOptions(categories, (c) => T.duo.categoryTip[c])}
            onChange={setCategory}
          />
          {tab === 'top' && <FriendTop key={category} data={data} category={category} onWish={refreshMe} />}
          {tab === 'wish' && <CommonWishlist data={data} category={category} />}
          {tab === 'tonight' && <TonightDuo key={category} data={data} category={category} />}
          {tab === 'advice' && <AdviceLists data={data} category={category} onWish={refreshMe} />}
          {tab === 'match' && <MatchView data={data} category={category} />}
          <p className="muted tiny center">
            <button className="link" onClick={() => load(true)} title={T.duo.refreshTip}>
              {T.duo.refresh}
            </button>
          </p>
        </>
      )}
    </main>
  );
}
