// The demo's motion helpers, built on the house tokens (lib/anim): every move eases by its role, zooms run in log
// space, holds are still.
import { clamp, E, type Ease, lmix, mix, prog, rand, XP } from '../lib/anim';

export { clamp, E, mix, lmix, prog, rand, XP };
export type { Ease };

/** One key of a piecewise move: at frame `f` the value is `v`; the segment that ENDS at this key eases by `ease`. */
export type Key = { f: number; v: number; ease?: Ease };

/** Piecewise eased value: held before the first key and after the last, still between two equal keys. */
export const keyed = (frame: number, keys: readonly Key[], log = false): number => {
  if (!keys.length) return 0;
  if (frame <= keys[0].f) return keys[0].v;
  for (let i = 1; i < keys.length; i++) {
    const a = keys[i - 1];
    const b = keys[i];
    if (frame <= b.f) {
      if (a.v === b.v || b.f <= a.f) return b.v;
      const p = prog(frame, a.f, b.f, b.ease ?? XP.travel);
      return log ? lmix(a.v, b.v, p) : mix(a.v, b.v, p);
    }
  }
  return keys[keys.length - 1].v;
};

/** A block arriving: opacity and a short rise, on snapOut (words and slot inserts). */
export const appear = (frame: number, at: number, dur = 16, rise = 8) => {
  const p = prog(frame, at, at + dur, E.snapOut);
  return { opacity: p, y: (1 - p) * rise, p };
};

/** 0 -> 1 state change over a few frames (UI state, never a one-frame pop). */
export const state = (frame: number, at: number, dur = 10, ease: Ease = E.settleOut) => prog(frame, at, at + dur, ease);

/** Hover then release envelope for a button the cursor sits on: in over `inDur`, out after `until`. */
export const hold = (frame: number, from: number, until: number, inDur = 8, outDur = 10) =>
  Math.min(prog(frame, from, from + inDur, E.settleOut), 1 - prog(frame, until, until + outDur, E.settleOut));

/** A rolling count shown while a total changes: eased toward each new value. */
export const count = (frame: number, steps: readonly { f: number; v: number }[], dur = 18) => {
  // the first value lands as it is (a total appearing); later changes roll from the last value
  let v = 0;
  let prev = steps.length ? steps[0].v : 0;
  for (const s of steps) {
    if (frame < s.f) break;
    v = mix(prev, s.v, prog(frame, s.f, s.f + dur, E.glideOut));
    prev = s.v;
  }
  return v;
};

/**
 * Human typing: the time (frames from start) each character lands, spread over `dur` frames. Spaces and
 * punctuation take longer, a seeded jitter keeps it uneven, and the whole is normalised to the duration.
 */
export const typingTimes = (text: string, dur: number, seed = 'type') => {
  const w = [...text].map((ch, i) => {
    const prevCh = text[i - 1] ?? '';
    let k = 0.75 + 0.5 * rand(`${seed}:${i}`);
    if (ch === ' ') k *= 1.25;
    if (prevCh === '.' || prevCh === '?') k *= 3.2;
    if (prevCh === ',') k *= 1.8;
    if (ch === ch.toUpperCase() && /[A-Z]/.test(ch)) k *= 1.3;
    return k;
  });
  const total = w.reduce((a, b) => a + b, 0);
  let acc = 0;
  return w.map((k) => {
    acc += k;
    return (acc / total) * dur;
  });
};
/** How many characters are typed `frame` frames after the start. */
export const typedCount = (times: readonly number[], frame: number) => {
  let n = 0;
  while (n < times.length && times[n] <= frame) n++;
  return n;
};

export const clamp01 = (v: number) => clamp(v, 0, 1);
