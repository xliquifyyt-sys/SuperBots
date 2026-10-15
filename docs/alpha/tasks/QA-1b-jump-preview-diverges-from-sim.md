---
id: QA-1b
milestone: M2
role: gameplay
status: todo
depends: []
severity: P2
---
# QA-1b: Jump preview and the real jump disagree on slopes and ledge corners

Found while working QA-1a. `World.previewAction` (jump / Molten Slam / Updraft ghost) and the real
resolve start from the same position and velocity, but they drift apart within a few frames when
the bot leaves a ramp. A small drift is enough to make the real bot clip a ledge corner that the
preview cleared, so the AI picks a jump the preview calls safe, and the bot falls into the kill floor.

## Repro (on `origin/main` at 15d79da)

`node test/trace.mjs bulwark skyla emberpit 5004`, turn 3. Skyla stands on the right flank ramp at
(19.72, 8.75) and jumps with aim (-0.994, 0.111), power 0.787.

- Preview: lands at (6.18, 11.50).
- Real: y is 0.02 higher after frame 1 and 0.13 higher by frame 9. On frame 10, vy goes from -5.8
  to +0.8 (a head bump on the floating step `R(18.5, 6, 3, 0.7)`). On frame 32 she hits the summit
  wall, drops down the crater shaft, and is eliminated (`fell`) at (15.3, 15.1) without taking damage.

Things that differ between `step()` and the ghost loop, not yet checked as the cause: `b.onSlope`
(the ghost recomputes `onSlopeG` every frame, and the real flag is set inside `resolveBotTerrain`),
and the frame at which `facing` changes for an asymmetric hull.

After QA-1a, plain-jump self-eliminations make up most of what is left in `node test/ai-selfkill.mjs`
(30 / 280 games, compared with 43 before).

## Acceptance

- [ ] For every standard map, a jump preview from a resting spawn (and from a ramp spot) matches the
      real resolve to within 0.02 units per frame until landing, when no other bot is involved.
      Add this as a new test.
- [ ] `node test/determinism.mjs 6` and the other CLAUDE.md gates are green. If the fix changes
      the real physics rather than the preview, put the before/after `node test/balance.mjs 3`
      table in the PR body.

## Log
