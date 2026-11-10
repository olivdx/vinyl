"use client";

import { useEffect } from "react";

// Starts the record player (public/vinyl/src/main.js) once React has hydrated the page.
// main.js writes into the DOM straight away (readouts, panels); loading it any earlier would race
// hydration, and a mismatch makes React rebuild the DOM and drop the listeners main.js attached.
// It is loaded as a native module, not bundled: the AudioWorklet and the mastering worker are
// resolved from its URL (new URL(..., import.meta.url)).
export function EngineLoader() {
  useEffect(() => {
    if (document.querySelector("script[data-vinyl]")) return; // Strict Mode runs effects twice in dev
    const s = document.createElement("script");
    s.type = "module";
    s.src = "/vinyl/src/main.js";
    s.dataset.vinyl = "";
    document.body.appendChild(s);
  }, []);
  return null;
}
