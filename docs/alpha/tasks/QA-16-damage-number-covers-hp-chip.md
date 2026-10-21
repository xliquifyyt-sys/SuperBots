---
id: QA-16
milestone: M1
role: client-ui
status: todo
depends: []
severity: P3
---
# QA-16: Floating damage numbers are drawn on top of the bot's HP chip and hide the HP value

Found by the 2026-10-17 nightly QA run (`QA_SET=2 node test/qa-playthrough.mjs <dir> 4`, Volt in a
5-bot FFA on Skyline Grid at 1280x720, turn 7 playback). Nova (Gravitas) took a hit near the top of
its sprite; the white "-25" (`src/render/renderer.js` ~265, spawned at `e.y - 0.8`) sits exactly over
the HP chip, so the HP number is unreadable for the ~1s the number lives. Damage numbers are drawn
after the bot overlays (`drawNumbers`), so they always win.

Screenshot: `docs/alpha/qa/2026-10-17/m5-skylinegrid-1280x720-plan-T5.jpg` (left, "Nova" — the file
name says plan-T5 but the frame is turn 7 playback).

Expected: damage numbers spawn above the name tag (or drift away from it first), never on the HP chip.
Actual: "-25" covers the HP value.

Related: M1-04 (damage numbers follow the hit bot) — fix both together if convenient.

## Acceptance

- [ ] Damage/label numbers spawn at least one name-tag height above the HP chip of the hit bot
      (presentation only; no `World` writes).
- [ ] Screenshot of a hit on a bot in the Log showing HP chip and number both readable.
- [ ] Browser smoke gate and determinism 6 green.

## Log
- 2026-10-21 nightly QA: `node test/label-tag-overlap.mjs` (new, filed with QA-21) also covers this: the `-25`
  damage number rises onto the name text (36% at zoom 22, 76% at zoom 40) and `blocked` onto the HP chip (26–50%).
