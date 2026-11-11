"use client";

import { Fragment, memo, useEffect, useRef, useState } from "react";

// The album picker. Albums come from the engine (public/vinyl/src/main.js): the built-in double LP plus every
// album cut from albums/<folder>/ (`npm run albums`). An album is a set of LP sides, two to a disc; each side is a
// record the engine can put on the platter. The engine exposes window.vinyl and fires:
//   'vinyl:state'       { current, track, swapping }  the side on (or headed for) the platter, the song under the needle
//   'vinyl:open-albums'                               when the now-playing readout is clicked
// Covers: album.cover (from library.json, or ALBUM.cover in records.js for the built-in one). Without one, a placeholder.

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
const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}`;
const sideLen = (s: Side) => s.tracks.reduce((a, t) => a + t.len, 0);
const albumLen = (a: Album) => a.sides.reduce((x, s) => x + sideLen(s), 0);

const Cover = memo(function Cover({ album }: { album: Album }) {
  const [failed, setFailed] = useState(false);
  return (
    <span className="cover">
      {!album.cover || failed ? (
        <span className="ph"><b>{album.title}</b><i>{album.by}</i></span>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element -- user-supplied files of unknown size and format
        <img src={album.cover} alt="" decoding="async" onError={() => setFailed(true)} />
      )}
    </span>
  );
});

// The built-in double LP (records.js) is not in library.json, so it has no share pages (app/s/[side]/[track]).
const BUILT_IN = "collection";

// A link to one song: /s/<side>/<n> opens the player with that side on the platter and the needle at song n
// (1-based), and its preview image is the disc (app/s/[side]/[track]/opengraph-image.tsx).
function ShareSong({ side, i, song }: { side: string; i: number; song: Song }) {
  const [copied, setCopied] = useState(false);
  const share = async () => {
    const url = `${location.origin}/s/${encodeURIComponent(side)}/${i + 1}`;
    if (navigator.share && matchMedia("(pointer: coarse)").matches) {
      try { await navigator.share({ title: `${song.title} · ${song.by}`, url }); } catch {} // dismissed
      return;
    }
    try { await navigator.clipboard.writeText(url); } catch { prompt("Copy this link", url); return; }
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };
  return (
    <button type="button" className="share" onClick={share} title={copied ? "Link copied" : "Copy link to this song"} aria-label={`Share ${song.title}`} data-copied={copied || undefined}>
      {copied ? (
        <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8.5l3 3 7-7" /></svg>
      ) : (
        <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M6.5 9.5l3-3M7 4.5l1.2-1.2a2.6 2.6 0 013.7 3.7L10.7 8.2M9 11.5l-1.2 1.2a2.6 2.6 0 01-3.7-3.7L5.3 7.8" /></svg>
      )}
    </button>
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
                <div key={s.id} className="side" aria-current={on ? "true" : undefined}>
                  <button className="side-head" onClick={() => { done(); window.vinyl?.pick(s.id); }}>
                    <b>Side {s.side}</b><span>{fmt(sideLen(s))}</span>
                    <em>{on ? "On the platter" : "Put this side on"}</em>
                  </button>
                  <ol>
                    {s.tracks.map((t, i) => (
                      <li key={i}>
                        <button className="song" aria-current={on && i === track ? "true" : undefined} onClick={() => { done(); window.vinyl?.play(s.id, i); }}>
                          <span className="n">{i + 1}</span>
                          <span className="t">{t.title}<i>{t.by}</i></span>
                          <span className="l">{fmt(t.len)}</span>
                        </button>
                        {album.id !== BUILT_IN && <ShareSong side={s.id} i={i} song={t} />}
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
    const el = ref.current;
    if (!el) return;
    const onToggle = () => document.documentElement.classList.toggle("albums-open", el.open);
    el.addEventListener("toggle", onToggle);
    return () => {
      el.removeEventListener("toggle", onToggle);
      document.documentElement.classList.remove("albums-open");
    };
  }, []);

  useEffect(() => {
    const syncAlbums = () => {
      const x = window.vinyl;
      if (x) setV((prev) => (prev.albums === x.albums ? prev : { ...prev, albums: x.albums }));
    };
    const syncPlayback = (e: Event) => {
      const x = window.vinyl;
      if (!x) return;
      const d = (e as CustomEvent<{ current: string | null; track: number }>).detail;
      const current = d?.current ?? x.current ?? null;
      const track = d?.track ?? x.track ?? -1;
      setV((prev) => (prev.current === current && prev.track === track ? prev : { ...prev, current, track }));
    };
    const open = () => {
      syncAlbums();
      const x = window.vinyl;
      setOpenId(x && x.albums.length === 1 ? x.albums[0].id : null); // one album: straight to it
      const d = ref.current;
      if (d && !d.open) { d.showModal(); d.scrollTop = 0; }
    };
    syncAlbums();
    addEventListener("vinyl:state", syncPlayback);
    addEventListener(OPEN, open);
    return () => { removeEventListener("vinyl:state", syncPlayback); removeEventListener(OPEN, open); };
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
              <button
                type="button"
                className="album"
                aria-current={a === playing ? "true" : undefined}
                onClick={() => { setOpenId(a.id); if (ref.current) ref.current.scrollTop = 0; }}
              >
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
