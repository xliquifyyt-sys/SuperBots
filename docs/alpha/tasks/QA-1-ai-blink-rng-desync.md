---
id: QA-1
milestone: M0
role: gameplay
status: done
depends: [QA-1a]
severity: P0
---
# QA-1: Online desync: AI Phantom's Blink planning draws from the world RNG on the server only

Found by the 2026-10-14 nightly QA run. **Every online match with a server-AI Phantom can desync.**

## Root cause

`src/ai/planner.js` (blinkStrike branch, ~line 256) samples retreat spots with
`w.randomGroundSpot()`. That is a `World` method that draws from `world.rng`
(`src/core/sim.js` ~line 644). The server plans AI in `Match.beginPlan()`, so it advances the
shared sim RNG. Clients run `clock = 'client'`, skip AI planning and only replay the server's
action list, so their `world.rng` is behind. Every later RNG use (spike mines, burning-ground
patches, power-up and air-strike rolls) then differs, and the bot positions/HP diverge.

`test/determinism.mjs` cannot see this: it runs the same server-style pipeline twice. `online.mjs`
has no AI seats.

## Repro

- `node test/net-parity.mjs 2` (new): replays server-style vs client-style for 2 seeds on every
  map. **On main: 10/20 desync**, all of them the matches with an AI Phantom, e.g.
  `DESYNC nimbus seed 31700 after turn 5 (AI: skyla,phantom,ricochet,gravitas)`.
- `node test/online-8p.mjs` (new): a real server with 4 ws clients and 4 server AI on Nimbus.
  On main, all 4 clients log `client … server …` digest mismatches from turn 4 (whenever the
  random AI roster includes Phantom). Ran twice: nimbus (15 turns) and skylinegrid (13 turns), both failed.

Expected: client digest == server digest every turn. Actual: diverges 2–5 turns in.

## Fix (verified locally, not committed by QA)

Let the planner use its own RNG: `randomGroundSpot(tries = 30, rng = this.rng)` in sim.js and
`w.randomGroundSpot(30, this.rng)` in planner.js. With that patch, `net-parity.mjs 2` gave
0/20 desyncs (4 of 8 extra Nimbus seeds desynced before the patch, 0 after). Also check the planner for any
other `w.<method>()` call that draws from `w.rng` or writes to the world.

## Acceptance

- [x] `node test/net-parity.mjs 3` exits 0 (0 desynced).
- [x] `node test/online-8p.mjs` passes 3 runs in a row.
- [x] `node test/determinism.mjs 6` and all CLAUDE.md gates are green (on the tree combined with
      QA-1a; balance-gate 2 Skyla 29%, verified by the reviewer on 34b187b).
- [x] `test/net-parity.mjs 2` is added to `.github/workflows/ci.yml` (additions only).

## Log

### 2026-10-15 gameplay agent (branch agent/QA-1-ai-blink-rng-desync)

**Status: blocked on QA-1a.** The desync fix works and every gate except the balance band passes.
Changing the RNG stream changes which random games the 2-seed balance sample plays, and Skyla's
score in that sample drops from 3/28 wins to 1/28. Skyla is already on the floor (see M0-02).
Over 8 seeds Skyla's win rate is the same before and after (13%), so this is sampling noise at
the band edge, not a Skyla regression. The gate was not touched. Skyla's numbers were not tuned
here either: M2-04 says to fix the planner before buffing numbers, and the balance changes
belong to M2-03, QA-3 and QA-1a.

What changed
- `src/core/sim.js`: `randomGroundSpot(tries = 30, rng = this.rng)`. Hazards still use `world.rng` by default.
- `src/ai/planner.js`: Blink Strike retreat samples call `w.randomGroundSpot(30, this.rng)`.
- New `test/ai-purity.mjs`: wraps `world.rng.next` and serialises world state around every
  `AIPlanner.plan()` call, on every map with all 8 bots as AI. It fails if a plan draws from
  `world.rng` or changes world state. CI runs it as `node test/ai-purity.mjs 1`.
- `.github/workflows/ci.yml` (lines only added): `node test/net-parity.mjs 2` and `node test/ai-purity.mjs 1` in the sim job.
- `test/online-8p.mjs` (one line added): prints the roster, so a run shows whether a server-AI Phantom played.
- Spec: 11 (determinism contract: the planner never touches `world.rng`; new test rows), 06 (`randomGroundSpot` rng arg), 07 (blink samples use the planner RNG).

Producer checks (verified, not taken from the QA note)
- The planner RNG is seeded from the match seed: `match.js:52`
  `new AIPlanner(this.world, this.diff, new RNG(this.seed ^ 0x51ed27))`. The server and a local
  match get the same seed, so the planner's draws are a pure function of (seed, world).
- Only the planning side plans: `Match.beginPlan()` returns early when `clock === 'client'`.
  Clients only `beginPlayback(actions)`. Moving the draw from `world.rng` to `planner.rng`
  therefore takes a draw out of the shared stream that only the server made. Determinism
  (server vs server) keeps the same ordering.
- I checked the other world calls the planner makes (`availableActions`, `enemiesOf`, `sameTeam`,
  `hasCoverAbove`, `previewAction`). None reads `world.rng`. `previewAction` saves and restores
  `time` and `windX`, and `stepProjectile(…, ghost=true)` does not emit, push trails or reflect.
  ai-purity confirms this by running it: on main the only failures are Phantom plans with 6 world-rng draws.

Evidence (all run by me on this branch; 2 cores, one at a time)
- On main: `net-parity.mjs 2` gives **20 matches, 10 desynced** (every one with an AI Phantom, e.g. `DESYNC nimbus seed 31700 after turn 5`).
  `online-8p.mjs` gives 4 FAIL (Qa1-Qa4 digest mismatch from turn 4). `ai-purity.mjs 1` gives
  `331 AI plans checked, 24 with world side effects` (all `phantom: world.rng draws 6`).
- With the fix: `net-parity.mjs 2` 20/0 desynced, `net-parity.mjs 3` **30/0 desynced**, `ai-purity.mjs 1`
  `275 AI plans checked, 0 with world side effects`. `online-8p.mjs` passed 3 runs in a row on nimbus
  (rosters with AI phantom, phantom, none; 10, 13 and 14 turns, 0 FAIL) and 2 runs on skylinegrid.
- Gates: determinism 6 PASS, rules PASS, headless 20 PASS (0 errors), features PASS (events missing: none),
  bughunt 2 PASS, bughunt 3 PASS, online PASS, online-browser PASS, browser PASS (ERRORS none),
  **balance-gate 2 FAIL (skyla 4%)**. The same gate passes on main (skyla 11%).

balance.mjs 3 (no defs.js change; the AI RNG stream moved)
```
before (main)                         after (this branch)
bulwark  62%  107                     bulwark  60%  105
magmaw   45%   64                     magmaw   48%   67
volt     57%  109                     volt     62%  109
warden   69%  104                     warden   67%  103
skyla    12%   49                     skyla    10%   44
phantom  21%   46                     phantom  12%   41
ricochet 55%  100                     ricochet 52%  102
gravitas 29%   72                     gravitas 38%   71
```
balance.mjs 8 (448 duels): skyla 13% before and 13% after. Phantom 20% before, 15% after
(22 vs 17 wins of 112, about 1 sigma). The others moved by 4 points or less.

- 2026-10-15 (producer, second run): merged origin/main and QA-1a (`agent/QA-1a-skyla-balance-floor`)
  into this branch. Skyla's AI no longer kills herself with Updraft rain, so `balance-gate 2` clears the
  floor (Skyla 29% on the combined tree). Status `done` once the reviewer and CI agree.
