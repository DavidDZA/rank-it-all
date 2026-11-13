import { useEffect, useState } from 'react';
import { T } from '../i18n';
import { useCloud } from '../lib/cloud';
import { cloudEnabled } from '../lib/supabase';
import {
  addFriend,
  findByCode,
  inviteLink,
  listFriends,
  loadMyProfile,
  newFriendCode,
  removeFriend,
  setSharing,
  type Friend,
  type MyProfile,
} from '../lib/friends';
import { toast } from '../lib/fun';
import { TopBar } from '../components/common';
import { Account } from './settings/Account';
import { Tutorial } from '../components/Tutorial';

/** Amis : mon code et mon lien d'invitation, ajout par code, liste, ce que je partage. `invite` : code reçu par lien. */
export default function Friends({ invite }: { invite?: string }) {
  const cloud = useCloud();
  return (
    <main className="page">
      <Tutorial id="friends" />
      <TopBar title={T.friendsPage.title} />
      {!cloudEnabled ? (
        <p className="muted center">{T.friendsPage.unavailable}</p>
      ) : !cloud.ready ? (
        <p className="muted center">{T.common.loading}</p>
      ) : !cloud.user ? (
        <>
          <p className="small center">
            {invite ? T.friendsPage.signInInvite : T.friendsPage.signIn}
          </p>
          <Account />
        </>
      ) : (
        <FriendsHome invite={invite?.toUpperCase()} />
      )}
    </main>
  );
}

function FriendsHome({ invite }: { invite?: string }) {
  const [profile, setProfile] = useState<MyProfile | null>(null);
  const [friends, setFriends] = useState<Friend[] | null>(null);
  const [code, setCode] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = async () => {
    try {
      const [p, f] = await Promise.all([loadMyProfile(), listFriends()]);
      setProfile(p);
      setFriends(f);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  };
  useEffect(() => {
    reload();
  }, []);

  const add = async (c: string) => {
    setMsg(null);
    try {
      const pseudo = await addFriend(c);
      toast(T.friendsPage.added(pseudo));
      setCode('');
      if (invite) location.hash = '#/friends';
      await reload();
    } catch (e) {
      setMsg(`✕ ${(e as Error).message}`);
    }
  };

  const share = async () => {
    if (!profile) return;
    const url = inviteLink(profile.friendCode);
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Rank It All', text: T.friendsPage.shareText, url });
      } catch {
        // Partage annulé.
      }
      return;
    }
    copy();
  };

  const copy = async () => {
    if (!profile) return;
    try {
      await navigator.clipboard.writeText(inviteLink(profile.friendCode));
      toast(T.friendsPage.copied);
    } catch {
      toast(T.friendsPage.yourLink(inviteLink(profile.friendCode)));
    }
  };

  const regenerate = async () => {
    if (!confirm(T.friendsPage.confirmNewCode)) return;
    try {
      const friendCode = await newFriendCode();
      setProfile((p) => p && { ...p, friendCode });
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const toggle = async (patch: { shareWishlist?: boolean; shareRanking?: boolean }) => {
    if (!profile) return;
    setProfile({ ...profile, ...patch });
    try {
      await setSharing(patch);
    } catch (e) {
      setError((e as Error).message);
      await reload();
    }
  };

  const remove = async (f: Friend) => {
    if (!confirm(T.friendsPage.confirmRemove(f.pseudo))) return;
    try {
      await removeFriend(f.id);
      await reload();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const alreadyFriend = !!invite && !!friends?.some((f) => f.code === invite);

  return (
    <>
      {error && <p className="small error">✕ {error}</p>}
      {invite && profile && <Invitation code={invite} own={profile.friendCode === invite} onAdd={() => add(invite)} done={alreadyFriend} />}

      <section className="card">
        <h3>{T.friendsPage.invite}</h3>
        <p className="muted small">{T.friendsPage.inviteText}</p>
        {profile ? (
          <>
            <p className="friend-code" title={T.friendsPage.yourCode}>
              {profile.friendCode}
            </p>
            <div className="row center">
              {'share' in navigator && (
                <button className="btn primary" onClick={share} title={T.friendsPage.shareTip}>
                  {T.friendsPage.share}
                </button>
              )}
              <button className={`btn ${'share' in navigator ? '' : 'primary'}`} onClick={copy} title={T.friendsPage.copyTip}>
                {T.friendsPage.copy}
              </button>
              <button className="btn small" onClick={regenerate} title={T.friendsPage.newCodeTip}>
                {T.friendsPage.newCode}
              </button>
            </div>
          </>
        ) : (
          <p className="muted small">…</p>
        )}
      </section>

      <section className="card">
        <h3>{T.friendsPage.addWithCode}</h3>
        <form
          className="row"
          onSubmit={(e) => {
            e.preventDefault();
            add(code);
          }}
        >
          <input
            className="input code-input"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^0-9A-F]/g, '').slice(0, 8))}
            placeholder={T.friendsPage.codePlaceholder}
            autoCapitalize="characters"
            autoComplete="off"
          />
          <button className="btn primary" type="submit" disabled={code.length !== 8}>
            {T.friendsPage.add}
          </button>
        </form>
        {msg && <p className="small">{msg}</p>}
      </section>

      <section className="card">
        <h3>{T.friendsPage.myFriends(friends?.length ?? 0)}</h3>
        {!friends ? (
          <p className="muted small">…</p>
        ) : !friends.length ? (
          <p className="muted small">{T.friendsPage.none}</p>
        ) : (
          <ul className="friend-list">
            {friends.map((f) => (
              <li key={f.id} className="friend-item">
                <div className="friend-name">
                  <strong>{f.pseudo}</strong>
                  <span className="muted tiny">{sharedLabel(f)}</span>
                </div>
                <a className="btn small primary" href={`#/duo/${f.id}`} title={T.friendsPage.duoTip(f.pseudo)}>
                  {T.friendsPage.duo}
                </a>
                <button className="btn small" onClick={() => remove(f)} title={T.friendsPage.removeTip(f.pseudo)} aria-label={T.friendsPage.removeAria(f.pseudo)}>
                  ✕
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card">
        <h3>{T.friendsPage.whatTheySee}</h3>
        <p className="muted small">{T.friendsPage.readOnly}</p>
        {profile && (
          <div className="chips">
            <button className={`chip ${profile.shareWishlist ? 'active' : ''}`} onClick={() => toggle({ shareWishlist: !profile.shareWishlist })} title={T.friendsPage.shareWishTip}>
              {T.friendsPage.shareWish}
            </button>
            <button className={`chip ${profile.shareRanking ? 'active' : ''}`} onClick={() => toggle({ shareRanking: !profile.shareRanking })} title={T.friendsPage.shareRankTip}>
              {T.friendsPage.shareRank}
            </button>
          </div>
        )}
      </section>
    </>
  );
}

function sharedLabel(f: Friend): string {
  const parts = [f.shareWishlist && T.friendsPage.sharesWish, f.shareRanking && T.friendsPage.sharesRank].filter(Boolean);
  return parts.length ? T.friendsPage.shares(parts.join(', ')) : T.friendsPage.sharesNothing;
}

function Invitation({ code, own, onAdd, done }: { code: string; own: boolean; onAdd: () => void; done: boolean }) {
  const [pseudo, setPseudo] = useState<string | null | undefined>(undefined);
  useEffect(() => {
    if (own) return;
    findByCode(code)
      .then(setPseudo)
      .catch(() => setPseudo(null));
  }, [code, own]);

  return (
    <section className="card invitation">
      <h3>{T.friendsPage.invitation}</h3>
      {own ? (
        <p className="small">{T.friendsPage.ownLink}</p>
      ) : pseudo === undefined ? (
        <p className="muted small">…</p>
      ) : pseudo === null ? (
        <p className="small">{T.friendsPage.deadLink}</p>
      ) : done ? (
        <p className="small">{T.friendsPage.already(pseudo)}</p>
      ) : (
        <>
          <p className="small">
            <strong>{pseudo}</strong> {T.friendsPage.invites}
          </p>
          <button className="btn primary" onClick={onAdd}>
            {T.friendsPage.addFriend(pseudo)}
          </button>
        </>
      )}
    </section>
  );
}
