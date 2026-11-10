// Frequency response + distortion at the outer and inner groove, for each stylus.
import { makeRecord, play, spectrum, line, dB, CLEAN } from './lib.mjs';
const fs = 48000, F = [30, 60, 120, 400, 1000, 3000, 6000, 10000, 14000, 18000], A = 0.025;
const gen = (t) => { let v = 0; for (const f of F) v += A * Math.sin(2 * Math.PI * f * t + f); return v; };
for (const inner of [false, true]) {
  for (const stylus of ['conical', 'elliptical', 'microline']) {
    const rec = makeRecord(gen, 12, fs, CLEAN, { cutPeak: 0.035 });
    if (inner) for (let k = 0; k < rec.rTab.length; k++) rec.rTab[k] = Math.max(0.0532, rec.rTab[k] - 0.084);
    const o = play(rec, { fs, seconds: 1, settle: 4, quiet: true, setup: (e) => e.setStylus(stylus) });
    const sp = spectrum(o.L, fs);
    const row = F.map((f) => dB(line(sp, f) / A).toFixed(1).padStart(5)).join(' ');
    console.log((inner ? 'inner r=' : 'outer r=') + (o.tel.r * 1000).toFixed(0), stylus.padEnd(10), row, ' loss', o.tel.loss.toFixed(3), 'blown', o.e.blown | 0);
  }
}
console.log('freq (Hz):               ', F.map((f) => String(f).padStart(5)).join(' '));
