import { useEffect, useState } from 'react';
import { getMeta } from '../lib/db';
import { categoryOptions, useCategories, type Category } from '../lib/category';
import { computeStats, formatHours, TOP_SIZE, type Bar, type Stats } from '../lib/stats';
import { BADGES } from '../lib/badges';
import { prefetchDetails } from '../lib/tmdb';
import { TopBar, TypeFilter } from '../components/common';
import { LOCALE, num, T } from '../i18n';

/** Pendant le complément des fiches, les stats sont recalculées à ce rythme. */
const STATS_REFRESH_MS = 3000;

export default function StatsPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [unlocked, setUnlocked] = useState<Set<string>>(new Set());
  const [category, setCategory] = useState<Category>('movie');
  const categories = useCategories();
  const [completing, setCompleting] = useState(0);

  const refresh = async () => {
    const [s, ids] = await Promise.all([computeStats(), getMeta<string[]>('badges', [])]);
    setStats(s);
    setUnlocked(new Set(ids));
    return s;
  };

  // Complète en arrière-plan les fiches manquantes (durée, réalisateur…), en recalculant au fur et à mesure : avant,
  // les stats n'étaient mises à jour qu'une fois toutes les fiches arrivées (des minutes, pour des centaines).
  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setInterval> | undefined;
    refresh().then(async (s) => {
      if (!alive || !s.missingDetails.length) return;
      timer = setInterval(() => alive && refresh(), STATS_REFRESH_MS);
      await prefetchDetails(s.missingDetails, Infinity, (n) => alive && setCompleting(n));
      clearInterval(timer);
      if (alive) {
        setCompleting(0);
        refresh();
      }
    });
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, []);

  if (!stats) {
    return (
      <main className="page">
        <TopBar title={T.statsPage.title} />
        <p className="muted center">{T.statsPage.computing}</p>
      </main>
    );
  }

  const t = stats[category];
  const all = [stats.movie, stats.tv, stats.anime];
  const minutes = all.reduce((s, x) => s + x.minutes, 0);
  const seenTotal = all.reduce((s, x) => s + x.seen, 0);
  const coverage = seenTotal ? Math.round((all.reduce((s, x) => s + x.withDetails, 0) / seenTotal) * 100) : 100;

  return (
    <main className="page">
      <TopBar title={T.statsPage.title} />

      <div className="stat-tiles">
        <StatTile emoji="🎬" value={stats.movie.seen} label={T.statsPage.tiles.movie} />
        <StatTile emoji="📺" value={stats.tv.seen} label={T.statsPage.tiles.tv} />
        {categories.includes('anime') ? (
          <StatTile emoji="🎌" value={stats.anime.seen} label={T.statsPage.tiles.anime} />
        ) : (
          <StatTile emoji="👍" value={stats.good} label={T.statsPage.tiles.good} /> // toujours 6 cases, même sans les animes
        )}
        <StatTile emoji="💖" value={stats.wish} label={T.statsPage.tiles.wish} />
        <StatTile emoji="🏆" value={all.reduce((s, x) => s + x.ranked, 0)} label={T.statsPage.tiles.ranked} />
        <StatTile emoji="⏱️" value={formatHours(minutes)} label={T.statsPage.tiles.screen(coverage < 100 ? coverage : null)} />
      </div>
      {completing > 0 && <p className="muted small center">{T.statsPage.completing(completing)}</p>}

      <section className="card">
        <h3>{T.statsPage.activity}</h3>
        <ActivityChart days={stats.last30} />
        <div className="row stat-row">
          <span title={T.home.streakTip}>
            {T.statsPage.streak} <b>{stats.streak}</b> {T.statsPage.daysShort}
          </span>
          <span title={T.statsPage.recordTip}>
            {T.statsPage.record} <b>{stats.bestStreak}</b> {T.statsPage.daysShort}
          </span>
          <span title={T.statsPage.bestDayTip}>
            {T.statsPage.bestDay} <b>{stats.bestDay}</b>
          </span>
        </div>
      </section>

      <TypeFilter<Category>
        value={category}
        options={categoryOptions(categories, (c) => T.statsPage.categoryTip(c))}
        onChange={setCategory}
      />

      <section className="card">
        <h3>{T.statsPage.top(TOP_SIZE[category], category)}</h3>
        <div className="big-progress" title={`${t.top.seen} / ${t.top.total}`}>
          <span style={{ width: `${t.top.total ? (t.top.seen / t.top.total) * 100 : 0}%` }} />
        </div>
        <p className="small">
          <b>{t.top.total ? Math.round((t.top.seen / t.top.total) * 100) : 0} %</b> {T.statsPage.topSeen(t.top.seen, t.top.total)}
        </p>
      </section>

      <BarCard title={T.statsPage.decades} bars={t.decades} empty={T.statsPage.decadesEmpty} />
      <BarCard title={T.statsPage.genres} bars={t.genres} empty={T.statsPage.genresEmpty} />
      <BarCard
        title={category === 'movie' ? T.statsPage.directors : T.statsPage.creators}
        bars={t.people}
        empty={T.statsPage.peopleEmpty}
      />
      <BarCard title={T.statsPage.actors} bars={t.actors} empty={T.statsPage.actorsEmpty} />

      <section className="card">
        <h3>
          {T.statsPage.badges(BADGES.filter((b) => unlocked.has(b.id)).length, BADGES.length)}
        </h3>
        <div className="badge-grid">
          {BADGES.map((b) => {
            const v = Math.min(b.value(stats), b.target);
            const done = unlocked.has(b.id) || v >= b.target;
            return (
              <div key={b.id} className={`badge-card ${done ? 'done' : ''}`} title={`${b.name} : ${b.desc}`}>
                <span className="badge-emoji">{b.emoji}</span>
                <span className="badge-name">{b.name}</span>
                <span className="badge-desc">{b.desc}</span>
                {!done && (
                  <span className="mini-progress">
                    <span style={{ width: `${(v / b.target) * 100}%` }} />
                  </span>
                )}
                {!done && b.target > 1 && (
                  <span className="badge-desc">
                    {v}/{b.target}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </section>
    </main>
  );
}

function StatTile({ emoji, value, label }: { emoji: string; value: number | string; label: string }) {
  return (
    <div className="stat-tile">
      <span className="stat-emoji">{emoji}</span>
      <span className="stat-value">{typeof value === 'number' ? num(value) : value}</span>
      <span className="stat-label">{label}</span>
    </div>
  );
}

/** Barres horizontales d'une seule couleur, valeur écrite au bout de chaque barre. */
function BarCard({ title, bars, empty }: { title: string; bars: Bar[]; empty: string }) {
  const max = Math.max(1, ...bars.map((b) => b.count));
  return (
    <section className="card">
      <h3>{title}</h3>
      {!bars.length ? (
        <p className="muted small">{empty}</p>
      ) : (
        <div className="hbars">
          {bars.map((b) => (
            <div key={b.label} className="hbar" title={`${b.label} : ${b.count}`}>
              <span className="hbar-label">{b.label}</span>
              <span className="hbar-track">
                <span className="hbar-fill" style={{ width: `${(b.count / max) * 100}%` }} />
              </span>
              <span className="hbar-value">{b.count}</span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function ActivityChart({ days }: { days: { date: Date; count: number }[] }) {
  const max = Math.max(1, ...days.map((d) => d.count));
  const fmt = (d: Date) => d.toLocaleDateString(LOCALE, { day: 'numeric', month: 'short' });
  return (
    <div className="activity-chart">
      <div className="columns">
        {days.map((d) => (
          <span key={d.date.toDateString()} className="column" title={T.statsPage.dayTip(fmt(d.date), d.count)}>
            <span className="column-fill" style={{ height: `${(d.count / max) * 100}%` }} />
          </span>
        ))}
      </div>
      <div className="columns-axis muted tiny">
        <span>{fmt(days[0].date)}</span>
        <span>{T.statsPage.max(max)}</span>
        <span>{T.statsPage.today}</span>
      </div>
    </div>
  );
}
