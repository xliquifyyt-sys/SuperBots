---
id: QA-6
milestone: M1
role: client-ui
status: todo
depends: []
severity: P2
---
# QA-6: Phone portrait: opponents are off-screen while you aim, and the roster can't be opened

Found by the 2026-10-14 nightly QA run (390x844 playthroughs on Ember Pit and Canopy Ruins).
In portrait, `renderer.fitForPlan()` frames about 22 units around your own bot, so on a
30-unit standard map the opponent is often off-screen while you plan. Nothing at the screen
edge points to them. `#roster` is `display:none` under 640px, and only `#roster.force` shows it,
but nothing in `src/` ever adds the `force` class. So on a phone you can't see where the enemy
is or how much HP they have without panning by hand.
Screenshots: `docs/alpha/qa/2026-10-14/m1-emberpit-390x844-plan-T1.jpg` (no enemy visible),
`docs/alpha/qa/2026-10-14/m3-canopyruins-390x844-plan-T5.jpg`.

Expected: off-screen opponents get an edge marker (direction, distance, HP) or the plan camera
fits you and your nearest enemy. The roster can be opened on phones.
Actual: neither.

## Acceptance

- [ ] At 390x844, during the plan phase, every alive opponent is either on-screen or shown by an
      edge marker. Assert it in a browser test using `renderer.toScreen`.
- [ ] A tap target (≥48px) toggles `#roster.force` on phones.
- [ ] Screenshots at 390x844 in the Log. The browser smoke gate is green.

## Log
