---
id: QA-34
milestone: M1
role: client-ui
status: todo
depends: []
severity: P2
---
# QA-34: Playback camera won't rise — bots high in the air are drawn above the top edge

Found by the 2026-11-08 nightly QA run. In `QA_SET=2 node test/qa-playthrough.mjs docs/alpha/qa/2026-11-08`
match 3 (Gravitas v Skyla on Cloud Steps, 1280x720), the T6 playback shot
`docs/alpha/qa/2026-11-08/m3-cloudsteps-1280x720-resolve-T6.png` shows Nova (Skyla) cut in half by the top
edge of the screen while the camera shows empty clouds below.

## Cause (read from code)

`Renderer.frameAction()` (`src/render/renderer.js` ~line 129) clamps the camera centre to
`y >= m.height * 0.3` and the zoom to `>= zoomFit`. When a bot jumps or flies above the top of the map
(y < 0; Skyla, Warden and Magmaw jumps reach y ≈ -12), the framed box can't move up or zoom out to include it,
so the bot is drawn above the viewport, often entirely off screen.

## Repro

`python3 -m http.server 8123 & CHROMIUM_PATH=... node test/playback-framing.mjs 3` (new, not a CI gate).
It steps AI-only matches tick by tick and snaps the real `frameAction()` camera target every 6th tick.
On main (6a0aea0): **578 of 23208 sampled frames leave a living bot off screen**. Worst cases:

- 1280x720 Nimbus Reach, seed 4206 T2: Skyla at (11.3, -11.5) drawn at y = -116 (200 px out); 294 bot-frames.
- 1280x720 Temple Crossing, seed 4214 T1: Skyla at (7.2, -11.9) drawn at y = -157 (243 px out).
- 1280x720 Magma Works, seed 4227 T15: Warden at (34.5, -11.6) drawn at y = -149 (235 px out).
- 844x390 (landscape phone) Magma Works: 99 bot-frames, up to 127 px out; Nimbus 59 bot-frames.
- 390x844: 12 bot-frames on Magma Works, up to 47 px out (portrait has more spare height).

Expected: during playback every living bot above the kill floor stays on screen (the camera rises above the map
top, or zooms out past `zoomFit`, when a bot goes high). Actual: the camera stays pinned and bots vanish off the
top edge for up to a second or more of a jump.

## Acceptance

- `node test/playback-framing.mjs 3` exits 0 (no living bot off screen in any sampled frame at 390x844,
  1280x720, 844x390).
- `node test/nameplate-edge.mjs`, `test/browser.mjs` and the qa-playthrough screenshots show no regression in
  the plan-phase framing (this fix is about playback only). Coordinate with QA-15 (portrait zoom) if both change
  `frameAction()`.

## Log
- 2026-11-08 (qa): filed; added `test/playback-framing.mjs`.
