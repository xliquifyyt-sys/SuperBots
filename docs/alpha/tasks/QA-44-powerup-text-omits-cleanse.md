---
id: QA-44
milestone: M1
role: client-ui
status: todo
depends: []
severity: P3
---
# QA-44: Repair Kit and Overclock text hide that they clear Poison/Burn and Shocked

Found by the 2026-11-16 nightly QA run while reading `applyPowerup` against spec 04.

## Repro

`node test/powerup-desc.mjs` (new, not a CI gate). On main (0e69100):

```
FAIL Repair Kit clears poison; desc "+40 HP." does not say so
FAIL Repair Kit clears burn; desc "+40 HP." does not say so
FAIL Overclock clears shocked; desc "Reset both special cooldowns." does not say so
3/3 cleared statuses missing from power-up text
```

Seed: 11 (the test is deterministic; the check is per power-up, not per match).

## Expected / actual

- Expected: the player-facing text says what the power-up does. Spec 04 (`docs/spec/04-powerups-and-status-effects.md`
  rows for `repair` and `overclock`) documents the running sim: Repair Kit "+40 HP (capped at max). Also clears
  Poison and Burn."; Overclock "Both special cooldowns to 0. Also clears Shocked." (`src/core/sim.js` `applyPowerup`,
  ~lines 1203-1204, `delete b.effects.poison/burn/shocked`).
- Actual: `POWERUPS.repair.desc` is "+40 HP." and `POWERUPS.overclock.desc` is "Reset both special cooldowns." —
  the text in the Botpedia power-up list (`src/main.js` ~line 133) and the HUD status rows (`src/ui/game.js` ~line 290).
  A poisoned or shocked player has no way to learn these power-ups are the cure.

Screenshot: n/a (text in `defs.js`).

## Fix

Text-only: extend the two `desc` strings in `src/core/defs.js`, e.g. "+40 HP. Clears Poison and Burn." and
"Reset both special cooldowns. Clears Shocked." These are strings, not gameplay numbers, so no balance table is needed.

## Acceptance

- `node test/powerup-desc.mjs` passes.
- `node test/determinism.mjs 6` and `test/browser.mjs` still pass.

## Log

- 2026-11-16 (qa nightly): filed; `test/powerup-desc.mjs` added.
