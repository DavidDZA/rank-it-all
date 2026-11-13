import { useState } from 'react';
import { applyLanguage, chosenLang, chosenRegion, detectLang, detectRegion, LANG_NAMES, LANGS, LOCALE, REGIONS, regionName, T, type Lang } from '../../i18n';

/**
 * Réglages → Langue et pays : par défaut ceux de l'appareil. Changer l'un ou l'autre recharge l'appli (tous les textes
 * changent) ; une nouvelle langue retraduit aussi les titres du catalogue au démarrage (catalogueDownload.ts).
 */
export function LanguageSetting() {
  const [lang, setLang] = useState<Lang | null>(chosenLang);
  const [region, setRegion] = useState<string | null>(chosenRegion);
  const [changing, setChanging] = useState(false);
  const deviceLang = detectLang();
  const regions = [...REGIONS].sort((a, b) => regionName(a).localeCompare(regionName(b), LOCALE));

  const apply = (l: Lang | null, r: string | null) => {
    setLang(l);
    setRegion(r);
    setChanging(true);
    applyLanguage(l, r);
  };

  return (
    <section className="card" id="langue">
      <h3>{T.language.title}</h3>
      <p className="muted small">{T.language.text}</p>
      {/* L'un sous l'autre : « Celle de l'appareil (Português (Brasil)) » ne tient pas sur une demi-largeur. */}
      <div className="language-fields">
        <label className="field">
          {T.language.language}
          <select className="input" value={lang ?? ''} onChange={(e) => apply((e.target.value || null) as Lang | null, region)} disabled={changing}>
            <option value="">{T.language.device(LANG_NAMES[deviceLang])}</option>
            {LANGS.map((l) => (
              <option key={l} value={l}>
                {LANG_NAMES[l]}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          {T.language.region}
          <select className="input" value={region ?? ''} onChange={(e) => apply(lang, e.target.value || null)} disabled={changing}>
            <option value="">{T.language.deviceRegion(regionName(detectRegion(undefined, lang ?? deviceLang)))}</option>
            {regions.map((r) => (
              <option key={r} value={r}>
                {regionName(r)}
              </option>
            ))}
          </select>
        </label>
      </div>
      {changing && <p className="small">{T.language.changing}</p>}
    </section>
  );
}
