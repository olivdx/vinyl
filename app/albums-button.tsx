"use client";

const warmAlbums = () => void import("./albums");

export function AlbumsButton() {
  return (
    <button
      id="t-albums"
      type="button"
      onMouseEnter={warmAlbums}
      onFocus={warmAlbums}
      onClick={() => dispatchEvent(new Event("vinyl:open-albums"))}
    >
      Albums
    </button>
  );
}
