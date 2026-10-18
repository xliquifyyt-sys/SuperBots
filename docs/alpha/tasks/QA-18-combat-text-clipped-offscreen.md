---
id: QA-18
milestone: M1
role: client-ui
status: todo
depends: []
severity: P3
---
# QA-18: Combat text for hits at the screen edge is clipped ("Frie…"); playback camera leaves the struck bot off-screen

Found by the 2026-10-18 nightly QA run (`node test/qa-playthrough.mjs <dir> 3`, Warden in a 6p teams game on
Temple Crossing at 1280x720, seed of the script's fixed RNG, turn 2 playback). An orange-team bot at the right edge
is hit by a teammate's shot (friendly fire off). Its explosion and the grey `Friendly` floating label are drawn
half outside the viewport, so the label reads "Frie" and the bot itself is not visible. Ozzy at the left edge is
also cut off ("zy").

Screenshot: `docs/alpha/qa/2026-10-18/m4-templecrossing-1280x720-resolve-T2.jpg` (right edge, y≈470).

Cause: `src/render/renderer.js` pushes damage/KO/pickup labels at the event's world position (lines ~263–286) and
`drawNumbers()` draws them unclamped; the playback camera does not widen to include the bot being hit.

Expected: floating combat text is always fully on screen (clamp to a margin inside the viewport, or pin an edge
indicator), and playback framing includes every bot that takes a hit that turn.
Actual: text clipped at the viewport edge; struck bot off-screen.

Related: QA-15 (portrait camera too wide), QA-7 (roster covers bots).

## Acceptance

- [ ] At 1280x720 and 390x844, no floating label's bounding box extends past the canvas edge (add a check to
      `test/qa-playthrough.mjs` or a new test that records label boxes).
- [ ] Before/after screenshot in the Log. Browser smoke gate and determinism 6 green.

## Log
