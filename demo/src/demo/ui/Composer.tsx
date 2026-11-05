import React from 'react';
import { CL } from '../../brand/tokens';
import { NEW, REPLY } from '../layout';
import { clamp01, E, mix, prog } from '../motion';
import { MODEL } from '../script';
import { SANS } from './chat';
import { Icon } from './icons';

// Claude's composer in its two places: centred on the new-chat page (the prompt is typed here) and docked at the foot
// of the chat ("Reply"). One box morphs between the two rects as the page becomes the chat.

export const PLACEHOLDER = 'How can I help you today?';

/** The caret: solid while keys land, then the system blink (0.53 s on, 0.53 s off). */
const caretOn = (frame: number, lastKey: number) => (frame - lastKey < 20 ? 1 : Math.floor((frame - lastKey - 20) / 32) % 2 === 0 ? 0 : 1);

export const Composer: React.FC<{
  frame: number;
  text: string; // what is typed so far
  lastKey: number; // frame of the last keystroke (the caret holds solid while typing)
  showCaret: boolean;
  morph: number; // 0 = the new-chat composer, 1 = the reply box
  sendPress: number;
  sendHover: number;
  working: boolean; // the turn is running: the send button is a stop square
}> = ({ frame, text, lastKey, showCaret, morph, sendPress, sendHover, working }) => {
  const m = morph;
  const x = mix(NEW.box.x, REPLY.x, m);
  const y = mix(NEW.box.y, REPLY.y, m);
  const w = mix(NEW.box.w, REPLY.w, m);
  const h = mix(NEW.box.h, REPLY.h, m);
  const oldA = 1 - clamp01(m / 0.18);
  const newA = clamp01((m - 0.5) / 0.5);
  const hasText = text.length > 0;
  return (
    <>
      <div
        style={{
          ...SANS,
          position: 'absolute',
          left: x,
          top: y,
          width: w,
          height: h,
          borderRadius: mix(18, 14, m),
          background: CL.composer,
          boxShadow: `inset 0 0 0 1px ${CL.composerLine}, 0 6px 22px rgba(0,0,0,0.22)`,
        }}
      >
        {/* the new-chat composer's contents */}
        <div style={{ position: 'absolute', inset: 0, opacity: oldA }}>
          <div style={{ position: 'absolute', left: 18, right: 18, top: 16, fontSize: 15, lineHeight: '22px', color: CL.text, whiteSpace: 'pre-wrap' }}>
            {hasText ? (
              <span>
                {text}
                {showCaret ? <span style={{ display: 'inline-block', width: 1.5, height: 19, marginLeft: 1, verticalAlign: -4, background: CL.text, opacity: caretOn(frame, lastKey) }} /> : null}
              </span>
            ) : (
              <span style={{ position: 'relative' }}>
                {showCaret ? <span style={{ position: 'absolute', left: -1, top: 1, width: 1.5, height: 19, background: CL.text, opacity: caretOn(frame, lastKey) }} /> : null}
                <span style={{ color: CL.faint }}>{PLACEHOLDER}</span>
              </span>
            )}
          </div>
          <div style={{ position: 'absolute', left: 14, bottom: 13 }}>
            <Icon name="plus" size={18} color={CL.dim} stroke={1.7} />
          </div>
          <div style={{ position: 'absolute', right: 12, bottom: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
            <Icon name="mic" size={17} color={CL.dim} />
            <Icon name="chevronDown" size={12} color={CL.faint} stroke={2} />
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 9,
                background: hasText ? CL.send : 'transparent',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transform: `scale(${1 - 0.08 * sendPress})`,
                filter: `brightness(${1 + 0.12 * sendHover})`,
              }}
            >
              {hasText ? <Icon name="arrowUp" size={17} color="#FFFFFF" stroke={2.2} /> : <Icon name="wave" size={17} color={CL.dim} />}
            </div>
          </div>
        </div>
        {/* the reply box's contents */}
        <div style={{ position: 'absolute', inset: 0, opacity: newA, display: 'flex', alignItems: 'center', padding: '0 16px' }}>
          <span style={{ color: CL.faint, fontSize: 15 }}>Reply</span>
          <div style={{ flex: 1 }} />
          <div style={{ width: 28, height: 28, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', background: working ? CL.sideActive : 'transparent' }}>
            {working ? <Icon name="stop" size={15} color={CL.text} /> : <Icon name="arrowUp" size={16} color={CL.faint} stroke={2} />}
          </div>
        </div>
      </div>
      {/* the rows under each composer */}
      <div style={{ ...SANS, position: 'absolute', left: NEW.box.x + 12, top: NEW.box.y + NEW.box.h + 12, width: NEW.box.w - 24, display: 'flex', alignItems: 'center', fontSize: 13, color: CL.dim, opacity: oldA }}>
        <span>Project</span>
        <Icon name="chevronDown" size={12} color={CL.faint} stroke={2} style={{ marginLeft: 4 }} />
        <div style={{ flex: 1 }} />
        <span style={{ color: CL.text }}>{MODEL.name}</span>
        <span style={{ marginLeft: 6, color: CL.faint }}>{MODEL.effort}</span>
        <span style={{ marginLeft: 18, color: CL.text }}>{MODEL.mode}</span>
      </div>
      <div style={{ ...SANS, position: 'absolute', left: REPLY.x + 8, top: REPLY.y + REPLY.h + 10, width: REPLY.w - 16, display: 'flex', alignItems: 'center', gap: 12, fontSize: 12, color: CL.dim, opacity: newA }}>
        <Icon name="plus" size={15} color={CL.dim} stroke={1.7} />
        <Icon name="mic" size={14} color={CL.dim} />
        <Icon name="wave" size={14} color={CL.dim} />
        <div style={{ flex: 1, textAlign: 'center', color: CL.faint }}>Claude is AI and can make mistakes.</div>
        <span style={{ color: CL.text }}>{MODEL.name}</span>
        <span style={{ color: CL.faint, marginLeft: -6 }}>{MODEL.effort}</span>
        <span style={{ color: CL.text, marginLeft: 6 }}>{MODEL.mode}</span>
      </div>
    </>
  );
};

/** The page turning into the chat: 0 on the new-chat page, 1 once the composer has docked. */
export const morphAt = (frame: number, at: number) => prog(frame, at, at + 40, E.stdInOut);
