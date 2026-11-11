import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Player } from "../../../player";
import { allSongParams, findSong } from "../../song";

// A shared song: the player, opening with this side on the platter and the needle at this song
// (public/vinyl/src/main.js reads the path). The preview image is opengraph-image.tsx next to this file.

export async function generateStaticParams() {
  const all = await allSongParams();
  return all.length ? all : [{ side: "none", track: "1" }]; // Cache Components needs at least one
}

export async function generateMetadata({ params }: PageProps<"/s/[side]/[track]">): Promise<Metadata> {
  const { side, track } = await params;
  const found = await findSong(side, track);
  if (!found) return {};
  const { album, song } = found;
  const title = `${song.title} · ${song.by}`;
  const description = `${album.title} · ${album.by}. Played on a simulated record player.`;
  return {
    title,
    description,
    openGraph: { title, description, type: "music.song" },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default async function SongPage({ params }: PageProps<"/s/[side]/[track]">) {
  const { side, track } = await params;
  if (!(await findSong(side, track))) notFound();
  return <Player />;
}
