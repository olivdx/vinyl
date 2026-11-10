import type { Metadata, Viewport } from "next";
import { BOOT_SCRIPT } from "./boot";
import "./globals.css";

export const metadata: Metadata = {
  title: "Record Player",
  description:
    "A physical simulation of how a record player makes sound: the music is cut into a groove and a simulated stylus reads it back.",
  openGraph: {
    title: "Record Player",
    description:
      "A physical simulation of how a record player makes sound. The music is cut into a groove and a simulated stylus reads it back.",
    images: [{ url: "/og.png", width: 1200, height: 630 }],
    type: "website",
  },
  twitter: { card: "summary_large_image", images: ["/og.png"] },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

// The engine is plain ES modules served from public/vinyl/src (see app/engine-loader.tsx).
// Preload only what main.js needs to draw the deck; the worklet chain loads on power-on (initAudio).
const MODULES_FIRST = ["main", "render", "gl-util", "shaders", "dsp", "geometry", "records", "label", "press"];
const MODULES_AUDIO = ["worklet", "engine", "engine-core", "groove"];

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // the boot script adds classes (loading) to <html> before React hydrates
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          suppressHydrationWarning
          // Same type on server and client — a typeof window branch here caused hydration mismatches.
          dangerouslySetInnerHTML={{ __html: `window.__ALBUMS_URL=${JSON.stringify(process.env.NEXT_PUBLIC_ALBUMS_URL || "")};` + BOOT_SCRIPT }}
        />
        {MODULES_FIRST.map((m) => (
          <link key={m} rel="modulepreload" href={`/vinyl/src/${m}.js`} />
        ))}
        {MODULES_AUDIO.map((m) => (
          <link key={m} rel="prefetch" href={`/vinyl/src/${m}.js`} as="script" />
        ))}
      </head>
      {/* extensions (e.g. ColorZilla's cz-shortcut-listen) add attributes to <body> before React hydrates */}
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
