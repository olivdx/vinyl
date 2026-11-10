import { makeRecord, play, tone, rms, dB } from './lib.mjs';
const fs = 48000;
const rec = makeRecord((t) => 0.25 * Math.sin(2 * Math.PI * 1000 * t), 8, fs);
console.log('record: n', rec.n, 'Vfs', rec.Vfs.toFixed(3), 'thetaEnd revs', (rec.thetaEnd / 6.2832).toFixed(1), 'r0', rec.rTab[0], 'rEnd', rec.rTab.at(-1));
const o = play(rec, { fs, seconds: 1, settle: 3, quiet: true });
const a1 = tone(o.L, 1000, fs), a2 = tone(o.L, 2000, fs), a3 = tone(o.L, 3000, fs);
console.log('1k out amp', a1.toFixed(4), '(expect 0.25) R', tone(o.R, 1000, fs).toFixed(4), 'H2', dB(a2 / a1).toFixed(1), 'H3', dB(a3 / a1).toFixed(1));
console.log('rms', rms(o.L).toFixed(4), 'tel', JSON.stringify(o.tel, (k, v) => typeof v === 'number' ? +v.toPrecision(4) : v));
console.log('cpu fraction of realtime', o.cpu.toFixed(3), 'blown', o.e.blown | 0);
