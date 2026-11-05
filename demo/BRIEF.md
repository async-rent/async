# Brief

**Spec:** 1920x1080@60, 37.5 s, format: prompt run on Claude.ai (product demo), audio: none (silent by request).

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
- **Async content** from `packages/db/seed.sql` (Bali prices, deposits, taglines, badges), `tools/mcp` (tool titles:
  List locations, Search products, Quote rental, Rent, Confirm payment), `packages/payment` (PayPal, rental numbers
  `AR-YYYY-XXXXXX`), the storefront checkout and confirmation copy ("Due today", "Paid today", "Delivery & setup",
  "Secure checkout · Refundable deposit", "Then $30 / week for 1 more week.").
- **Product photos** from `apps/storefront/public/products/` and the Bali villa hero (`apps/storefront/public/images`),
  regraded to blue hour and defocused for the world behind the window.
- **Third-party marks** via `scripts/logos.mjs`: Claude (spark, wordmark) and PayPal (wordmark), record in
  `public/logos/logos.json`.

## The numbers on screen (all from the seed, Bali = base prices)

| Item | / week | Deposit |
|---|---|---|
| The full setup | $25 | $400 |
| Arc Floor Lamp | $3 | $30 |
| MX Master 3S | $2 | $30 |
| Delivery + setup (Bali, once) | $10 | |

Due today = first week $30 + deposit $460 + delivery $10 = **$500**, then $30 for the last week (Fri, 13 Nov).
Today is Thu, 5 Nov 2026; earliest delivery Fri, 6 Nov; 2 weeks end Thu, 19 Nov.

## Brand-supplied exceptions (lint-film `cinetic:brand-supplied`)

The film shows two real products' screens, so their own looks override the house bans:
- Claude.ai's serif greeting and replies (Source Serif 4 stands in for Anthropic Serif; Inter for Anthropic Sans).
- Claude's terracotta spark and send button, PayPal's gold button, the macOS traffic lights (tagged `ui-state`).
- The Claude and PayPal marks are their current official files, used only to show what Async works with.

## Departures from the cinetic standard, on purpose

- **No audio.** The user asked for a silent demo; no track, no effects, no `npm run sound`.
- **UI at web size under a camera.** Claude's UI is laid out at web px in a 1280x760 window (x1.3 on the stage) and
  the camera scales it 1.0-3.0x; lint's small-text warnings read the web px, not the size on screen.
- **Length.** 37.5 s, longer than the 18-20 s prompt-run template, because the brief asks for the whole flow
  (prompt, tools, interactive pick, payment, settlement).

## Hard bans kept

No invented copy or numbers (every price and string is the product's), no drawn stand-ins for products (real
photos), no sparkles or confetti, no fake metrics, no credits in the picture.
