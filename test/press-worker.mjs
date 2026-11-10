// press-worker.js must give exactly what main.js used to compute on the main thread (unpack + press).
import { readFileSync } from 'node:fs';
import { press } from '../public/vinyl/src/press.js';

const man = JSON.parse(readFileSync(process.argv[2] || 'public/vinyl/assets/phung-khanh-linh/a/record.json', 'utf8'));
const n = Math.min(man.n, 2e6);                  // a slice is enough to compare sample by sample
const src = () => { const q = new Float32Array(n); for (let i = 0; i < n; i++) q[i] = ((i * 7919) % 2001 - 1000) / 32768; return q; };

// the old main-thread path
const unpackOld = (q) => { const w = new Float32Array(n); let d = 0; for (let i = 0; i < n; i++) { d += Math.round(q[i] * 32768) * man.gain; w[i] = d; } return w; };
const ref = press({ ...man.rec, n, rTab: Float64Array.from(man.rTab), wallIn: unpackOld(src()), wallOut: unpackOld(src()) }, man.press.cond, man.press.seed);

// the worker, driven the way main.js drives it
let reply;
globalThis.self = { postMessage: (r) => { reply = r; } };
await import('../public/vinyl/src/press-worker.js');
const q0 = src(), q1 = src();
self.onmessage({ data: { id: 1, rec: { ...man.rec, n }, rTab: Float64Array.from(man.rTab), n, gain: man.gain, q0, q1, cond: man.press.cond, seed: man.press.seed, makeVis: false } });
if (reply.error) throw new Error(reply.error);

const same = (a, b) => a.length === b.length && a.every((v, i) => v === b[i]);
const ok = same(reply.rec.wallIn, ref.wallIn) && same(reply.rec.wallOut, ref.wallOut)
  && JSON.stringify(reply.rec.scratches) === JSON.stringify(ref.scratches) && JSON.stringify(reply.rec.warp) === JSON.stringify(ref.warp)
  && JSON.stringify(reply.rec.ecc) === JSON.stringify(ref.ecc);
console.log(ok ? 'press-worker: identical to the main-thread path' : 'press-worker: MISMATCH');
process.exit(ok ? 0 : 1);
