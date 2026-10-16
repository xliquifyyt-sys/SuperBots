---
id: QA-13
milestone: M1
role: client-ui
status: todo
depends: []
severity: P3
---
# QA-13: Local player shows as "You (you)" in the HUD roster and the results table

Found by the 2026-10-16 nightly QA run (all five playthroughs). The default local player name is "You",
and both `src/ui/game.js` (roster, ~line 360) and `src/main.js` (results table, ~line 283) append
" (you)" to the local player's name, so the roster and results read "You (you)".

Screenshots: `docs/alpha/qa/2026-10-16/m2-frozenkeel-1280x720-plan-T1.jpg` (roster, top right),
`docs/alpha/qa/2026-10-16/m4-templecrossing-1280x720-result.jpg` (first row).

Expected: "You" once (skip the suffix when the name already is "You", or mark the local row with
the existing `.me` highlight instead of text).
Actual: "You (you)".

## Acceptance

- [ ] A browser check starts a local match with the default name and asserts no roster row or results
      cell contains "You (you)"; a custom name still gets the marker.
- [ ] Browser smoke gate green.

## Log
