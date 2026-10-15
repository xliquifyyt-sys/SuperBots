---
id: QA-10
milestone: M1
role: client-ui
status: todo
depends: []
severity: P3
---
# QA-10: Name tags and HP bars of adjacent bots draw on top of each other

Found by the 2026-10-15 nightly QA run (`QA_SET=2 node test/qa-playthrough.mjs <dir> 4`, Nimbus Reach
teams at 390x844). When two bots stand within about one body width (here Nova/Magmaw and Kilo/Ricochet
at the end of the match), their name tags and HP bars render in the same spot: "NovaKilo" and two
overlapping bars, so neither HP is readable. Also visible at the edge in
`docs/alpha/qa/2026-10-15/m1-magmaworks-1280x720-plan-T1.jpg` when tags approach each other.

Screenshot: `docs/alpha/qa/2026-10-15/m4-nimbus-390x844-result.jpg` (bottom, behind the results overlay).

Expected: overlapping tags stack vertically (or the lower-priority one shrinks to a pip) so each name
and HP stays readable.
Actual: tags overlap.

## Acceptance

- [ ] Renderer de-overlaps tag rects each frame (pure presentation; no `World` writes).
- [ ] A Playwright or unit check places two bots 0.5 units apart and asserts their tag rects don't intersect.
- [ ] Browser smoke gate and determinism 6 green.

## Log
