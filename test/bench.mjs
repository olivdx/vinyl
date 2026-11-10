// CPU cost of the engine in user-CPU seconds per second of audio (robust to a busy machine).
import { makeRecord, play } from './lib.mjs';
import { Engine } from '../public/vinyl/src/engine.js';
const fs = 48000;
const rec = makeRecord((t) => 0.25 * Math.sin(2 * Math.PI * 1000 * t) + 0.1 * Math.sin(2 * Math.PI * 7000 * t), 20, fs);
const a = new Float32Array(128), b = new Float32Array(128);
const cost = (e, secs = 1) => { const c0 = process.cpuUsage().user; for (let i = 0; i < secs * fs / 128; i++) e.process(a, b, 128); return ((process.cpuUsage().user - c0) / 1e6 / secs).toFixed(3); };
const o = play(rec, { fs, seconds: 0.1, settle: 2.5 });
const t = []; for (let rep = 0; rep < 10; rep++) t.push(cost(o.e));
console.log('playing:', t.join(' '));
const e = new Engine(fs); e.setRecord(rec); const u = []; for (let rep = 0; rep < 5; rep++) u.push(cost(e));
console.log('lifted: ', u.join(' '));
