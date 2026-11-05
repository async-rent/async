// What the screen is doing at a frame: the typed prompt, the page morph, the chat's scroll, the cursor. Pure
// functions of the frame, shared by the picture (ClaudeApp) and the camera.
import { cursorArc, pressAt } from '../fx/Cursor';
import { B, colToWin, PAY_UI, PICK_UI, REPLY, SCROLL } from './layout';
import { E, keyed, prog, typedCount, typingTimes, type Ease, type Key } from './motion';
import { CUE, PROMPT, t } from './script';

export const TYPE_TIMES = typingTimes(PROMPT, CUE.typeEnd - CUE.typeStart, 'cozy-bali');

export const typed = (frame: number) => {
  const n = typedCount(TYPE_TIMES, frame - CUE.typeStart);
  const lastKey = n > 0 ? CUE.typeStart + TYPE_TIMES[n - 1] : CUE.macro;
  return { n, text: PROMPT.slice(0, n), lastKey };
};
/** Typed characters as a continuous number (for a camera that glides along the caret instead of stepping). */
export const typedSmooth = (frame: number) => {
  const f = frame - CUE.typeStart;
  if (f <= 0) return 0;
  const n = typedCount(TYPE_TIMES, f);
  if (n >= TYPE_TIMES.length) return n;
  const a = n > 0 ? TYPE_TIMES[n - 1] : 0;
  const b = TYPE_TIMES[n];
  return n + (f - a) / Math.max(1e-6, b - a);
};

// ---- the chat's scroll: the newest block kept in view ----
const s = (f: number, v: number, ease: Ease = E.settleOut): Key => ({ f, v, ease });
const SCROLL_KEYS: Key[] = [
  s(CUE.app1, SCROLL.top),
  s(CUE.app1 + t(0.95), SCROLL.app1, E.strongInOut),
  s(CUE.appMsg, SCROLL.app1),
  s(CUE.appMsg + t(0.5), B.appMsg.y + B.appMsg.h - 516),
  s(CUE.tool3 + t(0.35), B.tool3.y + B.tool3.h - 516),
  s(CUE.tool4 + t(0.35), B.tool4.y + B.tool4.h - 516),
  s(CUE.sayC + t(1.0), SCROLL.sayC),
  s(CUE.app2, SCROLL.sayC),
  s(CUE.app2 + t(0.95), SCROLL.app2, E.strongInOut),
  // after the payment the scroll rides the camera's pull-back as one move (its frames and curve, camera.ts), then
  // follows the reply from rest to rest: no move starts at speed while another is under way
  s(CUE.paid + t(0.8), SCROLL.app2),
  s(CUE.tool5 + t(0.9), B.tool5.y + B.tool5.h - 516, E.strongInOut),
  s(CUE.sayD + t(1.6), B.sayD.y + 52 - 516, E.stdInOut),
  s(CUE.sayDEnd + t(0.4), SCROLL.end, E.stdInOut),
];
export const scrollAt = (frame: number) => keyed(frame, SCROLL_KEYS);

// ---- the cursor (window web px) ----
export type Pt = { x: number; y: number };
export const SEND_BTN: Pt = { x: 1068, y: 446 };
const card1 = (S: number) => colToWin(PICK_UI.pad + PICK_UI.cardW / 2, B.app1.y + PICK_UI.cardsY + 116, S);
const chip = (i: number, S: number) => colToWin(PICK_UI.pad + i * (PICK_UI.cardW + PICK_UI.gap) + PICK_UI.cardW / 2 + 20, B.app1.y + PICK_UI.addY + PICK_UI.addH / 2, S);
const cont = (S: number) => colToWin(720 - PICK_UI.pad - PICK_UI.btnW / 2 + 8, B.app1.y + PICK_UI.rowY + PICK_UI.rowH / 2, S);
export const payBtn = (S: number) => colToWin(PAY_UI.colR + PAY_UI.cardW / 2 + 10, B.app2.y + PAY_UI.cardY + PAY_UI.btnY + PAY_UI.btnH / 2, S);

type Move = { from: Pt; to: Pt; a: number; b: number; bow?: number };
type Seg = { on: number; off: number; moves: Move[]; presses: number[]; hand: [number, number][] };

const SEGS: Seg[] = [
  {
    on: CUE.cursorIn,
    off: CUE.send + t(0.35),
    moves: [{ from: { x: 1210, y: 660 }, to: SEND_BTN, a: CUE.cursorIn, b: CUE.send - t(0.12), bow: 0.18 }],
    presses: [CUE.send],
    hand: [[CUE.send - t(0.2), CUE.send + t(0.35)]],
  },
  {
    on: CUE.pickSetup - t(0.85),
    off: CUE.continue + t(0.4),
    moves: [
      { from: { x: 930, y: 640 }, to: card1(SCROLL.app1), a: CUE.pickSetup - t(0.85), b: CUE.pickSetup - t(0.1), bow: 0.16 },
      { from: card1(SCROLL.app1), to: chip(0, SCROLL.app1), a: CUE.pickSetup + t(0.3), b: CUE.pickLamp - t(0.1), bow: -0.14 },
      { from: chip(0, SCROLL.app1), to: chip(1, SCROLL.app1), a: CUE.pickLamp + t(0.25), b: CUE.pickMouse - t(0.1), bow: 0.12 },
      { from: chip(1, SCROLL.app1), to: cont(SCROLL.app1), a: CUE.pickMouse + t(0.3), b: CUE.continue - t(0.12), bow: -0.16 },
    ],
    presses: [CUE.pickSetup, CUE.pickLamp, CUE.pickMouse, CUE.continue],
    hand: [
      [CUE.pickSetup - t(0.25), CUE.pickSetup + t(0.32)],
      [CUE.pickLamp - t(0.22), CUE.pickLamp + t(0.27)],
      [CUE.pickMouse - t(0.22), CUE.pickMouse + t(0.32)],
      [CUE.continue - t(0.3), CUE.continue + t(0.4)],
    ],
  },
  {
    on: CUE.pay - t(1.2),
    off: CUE.paid + t(0.45),
    moves: [{ from: { x: 1130, y: 690 }, to: payBtn(SCROLL.app2), a: CUE.pay - t(1.2), b: CUE.pay - t(0.15), bow: 0.15 }],
    presses: [CUE.pay],
    hand: [[CUE.pay - t(0.3), CUE.paid + t(0.45)]],
  },
];

export const cursorAt = (frame: number) => {
  const seg = SEGS.find((g) => frame >= g.on - 2 && frame <= g.off + t(0.3));
  if (!seg) return null;
  let p: Pt = seg.moves[0].from;
  for (const m of seg.moves) {
    if (frame < m.a) break;
    p = cursorArc(m.from, m.to, prog(frame, m.a, m.b, E.stdInOut), m.bow ?? 0.15);
  }
  const press = Math.max(0, ...seg.presses.map((at) => pressAt(frame, at)));
  const hand = seg.hand.some(([a, b]) => frame >= a && frame < b);
  const opacity = prog(frame, seg.on, seg.on + t(0.2), E.softOut) * (1 - prog(frame, seg.off, seg.off + t(0.25), E.softIn));
  return { ...p, press, hand, opacity };
};

/** The agent's turns: the spark works between these, and the reply box shows its stop square. */
export const TURNS: [number, number][] = [
  [CUE.chat + t(0.4), CUE.app1 + t(0.3)],
  [CUE.appMsg + t(0.3), CUE.app2 + t(0.3)],
  [CUE.paid + t(0.6), CUE.sayDEnd],
];
export const working = (frame: number) => TURNS.some(([a, b]) => frame >= a && frame < b);
export { REPLY };
