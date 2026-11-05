// cinetic:brand-supplied Claude.ai's reply serif and spark; recorded in BRIEF.md
import React from 'react';
import { CL, FONT } from '../../brand/tokens';
import { appear, clamp01, E, prog, state } from '../motion';
import { Icon } from './icons';
import { AsyncMark, ClaudeSpark } from './marks';

// Claude.ai's own chat pieces, at web size: the user's bubble, the streamed reply in Claude's serif, the tool-call
// rows of a connector, the message actions and the working spark.

export const SERIF: React.CSSProperties = {
  fontFamily: FONT.claudeSerif,
  fontSize: 16.5,
  lineHeight: '26px',
  color: CL.body,
  fontWeight: 400,
  letterSpacing: '-0.002em',
  fontVariationSettings: '"opsz" 18',
};
export const SANS: React.CSSProperties = { fontFamily: FONT.claudeUi, fontVariantNumeric: 'tabular-nums' };

export const UserBubble: React.FC<{ text: string; frame: number; at: number; maxW?: number }> = ({ text, frame, at, maxW = 500 }) => {
  const a = appear(frame, at, 18, 10);
  return (
    <div style={{ display: 'flex', justifyContent: 'flex-end', opacity: a.opacity, transform: `translateY(${a.y}px)` }}>
      <div
        style={{
          ...SANS,
          maxWidth: maxW,
          background: CL.bubble,
          color: CL.text,
          fontSize: 15,
          lineHeight: '22px',
          padding: '11px 16px',
          borderRadius: 14,
        }}
      >
        {text}
      </div>
    </div>
  );
};

/**
 * A reply streaming in: characters arrive at a steady live rate between `start` and `end`, each word fading up over the
 * next dozen characters. Unrevealed words hold their place (no reflow while it streams).
 */
export const Say: React.FC<{ text: string; frame: number; start: number; end: number; style?: React.CSSProperties }> = ({ text, frame, start, end, style }) => {
  // lint-ok: streaming text arrives at a live token rate, not a move
  const n = frame <= start ? -1 : (text.length + 14) * clamp01((frame - start) / Math.max(1, end - start));
  const words = text.split(/(\s+)/);
  let c = 0;
  return (
    <div style={{ ...SERIF, ...style }}>
      {words.map((w, i) => {
        const at = c;
        c += w.length;
        const o = clamp01((n - at) / 12);
        return (
          <span key={i} style={{ opacity: o }}>
            {w}
          </span>
        );
      })}
    </div>
  );
};

/** A spinner as Claude draws it on a running tool: an arc turning at a steady rate (a live rate, so linear). */
export const Spinner: React.FC<{ frame: number; size?: number; color?: string; track?: string }> = ({ frame, size = 14, color = CL.dim, track = 'rgba(255,255,255,0.12)' }) => {
  const a = (frame * 7.5) % 360; // lint-ok: a spinner turns at a constant live rate
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" style={{ display: 'block', transform: `rotate(${a}deg)`, flexShrink: 0 }}>
      <circle cx="12" cy="12" r="9" fill="none" stroke={track} strokeWidth="2.6" />
      <path d="M12 3a9 9 0 0 1 9 9" fill="none" stroke={color} strokeWidth="2.6" strokeLinecap="round" />
    </svg>
  );
};

/** A connector's tool call: the app's icon, the tool's title and the connector's name; a spinner while it runs. */
export const ToolRow: React.FC<{ title: string; frame: number; start: number; done: number }> = ({ title, frame, start, done }) => {
  const a = appear(frame, start, 14, 6);
  const running = frame < done;
  const d = state(frame, done, 12);
  // the running title shimmers: a soft highlight sweeping across the label at a live rate
  const sweep = ((frame - start) * 2.2) % 160;
  return (
    <div style={{ display: 'flex', opacity: a.opacity, transform: `translateY(${a.y}px)` }}>
      <div
        style={{
          ...SANS,
          height: 34,
          display: 'flex',
          alignItems: 'center',
          gap: 9,
          padding: '0 12px 0 8px',
          borderRadius: 10,
          background: CL.tool,
          boxShadow: `inset 0 0 0 1px ${CL.toolLine}`,
          fontSize: 13.5,
        }}
      >
        <AsyncMark size={20} radius={5} />
        <span
          style={
            running
              ? {
                  color: 'transparent',
                  backgroundImage: `linear-gradient(90deg, ${CL.dim} ${sweep - 60}%, ${CL.shimmer} ${sweep - 30}%, ${CL.dim} ${sweep}%)`,
                  backgroundClip: 'text',
                  WebkitBackgroundClip: 'text',
                  fontWeight: 500,
                }
              : { color: CL.text, fontWeight: 500 }
          }
        >
          {title}
        </span>
        <span style={{ color: CL.faint }}>Async</span>
        <div style={{ width: 14, height: 14, position: 'relative', marginLeft: 2 }}>
          <div style={{ position: 'absolute', inset: 0, opacity: 1 - d }}>
            <Spinner frame={frame} />
          </div>
          <div style={{ position: 'absolute', inset: 0, opacity: d }}>
            <Icon name="chevronRight" size={14} color={CL.faint} stroke={2} />
          </div>
        </div>
      </div>
    </div>
  );
};

export const Actions: React.FC<{ frame: number; at: number }> = ({ frame, at }) => {
  const a = appear(frame, at, 16, 4);
  return (
    <div style={{ display: 'flex', gap: 14, opacity: a.opacity, paddingLeft: 2 }}>
      {(['copy', 'speaker', 'thumbUp', 'thumbDown', 'retry'] as const).map((n) => (
        <Icon key={n} name={n} size={15} color={CL.faint} stroke={1.7} />
      ))}
    </div>
  );
};

/**
 * Claude's working spark: it turns and breathes while the turn runs, and settles still when the turn ends.
 * `on` / `off`: the frames the turn starts and ends.
 */
export const WorkingSpark: React.FC<{ frame: number; on: number; off: number; size?: number }> = ({ frame, on, off, size = 26 }) => {
  const a = prog(frame, on, on + 14, E.snapOut);
  const live = frame < off;
  const t = Math.min(frame, off) - on;
  const rot = t * 2.4; // a steady live turn
  const breathe = live ? 1 + 0.08 * Math.sin(t / 7) : 1;
  return (
    <div style={{ opacity: a, transform: `rotate(${rot}deg) scale(${breathe})`, width: size, height: size }}>
      <ClaudeSpark size={size} />
    </div>
  );
};
