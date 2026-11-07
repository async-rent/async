import React from 'react';
import { AbsoluteFill } from 'remotion';
import { C } from './brand/tokens';
import { DemoFilm } from './demo/DemoFilm';
import { Audit } from './lib/Audit';
import { FontGate } from './lib/FontGate';
import type { SafeSpec } from './lib/safe';

/** audit: draw and log the layout audit; safe: its safe zone (a lib/safe.ts preset or insets; default by aspect). */
export type FilmProps = { audit?: boolean; safe?: SafeSpec };

// The film: the Claude.ai + Async demo (src/demo). Its soundtrack (public/audio/film.wav, BRIEF.md "Sound") is muxed
// by render.sh: music, the cursor's presses and the payment chime; no typing and no whoosh on any motion.
export const Film: React.FC<FilmProps> = ({ audit = false, safe }) => (
  <FontGate>
    <AbsoluteFill style={{ background: C.ink }}>
      <DemoFilm />
      {audit && <Audit safe={safe} />}
    </AbsoluteFill>
  </FontGate>
);
