// The camera: one scale and one focus point (window web px) per frame. Each move has a job: it rides the caret
// while the prompt is typed, opens onto the page, follows the chat, closes on the Async app the user works in,
// pushes onto the PayPal button, and pulls back to the whole conversation. Zooms run in log space.
import { FONT } from '../brand/tokens';
import { B, COL_X, NEW, PAY_UI, SCROLL, WIN } from './layout';
import { E, keyed, lmix, mix, prog, XP, type Ease, type Key } from './motion';
import { CUE, PROMPT, t } from './script';
import { typedSmooth } from './story';

export type Cam = { s: number; x: number; y: number };
const CENTER = { x: WIN.w / 2, y: WIN.h / 2 };

// ---- the caret, for the macro shot ----
let ctx: CanvasRenderingContext2D | null = null;
const widths = new Map<number, number>();
const prefixWidth = (n: number) => {
  if (widths.has(n)) return widths.get(n)!;
  if (!ctx && typeof document !== 'undefined') ctx = document.createElement('canvas').getContext('2d');
  let w = n * 7.3;
  if (ctx) {
    ctx.font = `400 15px ${FONT.claudeUi}`;
    w = ctx.measureText(PROMPT.slice(0, n)).width;
  }
  widths.set(n, w);
  return w;
};
const caretX = (frame: number) => {
  const c = typedSmooth(frame);
  const n = Math.floor(c);
  return NEW.box.x + 18 + mix(prefixWidth(n), prefixWidth(Math.min(PROMPT.length, n + 1)), c - n);
};
/** Where the macro shot looks: just ahead of the caret, smoothed over the last 0.25 s so it glides. */
const follow = (frame: number) => {
  let sum = 0;
  let k = 0;
  for (let d = 0; d <= 15; d += 3) {
    sum += caretX(frame - d);
    k++;
  }
  const textY = 80 + NEW.box.y + 27;
  return { x: Math.max(NEW.box.x + 150, sum / k - 40), y: textY };
};

// ---- the chat's framings ----
const chatF = { x: 744, y: 410 };
const pickF = { x: COL_X + 360, y: 80 + 48 + B.app1.y + B.app1.h / 2 - SCROLL.app1 + 4 };
const payF = { x: COL_X + 360, y: 80 + 48 + B.app2.y + B.app2.h / 2 - SCROLL.app2 };
const btnF = { x: COL_X + PAY_UI.colR + PAY_UI.cardW / 2 - 40, y: 80 + 48 + B.app2.y + PAY_UI.cardY + PAY_UI.cardH / 2 - 12 - SCROLL.app2 };

const k = (f: number, v: number, ease: Ease = XP.travel): Key => ({ f, v, ease });
// scale keys, and the focus keys that ride with them (the same frames, so each move is one move)
const SK: Key[] = [
  k(CUE.pullBack, 3.0),
  k(CUE.pullBack + t(1.7), 1.0),
  k(CUE.cursorIn, 1.0),
  k(CUE.send - t(0.05), 1.1, E.settleOut),
  k(CUE.chat + t(0.15), 1.1),
  k(CUE.chat + t(1.2), 1.3, E.strongInOut),
  k(CUE.app1 - t(0.1), 1.3),
  k(CUE.app1 + t(1.1), 1.62, E.strongInOut),
  k(CUE.continue + t(0.15), 1.68, E.softOut),
  k(CUE.appMsg + t(0.8), 1.3, E.strongInOut),
  k(CUE.app2 - t(0.1), 1.3),
  k(CUE.app2 + t(1.0), 1.64, E.strongInOut),
  k(CUE.pay - t(1.3), 1.64),
  k(CUE.pay - t(0.15), 2.15, E.strongInOut),
  k(CUE.paid + t(0.8), 2.2, E.softOut),
  k(CUE.tool5 + t(0.9), 1.3, E.strongInOut),
  k(CUE.sayDEnd - t(0.4), 1.3),
  k(CUE.sayDEnd + t(1.2), 1.0, E.strongInOut),
];
const fx = (pick: (p: { x: number; y: number }) => number): Key[] => [
  k(CUE.pullBack + t(1.7), pick(CENTER)),
  k(CUE.cursorIn, pick(CENTER)),
  k(CUE.send - t(0.05), pick({ x: 640, y: 412 }), E.settleOut),
  k(CUE.chat + t(0.15), pick({ x: 640, y: 412 })),
  k(CUE.chat + t(1.2), pick(chatF), E.strongInOut),
  k(CUE.app1 - t(0.1), pick(chatF)),
  k(CUE.app1 + t(1.1), pick(pickF), E.strongInOut),
  k(CUE.continue + t(0.15), pick(pickF)),
  k(CUE.appMsg + t(0.8), pick(chatF), E.strongInOut),
  k(CUE.app2 - t(0.1), pick(chatF)),
  k(CUE.app2 + t(1.0), pick(payF), E.strongInOut),
  k(CUE.pay - t(1.3), pick(payF)),
  k(CUE.pay - t(0.15), pick(btnF), E.strongInOut),
  k(CUE.paid + t(0.8), pick(btnF)),
  k(CUE.tool5 + t(0.9), pick(chatF), E.strongInOut),
  k(CUE.sayDEnd - t(0.4), pick(chatF)),
  k(CUE.sayDEnd + t(1.2), pick(CENTER), E.strongInOut),
];
const XK = fx((p) => p.x);
const YK = fx((p) => p.y);

export const camAt = (frame: number): Cam => {
  if (frame < CUE.pullBack) {
    // the macro shot: on the composer's text, a slow push as the prompt types
    const s = lmix(2.85, 3.0, prog(frame, CUE.macro, CUE.pullBack, E.softOut));
    const p = follow(frame);
    return { s, x: p.x, y: p.y };
  }
  if (frame < CUE.pullBack + t(1.7)) {
    // opening onto the page: the zoom in log space, the focus leaving the caret for the window's centre on the same curve
    const p = prog(frame, CUE.pullBack, CUE.pullBack + t(1.7), XP.travel);
    const f = follow(frame);
    return { s: lmix(3.0, 1.0, p), x: mix(f.x, CENTER.x, p), y: mix(f.y, CENTER.y, p) };
  }
  return { s: keyed(frame, SK, true), x: keyed(frame, XK), y: keyed(frame, YK) };
};
