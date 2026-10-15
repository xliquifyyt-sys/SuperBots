---
id: QA-9
milestone: M1
role: client-ui
status: todo
depends: []
severity: P2
---
# QA-9: SKIP and disabled FIRE are near-invisible on bright sky maps

Found by the 2026-10-15 nightly QA run on Cloud Steps (1280x720) and Nimbus Reach (390x844). The
playback SKIP button (white text on pale cyan) and the FIRE button in its not-yet-aimed state (pale
cyan fill) sit over a near-white sky and have almost no contrast; the label can't be read.

Screenshots: `docs/alpha/qa/2026-10-15/m3-cloudsteps-1280x720-plan-T1.jpg` (FIRE, bottom centre),
`docs/alpha/qa/2026-10-15/m3-cloudsteps-1280x720-resolve-T2.jpg` (SKIP, bottom right), `docs/alpha/qa/2026-10-15/m4-nimbus-390x844-resolve-T6.jpg`.
Repro: `QA_SET=2 node test/qa-playthrough.mjs <dir> 3` (and `... 4`).

Expected: every HUD button has an opaque or dark-scrim backing so its label is >= 4.5:1 against what
it sits on, on all ten maps. Disabled state reads as disabled, not invisible.
Actual: the labels are close to background colour on the Cloud Steps sky (eyeballed from the screenshots, not measured).

## Acceptance

- [ ] Computed text vs. button background contrast >= 4.5:1 for `#btn-skip`, `#btn-fire` (enabled and disabled)
      and the speed toggle, checked in a Playwright test; the button background must be at least 85%
      opaque or carry a dark scrim so the map behind it cannot wash it out.
- [ ] Screenshots on Cloud Steps and Nimbus at 1280x720 and 390x844 in the Log.
- [ ] Browser smoke gate green.

## Log
