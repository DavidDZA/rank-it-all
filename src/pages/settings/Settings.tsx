import { useEffect } from 'react';
import { TopBar } from '../../components/common';
import { resetTutorials } from '../../lib/tutorial';
import { toast } from '../../lib/fun';
import { Account } from './Account';
import { BackupSetting } from './BackupSetting';
import { SwipeModeSetting } from './SwipeModeSetting';
import { MyProviders } from './MyProviders';
import { CatalogueSetting } from './CatalogueSetting';
import { CustomImportSetting } from './CustomImportSetting';
import { TokenSetting } from './TokenSetting';
import { DangerZone } from './DangerZone';
import { LanguageSetting } from './LanguageSetting';
import { LANG, T } from '../../i18n';

/** `section` : rubrique à afficher directement (« #/settings/catalogue », « #/settings/tmdb »). */
export default function Settings({ section }: { section?: string }) {
  useScrollToSection(section);
  return (
    <main className="page">
      <TopBar title={T.settings.title} />
      <LanguageSetting />
      <Account />
      <SwipeModeSetting />
      <MyProviders />
      <CatalogueSetting />
      <CustomImportSetting />
      <TokenSetting />
      <BackupSetting />
      <DangerZone />
      <div className="center">
        <button
          className="btn small"
          onClick={() => {
            resetTutorials();
            toast(T.settings.tipsReset);
          }}
          title={T.settings.tipsTip}
        >
          {T.settings.tips}
        </button>
      </div>
      <p className="muted small center">
        {T.settings.tmdbCredit}
        <br />
        This product uses the TMDB API but is not endorsed or certified by TMDB.
        <br />
        <a href={`${import.meta.env.BASE_URL}confidentialite.html?lang=${LANG}`}>{T.settings.privacy}</a>
      </p>
    </main>
  );
}

/**
 * Amène la rubrique `id` en haut de l'écran. Les rubriques au-dessus (abonnements…) se chargent après coup
 * et changent de hauteur : on recale pendant 2 s, sauf si l'utilisateur fait défiler la page lui-même.
 */
function useScrollToSection(id: string | undefined) {
  useEffect(() => {
    const el = id && document.getElementById(id);
    if (!el) return;
    let active = true;
    const go = () => active && el.scrollIntoView({ block: 'start' });
    const stop = () => {
      active = false;
      observer.disconnect();
    };
    const observer = new ResizeObserver(go);
    observer.observe(el.parentElement!);
    const frame = requestAnimationFrame(go); // après le retour en haut fait au changement de page
    const timer = setTimeout(stop, 2000);
    const events = ['wheel', 'touchstart', 'keydown'] as const;
    events.forEach((e) => addEventListener(e, stop, { once: true, passive: true }));
    return () => {
      stop();
      cancelAnimationFrame(frame);
      clearTimeout(timer);
      events.forEach((e) => removeEventListener(e, stop));
    };
  }, [id]);
}
