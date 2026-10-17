---
id: QA-15
milestone: M1
role: client-ui
status: todo
depends: []
severity: P2
---
# QA-15: Phone portrait: playback camera shows ~70% empty sky and bots ~18px tall

Found by the 2026-10-17 nightly QA run (`QA_SET=2 node test/qa-playthrough.mjs <dir> 1`, Phantom v
Warden + Volt on Glacier Fortress at 390x844, seed is the script's fixed LCG seed 12345).
During playback (and the T1 plan view) the whole fight sits in the bottom ~200px of an 844px screen;
the top ~600px is backdrop sky. Bots are about 18px tall and name tags/HP chips about 8px.

Cause (read from code, not traced): in portrait `frameAction()` caps zoom at `this.w / 18`
(390/18 ≈ 21.7 px per unit) and `fitForPlan()` at `this.w / 22`; with ~39 units of visible height
and `centreY()` pinning the kill floor near the bottom, everything above the action is empty.

Screenshots: `docs/alpha/qa/2026-10-17/m2-glacierfort-390x844-resolve-T2.jpg`,
`m2-glacierfort-390x844-plan-T5.jpg`, `m2-glacierfort-390x844-plan-T1.jpg`.

Expected: in portrait the camera uses the spare height (zoom so the action band fills ≥ 50% of the
viewport height, or centre vertically on the action), with off-screen bots handled by QA-6's edge markers.
Actual: the action band fills ~20–25% of the viewport height.

Related: QA-6 (plan-phase framing and missing edge markers in portrait).

## Acceptance

- [ ] At 390x844 on Glacier Fortress and Nimbus Reach, during playback the vertical span of alive bots
      plus 4 units covers ≥ 50% of the canvas height (assert via `renderer.toScreen` in a browser test).
- [ ] Bots render ≥ 28px tall in portrait playback.
- [ ] Before/after screenshots at 390x844 in the Log. Browser smoke gate and determinism 6 green.

## Log
