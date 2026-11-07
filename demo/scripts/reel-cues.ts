// Writes the reel's picture events in film frames (the hook's cues and the demo's, remapped):
//   out/reel-cues.json  every visible event, for earshot timeline / sheet / critique (--cues)
//   out/reel-sfx.json   the events that get an effect, with their role and how the take aligns (scripts/reel-sfx.py)
// No typing sounds, by request. Run: npx tsx scripts/reel-cues.ts
import fs from 'node:fs';
import { CUE as DEMO } from '../src/demo/script';
import { CUE, FPS, filmOfDemo, TOTAL } from '../src/reel/timeline';

const D = (k: keyof typeof DEMO) => Math.round(filmOfDemo(DEMO[k]) * 1000) / 1000;

const hook = ['lineA', 'lineB', 'lineB2', 'tiles', 'lineC', 'lineC2', 'gather', 'drop', 'lineD', 'demo'] as const;
const demo = ['send', 'app1', 'pickSetup', 'pickLamp', 'pickMouse', 'continue', 'app2', 'pay', 'paid', 'endLand', 'endWord', 'endTag'] as const;

const events = [
  ...hook.map((k) => ({ f: CUE[k], name: `hook.${k}` })),
  ...demo.map((k) => ({ f: Math.round(D(k)), name: `demo.${k}` })),
].sort((a, b) => a.f - b.f);

/** align: 'onset' puts the take's attack on the frame; 'peak' puts its loudest moment there (a whoosh's apex, a boom). */
type Sfx = { f: number; role: 'click' | 'success'; align: 'onset' | 'peak'; id: string };
const sfx: Sfx[] = [
  // no whoosh on any motion, by request: the tiles gather into the card under the music's stop-down alone
  // every press of the cursor
  ...(['send', 'pickSetup', 'pickLamp', 'pickMouse', 'continue', 'pay'] as const).map((k) => ({ f: D(k), role: 'click' as const, align: 'onset' as const, id: k })),
  // PayPal's button turns into "Payment approved"
  { f: D('paid'), role: 'success', align: 'onset', id: 'paid' },
  // the closing logo motion plays in silence (no effects, no music hit, by request)
];
/** The logo pop's frame: the music has faded out just before it, so its re-entry hit there never sounds. */
const musicOut = D('endLand');

fs.mkdirSync('out', { recursive: true });
fs.writeFileSync('out/reel-cues.json', JSON.stringify({ fps: FPS, events }, null, 1));
fs.writeFileSync('out/reel-sfx.json', JSON.stringify({ fps: FPS, total: TOTAL, musicOut, events: sfx }, null, 1));
console.log(`out/reel-cues.json: ${events.length} events; out/reel-sfx.json: ${sfx.length} effects; reel ${TOTAL} f (${(TOTAL / FPS).toFixed(2)} s)`);
for (const e of sfx) console.log(`  ${(e.f / FPS).toFixed(3).padStart(7)} s  ${e.role.padEnd(14)} ${e.align.padEnd(5)} ${e.id}`);
