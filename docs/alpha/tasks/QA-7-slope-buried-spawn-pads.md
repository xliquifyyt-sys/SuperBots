---
id: QA-7
milestone: M2
role: gameplay
status: todo
depends: [QA-2]
severity: P3
---
# QA-7: four spawn pads are drawn inside slope wedges and get pushed sideways on settle

Found while working QA-2. `test/spawns.mjs` prints these as `info` lines (not failures):

| map | pad | where the bot actually starts after `World.settle()` |
|---|---|---|
| emberpit | (9, 12.5) | (7.69, 10.46): pushed up and left out of the left flank slope |
| emberpit | (21, 12.5) | (22.46, 10.24): out of the right flank slope |
| glacierfort | (13, 16.5) | (12.17, 15.61): out of the left keep ramp |
| glacierfort | (35, 16.5) | (36.03, 15.40): out of the right keep ramp |

The pad position is also `bot.spawn`, which Sudden Death respawns use, and the
renderer/AI may read it. The start is still safe (no drop, all picked pads stay 4+ apart),
but what the map data says and where the bot stands disagree by 1.2 to 2.5 units.

## Acceptance

- [ ] Every pad in `src/core/maps.js` is within 1 unit of where its bot settles (add the
      assertion to `test/spawns.mjs`, turning the `info` line into a check).
- [ ] `node test/spawns.mjs` still green (4+ apart, mirrored n=2).
- [ ] Before/after `node test/balance.mjs 3` table in the PR body.
- [ ] All CLAUDE.md gates green.

## Log
