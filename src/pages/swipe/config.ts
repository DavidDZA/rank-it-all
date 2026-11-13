import type { Status, Tier } from '../../lib/db';
import type { Dir, Tone } from '../../components/SwipeCard';
import { T } from '../../i18n';

/** Mode 2 directions : vu / pas vu, puis « aimé ou bof ? » (vu) ou « envie ? » (pas vu). */
export type Phase = 'seen' | 'wish' | 'rate';

interface PhaseText {
  question: string;
  left: string;
  right: string;
  leftBtn: string;
  rightBtn: string;
  leftCap: string;
  rightCap: string;
  leftTip: string;
  rightTip: string;
}

/** Textes de chaque question (dans la langue de l'interface). */
export const PHASES: Record<Phase, PhaseText> = T.swipe.phases;

export const TONES: Record<Phase, { left: Tone; right: Tone }> = {
  seen: { left: 'no', right: 'yes' },
  wish: { left: 'no', right: 'wish' },
  rate: { left: 'meh', right: 'yes' },
};

export type Corner = 'ul' | 'ur' | 'dl' | 'dr';

/** Mode 4 coins : haut = positif. Les boutons reprennent la même disposition. Textes : T.swipe.corners. */
const CORNER_RULES: Record<Corner, { status: Status; tier?: Tier; tone: Tone; icon: string; key: string }> = {
  ul: { status: 'wish', tone: 'wish', icon: '💖', key: '7' },
  ur: { status: 'seen', tier: 'good', tone: 'yes', icon: '👍', key: '9' },
  dl: { status: 'unseen', tone: 'no', icon: '💤', key: '1' },
  dr: { status: 'seen', tier: 'meh', tone: 'meh', icon: '😐', key: '3' },
};

export const CORNERS: Record<Corner, { status: Status; tier?: Tier; text: string; tone: Tone; icon: string; caption: string; tip: string; key: string }> = Object.fromEntries(
  (Object.keys(CORNER_RULES) as Corner[]).map((c) => [c, { ...CORNER_RULES[c], ...T.swipe.corners[c] }]),
) as Record<Corner, { status: Status; tier?: Tier; text: string; tone: Tone; icon: string; caption: string; tip: string; key: string }>;

export const isCorner = (d: Dir): d is Corner => d in CORNERS;

export const ARROWS: Record<Corner, string> = { ul: '↖', ur: '↗', dl: '↙', dr: '↘' };
