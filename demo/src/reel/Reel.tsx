import React from 'react';
import { AbsoluteFill, useCurrentFrame } from 'remotion';
import { C } from '../brand/tokens';
import { DemoFilm } from '../demo/DemoFilm';
import { Audit } from '../lib/Audit';
import { FontGate } from '../lib/FontGate';
import type { SafeSpec } from '../lib/safe';
import { Hook, REEL_FONT } from './Hook';
import { E, prog } from '../demo/motion';
import { CUE, demoFrame, FADE_OUT, LINES, TOTAL } from './timeline';

/** The demo's own lines in the reel's face and words. */
const VOICE = { font: REEL_FONT, weight: 600, promise: LINES.promise, partner: LINES.partner };

export type ReelProps = { audit?: boolean; safe?: SafeSpec };

// The reel: the hook (a nomad's two weeks in a Bali villa, working at the dining table), the turn (rent the setup by
// the week) and the Claude demo in action, all cut to one licensed track (muxed by scripts/render.sh).
export const Reel: React.FC<ReelProps> = ({ audit = false, safe }) => {
  const frame = useCurrentFrame();
  // the close: the picture fades to black with the logo hit's ring
  const out = prog(frame, TOTAL - FADE_OUT, TOTAL - 1, E.softIn);
  return (
    <FontGate>
      <AbsoluteFill style={{ background: C.ink, overflow: 'hidden' }}>
        <AbsoluteFill style={{ opacity: 1 - out }}>
          {/* the demo's world is already under the hook's last frames, so the blur seam reveals it */}
          {frame >= CUE.seam ? <DemoFilm frame={demoFrame(frame)} fadeIn={false} voice={VOICE} /> : null}
          <Hook frame={frame} />
        </AbsoluteFill>
        {audit && <Audit safe={safe} />}
      </AbsoluteFill>
    </FontGate>
  );
};
