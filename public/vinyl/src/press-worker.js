// Opening a precut side off the main thread: DPCM unpack of the two walls, then the pressing plant.
// The decoded audio cannot be decoded here (no OfflineAudioContext in workers), so main.js decodes it and
// transfers a copy of each channel in. The walls come back transferred, so nothing is copied on the way out.
import { press, makeVis } from './press.js';

// 16-bit DPCM of the wall slope -> wall displacement (m), in place: q becomes the wall
function unpack(q, n, gain) {
  for (let i = 0; i < 4096 && i < n; i++) { const x = q[i] * 32768; if (Math.abs(x - Math.round(x)) > 0.01) throw new Error('this browser did not decode the record losslessly'); }
  let d = 0;
  for (let i = 0; i < n; i++) { d += Math.round(q[i] * 32768) * gain; q[i] = d; }
  return q.length === n ? q : q.subarray(0, n);
}

self.onmessage = ({ data: m }) => {
  try {
    const rec = { ...m.rec, rTab: m.rTab, wallIn: unpack(m.q0, m.n, m.gain), wallOut: unpack(m.q1, m.n, m.gain) };
    press(rec, m.cond, m.seed);
    const vis = m.makeVis ? makeVis(rec) : null;
    const transfer = [rec.wallIn.buffer, rec.wallOut.buffer, rec.rTab.buffer];
    if (vis) transfer.push(vis.data.buffer);
    self.postMessage({ id: m.id, rec, vis }, transfer);
  } catch (err) { self.postMessage({ id: m.id, error: String((err && err.message) || err) }); }
};
