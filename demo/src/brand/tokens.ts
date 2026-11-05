// cinetic:brand-supplied Claude.ai's dark theme (its terracotta send button and spark), PayPal's gold button, macOS traffic lights, Claude's serif (Source Serif 4 standing in for Anthropic Serif); recorded in BRIEF.md
// Brand tokens: the only place a colour, face or type size is written down. Acts import these;
// scripts/lint-film.mjs fails any hex colour that is not declared here.
//
// The film's palette is supplied, not invented: Claude.ai's dark theme (sampled from the user's screen
// recording) and Async's own tokens (packages/ui/src/styles.css: the #00BFFF signal and the zinc dark theme).
import type React from 'react';
import type { TypeFamily } from '../lib/look';
import { safeInsets } from '../lib/safe';
import { H, W } from '../timeline';

export const C = {
  ink: '#09090B', // Async ink (oklch .1408 .0044 285.8): the film's ground under the world photo
  ink2: '#18181B', // raised surfaces on ink
  paper: '#F4F4F5', // Async fog: product photo tiles
  mist: '#E4E4E7', // Async line
  line: '#D6D9DE', // hairlines, >= 1.5 px on screen
  mute: '#A1A1AA', // secondary text on ink
  white: '#FFFFFF',
  // The one accent: Async's signal, the dot on the wordmark. It marks what Async did (the pick, the paid state)
  // and carries the end card (the paid check becomes the wordmark's dot).
  accent: '#00BFFF',
  // The dark stage is a mid slate (lib/look.ts STAGE.dark = RECIPE.slateMid: L .34), a neutral grey on the
  // same cool greys as paper and ink, not the accent's hue: shadows, lit faces and the accent read on it.
  // On the slate the accent lifts to L .80 so it signals by lightness; type is the paper token.
  slate: '#35383C',
  slateRaised: '#45484C',
  accentLift: '#77D59E', // ui-state: a product's own control colour (Claude, PayPal, macOS), never the film's accent
  // The support hue beside the accent (lib/look.ts COLOUR.second): a second brand colour, data beside the accent,
  // a state the accent cannot be; 40 degrees or more from the accent, in 10-30 % of the film, up to 8 % of the frame
  // while it shows. Declare it here as `second`, commented ui-state, so the one-accent checks leave it out and kit/ uses it.
};

/**
 * Mask black: the zero of a luminance mask, a multiply or a screen-blend base, and a contact shade at an alpha.
 * Never a surface, a ground or ink (ink is C.ink, tinted). It stays black whatever the brand: fx/ reads it.
 */
export const MASK = '#000000';

/**
 * Claude.ai dark theme, sampled from the user's recording (2032x1282 @ 2x): the page, the sidebar, the composer,
 * the user's bubble, the send button and the spark. These are Claude's own colours (its product UI, shown as it is).
 */
export const CL = {
  page: '#171717',
  side: '#1C1C1C',
  sideLine: '#262626',
  sideActive: '#2A2A2A',
  composer: '#2A2A2A',
  composerLine: '#363636',
  bubble: '#212121',
  text: '#EEEEEE',
  body: '#E3E3E1',
  dim: '#9B9B9B',
  faint: '#6E6E6E',
  hair: '#2C2C2C',
  send: '#BE5535', // ui-state: a product's own control colour (Claude, PayPal, macOS), never the film's accent
  spark: '#D97757', // ui-state: a product's own control colour (Claude, PayPal, macOS), never the film's accent
  chrome: '#323234',
  tabs: '#1C1B20',
  url: '#1F1F22',
  windowLine: '#3A3A3C',
  shimmer: '#F5F5F5',
  tool: '#1E1E1E',
  toolLine: '#2E2E2E',
  traffic1: '#FF5F57', // ui-state: a product's own control colour (Claude, PayPal, macOS), never the film's accent
  traffic2: '#FEBC2E', // ui-state: a product's own control colour (Claude, PayPal, macOS), never the film's accent
  traffic3: '#28C840', // ui-state: a product's own control colour (Claude, PayPal, macOS), never the film's accent
};

/** Async's dark theme (packages/ui/src/styles.css .dark) as the MCP Apps draw it inside the chat. */
export const AS = {
  frame: '#111113',
  card: '#18181B',
  cardHi: '#1F1F23',
  line: '#27272A',
  lineHi: '#3F3F46',
  text: '#FAFAFA',
  muted: '#A1A1AA',
  faint: '#71717A',
  signal: '#00BFFF',
  signalInk: '#03131C',
  signalSoft: '#0B2A38',
  tile: '#F4F4F5',
  ok: '#00BFFF',
};

/** PayPal's checkout button: its gold and the hover gold, with the button's own label ink. */
export const PP = {
  gold: '#FFC439', // ui-state: a product's own control colour (Claude, PayPal, macOS), never the film's accent
  goldHover: '#F2BA36', // ui-state: a product's own control colour (Claude, PayPal, macOS), never the film's accent
  label: '#2C2E2F',
};

/**
 * FONT.text is the film's voice (the opening line and the end card's tagline): Figtree, Async's own text face.
 * claudeUi / claudeSerif stand in for Anthropic Sans and Anthropic Serif on Claude's screens; asyncUi and asyncHead
 * are the storefront's faces, used inside the Async MCP Apps.
 */
export const FONT = {
  text: '"Figtree Variable", system-ui, sans-serif', // the film's voice; typeStyle and measure.ts read it
  ui: '"Figtree Variable", system-ui, sans-serif',
  mono: '"Geist Mono Variable", ui-monospace, monospace',
  claudeUi: '"Inter Variable", system-ui, sans-serif',
  claudeSerif: '"Source Serif 4 Variable", Georgia, serif',
  asyncUi: '"Figtree Variable", system-ui, sans-serif',
  asyncHead: '"Josefin Sans Variable", system-ui, sans-serif',
};

/** Faces the FontGate waits for before anything renders or measures (one entry per weight in use). */
export const FACES = [
  '400 16px "Inter Variable"',
  '500 16px "Inter Variable"',
  '600 16px "Inter Variable"',
  '400 16px "Source Serif 4 Variable"',
  '500 16px "Source Serif 4 Variable"',
  '400 16px "Figtree Variable"',
  '500 16px "Figtree Variable"',
  '600 16px "Figtree Variable"',
  '700 16px "Figtree Variable"',
  '600 16px "Josefin Sans Variable"',
  '400 16px "Geist Mono Variable"',
  '500 16px "Geist Mono Variable"',
];

/** Layout unit: 1 at 1080p, scales every size with the short side of the frame (16:9, 9:16, 1:1). */
export const U = Math.min(W, H) / 1080;

/**
 * The film's type family, the director's pick (lib/look.ts TYPE_LOOK, references/copy-and-type.md §7): 'calm', the
 * default (small airy sentence lines at the face's own letter fit), or 'bold' (big, semibold, tight lines). TYPE below holds that family's numbers, written out because the scripts read them
 * (lint-film, add-font, brand.py): switch with node scripts/type-family.mjs bold (new-film.sh --type, or a template's
 * type_family, runs it), which writes TYPE_FAMILY, the six roles and the FACES weights; never paste them by hand.
 */
export const TYPE_FAMILY: TypeFamily = 'calm';

// One token per role, reused everywhere, so nothing is "almost matched" (size in px at 1080p; the cap height is about
// 0.727 em in Inter, given below as a share of the frame height). Film sizes, the house numbers: a sentence line
// is 84 px (cap 5.7 %), a statement 160, and the one giant word of a film (400 px and up) is the set the camera
// travels, never a faint watermark behind the copy. Tracking is the letter fit measured in this face (Inter at its
// display cut): another face adds its offsets from scripts/faces.json, or font-match.mjs fits it to a target frame.
export const TYPE = {
  ui: { size: 40, weight: 450, track: 0.01, lead: 1.3 }, // product strings, labels: cap 2.7 % FH, the smallest size held in focus (TEXT_MIN)
  caption: { size: 46, weight: 450, track: 0.006, lead: 1.3 }, // descriptor lines, URLs, the end card's tagline: cap 3.1 % (2.3-4)
  line: { size: 84, weight: 460, track: -0.014, lead: 1.25 }, // the sentence line, chains (fx/Chain) and build lines: cap 5.7 % (5-6)
  display: { size: 160, weight: 520, track: -0.026, lead: 1.09 }, // short statements and the end card's name: cap 10.8 % (10-14)
  hero: { size: 200, weight: 540, track: -0.0284, lead: 1.04 }, // the payoff word: cap 13.5 % (11-23)
  giant: { size: 640, weight: 560, track: -0.036, lead: 0.94 }, // the set: one word at 400 px or more (cap 43.1 %, up to 90 % cropped), once per film
  secondary: { size: 48, weight: 450, track: -0.02, lead: 1.15 }, // 1.1 role, kept for old acts: use caption
};

/** The smallest text held in focus for more than 6 frames at 60 fps (px at 1080p): anything smaller is mush on a phone. */
export const TEXT_MIN = 36;
/** The giant role starts here (px at 1080p): below it a big word is a hero, not the set. */
export const GIANT_MIN = 400;
/**
 * Product UI is rebuilt for film, not screenshotted at page size: every size of the web design times
 * 1.8-2 (house 1.9), never under TEXT_MIN. A 16 px label becomes 36, a 20 px body 38, a 32 px figure 61.
 */
export const UI_FILM = 1.9;
/** A web UI size (px) rebuilt for film: x UI_FILM, floored at TEXT_MIN for text. */
export const uiFilm = (webPx: number, text = true) => (text ? Math.max(TEXT_MIN, webPx * UI_FILM) : webPx * UI_FILM);

/** Type roles that replace a 1.1 role. */
export const TYPE_DEPRECATED: Partial<Record<keyof typeof TYPE, keyof typeof TYPE>> = { secondary: 'caption' };

/**
 * CSS for a type role at a size (px): the voice (FONT.text) for statements, the text face (FONT.ui) for ui and
 * caption. Tabular lining figures always, so numbers never jitter in width; kerning and contextual forms on.
 */
export const typeStyle = (role: keyof typeof TYPE, size = TYPE[role].size * U): React.CSSProperties => ({
  fontFamily: role === 'ui' || role === 'caption' || role === 'secondary' ? FONT.ui ?? FONT.text : FONT.text,
  fontSize: size,
  fontWeight: TYPE[role].weight,
  letterSpacing: `${TYPE[role].track}em`,
  lineHeight: TYPE[role].lead,
  fontVariantNumeric: 'tabular-nums lining-nums',
  fontKerning: 'normal',
  fontFeatureSettings: '"kern" 1, "liga" 1, "calt" 1',
  fontSynthesis: 'none',
  whiteSpace: 'pre',
});

/**
 * Safe margins for a w x h frame as a symmetric envelope: the larger inset of each pair from the
 * frame's safe-zone preset (src/lib/safe.ts), so a centred layout that fits inside clears every
 * side. 96 x 64 px at 1920x1080; 120 x 420 at 1080x1920, where the feed zones are asymmetric
 * (use safeBox() from lib/safe.ts there to centre on the clear band instead of the frame).
 */
export const safeArea = (w: number, h: number) => {
  const i = safeInsets(undefined, w, h);
  return { x: Math.max(i.left, i.right), y: Math.max(i.top, i.bottom) };
};
/** The film's safe margins; text stays inside them (scripts/layout-audit.sh checks). */
export const SAFE = safeArea(W, H);
