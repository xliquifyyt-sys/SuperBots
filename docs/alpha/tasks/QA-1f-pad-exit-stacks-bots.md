---
id: QA-1f
milestone: M0
role: gameplay
status: todo
depends: []
severity: P2
---
# QA-1f: Two bots sent through Nimbus's Rescue vent stack on its exit, and the lower one sinks into the pillar

Found by `node test/bughunt.mjs 2` on `agent/QA-1a-skyla-balance-floor` at 00269da:
`bot embedded in terrain — nimbus T4 skyla @25.0,7.8 depth 0.27` (bughunt run 0, FFA, easy).
`origin/main` passes only because of which matches it happens to run.

## What happens

Skyla (id 4) falls past the left shelf and touches the `Rescue vent` pad (`x 5, y 20, to [25, 7.5]`).
The pad sets her position to exactly (25, 7.5). Warden is already at the same exit (25.00, 6.75).
Pads do not check whether a bot is already at the exit. Bot-bot separation runs after terrain
resolution in `World.step`, and with mass 1.6 against 1.0 it pushes Skyla down each frame. She ends
the turn at y 7.77, grounded, with her hull 0.37 inside the centre pillar `R(22, 8, 6, 1.4)`
(her resting y is 7.40).

To replay it frame by frame, rebuild bughunt run 0 on Nimbus (8 bots, `BOT_IDS[(k + 0) % 8]`, seed
`9000 + MAP_IDS.indexOf('nimbus')`) and step turn 4 for bot 4.

## Acceptance

- [ ] A pad exit that is occupied puts the arriving bot at the nearest spot that is free of terrain
      and other bots (like `freeSpotFor`, but checking bots too). Or bot-bot separation never leaves
      a bot inside terrain. Add a rules test that sends two bots through one pad in a single turn.
- [ ] `node test/bughunt.mjs 2` reports no `bot embedded in terrain` on main and on
      `agent/QA-1a-skyla-balance-floor`.
- [ ] `node test/determinism.mjs 6` and all other CLAUDE.md gates are green. If this changes how
      bot-bot separation works, put the before/after `node test/balance.mjs 3` table in the PR body.

## Log
