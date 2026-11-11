---
id: QA-38
milestone: M1
role: gameplay
status: todo
depends: []
severity: P1
---
# QA-38: Rally overheal "decay" heals a damaged bot back to full HP

Found by the 2026-11-11 nightly QA run while reading the turn-start status code.

## Repro

`node test/overheal-decay.mjs` (new, not a CI gate). On main (b76427e):

```
ok   undamaged picker HP over turns [150,140,130,130] (max 130; expect 150, 140, 130, 130)
FAIL picker at 120/130 after a 30-damage hit (dmg setting 1) -> next turn 130, then 130 (overheal decay must not heal)
FAIL picker at 90/130 after a 60-damage hit (dmg setting 1) -> next turn 130, then 130 (overheal decay must not heal)
FAIL picker at 60/130 after a 90-damage hit (dmg setting 1) -> next turn 130, then 130 (overheal decay must not heal)
FAIL teammate at 90/130 after the hit -> next turn 130
FAIL bot killed with overheal, revived at 60 HP in sudden death -> next turn 130 (TURN.suddenDeathHp 60)
```

Seed 7, teams, Ember Pit, Volt picks Rally Beacon (the result does not depend on the seed).

In real play: 80 headless teams matches (4/6/8 bots, all maps, powerups normal, seeds 5000–5079) had 7 spurious
heals in 6 matches, 122 HP restored in total.

## Expected / actual

- Expected (spec 01 step 2 and spec 04): "Rally overheal decays by up to 10 toward max HP" — the decay only ever
  removes HP above max. A bot that has been hit below max keeps its HP.
- Actual: `src/core/sim.js` `startTurn` step 1 (~line 291):
  `if (b.overheal > 0) { const d = Math.min(10, b.overheal); b.overheal -= d; b.hp = Math.max(b.maxHp, b.hp - d); }`.
  `Math.max(b.maxHp, …)` sets HP to at least max HP, so any bot still carrying `overheal` that is below max is
  healed to full — on each of the next two turn starts (overheal 20 → 10 → 0). `applyDamage` never reduces
  `overheal`, and neither `kill()` nor the sudden-death revive in `enterSuddenDeath` clears it, so a bot killed
  with overheal and revived at 60 HP is healed to max on the next turn.

## Fix

Gameplay: apply the decay only above max, e.g. `if (b.hp > b.maxHp) b.hp = Math.max(b.maxHp, b.hp - d);`, and damage that takes HP to max or below should
zero `overheal`. Clear `overheal` in `kill()`. Move the 20/10 numbers into `defs.js` (see QA-36). This changes the
sim, so determinism/balance gates rerun; paste the `node test/balance.mjs 3` table.

## Acceptance

- `node test/overheal-decay.mjs` exits 0.
- All CI gates green.

## Log

- 2026-11-11 (QA nightly): filed; added `test/overheal-decay.mjs`.
