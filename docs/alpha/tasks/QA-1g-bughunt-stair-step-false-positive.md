---
id: QA-1g
milestone: M0
role: qa
status: todo
depends: []
severity: P3
---
# QA-1g: bughunt's embedded-bot check counts the non-physical stair steps

`test/bughunt.mjs` checks every rect in `world.map.terrain` with a 0.5 circle. `map.terrain` also
holds the generated stair steps (`step: true`, maps.js line 269). These steps exist for the AI and
spawn helpers. Physics uses `physTerrain`, which leaves them out. A bot that is correctly standing at
the foot of a ramp can come within 0.25 of a step corner, and bughunt then reports it as embedded.

Seen on QA-1a iteration 3 (Blink Strike and Bastion Wall points kept): `EMBED ... ricochet 36.161
16.381 ... rc {"x":35.5,"y":16.5,"w":0.52,"h":0.5,"step":true}`. Ricochet's hull bottom (0.619)
puts her feet at 17.0, on the surface. The circle check hits the step's corner at distance 0.18.

`test/bughunt.mjs` is a protected gate file. Skipping `rc.step` changes what the gate checks, so a
human has to decide (`human-approved`). An agent can instead add a stricter check alongside the old
one: hull against `physTerrain`, using the sim's own `botPoly`.

## Acceptance

- [ ] A human decides: either bughunt checks bots against `physTerrain` with the placed hull, or
      stair steps stay in and the reason is written next to the check.
- [ ] `node test/bughunt.mjs 2` is green on main.

## Log
