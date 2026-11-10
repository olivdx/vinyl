// Runs before any module loads: starts downloading the opening record and drives the progress bar.
// (Ported from the original index.html; records are served from /vinyl/assets/.)
export const BOOT_SCRIPT = `
// Start downloading and decoding the opening record now, before any module has even been requested.
(function () {
  // phones get a short record first: a long side needs several hundred MB of memory once decoded
  var small = matchMedia('(max-width: 760px), (pointer: coarse)').matches;
  var id = 'side-a', dir = '/vinyl/assets/' + id + '/', b = window.__boot = { id: id, dir: dir, got: 0, total: 0 };
  b.man = fetch(dir + 'record.json').then(function (r) { if (!r.ok) throw new Error('no precompiled record'); return r.json(); });
  b.vis = fetch(dir + 'record.vis').then(function (r) { if (!r.ok) throw new Error('no precompiled record'); return r.arrayBuffer(); });
  b.audio = fetch(dir + 'record.flac').then(function (r) {
    if (!r.ok) throw new Error('no precompiled record');
    b.total = +r.headers.get('content-length') || 0;
    if (!r.body) return r.arrayBuffer();
    var reader = r.body.getReader(), chunks = [];
    return (function pump() {
      return reader.read().then(function (x) { if (x.done) return new Blob(chunks).arrayBuffer(); chunks.push(x.value); b.got += x.value.length; return pump(); });
    })();
  }).then(function (buf) { return new OfflineAudioContext(2, 1, 48000).decodeAudioData(buf); });
  b.man.catch(function () {}); b.vis.catch(function () {}); b.audio.catch(function () {});
  // Progress bar. window.__load is whatever is loading right now: { got, total, done }. It is driven from
  // here so it moves before the modules have loaded; it only appears if a load takes more than 300 ms.
  b.t0 = performance.now(); window.__load = b;
  var root = document.documentElement;
  (function frame() {
    var h = window.__load, el = document.getElementById('loader');
    if (el) {
      if (h && !h.done) {
        var now = performance.now(); if (!h.t0) h.t0 = now;
        if (now - h.t0 > 300) root.classList.add('loading');
        var frac = h.total > 0 ? Math.min(1, h.got / h.total) : 0, moving = frac > 0 && frac < 1;
        el.classList.toggle('wait', !moving);
        document.getElementById('loader-fill').style.width = (frac * 100) + '%';
        document.getElementById('loader-pct').dataset.pct = moving ? Math.round(frac * 100) + '%' : '';   // an attribute, not text: React hydrates this element after the script has run
      } else root.classList.remove('loading');
    }
    requestAnimationFrame(frame);
  })();
})();
`;
