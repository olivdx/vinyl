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
const MODULES = [
  "main", "render", "gl-util", "shaders", "dsp", "geometry", "records", "label", "press",
  "worklet", "engine", "engine-core", "groove",
];

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // the boot script adds classes (loading) to <html> before React hydrates
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* runs during parsing; text/plain on the client so React does not warn about rendering a script */}
        <script
          type={typeof window === "undefined" ? "text/javascript" : "text/plain"}
          suppressHydrationWarning
          dangerouslySetInnerHTML={{ __html: BOOT_SCRIPT }}
        />
        {MODULES.map((m) => (
          <link key={m} rel="modulepreload" href={`/vinyl/src/${m}.js`} />
        ))}
      </head>
      <body>{children}</body>
    </html>
  );
}
