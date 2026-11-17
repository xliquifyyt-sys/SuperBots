---
id: QA-45
milestone: M1
role: gameplay
status: todo
depends: []
severity: P1
---
# QA-45: Static Field stays on the map for a second turn but never shocks anyone then

Found by the 2026-11-17 nightly QA run while reading the field code against specs 02, 03 and 06.

## Repro

`node test/static-field-linger.mjs` (new, not a CI gate). On main (7c7bec9):

```
ok   first cleanup: bot inside the field is Shocked (effects {"shocked":2})
ok   field still on the map (and rendered) during the next turn: true
FAIL second cleanup: bot that moved into the still-visible field is Shocked (effects {})
```

Seed: 11 (the test places the field directly; the result does not depend on the seed).

## Expected / actual

- Expected: spec 06 ("Static field (Volt): radius 3, 2 turn counters; applies Shocked at end of turn to anyone
  inside") and spec 03 (`{r: 3, turns: 2}` left at the impact point): a field that is still on the map at a cleanup
  shocks the bots inside it, so it zones an area for the next turn as well.
- Actual: `World.impact()` pushes `{ turns: 2, kind: 'static' }` (`src/core/sim.js` ~line 1149), but
  `World.endTurn()` (~lines 1178-1182) applies Shocked only while `!f.applied` and then sets `f.applied = true`.
  The field survives the first cleanup with `turns` 1, the renderer (`src/render/renderer.js` ~line 503) keeps
  drawing the crackling yellow disc for the whole next turn, and a bot that ends that turn inside it gets nothing.
  The player sees a hazard that does nothing; the `turns: 2` counter has no gameplay effect.

Screenshot: n/a (sim rule; the field is drawn by `renderer.js` for as long as it is in `world.fields`).

## Fix

Gameplay owner decides which one is the rule, then make code, render and spec agree:
- (a) Field shocks at every cleanup while it exists — drop the `applied` gate. This makes Static Field stronger, so
  paste the before/after `node test/balance.mjs 3` table (Volt is already 55% in 1v1s), or
- (b) Field is a one-shot — create it with `turns: 1` so it disappears at the cleanup that applies it, and fix
  spec 03/06.
Either change touches the sim, so `node test/determinism.mjs 6` must still pass and the AI's +10 Static Field
score (spec 07) should be re-checked.

## Acceptance

- `node test/static-field-linger.mjs` passes (for option b, change its second check to "no static field is left on
  the map after the cleanup that applied it" — additions only, keep the first check).
- `node test/determinism.mjs 6`, `node test/rules.mjs` and `node scripts/ci/balance-gate.mjs 2` still pass.

## Log

- 2026-11-17 (qa nightly): filed; `test/static-field-linger.mjs` added.
