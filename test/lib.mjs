// Offline harness: cut a record from a signal, play it through the physics, return the output.
import { cut } from '../public/vinyl/src/cut.js';
import { press } from '../public/vinyl/src/press.js';
import { Engine } from '../public/vinyl/src/engine.js';
import { alphaForRadius, grooveRadius } from '../public/vinyl/src/geometry.js';

export const CLEAN = { noise: 0, dust: 0, scratches: 0, warp: 0, offCenter: 0, echo: 0 };

export function makeRecord(gen, seconds, fs = 48000, cond = CLEAN, opts = {}) {
  const n = Math.round(seconds * fs), L = new Float32Array(n), R = new Float32Array(n);
  for (let i = 0; i < n; i++) { const v = gen(i / fs, i); if (typeof v === 'number') { L[i] = v; R[i] = v; } else { L[i] = v[0]; R[i] = v[1]; } }
  return press(cut([{ L, R }], fs, opts), cond);
}

// Drop the needle at groove angle `theta` (already spinning), settle, then capture `seconds`.
export function play(rec, { fs = 48000, theta, seconds = 1, settle = 2.5, setup, quiet = false } = {}) {
  const e = new Engine(fs);
  e.setRecord(rec);
  e.p.preNoise = quiet ? 0 : e.p.preNoise; if (quiet) { e.p.rumble = 0; e.p.flutter = 0; }
  if (setup) setup(e);
  e.setMotor(true); e.wp = e.wSet;
  const th = theta ?? rec.tracks[0].theta0;
  e.al = alphaForRadius(grooveRadius(rec.rTab, th) - 20e-6); e.zb = 0.6e-3; e.zcue = 0.6e-3; e.cueUp = false;
  const blk = 4800, a = new Float32Array(blk), b = new Float32Array(blk);
  const t0 = performance.now();
  for (let i = 0; i < Math.round(settle * fs / blk); i++) e.process(a, b, blk);
  const thetaStart = e.tel.theta;
  const n = Math.round(seconds * fs), L = new Float32Array(n), R = new Float32Array(n);
  let tel = null;
  e.telemetry();
  for (let o = 0; o < n; o += blk) {
    const c = Math.min(blk, n - o);
    e.process(a, b, c); L.set(a.subarray(0, c), o); R.set(b.subarray(0, c), o);
  }
  tel = e.telemetry();
  return { L, R, e, tel, thetaStart, cpu: (performance.now() - t0) / 1000 / (settle + seconds) };
}

// amplitude + phase of a sinusoid at f via quadrature correlation
export function tone(x, f, fs) {
  let c = 0, s = 0; const n = x.length;
  for (let i = 0; i < n; i++) { const w = 0.5 - 0.5 * Math.cos(2 * Math.PI * i / n), ph = 2 * Math.PI * f * i / fs; c += x[i] * w * Math.cos(ph); s += x[i] * w * Math.sin(ph); }
  return 4 * Math.hypot(c, s) / n;
}
export const rms = (x) => { let a = 0; for (let i = 0; i < x.length; i++) a += x[i] * x[i]; return Math.sqrt(a / x.length); };
export const dB = (v) => 20 * Math.log10(Math.max(v, 1e-12));

// in-place radix-2 FFT
export function fft(re, im) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) { let bit = n >> 1; for (; j & bit; bit >>= 1) j ^= bit; j ^= bit; if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; } }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = -2 * Math.PI / len, wr = Math.cos(ang), wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cr = 1, ci = 0;
      for (let k = 0; k < len / 2; k++) {
        const a = i + k, b = a + len / 2, xr = re[b] * cr - im[b] * ci, xi = re[b] * ci + im[b] * cr;
        re[b] = re[a] - xr; im[b] = im[a] - xi; re[a] += xr; im[a] += xi;
        const t = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = t;
      }
    }
  }
}
// Hann-windowed amplitude spectrum (peak amplitude of a sinusoid per bin). Returns { amp, hz }.
export function spectrum(x, fs, n = 32768) {
  const re = new Float64Array(n), im = new Float64Array(n);
  for (let i = 0; i < n; i++) re[i] = x[i] * (0.5 - 0.5 * Math.cos(2 * Math.PI * i / n));
  fft(re, im);
  const amp = new Float64Array(n / 2);
  for (let i = 0; i < n / 2; i++) amp[i] = 4 * Math.hypot(re[i], im[i]) / n;
  return { amp, hz: fs / n };
}
// amplitude of the strongest line within +-tol (fraction) of f, summing the Hann main lobe
export function line(sp, f, tol = 0.01) {
  const lo = Math.floor(f * (1 - tol) / sp.hz), hi = Math.ceil(f * (1 + tol) / sp.hz);
  let best = 0, bi = lo;
  for (let i = Math.max(1, lo); i <= hi; i++) if (sp.amp[i] > best) { best = sp.amp[i]; bi = i; }
  let p = 0; for (let i = bi - 2; i <= bi + 2; i++) p += sp.amp[i] * sp.amp[i];
  return Math.sqrt(p / 1.5);
}
// rms in a band, from the spectrum
export function band(sp, f0, f1) {
  let p = 0; for (let i = Math.ceil(f0 / sp.hz); i < f1 / sp.hz && i < sp.amp.length; i++) p += sp.amp[i] * sp.amp[i];
  return Math.sqrt(p / 1.5 / 2);
}
