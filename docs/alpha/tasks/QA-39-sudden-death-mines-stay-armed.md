---
id: QA-39
milestone: M1
role: gameplay
status: todo
depends: []
severity: P1
---
# QA-39: Spike mines stay armed in Sudden Death and can hit a bot the moment it is revived on its pad

Found by the 2026-11-12 nightly QA run while reading the hazard code against spec 06.

`docs/spec/06-hazards-and-map-elements.md` says hazards "are suspended during Sudden Death" and spec 01 (turn
loop step 3) says hazards are skipped "always during Sudden Death". The *announce/plant* step honours that
(`startTurn`: `if (this.settings.hazards && !this.suddenDeath)`), but the timed mines already on the field are
neither cleared by `enterSuddenDeath()` (which clears power-ups, walls, fields, patches and projectiles) nor
disarmed: `step()` detonates them under `if (this.settings.hazards)` only (src/core/sim.js ~line 962), and
`projectileHit` likewise (~line 1082). Sudden Death then revives the tied bots on their spawn pads, and
`mineSpot()` never keeps mines off spawn pads, so a revived bot can land on a mine with no warning: 20 of its
60 Sudden Death HP gone on tick 1.

How often a mine sits on a pad: in 60 hard headless matches on Canopy Ruins and Temple Crossing (seeds
9000-9029, 2-5 bots), **6/60 matches** had a live mine within 1.2 of a spawn pad at some turn end
(8 of 415 turn ends; first example Canopy Ruins seed 9023 turn 6, phantom/volt/gravitas/skyla/magmaw).
Sudden Death itself is rare in AI play, so this mostly bites humans who trade KOs.

## Repro

```bash
node test/sd-mines.mjs     # new, not a CI gate: 4/4 FAIL on main (2026-11-12, 0 s)
```

It builds a 1v1 on each timed-mine map, puts a mine on / 0.6 beside A's pad, kills both bots, calls
`enterSuddenDeath`, and resolves one turn of skips. Actual on both maps: `A hp 60 -> 40, 1 mine detonation`.
Expected: no mine damage in Sudden Death.

## Expected / actual

- Expected: per spec, no map hazard acts during Sudden Death — clear `this.mines` in `enterSuddenDeath()` (like
  patches) or skip mine contact/projectile checks while `this.suddenDeath`.
- Actual: mines planted before Sudden Death stay live, aren't announced, and can sit on the revive pads.

## Acceptance

- [ ] `node test/sd-mines.mjs` exits 0.
- [ ] Spec 06 states what happens to mines on the field at Sudden Death (cleared or inert) and matches the code.
- [ ] determinism 6, rules, features, bughunt 2 and balance-gate 2 green; this changes simulation, so paste the
      `node test/balance.mjs 3` before/after table in the PR.

## Log
- 2026-11-12 (qa): filed from the nightly run; added `test/sd-mines.mjs` (fails on main).
