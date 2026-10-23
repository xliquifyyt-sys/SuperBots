---
id: QA-1
milestone: M0
role: gameplay
status: todo
depends: []
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

- [ ] `node test/net-parity.mjs 3` exits 0 (0 desynced).
- [ ] `node test/online-8p.mjs` passes 3 runs in a row.
- [ ] `node test/determinism.mjs 6` and all CLAUDE.md gates are green.
- [ ] `test/net-parity.mjs 2` is added to `.github/workflows/ci.yml` (additions only).

## Log
- 2026-10-19 nightly QA (main deaafb4): still open. `node test/net-parity.mjs` 14/30 desynced (e.g. `DESYNC
  skylinegrid seed 31900 after turn 3 (AI: skyla,phantom,ricochet,gravitas)`). `node test/online-8p.mjs` (Nimbus, real
  server, 4 ws clients + 4 random server AI) FAILED tonight: all 4 clients diverge from the server digest from turn 5
  (it passed last night, so it depends on the random AI roster, as this task predicts).
- 2026-10-23 nightly QA (main 35e681b): still open. `node test/net-parity.mjs` 14/30 desynced (same seeds). `node
  test/online-8p.mjs` (Nimbus) FAILED again: all 4 clients diverge from the server digest from turn 7 (bot 2 alive
  with 15 HP on the clients, dead on the server); it passed on 2026-10-22, consistent with the random AI roster.
