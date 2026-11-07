---
id: QA-32
milestone: M1
role: client-ui
status: todo
depends: []
severity: P2
---
# QA-32: JUMP and FIRE cut at the screen edges on 360px-wide phones

Found by the 2026-11-07 nightly QA run (new `QA_SET=5` playthrough,
`QA_SET=5 node test/qa-playthrough.mjs docs/alpha/qa/2026-11-07/set5`, match 1: Phantom v Bulwark on Frozen Keel at
360x640). 360 CSS px is the width of most mid-range Android phones (Galaxy A/S series, Pixel 4a class), so this hits
a large share of the Android audience.

Under `@media (max-width: 640px)` the plan bar is 4 action buttons x 64px + 3 x 6px gaps + 10px gap + 84px FIRE
= 368px. `#plan-bar` centres it with `justify-content: center`, so on a 360px screen it overflows by 4px on each
side: the left frame of JUMP and the right frame of FIRE are drawn off-screen. At 320px (iPhone SE 1st gen / small
Androids) it is 24px per side, and a quarter of the JUMP button is gone.

- `docs/alpha/qa/2026-11-07/set5/m1-frozenkeel-360x640-plan-T1.png` (JUMP's left border and FIRE's right border cut)

Measured by the new `test/plan-bar-fit.mjs` on main cac185c:

| Viewport | Off-screen |
|---|---|
| 320x568 | act-jump [-24..40], btn-fire [260..344] |
| 360x640 | act-jump [-4..60], btn-fire [280..364] |
| 360x800 | act-jump [-4..60], btn-fire [280..364] |
| 375x667 / 390x844 / 412x915 | none |

Expected: every action button and FIRE is fully on screen at ≥320px wide, with ≥8px margin, and tap targets stay
≥48px (e.g. a `max-width: 380px` step that shrinks `.act` to 56px and FIRE to 76px, or flex-shrink the buttons).
Actual: JUMP and FIRE are clipped at 360px and below.

Repro: `python3 -m http.server 8123 & CHROMIUM_PATH=... node test/plan-bar-fit.mjs` → 3 FAIL on main.
No seed (layout; Quick match, any map).

## Acceptance

- [ ] `node test/plan-bar-fit.mjs` exits 0 (6 portrait viewports, 320..412 wide).
- [ ] Every `.act` and `#btn-fire` is at least 48x48px at 320x568.
- [ ] Screenshot of the plan phase at 360x640 in the Log.
- [ ] No regression: `node test/browser.mjs`, `node test/aim-readout-overlap.mjs` (no new failures) green.

## Log
- 2026-11-07 nightly QA: filed; added `test/plan-bar-fit.mjs` (new file, not in CI) and `QA_SET=5` (360x640,
  768x1024, 1024x768) to `test/qa-playthrough.mjs` (additions only).
