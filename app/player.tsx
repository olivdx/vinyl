import { AlbumsButton } from "./albums-button";
import { AlbumsLazy } from "./albums-lazy";
import { EngineLoader } from "./engine-loader";

// The record player's markup, shared by the home page and the song share pages (app/s/[side]/[track]).
// It is the original record player's markup. public/vinyl/src/main.js wires it up after
// hydration (EngineLoader) and writes into it from then on, so nothing here re-renders.
const SRC = "https://github.com/rauchg/vinyl/blob/main/src/";

export function Player() {
  return (
    <>
      <canvas id="gl" />
      <div id="vig" />
      {/* the boot script (app/boot.ts) drives these before React hydrates */}
      <div id="loader" className="wait" suppressHydrationWarning>
        <div className="bar"><i id="loader-fill" suppressHydrationWarning /></div>
        <span id="loader-pct" suppressHydrationWarning />
      </div>

      <header id="teaser">
        <p>A physical simulation of how a record player makes sound. <button className="link" id="b-more">More</button></p>
      </header>

      <nav id="toggles">
        <AlbumsButton />
        <button id="t-records" aria-pressed="false" title="Records">
          <span className="eq" aria-hidden="true"><i /><i /><i /><i /></span>
          <span id="now-title">Records</span>
          <span id="now-time" />
        </button>
        <button id="t-ctl" aria-pressed="false">Controls</button>
      </nav>

      <div id="credit">
        <button id="t-reset" hidden>Reset view</button>
        <a href="https://x.com/rauchg" target="_blank" rel="noopener">@rauchg</a>
        <a href="https://github.com/rauchg/vinyl" target="_blank" rel="noopener">Source</a>
      </div>
      <div id="foot"><span id="status" /></div>
      <div id="hover-track" hidden />{/* the song under the pointer (main.js hoverSong) */}

      <section id="hud" className="panel">
        <canvas id="scope" width={540} height={124} title="The groove walls passing under the stylus" />
        <div id="stats">
          <div><span>speed</span><b id="s-rpm">-</b></div><div><span>groove</span><b id="s-vg">-</b></div>
          <div><span>radius</span><b id="s-r">-</b></div><div><span>tracking error</span><b id="s-err">-</b></div>
          <div><span>left wall</span><b id="s-nl">-</b></div><div><span>right wall</span><b id="s-nr">-</b></div>
          <div><span>mistracking</span><b id="s-loss">-</b></div><div><span>stylus height</span><b id="s-z">-</b></div>
          <div><span>cantilever</span><b id="s-xi">-</b></div><div><span>DSP load</span><b id="s-load">-</b></div>
        </div>
      </section>

      <section id="ctl" className="panel" hidden>
        <div className="row"><button id="b-start">Start</button><button id="b-cue">Cue</button><button id="b-flip" title="Turn the record over (F)">Flip</button></div>
        <div className="row">
          <button data-rpm="33.3333" className="on">33</button><button data-rpm="45">45</button><button data-rpm="78.26">78</button>
        </div>
        <div className="row"><label>Volume</label><input id="p-volume" type="range" min="0" max="1" step="0.01" defaultValue="1" /><output /></div>

        <h2>Cartridge</h2>
        <div className="row">
          <select id="p-stylus" defaultValue="elliptical">
            <option value="elliptical">Elliptical 0.3 x 0.7 mil</option>
            <option value="conical">Conical 0.7 mil</option>
            <option value="microline">Micro-line</option>
          </select>
        </div>
        <div className="row"><label>Tracking g</label><input id="p-vtf" type="range" min="0.2" max="4" step="0.05" defaultValue="1.8" /><output /></div>
        <div className="row"><label>Anti-skate</label><input id="p-antiskate" type="range" min="0" max="4" step="0.05" defaultValue="1.8" /><output /></div>
        <div className="row"><label>Mains hum</label><input id="p-hum" type="range" min="0" max="3" step="0.05" defaultValue="0" /><output /></div>

        <h2>This pressing</h2>
        <div className="row"><label>Surface</label><input id="c-noise" type="range" min="0" max="4" step="0.05" defaultValue="1" /><output /></div>
        <div className="row"><label>Dust</label><input id="c-dust" type="range" min="0" max="3" step="0.05" defaultValue="0.25" /><output /></div>
        <div className="row"><label>Scratches</label><input id="c-scratches" type="range" min="0" max="2" step="0.05" defaultValue="0.2" /><output /></div>
        <div className="row"><label>Warp mm</label><input id="c-warp" type="range" min="0" max="2" step="0.05" defaultValue="0.3" /><output /></div>
        <div className="row"><label>Off-centre</label><input id="c-offCenter" type="range" min="0" max="1.5" step="0.05" defaultValue="0.15" /><output /></div>
        <div className="row">
          <button id="b-press">Press again</button>
          <label className="file" htmlFor="f-audio">Cut a file</label>
          <input id="f-audio" type="file" accept="audio/*" multiple hidden />
        </div>
        <div className="row"><button id="b-bump">Knock the table</button></div>
      </section>

      <AlbumsLazy />

      <dialog id="more">
        <h3>A record player simulated &quot;from the groove up&quot;</h3>
        <p>Instead of playing an audio file, the music is cut into a spiral groove, and a simulated stylus, cantilever, tonearm and cartridge read it back. What you hear is the voltage that motion would induce in the cartridge, after phono equalisation.</p>
        <p>This is a <em>physical simulation</em> of a record player&apos;s mechanics, which happen to play sound. It works in four steps, each a small file in <a href="https://github.com/rauchg/vinyl/tree/main/src" target="_blank" rel="noopener"><code>src/</code></a>.</p>
        <p><strong>1. Cut.</strong> The lathe (<a href={SRC + "cut.js"} target="_blank" rel="noopener"><code>cut.js</code></a>) turns the audio into the two walls of a stereo groove at 33⅓ rpm, <span id="d-points">millions of</span> points on each: RIAA pre-emphasis, a limiter so a real cutter could have cut it, and variable pitch so the side fits on a 12&quot; disc. The records on the shelf are cut ahead of time. Files you bring are cut here, in a worker. From then on the only thing that exists is the disc.</p>
        <p><strong>2. Press.</strong> The pressing plant (<a href={SRC + "press.js"} target="_blank" rel="noopener"><code>press.js</code></a>) changes the geometry itself: wall roughness, dust, scratches, warp, an off-centre hole, groove echo. Nothing in it is an audio effect. It is seeded, so the same record always presses the same way.</p>
        <p><strong>3. Play.</strong> The engine (<a href={SRC + "engine-core.js"} target="_blank" rel="noopener"><code>engine-core.js</code></a>, <a href={SRC + "groove.js"} target="_blank" rel="noopener"><code>groove.js</code></a>) runs on the audio thread. It moves a stylus tip weighing a third of a milligram, on a springy cantilever at the end of a pivoting arm, against both walls <span id="d-rate">hundreds of thousands of</span> times a second, and turns that motion into the voltage of a moving-magnet cartridge.</p>
        <p><strong>4. Draw.</strong> The deck (<a href={SRC + "render.js"} target="_blank" rel="noopener"><code>render.js</code></a>) is WebGL2, and the disc is drawn from the cut itself: the actual spiral, lit by how hard each revolution is modulated. The small view in the corner is the real groove wall passing under the stylus.</p>
        <p><strong>&quot;Real&quot;, procedural flaws.</strong></p>
        <ul>
          <li>Hiss and crackle are roughness and dust on the walls. A scratch ticks once per turn because the needle crosses it once per turn.</li>
          <li>Treble dulls toward the label: the groove moves slower there and the tip no longer fits the wiggles.</li>
          <li>Pitch wavers when the hole is off-centre, and bends when the platter starts or stops, because the platter has inertia.</li>
          <li>With too little tracking force the needle leaves the wall. Knock the table and it skips.</li>
        </ul>
        <p>Drop the needle anywhere, or drag the record to scratch it. Drag empty space to look around and scroll to zoom in on the stylus. The album is a double LP: pick a side or a song under Albums, and Flip (or F) turns the record over. When a side ends, the needle rides the locked run-out for a few seconds, then the deck lifts it, flips the disc, and drops in at the lead-in of the other side (if there is one). In Controls you can change the stylus, lower the tracking force, press a dirtier copy, or cut your own audio.</p>
        <p className="fine">Set by hand rather than derived: how rough the walls are, and how much the bearing rumbles and the motor flutters. Not simulated: stylus rake angle and record wear.</p>
        <form method="dialog"><button>Close</button></form>
      </dialog>

      <div id="power"><span id="power-msg">click to power on</span></div>
      <EngineLoader />
    </>
  );
}
