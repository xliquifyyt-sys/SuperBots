---
id: QA-5
milestone: M1
role: client-ui
status: todo
depends: []
severity: P2
---
# QA-5: "TURN n / 20" wraps onto two lines at 390 wide

Found by the 2026-10-14 nightly QA run. With a turn cap set, `#turn-label` in the top bar wraps
to "TURN 1 /" over "20" during the plan phase at 390x844. The plan timer box takes the width.
It fits in playback, so the bar jumps in height between phases. `test/qa-playthrough.mjs` flags
it every turn: `turn-label wraps (TURN 5 / 20)`.
Screenshots: `docs/alpha/qa/2026-10-14/m1-emberpit-390x844-plan-T1.jpg`,
`docs/alpha/qa/2026-10-14/m3-canopyruins-390x844-plan-T5.jpg`.

Expected: one line, e.g. "T5/20" or a smaller letter-spacing at narrow widths.
Actual: two lines.

Related to M1-03 (phone-width HUD), but that task doesn't call out this case.

## Acceptance

- [ ] At 360x780, 390x844 and 844x390, with turn cap 40 and turn 40, `#turn-label` is one line
      (height < 1.8× its font size) and the top bar doesn't overlap the timer or buttons.
- [ ] `test/qa-playthrough.mjs` reports no `turn-label wraps`. The browser smoke gate is green.

## Log
