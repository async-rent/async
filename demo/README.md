# Async in Claude: the demo film

A 37.5 s product demo (1920x1080, 60 fps) built in code with Remotion. It shows Claude.ai using the Async MCP
tools to rent a cozy work setup in Bali for 2 weeks:

1. **Promise.** The Async wordmark and "Rent your setup in Claude" on the Bali world, blurring into the prompt.
2. **Prompt.** The prompt typed on `claude.ai/new` at macro scale, then the camera opens onto the whole page and the user sends it.
3. **Tools.** Claude calls List locations and Search products, then renders the Async **setup picker** (an MCP App) in the chat.
4. **Pick.** The user picks The full setup, the Arc Floor Lamp and the MX Master 3S for 2 weeks; the total rolls to $30 / week, and Continue sends the pick back to Claude.
5. **Rent.** Claude calls Quote rental and Rent, then renders the Async **checkout** (an MCP App) with PayPal's white button.
6. **Pay.** The button is pressed, loads, and turns into "Payment approved · $47.50 paid with PayPal". The PayPal approval step is skipped.
7. **Settle.** Claude calls Confirm payment and confirms the delivery, the next charge and the $7.50 deposit.
8. **End card.** The paid check flies out of the chat and becomes the blue dot of the Async "C" mark. The C settles into the wordmark as "Asyn" reveals from right to left, and "Your comfy setup, everywhere!" lands under it.

Every string comes from the product. Prices are from `packages/db/seed.sql` and the deposit is 25% of the weekly rent ($7.50), tool titles from `tools/mcp`, and the checkout copy from the storefront. See [BRIEF.md](BRIEF.md) for the sources and the exceptions to the house style.

## Where things are

| Path | What it holds |
|---|---|
| `src/demo/script.ts` | every on-screen string, the prices, and every cue (seconds at 60 fps) |
| `src/demo/layout.ts` | the window, the chat blocks and the app internals, in web px |
| `src/demo/story.ts` | the typing, the chat's scroll, the cursor's path and clicks |
| `src/demo/camera.ts` | the camera: one scale and focus per frame |
| `src/demo/DemoFilm.tsx` | the world, the intro, the stage under the camera, the end card |
| `src/demo/ui/ClaudeApp.tsx`, `Composer.tsx`, `chat.tsx` | Claude.ai's chrome, sidebar, composer, bubbles, replies, tool rows |
| `src/demo/ui/AsyncPicker.tsx`, `AsyncCheckout.tsx` | the two Async MCP Apps |
| `public/async/` | Async's logos, product photos and the Bali world plate |
| `public/logos/` | the Claude and PayPal marks (`logos.json` records each source and licence) |

The rest of `src/` (`fx/`, `lib/`, `kit/`, `scenes/`) and `scripts/` come from the cinetic starter. The film uses its easing tokens, cursor and font gate.

## Run it

```sh
npm install
npx tsc --noEmit && node scripts/lint-film.mjs src        # types and the film lint
node scripts/frames.mjs still 900,1500,2100               # stills in out/stills/
bash scripts/render.sh Film out/draft.mp4 --draft         # the whole film at half size, fast
bash scripts/render.sh Film out/film.mp4 --audio public/audio/film.wav   # the master (about 2 minutes; the soundtrack: BRIEF.md "Sound")
npm run studio                                            # scrub it in Remotion Studio
```

To retime a beat, change its cue in `src/demo/script.ts`. Layout changes go in `src/demo/layout.ts`; the camera, the scroll and the end card's flight all read their positions from there.
