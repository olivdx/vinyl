// Upload the album library to Cloudflare R2 (S3 API), keeping the layout the page reads from NEXT_PUBLIC_ALBUMS_URL:
//   library.json, assets/<album>/<side>/*, covers/*
// Only new or changed files are sent (size + MD5 against the object's ETag), so it is cheap to run after every
// `npm run albums`. Objects in the bucket that are no longer in the library are left alone unless --prune is given.
// Needs in .env: R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET.
// Run: npm run r2   (or node --env-file=.env scripts/r2-upload.mjs [--prune] [--dry])
import { S3Client, ListObjectsV2Command, PutObjectCommand, DeleteObjectsCommand } from '@aws-sdk/client-s3';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const pub = join(root, 'public'), vinyl = join(pub, 'vinyl'), libFile = join(vinyl, 'library.json');
const env = (k) => (process.env[k] || '').trim().replace(/^["']|["']$/g, '');   // stray spaces / quotes in .env
const [R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET] = ['R2_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_BUCKET'].map(env);
const prune = process.argv.includes('--prune'), dry = process.argv.includes('--dry');

const missing = Object.entries({ R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET }).filter(([, v]) => !v).map(([k]) => k);
if (missing.length && process.argv.includes('--if-configured')) { console.log('r2: not configured (.env), skipping upload'); process.exit(0); }
if (missing.length) { console.error(`r2: missing ${missing.join(', ')} in .env; nothing uploaded`); process.exit(1); }
if (!existsSync(libFile)) { console.error('r2: public/vinyl/library.json not found; run `npm run albums` first'); process.exit(1); }

const s3 = new S3Client({
  region: 'auto',
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: { accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY },
});

const TYPES = { '.json': 'application/json', '.flac': 'audio/flac', '.wav': 'audio/wav', '.vis': 'application/octet-stream', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp' };
const walk = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)]));
const md5 = (file) => createHash('md5').update(readFileSync(file)).digest('hex');

// what to send: the library, every side it names, and the covers it names
const lib = JSON.parse(readFileSync(libFile, 'utf8'));
const files = new Map([['library.json', libFile]]);
for (const a of lib.albums || []) {
  if (a.cover && existsSync(join(pub, a.cover))) files.set(a.cover, join(pub, a.cover));
  for (const s of a.sides) {
    const dir = join(vinyl, s.dir || `assets/${s.id}/`);
    if (!existsSync(dir)) { console.warn(`r2: ${s.id}: ${relative(root, dir)} missing, skipped`); continue; }
    for (const f of walk(dir)) files.set(relative(vinyl, f).split('\\').join('/'), f);
  }
}

// what is there already
const remote = new Map();
for (let token; ;) {
  const r = await s3.send(new ListObjectsV2Command({ Bucket: R2_BUCKET, ContinuationToken: token }));
  for (const o of r.Contents || []) remote.set(o.Key, { size: o.Size, etag: (o.ETag || '').replaceAll('"', '') });
  if (!r.IsTruncated) break;
  token = r.NextContinuationToken;
}

let sent = 0, bytes = 0, same = 0;
for (const [key, file] of files) {
  const size = statSync(file).size, have = remote.get(key);
  if (have && have.size === size && have.etag === md5(file)) { same++; continue; }
  console.log(`r2: ${dry ? 'would upload' : 'upload'} ${key} (${(size / 1e6).toFixed(1)} MB)`);
  if (!dry) {
    await s3.send(new PutObjectCommand({
      Bucket: R2_BUCKET, Key: key, Body: readFileSync(file), ContentLength: size,
      ContentType: TYPES[extname(file).toLowerCase()] || 'application/octet-stream',
      // the library changes on every new album; the cut sides and covers only when their album is re-cut
      CacheControl: key === 'library.json' || key.endsWith('record.json') ? 'no-cache' : 'public, max-age=3600',
    }));
  }
  sent++; bytes += size;
}

let removed = 0;
if (prune) {
  // only what the library no longer names: a side's files may be gone locally (record.flac is deleted once uploaded)
  const sideDirs = (lib.albums || []).flatMap((a) => a.sides.map((s) => s.dir || `assets/${s.id}/`));
  const covers = new Set((lib.albums || []).map((a) => a.cover).filter(Boolean));
  const stale = [...remote.keys()].filter((k) => (k.startsWith('assets/') && !sideDirs.some((d) => k.startsWith(d))) || (k.startsWith('covers/') && !covers.has(k)));
  for (let i = 0; i < stale.length; i += 1000) {
    const chunk = stale.slice(i, i + 1000);
    chunk.forEach((k) => console.log(`r2: ${dry ? 'would delete' : 'delete'} ${k}`));
    if (!dry) await s3.send(new DeleteObjectsCommand({ Bucket: R2_BUCKET, Delete: { Objects: chunk.map((Key) => ({ Key })) } }));
    removed += chunk.length;
  }
}
console.log(`r2: ${sent} ${dry ? 'to upload' : 'uploaded'} (${(bytes / 1e6).toFixed(1)} MB), ${same} unchanged${prune ? `, ${removed} deleted` : ''} -> ${R2_BUCKET}`);
