---
id: QA-1a
milestone: M0
role: balance
status: todo
depends: []
severity: P0
---
# QA-1a: Skyla is on the balance-gate floor, so any change to the RNG stream turns the gate red

This task blocks the P0 desync fix QA-1 (branch `agent/QA-1-ai-blink-rng-desync`).

## Problem

Skyla's real 1v1 win rate is about 13% (`node test/balance.mjs 8`: 13% on main and 13% on the
QA-1 branch). `scripts/ci/balance-gate.mjs 2` plays only 28 games per bot, so each Skyla win is
worth 3.6 points, and the floor is 10%. On main the sample happens to give 3/28 (11%). QA-1 moves
6 random draws per Phantom plan from `world.rng` to the planner's RNG, so every duel with Phantom
plays different random games, and the sample then gives 1/28 (4%). Any correct change that
touches RNG ordering hits the same problem. M0-02's log warned about this.

Do not fix this by changing which RNG stream QA-1 uses or by picking seeds until the gate is
green. That is the same as weakening the gate.

## Options (pick one, in this order of preference)

1. Make the Skyla AI better (M2-04: "fix the planner before buffing numbers"). QA-3's traces
   show Hard Skyla jumping itself into the kill floor (`node test/ai-selfkill.mjs`: Skyla 11
   self-eliminations). If QA-3 lands first, rebase QA-1 on it and re-run the gate.
2. Buff Skyla in `src/core/defs.js` (M2-03 scope). The PR must carry before/after
   `node test/balance.mjs 3` and `node test/balance.mjs 8` tables.
3. A human merges QA-1 with the `human-approved` / `hold` labels, recording that the gate failure
   is sampling noise (the 8-seed evidence in QA-1's Log).

## Acceptance

- [ ] `node test/balance.mjs 8` shows Skyla clearly above 13% (at least 18%), which shows a real
      change and not seed luck.
- [ ] Rebased on top of this, the QA-1 branch passes `node scripts/ci/balance-gate.mjs 2`
      with Skyla at 10% or more, and all other CLAUDE.md gates.
- [ ] The gate band (`scripts/ci/`) is unchanged.

## Log
