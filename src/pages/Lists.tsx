import { useMemo, useState } from 'react';
import { num, T } from '../i18n';
import { useLiveQuery } from 'dexie-react-hooks';
import { clearStatus, db, type Answer, type Title } from '../lib/db';
import { categoryOf, categoryOptions, useCategories, type Category } from '../lib/category';
import { changeStatus } from '../lib/ranking';
import { matchesSearch, useTitleMap } from '../lib/hooks';
import { SearchBox, SeenButtons, TitleRow, TopBar, TypeFilter } from '../components/common';
import { Tutorial } from '../components/Tutorial';

type ListId = 'seen' | 'unseen';
type Filter = 'all' | Category;

const PAGE = 100;

/** Tous les titres vus ou « pas vus », pour retrouver un titre et corriger une erreur. */
export default function Lists() {
  const [list, setList] = useState<ListId>('seen');
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');
  const [limit, setLimit] = useState(PAGE);
  const categories = useCategories();

  const answers = useLiveQuery(() => db.answers.where('status').equals(list).reverse().sortBy('updatedAt'), [list]);
  const keys = useMemo(() => answers?.map((a) => a.key), [answers]);
  const titles = useTitleMap(keys); // sans relecture à chaque fiche enregistrée (voir useTitleMap)
  const items = useMemo(
    () =>
      answers &&
      titles &&
      answers
        .map((a) => ({ a, t: titles.get(a.key) }))
        .filter((x): x is { a: Answer; t: Title } => !!x.t && (filter === 'all' || categoryOf(x.t) === filter)),
    [answers, titles, filter],
  );

  const shown = items?.filter(({ t }) => matchesSearch(t, query)) ?? [];
  const reset = () => setLimit(PAGE);

  return (
    <main className="page">
      <Tutorial id="lists" />
      <TopBar title={T.lists.title} right={items && <span className="pill">{num(items.length)}</span>} />
      <TypeFilter<ListId>
        value={list}
        options={[
          ['seen', T.lists.seen, T.lists.seenTip],
          ['unseen', T.lists.unseen, T.lists.unseenTip],
        ]}
        onChange={(v) => {
          setList(v);
          reset();
        }}
      />
      <TypeFilter<Filter>
        value={filter}
        options={[
          ['all', T.lists.all, T.lists.allTip],
          ...categoryOptions(categories, (c) => T.lists.only[c]),
        ]}
        onChange={(v) => {
          setFilter(v);
          reset();
        }}
      />
      <SearchBox
        value={query}
        onChange={(v) => {
          setQuery(v);
          reset();
        }}
      />
      {!items ? (
        <p className="muted center">{T.common.loading}</p>
      ) : !shown.length ? (
        <p className="muted center">{items.length ? T.list.noMatch : T.lists.empty}</p>
      ) : (
        <ul className="list">
          {shown.slice(0, limit).map(({ t, a }) => (
            <TitleRow key={t.key} title={t} showType={filter === 'all'}>
              {list === 'seen' ? (
                <>
                  <SeenButtons title={t} current={a} />
                  <button className="btn small" onClick={() => changeStatus(t, 'wish')} title={T.lists.toWishTip} aria-label={T.lists.toWish}>
                    ♥
                  </button>
                  <button className="btn small" onClick={() => changeStatus(t, 'unseen')} title={T.lists.toUnseenTip} aria-label={T.lists.toUnseen}>
                    ✕
                  </button>
                </>
              ) : (
                <>
                  <SeenButtons title={t} />
                  <button className="btn small" onClick={() => changeStatus(t, 'wish')} title={T.lists.wishAfterAllTip} aria-label={T.lists.toWish}>
                    ♥
                  </button>
                  <button className="btn small" onClick={() => clearStatus(t.key)} title={T.lists.resetTip} aria-label={T.lists.reset}>
                    ↺
                  </button>
                </>
              )}
            </TitleRow>
          ))}
        </ul>
      )}
      {shown.length > limit && (
        <button className="btn" onClick={() => setLimit((l) => l + PAGE)} title={T.lists.moreTip}>
          {T.lists.more(num(shown.length - limit))}
        </button>
      )}
    </main>
  );
}
