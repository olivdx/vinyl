// Main-thread cost of opening a precut side (main.js loadPrecompiled): DPCM unpack + pressing, on a real manifest.
// Run: node --max-old-space-size=4096 test/load-bench.mjs [path/to/record.json]
import { readFileSync } from 'node:fs';
import { press } from '../public/vinyl/src/press.js';

const file = process.argv[2] || 'public/vinyl/assets/bao-tang-cua-nuoi-tiec/b/record.json';
const man = JSON.parse(readFileSync(file, 'utf8'));
const n = man.n, ms = (t0) => (performance.now() - t0).toFixed(0) + ' ms';
console.log(`${file}: ${(n / 1e6).toFixed(1)}M samples per wall`);

const q = new Float32Array(n);                     // what decodeAudioData hands back for one channel
for (let i = 0; i < n; i++) q[i] = ((i * 7919) % 2001 - 1000) / 32768;
const unpack = () => { const w = new Float32Array(n); let d = 0; for (let i = 0; i < n; i++) { d += Math.round(q[i] * 32768) * man.gain; w[i] = d; } return w; };

let t0 = performance.now();
const wallIn = unpack(), wallOut = unpack();
console.log('unpack, both walls:', ms(t0));

t0 = performance.now();
press({ ...man.rec, rTab: Float64Array.from(man.rTab), wallIn, wallOut }, man.press.cond, man.press.seed);
console.log('press:', ms(t0));
console.log(`memory held by the walls: ${(2 * n * 4 / 1e6).toFixed(0)} MB (+ the decoded audio, same again, until it is collected)`);
