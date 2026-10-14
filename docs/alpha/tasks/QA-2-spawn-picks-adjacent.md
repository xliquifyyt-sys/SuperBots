---
id: QA-2
milestone: M0
role: gameplay
status: todo
depends: []
severity: P1
---
# QA-2: pickSpawns puts bots on top of each other, and Frozen Keel 1v1 is lopsided

Found by the 2026-10-14 nightly QA run. In the UI playthrough, the two AIs in a 3-player Frozen
Keel FFA started touching on the centre platform. One of them died on turn 1.
Screenshot: `docs/alpha/qa/2026-10-14/m2-frozenkeel-1280x720-plan-T1.jpg`. In a 6-bot Temple
Crossing game, Kilo and Ozzy also spawned overlapping:
`docs/alpha/qa/2026-10-14/m4-templecrossing-1280x720-plan-T1.jpg`.

## Cause

`pickSpawns(map, n)` in `src/core/maps.js` takes evenly spaced indices from `map.spawns`. It
assumes the list runs left to right, but several maps list their spawns in a different order.
Frozen Keel is `[[2,11.5],[27.5,11.5],[2.5,4],[27,4],[10,7.7],[19.5,7.7],[16,7.7],[12,7.7]]`:

- n=2 picks indices 0 and 7, so the bots start at (2, 11.5) and (12, 7.7). The far side, (27.5, 11.5), is never used.
  **Every Frozen Keel 1v1 is asymmetric.** That includes Quick 1v1, `balance.mjs` and the balance
  gate (trace: `node test/trace.mjs bulwark warden frozenkeel 5103` → warden @12.0,7.6).
- n=3 picks (10, 7.7) and (12, 7.7), only 2.0 units apart.

Closest spawn pair by player count (`pickSpawns` on main):

| map | 2 | 3 | 4 | 5 | 6 | 7 | 8 |
|---|---|---|---|---|---|---|---|
| frozenkeel | 10.7 | **2.0** | 7.5 | | | | |
| magmaworks | 20.0 | 5.5 | 7.0 | 5.5 | **3.0** | 4.0 | **3.0** |
| templecrossing | 43.5 | 11.0 | 6.2 | 4.8 | **2.5** | **2.5** | **2.5** |
| canopyruins | 24.4 | 5.4 | 4.9 | | | | |

Repro: `node -e "import('./src/core/maps.js').then(({MAPS,pickSpawns})=>console.log(pickSpawns(MAPS.frozenkeel,2),pickSpawns(MAPS.frozenkeel,3)))"`

## Acceptance

- [ ] For n=2, every standard map uses mirrored spawns (the two x positions sum to the map width ± 1).
- [ ] For every map and every n in minPlayers..maxPlayers, no two picked spawns are closer than 4 units.
      Add this as an assertion in a new test or in `test/rules.mjs` (additions only).
- [ ] Paste the before/after `node test/balance.mjs 3` table in the PR body. Frozen Keel results will move.
- [ ] All CLAUDE.md gates are green.

## Log
