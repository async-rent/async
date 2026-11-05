import React from 'react';
import { AbsoluteFill, Img, staticFile, useCurrentFrame } from 'remotion';
import { AS, C, CL, FONT } from '../brand/tokens';
import { camAt } from './camera';
import { B, colToWin, K, PAY_UI, WIN, WIN_X, WIN_Y, winToStage } from './layout';
import { clamp01, E, keyed, lmix, mix, prog } from './motion';
import { CUE, H, LINES, TOTAL, W, t } from './script';
import { scrollAt } from './story';
import { PaidCheck } from './ui/AsyncCheckout';
import { ClaudeApp } from './ui/ClaudeApp';
import { AsyncWordmark, C_CENTRE, C_LEFT, ClaudeSpark, EndLockup, LETTERS_RIGHT, WORDMARK } from './ui/marks';

// The demo: the Async promise on the Bali world, a blur into the prompt typed at macro scale on Claude.ai, the
// chat running the Async tools and apps, PayPal, and the paid check flying out to become the wordmark's dot.

/** The world: the storefront's own Bali villa at blue hour, defocused far behind the window, its light slowly settling. */
const World: React.FC<{ frame: number }> = ({ frame }) => {
  const s = lmix(1.08, 1.0, prog(frame, 0, TOTAL, E.softOut));
  const lift = 0.86 + 0.14 * prog(frame, 0, t(3), E.softOut) - 0.1 * prog(frame, CUE.endFly, CUE.endTag, E.settleOut);
  return (
    <AbsoluteFill style={{ background: C.ink }}>
      <Img
        src={staticFile('async/world.jpg')}
        style={{ position: 'absolute', left: -96, top: -54, width: W + 192, height: H + 108, objectFit: 'cover', transform: `scale(${s})`, filter: `brightness(${lift})` }}
      />
    </AbsoluteFill>
  );
};

/**
 * The voice the demo's own lines speak in (the opening line and the end card's tagline): the demo's Figtree and copy
 * by default; the reel passes its own face and its own opening line.
 */
export type DemoVoice = { font: string; weight: number; promise: string; partner: string };
const DEMO_VOICE: DemoVoice = { font: FONT.text, weight: 560, promise: LINES.promise, partner: LINES.partner };

/** The opening: the wordmark, then the promise under it, the partner's real mark in the line. */
const Intro: React.FC<{ frame: number; voice: DemoVoice }> = ({ frame, voice }) => {
  if (frame > CUE.introOut + t(0.36)) return null;
  const mk = prog(frame, CUE.mark, CUE.mark + 34, E.glideOut);
  const lineA = prog(frame, CUE.promise, CUE.promise + 30, E.snapOut);
  const lineB = prog(frame, CUE.promise + 9, CUE.promise + 39, E.snapOut);
  const rise = prog(frame, CUE.promise - 4, CUE.promise + 26, E.stdInOut);
  const out = prog(frame, CUE.introOut, CUE.introOut + t(0.34), E.buildIn);
  const markH = 118;
  const markY = mix(540, 482, rise);
  return (
    <AbsoluteFill style={{ opacity: 1 - out, filter: `blur(${22 * out}px)`, transform: `scale(${1 + 0.09 * out})` }}>
      <div
        style={{
          position: 'absolute',
          left: W / 2 - (markH * WORDMARK.w) / WORDMARK.h / 2,
          top: 0,
          opacity: mk,
          filter: `blur(${14 * (1 - mk)}px)`,
          transform: `translateY(${(markY - markH / 2).toFixed(3)}px) scale(${1.05 - 0.05 * mk})`,
        }}
      >
        <AsyncWordmark height={markH} />
      </div>
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: 590,
          display: 'flex',
          justifyContent: 'center',
          gap: 18,
          fontFamily: voice.font,
          fontSize: 62,
          fontWeight: voice.weight,
          letterSpacing: '-0.02em',
          color: AS.text,
          lineHeight: '80px',
        }}
      >
        <div style={{ overflow: 'hidden', height: 84 }}>
          <div style={{ transform: `translateY(${(1 - lineA) * 70}px)`, opacity: lineA }}>{voice.promise}</div>
        </div>
        <div style={{ overflow: 'hidden', height: 84 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, transform: `translateY(${(1 - lineB) * 70}px)`, opacity: lineB }}>
            <ClaudeSpark size={50} />
            {voice.partner}
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

/** The browser window on the stage, under the camera. */
const Stage: React.FC<{ frame: number; hideCheck: boolean }> = ({ frame, hideCheck }) => {
  if (frame < CUE.introOut) return null;
  const cam = camAt(frame);
  const f = winToStage(cam);
  // the blur seam: the stage comes into focus only once the promise is already unreadable
  const inn = prog(frame, CUE.introOut + t(0.14), CUE.introOut + t(0.55), E.glideOut);
  const back = prog(frame, CUE.endFly, CUE.endFly + t(1.1), E.settleOut);
  const gone = prog(frame, CUE.endWord - t(0.2), CUE.endTag + t(0.2), E.softIn);
  const recede = 1 - 0.07 * back;
  return (
    <AbsoluteFill
      style={{
        opacity: inn * (1 - gone),
        filter: `blur(${(22 * (1 - inn) + 14 * back).toFixed(2)}px) brightness(${1 - 0.55 * back})`,
        transform: `translate(${W / 2}px, ${H / 2}px) scale(${recede}) translate(${-W / 2}px, ${-H / 2}px)`,
      }}
    >
      <div style={{ position: 'absolute', left: 0, top: 0, width: W, height: H, transformOrigin: '0 0', transform: `translate(${W / 2 - cam.s * f.x}px, ${H / 2 - cam.s * f.y}px) scale(${cam.s})` }}>
        <div
          style={{
            position: 'absolute',
            left: WIN_X,
            top: WIN_Y,
            width: WIN.w,
            height: WIN.h,
            transformOrigin: '0 0',
            transform: `scale(${K})`,
            borderRadius: 12,
            overflow: 'hidden',
            boxShadow: `0 0 0 1px ${CL.windowLine}, 0 30px 90px rgba(0,0,0,0.55), 0 8px 24px rgba(0,0,0,0.35)`,
          }}
        >
          <ClaudeApp frame={frame} hideCheck={hideCheck} />
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ---- the end card ----
// The paid check flies to the centre and lands as the dot of the C mark: the C and its dot are one mark, and they pop
// out together. Straight after the pop the C slides right into its place in the wordmark while "Asyn" reveals from
// right to left behind it. The tagline lands under it.
const LOCK = { h: 160, cy: 492 };
const LOCK_W = (LOCK.h * WORDMARK.w) / WORDMARK.h;
const LOCK_X = W / 2 - LOCK_W / 2;
const LOCK_Y = LOCK.cy - LOCK.h / 2;
const UNIT = LOCK.h / WORDMARK.h; // film px per viewBox unit
/** The C mark on its own: the wordmark's c at K_BIG, its centre on the frame's centre line. */
const K_BIG = 3;
const D_BIG = { x: (W / 2 - LOCK_X) / UNIT - C_CENTRE.x, y: (H / 2 - 20 - LOCK_Y) / UNIT - C_CENTRE.y };
/** The pop: the C mark lands a little small (POP0 of its size) and grows to rest over half a second, no overshoot. */
const POP0 = 0.85;
const POP_DUR = 30;
const popScale = (frame: number) =>
  keyed(frame, [
    { f: CUE.endLand, v: POP0 },
    { f: CUE.endLand + POP_DUR, v: 1, ease: E.glideOut },
  ], true);
/** The dot on screen for a c scaled k and offset d (viewBox units). */
const dotAt = (k: number, d: { x: number; y: number }) => ({
  x: LOCK_X + UNIT * (C_CENTRE.x + d.x + k * (WORDMARK.dot.x - C_CENTRE.x)),
  y: LOCK_Y + UNIT * (C_CENTRE.y + d.y + k * (WORDMARK.dot.y - C_CENTRE.y)),
  d: 2 * WORDMARK.dot.r * k * UNIT,
});

/** Where the paid check sits on screen at a frame (film px), through the scroll and the camera. */
const checkOnScreen = (frame: number) => {
  const S = scrollAt(frame);
  const p = colToWin(PAY_UI.colR + PAY_UI.check.x, B.app2.y + PAY_UI.cardY + PAY_UI.check.y, S);
  const st = winToStage(p);
  const cam = camAt(frame);
  const f = winToStage(cam);
  return { x: W / 2 + cam.s * (st.x - f.x), y: H / 2 + cam.s * (st.y - f.y), d: PAY_UI.checkSize * K * cam.s };
};

const EndCard: React.FC<{ frame: number; voice: DemoVoice }> = ({ frame, voice }) => {
  if (frame < CUE.endFly) return null;
  // 1. the flight: a bowed path from the check in the chat to the C mark's dot, at the size the pop starts from
  const from = checkOnScreen(CUE.endFly);
  const to = dotAt(K_BIG * POP0, D_BIG);
  const p = prog(frame, CUE.endFly, CUE.endLand, E.stdInOut);
  const bx = mix(from.x, to.x, 0.5) + 70;
  const by = mix(from.y, to.y, 0.5) + 70;
  const x = mix(mix(from.x, bx, p), mix(bx, to.x, p), p);
  const y = mix(mix(from.y, by, p), mix(by, to.y, p), p);
  const size = lmix(from.d, to.d, p);
  const tick = 1 - clamp01((p - 0.1) / 0.45);
  const landed = frame >= CUE.endLand;
  // 2. the pop: the C and its dot appear together, as one mark, fading in as it grows to rest
  const pop = popScale(frame);
  const cA = prog(frame, CUE.endLand, CUE.endLand + 18, E.glideOut);
  // 3. straight after, the C slides right and shrinks into its place; "Asyn" reveals from right to left behind it,
  //    its edge leaving the C and running to the A while the C travels
  const q = prog(frame, CUE.endWord, CUE.endWord + t(0.75), E.stdInOut);
  // it shrinks ahead of its travel, so the big C clears the letters it would cover
  const k = lmix(K_BIG * pop, 1, prog(frame, CUE.endWord, CUE.endWord + t(0.5), E.glideOut));
  const d = { x: mix(D_BIG.x, 0, q), y: mix(D_BIG.y, 0, q) };
  const edge = mix(LETTERS_RIGHT, -2, prog(frame, CUE.endWord + t(0.12), CUE.endWord + t(0.82), E.glideOut));
  // nothing shows to the right of the C's left side: the letters come out from behind it
  const cLeft = C_CENTRE.x + d.x + k * (C_LEFT - C_CENTRE.x);
  const tag = prog(frame, CUE.endTag, CUE.endTag + 34, E.snapOut);
  const creep = lmix(1, 1.035, prog(frame, CUE.endLand, TOTAL, E.softOut));
  return (
    <AbsoluteFill style={{ transform: `scale(${creep})`, transformOrigin: `${W / 2}px ${H / 2}px` }}>
      <div style={{ position: 'absolute', left: 0, top: 0, transform: `translate(${LOCK_X.toFixed(3)}px, ${LOCK_Y}px)` }}>
        <EndLockup height={LOCK.h} k={k} d={d} edge={edge} right={cLeft - 1} cOpacity={landed ? cA : 0} cScale={1} dot={landed} />
      </div>
      {!landed ? (
        <div style={{ position: 'absolute', left: 0, top: 0, width: size, height: size, transform: `translate(${(x - size / 2).toFixed(3)}px, ${(y - size / 2).toFixed(3)}px)` }}>
          <PaidCheck p={1} size={size} tick={tick} />
        </div>
      ) : null}
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: 612,
          textAlign: 'center',
          fontFamily: voice.font,
          fontSize: 46,
          fontWeight: voice === DEMO_VOICE ? 500 : voice.weight,
          letterSpacing: '-0.012em',
          color: '#E4E4E7',
          opacity: tag,
          filter: `blur(${8 * (1 - tag)}px)`,
          transform: `translateY(${(1 - tag) * 18}px)`,
        }}
      >
        {LINES.tagline}
      </div>
    </AbsoluteFill>
  );
};

/**
 * voice: the face and opening line of the demo's own lines (the UI keeps its products' faces).
 * frame: play the demo at a given (possibly fractional) demo frame instead of the composition's own, as the reel does
 * to fit it to its track. fadeIn: false when something hands over into the demo's first frame (the reel's hook).
 */
export const DemoFilm: React.FC<{ frame?: number; fadeIn?: boolean; voice?: DemoVoice }> = ({ frame: at, fadeIn: fades = true, voice = DEMO_VOICE }) => {
  const own = useCurrentFrame();
  const frame = at ?? own;
  const fadeIn = fades ? prog(frame, 0, t(0.4), E.softOut) : 1;
  const fadeOut = prog(frame, TOTAL - t(0.7), TOTAL - 1, E.softIn);
  return (
    <AbsoluteFill style={{ background: C.ink, overflow: 'hidden' }}>
      <AbsoluteFill style={{ opacity: fadeIn * (1 - fadeOut) }}>
        <World frame={frame} />
        <Stage frame={frame} hideCheck={frame >= CUE.endFly} />
        <Intro frame={frame} voice={voice} />
        <EndCard frame={frame} voice={voice} />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
