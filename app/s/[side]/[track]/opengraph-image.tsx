import { ImageResponse } from "next/og";
import { allSongParams, coverDataUrl, findSong, type Album, type Side } from "../../song";

// The share image of a song: just the face of the record it is on. A 12" disc with its grooves, the gaps between
// the songs of that side, and the album cover as the label (100 mm on a 300 mm disc, as on the real thing).

export const alt = "A vinyl record";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export async function generateStaticParams() {
  const all = await allSongParams();
  return all.length ? all : [{ side: "none", track: "1" }];
}

const D = 590, R = D / 2, LABEL = Math.round(D / 3), HOLE = 9;
const R_OUT = R - 6, R_IN = LABEL / 2 + 22; // the grooved band: lead-in just inside the rim, lead-out before the label

// a fixed sequence, so the same side always draws the same grooves
function rng(seed: number) {
  return () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);
}

function discSvg(side: Side | null, n: number, color: string) {
  const rand = rng(n * 7919 + (side?.id.length ?? 0));
  const rings: string[] = [];
  for (let r = R_OUT; r > R_IN; r -= 1.6) {
    const a = 0.025 + rand() * 0.05;
    rings.push(`<circle cx="${R}" cy="${R}" r="${r.toFixed(1)}" stroke="rgba(255,255,255,${a.toFixed(3)})" stroke-width="0.8" fill="none"/>`);
  }
  // the smooth bands between songs, spaced by song length (the lathe's pitch varies a little, this is close enough)
  const lens = side?.tracks.map((t) => t.len) ?? [];
  const total = lens.reduce((a, b) => a + b, 0);
  let acc = 0;
  for (let i = 0; i < lens.length - 1; i++) {
    acc += lens[i];
    const r = R_OUT - (R_OUT - R_IN) * (acc / total);
    rings.push(`<circle cx="${R}" cy="${R}" r="${r.toFixed(1)}" stroke="${color}" stroke-width="3.2" fill="none"/>`);
    rings.push(`<circle cx="${R}" cy="${R}" r="${r.toFixed(1)}" stroke="rgba(255,255,255,0.07)" stroke-width="3.2" fill="none"/>`);
  }
  const deg = Math.PI / 180;
  // light across the grooves: two opposite wedges, brightest along their middle and fading to their edges
  const p = (a: number, r = R) => `${(R + Math.cos(a) * r).toFixed(1)},${(R + Math.sin(a) * r).toFixed(1)}`;
  const sheens: string[] = [];
  const wedge = (a0: number, a1: number) => {
    const id = `sheen${sheens.length}`, [x1, y1] = p(a0, R * 0.7).split(","), [x2, y2] = p(a1, R * 0.7).split(",");
    sheens.push(`<linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset="0.5" stop-color="#fff" stop-opacity="0.085"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>`);
    return `<path d="M${R},${R} L${p(a0)} A${R},${R} 0 0 1 ${p(a1)} Z" fill="url(#${id})"/>`;
  };
  const light = wedge(-150 * deg, -100 * deg) + wedge(30 * deg, 80 * deg);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${D}" height="${D}" viewBox="0 0 ${D} ${D}">
<defs>
<radialGradient id="body" cx="50%" cy="50%" r="50%"><stop offset="0.3" stop-color="${color}"/><stop offset="1" stop-color="${shade(color, -0.25)}"/></radialGradient>
${sheens.join("")}
<clipPath id="disc"><circle cx="${R}" cy="${R}" r="${R}"/></clipPath>
</defs>
<circle cx="${R}" cy="${R}" r="${R}" fill="url(#body)"/>
${rings.join("")}
<g clip-path="url(#disc)">${light}</g>
<circle cx="${R}" cy="${R}" r="${R - 1}" stroke="rgba(255,255,255,0.18)" stroke-width="1.5" fill="none"/>
<circle cx="${R}" cy="${R}" r="${LABEL / 2 + 6}" stroke="rgba(255,255,255,0.06)" stroke-width="1" fill="none"/>
</svg>`;
}

// #rrggbb lighter (+) or darker (-)
function shade(hex: string, k: number) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return hex;
  const v = parseInt(m[1], 16), ch = (s: number) => Math.round(Math.max(0, Math.min(255, k < 0 ? s * (1 + k) : s + (255 - s) * k)));
  return `#${[v >> 16, (v >> 8) & 255, v & 255].map((s) => ch(s).toString(16).padStart(2, "0")).join("")}`;
}

const vinylColor = (a: Album | null) => {
  const v = a?.vinyl, c = typeof v === "string" ? v : v?.color;
  return c && /^#[0-9a-f]{6}$/i.test(c) ? shade(c, -0.35) : "#121213";
};

export default async function Image({ params }: { params: Promise<{ side: string; track: string }> }) {
  const { side, track } = await params;
  const found = await findSong(side, track);
  const album = found?.album ?? null;
  const cover = album ? await coverDataUrl(album) : null;
  const svg = discSvg(found?.side ?? null, found?.n ?? 1, vinylColor(album));
  const at = (d: number) => ({ position: "absolute" as const, left: (size.width - d) / 2, top: (size.height - d) / 2, width: d, height: d });

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", position: "relative", background: "radial-gradient(circle at 50% 45%, #1d1d20 0%, #0a0a0b 70%)" }}>
        {/* eslint-disable-next-line @next/next/no-img-element -- ImageResponse renders plain img */}
        <img src={`data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`} width={D} height={D} alt="" style={at(D)} />
        {cover ? (
          // eslint-disable-next-line @next/next/no-img-element -- ImageResponse renders plain img
          <img src={cover} width={LABEL} height={LABEL} alt="" style={{ ...at(LABEL), borderRadius: LABEL / 2, objectFit: "cover" }} />
        ) : (
          <div style={{ ...at(LABEL), borderRadius: LABEL / 2, background: "#4c4c4e" }} />
        )}
        <div style={{ ...at(LABEL), borderRadius: LABEL / 2, boxShadow: "inset 0 0 18px rgba(0,0,0,0.45)" }} />
        <div style={{ ...at(HOLE * 2), borderRadius: HOLE, background: "#0d0d0e", boxShadow: "inset 0 1px 2px rgba(255,255,255,0.25)" }} />
      </div>
    ),
    { ...size },
  );
}
