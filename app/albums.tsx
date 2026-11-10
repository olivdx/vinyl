"use client";

import { Fragment, useEffect, useRef, useState } from "react";

// The album picker. Albums come from the engine (public/vinyl/src/main.js): the built-in double LP plus every
// album cut from albums/<folder>/ (`npm run albums`). An album is a set of LP sides, two to a disc; each side is a
// record the engine can put on the platter. The engine exposes window.vinyl and fires:
//   'vinyl:state'       { current, track, swapping }  the side on (or headed for) the platter, the song under the needle
//   'vinyl:open-albums'                               when the now-playing readout is clicked
// Covers: an album cut from a folder brings its cover.jpg / cover.png (album.cover); the built-in one looks for
// public/covers/<album id>.(jpg|png|webp). Without a cover, a placeholder.

type Song = { title: string; by: string; len: number; credit?: string; licence?: string; url?: string };
type Side = { id: string; album: string; disc: number; side: string; title: string; tracks: Song[] };
type Album = { id: string; title: string; by: string; cover: string | null; discs: number; sides: Side[] };
type Vinyl = {
  records: Side[]; albums: Album[]; current: string | null; track: number; swapping: boolean;
  pick(id: string): void; play(id: string, i: number): void; flip(): void;
};
declare global {
  interface Window { vinyl?: Vinyl }
}

const OPEN = "vinyl:open-albums";
const EXTS = ["jpg", "png", "webp"];
const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}`;
const sideLen = (s: Side) => s.tracks.reduce((a, t) => a + t.len, 0);
const albumLen = (a: Album) => a.sides.reduce((x, s) => x + sideLen(s), 0);

export function AlbumsButton() {
  return (
    <button id="t-albums" onClick={() => dispatchEvent(new Event(OPEN))}>
      Albums
    </button>
  );
}

function Cover({ album }: { album: Album }) {
  const [ext, setExt] = useState(0); // the built-in album: which extension to try next; past the end = no cover
  const src = album.cover ? album.cover :ext < EXTS.length ? `/covers/${album.id}.${EXTS[ext]}` : null;
  const [failed, setFailed] = useState(false);
  return (
    <span className="cover">
      {!src || failed ? (
        <span className="ph"><b>{album.title}</b><i>{album.by}</i></span>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element -- user-supplied files of unknown size and format
        <img src={src} alt="" loading="lazy" onError={() => (album.cover ? setFailed(true) : setExt(ext + 1))} />
      )}
    </span>
  );
}

// one line per recording, for the fine print (only the built-in album carries credits)
function credits(sides: Side[]) {
  const seen = new Map<string, Song>();
  for (const s of sides) for (const t of s.tracks) if (t.credit && !seen.has(t.credit)) seen.set(t.credit, t);
  return [...seen.values()];
}

function AlbumView({ album, current, track, done }: { album: Album; current: string | null; track: number; done: () => void }) {
  const discs = [...new Set(album.sides.map((s) => s.disc))];
  const fine = credits(album.sides);
  return (
    <div className="album-view">
      <div className="hero">
        <Cover album={album} />
        <div className="info">
          <b>{album.title}</b>
          <i>{album.by}</i>
          <span>{discs.length} {discs.length > 1 ? "discs" : "disc"} · {album.sides.length} sides · {fmt(albumLen(album))}</span>
          <span className="hint">Put the needle anywhere on a side, or pick a song here.</span>
        </div>
      </div>
      {discs.map((d) => (
        <section key={d} className="disc">
          <h4>Disc {d}</h4>
          <div className="sides">
            {album.sides.filter((s) => s.disc === d).map((s) => {
              const on = s.id === current;
              return (
                <div key={s.id} className="side" aria-current={on}>
                  <button className="side-head" onClick={() => { done(); window.vinyl?.pick(s.id); }}>
                    <b>Side {s.side}</b><span>{fmt(sideLen(s))}</span>
                    <em>{on ? "On the platter" : "Put this side on"}</em>
                  </button>
                  <ol>
                    {s.tracks.map((t, i) => (
                      <li key={i}>
                        <button className="song" aria-current={on && i === track} onClick={() => { done(); window.vinyl?.play(s.id, i); }}>
                          <span className="n">{i + 1}</span>
                          <span className="t">{t.title}<i>{t.by}</i></span>
                          <span className="l">{fmt(t.len)}</span>
                        </button>
                      </li>
                    ))}
                  </ol>
                </div>
              );
            })}
          </div>
        </section>
      ))}
      {fine.length > 0 && (
        <p className="credit">
          {fine.map((t, i) => (
            <Fragment key={t.credit}>
              {i > 0 && <br />}
              {t.by}: {[t.credit, t.licence].filter(Boolean).join(" · ")}
              {t.url && (<>{" · "}<a href={t.url} target="_blank" rel="noopener">source</a></>)}
            </Fragment>
          ))}
        </p>
      )}
    </div>
  );
}

export function Albums() {
  const ref = useRef<HTMLDialogElement>(null);
  const [v, setV] = useState<{ albums: Album[]; current: string | null; track: number }>({ albums: [], current: null, track: -1 });
  const [openId, setOpenId] = useState<string | null>(null); // the album being looked at; null = all albums

  useEffect(() => {
    const sync = () => {
      const x = window.vinyl;
      if (x) setV({ albums: x.albums, current: x.current, track: x.track });
    };
    const open = () => {
      sync();
      const x = window.vinyl;
      setOpenId(x && x.albums.length === 1 ? x.albums[0].id : null); // one album: straight to it
      const d = ref.current;
      if (d && !d.open) { d.showModal(); d.scrollTop = 0; }
    };
    sync();
    addEventListener("vinyl:state", sync);
    addEventListener(OPEN, open);
    return () => { removeEventListener("vinyl:state", sync); removeEventListener(OPEN, open); };
  }, []);

  const close = () => ref.current?.close();
  const { albums, current, track } = v;
  const playing = albums.find((a) => a.sides.some((s) => s.id === current));
  const album = albums.find((a) => a.id === openId);

  return (
    <dialog
      ref={ref}
      className="albums"
      aria-label="Albums"
      onClick={(e) => { if (e.target === ref.current) close(); }} // click on the backdrop
    >
      <div className="head">
        {album && albums.length > 1 ? (
          <button className="back" onClick={() => { setOpenId(null); if (ref.current) ref.current.scrollTop = 0; }}>← All albums</button>
        ) : (
          <h3>Albums</h3>
        )}
        <button className="close" onClick={close} aria-label="Close">Close</button>
      </div>
      {album ? (
        <AlbumView album={album} current={current} track={track} done={close} />
      ) : (
        <ul className="album-grid">
          {albums.map((a) => (
            <li key={a.id}>
              <button className="album" aria-current={a === playing} onClick={() => { setOpenId(a.id); if (ref.current) ref.current.scrollTop = 0; }}>
                <Cover album={a} />
                <span className="meta">
                  <b>{a.title}</b>
                  <i>{a.by}</i>
                  <i>{a.discs > 1 ? `${a.discs} discs` : "1 disc"} · {fmt(albumLen(a))}</i>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </dialog>
  );
}
