---
id: QA-8
milestone: M1
role: gameplay
status: todo
depends: []
severity: P3
---
# QA-8: Results screen and match summary report one more turn than was played

Found by the 2026-10-15 nightly QA run. Skyline Grid (1280x720): the last bot died on turn 5 and the
playthrough counted 5 played turns, but the results header says "You · Skyline Grid · 6 turns". The
same +1 shows on all five playthroughs (`docs/alpha/qa/2026-10-15/report.json`, `docs/alpha/qa/2026-10-15/m5-skylinegrid-1280x720-result.jpg`).

Cause: `Match#beginAnnounce` (src/core/match.js:69) sets `this.turn = this.world.turn + 1` *before*
`checkWin()`, so when the match ends `m.turn` already points at a turn that never runs.
`src/main.js:282` prints `m.turn` and `Match.simulateHeadless` returns `turns: m.turn`, so
`test/headless.mjs` "in N turns", the avg-turns lines in `balance.mjs`/`stress.mjs`, and the server's
`phase: 'over'` broadcast all overcount by one. The turn cap (`this.turn > turnCap`) is correct and
must keep its current behaviour.

Repro: `node test/turn-count.mjs 12` → `11 elimination wins checked, 11 report the wrong turn count`
(e.g. seed 7000 emberpit 2p: reports 5 turns, last death on turn 4).

Expected: "N turns" = turns actually resolved. Actual: N + 1.

## Acceptance

- [ ] `node test/turn-count.mjs 40` exits 0.
- [ ] Turn cap still ends the match after exactly `turnCap` turns (`node test/rules.mjs` green).
- [ ] determinism 6, features, online gates green; no `defs.js` change.

## Log
