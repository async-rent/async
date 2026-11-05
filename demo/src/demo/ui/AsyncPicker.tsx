import React from 'react';
import { Img, staticFile } from 'remotion';
import { AS, FONT } from '../../brand/tokens';
import { B, PICK_UI as U } from '../layout';
import { appear, count, hold, state } from '../motion';
import { ADDONS, CUE, DELIVERY, DELIVERY_FEE, PICK, SETUPS, WEEKS, t } from '../script';
import { Icon } from './icons';
import { AsyncWordmark } from './marks';

// The Async MCP App that search_products renders inside the chat: the three Bali setups, the add-ons and the rental
// length, in Async's own dark theme and faces. The user picks here; Continue posts the pick back to Claude.

const img = (f: string) => staticFile(`async/products/${f}`);
export const UI: React.CSSProperties = { fontFamily: FONT.asyncUi, color: AS.text, fontVariantNumeric: 'tabular-nums' };
export const MONO: React.CSSProperties = { fontFamily: FONT.mono, fontVariantNumeric: 'tabular-nums' };
export const EYEBROW: React.CSSProperties = { ...MONO, fontSize: 10.5, letterSpacing: '0.12em', textTransform: 'uppercase', color: AS.faint };

const money = (v: number) => `$${Math.round(v)}`;

/** The selection check on a card or chip: a signal disc with an ink tick, grown in from 0.6 (never from zero). */
export const Check: React.FC<{ p: number; size?: number }> = ({ p, size = 22 }) => (
  <div
    style={{
      width: size,
      height: size,
      borderRadius: '50%',
      background: AS.signal,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      opacity: p,
      transform: `scale(${0.6 + 0.4 * p})`,
      boxShadow: '0 2px 8px rgba(0,0,0,0.35)',
    }}
  >
    <Icon name="check" size={size * 0.62} color={AS.signalInk} stroke={3} />
  </div>
);

const SetupImage: React.FC<{ images: string[] }> = ({ images }) =>
  images.length === 1 ? (
    <Img src={img(images[0])} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
  ) : (
    <div style={{ width: '100%', height: '100%', background: '#FFFFFF', display: 'flex', padding: 10, gap: 6, boxSizing: 'border-box' }}>
      <Img src={img(images[0])} style={{ flex: 1.5, minWidth: 0, height: '100%', objectFit: 'contain' }} />
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
        <Img src={img(images[1])} style={{ flex: 1, minHeight: 0, width: '100%', objectFit: 'contain' }} />
        <Img src={img(images[2])} style={{ flex: 1, minHeight: 0, width: '100%', objectFit: 'contain' }} />
      </div>
    </div>
  );

export const AsyncPicker: React.FC<{ frame: number }> = ({ frame }) => {
  const at = CUE.app1;
  const frameIn = appear(frame, at, 20, 12);
  const sel = state(frame, CUE.pickSetup, 12);
  const add = [state(frame, CUE.pickLamp, 12), state(frame, CUE.pickMouse, 12)];
  const weekly = count(frame, [
    { f: CUE.pickSetup, v: SETUPS[0].weekly },
    { f: CUE.pickLamp, v: SETUPS[0].weekly + ADDONS[0].weekly },
    { f: CUE.pickMouse, v: SETUPS[0].weekly + ADDONS[0].weekly + ADDONS[1].weekly },
  ]);
  const deposit = count(frame, [
    { f: CUE.pickSetup, v: SETUPS[0].deposit },
    { f: CUE.pickLamp, v: SETUPS[0].deposit + ADDONS[0].deposit },
    { f: CUE.pickMouse, v: SETUPS[0].deposit + ADDONS[0].deposit + ADDONS[1].deposit },
  ]);
  const ready = state(frame, CUE.pickSetup, 14);
  const hover = hold(frame, CUE.continue - t(0.35), CUE.continue + t(0.1));
  const press = hold(frame, CUE.continue, CUE.continue + 4, 4, 10);
  const sent = state(frame, CUE.continue + t(0.12), 14);
  const cardHover = (i: number, f0: number) => (i === 0 ? hold(frame, f0 - t(0.3), f0 + t(0.5)) : 0);
  const stag = (i: number) => appear(frame, at + 8 + i * 5, 18, 10);

  return (
    <div
      style={{
        ...UI,
        position: 'relative',
        width: 720,
        height: B.app1.h,
        borderRadius: 16,
        background: AS.frame,
        boxShadow: `inset 0 0 0 1px ${AS.line}, 0 10px 30px rgba(0,0,0,0.25)`,
        opacity: frameIn.opacity,
        transform: `translateY(${frameIn.y}px)`,
        overflow: 'hidden',
      }}
    >
      {/* header */}
      <div style={{ position: 'absolute', left: U.pad, right: U.pad, top: 18, height: 26, display: 'flex', alignItems: 'center', gap: 12, opacity: stag(0).opacity }}>
        <AsyncWordmark height={17} />
        <div style={{ width: 1, height: 14, background: AS.lineHi }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: AS.muted, fontSize: 13 }}>
          <Icon name="pin" size={14} color={AS.muted} />
          Canggu, Bali
        </div>
        <div style={{ flex: 1 }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: AS.muted, fontSize: 12.5 }}>
          <Icon name="calendar" size={14} color={AS.muted} />
          {WEEKS[PICK.weeks]} · from {DELIVERY.day}
        </div>
      </div>
      <div style={{ ...EYEBROW, position: 'absolute', left: U.pad, top: 58, opacity: stag(0).opacity }}>Choose your setup</div>

      {/* the three setups */}
      {SETUPS.map((s, i) => {
        const a = stag(1 + i);
        const isSel = i === PICK.setup;
        const ring = isSel ? sel : 0;
        const hv = cardHover(i, CUE.pickSetup);
        return (
          <div
            key={s.id}
            style={{
              position: 'absolute',
              left: U.pad + i * (U.cardW + U.gap),
              top: U.cardsY,
              width: U.cardW,
              height: U.cardH,
              borderRadius: 13,
              background: hv > 0 ? AS.cardHi : AS.card,
              boxShadow: `inset 0 0 0 ${1 + ring}px ${ring > 0.02 ? AS.signal : AS.line}`,
              overflow: 'hidden',
              opacity: a.opacity * (isSel ? 1 : 1 - 0.35 * sel),
              transform: `translateY(${a.y}px) scale(${1 - 0.012 * hold(frame, CUE.pickSetup, CUE.pickSetup + 3, 3, 9) * (isSel ? 1 : 0)})`,
            }}
          >
            <div style={{ position: 'absolute', left: 1, top: 1, right: 1, height: U.imgH, borderRadius: '12px 12px 0 0', overflow: 'hidden' }}>
              <SetupImage images={s.images} />
            </div>
            {s.badge ? (
              <div
                style={{
                  ...MONO,
                  position: 'absolute',
                  left: 10,
                  top: 10,
                  fontSize: 10.5,
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  padding: '4px 8px',
                  borderRadius: 6,
                  background: 'rgba(9,9,11,0.82)',
                  color: AS.text,
                }}
              >
                {s.badge}
              </div>
            ) : null}
            {isSel ? (
              <div style={{ position: 'absolute', right: 10, top: 10 }}>
                <Check p={sel} />
              </div>
            ) : null}
            <div style={{ position: 'absolute', left: 14, right: 14, top: U.imgH + 14 }}>
              <div style={{ fontSize: 15.5, fontWeight: 600, lineHeight: '20px' }}>{s.name}</div>
              <div style={{ fontSize: 12.5, lineHeight: '17px', color: AS.muted, marginTop: 4, height: 34 }}>{s.tagline}</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginTop: 10 }}>
                <span style={{ ...MONO, fontSize: 15, fontWeight: 500 }}>{money(s.weekly)}</span>
                <span style={{ fontSize: 12, color: AS.muted }}>/ week</span>
              </div>
            </div>
          </div>
        );
      })}

      <div style={{ ...EYEBROW, position: 'absolute', left: U.pad, top: U.addY - 22, opacity: stag(4).opacity }}>Add-ons</div>
      {ADDONS.map((o, i) => {
        const a = stag(5 + i);
        const on = i < add.length ? add[i] : 0;
        const pressAt = i === 0 ? CUE.pickLamp : i === 1 ? CUE.pickMouse : -999;
        const hv = hold(frame, pressAt - t(0.28), pressAt + t(0.45));
        return (
          <div
            key={o.id}
            style={{
              position: 'absolute',
              left: U.pad + i * (U.cardW + U.gap),
              top: U.addY,
              width: U.cardW,
              height: U.addH,
              borderRadius: 12,
              background: hv > 0.01 ? AS.cardHi : AS.card,
              boxShadow: `inset 0 0 0 ${1 + on}px ${on > 0.02 ? AS.signal : AS.line}`,
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '0 12px 0 8px',
              boxSizing: 'border-box',
              opacity: a.opacity,
              transform: `translateY(${a.y}px) scale(${1 - 0.02 * hold(frame, pressAt, pressAt + 3, 3, 9)})`,
            }}
          >
            <div style={{ width: 40, height: 40, borderRadius: 8, background: '#FFFFFF', overflow: 'hidden', flexShrink: 0 }}>
              <Img src={img(o.image)} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13.5, fontWeight: 600, lineHeight: '18px' }}>{o.name}</div>
              <div style={{ ...MONO, fontSize: 11.5, color: AS.muted, lineHeight: '16px' }}>+{money(o.weekly)} / week</div>
            </div>
            <div style={{ position: 'relative', width: 20, height: 20 }}>
              <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', boxShadow: `inset 0 0 0 1.5px ${AS.lineHi}`, opacity: 1 - on }} />
              <div style={{ position: 'absolute', inset: 0 }}>
                <Check p={on} size={20} />
              </div>
            </div>
          </div>
        );
      })}

      {/* the rental length, the totals, Continue */}
      <div style={{ position: 'absolute', left: U.pad, right: U.pad, top: U.rowY, height: U.rowH, display: 'flex', alignItems: 'center', gap: 14, opacity: stag(8).opacity }}>
        <div style={{ display: 'flex', padding: 3, borderRadius: 10, background: AS.card, boxShadow: `inset 0 0 0 1px ${AS.line}` }}>
          {WEEKS.map((w, i) => (
            <div
              key={w}
              style={{
                fontSize: 12.5,
                fontWeight: i === PICK.weeks ? 600 : 500,
                padding: '7px 12px',
                borderRadius: 7,
                color: i === PICK.weeks ? AS.text : AS.muted,
                background: i === PICK.weeks ? AS.lineHi : 'transparent',
              }}
            >
              {w}
            </div>
          ))}
        </div>
        <div style={{ flex: 1 }} />
        <div style={{ position: 'relative', textAlign: 'right' }}>
          <div style={{ position: 'absolute', right: 0, top: 8, whiteSpace: 'nowrap', fontSize: 12.5, color: AS.muted, opacity: 1 - state(frame, CUE.pickSetup, 6) }}>Pick a setup to see your total</div>
          <div style={{ opacity: state(frame, CUE.pickSetup + 5, 12) }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'flex-end', gap: 4 }}>
            <span style={{ ...MONO, fontSize: 16, fontWeight: 500 }}>{money(weekly)}</span>
            <span style={{ fontSize: 12, color: AS.muted }}>/ week</span>
          </div>
          <div style={{ fontSize: 11.5, color: AS.muted, marginTop: 1 }}>
            Deposit {money(deposit)} · Delivery + setup {money(DELIVERY_FEE)}
          </div>
          </div>
        </div>
        <div
          style={{
            width: U.btnW,
            height: U.rowH,
            borderRadius: 10,
            background: sent > 0.5 ? AS.card : AS.signal,
            boxShadow: sent > 0.5 ? `inset 0 0 0 1px ${AS.lineHi}` : `0 0 ${18 * hover}px rgba(0,191,255,${0.35 * hover})`,
            color: sent > 0.5 ? AS.text : AS.signalInk,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            fontSize: 14,
            fontWeight: 600,
            opacity: 0.4 + 0.6 * ready,
            filter: `brightness(${1 + 0.08 * hover - 0.12 * press})`,
            transform: `scale(${1 - 0.035 * press})`,
          }}
        >
          {sent > 0.5 ? (
            <>
              <Icon name="check" size={15} color={AS.signal} stroke={2.6} />
              <span style={{ opacity: sent }}>Sent</span>
            </>
          ) : (
            <>
              Continue
              <Icon name="forward" size={15} color={AS.signalInk} stroke={2.2} />
            </>
          )}
        </div>
      </div>
    </div>
  );
};
