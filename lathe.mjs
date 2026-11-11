// Precompile records so the page does no DSP to put one on:
//   the house record (src/demo.js + any audio files in songs/)  -> lathe -> default pressing -> assets/
//   each shelf record (src/records.js, its audio in records/)   -> lathe -> default pressing -> assets/<id>/
// The pressed groove walls are stored as 16-bit DPCM (wall slope per sample) inside a lossless audio
// container, which the browser decodes natively.
// The results are committed, so the site build (build.mjs) and deploys never run this. Run it by hand after
// changing a song or the lathe: `npm run lathe` (node lathe.mjs all) re-cuts every record that is out of date,
// `node lathe.mjs` the house record, `node lathe.mjs <id> ...` just those shelf records. Needs ffmpeg.
import { spawnSync } from 'node:child_process';
import { mkdirSync, readdirSync, readFileSync, writeFileSync, renameSync, rmSync, statSync, copyFileSync, existsSync } from 'node:fs';
import { join, extname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { demoTracks } from './public/vinyl/src/demo.js';
import { cut } from './public/vinyl/src/cut.js';
import { press, makeVis, DEFAULT_CONDITION } from './public/vinyl/src/press.js';
import { RECORDS } from './public/vinyl/src/records.js';

const root = fileURLToPath(new URL('.', import.meta.url)), assets = join(root, 'public', 'vinyl', 'assets'), songsDir = join(root, 'songs'), recordsDir = join(root, 'public', 'vinyl', 'records');
const FS = 48000, SEED = 7, STEP = 0.5e-9, HOUSE_CUT = { maxExtra: 150e-6 };
const LATHE = ['lathe.mjs', 'public/vinyl/src/demo.js', 'public/vinyl/src/cut.js', 'public/vinyl/src/press.js', 'public/vinyl/src/dsp.js', 'public/vinyl/src/geometry.js'];
const ffmpeg = spawnSync('ffmpeg', ['-version']).status === 0, ffprobe = spawnSync('ffprobe', ['-version']).status === 0;
const t0 = Date.now(), log = (...a) => console.log(`[build +${((Date.now() - t0) / 1000).toFixed(1)}s]`, ...a);
mkdirSync(assets, { recursive: true });

// one lathe at a time: if two are started, the second just leaves
const lock = join(assets, '.building');
try {
  const pid = +readFileSync(lock, 'utf8');
  if (pid && pid !== process.pid) { process.kill(pid, 0); log(`another build is running (pid ${pid}), leaving it to finish`); process.exit(0); }
} catch {}   // no lock, or the build that held it is gone
writeFileSync(lock, String(process.pid));
process.on('exit', () => { try { rmSync(lock); } catch {} });
for (const s of ['SIGINT', 'SIGTERM']) process.on(s, () => process.exit(1));

// ---- songs ----
function decode(file, title) {
  const r = spawnSync('ffmpeg', ['-v', 'error', '-i', file, '-f', 'f32le', '-ac', '2', '-ar', String(FS), 'pipe:1'], { maxBuffer: Infinity });
  if (r.status !== 0) throw new Error(`ffmpeg could not decode ${file}: ${r.stderr}`);
  const f = new Float32Array(r.stdout.buffer.slice(r.stdout.byteOffset, r.stdout.byteOffset + (r.stdout.byteLength & ~3)));
  const n = f.length >> 1, L = new Float32Array(n), R = new Float32Array(n);
  for (let i = 0; i < n; i++) { L[i] = f[2 * i]; R[i] = f[2 * i + 1]; }
  return { L, R, title: title ?? basename(file, extname(file)).replace(/^\d+[\s._-]+/, '') };
}
function songs() {
  try { return readdirSync(songsDir).filter((f) => /\.(wav|flac|mp3|m4a|aac|ogg|opus|aiff?)$/i.test(f)).sort(); } catch { return []; }
}
function houseTracks() {
  const tracks = demoTracks(FS), files = songs();
  if (files.length && !ffmpeg) log('songs/ has audio files but ffmpeg is not installed; skipping them');
  else for (const f of files) tracks.push(decode(join(songsDir, f)));
  return tracks;
}

// ---- containers ----
function container(out, name, pcm, fmt) {     // pcm: Buffer of interleaved stereo little-endian samples
  if (ffmpeg) {
    const r = spawnSync('ffmpeg', ['-v', 'error', '-y', '-f', fmt, '-ar', String(FS), '-ac', '2', '-i', 'pipe:0', '-c:a', 'flac', '-compression_level', '8', join(out, name + '.flac')], { input: pcm, maxBuffer: Infinity });
    if (r.status === 0) return name + '.flac';
    log('ffmpeg flac encode failed, writing wav instead:', String(r.stderr).trim());
  }
  const bytes = fmt === 's16le' ? 2 : 3, h = Buffer.alloc(44);
  h.write('RIFF', 0); h.writeUInt32LE(36 + pcm.length, 4); h.write('WAVEfmt ', 8); h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(2, 22);
  h.writeUInt32LE(FS, 24); h.writeUInt32LE(FS * 2 * bytes, 28); h.writeUInt16LE(2 * bytes, 32); h.writeUInt16LE(8 * bytes, 34); h.write('data', 36); h.writeUInt32LE(pcm.length, 40);
  writeFileSync(join(out, name + '.wav'), Buffer.concat([h, pcm]));
  return name + '.wav';
}

// ---- one record: tracks -> out/record.{flac,vis,json} (+ out/source.flac when keepSource) ----
function build({ id, out, load, cutOpts, keepSource, peaks, extra }) {
  mkdirSync(out, { recursive: true });
  const tracks = load();
  log(`${id}: ${tracks.length} tracks:`, tracks.map((t) => `${t.title} (${(t.L.length / FS).toFixed(0)}s)`).join(', '));

  // The lathe. What ships is the CLEAN cut: the walls as closed-loop 16-bit DPCM in 0.5 nm steps, so the
  // decoded wall is within a quarter of a nanometre of the cut one everywhere. The pressing (wall roughness,
  // dust, scratches, groove echo) is random but seeded, so it is not downloaded: the page presses the decoded
  // cut itself with the same seed. Roughly half of the old file was that noise.
  // a side that does not fit is cut quieter (the groove swings less, so the turns can sit closer), as a mastering engineer would
  let rec;
  for (const p of peaks || [cutOpts.cutPeak]) {
    rec = cut(tracks, FS, p == null ? cutOpts : { ...cutOpts, cutPeak: p });
    if (p != null) cutOpts = { ...cutOpts, cutPeak: p };
    if (!rec.truncated) break;
    log(`${id}: does not fit one side at cutPeak ${p}, cutting quieter`);
  }
  const { wallIn, wallOut, n } = rec;
  let peak = 0;
  for (const w of [wallIn, wallOut]) for (let i = 1; i < n; i++) { const d = Math.abs(w[i] - w[i - 1]); if (d > peak) peak = d; }
  const gain = Math.max(STEP, peak * 1.02 / 32767), q = new Int16Array(2 * n);
  let err2 = 0, errMax = 0;
  [wallIn, wallOut].forEach((w, ch) => {
    let d = 0;
    for (let i = 0; i < n; i++) {
      const s = Math.max(-32767, Math.min(32767, Math.round((w[i] - d) / gain)));
      q[2 * i + ch] = s; d += s * gain;
      const e = Math.abs(d - w[i]); err2 += e * e; if (e > errMax) errMax = e;
      w[i] = d;                                  // from here on, work with exactly what the page will decode
    }
  });
  const walls = container(out, 'record', Buffer.from(q.buffer), 's16le');
  log(`${id}: cut: ${(rec.thetaEnd / (2 * Math.PI)).toFixed(0)} revolutions, ${n} groove samples${rec.truncated ? ' (programme truncated to fit one side)' : ''}`);
  log(`${id}: walls -> ${walls}: step ${(gain * 1e9).toFixed(3)} nm, error rms ${(Math.sqrt(err2 / (2 * n)) * 1e9).toFixed(3)} nm, max ${(errMax * 1e9).toFixed(3)} nm`);

  // the default pressing, only to draw the disc (record.vis) and to record its scratches / warp in the manifest
  press(rec, DEFAULT_CONDITION, SEED);
  const vis = makeVis(rec);

  // the songs themselves (24-bit), only fetched if the record is pressed again with other settings.
  // Shelf records skip this: their master tape is already the audio in records/.
  let source;
  if (keepSource) {
    const total = tracks.reduce((a, t) => a + t.L.length, 0), pcm = Buffer.alloc(total * 6);
    let o = 0;
    for (const t of tracks) for (let i = 0; i < t.L.length; i++) {
      pcm.writeIntLE(Math.round(Math.max(-1, Math.min(1, t.L[i])) * 8388607), o, 3); pcm.writeIntLE(Math.round(Math.max(-1, Math.min(1, t.R[i])) * 8388607), o + 3, 3); o += 6;
    }
    source = { file: container(out, 'source', pcm, 's24le'), tracks: tracks.map((t) => ({ title: t.title, n: t.L.length })) };
  }
  writeFileSync(join(out, 'record.vis'), Buffer.from(vis.data.buffer, vis.data.byteOffset, vis.data.byteLength));

  const manifest = {
    version: 2, id, built: new Date().toISOString(), fs: FS, walls, gain, n, press: { seed: SEED, cond: DEFAULT_CONDITION },
    vis: { file: 'record.vis', cols: vis.cols, rows: vis.rows },
    source, cutOpts, seed: SEED, ...extra,
    rec: {
      fs: rec.fs, spr: rec.spr, n, thetaEnd: rec.thetaEnd, thetaLock: rec.thetaLock, W: rec.W, Vfs: rec.Vfs, deEssDb: rec.deEssDb, truncated: rec.truncated,
      tracks: rec.tracks, ecc: rec.ecc, warp: rec.warp, scratches: rec.scratches, condition: rec.condition,
    },
    rTab: Array.from(rec.rTab),
  };
  writeFileSync(join(out, 'record.json.tmp'), JSON.stringify(manifest));
  renameSync(join(out, 'record.json.tmp'), join(out, 'record.json'));      // manifest last, atomically
  const mb = (f) => (statSync(join(out, f)).size / 1e6).toFixed(1) + ' MB';
  log(`${id}: done: ${walls} ${mb(walls)}${source ? `, ${source.file} ${mb(source.file)}` : ''}, record.vis ${mb('record.vis')}, record.json ${mb('record.json')}`);
}

// ---- albums: albums/<folder>/ holds the songs (any audio ffmpeg reads) and cover.jpg or cover.png ----
// Each album becomes a set of LP sides: as many as it needs at up to SIDE_MAX each (always an even number, two to a
// disc), the songs kept in order and spread so the sides come out as even as they can. albums/<folder>/album.json may
// override { title, by, sides } and set vinyl: "#rrggbb" or { color, clear: 0..1 } for a coloured pressing. Output: public/vinyl/assets/<album>/<side>/, public/covers/<album>.<ext> and
// public/vinyl/library.json, which the page reads.
const albumsDir = join(root, 'albums'), coversDir = join(root, 'public', 'covers'), libFile = join(root, 'public', 'vinyl', 'library.json');
const AUDIO = /\.(flac|mp3|wav|m4a|aac|ogg|opus|aiff?)$/i, SIDE_MAX = 20 * 60, PEAKS = [0.1, 0.085, 0.075, 0.065, 0.055, 0.045];
const slug = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'album';
function probe(file) {
  const r = spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration:format_tags', '-of', 'json', file], { encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`ffprobe could not read ${file}: ${r.stderr}`);
  const f = JSON.parse(r.stdout).format, tag = Object.fromEntries(Object.entries(f.tags || {}).map(([k, v]) => [k.toLowerCase(), v]));
  return { len: +f.duration, title: tag.title, artist: tag.artist, album: tag.album, albumArtist: tag.album_artist || tag.albumartist, track: parseInt(tag.track, 10) };
}
// split lens (in order) into k runs, making the longest run as short as possible
function partition(lens, k) {
  const n = lens.length, pre = [0]; for (const l of lens) pre.push(pre.at(-1) + l);
  const best = Array.from({ length: k + 1 }, () => new Array(n + 1).fill(Infinity)), cutAt = Array.from({ length: k + 1 }, () => new Array(n + 1).fill(0));
  best[0][0] = 0;
  for (let j = 1; j <= k; j++) for (let i = 1; i <= n; i++) for (let m = j - 1; m < i; m++) {
    const v = Math.max(best[j - 1][m], pre[i] - pre[m]);
    if (v < best[j][i]) { best[j][i] = v; cutAt[j][i] = m; }
  }
  const runs = []; for (let j = k, i = n; j > 0; j--) { const m = cutAt[j][i]; runs.unshift([m, i]); i = m; }
  return runs;
}
function albumPlans() {
  let dirs = []; try { dirs = readdirSync(albumsDir, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name).sort(); } catch {}
  return dirs.map((name) => {
    const dir = join(albumsDir, name), files = readdirSync(dir), over = existsSync(join(dir, 'album.json')) ? JSON.parse(readFileSync(join(dir, 'album.json'), 'utf8')) : {};
    const songs = files.filter((f) => AUDIO.test(f)).map((f) => ({ file: f, ...probe(join(dir, f)) }))
      .sort((a, b) => (a.track || 1e9) - (b.track || 1e9) || a.file.localeCompare(b.file, undefined, { numeric: true }));
    if (!songs.length) return null;
    const total = songs.reduce((a, t) => a + t.len, 0), n = over.sides || Math.max(2, 2 * Math.ceil(total / SIDE_MAX / 2));
    const id = slug(over.id || name), coverFile = files.find((f) => /^cover\.(jpe?g|png)$/i.test(f));
    const by = over.by || songs[0].albumArtist || (songs[0].artist || '').split(';')[0] || name;
    const sides = partition(songs.map((t) => t.len), Math.min(n, songs.length)).map(([a, b], i) => {
      const letter = String.fromCharCode(65 + i), tracks = songs.slice(a, b);
      return {
        id: `${id}-${letter.toLowerCase()}`, album: id, disc: (i >> 1) + 1, side: letter, title: `Side ${letter}`, dir: `assets/${id}/${letter.toLowerCase()}/`,
        tracks: tracks.map((t) => ({ title: t.title || t.file.replace(AUDIO, '').replace(/^\d+[\s._-]+/, ''), by: (t.artist || by).split(';').join(', '), len: Math.round(t.len), file: t.file })),
        sources: tracks.map((t) => { const st = statSync(join(dir, t.file)); return `${t.file}|${st.size}|${Math.round(st.mtimeMs)}`; }),
      };
    });
    const ext = coverFile ? extname(coverFile).toLowerCase().replace('.jpeg', '.jpg') : '';
    return { id, name, dir, title: over.title || songs[0].album || name, by, vinyl: over.vinyl, coverFile, cover: coverFile ? `covers/${id}${ext}` : null, discs: Math.ceil(sides.length / 2), sides };
  }).filter(Boolean);
}
function writeLibrary(plans) {
  const fromPlans = plans.map(({ id, title, by, vinyl, cover, discs, sides }) => ({
    id, title, by, ...(vinyl && { vinyl }), cover, discs,
    sides: sides.filter((s) => existsSync(join(root, 'public', 'vinyl', s.dir, 'record.json')))
      .map(({ id, album, disc, side, title, dir, tracks }) => ({ id, album, disc, side, title, dir, tracks: tracks.map(({ file, ...t }) => t) })),
  })).filter((a) => a.sides.length);
  const planIds = new Set(fromPlans.map((a) => a.id));
  let kept = [];
  try {
    const prev = JSON.parse(readFileSync(libFile, 'utf8'));
    // Albums cut earlier (e.g. mck, starboy) stay listed until their assets are gone, even if albums/<folder>/ has no songs.
    kept = (prev.albums || []).filter(
      (a) => !planIds.has(a.id) && (a.sides || []).some((s) => existsSync(join(root, 'public', 'vinyl', s.dir || `assets/${s.id}/`, 'record.json'))),
    );
  } catch {}
  const albums = [...kept, ...fromPlans];
  writeFileSync(libFile, JSON.stringify({ albums }, null, 1));
  log(`library: ${albums.map((a) => `${a.title} (${a.sides.length} sides)`).join(', ') || 'no albums'} -> public/vinyl/library.json`);
}

// ---- what to build ----
const jobs = [
  { id: 'house', out: assets, inputs: [...LATHE, 'songs', ...songs().map((f) => 'songs/' + f)], load: houseTracks, cutOpts: HOUSE_CUT, keepSource: false },   // pressing again no longer needs the tape
  ...RECORDS.filter((r) => r.tracks).map((r) => ({
    id: r.id, out: join(assets, r.id), inputs: [...LATHE, 'public/vinyl/src/records.js', ...r.tracks.map((k) => 'public/vinyl/records/' + k.file)],
    load: () => r.tracks.map((k) => decode(join(recordsDir, k.file), k.title)), cutOpts: r.cut || {}, keepSource: false,
  })),
];
const args0 = process.argv.slice(2), wantAlbums = args0.includes('albums') || args0.includes('all');
const plans = wantAlbums && ffprobe ? albumPlans() : [];
if (wantAlbums && !ffprobe) log('albums/: skipped, ffprobe (ffmpeg) is not installed');
for (const a of plans) {
  if (a.coverFile) { mkdirSync(coversDir, { recursive: true }); copyFileSync(join(a.dir, a.coverFile), join(root, 'public', a.cover)); }
  log(`${a.title} by ${a.by}: ${a.sides.length} sides: ` + a.sides.map((s) => `${s.side} ${(s.tracks.reduce((x, t) => x + t.len, 0) / 60).toFixed(1)} min`).join(', '));
  for (const s of a.sides) jobs.push({
    id: s.id, album: a.id, out: join(root, 'public', 'vinyl', s.dir), inputs: [], sources: s.sources,
    load: () => s.tracks.map((k) => decode(join(a.dir, k.file), k.title)), cutOpts: {}, peaks: PEAKS, keepSource: false, extra: { sources: s.sources },
  });
}
const mtime = (f) => { try { return statSync(f).mtimeMs; } catch { return 0; } };
const fresh = (j) => {
  if (j.sources) {            // an album side: up to date when it was cut from exactly these files (name, size, time)
    try { return JSON.stringify(JSON.parse(readFileSync(join(j.out, 'record.json'), 'utf8')).sources) === JSON.stringify(j.sources); } catch { return false; }
  }
  return mtime(join(j.out, 'record.json')) > Math.max(...j.inputs.map((f) => mtime(join(root, f))));
};
const args = process.argv.slice(2), all = args.includes('all'), want = args.length ? args : ['house'];
for (const id of want) if (id !== 'all' && id !== 'albums' && !jobs.some((j) => j.id === id || j.album === id)) log(`no such record: ${id} (have: ${jobs.map((j) => j.id).join(', ')})`);
for (const j of jobs) {
  if ((all || (j.album && want.includes('albums'))) ? fresh(j) : !want.includes(j.id) && !want.includes(j.album)) continue;
  if (j.id !== 'house' && !ffmpeg) { log(`${j.id}: skipped, ffmpeg is not installed`); continue; }
  try { build(j); } catch (err) { log(`${j.id}: failed:`, err.message || err); process.exitCode = 1; }
}
if (wantAlbums && plans.length) writeLibrary(plans);
