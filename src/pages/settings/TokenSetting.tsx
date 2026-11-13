import { useState } from 'react';
import { getUserToken, hasBuiltInToken, setToken } from '../../lib/settings';
import { tmdb } from '../../lib/tmdb';
import { T } from '../../i18n';

/** Réglages → Clé TMDB : une clé personnelle, prioritaire sur celle intégrée au site. */
export function TokenSetting() {
  const [token, setTokenInput] = useState(getUserToken() ?? '');
  const [msg, setMsg] = useState<string | null>(null);

  const save = async () => {
    setMsg(T.token.checking);
    try {
      await tmdb('/authentication', {}, { token: token.trim() });
      setToken(token);
      setMsg(T.token.saved);
    } catch (e) {
      setMsg(`✕ ${(e as Error).message}`);
    }
  };

  return (
    <section className="card" id="tmdb">
      <h3>{T.token.title}</h3>
      <p className="muted small">{T.token.text}</p>
      {hasBuiltInToken && <p className="small">{T.token.builtIn}</p>}
      <input className="input" type="password" value={token} onChange={(e) => setTokenInput(e.target.value)} placeholder={hasBuiltInToken ? T.token.builtInPlaceholder : 'eyJhbGciOi…'} autoComplete="off" />
      <button className="btn primary" onClick={save} disabled={!token.trim()} title={T.token.saveTip}>
        {T.token.save}
      </button>
      {msg && <p className="small">{msg}</p>}
    </section>
  );
}
