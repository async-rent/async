import React from 'react';
import { AbsoluteFill, Img, staticFile, useCurrentFrame } from 'remotion';
import { AS, C, CL, FONT } from '../brand/tokens';
import { camAt } from './camera';
import { B, colToWin, K, PAY_UI, WIN, WIN_X, WIN_Y, winToStage } from './layout';
import { clamp01, E, lmix, mix, prog } from './motion';
import { CUE, H, LINES, TOTAL, W, t } from './script';
import { scrollAt } from './story';
import { PaidCheck } from './ui/AsyncCheckout';
import { ClaudeApp } from './ui/ClaudeApp';
import { AsyncWordmark, ClaudeSpark, WORDMARK } from './ui/marks';

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

/** The opening: the wordmark, then the promise under it, the partner's real mark in the line. */
const Intro: React.FC<{ frame: number }> = ({ frame }) => {
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
          fontFamily: FONT.text,
          fontSize: 62,
          fontWeight: 560,
          letterSpacing: '-0.02em',
          color: AS.text,
          lineHeight: '80px',
        }}
      >
        <div style={{ overflow: 'hidden', height: 84 }}>
          <div style={{ transform: `translateY(${(1 - lineA) * 70}px)`, opacity: lineA }}>{LINES.promise}</div>
        </div>
        <div style={{ overflow: 'hidden', height: 84 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, transform: `translateY(${(1 - lineB) * 70}px)`, opacity: lineB }}>
            <ClaudeSpark size={50} />
            {LINES.partner}
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
const LOCK = { h: 160, cy: 482 };
const LOCK_W = (LOCK.h * WORDMARK.w) / WORDMARK.h;
const LOCK_X = W / 2 - LOCK_W / 2;
const DOT = { x: LOCK_X + (WORDMARK.dot.x * LOCK.h) / WORDMARK.h, y: LOCK.cy - LOCK.h / 2 + (WORDMARK.dot.y * LOCK.h) / WORDMARK.h, d: (2 * WORDMARK.dot.r * LOCK.h) / WORDMARK.h };

/** Where the paid check sits on screen at a frame (film px), through the scroll and the camera. */
const checkOnScreen = (frame: number) => {
  const S = scrollAt(frame);
  const p = colToWin(PAY_UI.colR + PAY_UI.check.x, B.app2.y + PAY_UI.cardY + PAY_UI.check.y, S);
  const st = winToStage(p);
  const cam = camAt(frame);
  const f = winToStage(cam);
  return { x: W / 2 + cam.s * (st.x - f.x), y: H / 2 + cam.s * (st.y - f.y), d: PAY_UI.checkSize * K * cam.s };
};

const EndCard: React.FC<{ frame: number }> = ({ frame }) => {
  if (frame < CUE.endFly) return null;
  const from = checkOnScreen(CUE.endFly);
  const p = prog(frame, CUE.endFly, CUE.endWord, E.stdInOut);
  // a bowed flight up into the lockup's dot
  const cx = mix(from.x, DOT.x, 0.5) + 80;
  const cy = mix(from.y, DOT.y, 0.5) + 60;
  const x = mix(mix(from.x, cx, p), mix(cx, DOT.x, p), p);
  const y = mix(mix(from.y, cy, p), mix(cy, DOT.y, p), p);
  const d = lmix(from.d, DOT.d, p) * (1 + 0.55 * Math.sin(Math.PI * p));
  const tick = 1 - clamp01((p - 0.1) / 0.45);
  const word = prog(frame, CUE.endWord, CUE.endWord + t(0.75), E.glideOut);
  const tag = prog(frame, CUE.endTag, CUE.endTag + 34, E.snapOut);
  const url = prog(frame, CUE.endUrl, CUE.endUrl + 34, E.snapOut);
  const creep = lmix(1, 1.035, prog(frame, CUE.endWord, TOTAL, E.softOut));
  return (
    <AbsoluteFill style={{ transform: `scale(${creep})`, transformOrigin: `${W / 2}px ${H / 2}px` }}>
      <div style={{ position: 'absolute', left: 0, top: 0, transform: `translate(${(LOCK_X + (1 - word) * 46).toFixed(3)}px, ${LOCK.cy - LOCK.h / 2}px)` }}>
        <AsyncWordmark height={LOCK.h} dot={false} reveal={mix(0.16, 1, word)} style={{ opacity: clamp01(word * 3) }} />
      </div>
      <div style={{ position: 'absolute', left: 0, top: 0, width: d, height: d, transform: `translate(${(x - d / 2).toFixed(3)}px, ${(y - d / 2).toFixed(3)}px)` }}>
        <PaidCheck p={1} size={d} tick={tick} />
      </div>
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: 600,
          textAlign: 'center',
          fontFamily: FONT.text,
          fontSize: 46,
          fontWeight: 500,
          letterSpacing: '-0.012em',
          color: '#E4E4E7',
          opacity: tag,
          filter: `blur(${8 * (1 - tag)}px)`,
          transform: `translateY(${(1 - tag) * 18}px)`,
        }}
      >
        {LINES.tagline}
      </div>
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: 676,
          textAlign: 'center',
          fontFamily: FONT.mono,
          fontSize: 28,
          letterSpacing: '0.04em',
          color: AS.signal,
          opacity: url,
          transform: `translateY(${(1 - url) * 12}px)`,
        }}
      >
        {LINES.url}
      </div>
    </AbsoluteFill>
  );
};

export const DemoFilm: React.FC = () => {
  const frame = useCurrentFrame();
  const fadeIn = prog(frame, 0, t(0.4), E.softOut);
  const fadeOut = prog(frame, TOTAL - t(0.7), TOTAL - 1, E.softIn);
  return (
    <AbsoluteFill style={{ background: C.ink, overflow: 'hidden' }}>
      <AbsoluteFill style={{ opacity: fadeIn * (1 - fadeOut) }}>
        <World frame={frame} />
        <Stage frame={frame} hideCheck={frame >= CUE.endFly} />
        <Intro frame={frame} />
        <EndCard frame={frame} />
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
