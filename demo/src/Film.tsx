import React from 'react';
import { AbsoluteFill } from 'remotion';
import { C } from './brand/tokens';
import { DemoFilm } from './demo/DemoFilm';
import { Audit } from './lib/Audit';
import { FontGate } from './lib/FontGate';
import type { SafeSpec } from './lib/safe';

/** audit: draw and log the layout audit; safe: its safe zone (a lib/safe.ts preset or insets; default by aspect). */
export type FilmProps = { audit?: boolean; safe?: SafeSpec };

// The film: the Claude.ai + Async demo (src/demo). Silent by request: no soundtrack is muxed.
export const Film: React.FC<FilmProps> = ({ audit = false, safe }) => (
  <FontGate>
    <AbsoluteFill style={{ background: C.ink }}>
      <DemoFilm />
      {audit && <Audit safe={safe} />}
    </AbsoluteFill>
  </FontGate>
);
