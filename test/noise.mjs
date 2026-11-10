// Surface-noise floor of a silent groove, relative to the 0 dB reference (5 cm/s peak, 1 kHz).
import { makeRecord, play, spectrum, band, rms, dB } from './lib.mjs';
import { DEFAULT_CONDITION } from '../public/vinyl/src/press.js';
const fs = 48000;
for (const [name, cond] of [['roughness only', { ...DEFAULT_CONDITION, dust: 0, scratches: 0, warp: 0, offCenter: 0 }], ['default pressing', DEFAULT_CONDITION]]) {
  const rec = makeRecord((t) => (t < 0.5 ? 0.5 * Math.sin(2 * Math.PI * 1000 * t) : 0), 12, fs, cond);
  const o = play(rec, { fs, seconds: 4, settle: 4, theta: rec.tracks[0].theta0 + 2 * 6.2832 });
  const ref = 0.05 / rec.Vfs / Math.SQRT2;       // output rms of the reference level
  const sp = spectrum(o.L, fs, 131072);
  const b = [[5, 20], [20, 100], [100, 1000], [1000, 5000], [5000, 20000], [20, 20000]].map(([a, c]) => `${a}-${c}Hz ${dB(band(sp, a, c) / ref).toFixed(1)}`);
  let pk = 0; for (const v of o.L) pk = Math.max(pk, Math.abs(v));
  console.log(name.padEnd(17), b.join('  '), ' peak', dB(pk / (ref * Math.SQRT2)).toFixed(1), 'blown', o.e.blown | 0);
}
