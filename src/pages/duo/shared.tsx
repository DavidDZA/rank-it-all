import type { Title } from '../../lib/db';
import { T } from '../../i18n';
import type { Category } from '../../lib/category';
import type { Friend, FriendData } from '../../lib/friends';
import type { Side } from '../../lib/together';

/** Données des deux côtés, chargées par la page « À deux ». */
export interface Loaded {
  friend: Friend;
  me: Side;
  them: FriendData;
  titles: Map<string, Title>;
  /** Catégorie d'une clé, d'après les titres connus. */
  catOf: (key: string) => Category | undefined;
}

export const nth = (n: number | undefined) => (n ? T.duo.nth(n) : T.duo.notPrioritized);

export function NeedsSharing({ pseudo, what }: { pseudo: string; what: string }) {
  return <p className="muted center small">{T.duo.notShared(pseudo, what)}</p>;
}
