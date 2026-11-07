# Brief

**Spec:** 1920x1080@60, 37.5 s, format: prompt run on Claude.ai (product demo), audio: licensed music bed with
recorded effects on the cursor's presses and the payment (no typing sounds, no whoosh on motion, by request).

**The case.** A nomad who just landed in Canggu asks Claude.ai for a cozy work setup in Bali for 2 weeks. Claude
uses the Async MCP tools, renders Async's MCP Apps inside the chat (a setup picker, then a checkout), the user picks
in the embedded UI, presses PayPal's button, it loads and the payment is approved at once (the PayPal approval page
is skipped), and Claude confirms the rental.

## Supplied

- **Reference recording** of the user's Claude.ai (dark theme, `claude.ai/new` and a chat page): layout, colours
  (sampled at 2x), copy ("Evening thoughts", "How can I help you today?", "Sonnet 5.5 Medium", "Manual",
  "Claude is AI and can make mistakes.", "Lucky · Free").
- **Async brand** from this repo: `apps/storefront/public/logo-wordmark.svg`, `assets/logo.svg`, the `#00BFFF` signal and
  the zinc dark theme (`packages/ui/src/styles.css`), Figtree / Josefin Sans / Geist Mono, the tagline
  "Your comfy setup, everywhere!".
- **Async content** from `packages/db/seed.sql` (Bali prices, taglines, badges), `tools/mcp` (tool titles:
  List locations, Search products, Quote rental, Rent, Confirm payment), `packages/payment` (PayPal, rental numbers
  `AR-YYYY-XXXXXX`), the storefront checkout and confirmation copy ("Due today", "Paid today", "Delivery & setup",
  "Secure checkout · Refundable deposit", "Then $30 / week for 1 more week.").
- **Product photos** from `apps/storefront/public/products/` and the Bali villa hero (`apps/storefront/public/images`),
  regraded to blue hour and defocused for the world behind the window.
- **Third-party marks** via `scripts/logos.mjs`: Claude (spark, wordmark) and PayPal (wordmark), record in
  `public/logos/logos.json`.

## The numbers on screen (prices from the seed, Bali = base prices)

| Item | / week |
|---|---|
| The full setup | $25 |
| Arc Floor Lamp | $3 |
| MX Master 3S | $2 |
| Delivery + setup (Bali, once) | $10 |

The deposit is 25% of the weekly rent (`DEPOSIT_RATE` in `src/demo/script.ts`): 25% of $30 = $7.50. This replaces
the seed's per-product deposits for the demo.

Due today = first week $30 + deposit $7.50 + delivery $10 = **$47.50**, then $30 for the last week (Fri, 13 Nov).
Today is Thu, 5 Nov 2026; earliest delivery Fri, 6 Nov; 2 weeks end Thu, 19 Nov.

## Brand-supplied exceptions (lint-film `cinetic:brand-supplied`)

The film shows two real products' screens, so their own looks override the house bans:
- Claude.ai's serif greeting and replies (Source Serif 4 stands in for Anthropic Serif; Inter for Anthropic Sans).
- Claude's terracotta spark and send button, PayPal's white button, the macOS traffic lights (tagged `ui-state`).
- The Claude and PayPal marks are their current official files, used only to show what Async works with.

## Departures from the cinetic standard, on purpose

- **Effects on presses and the payment only.** No typing sounds and no whoosh on any motion (the camera, the apps
  mounting, the check's flight, the end card), by request. The mix is `scripts/reel-sfx.py --film`, not `npm run sound`.
- **UI at web size under a camera.** Claude's UI is laid out at web px in a 1280x760 window (x1.3 on the stage) and
  the camera scales it 1.0-3.0x; lint's small-text warnings read the web px, not the size on screen.
- **Length.** 37.5 s, longer than the 18-20 s prompt-run template, because the brief asks for the whole flow
  (prompt, tools, interactive pick, payment, settlement).

## Hard bans kept

No invented copy or numbers (every price and string is the product's; the 25% deposit is from the brief), no drawn stand-ins for products (real
photos), no sparkles or confetti, no fake metrics, no credits in the picture.

## Sound

- **Music:** "dance floor" by Coverr (Coverr License, no credit needed; record in
  `audio/music/dance_floor_coverr.licence.json`), the reel's track, with its own edit in `audio/music/film-edit.json`
  (`track.py edit --map 1:5x4,5:9x13,18:25x2 --film-t0 0 --end fade --fade 2.0`): film bars 1-4 = the intro's second
  half under the wordmark and the typing, the track's entry on bar 5 (7.50 s, just after Send), the body under the
  tools, the pick and the payment (the loudest 3 s land on "Payment approved", 24-27 s), and the break (source bars
  25-26) under the end card from 31.875 s, fading out from 35.6 s with the picture. No stop-downs, no hit on the logo.
- **Effects:** the reel's two Mixkit takes, re-auditioned with earshot for the Film (`out/film/sfx-audition.py`):

  | Role | Cues | Take | earshot |
  |---|---|---|---|
  | cursor press | Send, the three picks, Continue, PayPal | mixkit-275, 0.107-0.250 s | rank z +5.1 of 8 click files; trim "a single computer mouse button click" strong, z +3.9; p_real 0.94 |
  | Payment approved | 25.20 s | mixkit-2575, 0.058-1.20 s | rank z +3.4 trim (z +3.9 file, the only strong one of 5 chimes); p_real 0.36, uncertain (a designed UI tone; kept) |

- **Mix:** each take levelled against the music around its cue, no ducking, mastered to -14.0 LUFS, -1.6 dBTP.
  earshot critique on `out/film.mp4`: launch-grade, 22 of 22 metrics in range; every press lands within 1 frame
  (`earshot sheet`, `out/qa/film-sheet.png`), its 3-12 kHz click 16-26 dB over the music's median highs.

```sh
export PYTHON=$PWD/.tools/venv/bin/python   # earshot + the cinetic scripts' packages
node scripts/py.mjs scripts/audio/score.py --score audio/film-score.json --bed-only --out public/audio/film-bed.wav
npx tsx scripts/film-cues.ts && $PYTHON scripts/reel-sfx.py --film      # -> public/audio/film.wav
bash scripts/render.sh Film out/film.mp4 --audio public/audio/film.wav  # or --join-only over the rendered parts
```
