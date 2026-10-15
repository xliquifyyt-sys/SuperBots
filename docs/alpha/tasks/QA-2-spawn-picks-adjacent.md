---
id: QA-2
milestone: M0
role: gameplay
status: done
depends: []
severity: P1
---
# QA-2: pickSpawns puts bots on top of each other, and Frozen Keel 1v1 is lopsided

Found by the 2026-10-14 nightly QA run. In the UI playthrough, the two AIs in a 3-player Frozen
Keel FFA started touching on the centre platform. The results screen for that run showed Nova (Phantom) eliminated on turn 1 after taking 20 damage (`qa-playthrough` report, match m2).
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

- [x] For n=2, every standard map uses mirrored spawns (the two x positions sum to the map width ± 1).
- [x] For every map and every n in minPlayers..maxPlayers, no two picked spawns are closer than 4 units.
      Add this as an assertion in a new test or in `test/rules.mjs` (additions only).
- [x] Paste the before/after `node test/balance.mjs 3` table in the PR body. Frozen Keel results will move.
- [x] All CLAUDE.md gates are green.

## Log

### 2026-10-15 — gameplay agent (branch agent/QA-2-spawn-spacing)

**Status: blocked** on one red gate (`node test/bughunt.mjs 2`), caused by a latent sim bug the new
spawns expose, not by the spawn change itself. Details below; everything else is done.

Changed:
- `src/core/maps.js` `pickSpawns`: sorts the pads left to right (ties: y, then list index) before the
  evenly spaced pick. n=2 now always takes the outermost pads; picks run left to right, which is what
  Teams mode's "teammates get adjacent pads" assumed. Still a pure function of (map, n), no RNG draws,
  so the RNG draw order is unchanged (initial positions change, so match outcomes/hashes change).
- Spawn data: Magma Works `[22,14.5]` (on the ramp foot, 3.0 from `[19,14.5]`) moved to the catwalk
  `[16.5,9.5]`; `[6,14.5]` -> `[6.5,14.5]` and `[15,14.5]` -> `[14.5,14.5]` (were exactly 4.0 apart).
  Temple Crossing: the right ledge (x 39..46) held three pads 2.5 apart; now `[40,15.5]`, `[44.5,15.5]`
  there and the 8th pad on the left tree platform `[5.5,10.5]` (4 pads a side).
- New gate `test/spawns.mjs` (added to the CI `sim` job after rules, and to the CLAUDE.md gate list):
  for every map and n in minPlayers..maxPlayers, picked pads >= 4 apart, n=2 x-sum = width +- 1, picks
  ordered, repeatable, no bot drops > 1 below its pad on `settle()`, settled bots >= 4 apart, and the
  Frozen Keel 1v1 starts on opposite shelves. On origin/main the same file fails 14 checks.
- Spec: `tools/gen_spec.py` spawn-selection paragraph rewritten, `docs/spec/05-maps.md` regenerated,
  `docs/spec/11` test table gained the new gate.
- New task QA-7: four pads (emberpit 9/21, glacierfort 13/35) sit inside slope wedges and are pushed
  1.2-2.5 units sideways by settle (pre-existing; printed as info by test/spawns.mjs).

Closest pair after (`pickSpawns`, n = minPlayers..maxPlayers):
frozenkeel 25.5 12.1 8.9 | magmaworks 41.0 17.0 12.5 4.5 4.5 4.5 4.5 | templecrossing 42.5 13.8 5.2 4.6
4.5 4.5 4.5 | canopyruins 26.0 10.2 5.0 | all other maps unchanged (min 4.5).
Trace `node test/trace.mjs bulwark warden frozenkeel 5103`: bulwark @2.0,11.4, warden @27.5,11.4.

Gates (this worktree, 2-core box shared with two other workers): determinism 6 exit 0 (66s); rules 0;
spawns 0; headless 20 0 (52s); features 0 (563s); **bughunt 2 exit 1** (129s); mapid 0; balance-gate 2
exit 0 (152s); online 0 (50s); online-browser 0 (152s); browser (port 8133) 0 (54s); bughunt 3 exit 1.

Red gate: `ISSUE x1: mine inside terrain — templecrossing @36.998,5.9`. Same command on origin/main:
NO ISSUES FOUND. Cause: `World.randomGroundSpot` (src/core/sim.js) treats a rect as covering x only
within 0.1 of its edge, but a mine has radius 0.35 and bughunt allows 0.15 depth, so a mine planted
0.2 past the Temple Crossing L-post (36..36.8) on the platform below overlaps it by 0.152. The new
spawns change the trajectories, so a timed mine now lands there. Widening the margin to 0.25 in a
scratch copy cleared that issue but surfaced another latent one (`bot embedded in terrain — glacierfort
T4 ricochet @35.6,15.8 depth 0.30`, the keep ramp). Both fixes belong in sim.js, which this task was
told not to touch. Unblock: land the sim.js terrain/mine fix, rebase, rerun bughunt 2/3, set done.

Balance (`node test/balance.mjs 3`), before (origin/main 263b17a) -> after:
bulwark 62 -> 64, magmaw 45 -> 40, volt 57 -> 52, warden 69 -> 60, skyla 12 -> 14, phantom 21 -> 19,
ricochet 55 -> 55, gravitas 29 -> 38.

### 2026-10-15 (round 2) — unblocked, done

Merged origin/main (M0-15) and origin/agent/M0-12-vent-exit-sink (PR #22: `mineSpot()` + terrain
separation fix) into this branch with merge commits. bughunt 2/3 are now clean.

One more gate went red after the merge: `node test/features.mjs` reported `events missing: wallHit`.
`wallHit` only fires when a projectile weaker than a Bastion Wall segment's HP (10) hits a fresh
segment. The 90-match random batch saw one on the M0-12 base (features exit 0) but none once the spawn
positions moved. That is a coverage shift, not a sim change. Fix (additions only): an explicit scenario
in `test/features.mjs` puts a segment in front of Volt, fires a 4-damage shard into it, and checks for
`wallHit` with the segment still standing at less than full HP.

Gates after the merge (this worktree): npm install 0; determinism 6 0 (49s); rules 0; spawns 0;
headless 20 0 (46s); features 1 (388s, wallHit) -> 0 after the scenario (392s, events missing: none);
bughunt 2 0 (87s, NO ISSUES FOUND); mapid 0; balance-gate 2 0 (105s); online 0 (50s);
online-browser 0 (95s); online-maps 0; online-settings-layout 0; browser on :8133 0 (44s);
bughunt 3 0 (148s, NO ISSUES FOUND); terrain-embed 3 0 (151s, NO BOT EMBEDDED IN TERRAIN);
gen_spec leaves 03/05 unchanged.

Balance `node test/balance.mjs 3`, base = M0-12 tip (main + PR #22, no QA-2) -> this branch:
bulwark 64 -> 67, magmaw 45 -> 40, volt 55 -> 52, warden 69 -> 60, skyla 12 -> 14, phantom 17 -> 17,
ricochet 55 -> 55, gravitas 36 -> 43. No defs.js numbers changed by QA-2.

