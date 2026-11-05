// The reel's timeline: the hook (the problem), the turn (the solution) and the demo in action, cut to the track.
// Every frame comes from the music grid (src/reel/music.ts, written by track.py grid from audio/music/edit.json):
// 128 BPM, a bar is 112.5 f at 60 fps, bar 1 at f15. Keep this file free of React: scripts may load it.
import { bar, MUSIC } from './music';
import { TOTAL as DEMO_TOTAL, CUE as DEMO_CUE } from '../demo/script';

export const FPS = 60;
export const W = 1920;
export const H = 1080;

/** The fractional film frame of a grid position (bar 1-based, beat 0-3, sixteenth 0-3), and its whole frame. */
export const bx = (n: number, beat = 0, sub = 0) => bar(n, beat, sub, { fps: FPS, bpm: MUSIC?.bpm ?? 128 });
export const b = (n: number, beat = 0, sub = 0) => Math.round(bx(n, beat, sub));

/**
 * The demo plays from the downbeat of bar 9 (two bars after the drop) and its end card's landing (the paid check
 * becoming the C mark's dot, demo CUE.endLand) lands on the downbeat of bar 26, where the track re-enters after its
 * break. Seventeen bars hold 31.9 s; the demo's own 33.25 s to the landing play 4 % faster to fill them exactly.
 */
export const DEMO_FROM = bx(9);
const DEMO_LAND = bx(26);
export const DEMO_RATE = DEMO_CUE.endLand / (DEMO_LAND - DEMO_FROM); // 1.043: demo frames per film frame
/** The demo's frame at a film frame (fractional: the demo is a pure function of its frame), held on its last. */
export const demoFrame = (f: number) => Math.min(DEMO_TOTAL - 1, Math.max(0, (f - DEMO_FROM) * DEMO_RATE));
/** The film frame of a demo frame. */
export const filmOfDemo = (d: number) => DEMO_FROM + d / DEMO_RATE;

/**
 * The whole reel. The music ends on one hit as the logo pops (bar 26, track.py edit --end hit) and the logo impact
 * rings under the lockup: the reel closes on the half bar after bar 27's downbeat, fading out over its last 0.6 s with
 * the ring (the demo's own last second, its end card held still, is not played).
 */
export const TOTAL = Math.min(Math.ceil(filmOfDemo(DEMO_TOTAL)), b(27, 2));
/** The reel's own fade to black, on its last frames. */
export const FADE_OUT = 36;
export { DEMO_TOTAL };

// ---- the hook: four lines, one place, then the turn on the drop ----------------------------------------------
// bars 1-6 sit on the track's intro (quiet, the kick building), bar 7 is the track's entry: the turn.
export const CUE = {
  villa: 0, // the villa at dusk, already pushing in slowly
  lineA: b(1, 1), // "You got the villa with the pool." blurs in on beat 2 of bar 1 (0.72 s)
  lineAOut: b(2, 3), // ...and blurs out as the villa starts to defocus
  defocus: b(2, 2), // the villa goes soft: the place stays, the question takes the frame
  lineB: b(3), // "Your desk is" builds in, centred...
  lineB2: b(3, 2), // ..."the dining table." lands under it, bigger; the pair re-centres
  lineBOut: b(4, 2, 2), // the pair drops away, gone before the tiles come
  tiles: b(5), // the catalog's desk, chair, screen and lamp come forward out of the blur
  lineC: b(5, 1), // "Nobody's buying a desk" rises in among them
  lineC2: b(5, 2, 2), // "for two weeks." answers under it
  lineCOut: b(6, 1, 2),
  gather: b(6, 2), // the tiles converge on the centre, into one card: the full setup...
  stop: b(6, 3, 2), // ...a stop-down of an 8th before the drop
  drop: b(7), // the track's entry: the card opens to the full frame
  lineD: b(7, 0, 2), // "So rent it by the week." lands on the photo
  lineDOut: b(8, 3),
  seam: b(9) - 18, // the setup defocuses into the demo's world (both sides unreadable inside the blur)
  demo: Math.round(DEMO_FROM), // the demo's Async wordmark opens on the downbeat of bar 9
};

export const LINES = {
  a: 'You got the villa with the pool.',
  b1: 'Your desk is',
  b2: 'the dining table.',
  c1: "Nobody's buying a desk",
  c2: 'for two weeks.',
  d1: 'So rent it ',
  d2: 'by the week.',
  /** the demo's opening line, said the reel's way: the Async wordmark, then "Just ask [spark] Claude." */
  promise: 'Just ask',
  partner: 'Claude.',
};

/** Catalog photos (apps/storefront/public/products), the products Async rents in Bali. */
export const TILES = [
  { src: 'async/products/smartdesk-pro-1.jpg', x: -660, y: -300, z: 0, s: 0.96 },
  { src: 'async/products/ergonomic-task-chair-1.jpg', x: 680, y: -270, z: 1, s: 0.92 },
  { src: 'async/products/ultrasharp-27-4k-1.jpg', x: -700, y: 300, z: 2, s: 0.86 },
  { src: 'async/products/arc-floor-lamp-1.jpg', x: 690, y: 320, z: 1, s: 0.88 },
  { src: 'async/products/low-profile-keyboard-1.jpg', x: -60, y: -400, z: 3, s: 0.62 },
  { src: 'async/products/mx-master-3s-1.jpg', x: 70, y: 410, z: 3, s: 0.58 },
] as const;
