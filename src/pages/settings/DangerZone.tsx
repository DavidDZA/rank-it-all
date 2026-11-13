import { useState } from 'react';
import { clearChoices } from '../../lib/db';
import { useCloud } from '../../lib/cloud';
import { T } from '../../i18n';

/** Réglages → Zone dangereuse : effacer tous ses choix (pas le catalogue). */
export function DangerZone() {
  const [msg, setMsg] = useState<string | null>(null);
  const signedIn = !!useCloud().user;

  const clear = async () => {
    if (
      !confirm(
        T.danger.confirm(signedIn),
      )
    )
      return;
    try {
      await clearChoices();
      setMsg(T.danger.done);
    } catch (e) {
      setMsg(`✕ ${(e as Error).message}`);
    }
  };

  return (
    <section className="card danger-zone">
      <h3>{T.danger.title}</h3>
      <p className="muted small">{T.danger.text}</p>
      <button className="btn danger" onClick={clear} title={T.danger.buttonTip}>
        {T.danger.button}
      </button>
      {msg && <p className="small">{msg}</p>}
    </section>
  );
}
