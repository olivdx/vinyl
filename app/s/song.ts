import { readFile } from "node:fs/promises";
import { extname, join } from "node:path";

// The albums cut by `npm run albums` (public/vinyl/library.json), read on the server for the song share pages.
// The built-in double LP (public/vinyl/src/records.js) is not in it, so its songs have no share page.

export type Song = { title: string; by: string; len: number };
export type Side = { id: string; album: string; disc: number; side: string; title: string; dir?: string; tracks: Song[] };
export type Album = { id: string; title: string; by: string; cover: string | null; vinyl?: string | { color: string; clear?: number }; discs: number; sides: Side[] };

const PUBLIC = join(process.cwd(), "public");

export async function library(): Promise<Album[]> {
  "use cache";
  try {
    return (JSON.parse(await readFile(join(PUBLIC, "vinyl", "library.json"), "utf8")).albums ?? []) as Album[];
  } catch {
    return [];
  }
}

// /s/<side>/<track>: track is the song's number on that side, from 1
export async function findSong(sideId: string, track: string) {
  const n = Number(track);
  if (!Number.isInteger(n) || n < 1) return null;
  for (const album of await library()) {
    const side = album.sides.find((s) => s.id === sideId);
    if (side) return side.tracks[n - 1] ? { album, side, song: side.tracks[n - 1], n } : null;
  }
  return null;
}

export async function allSongParams() {
  return (await library()).flatMap((a) => a.sides.flatMap((s) => s.tracks.map((_, i) => ({ side: s.id, track: String(i + 1) }))));
}

// The album cover as a data URL for the share image (jpg or png only: that is what the lathe copies to public/covers)
export async function coverDataUrl(album: Album) {
  if (!album.cover || /^https?:/.test(album.cover)) return null;
  const ext = extname(album.cover).toLowerCase();
  const type = ext === ".png" ? "image/png" : ext === ".jpg" || ext === ".jpeg" ? "image/jpeg" : null;
  if (!type) return null;
  try {
    return `data:${type};base64,${(await readFile(join(PUBLIC, album.cover))).toString("base64")}`;
  } catch {
    return null;
  }
}
