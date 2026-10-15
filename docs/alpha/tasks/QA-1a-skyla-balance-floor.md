---
id: QA-1a
milestone: M0
role: balance
status: blocked
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

- [x] `node test/balance.mjs 8` shows Skyla clearly above 13% (at least 18%), which shows a real
      change and not seed luck.
- [x] Rebased on top of this, the QA-1 branch passes `node scripts/ci/balance-gate.mjs 2`
      with Skyla at 10% or more, and all other CLAUDE.md gates.
- [x] The gate band (`scripts/ci/`) is unchanged.

## Log

### 2026-10-15 (balance agent, branch `agent/QA-1a-skyla-balance-floor`)

**Blocked.** All three acceptance criteria hold on QA-1a merged with QA-1. QA-1a on its own branch
fails `node test/bughunt.mjs 2` (`mine inside terrain` x3, `bot embedded in terrain` x2). Both are
existing sim bugs that the changed AI play now reaches; `origin/main` and QA-1 alone pass only
because of which matches they happen to run. They are filed as QA-1d (mine spawn next to a post) and
QA-1f (pad exit stacks bots, so the lower one sinks into terrain). Ways to unblock: land QA-1a and
QA-1 together (the merged tree is green on every CI gate), or fix QA-1d and QA-1f first.

**Cause (option 1, AI fixes, no ability numbers changed).** Skyla's Updraft rain blasts hit their
owner. The planner did not model that, so in the 28 Skyla duels of the balance-gate schedule
Skyla dealt herself 1332 damage with her own rain and killed herself with it 10 times. It also
dealt only 136 Updraft damage to enemies over 44 uses. Updraft also flew her out through the top
kill line (y < -12), and onto ledge lips she then slid off. While fixing that, Phantom became the
lowest bot (8% at 8 seeds when merged with QA-1). The cause was that `plan()` rebuilt every aim
from angle and power and dropped `aim.tx, aim.ty`, so AI Blink Strikes used the sim's aim-line
fallback and teleported in a straight line, often out over the void.

What changed:
- `src/ai/planner.js`, Updraft samples only (Skyla). Each sample is dropped when its apex is within
  `AI_AIM.updraftCeilingMargin` of `PHYS.ceilingY`, when the apex is less than
  `AI_AIM.updraftMinDrop` above the ground below (checked across the rain blast's reach), or when
  the landing has no ground within `AI_AIM.ledgeMargin` on both sides. The best remaining sample is
  kept only if it still lands safely at the four corners of the aim jitter.
- `src/ai/planner.js`, Blink Strike (Phantom). The chosen aim keeps the scored `tx, ty`, and spots
  need the same ledge footing. Bastion Wall still drops its point: keeping it would change Bulwark
  too, and it exposed a wedge bug (QA-1e).
- `src/core/defs.js`: new `PHYS.ceilingY: -12` (the value already hard-coded in `sim.js`, now read
  from defs, so behaviour is the same) and `AI_AIM` (`angleNoiseMul` 2.2 and `powerNoiseMul` 1.5
  moved out of planner literals, plus the three new margins). No bot or ability number changed.
- `test/features.mjs` (lines added only): a scripted wallHit case. Only Blink shards (8 damage)
  can hit a 10 HP wall segment without breaking it. Once AI Blinks went to their intended spots,
  the 90-match batch stopped producing a wallHit, so the event is now covered by real actions.
- Docs: `docs/spec/07-ai.md` (new section "Move safety and point targets") and the
  `docs/spec/12` balance snapshot. Running `python3 tools/gen_spec.py` produced no hunks from this
  change (only stale prose that M0-08a owns), so no generated file is included. QA-1c records that
  the generator's "AI aims use the legacy rule" line for Blink is now wrong.

Iterations (`node test/balance.mjs 8`, 448 duels, win %):

| Iteration | Bulwark | Magmaw | Volt | Warden | Skyla | Phantom | Ricochet | Gravitas |
|---|---|---|---|---|---|---|---|---|
| main 15d79da | 62 | 45 | 59 | 63 | 13 | 20 | 51 | 40 |
| 1: Updraft ceiling, jitter corners, ledge footing | 63 | 44 | 59 | 63 | 13 | 19 | 51 | 40 |
| 2: + Updraft rain clearance | 62 | 38 | 59 | 60 | 35 | 15 | 46 | 39 |
| 2 merged with QA-1 | 61 | 36 | 63 | 60 | 37 | 8 | 46 | 41 |
| 3: + AI keeps point for Blink and Wall, Blink footing | 51 | 32 | 58 | 56 | 30 | 29 | 40 | 40 |
| 3 merged with QA-1 | 53 | 34 | 55 | 56 | 29 | 35 | 41 | 39 |
| 4 (final): point kept for Blink only | 50 | 32 | 58 | 54 | 31 | 29 | 40 | 38 |

`node test/balance.mjs 3` (168 duels, win % / avg damage dealt):

| Bot | main 15d79da | QA-1a 00269da |
|---|---|---|
| Bulwark | 62 / 107 | 52 / 110 |
| Magmaw | 45 / 64 | 36 / 65 |
| Volt | 57 / 109 | 57 / 107 |
| Warden | 69 / 104 | 52 / 106 |
| Skyla | 12 / 49 | 29 / 59 |
| Phantom | 21 / 46 | 33 / 79 |
| Ricochet | 55 / 100 | 40 / 100 |
| Gravitas | 29 / 72 | 33 / 75 |

`node scripts/ci/balance-gate.mjs 2` (win %): QA-1a alone gives Bulwark 54, Magmaw 32, Volt 61,
Warden 54, Skyla 29, Phantom 36, Ricochet 39, Gravitas 39 (pass). QA-1a merged with QA-1 (scratch
merge 1070e49, not pushed) gives Bulwark 57, Magmaw 32, Volt 57, Warden 61, Skyla 29, Phantom 32,
Ricochet 43, Gravitas 36 (pass).

Other evidence:
- `node test/ai-selfkill.mjs`: 43 to 29 undamaged self-eliminations in 280 games. Skyla went from
  11 to 4 and Phantom from 14 to 8. The rest are plain jumps; QA-1b covers the preview and sim
  drift behind several of them.
- Skyla's damage to herself from her own rain, over the 28 duels of the balance-gate schedule:
  1332 damage and 10 self-kills on main, 180 damage and 0 self-kills on QA-1a.

Gates:
- QA-1a alone (00269da): determinism 6, rules, headless 20, features, mapid, balance-gate 2,
  online, online-browser and browser all passed. **bughunt 2 failed** (QA-1d, QA-1f).
  net-parity 2 is not a gate on main and fails there too (10/20 desynced), which is the QA-1 bug.
- QA-1a merged with QA-1 (1070e49): determinism 6, rules, headless 20, features, bughunt 2,
  net-parity 2, ai-purity 1, mapid, balance-gate 2, online, online-browser and browser all passed.

