import React from 'react';
import { Composition } from 'remotion';
import { FPS, H, TOTAL, W } from './demo/script';
import { Film, FilmProps } from './Film';

export const RemotionRoot: React.FC = () => (
  <>
    {/* The demo. Render: bash scripts/render.sh Film out/film.mp4 (silent by request). */}
    <Composition id="Film" component={Film} durationInFrames={TOTAL} fps={FPS} width={W} height={H} defaultProps={{ audit: false } as FilmProps} />
  </>
);
