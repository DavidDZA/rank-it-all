import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, getMeta } from '../lib/db';
import { keysOfCategory, mediaOf, useCategories, type Category } from '../lib/category';
import { readRanking } from '../lib/ranking';
import { hasTmdbAccess } from '../lib/settings';
import { loadActivity, streak, todayCount } from '../lib/activity';
import { exportData } from '../lib/backup';
import { BADGES } from '../lib/badges';
import { pick, toast } from '../lib/fun';
import { useIsDesktop } from '../lib/hooks';
import { loadCatalogue } from './swipe/pool';
import { useCloud } from '../lib/cloud';
import { cloudEnabled } from '../lib/supabase';
import { downloadCatalogue, useCatalogueDownload } from '../lib/catalogueDownload';
import { CatalogueProgress } from '../components/CatalogueProgress';
import { Tutorial } from '../components/Tutorial';
import { num, T } from '../i18n';

const fmt = (n: number) => num(Math.max(0, n));
const DAY = 86_400_000;
const daysAgo = (t: number) => Math.floor((Date.now() - t) / DAY);
const ratio = (a: number, b: number) => (b > 0 ? a / b : 0);

const TAGLINES = T.home.taglines;

/** Accueil : format complet sur PC, compact sur téléphone. */
export default function Home() {
  // Précharge le catalogue pendant qu'on est sur l'accueil : le swipe s'ouvre ensuite sans attendre.
  useEffect(() => {
    const timer = setTimeout(() => {
      loadCatalogue('movie')
        .then(() => loadCatalogue('tv'))
        .then(() => loadCatalogue('anime'))
        .catch(() => undefined);
    }, 500);
    return () => clearTimeout(timer);
  }, []);
  const [tagline] = useState(() => pick(TAGLINES));
  const desktop = useIsDesktop();
  const cloud = useCloud();
  const download = useCatalogueDownload();
  const showAnime = useCategories().includes('anime');
  const stats = useLiveQuery(async () => {
    const byCategory = async (category: Category) => {
      const media = mediaOf(category);
      const [catalogue, answeredKeys, seenKeys, ranking] = await Promise.all([
        loadCatalogue(category),
        db.answers.where('type').equals(media).primaryKeys(),
        db.answers.where('[type+status]').equals([media, 'seen']).primaryKeys(),
        readRanking({ category: category, list: 'seen' }),
      ]);
      const [answered, seen] = await Promise.all([keysOfCategory(category, answeredKeys), keysOfCategory(category, seenKeys)]);
      const total = catalogue.length;
      return {
        total,
        answered: answered.length,
        toSwipe: Math.max(0, total - answered.length),
        seen: seen.length,
        ranked: ranking.length,
        unranked: seen.length - ranking.length,
      };
    };
    const [movie, tv, anime, wish, activity, lastSync, lastExport, badges] = await Promise.all([
      byCategory('movie'),
      byCategory('tv'),
      byCategory('anime'),
      db.answers.where('status').equals('wish').count(),
      loadActivity(),
      getMeta<number | null>('lastSync', null),
      getMeta<number | null>('lastExport', null),
      getMeta<string[]>('badges', []),
    ]);
    return { movie, tv, anime, wish, today: todayCount(activity), streak: streak(activity), lastSync, lastExport, badges: badges.length };
  });

  const noToken = !hasTmdbAccess();
  const emptyCatalogue = stats && stats.movie.total + stats.tv.total + stats.anime.total === 0;
  const answered = stats ? stats.movie.answered + stats.tv.answered + stats.anime.answered : 0;
  // Le compte sauvegarde tout (bandeau « Connecte-toi ») : rappel d'export seulement si aucun compte n'est possible.
  const backupDue = !cloudEnabled && stats && answered >= 20 && (!stats.lastExport || daysAgo(stats.lastExport) >= 14);
  const catalogueOld = stats?.lastSync && daysAgo(stats.lastSync) >= 30;

  const backupNow = async () => {
    await exportData();
    toast(T.home.backupDone);
  };

  return (
    <main className="page">
      <Tutorial id="home" />
      <header className="home-header">
        <img className="logo" src={`${import.meta.env.BASE_URL}icons/favicon.svg`} alt="" />
        <div className="home-title">
          <h1>Rank It All</h1>
          <p className="tagline">{tagline}</p>
        </div>
        {cloud.user && (
          <a className="icon-btn" href="#/friends" aria-label={T.home.friends} title={T.home.friendsTip}>
            👥
          </a>
        )}
        <a className="icon-btn" href="#/settings" aria-label={T.home.settings} title={T.home.settingsTip}>
          ⚙️
        </a>
      </header>

      {noToken ? (
        <a className="banner" href="#/settings/tmdb">
          {T.home.needKey}
        </a>
      ) : download.running || download.error ? (
        <CatalogueProgress />
      ) : (
        emptyCatalogue &&
        download.checked && (
          <button className="banner banner-btn" onClick={() => downloadCatalogue()} title={T.swipe.downloadTip}>
            {T.home.download}
          </button>
        )
      )}

      {cloudEnabled && cloud.ready && !cloud.user && (
        <a className="banner-soft row-banner" href="#/settings" title={T.home.signInTip}>
          <span>{desktop ? T.home.signInLong : T.home.signInShort}</span>
          <span className="btn small primary">{T.home.signIn}</span>
        </a>
      )}

      {backupDue && (
        <div className="banner-soft row-banner">
          <span>
            💾{' '}
            {desktop
              ? stats.lastExport
                ? T.home.lastBackup(daysAgo(stats.lastExport))
                : T.home.noBackup
              : stats.lastExport
                ? T.home.lastBackupShort(daysAgo(stats.lastExport))
                : T.home.noBackupShort}
          </span>
          <button className="btn small primary" onClick={backupNow} title={T.home.exportTip}>
            {T.home.export}
          </button>
        </div>
      )}

      {catalogueOld && (
        <a className="banner-soft row-banner" href="#/settings/catalogue" title={T.home.updateTip}>
          <span>{desktop ? T.home.catalogueAge(daysAgo(stats.lastSync!)) : T.home.catalogueAgeShort(daysAgo(stats.lastSync!))}</span>
          <span className="btn small">{T.home.update}</span>
        </a>
      )}

      {stats && !emptyCatalogue && <Activity today={stats.today} streak={stats.streak} desktop={desktop} />}

      {stats && stats.wish > 0 && <TonightButton desktop={desktop} />}

      <div className="tiles">
        <Tile
          color="pink"
          href="#/swipe/movie"
          icon="🎬"
          label={T.home.tiles.swipe.movie}
          tip={T.home.tiles.swipeTip.movie}
          sub={stats && T.home.toDiscover(fmt(stats.movie.toSwipe))}
          progress={stats && ratio(stats.movie.answered, stats.movie.total)}
        />
        <Tile
          color="violet"
          href="#/rank/movie"
          icon="🏆"
          label={T.home.tiles.rank.movie}
          tip={T.home.tiles.rankTip.movie}
          sub={stats && T.home.unranked('movie', fmt(stats.movie.unranked))}
          progress={stats && ratio(stats.movie.ranked, stats.movie.seen)}
        />
        <Tile
          color="orange"
          href="#/swipe/tv"
          icon="📺"
          label={T.home.tiles.swipe.tv}
          tip={T.home.tiles.swipeTip.tv}
          sub={stats && T.home.toDiscover(fmt(stats.tv.toSwipe))}
          progress={stats && ratio(stats.tv.answered, stats.tv.total)}
        />
        <Tile
          color="cyan"
          href="#/rank/tv"
          icon="🥇"
          label={T.home.tiles.rank.tv}
          tip={T.home.tiles.rankTip.tv}
          sub={stats && T.home.unranked('tv', fmt(stats.tv.unranked))}
          progress={stats && ratio(stats.tv.ranked, stats.tv.seen)}
        />
        {showAnime && (
          <>
            <Tile
              color="coral"
              href="#/swipe/anime"
              icon="🎌"
              label={T.home.tiles.swipe.anime}
              tip={T.home.tiles.swipeTip.anime}
              sub={stats && T.home.toDiscover(fmt(stats.anime.toSwipe))}
              progress={stats && ratio(stats.anime.answered, stats.anime.total)}
            />
            <Tile
              color="teal"
              href="#/rank/anime"
              icon="🏯"
              label={T.home.tiles.rank.anime}
              tip={T.home.tiles.rankTip.anime}
              sub={stats && T.home.unranked('anime', fmt(stats.anime.unranked))}
              progress={stats && ratio(stats.anime.ranked, stats.anime.seen)}
            />
          </>
        )}
        <Tile color="red" href="#/wishlist" icon="💖" label={T.home.tiles.wishlist} tip={T.home.tiles.wishlistTip} sub={stats && T.home.titles(fmt(stats.wish))} />
        <Tile color="green" href="#/add" icon="🔍" label={T.home.tiles.add} tip={T.home.tiles.addTip} sub={T.home.tiles.addSub} />
        <Tile color="yellow" href="#/lists" icon="📚" label={T.home.tiles.lists} tip={T.home.tiles.listsTip} sub={T.home.tiles.listsSub} />
        <Tile
          color="blue"
          href="#/stats"
          icon="📊"
          label={T.home.tiles.stats}
          tip={T.home.tiles.statsTip}
          sub={stats && `${stats.badges}/${BADGES.length} badges`}
          progress={stats && ratio(stats.badges, BADGES.length)}
        />
      </div>

      {stats && (
        <p className="muted center small">
          {T.home.seenSummary(fmt(stats.movie.seen), fmt(stats.tv.seen), showAnime ? fmt(stats.anime.seen) : null)}
        </p>
      )}
    </main>
  );
}

/** Activité du jour : grande carte sur PC, fine bande sur téléphone. */
function Activity({ today, streak, desktop }: { today: number; streak: number; desktop: boolean }) {
  const streakClass = `streak ${streak ? 'on' : ''}`;
  const streakTip = T.home.streakTip;

  if (!desktop) {
    return (
      <section className="activity-strip" title={T.home.activityTip}>
        <span className={streakClass} title={streakTip}>
          {T.home.streakShort(streak)}
        </span>
        <span>
          <b className="activity-num">{today}</b> {T.home.sortsToday(today)}
        </span>
        <span className="activity-msg muted">{today === 0 ? T.home.cheer0 : today < 25 ? T.home.cheer1 : T.home.cheer2}</span>
      </section>
    );
  }
  return (
    <section className="activity" title={T.home.activityTip}>
      <div className="activity-today">
        <span className="activity-num">{today}</span>
        <span className="activity-label">{T.home.sortsToday(today)}</span>
      </div>
      <div className="activity-side">
        <span className={streakClass} title={streakTip}>
          {T.home.streak(streak)}
        </span>
        <span className="muted small">
          {today === 0 ? T.home.cheerLong0 : today < 25 ? T.home.cheerLong1 : T.home.cheerLong2}
        </span>
      </div>
    </section>
  );
}

function TonightButton({ desktop }: { desktop: boolean }) {
  return (
    <a className="tonight-btn" href="#/tonight" title={T.home.tonightTip}>
      <span className="tonight-emoji">🍿</span>
      {desktop ? (
        <span>
          <b>{T.home.tonight}</b>
          <span className="tonight-sub">{T.home.tonightSub}</span>
        </span>
      ) : (
        <>
          <b>{T.home.tonight}</b>
          <span className="tonight-arrow">›</span>
        </>
      )}
    </a>
  );
}

interface TileProps {
  color: string;
  href: string;
  icon: string;
  label: string;
  tip: string;
  sub?: string | false;
  progress?: number | false;
}

function Tile({ color, href, icon, label, tip, sub, progress }: TileProps) {
  return (
    <a className={`tile tile-${color}`} href={href} title={tip}>
      <span className="tile-icon">{icon}</span>
      <span className="tile-label">{label}</span>
      <span className="tile-sub">{sub || ' '}</span>
      {typeof progress === 'number' && (
        <span className="tile-progress" title={`${Math.round(progress * 100)} %`}>
          <span style={{ width: `${Math.min(100, progress * 100)}%` }} />
        </span>
      )}
    </a>
  );
}
