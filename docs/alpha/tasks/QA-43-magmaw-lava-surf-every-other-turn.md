---
id: QA-43
milestone: M1
role: gameplay
status: todo
depends: []
severity: P1
---
# QA-43: Magmaw survives lava only every other turn, but its passive says "each turn"

Found by the 2026-11-15 nightly QA run while reading the kill-floor branch of `World.step` in `src/core/sim.js`
against specs 03 and 06.

## Repro

`node test/magmaw-lava.mjs` (new, not a CI gate). On main (5ba9a7f):

```
ok   drop 1 (turn 1): surf true, alive true
FAIL drop 2 (turn 2, 1 turn(s) later): surf false, alive false (passive: survives the first contact each turn)
ok   drop 1 (turn 1): surf true, alive true
ok   drop 2 (turn 3, 2 turn(s) later): surf true, alive true
ok   drop 1 (turn 1): surf true, alive true
ok   drop 2 (turn 4, 3 turn(s) later): surf true, alive true
```

Seed 7, FFA, Ember Pit, Magmaw v Volt, hazards/power-ups/air strikes off (the result does not depend on the
seed). The test drops Magmaw into the centre pit, parks it back on its pad once it surfs, and drops it again N
turns later.

## Expected / actual

- Expected: the passive shown to players (`defs.js` `BOTS.magmaw.passive`, Botpedia) reads "Survives the first
  lava contact each turn." Spec 06 says the surf gives "2 turns of lava immunity afterwards". Either reading means
  a Magmaw that touches lava on turn 2 after surfing on turn 1 lives.
- Actual: the surf sets `b.lavaImmune = 2` and the surf branch requires `b.lavaImmune <= 0`. `endTurn` takes it to
  1, so on the next turn the first lava contact kills (cause `fell`). `lavaImmune` works as a surf cooldown, the
  opposite of immunity: Magmaw survives at most one lava contact every two turns. Spec 03's implementation note
  describes the code ("or while lavaImmune is active, kill normally"), so specs 03 and 06 disagree with each other
  and the in-game text disagrees with the code.

Impact: a player who reads the passive and dives Magmaw into the lava two turns running loses the bot. The AI
treats lava as deadly for every bot (`planner.js` adds danger near `lavaY` without a Magmaw exception), so this is
mostly a human-play bug.

## Fix

Design call for the gameplay owner, either:
1. keep the cooldown and fix the words: passive text "Survives one lava contact every 2 turns.", spec 06 "then
   cannot surf again until the turn after next"; update `test/magmaw-lava.mjs` to expect death in the gap-1 case; or
2. match the text: drop the `lavaImmune` check so the first contact every turn surfs (rename the field), and rerun
   determinism and balance (paste the `node test/balance.mjs 3` table — Magmaw sits at 43% in 1v1).

## Acceptance

- `node test/magmaw-lava.mjs` exits 0 (with the expectations matching whichever option is chosen).
- Passive text, spec 03 and spec 06 describe the same rule.
- All CI gates green.

## Log

- 2026-11-15 (QA nightly): filed; added `test/magmaw-lava.mjs`.
