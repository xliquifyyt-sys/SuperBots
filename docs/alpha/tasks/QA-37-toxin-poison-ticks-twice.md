---
id: QA-37
milestone: M1
role: gameplay
status: todo
depends: []
severity: P1
---
# QA-37: Toxin's Poison deals 10 on 2 turns (20), Botpedia says 10/turn for 3 turns (30)

Found by the 2026-11-10 nightly QA run while checking Botpedia power-up text against the sim.

## Repro

`node test/buff-duration.mjs` (new, not a CI gate). On main (ec2c004):

```
FAIL Toxin poison: damage on the next 6 turns [10,10,0,0,0,0] (Botpedia: 10/turn for 3 turns)
ok   Frost: frozen on the next 3 turns [true,false,false] (Botpedia: next turn only)
ok   Shockwire: shocked on the next 3 turns [true,false,false] (Botpedia: next turn only)
```

The test gives Volt the Toxin contact, calls `World.transferContact` onto Bulwark (the call the sim makes when two
bots touch during resolve), then runs `endTurn` / `startTurn` six times and records Bulwark's HP loss per turn.
Seed 5, Ember Pit; the result does not depend on the seed.

## Expected / actual

- Expected (Botpedia `POWERUPS.toxin.desc`): "Next bot you collide with is Poisoned (10/turn for 3 turns)" → 30 total
  over the three turns after the hit.
- Actual: `transferContact` (`src/core/sim.js` ~line 1037) does `addEffect(to, 'poison', 3)`. Contact happens during
  resolve, `endTurn` then decrements it to 2 before the first `startTurn` tick, so Poison ticks on 2 turns: 20 total.
  Frost (`frozen`, 2) and Shockwire (`shocked`, 2) use the same "one less than the number" convention and their text
  ("next turn") is right, so only Toxin is off. The `3` is hard-coded in `sim.js`, not in `defs.js`.

## Fix

Pick 20 or 30. Either set the poison length to 4 (via a new `POWERUPS.toxin.poisonTurns`) so it ticks 3 times, or
change the desc to "10/turn for 2 turns". Changing the sim is a gameplay number: paste `node test/balance.mjs 3`
before/after in the PR.

## Acceptance

- `node test/buff-duration.mjs` passes (together with QA-36).
- Determinism, rules and features gates still pass.

## Log

- 2026-11-10 (QA nightly): filed.
