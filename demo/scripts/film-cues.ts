// Writes the Film's picture events in frames (src/demo/script.ts):
//   out/film-cues.json  every visible event, for earshot timeline / sheet / critique (--cues)
//   out/film-sfx.json   the events that get an effect, with their role and how the take aligns (scripts/reel-sfx.py --film)
// Effects only on the cursor's presses and on "Payment approved", by request: no typing sounds and no whoosh on any
// motion (the camera, the apps mounting, the check's flight, the end card). Run: npx tsx scripts/film-cues.ts
import fs from 'node:fs';
import { CUE, FPS, TOTAL } from '../src/demo/script';

const visible = ['mark', 'promise', 'macro', 'typeStart', 'send', 'app1', 'pickSetup', 'pickLamp', 'pickMouse', 'continue', 'app2', 'pay', 'paid', 'endFly', 'endLand', 'endWord', 'endTag'] as const;
const events = visible.map((k) => ({ f: CUE[k], name: `demo.${k}` }));

type Sfx = { f: number; role: 'click' | 'success'; align: 'onset'; id: string };
const sfx: Sfx[] = [
  // every press of the cursor
  ...(['send', 'pickSetup', 'pickLamp', 'pickMouse', 'continue', 'pay'] as const).map((k) => ({ f: CUE[k], role: 'click' as const, align: 'onset' as const, id: k })),
  // PayPal's button turns into "Payment approved"
  { f: CUE.paid, role: 'success', align: 'onset', id: 'paid' },
];

fs.mkdirSync('out', { recursive: true });
fs.writeFileSync('out/film-cues.json', JSON.stringify({ fps: FPS, events }, null, 1));
fs.writeFileSync('out/film-sfx.json', JSON.stringify({ fps: FPS, total: TOTAL, events: sfx }, null, 1));
console.log(`out/film-cues.json: ${events.length} events; out/film-sfx.json: ${sfx.length} effects; film ${TOTAL} f (${(TOTAL / FPS).toFixed(2)} s)`);
for (const e of sfx) console.log(`  ${(e.f / FPS).toFixed(3).padStart(7)} s  ${e.role.padEnd(8)} ${e.align.padEnd(5)} ${e.id}`);
