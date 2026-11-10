# vinyl-clone

A Next.js port of [rauchg/vinyl](https://github.com/rauchg/vinyl) (MIT, see `LICENSE`): a record player
simulated from the groove up. The music is cut into a spiral groove and a simulated stylus reads it back.
This version adds an **Albums** picker and an animated record change on the platter.

## Run

```bash
npm install
npm run dev        # http://localhost:3000
npm run build && npm start
```

Node 22+. Physics tests from the original still run: `npm test`, `npm run bench`.

## Adding an album

1. Make a folder in `albums/`, e.g. `albums/mck/`, with the songs (FLAC, MP3, WAV, M4A, OGG...) and the cover as
   `cover.jpg` or `cover.png`. Title, artist, song names and order come from the files' tags (or the file names).
2. Run `npm run albums` (needs ffmpeg/ffprobe on PATH). Each album is pressed as real LPs: as many sides as it needs
   at up to 20 minutes each, two sides to a disc, songs in order, sides as even as possible. A side that does not fit
   is cut quieter until it does. Only albums whose files changed are re-cut.
3. Reload the page: the album is under **Albums**.

Output: `public/vinyl/assets/<album>/<side>/` (the cut sides), `public/covers/<album>.jpg|png`, `public/vinyl/library.json`.
The source audio stays in `albums/` and is never served (it is git-ignored). Optional `albums/<folder>/album.json`:
`{ "title": "...", "by": "...", "sides": 4 }`.

The built-in double LP (*Public Domain Sessions*) is defined in `public/vinyl/src/records.js`; its cover can be
dropped in as `public/covers/collection.jpg` (or `.png`, `.webp`).

## Playing it like a record

- Each album is shown as its discs and sides. Pick a side to put it on, or a song to drop the needle at its start.
- Click anywhere on the disc to put the needle down there; hovering shows which song is under the pointer.
- **Flip** (in Controls, or the F key) turns the record over. Changing to a side of another disc slides the disc
  off and the new one on; the other side of the same disc is flipped.

## Layout

- `app/`: the Next.js page. `page.tsx` is the original markup, `albums.tsx` the Albums button and modal,
  `engine-loader.tsx` starts the engine after hydration, `boot.ts` starts downloading the first record
  before anything else loads.
- `public/vinyl/src/`: the original engine, unbundled ES modules (WebGL2 deck, AudioWorklet physics,
  lathe and pressing worker). It is served as is because the worklet and worker are loaded by URL.
  Changes from upstream: paths under `/vinyl/`, the record shelf replaced by the Albums bridge
  (`window.vinyl`, `vinyl:state` / `vinyl:open-albums` events), the record-change animation
  (`stepSwap` in `main.js`, `discOff` in `render.js`), and a platter brake used during a change
  (`brake` in `engine-core.js` / `worklet.js`).
- `public/vinyl/assets/`, `public/vinyl/records/`: the precut records and their source audio
  (licences in the upstream README; *Summer: Presto* is CC BY-SA 4.0).
- `lathe.mjs`: re-cuts records into `public/vinyl/assets/` (`npm run lathe`, needs ffmpeg).

## Changing records

Pick a side or a song under **Albums** (or click the now-playing title). The arm parks, the platter brakes, the
disc lifts and slides out, the new one slides in and drops onto the spindle, then the needle goes down.
The engine only receives the new record once it is on the platter, so what you see is what plays.
Interaction with the deck is locked during the change.
