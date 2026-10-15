---
id: QA-1e
milestone: M2
role: gameplay
status: todo
depends: [QA-1a]
severity: P2
---
# QA-1e: The AI drops Bastion Wall's chosen point, and a wall can leave a gap a bot gets wedged into

Found while working QA-1a.

1. `AIPlanner.evaluateInstant` scores Bastion Wall at a point (`aim.tx = guard.x ± 1.7`). `plan()`
   then rebuilds the aim from angle and power and drops `tx, ty`, so the sim uses its fallback
   (1.35 beside Bulwark). QA-1a keeps the point for Blink Strike only, so Bulwark's balance does
   not change in the same PR.
2. When the point was kept (QA-1a iteration 3, merged with QA-1), `node test/bughunt.mjs 2` found
   `bot embedded in terrain — magmaworks T2 ricochet @40.3,14.8 depth 0.28`. Bulwark's wall stood at
   x 41.02 to 41.42, the furnace tier's right face is at x 40, and the gap between them is 1.02 wide.
   Ricochet's hull is about 1.5 wide. It was pressed into the gap and sank 0.4 into the floor.
   A human can place a wall like this too, because Bastion Wall is a point-target move.

## Acceptance

- [ ] Bastion Wall placement (player or AI) cannot leave a gap narrower than the widest hull between
      the wall and terrain. Either nudge the wall or make the push-out resolve sideways. Add a rules
      test that places a wall 1.0 from a terrain face and drops a bot into the gap.
- [ ] `plan()` keeps the scored point for Bastion Wall. Put the before/after `node test/balance.mjs 3`
      table in the PR body (Bulwark is the bot affected).
- [ ] All CLAUDE.md gates are green.

## Log
