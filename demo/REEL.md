# The reel: hook, turn, demo

**Spec:** 1920x1080@60, 49.9 s, format: hook reel (problem, solution, product in action), audio: licensed track and
recorded effects (no voice-over, no typing sounds, no whoosh on motion, by request).

**Idea.** A nomad got the villa with the pool, and the desk is the dining table; nobody buys a desk for two weeks,
so they rent the setup by the week, and Claude does it for them through Async.

## Script

| Bar | Film s | Line | Picture |
|---|---|---|---|
| 1-2 | 0.0-3.9 | You got the villa with the pool. | the storefront's villa hero at dusk, one slow push |
| 3-4 | 4.0-7.4 | Your desk is / the dining table. | the villa goes soft; the build re-centres (the type event) |
| 5-6 | 7.8-11.2 | Nobody's buying a desk / for two weeks. | catalog products on their tiles, in depth |
| 6-7 | 10.6-11.5 | | the tiles converge into one card: the full setup |
| 7-8 | 11.5-15.2 | So rent it by the week. | on the track's entry the card opens to the frame |
| 9-26 | 15.25-47.1 | Just ask Claude. (then the demo) | the Claude demo in `src/demo`, 4 % faster, its end card landing on bar 26 |
| 26-27 | 47.1-49.9 | | the C and its dot fade in together and grow gently to rest (0.5 s, no overshoot) in silence; the C slides right as "Asyn" reveals right to left; the tagline lands on beat 4 |

## Type

One face for every line the reel says: Josefin Sans (the storefront's heading face, `FONT.asyncHead`), set
small: 80 px for a line, 128 px for "the dining table.", 46-62 px for the demo's opening line and tagline. The
product screens keep their own faces. The standalone `Film` keeps Figtree and its original opening line.

## Sources

- **Pictures:** only the catalog: `apps/storefront/public/images/hero-bali-villa.jpg` (graded to the demo's blue hour,
  baked at three blur levels in `public/async/reel/`) and `apps/storefront/public/products/*` (the tiles, the full setup).
- **Music:** "dance floor" by Coverr (Coverr License, no credit needed), 128 BPM, record in
  `audio/music/dance_floor_coverr.licence.json`, edit in `audio/music/edit.json` (film bars 1-6 = source 3-8, intro;
  7-21 = 9-23, the entry on the turn; 22-25 = 29-32, the break under the settle). The edit ends on one hit (`--end hit`, the
  source's re-entry downbeat on bar 26), but the reel never plays it: `reel-sfx.py` fades the music out over the last two
  beats before the logo pop, so the close is silent. Runner-up: "lazers" by
  Coverr (tech house z +3.4, p_real 0.88, flatter: LRA 2 LU).
- **Effects:** Mixkit recordings from the cinetic catalogue (Mixkit Sound Effects Free License, no credit needed;
  records in `audio/sfx/*.licence.json`, audio git-ignored), chosen with earshot (`out/reel/sfx-audition*.py`):

  | Role | Take | earshot |
  |---|---|---|
  | the six cursor presses | mixkit-275, one click trimmed | "a single computer mouse button click" strong, z +3.9; p_real 0.94 |
  | Payment approved | mixkit-2575 | "a success chime" z +4.1; beat the bell chime in an A/B (z +3.0 vs +1.8) |

  No whoosh on any motion, by request: the tiles gather into the card under the music's stop-down alone (the
  mixkit-168 whoosh there was dropped). The closing logo motion has no effect and no music hit: the music has faded
  out before it.

  `npx tsx scripts/reel-cues.ts` writes the cue frames from the timeline; `python scripts/reel-sfx.py` levels each take
  against the music around its cue (no ducking), fades the music out before the logo pop (a low hall tail on the fade) and masters to -14 LUFS, -1.5 dBTP.

## Departures, on purpose

- **No typing sounds,** by request: the prompt types under the music alone.
- **Own mixer.** The effects are mixed by `scripts/reel-sfx.py`, not the template's `score.py` cue pipeline (wired to
  the starter timeline); `score.py --bed-only` still renders the edited music with its two stop-downs.
- **The demo is retimed, not re-cut.** `DEMO_RATE` in `src/reel/timeline.ts` plays it 4 % faster so its end card lands
  on the track's last hit; the reel closes 1.3 s before the demo's own last frame, fading with the ring.
- **Problem first.** The brief opens on the problem, so the name arrives at 15.3 s (the demo's wordmark), not by 3 s;
  `copy-check.py` flags that, and the end card's tagline (the brand's own, with its "!").
- **Upscaled villa.** The catalog's villa photo is 1360 px wide; it plays graded, pushed slowly and mostly defocused.

## Rebuild

```sh
export PYTHON=$PWD/.tools/venv/bin/python
node scripts/py.mjs scripts/audio/score.py --score audio/score.json --bed-only --out public/audio/reel-bed.wav
npx tsx scripts/reel-cues.ts && $PYTHON scripts/reel-sfx.py          # -> public/audio/reel.wav
bash scripts/render.sh Reel out/reel.mp4 --audio public/audio/reel.wav
```
