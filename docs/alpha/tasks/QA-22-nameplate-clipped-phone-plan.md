---
id: QA-22
milestone: M1
role: client-ui
status: todo
depends: []
severity: P3
---
# QA-22: Phone plan view cuts bots' nameplates at the screen edge (your own HP chip included)

Found by the 2026-10-22 nightly QA run (`node test/qa-playthrough.mjs <dir>`, set 1, 390x844). In the plan phase on a
phone, a bot standing near the left or right edge of the camera window keeps its body on screen but its
nameplate (dark capsule, HP chip, HP bar, name) runs off the edge:

- `docs/alpha/qa/2026-10-22/m3-canopyruins-390x844-plan-T5.jpg` (left edge: your own Ricochet, HP chip "120" cut
  at x=0, so you can't read your own HP while aiming)
- `docs/alpha/qa/2026-10-22/m1-emberpit-390x844-plan-T5.jpg` (right edge: Nova's name reads "No", READY! tag cut)

Cause: `src/render/renderer.js` `fitForPlan()` (portrait) windows ~22 units around your bot and lets the camera
stop 1 unit outside the map (`visW / 2 - 1`), and `drawBots` centres the nameplate on the bot (it is about 3.4
units wide at that zoom: `bw = max(40, r * 3.1)` plus the HP chip to the left) with no clamp to the viewport.
Landscape (`fitMap`) is not affected. Related but separate: QA-6 (opponents fully off-screen in portrait plan) and
QA-18 (combat text clipped during playback).

Expected: every visible bot's nameplate is fully on screen while planning (clamp the capsule inside a small margin,
or frame the camera so pads near the window edge keep their tag in view).
Actual: 29 pad/viewport cases on all 10 maps clip the nameplate at 390x844 (none at 1280x720).

Repro: `python3 -m http.server 8123 & CHROMIUM_PATH=... node test/nameplate-edge.mjs` → exits 1 on main, listing
each map/pad whose nameplate leaves the screen (uses the real `fitForPlan`/`toScreen` and `drawBots`' nameplate
formulas).

## Acceptance

- [ ] `node test/nameplate-edge.mjs` exits 0 (presentation only; no `World` writes).
- [ ] Screenshot in the Log of a 390x844 plan view with a bot at the map edge and its full nameplate visible.
- [ ] Browser smoke gate and determinism 6 green.

## Log
- 2026-10-22 nightly QA: filed; added `test/nameplate-edge.mjs` (new file, not in CI).
