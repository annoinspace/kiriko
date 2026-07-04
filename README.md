# kiriko

Hand-controlled image shattering in TouchDesigner. Named for Edo kiriko —
Japanese cut glass.

Wave your hand over an image and the tiles under your palm break into small
glass cubes that refract the picture. The **angle you swipe at sets the
direction the light bends** — every pass cuts the glass differently. Swipe
back **the opposite way** over broken tiles and they heal back into the
image. Perpendicular swipes leave broken tiles alone, so you can work
different regions in different directions.

Hand tracking runs in the browser (MediaPipe, fully local — no video leaves
the machine). Only tiny JSON position messages cross to TouchDesigner over a
localhost WebSocket. All the image work happens in TD: a GLSL feedback loop
stores per-tile state (how broken + which direction it was broken in), and a
render shader turns that state into refraction, chromatic splitting, beveled
facets, and open seams.

```
tracker (browser)                  touchdesigner
┌──────────────────┐   ws:9980    ┌─────────────────────────────────┐
│ webcam →         │ ───────────► │ webserver1 → hand (CHOP)        │
│ MediaPipe hands  │  {x,y,vx,vy} │        ↓ uniforms               │
│ palm + velocity  │              │ feedback1 ⇄ state (GLSL, 1 texel│
└──────────────────┘              │            per tile: shatter+dir│
                                  │ source + state → refract → OUT  │
                                  └─────────────────────────────────┘
```

## Setup

Needs TouchDesigner (2023.11+, free non-commercial is fine), a webcam, and
Python 3 for the static file server.

**1 — build the TD network** (first time only)

Open TouchDesigner, open the textport (`Alt+T` / `Option+T`), and run:

```python
REPO = '/Users/you/kiriko'; exec(open(REPO + '/td/build.py', encoding='utf-8').read())
```

(The explicit encoding matters — TD's embedded Python defaults `open()` to
ASCII and will choke on anything fancier in the file.)

This builds the whole network, points it at the first image it finds in
`assets/` (drop one in there first — jpg/png/tif), and saves `td/kiriko.toe`.
After that, just open `td/kiriko.toe` directly. Re-run the script any time to
rebuild from scratch (it also recomputes the tile grid for a new image
aspect).

**2 — start the hand tracker**

```sh
cd tracker && python3 -m http.server 8000
```

Open <http://localhost:8000>, hit **start tracking**, allow the camera. The
status line shows `linked to td` once the WebSocket is up (it retries every
3s, so start order doesn't matter). View the result on the `OUT` null in TD.

## Playing it

- **Swipe** across the image — tiles under your palm shatter, refracting
  along your swipe angle.
- **Swipe the opposite direction** over broken tiles — they reassemble.
- Same direction again deepens the break; perpendicular does nothing.
- **Spread your fingers** as you swipe — the glass breaks into bigger
  cubes (tiles merge into 2×2, then 4×4 blocks). Fingers together breaks
  fine tiles; each fingertip also carves its own small trail.
- **Second hand = dodge & burn**: hover your other hand over tiles and
  raise it to brighten them, lower it to darken. Exposure is painted
  per-tile, persists, and survives healing. By default the left hand
  exposes and the right breaks — flip `EXPOSURE_HAND` in
  `tracker/index.html` if your camera reports them swapped.
- **The hands duet.** The light hand is a lamp: broken glass near it tilts
  and glints toward it, so sweeping it re-lights everything the break hand
  made. With both hands up, pulling them apart winds the refraction up;
  bringing them together calms it. Cupping the break hand close to the
  light hand makes dodge/burn paint faster.
- **One hand only + a fast rip across the screen** flips through the
  images in `assets/` — right-to-left for next, left-to-right for
  previous. The grid refits to the new image's aspect and the glass
  resets. (Drop several images into `assets/` to make this do anything.)
- **reset tiles** button on the tracker page clears everything (or pulse
  `Reset` on `feedback1` in TD).

## Tuning

| what | where |
|---|---|
| tile count | `SHORT` in `td/build.py` (rerun to rebuild) |
| hand reach, break/heal speed, angle tolerance | `td/shaders/state.frag` |
| refraction strength, chromatic split, bevel/seam look | `td/shaders/refract.frag` |
| position/velocity smoothing, spread calibration | constants at the top of `tracker/index.html` (`SPREAD_MIN`/`SPREAD_MAX`) |
| block-merge thresholds (when tiles fuse into 2×2/4×4) | level selection at the top of `main()` in `td/shaders/refract.frag` |
| dodge/burn speed and reach | exposure-hand block in `td/shaders/state.frag` |
| exposure range in stops | the `exp2(st.b * 1.5)` line in `td/shaders/refract.frag` |
| which hand exposes vs breaks | `EXPOSURE_HAND` in `tracker/index.html` |
| image-flip rip distance/window | `NAV_TRAVEL` / `NAV_WINDOW` in `tracker/index.html` |

The shader DATs sync to the files on disk, so edits to `td/shaders/*.frag`
show up live in TD — no rebuild needed.

## Repo layout

```
td/build.py               builds + saves the network (run in textport)
td/webserver_callbacks.py websocket → hand CHOP bridge
td/shaders/state.frag     per-tile break/heal state (feedback loop)
td/shaders/refract.frag   glass-cube render
tracker/index.html        webcam hand tracker, streams to ws://127.0.0.1:9980
assets/                   drop your source image here
```

`*.toe` files are gitignored — the build script is the source of truth.
