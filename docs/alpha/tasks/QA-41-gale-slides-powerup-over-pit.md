---
id: QA-41
milestone: M1
role: gameplay
status: todo
depends: []
severity: P3
---
# QA-41: Gale Shot can slide a power-up off a ledge, where it hovers over the water/void and can't be collected

Found by the 2026-11-13 nightly QA run while reading Skyla's Gale Shot against spec 03 and 04.

Spec 03 (Skyla S2) and spec 04 say Gale Shot slides power-ups in its cone 3.5 units along the aim and
"drops them back to the ground". `galeShot()` (src/core/sim.js ~line 645) moves `pu.x` by 3.5 (clamped to the
map) and calls `dropToGround(pu)`. When the new x has no terrain under it (a ledge edge, a gap between
platforms), `dropToGround` falls until `obj.y > lavaY - 0.6` and then **stops there** (~line 704): the power-up is
left hovering 0.6 above the water, void or lava kill floor. A bot can only touch it while already falling to its
death (pickup radius 0.6 from the body outline puts the bot's feet below `lavaY - 1.2`), so it is dead weight that
holds one of the 3 (5 on battle maps) field slots until it expires, and it is drawn floating over the water/void.

How often: geometric, so every map with a ledge near a power-up spawn. 11 of the 144 spawn x direction slides end
hovering (Frozen Keel 3, Temple Crossing 2, Cloud Steps 6). In 60 hard AI matches with Skyla on those three maps
(seeds 5000-5019, power-ups high) the AI cast 19 Gales, 5 moved a power-up, none off a ledge, so this mostly
happens when a human aims Gale at someone standing near a power-up on a ledge.

## Repro

```bash
node test/gale-powerup.mjs     # new, not a CI gate: 11/144 FAIL on main (2026-11-13, 0 s)
```

For every map power-up spawn and both directions, Skyla stands 2.5 units from the dropped power-up at the same
height and casts a real `galeShot`. First failure:
`frozenkeel power-up at (3, 3.9) slid right from x 3.00 -> (6.50, 14.90), hovering 0.60 above the water kill floor (y 15.5)`.
Seed-independent (no RNG in the slide).

## Expected / actual

- Expected: a slid power-up ends on terrain. Either stop the slide at the ledge edge (search back toward the start
  x for the last point with ground above the kill floor), or let it fall into the kill floor and remove it with a
  `powerupExpire` event (and a splash), and say which in spec 03/04.
- Actual: it hovers 0.6 above the kill floor until its timer runs out.

## Acceptance

- [ ] `node test/gale-powerup.mjs` exits 0 (or is updated in the same PR to assert the chosen "removed into the
      kill floor" behaviour, with a `powerupExpire` event).
- [ ] Spec 03 (Gale Shot) and spec 04 describe what happens to a power-up slid off a ledge.
- [ ] determinism 6, rules, features, bughunt 2 and balance-gate 2 green; this changes simulation, so paste the
      `node test/balance.mjs 3` before/after table in the PR.

## Log
- 2026-11-13 (qa): filed from the nightly run; added `test/gale-powerup.mjs` (fails on main).
