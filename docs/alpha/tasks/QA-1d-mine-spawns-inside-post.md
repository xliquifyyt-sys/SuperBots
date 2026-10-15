---
id: QA-1d
milestone: M0
role: gameplay
status: todo
depends: []
severity: P2
---
# QA-1d: A timed Spike mine can spawn overlapping the post of Temple Crossing's right L-platform

Found by `node test/bughunt.mjs 2` on `agent/QA-1a-skyla-balance-floor` at 00269da. The AI changes
there produce different matches, so the bug shows up. `origin/main` passes because of which matches
it happens to run.

`ISSUE x3: mine inside terrain — e.g. templecrossing @36.93952661007643,5.8999999999999995`
(bughunt run 0, Temple Crossing, turns 12 to 14).

## Cause

The timed-mine hazard calls `World.randomGroundSpot()`. That function takes the topmost rect within
±0.1 of the chosen x. At x = 36.94 the post `R(36, 5.1, 0.8, 1.4)` (x 36.0 to 36.8) falls outside
that ±0.1 window, so the spot is put on the platform below (`R(36, 6.5, 4, 0.8)`, top 6.5). The
mine ends up at y 5.9, 0.14 units from the post's side. Bughunt's check is a 0.35 circle with a
0.15 limit. The same function places burning-ground patches and the AI's Blink retreat samples.

## Acceptance

- [ ] `randomGroundSpot` never returns a spot where a body of the size it was placed for overlaps
      a rect other than the one it stands on. Add a test that samples it a few thousand times on
      every map.
- [ ] `node test/bughunt.mjs 2` reports no `mine inside terrain` on main and on
      `agent/QA-1a-skyla-balance-floor`.
- [ ] `node test/determinism.mjs 6` and all other CLAUDE.md gates are green.
- [ ] Note for QA-1: QA-1 also changes `randomGroundSpot` (its `rng` parameter). Keep both changes.

## Log
