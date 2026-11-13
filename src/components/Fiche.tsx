import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type Provider, type Status, type Title } from '../lib/db';
import { CATEGORY_LABEL, categoryOf } from '../lib/category';
import { changeStatus } from '../lib/ranking';
import { providerLogo, WEEK } from '../lib/tmdb';
import { groupProviders, isMineGroup, loadMyProviders } from '../lib/providers';
import { Poster, SeenButtons, Sheet, useDetails } from './common';
import { num, REGION, regionName, T } from '../i18n';

/** Ouvre la fiche complète d'un titre (voir <FicheHost /> dans App). */
export function openFiche(title: Title): void {
  dispatchEvent(new CustomEvent('open-fiche', { detail: title }));
}

/** Affiche la fiche demandée ; le bouton Retour la referme (comme toute fenêtre, voir Sheet). */
export function FicheHost() {
  const [title, setTitle] = useState<Title | null>(null);

  useEffect(() => {
    const onOpen = (e: Event) => setTitle((e as CustomEvent<Title>).detail);
    addEventListener('open-fiche', onOpen);
    return () => removeEventListener('open-fiche', onOpen);
  }, []);

  if (!title) return null;
  return <Fiche key={title.key} title={title} onClose={() => setTitle(null)} />;
}

const STATUS_LABEL: Record<Status, string> = T.fiche.status;

function Fiche({ title, onClose }: { title: Title; onClose: () => void }) {
  const d = useDetails(title, WEEK);
  const answer = useLiveQuery(() => db.answers.get(title.key), [title.key]);
  const status = answer?.status;

  const facts = [
    CATEGORY_LABEL[categoryOf(title)].badge,
    title.year,
    title.type === 'movie' && d?.runtime ? T.fiche.runtime(Math.floor(d.runtime / 60), String(d.runtime % 60).padStart(2, '0')) : null,
    title.type === 'tv' && d?.seasons ? T.fiche.seasons(d.seasons) : null,
    title.type === 'tv' && d?.episodes ? T.fiche.episodes(d.episodes) : null,
    d?.rating ? `⭐ ${num(d.rating)}/10` : null,
  ].filter(Boolean);

  return (
    <Sheet onClose={onClose} label={T.fiche.label(title.title)}>
      <div className="fiche-head">
        <Poster title={title} size="w342" className="fiche-poster" />
        <div className="fiche-info">
          <h2 className="fiche-title">{title.title}</h2>
          {title.originalTitle && title.originalTitle !== title.title && <div className="title-original">{title.originalTitle}</div>}
          <div className="fiche-facts">{facts.join(' · ')}</div>
          {d && d.genres.length > 0 && (
            <div className="fiche-genres">
              {d.genres.map((g) => (
                <span key={g} className="badge">
                  {g}
                </span>
              ))}
            </div>
          )}
          {status && (
            <div className={`fiche-status status-${status}`}>
              {STATUS_LABEL[status]}
              {status === 'seen' && answer?.tier && (answer.tier === 'good' ? T.fiche.good : T.fiche.meh)}
            </div>
          )}
        </div>
      </div>

      {d && (d.directors.length > 0 || d.cast.length > 0) && (
        <div className="fiche-credits">
          {d.directors.length > 0 && (
            <div>
              <span className="muted">{title.type === 'movie' ? T.fiche.director : T.fiche.creator}</span> {d.directors.join(', ')}
            </div>
          )}
          {d.cast.length > 0 && (
            <div>
              <span className="muted">{T.fiche.cast}</span> {d.cast.join(', ')}
            </div>
          )}
          {d.collection && (
            <div>
              <span className="muted">{T.fiche.saga}</span> {d.collection.name}
            </div>
          )}
        </div>
      )}

      <p className="fiche-overview">{title.overview || T.common.noOverview}</p>

      {d?.trailer && (
        <a className="btn primary trailer" href={`https://www.youtube.com/watch?v=${d.trailer}`} target="_blank" rel="noreferrer" title={T.fiche.trailerTip}>
          {T.fiche.trailer}
        </a>
      )}

      <section className="fiche-section">
        <h3>{T.fiche.where}</h3>
        {!d ? (
          <p className="muted small">{T.common.loading}</p>
        ) : (
          <>
            <ProviderGroup label={T.fiche.flatrate} list={d.providers.flatrate} />
            <ProviderGroup label={T.fiche.rent} list={d.providers.rent} />
            <ProviderGroup label={T.fiche.buy} list={d.providers.buy} />
            {!d.providers.flatrate.length && !d.providers.rent.length && !d.providers.buy.length && (
              <p className="muted small">{T.fiche.unavailable(regionName(REGION))}</p>
            )}
            {d.providers.link && (
              <a className="small link" href={d.providers.link} target="_blank" rel="noreferrer" title={T.fiche.allOffersTip}>
                {T.fiche.allOffers}
              </a>
            )}
            <p className="muted tiny">{T.fiche.justwatch}</p>
          </>
        )}
      </section>

      <div className="row center fiche-actions">
        <SeenButtons title={title} current={answer} labels />
        {(['wish', 'unseen'] as const).map((s) => (
          <button
            key={s}
            className={`btn ${status === s ? 'primary' : ''}`}
            onClick={() => changeStatus(title, s)}
            disabled={status === s}
            title={s === 'wish' ? T.fiche.wishTip : T.fiche.unseenTip}
          >
            {STATUS_LABEL[s]}
          </button>
        ))}
      </div>
    </Sheet>
  );
}

function ProviderGroup({ label, list }: { label: string; list: Provider[] }) {
  if (!list.length) return null;
  const mine = loadMyProviders();
  return (
    <div className="provider-group">
      <span className="muted small">{label}</span>
      <div className="providers">
        {groupProviders(list).map((g) => (
          <img
            key={g.key}
            className={`provider-logo big ${isMineGroup(g, mine) ? 'mine' : ''}`}
            src={providerLogo(g.logo) ?? ''}
            alt={g.label}
            title={g.names.join(' · ')}
          />
        ))}
      </div>
    </div>
  );
}
