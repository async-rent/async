import React from 'react';
import { AbsoluteFill, Img, staticFile } from 'remotion';
import { AS, C, FONT } from '../brand/tokens';
import { clamp01, E, lmix, mix, prog } from '../demo/motion';
import { CUE, H, LINES, TILES, W } from './timeline';

// The hook: the villa at dusk (the storefront's own Bali hero), four lines on it, the catalog's products coming out
// of its blur, converging into the full setup, which opens to the frame on the track's entry and defocuses into the
// demo's world. One ground (the villa, regraded to the demo's blue hour), one face (Josefin Sans, the storefront's heading face), one accent (the signal).

const TEXT = AS.text;
const SOFT = C.mist;
/** The reel's one face: Josefin Sans (FONT.asyncHead), set at the reel's smaller sizes (px at 1080p). */
export const REEL_FONT = FONT.asyncHead;
const SIZE = { a: 80, b1: 68, b2: 128, c: 76, d: 88 };

/** The villa: one slow push from the first frame, landing by the drop; it goes soft at fixed blur levels. */
const Villa: React.FC<{ frame: number }> = ({ frame }) => {
  const s = lmix(1.12, 1.015, prog(frame, CUE.villa, CUE.drop, E.softOut));
  const soft = prog(frame, CUE.defocus, CUE.defocus + 30, E.settleOut);
  const blur = prog(frame, CUE.defocus + 18, CUE.defocus + 66, E.settleOut);
  const dim = mix(0.8, 0.52, prog(frame, CUE.defocus, CUE.defocus + 66, E.settleOut));
  // the light lives: the sky slowly cools as the question takes over
  const img = (src: string, opacity: number) => (
    <Img
      src={staticFile(src)}
      style={{ position: 'absolute', left: -96, top: -54, width: W + 192, height: H + 108, objectFit: 'cover', opacity }}
    />
  );
  return (
    <AbsoluteFill style={{ background: C.ink }}>
      <AbsoluteFill style={{ transform: `scale(${s.toFixed(5)})`, filter: `brightness(${dim.toFixed(4)})` }}>
        {img('async/reel/villa.jpg', 1)}
        {img('async/reel/villa-soft.jpg', soft)}
        {img('async/reel/villa-blur.jpg', blur)}
      </AbsoluteFill>
      {/* a centre shade for the lines (no halo on the type): the frame's middle band sits at 3:1 or better */}
      <AbsoluteFill style={{ background: 'radial-gradient(ellipse 62% 46% at 50% 50%, rgba(9,9,11,0.5), rgba(9,9,11,0.18) 70%, rgba(9,9,11,0.32))' }} />
    </AbsoluteFill>
  );
};

const lineStyle = (size: number, weight: number, color = TEXT, track = -0.01): React.CSSProperties => ({
  fontFamily: REEL_FONT,
  fontSize: size,
  fontWeight: weight,
  letterSpacing: `${track}em`,
  lineHeight: 1.08,
  color,
  whiteSpace: 'pre',
  fontFeatureSettings: '"kern" 1, "liga" 1, "calt" 1',
});

/** A: blur-in, whole. Out: blur and a small push. */
const LineA: React.FC<{ frame: number }> = ({ frame }) => {
  if (frame < CUE.lineA - 2 || frame > CUE.lineAOut + 30) return null;
  const p = prog(frame, CUE.lineA, CUE.lineA + 34, E.glideOut);
  const o = prog(frame, CUE.lineAOut, CUE.lineAOut + 24, E.buildIn);
  return (
    <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center' }}>
      <div
        style={{
          ...lineStyle(SIZE.a, 600),
          opacity: p * (1 - o),
          filter: `blur(${(14 * (1 - p) + 18 * o).toFixed(2)}px)`,
          transform: `scale(${(lmix(1.05, 1, p) * lmix(1, 1.06, o)).toFixed(5)})`,
        }}
      >
        {LINES.a}
      </div>
    </AbsoluteFill>
  );
};

/** B, the type event: a build that re-centres. "Your desk is" arrives centred; "the dining table." lands under it,
 * bigger, and the pair re-centres on the frame's middle. Out: both drop away. */
const LineB: React.FC<{ frame: number }> = ({ frame }) => {
  if (frame < CUE.lineB - 2 || frame > CUE.lineBOut + 30) return null;
  const a = prog(frame, CUE.lineB, CUE.lineB + 28, E.snapOut);
  const b2 = prog(frame, CUE.lineB2, CUE.lineB2 + 32, E.snapOut);
  const make = prog(frame, CUE.lineB2 - 2, CUE.lineB2 + 22, E.jump);
  const o = prog(frame, CUE.lineBOut, CUE.lineBOut + 26, E.buildIn);
  const creep = lmix(1, 1.03, prog(frame, CUE.lineB2, CUE.lineBOut, E.softOut));
  const dropY = 120 * o;
  return (
    <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', transform: `scale(${creep.toFixed(5)})` }}>
      {/* "Your desk is": centred alone, then lifted to make room */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: 0,
          textAlign: 'center',
          ...lineStyle(SIZE.b1, 500, SOFT, 0),
          opacity: a * (1 - o),
          filter: `blur(${(10 * (1 - a) + 14 * o).toFixed(2)}px)`,
          transform: `translateY(${(mix(H / 2 - 37, H / 2 - 128, make) + (1 - a) * 28 + dropY).toFixed(2)}px)`,
        }}
      >
        {LINES.b1}
      </div>
      {/* "the dining table.": the claim, bigger, rising into its slot */}
      <div style={{ position: 'absolute', left: 0, right: 0, top: H / 2 - 44, height: 150, overflow: 'hidden' }}>
        <div
          style={{
            textAlign: 'center',
            ...lineStyle(SIZE.b2, 700, TEXT, -0.02),
            opacity: b2 * (1 - o),
            filter: `blur(${(14 * o).toFixed(2)}px)`,
            transform: `translateY(${((1 - b2) * 150 + dropY).toFixed(2)}px)`,
          }}
        >
          {LINES.b2}
        </div>
      </div>
    </AbsoluteFill>
  );
};

/** C: two chunks rising out of masks, among the tiles; out with the gather. */
const LineC: React.FC<{ frame: number }> = ({ frame }) => {
  if (frame < CUE.lineC - 2 || frame > CUE.lineCOut + 30) return null;
  const c1 = prog(frame, CUE.lineC, CUE.lineC + 30, E.snapOut);
  const c2 = prog(frame, CUE.lineC2, CUE.lineC2 + 30, E.snapOut);
  const o = prog(frame, CUE.lineCOut, CUE.lineCOut + 24, E.buildIn);
  const row = (text: string, p: number, top: number) => (
    <div style={{ position: 'absolute', left: 0, right: 0, top, height: 92, overflow: 'hidden' }}>
      <div style={{ textAlign: 'center', ...lineStyle(SIZE.c, 600), transform: `translateY(${((1 - p) * 88).toFixed(2)}px)`, opacity: p }}>{text}</div>
    </div>
  );
  return (
    <AbsoluteFill style={{ opacity: 1 - o, filter: `blur(${(16 * o).toFixed(2)}px)`, transform: `scale(${lmix(1, 0.94, o).toFixed(5)})` }}>
      {row(LINES.c1, c1, H / 2 - 90)}
      {row(LINES.c2, c2, H / 2 - 2)}
    </AbsoluteFill>
  );
};

const TILE = 340;
const CARD = { w: 1184, h: 880 }; // setup-full-1.jpg
/** The card's width at the stop: one tile's footprint, in the photo's own shape. */
const CARD_W0 = 360;
/** Full bleed: the card covers the frame (its shape is 4:3, so it overfills the height). */
const CARD_WF = W * 1.04;

/** The catalog's products, out of the blur in depth, each on its storefront tile; they gather into one card. */
const Tiles: React.FC<{ frame: number }> = ({ frame }) => {
  if (frame < CUE.tiles - 2 || frame > CUE.stop + 4) return null;
  const g = prog(frame, CUE.gather, CUE.stop, E.strongInOut);
  // one camera move: a slow dolly in from the tiles' arrival, front-loaded, landing before the gather
  const dolly = lmix(0.9, 1, prog(frame, CUE.tiles, CUE.gather, E.softOut));
  return (
    <AbsoluteFill>
      {TILES.map((t, i) => {
        const a = prog(frame, CUE.tiles + i * 4, CUE.tiles + i * 4 + 40, E.glideOut);
        const depth = 1 - 0.07 * t.z; // farther tiles sit closer in and smaller
        const x = mix(t.x * dolly * depth, 0, g);
        const y = mix(t.y * dolly * depth, 0, g);
        const s = lmix(t.s * lmix(0.78, 1, a), 0.6, g);
        const blur = [0, 1.5, 3.5, 6][t.z] * (1 - g);
        // the far tiles go first; the desk, nearest, is the last to merge into the card
        const fade = 1 - clamp01((g - 0.42 + 0.06 * t.z) / 0.3);
        return (
          <div
            key={t.src}
            style={{
              position: 'absolute',
              left: W / 2 - TILE / 2,
              top: H / 2 - TILE / 2,
              width: TILE,
              height: TILE,
              borderRadius: 28,
              background: AS.tile,
              overflow: 'hidden',
              opacity: a * fade,
              filter: blur > 0.05 ? `blur(${blur.toFixed(2)}px)` : undefined,
              transform: `translate(${x.toFixed(2)}px, ${y.toFixed(2)}px) scale(${s.toFixed(5)})`,
              boxShadow: '0 30px 80px rgba(0,0,0,0.45), 0 8px 22px rgba(0,0,0,0.3)',
            }}
          >
            <Img src={staticFile(t.src)} style={{ position: 'absolute', left: 22, top: 22, width: TILE - 44, height: TILE - 44, objectFit: 'contain' }} />
          </div>
        );
      })}
    </AbsoluteFill>
  );
};

/** The full setup: born at the centre as the tiles meet, it opens to the frame on the drop and defocuses at the seam. */
const Setup: React.FC<{ frame: number }> = ({ frame }) => {
  const born = CUE.stop - 24;
  if (frame < born) return null;
  const a = prog(frame, born, CUE.stop, E.glideOut);
  const open = prog(frame, CUE.drop, CUE.drop + 40, E.glideOut);
  // a slow pull-back on the room while the line reads (it keeps moving until the seam)
  const creep = lmix(1, 0.93, prog(frame, CUE.drop + 30, CUE.demo + 30, E.softOut));
  const w = lmix(lmix(CARD_W0 * 0.86, CARD_W0, a), CARD_WF / creep, open) * creep;
  const h = (w * CARD.h) / CARD.w;
  const r = mix(26, 0, open);
  const soft = prog(frame, CUE.seam, CUE.seam + 22, E.settleOut);
  const dim = mix(1, 0.62, prog(frame, CUE.drop + 10, CUE.drop + 50, E.settleOut));
  // a band of light crosses the photo as it lands
  const band = prog(frame, CUE.drop + 4, CUE.drop + 64, E.strongInOut);
  return (
    <AbsoluteFill>
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          width: w,
          height: h,
          transform: `translate(${(W / 2 - w / 2).toFixed(3)}px, ${(H / 2 - h / 2).toFixed(3)}px)`,
          borderRadius: r,
          overflow: 'hidden',
          opacity: a,
          boxShadow: open < 0.98 ? '0 40px 110px rgba(0,0,0,0.55), 0 10px 28px rgba(0,0,0,0.35)' : undefined,
        }}
      >
        <AbsoluteFill style={{ filter: `brightness(${dim.toFixed(4)})` }}>
          <Img src={staticFile('async/products/setup-full-1.jpg')} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          <Img src={staticFile('async/reel/setup-blur.jpg')} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: soft }} />
        </AbsoluteFill>
        {band > 0 && band < 1 ? (
          <div
            style={{
              position: 'absolute',
              top: 0,
              bottom: 0,
              left: `${mix(-40, 120, band).toFixed(3)}%`,
              width: '34%',
              background: 'linear-gradient(100deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.12) 50%, rgba(255,255,255,0) 100%)',
            }}
          />
        ) : null}
      </div>
      {/* the line's shade, only once the photo fills the frame */}
      <AbsoluteFill style={{ opacity: open, background: 'radial-gradient(ellipse 60% 44% at 50% 50%, rgba(9,9,11,0.52), rgba(9,9,11,0.12) 72%, rgba(9,9,11,0.2))' }} />
    </AbsoluteFill>
  );
};

/** D: tracking in (the letters close up as the line arrives), the payoff words in the signal. Out: into the seam. */
const LineD: React.FC<{ frame: number }> = ({ frame }) => {
  if (frame < CUE.lineD - 2 || frame > CUE.lineDOut + 30) return null;
  const p = prog(frame, CUE.lineD, CUE.lineD + 40, E.glideOut);
  const o = prog(frame, CUE.lineDOut, CUE.lineDOut + 24, E.buildIn);
  const track = mix(0.16, -0.005, p);
  const creep = lmix(1, 1.04, prog(frame, CUE.lineD + 30, CUE.lineDOut + 24, E.softOut));
  return (
    <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', transform: `scale(${creep.toFixed(5)})` }}>
      <div style={{ ...lineStyle(SIZE.d, 700, TEXT, track), opacity: p * (1 - o), filter: `blur(${(8 * (1 - p) + 18 * o).toFixed(2)}px)` }}>
        {LINES.d1}
        <span style={{ color: AS.signal }}>{LINES.d2}</span>
      </div>
    </AbsoluteFill>
  );
};

/** The hook and its turn, film frames 0 to just past the demo's first downbeat. */
export const Hook: React.FC<{ frame: number }> = ({ frame }) => {
  // the seam: everything goes soft, then gives way to the demo's world underneath (both sides unreadable)
  const gone = prog(frame, CUE.seam + 10, CUE.demo + 16, E.softIn);
  if (gone >= 1) return null;
  return (
    <AbsoluteFill style={{ opacity: 1 - gone, filter: gone > 0 ? `blur(${(26 * gone).toFixed(2)}px)` : undefined }}>
      {frame < CUE.drop + 44 ? <Villa frame={frame} /> : null}
      <LineA frame={frame} />
      <LineB frame={frame} />
      <Tiles frame={frame} />
      <LineC frame={frame} />
      <Setup frame={frame} />
      <LineD frame={frame} />
    </AbsoluteFill>
  );
};
