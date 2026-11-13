import { useEffect, useMemo, useState } from 'react';
import { num, T } from '../i18n';
import { titlesOf, useTitleMap } from '../lib/hooks';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type Title } from '../lib/db';
import { keysOfCategory, mediaOf, type Category } from '../lib/category';
import { changeStatus, readRanking, unrank, type Scope } from '../lib/ranking';
import { matchesTheme, missingFilterInfo, themeFilter, themeLabel } from '../lib/themes';
import { prefetchDetails, WEEK } from '../lib/tmdb';
import { loadMyProviders, mineFilter } from '../lib/providers';
import { MineChip, ProviderLine, TopBar, TypeFilter } from '../components/common';
import { Duel } from '../components/Duel';
import { RankedList } from '../components/RankedList';
import { TierList } from '../components/TierList';
import { FilterButton, FilterSheet, FilterStrip, useSavedFilter } from '../components/FilterSheet';
import { shareTop } from '../lib/share';
import { toast } from '../lib/fun';
import { Tutorial } from '../components/Tutorial';

type View = 'duel' | 'list' | 'tiers';

export default function Rank({ category }: { category: Category }) {
  const media = mediaOf(category);
  const [view, setView] = useState<View>('duel');
  const [sharing, setSharing] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [onlyMine, setOnlyMine] = useState(false);
  const [theme, setTheme] = useSavedFilter(`rank-filter:${category}`);
  const scope: Scope = { category: category, list: 'seen' };
  const filter = themeFilter(theme);
  const label = themeLabel(media, theme);
  // « Dispo sur mes abonnements » : ce qu'on peut revoir (classement et tier list, pas les duels).
  const byMine = view === 'duel' ? null : mineFilter(onlyMine, loadMyProviders());
  const listFilter = filter || byMine ? (t: Title) => (!filter || filter(t)) && (!byMine || byMine(t)) : null;
  const listLabel = [filter && label, byMine && T.card.onMyProviders].filter(Boolean).join(' · ');

  // Titres vus de ce type : pour compter ce que gardent les filtres.
  const seenKeys = useLiveQuery(async () => keysOfCategory(category, await db.answers.where('[type+status]').equals([media, 'seen']).primaryKeys()), [category]);
  const seenMap = useTitleMap(seenKeys);
  const seen = useMemo(() => seenKeys && seenMap && titlesOf(seenKeys, seenMap), [seenKeys, seenMap]);

  // Titres sans genre / langue (catalogue d'avant le 17/10) : complétés en arrière-plan pour les filtres.
  const pending = (seen ?? []).filter(missingFilterInfo);
  useEffect(() => {
    if (pending.length) prefetchDetails(pending); // fiches absentes ou anciennes seulement (pas toutes, à chaque visite)
  }, [pending.length > 0]);

  // Plateformes à jour (moins d'une semaine) quand on filtre sur ses abonnements.
  useEffect(() => {
    if (byMine && seen) prefetchDetails(seen, WEEK);
  }, [!!byMine, seen?.length]);

  const toWishlist = async (t: Title) => {
    if (confirm(T.rankPage.confirmWish(t.title))) {
      await changeStatus(t, 'wish');
    }
  };

  const share = async () => {
    const all = (await db.titles.bulkGet(await readRanking(scope))).filter((t): t is Title => !!t);
    const titles = (listFilter ? all.filter(listFilter) : all).slice(0, 10);
    if (!titles.length) {
      toast(T.rankPage.nothingToShare);
      return;
    }
    setSharing(true);
    try {
      await shareTop(category, titles, listFilter ? listLabel : undefined);
    } catch (e) {
      toast(`✕ ${(e as Error).message}`);
    } finally {
      setSharing(false);
    }
  };

  return (
    <main className="page wide">
      <Tutorial id="rank" />
      <TopBar
        title={T.rankPage.title(category)}
        right={<FilterButton active={!!filter} label={label} onClick={() => setShowFilters(true)} />}
      />
      {filter && <FilterStrip label={label} onClick={() => setShowFilters(true)} />}
      <TypeFilter<View>
        value={view}
        options={[
          ['duel', T.rankPage.duels, T.rankPage.duelsTip],
          ['list', T.rankPage.ranking, T.rankPage.rankingTip],
          ['tiers', T.rankPage.tiers, T.rankPage.tiersTip],
        ]}
        onChange={setView}
      />
      {view !== 'duel' && <MineChip value={onlyMine} onChange={setOnlyMine} title={T.rankPage.mineTip} />}
      {view === 'tiers' ? (
        <TierList category={category} filter={listFilter} filterLabel={listLabel} />
      ) : view === 'duel' ? (
        <Duel
          key={JSON.stringify(theme)}
          scope={scope}
          filter={filter}
          question={T.rankPage.question}
          emptyText={T.rankPage.emptyDuel}
        />
      ) : (
        <>
          <button className="btn primary" onClick={share} disabled={sharing} title={T.rankPage.shareTip}>
            {sharing ? T.tiers.creating : T.rankPage.share}
          </button>
          <RankedList
            scope={scope}
            filter={listFilter}
            below={byMine ? (t) => <ProviderLine title={t} maxAge={WEEK} /> : undefined}
            empty={T.rankPage.empty}
            actions={(t, ranked) => (
              <>
                {ranked && (
                  <button className="btn small" onClick={() => unrank(scope, t.key)} title={T.rankPage.rerankTip} aria-label={T.rankPage.rerank}>
                    ↺
                  </button>
                )}
                <button className="btn small" onClick={() => toWishlist(t)} title={T.rankPage.toWishTip} aria-label={T.rankPage.toWish}>
                  ♥
                </button>
              </>
            )}
          />
          {byMine && <p className="muted tiny center">{T.fiche.justwatch}</p>}
        </>
      )}

      {showFilters && (
        <FilterSheet
          type={media}
          initial={theme}
          count={(t) => (seen ?? []).filter((x) => matchesTheme(x, t)).length}
          applyLabel={(n) => T.rankPage.apply(num(n))}
          hasCatalogueData={(seen ?? []).some((t) => t.rating !== undefined || t.details?.rating)}
          pendingInfo={pending.length}
          onApply={(t) => {
            setTheme(t);
            setShowFilters(false);
          }}
          onClose={() => setShowFilters(false)}
        />
      )}
    </main>
  );
}
