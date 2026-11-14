---
id: QA-42
milestone: M1
role: gameplay
status: todo
depends: []
severity: P3
---
# QA-42: Repair Kit cuts an overhealed bot's HP back down to max

Found by the 2026-11-14 nightly QA run while reading `applyPowerup` in `src/core/sim.js`.

## Repro

`node test/repair-overheal.mjs` (new, not a CI gate). On main (af91391):

```
FAIL overhealed bot at 150/130 (0 turn(s) after Rally) picks Repair Kit -> 130 (must not drop)
FAIL overhealed bot at 140/130 (1 turn(s) after Rally) picks Repair Kit -> 130 (must not drop)
ok   damaged bot at 120/130 picks Repair Kit -> 130 (expect 130)
ok   damaged bot at 70/130 picks Repair Kit -> 110 (expect 110)
```

Seed 7, teams, Ember Pit, Volt picks Rally Beacon and then a Repair Kit (the result does not depend on the seed).

In real play: 0 of 19 Repair Kit pickups in 40 hard-AI 4-bot teams matches (powerups high, seeds 7000–7039) were
made while overhealed, so this is mostly a human-play bug: Rally overheal lasts two turn starts, and a player
who walks onto a Repair Kit in that window loses up to 20 HP for picking it up.

## Expected / actual

- Expected (spec 04): Repair Kit gives "+40 HP (capped at max)", and Rally overheal lets "HP sit up to 20 above
  max". A pickup that heals should never take HP away; an overhealed bot keeps its HP (the kit only clears
  Poison/Burn).
- Actual: `applyPowerup` `case 'repair'`: `b.hp = Math.min(b.maxHp, b.hp + 40)`. With `b.hp > b.maxHp` this sets
  HP to max, losing the overheal (up to 20 HP), and leaves `b.overheal` set (which then feeds QA-38).

## Fix

Gameplay: `b.hp = Math.max(b.hp, Math.min(b.maxHp, b.hp + 40))` (or skip the heal when `b.hp >= b.maxHp`). Move the
40 into `defs.js` with the other power-up numbers (see QA-36). This changes the sim, so the determinism and balance
gates rerun; paste the `node test/balance.mjs 3` table.

## Acceptance

- `node test/repair-overheal.mjs` exits 0.
- `node test/overheal-decay.mjs` unchanged or better.
- All CI gates green.

## Log

- 2026-11-14 (QA nightly): filed; added `test/repair-overheal.mjs`.
