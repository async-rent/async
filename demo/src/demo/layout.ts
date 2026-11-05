// Where everything sits. The browser window is laid out in web px (a 1280 x 760 window) and placed on the stage at
// K = 1.3 (1664 x 988 in a 1920 x 1080 frame); the camera then scales the stage. Chat blocks are placed at fixed
// positions in the scroll column, so the camera, the scroll and the end card's flight all read the same numbers.
import { W, H } from './script';

export const WIN = { w: 1280, h: 760 };
export const K = 1.3;
export const WIN_X = (W - WIN.w * K) / 2; // 128
export const WIN_Y = (H - WIN.h * K) / 2; // 46

export const CHROME = 80; // tab strip 36 + toolbar 44
export const PAGE_H = WIN.h - CHROME; // 680
export const SIDE_W = 232;
export const MAIN_W = WIN.w - SIDE_W; // 1048
export const COL_W = 720;
export const COL_X = SIDE_W + (MAIN_W - COL_W) / 2; // 396, in page coords (= window coords in x)
export const HEAD_H = 48;
export const SCROLL_TOP = HEAD_H; // the chat's scroll viewport, page coords
export const SCROLL_BOTTOM = 584;
export const VIEW_H = SCROLL_BOTTOM - SCROLL_TOP; // 536

/** The new-chat page: the greeting and the centred composer. */
export const NEW = { greetY: 232, box: { x: SIDE_W + (MAIN_W - 680) / 2, y: 290, w: 680, h: 104 } };
/** The chat page: the reply box at the bottom. */
export const REPLY = { x: COL_X - 8, y: 596, w: COL_W + 16, h: 48 };

/** Chat blocks: top y in the scroll column and height (web px). */
export const B = {
  user: { y: 24, h: 66 },
  sayA: { y: 116, h: 28 },
  tool1: { y: 158, h: 34 },
  tool2: { y: 200, h: 34 },
  sayB: { y: 252, h: 56 },
  app1: { y: 326, h: 484 },
  appMsg: { y: 834, h: 66 },
  tool3: { y: 922, h: 34 },
  tool4: { y: 964, h: 34 },
  sayC: { y: 1016, h: 56 },
  app2: { y: 1090, h: 352 },
  tool5: { y: 1466, h: 34 },
  sayD: { y: 1518, h: 84 },
  actions: { y: 1608, h: 22 },
};

/** Scroll offsets the chat settles at (the newest block in view, 20 px under it). */
export const SCROLL = {
  top: 0,
  app1: B.app1.y + B.app1.h - VIEW_H + 20,
  sayC: B.sayC.y + B.sayC.h - VIEW_H + 20,
  app2: B.app2.y + B.app2.h - VIEW_H + 20,
  end: B.actions.y + B.actions.h - VIEW_H + 20,
};

/** A scroll-column point to window coords at scroll S. */
export const colToWin = (x: number, y: number, S: number) => ({ x: COL_X + x, y: CHROME + SCROLL_TOP + y - S });
/** A window point to stage (film at camera 1) coords. */
export const winToStage = (p: { x: number; y: number }) => ({ x: WIN_X + p.x * K, y: WIN_Y + p.y * K });

// ---- inside the Async apps (local px) ----
export const PICK_UI = {
  pad: 18,
  cardsY: 80,
  cardW: 220,
  cardH: 240,
  gap: 12,
  imgH: 128,
  addY: 358,
  addH: 56,
  rowY: 430,
  rowH: 38,
  btnW: 128,
};
export const PAY_UI = {
  pad: 20,
  colR: 400, // the summary card's x
  cardY: 74,
  cardW: 300,
  cardH: 254,
  btnY: 166, // the PayPal button inside the card (card-local)
  btnH: 44,
  /** the paid check's centre, card-local */
  check: { x: 16 + 12 + 13, y: 166 + 22 },
  checkSize: 26,
};
