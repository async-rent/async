import React from 'react';
import { Img, staticFile } from 'remotion';
import { AS, PP } from '../../brand/tokens';
import { B, PAY_UI as U } from '../layout';
import { appear, hold, state } from '../motion';
import { ADDONS, CUE, DELIVERY, DELIVERY_FEE, DEPOSIT, DUE, PICK, RENTAL, SETUPS, WEEKLY, t } from '../script';
import { Spinner } from './chat';
import { Icon } from './icons';
import { EYEBROW, MONO, UI } from './AsyncPicker';
import { AsyncWordmark, PayPalWordmark } from './marks';

// The Async checkout MCP App, rendered after rent: the rental's lines, the delivery, the storefront's order summary
// and PayPal's own gold button. Pressing it loads, then the rental is paid (the PayPal approval itself is skipped).

const img = (f: string) => staticFile(`async/products/${f}`);
const money = (v: number) => `$${v}`;

const ITEMS = [
  { name: SETUPS[PICK.setup].name, image: SETUPS[PICK.setup].images[0], weekly: SETUPS[PICK.setup].weekly, cover: true },
  ...PICK.addons.map((i) => ({ name: ADDONS[i].name, image: ADDONS[i].image, weekly: ADDONS[i].weekly, cover: false })),
];

/** The paid check: a signal disc and an ink tick drawn in. The end card flies this same disc into the wordmark. */
export const PaidCheck: React.FC<{ p: number; size?: number; tick?: number }> = ({ p, size = U.checkSize, tick = 1 }) => {
  const len = 20;
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: AS.signal,
        opacity: Math.min(1, p * 1.6),
        transform: `scale(${0.6 + 0.4 * p})`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <svg width={size * 0.6} height={size * 0.6} viewBox="0 0 24 24" style={{ opacity: tick }}>
        <path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke={AS.signalInk} strokeWidth={3.2} strokeLinecap="round" strokeLinejoin="round" strokeDasharray={len} strokeDashoffset={len * (1 - Math.min(1, Math.max(0, (p - 0.3) / 0.7)))} />
      </svg>
    </div>
  );
};

export const AsyncCheckout: React.FC<{ frame: number; hideCheck?: boolean }> = ({ frame, hideCheck = false }) => {
  const at = CUE.app2;
  const frameIn = appear(frame, at, 20, 12);
  const stag = (i: number) => appear(frame, at + 8 + i * 5, 18, 10);
  const hover = hold(frame, CUE.pay - t(0.4), CUE.pay + t(0.15));
  const press = hold(frame, CUE.pay, CUE.pay + 4, 4, 10);
  const loading = frame >= CUE.pay + 4 && frame < CUE.paid;
  const logo = 1 - state(frame, CUE.pay + 4, 8);
  const spin = state(frame, CUE.pay + 6, 8) * (1 - state(frame, CUE.paid - 4, 6));
  const paid = state(frame, CUE.paid, 16, undefined);
  const paidCheck = state(frame, CUE.paid + 4, 26);

  return (
    <div
      style={{
        ...UI,
        position: 'relative',
        width: 720,
        height: B.app2.h,
        borderRadius: 16,
        background: AS.frame,
        boxShadow: `inset 0 0 0 1px ${AS.line}, 0 10px 30px rgba(0,0,0,0.25)`,
        opacity: frameIn.opacity,
        transform: `translateY(${frameIn.y}px)`,
        overflow: 'hidden',
      }}
    >
      {/* header: the brand, the rental, its status */}
      <div style={{ position: 'absolute', left: U.pad, right: U.pad, top: 20, height: 26, display: 'flex', alignItems: 'center', gap: 12, opacity: stag(0).opacity }}>
        <AsyncWordmark height={17} />
        <div style={{ width: 1, height: 14, background: AS.lineHi }} />
        <div style={{ ...MONO, fontSize: 12, color: AS.muted }}>Rental {RENTAL}</div>
        <div style={{ flex: 1 }} />
        <div style={{ position: 'relative', height: 24 }}>
          <div
            style={{
              ...MONO,
              fontSize: 10.5,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              height: 24,
              padding: '0 10px',
              borderRadius: 12,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              color: paid > 0.5 ? AS.signal : AS.muted,
              background: paid > 0.5 ? AS.signalSoft : AS.card,
              boxShadow: `inset 0 0 0 1px ${paid > 0.5 ? 'rgba(0,191,255,0.35)' : AS.line}`,
            }}
          >
            <div style={{ width: 6, height: 6, borderRadius: 3, background: paid > 0.5 ? AS.signal : AS.faint }} />
            {paid > 0.5 ? 'Confirmed' : 'Pending payment'}
          </div>
        </div>
      </div>

      {/* left: the setup and its delivery */}
      <div style={{ ...EYEBROW, position: 'absolute', left: U.pad, top: 76, opacity: stag(1).opacity }}>Your setup · 2 weeks</div>
      {ITEMS.map((it, i) => {
        const a = stag(2 + i);
        return (
          <div key={it.name} style={{ position: 'absolute', left: U.pad, top: 98 + i * 50, width: 350, height: 40, display: 'flex', alignItems: 'center', gap: 12, opacity: a.opacity, transform: `translateY(${a.y}px)` }}>
            <div style={{ width: 40, height: 40, borderRadius: 8, overflow: 'hidden', background: '#FFFFFF', flexShrink: 0 }}>
              <Img src={img(it.image)} style={{ width: '100%', height: '100%', objectFit: it.cover ? 'cover' : 'contain' }} />
            </div>
            <div style={{ flex: 1, fontSize: 14, fontWeight: 600 }}>{it.name}</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
              <span style={{ ...MONO, fontSize: 13.5 }}>{money(it.weekly)}</span>
              <span style={{ fontSize: 11.5, color: AS.muted }}>/ week</span>
            </div>
          </div>
        );
      })}
      <div style={{ position: 'absolute', left: U.pad, top: 260, width: 350, height: 1, background: AS.line, opacity: stag(5).opacity }} />
      <div style={{ position: 'absolute', left: U.pad, top: 276, width: 350, display: 'flex', gap: 12, opacity: stag(5).opacity }}>
        <div style={{ width: 40, height: 40, borderRadius: 8, background: AS.card, boxShadow: `inset 0 0 0 1px ${AS.line}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Icon name="truck" size={19} color={AS.muted} />
        </div>
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, lineHeight: '20px' }}>Delivery on {DELIVERY.day}</div>
          <div style={{ fontSize: 12.5, color: AS.muted, lineHeight: '18px' }}>{DELIVERY.place} · free setup included</div>
        </div>
      </div>

      {/* right: the order summary and the PayPal button */}
      <div
        style={{
          position: 'absolute',
          left: U.colR,
          top: U.cardY,
          width: U.cardW,
          height: U.cardH,
          borderRadius: 13,
          background: AS.card,
          boxShadow: `inset 0 0 0 1px ${AS.line}`,
          opacity: stag(2).opacity,
          transform: `translateY(${stag(2).y}px)`,
        }}
      >
        {[
          ['Rent / week', money(WEEKLY)],
          ['Delivery & setup', money(DELIVERY_FEE)],
          ['Deposit', money(DEPOSIT)],
        ].map(([k, v], i) => (
          <div key={k} style={{ position: 'absolute', left: 16, right: 16, top: 16 + i * 24, display: 'flex', justifyContent: 'space-between', fontSize: 13, color: AS.muted }}>
            <span>{k}</span>
            <span style={{ ...MONO, color: AS.text }}>{v}</span>
          </div>
        ))}
        <div style={{ position: 'absolute', left: 16, right: 16, top: 92, height: 1, background: AS.line }} />
        <div style={{ position: 'absolute', left: 16, right: 16, top: 102, display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <span style={{ position: 'relative', fontSize: 13.5, fontWeight: 600, width: 90, height: 20 }}>
            <span style={{ position: 'absolute', left: 0, opacity: 1 - paid }}>Due today</span>
            <span style={{ position: 'absolute', left: 0, opacity: paid }}>Paid today</span>
          </span>
          <span style={{ ...MONO, fontSize: 24, fontWeight: 500, letterSpacing: '-0.02em' }}>{money(DUE)}</span>
        </div>
        <div style={{ position: 'absolute', left: 16, right: 16, top: 136, fontSize: 11.5, color: AS.muted }}>
          Then {money(WEEKLY)} / week for 1 more week.
        </div>

        {/* PayPal's gold button: idle, hover, press, loading; then the paid state in its place */}
        <div
          style={{
            position: 'absolute',
            left: 16,
            right: 16,
            top: U.btnY,
            height: U.btnH,
            borderRadius: 8,
            background: hover > 0 ? `color-mix(in srgb, ${PP.goldHover} ${hover * 100}%, ${PP.gold})` : PP.gold,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            opacity: 1 - paid,
            transform: `scale(${1 - 0.03 * press})`,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, opacity: logo }}>
            <span style={{ fontFamily: UI.fontFamily, fontSize: 15, fontWeight: 600, color: PP.label }}>Pay with</span>
            <PayPalWordmark height={19} style={{ marginTop: 2 }} />
          </div>
          {loading || spin > 0 ? (
            <div style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%, -50%)', opacity: spin }}>
              <Spinner frame={frame} size={20} color={PP.label} track="rgba(44,46,47,0.18)" />
            </div>
          ) : null}
        </div>
        <div
          style={{
            position: 'absolute',
            left: 16,
            right: 16,
            top: U.btnY,
            height: U.btnH,
            borderRadius: 8,
            background: AS.signalSoft,
            boxShadow: `inset 0 0 0 1px rgba(0,191,255,${0.45 * paid})`,
            opacity: paid,
          }}
        >
          <div style={{ position: 'absolute', left: U.check.x - 16 - U.checkSize / 2, top: (U.btnH - U.checkSize) / 2, opacity: hideCheck ? 0 : 1 }}>
            <PaidCheck p={paidCheck} />
          </div>
          <div style={{ position: 'absolute', left: 60, top: 5, opacity: state(frame, CUE.paid + 8, 16) }}>
            <div style={{ fontSize: 14, fontWeight: 600, lineHeight: '18px' }}>Payment approved</div>
            <div style={{ fontSize: 11.5, color: AS.muted, lineHeight: '16px' }}>{money(DUE)}.00 paid with PayPal</div>
          </div>
        </div>
        <div style={{ position: 'absolute', left: 16, right: 16, top: U.btnY + U.btnH + 14, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 6, fontSize: 11.5, color: AS.faint }}>
          <Icon name="lock" size={12} color={AS.faint} />
          Secure checkout · Refundable deposit
        </div>
      </div>
    </div>
  );
};
