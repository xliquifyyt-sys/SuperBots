---
id: QA-46
milestone: M1
role: gameplay
status: todo
depends: []
severity: P1
---
# QA-46: Jump guide (and the AI's look-ahead) shows a safe landing for jumps that end in the pit

Found by the 2026-11-18 nightly QA run with a new probe, `test/preview-fidelity.mjs`.

Spec 02 says the jump preview "runs exactly this motion including drag, substeps, wind and the landing rule,
so the dotted guide ends where the bot will land". `World.previewAction` is also what `src/ai/planner.js`
(lines ~156 and ~281) uses to score candidate jumps, so a wrong preview is both a lying guide for the player
and a planner that walks off ledges (a root cause behind QA-3, which still measures 58/280 = 20.7% undamaged
self-eliminations tonight).

## Repro

`node test/preview-fidelity.mjs 6` (new, not a CI gate; report, exit 1 on any miss). For every map x bot, a lone
shooter (foe parked, no power-ups/air strikes) plans a seeded spread of jumps and missiles; the preview's
landing/impact is compared with where the real resolve leaves the bot / the first explosion. Cases where the
foe gets involved or the preview hits the foe are skipped. On main eed94c7:

```
jump: 20/330 previews off by more than 0.6 units (or wrong fate); 7 of them show a safe landing for a bot that dies, or a death for one that lands
  by map: {"templecrossing":3,"emberpit":3,"glacierfort":5,"frozenkeel":3,"nimbus":2,"skylinegrid":2,"canopyruins":2}
missile: 0/275 previews off by more than 0.6 units
```

Missiles are exact; jumps are not. Same result with `--hazards`.

Single cases (each is `players [A=<bot>, B=bulwark (warden if A is bulwark)]`, `hazards:false, powerups:'off',
airStrikes:'off'`, `new Match(players, settings, seed).start()`, bot 0 jumps with the aim, bot 1 skips):

| map | bot | seed | aim (dx, dy, power) | guide says | real |
|---|---|---|---|---|---|
| glacierfort | volt | 833612 | -0.618, -0.786, 0.708 | lands (38.70, 16.43) | slides off the ledge, dies (37.64, 19.91) |
| glacierfort | bulwark | 446497 | -0.857, -0.515, 0.729 | lands (41.58, 16.39) | dies (37.81, 19.91) |
| frozenkeel | gravitas | 669329 | 0.193, -0.981, 0.858 | lands (6.00, 11.39) | slides off, dies (7.16, 15.06) |
| frozenkeel | magmaw | 109060 | 0.411, -0.912, 0.555 | lands (5.92, 11.47) | dies (7.15, 14.95) |
| emberpit | phantom | 221258 | 0.955, -0.297, 0.981 | lands (9.95, 8.96) | glances off, flies on, dies in lava (15.04, 15.01) |
| templecrossing | ricochet | 891295 | -0.902, -0.431, 0.981 | falls to the floor (37.10, 18.00) | lives (28.74, 15.38) |
| canopyruins | ricochet | 105663 | 0.829, -0.559, 0.887 | lands (27.90, 13.38) | slides back down to (25.44, 13.38) |

## Expected / actual

- Expected: the guide's end point is where the bot comes to rest (within the ~0.5-unit marker), and a guide that
  ends in a safe landing never belongs to a jump that kills the bot.
- Actual — three separate divergences between `previewAction` (sim.js ~1230-1270) and `World.step`, traced
  frame by frame:
  1. **Early stop.** The preview declares a landing after 2 grounded frames with speed < 3
     (`restFrames >= 2`), but the real bot is still moving at up to 3 u/s and keeps sliding under ground
     friction: off ledge edges into the pit (Glacier Fortress, Frozen Keel) or back down slopes (Canopy Ruins).
     The real resolve only stops at `PHYS.restSpeed` (`done()`).
  2. **Looped-edge wrap.** On `teleporters` maps the real step calls `landAfterWrap(b)` after wrapping x, which
     lifts a bot that wrapped into a terrain column onto its top; the preview only wraps x. Temple Crossing
     ricochet: the guide shows a fall to the floor, the real bot is lifted onto the ledge and lives. Skyline
     Grid / Nimbus Reach cases are 1.4-1.6 units off for the same reason.
  3. **Contact response.** Ember Pit phantom: frames match until ~0.4 s, then the preview stops on the slope
     edge at (9.95, 8.96) while the real bot (8.91, 9.47 → 11.10, 8.22) deflects off it and flies on into the
     lava. The ghost uses its own copy of the collision/landing code instead of the real one.

## Fix

Gameplay: make `previewAction` for jumps run the same per-step bot motion as `World.step` (factor the bot
integrator, collision, wrap + `landAfterWrap` and landing rule into one function both call), and stop on the real
rest condition (`PHYS.restSpeed`, as in `done()`) or on death, instead of `speed < 3`. Cap the loop length as now.
This changes AI choices, so determinism/balance gates rerun; paste the `node test/balance.mjs 3` table, and
re-measure `node test/ai-selfkill.mjs` in the PR body.

## Acceptance

- `node test/preview-fidelity.mjs 6` exits 0 (no jump preview off by more than 0.6 units, no wrong fate).
- `node test/ai-selfkill.mjs 1` self-elimination rate does not rise (report before/after).
- All CI gates green.

## Log

- 2026-11-18 (QA nightly, main eed94c7): filed; added `test/preview-fidelity.mjs`.
