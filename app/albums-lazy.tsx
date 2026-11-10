"use client";

import dynamic from "next/dynamic";

const Albums = dynamic(() => import("./albums").then((m) => ({ default: m.Albums })), { ssr: false });

export function AlbumsLazy() {
  return <Albums />;
}
