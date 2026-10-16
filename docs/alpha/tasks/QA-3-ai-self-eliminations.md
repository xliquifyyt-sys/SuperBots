---
id: QA-3
milestone: M2
role: gameplay
status: todo
depends: []
severity: P1
---
# QA-3: Hard AI jumps or blinks itself into the kill floor in about 15% of 1v1s

Found by the 2026-10-14 nightly QA run. In a UI playthrough, Magmaw (AI) fell into the Ember Pit
lava gap on turn 2 without taking any damage. The new report tool measures how often this happens:

`node test/ai-selfkill.mjs` → **280 hard 1v1 games: 43 undamaged self-eliminations (15.4%)**.
Per bot: phantom 14, skyla 11, warden 6, magmaw 5, volt 3, ricochet 3, bulwark 1, gravitas 0.
Worst: phantom@frozenkeel 6, skyla@frozenkeel 5, magmaw@emberpit 4.

This lines up with Skyla (13%) and Phantom (23%) at the bottom of `balance.mjs 4`. It is part of
M2-04 ("AI uses every bot well"), but it is a concrete, measurable defect of its own.

## Repro (each turn shown takes no damage, then the bot dies with cause `fell`)

- `node test/trace.mjs bulwark skyla emberpit 5004`: on T3 Skyla jumps at 174° with power 0.79
  from (19.7, 8.7), with "Lava rises" announced → `ELIM skyla fell`.
- `node test/trace.mjs magmaw bulwark emberpit 5008`: on T5 Magmaw uses Molten Slam from (9.9, 8.8)
  after the lava has risen → `ELIM magmaw fell`.
- `node test/trace.mjs bulwark warden frozenkeel 5103`: on T2 Warden fires a missile and ends
  up in the water.

Expected: the planner rejects any move whose predicted landing is below `lavaY` or off the map,
and counts the next turn's announced lava rise.
Actual: it picks those moves.

## Acceptance

- [ ] `MAX_RATE=0.03 node test/ai-selfkill.mjs` exits 0.
- [ ] `node test/balance.mjs 4` before/after table in the PR body.
- [ ] All CLAUDE.md gates are green.

## Log

- 2026-10-16 (qa, nightly on 18862f3): `node test/ai-selfkill.mjs 1` → 53/280 (18.9%), up from 43 (15.4%).
  Phantom 18 (was 14), Magmaw 9 (was 5); worst bot@map phantom@frozenkeel 9. Reproduced
  `node test/trace.mjs bulwark phantom frozenkeel 5105`: on T1 the planner scores a point-target Blink
  (`tx`/`ty`), but `AIPlanner.plan` rebuilds the chosen aim as `{dx, dy, power}` and drops `tx`/`ty`, so
  the sim's `blinkSpot` uses the aim-line rule: Phantom blinks 18 units from (27.5, 11.4) to (19.25, 11.17)
  in mid-air and falls into the water (verified with a script reading `pendingActions[1].aim` and the
  `blink` event). Held PR #16 (QA-1) already carries the `tx`/`ty` pass-through and a `footingSafe` check,
  so most of the Phantom share should drop when #16 lands; re-measure then.
