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
REPO = '/Users/you/kiriko'; exec(open(REPO + '/td/build.py').read())
```

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
- **reset tiles** button on the tracker page clears everything (or pulse
  `Reset` on `feedback1` in TD).

## Tuning

| what | where |
|---|---|
| tile count | `COLS` in `td/build.py` (rerun to rebuild) |
| hand reach, break/heal speed, angle tolerance | `td/shaders/state.frag` |
| refraction strength, chromatic split, bevel/seam look | `td/shaders/refract.frag` |
| position/velocity smoothing | constants at the top of `tracker/index.html` |

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
