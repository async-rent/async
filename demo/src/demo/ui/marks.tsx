import React from 'react';
import { Img, staticFile } from 'remotion';
import { AS } from '../../brand/tokens';

// Async's own marks, from apps/storefront/public/logo-wordmark.svg and assets/logo.svg (paths copied as published;
// the letters take currentColor and the dot the signal, as apps/storefront/src/components/logo.tsx does).
const WORD = [
  'M162.577 45.76C161.383 46.6987 159.953 47.4453 158.289 48C156.625 48.5547 154.962 48.832 153.298 48.832C150.396 48.832 147.858 48.256 145.682 47.104C143.506 45.952 141.799 44.352 140.561 42.304C139.367 40.2133 138.77 37.76 138.77 34.944C138.77 32.128 139.409 29.6747 140.689 27.584C142.012 25.4933 143.719 23.8933 145.809 22.784C147.943 21.632 150.226 21.056 152.658 21.056C154.791 21.056 156.69 21.3547 158.354 21.952C160.06 22.5493 161.511 23.36 162.706 24.384L159.762 28.224C158.994 27.6267 158.055 27.0933 156.945 26.624C155.836 26.1547 154.577 25.92 153.169 25.92C151.633 25.92 150.204 26.3253 148.882 27.136C147.602 27.904 146.577 28.9707 145.809 30.336C145.084 31.7013 144.721 33.2373 144.721 34.944C144.721 36.5653 145.105 38.08 145.873 39.488C146.641 40.8533 147.708 41.9413 149.074 42.752C150.439 43.52 151.996 43.904 153.745 43.904C154.897 43.904 155.943 43.7333 156.882 43.392C157.863 43.0507 158.737 42.5813 159.505 41.984L162.577 45.76Z',
  'M111.01 21.696L111.522 28.16L111.266 27.136C112.12 25.1733 113.506 23.616 115.426 22.464C117.346 21.2693 119.565 20.672 122.082 20.672C124.6 20.672 126.648 21.4187 128.226 22.912C129.848 24.3627 130.68 26.2613 130.722 28.608V48.192H124.706V30.72C124.664 29.2693 124.237 28.096 123.426 27.2C122.658 26.2613 121.442 25.792 119.778 25.792C118.242 25.792 116.856 26.2187 115.618 27.072C114.381 27.9253 113.4 29.0987 112.674 30.592C111.992 32.0853 111.65 33.8133 111.65 35.776V48.192H105.698V21.696H111.01Z',
  'M76.3135 60.928L93.7855 21.696H99.2895L82.2015 60.928H76.3135ZM82.8415 48.384L70.1055 21.696H76.8255L87.5135 45.376L82.8415 48.384Z',
  'M55.435 48.704C53.5577 48.704 51.723 48.384 49.931 47.744C48.1817 47.0613 46.731 46.0587 45.579 44.736L48.075 41.28C49.1843 42.3467 50.315 43.1573 51.467 43.712C52.6617 44.224 53.835 44.48 54.987 44.48C55.8403 44.48 56.6297 44.3733 57.355 44.16C58.0803 43.9467 58.6563 43.6053 59.083 43.136C59.5523 42.624 59.787 41.9413 59.787 41.088C59.787 40.1493 59.467 39.4027 58.827 38.848C58.2297 38.2933 57.4403 37.8453 56.459 37.504C55.5203 37.1627 54.5177 36.8427 53.451 36.544C51.275 35.8187 49.611 34.816 48.459 33.536C47.307 32.256 46.731 30.6987 46.731 28.864C46.731 27.456 47.0723 26.1547 47.755 24.96C48.4803 23.7227 49.5257 22.72 50.891 21.952C52.299 21.184 54.027 20.8 56.075 20.8C57.9097 20.8 59.5523 21.0347 61.003 21.504C62.4537 21.9307 63.819 22.656 65.099 23.68L62.731 27.392C61.963 26.5813 61.0457 25.984 59.979 25.6C58.9123 25.216 57.9523 25.0027 57.099 24.96C56.3737 24.9173 55.6697 25.024 54.987 25.28C54.347 25.536 53.8137 25.8987 53.387 26.368C52.9603 26.8373 52.747 27.392 52.747 28.032C52.747 28.928 53.0457 29.6533 53.643 30.208C54.2403 30.7627 55.0083 31.2107 55.947 31.552C56.9283 31.8507 57.8883 32.1707 58.827 32.512C60.1497 32.896 61.323 33.408 62.347 34.048C63.371 34.688 64.1817 35.4773 64.779 36.416C65.419 37.3547 65.739 38.528 65.739 39.936C65.739 41.5147 65.355 42.9867 64.587 44.352C63.8617 45.6747 62.731 46.7413 61.195 47.552C59.7017 48.32 57.7817 48.704 55.435 48.704Z',
  'M0 48.192L20.224 0H20.608L40.768 48.192H33.664L18.56 9.728L22.976 6.848L6.08 48.192H0ZM11.84 30.656H29.056L31.104 36.032H10.048L11.84 30.656Z',
];
/** The wordmark's viewBox and its dot (centre, radius) in viewBox units. */
export const WORDMARK = { w: 163, h: 61, dot: { x: 154, y: 35, r: 5 } } as const;

/**
 * The Async wordmark at a height (px). `dot: false` leaves the dot out (the end card flies its own in).
 * `reveal` (0..1) opens the letters from the dot leftwards, the name sliding out from behind it.
 */
export const AsyncWordmark: React.FC<{ height: number; color?: string; dot?: boolean; reveal?: number; style?: React.CSSProperties }> = ({
  height,
  color = AS.text,
  dot = true,
  reveal = 1,
  style,
}) => {
  const w = (height * WORDMARK.w) / WORDMARK.h;
  const right = (1 - reveal) * 100;
  return (
    <svg
      width={w}
      height={height}
      viewBox={`0 0 ${WORDMARK.w} ${WORDMARK.h}`}
      fill="none"
      style={{ display: 'block', flexShrink: 0, overflow: 'visible', clipPath: reveal < 1 ? `inset(-10% -10% -10% ${right}%)` : undefined, ...style }}
    >
      {WORD.map((d, i) => (
        <path key={i} d={d} fill={color} />
      ))}
      {dot ? <circle cx={WORDMARK.dot.x} cy={WORDMARK.dot.y} r={WORDMARK.dot.r} fill={AS.signal} /> : null}
    </svg>
  );
};

const C_PATH =
  'M236.696 226.849C225.715 235.467 212.578 242.322 197.284 247.414C181.99 252.506 166.696 255.052 151.401 255.052C124.735 255.052 101.401 249.764 81.4014 239.188C61.4014 228.612 45.7151 213.923 34.3426 195.121C23.3622 175.928 17.872 153.405 17.872 127.552C17.872 101.699 23.7544 79.1764 35.5191 59.9829C47.6759 40.7893 63.3622 26.1004 82.5779 15.9161C102.186 5.34002 123.166 0.052002 145.519 0.052002C165.127 0.052002 182.578 2.79394 197.872 8.27781C213.558 13.7617 226.892 21.2041 237.872 30.605L210.813 65.8585C203.754 60.3746 195.127 55.4783 184.931 51.1695C174.735 46.8608 163.166 44.7064 150.225 44.7064C136.107 44.7064 122.97 48.4276 110.813 55.87C99.0485 62.9207 89.6367 72.7133 82.5779 85.2479C75.9112 97.7824 72.5779 111.884 72.5779 127.552C72.5779 142.437 76.1073 156.342 83.1661 169.269C90.2249 181.803 100.029 191.792 112.578 199.234C125.127 206.285 139.441 209.81 155.519 209.81C166.107 209.81 175.715 208.243 184.343 205.11C193.362 201.976 201.401 197.667 208.46 192.183L236.696 226.849Z';

/** The Async app mark (the C with its dot), on a dark tile: the connector's icon in Claude and the tab's favicon. */
export const AsyncMark: React.FC<{ size: number; tile?: boolean; radius?: number }> = ({ size, tile = true, radius }) => (
  <div
    style={{
      width: size,
      height: size,
      borderRadius: radius ?? size * 0.26,
      background: tile ? '#09090B' : 'transparent',
      boxShadow: tile ? `inset 0 0 0 1px ${AS.lineHi}` : undefined,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    }}
  >
    <svg width={size * 0.62} height={size * 0.62} viewBox="0 0 256 256" fill="none">
      <path d={C_PATH} fill={AS.text} />
      <circle cx="153.4" cy="129" r="45.5" fill={AS.signal} />
    </svg>
  </div>
);

/** Real marks fetched by scripts/logos.mjs (public/logos, record in logos.json). */
export const ClaudeSpark: React.FC<{ size: number; style?: React.CSSProperties }> = ({ size, style }) => (
  <Img src={staticFile('logos/claude.svg')} style={{ width: size, height: size, display: 'block', flexShrink: 0, ...style }} />
);
export const ClaudeWordmark: React.FC<{ height: number }> = ({ height }) => (
  <Img src={staticFile('logos/claude.wordmark.dark.svg')} style={{ height, width: (height * 512) / 110, display: 'block' }} />
);
export const PayPalWordmark: React.FC<{ height: number; style?: React.CSSProperties }> = ({ height, style }) => (
  <Img src={staticFile('logos/paypal.wordmark.svg')} style={{ height, width: (height * 404.65) / 98.18, display: 'block', ...style }} />
);
