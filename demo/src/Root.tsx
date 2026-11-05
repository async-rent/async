import React from 'react';
import { Composition } from 'remotion';
import { FPS, H, TOTAL, W } from './demo/script';
import { Film, FilmProps } from './Film';
import { Reel, ReelProps } from './reel/Reel';
import { TOTAL as REEL_TOTAL } from './reel/timeline';

export const RemotionRoot: React.FC = () => (
  <>
    {/* The demo. Render: bash scripts/render.sh Film out/film.mp4 (silent by request). */}
    <Composition id="Film" component={Film} durationInFrames={TOTAL} fps={FPS} width={W} height={H} defaultProps={{ audit: false } as FilmProps} />
    {/* The reel: the hook, the turn and the demo, cut to music. Render: bash scripts/render.sh Reel out/reel.mp4 --audio public/audio/reel.wav */}
    <Composition id="Reel" component={Reel} durationInFrames={REEL_TOTAL} fps={FPS} width={W} height={H} defaultProps={{ audit: false } as ReelProps} />
  </>
);
