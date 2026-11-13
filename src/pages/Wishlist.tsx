import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { num, T } from '../i18n';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type Title } from '../lib/db';
import { categoryOf, categoryOptions, mediaOf, useCategories, type Category } from '../lib/category';
import { changeStatus, scopeId, unrank, type Scope } from '../lib/ranking';
import { prefetchDetails, WEEK } from '../lib/tmdb';
import { loadMyProviders, mineFilter } from '../lib/providers';
import { matchesSearch, titlesOf, useTitleMap } from '../lib/hooks';
import { matchesTheme, missingFilterInfo, themeFilter, themeLabel } from '../lib/themes';
import { MineChip, ProviderLine, SearchBox, SeenButtons, TitleRow, TopBar, TypeFilter } from '../components/common';
import { FilterButton, FilterSheet, FilterStrip, useSavedFilter } from '../components/FilterSheet';
import { Duel } from '../components/Duel';
import { RankedList } from '../components/RankedList';
import { Tutorial } from '../components/Tutorial';

type View = 'list' | 'duel';
type Filter = 'all' | Category;

export default function Wishlist() {
  const [view, setView] = useState<View>('list');
  const [filter, setFilter] = useState<Filter>('all');
  const [onlyMine, setOnlyMine] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [savedTheme, setTheme] = useSavedFilter('wish-filter');
  const categories = useCategories();
  const mine = loadMyProviders();
  const wishKeys = useLiveQuery(() => db.answers.where('status').equals('wish').primaryKeys());
  const wishMap = useTitleMap(wishKeys);
  const wishes = useMemo(() => wishKeys && wishMap && titlesOf(wishKeys, wishMap), [wishKeys, wishMap]);

  // Plateformes à jour (moins d'une semaine) pour toute la wishlist.
  useEffect(() => {
    if (wishes) prefetchDetails(wishes, WEEK);
  }, [wishes?.length]);

  // Les duels se font par catégorie : « Tous » n'a pas de sens ici.
  const category: Category = filter === 'all' ? 'movie' : filter;
  const scope: Scope = { category: category, list: 'wish' };
  // Catégories mélangées : le genre ne s'applique pas (les genres diffèrent entre films et séries).
  const listCat: Category | null = view === 'duel' ? category : filter === 'all' ? null : filter;
  const listType = listCat && mediaOf(listCat);
  const theme = listType ? savedTheme : { ...savedTheme, genre: null };
  const byTheme = themeFilter(theme);
  const byMine = mineFilter(onlyMine, mine);
  const combined = byTheme || byMine ? (t: Title) => (!byTheme || byTheme(t)) && (!byMine || byMine(t)) : null;
  const label = themeLabel(listType, theme);

  const actions = (t: Title, ranked: boolean): ReactNode => (
    <>
      {ranked && (
        <button className="btn small" onClick={() => unrank(scope, t.key)} title={T.wishPage.reprioritizeTip} aria-label={T.wishPage.reprioritize}>
          ↺
        </button>
      )}
      <WishActions title={t} />
    </>
  );
  const providers = (t: Title) => <ProviderLine title={t} maxAge={WEEK} />;

  return (
    <main className="page wide wishlist-page">
      <Tutorial id="wishlist" />
      <TopBar title={T.wishPage.title(wishes?.length ?? null)} right={<FilterButton active={!!byTheme} label={label} onClick={() => setShowFilters(true)} />} />
      {byTheme && <FilterStrip label={label} onClick={() => setShowFilters(true)} />}
      <TypeFilter<View>
        value={view}
        options={[
          ['list', T.wishPage.list, T.wishPage.listTip],
          ['duel', T.wishPage.prioritize, T.wishPage.prioritizeTip],
        ]}
        onChange={(v) => {
          setView(v);
          if (v === 'duel' && filter === 'all') setFilter('movie');
        }}
      />
      <TypeFilter<Filter>
        value={view === 'duel' ? category : filter}
        options={[
          ...(view === 'list' ? [['all', T.lists.all, T.wishPage.allTip] as [Filter, string, string]] : []),
          ...categoryOptions(categories, (c) => T.wishPage.onlyTip[c]),
        ]}
        onChange={setFilter}
      />
      {view === 'list' && <MineChip value={onlyMine} onChange={setOnlyMine} title={T.wishPage.mineTip} />}
      {view === 'duel' ? (
        <Duel
          key={`${scopeId(scope)}-${JSON.stringify(theme)}`}
          scope={scope}
          filter={byTheme}
          question={T.wishPage.question}
          emptyText={T.wishPage.empty}
        />
      ) : filter === 'all' ? (
        <AllWishes filter={combined} below={providers} />
      ) : (
        <RankedList key={scopeId(scope)} scope={scope} empty={T.wishPage.empty} actions={actions} filter={combined} below={providers} />
      )}
      {view === 'list' && <p className="muted tiny center">{T.fiche.justwatch}</p>}

      {showFilters && (
        <FilterSheet
          type={listType}
          initial={savedTheme}
          count={(t) => (wishes ?? []).filter((x) => (!listCat || categoryOf(x) === listCat) && matchesTheme(x, listType ? t : { ...t, genre: null })).length}
          applyLabel={(n) => T.wishPage.apply(num(n))}
          hasCatalogueData={(wishes ?? []).some((t) => t.rating !== undefined || t.details?.rating)}
          pendingInfo={(wishes ?? []).filter(missingFilterInfo).length}
          onApply={(t) => {
            // Le genre choisi est gardé pour Films / Séries, même s'il ne s'applique pas à « Tous ».
            setTheme(listType ? t : { ...t, genre: savedTheme.genre });
            setShowFilters(false);
          }}
          onClose={() => setShowFilters(false)}
        />
      )}
    </main>
  );
}

function WishActions({ title }: { title: Title }) {
  return (
    <>
      <SeenButtons title={title} />
      <button className="btn small" onClick={() => changeStatus(title, 'unseen')} title={T.wishPage.remove} aria-label={T.wishPage.remove}>
        ✕
      </button>
    </>
  );
}

/** Toutes catégories mélangées, du plus récent ajout au plus ancien. */
function AllWishes({ filter, below }: { filter: ((t: Title) => boolean) | null; below: (t: Title) => ReactNode }) {
  const [query, setQuery] = useState('');
  const keys = useLiveQuery(async () => (await db.answers.where('status').equals('wish').reverse().sortBy('updatedAt')).map((a) => a.key));
  const map = useTitleMap(keys); // fiches jointes : plateformes, pour le filtre « dispo »
  const items = useMemo(() => keys && map && titlesOf(keys, map), [keys, map]);

  if (!items) return <p className="muted center">{T.common.loading}</p>;
  if (!items.length) return <p className="muted center">{T.wishPage.empty}</p>;
  const shown = items.filter((t) => matchesSearch(t, query) && (!filter || filter(t)));

  return (
    <>
      {items.length > 8 && <SearchBox value={query} onChange={setQuery} />}
      {!shown.length && <p className="muted center">{T.list.noMatch}</p>}
      <ul className="list">
        {shown.map((t) => (
          <TitleRow key={t.key} title={t} showType below={below(t)}>
            <WishActions title={t} />
          </TitleRow>
        ))}
      </ul>
    </>
  );
}
