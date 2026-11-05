// The real marks this film shows, for the kit (src/kit/logos.tsx): written by scripts/logos.mjs from
// public/logos/logos.json, which keeps each mark's source, licence and trademark owner. Do not edit by hand:
// node scripts/logos.mjs get <name> adds a mark; node scripts/logos.mjs list --write rewrites this file.
import type { LogoEntry } from './kit/logos';

export const LOGOS: Record<string, LogoEntry> = {
  "claude": { name: "Claude", tone: "colour", tile: "none", files: { mark: { src: "logos/claude.svg", aspect: 0.996 }, wordmark: { src: "logos/claude.wordmark.svg", aspect: 4.655 }, wordmarkDark: { src: "logos/claude.wordmark.dark.svg", aspect: 4.655 }, mono: { src: "logos/claude.mono.svg", aspect: 1 }, white: { src: "logos/claude.white.svg", aspect: 1 }, black: { src: "logos/claude.black.svg", aspect: 1 } } },
  "paypal": { name: "PayPal", tone: "colour", tile: "none", files: { mark: { src: "logos/paypal.svg", aspect: 0.83 }, wordmark: { src: "logos/paypal.wordmark.svg", aspect: 4.122 }, mono: { src: "logos/paypal.mono.svg", aspect: 0.848 }, white: { src: "logos/paypal.white.svg", aspect: 0.848 }, black: { src: "logos/paypal.black.svg", aspect: 0.848 } } },
};
