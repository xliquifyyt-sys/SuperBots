---
id: QA-36
milestone: M1
role: gameplay
status: todo
depends: []
severity: P1
---
# QA-36: Rally Beacon lasts 3 turns; defs, Botpedia and How to Play say 2

Found by the 2026-11-10 nightly QA run while checking Botpedia power-up text against the sim.

## Repro

`node test/buff-duration.mjs` (new, not a CI gate). On main (ec2c004):

```
ok   Amp: defs turns 4, active 4 turns counting the pickup turn
ok   Plating: defs turns 4, active 4 turns counting the pickup turn
ok   Thrusters: defs turns 4, active 4 turns counting the pickup turn
ok   Reflector Coat: defs turns 2, active 2 turns counting the pickup turn
FAIL Rally Beacon: defs turns 2, active 3 turns counting the pickup turn
FAIL Rally Beacon (teammate warden): active 3 turns
```

Seed 5, teams, Ember Pit (any seed gives the same result; the duration does not depend on the RNG).

## Expected / actual

- Expected: Rally Beacon's +10% damage lasts `POWERUPS.rally.turns` = 2 turns counting the pickup turn, the way
  every other buff uses `pu.turns` (Reflector Coat, also `turns: 2`, is active on the pickup turn and the next).
  The Botpedia card says "+20 HP and +10% damage for 2 turns".
- Actual: `src/core/sim.js` `applyPowerup` case `'rally'` (~line 1209) calls `this.addEffect(o, 'rally', 3)` with a
  hard-coded 3, so the buff is active on the pickup turn and the next two (3 turns). `POWERUPS.rally.turns` is never
  read.

The same case also hard-codes `+20` HP and the `20` overheal cap, `1.1` in `applyDamage` (~line 788) and `+40` for
Repair Kit (~line 1203). CLAUDE.md says every gameplay number lives in `defs.js`.

## Fix

Decide the intended length (2 per defs and the Botpedia text, or 3), then make the sim read it from
`POWERUPS.rally.turns` and make the text match. Moving the HP/damage numbers into `POWERUPS` (`hp: 20`,
`dmgMul: 1.1`, `repair.hp: 40`) is the same change. If the duration changes, paste `node test/balance.mjs 3`
before/after in the PR (teams only; 1v1 duels never spawn Rally).

Related: QA-35's help-text test assumes Rally lasts 2, which matches defs but not the sim today.

## Acceptance

- `node test/buff-duration.mjs` shows `ok` on both Rally Beacon lines (the Toxin line is QA-37).
- Determinism, rules and features gates still pass.

## Log

- 2026-11-10 (QA nightly): filed. Verified by calling `World.applyPowerup` and counting `endTurn` ticks until
  `hasEffect` is false, for the picker and a teammate.
