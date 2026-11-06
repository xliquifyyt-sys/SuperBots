---
id: QA-31
milestone: M1
role: client-ui
status: todo
depends: []
severity: P2
---
# QA-31: Aim readout runs under the JUMP button on landscape phones

Found by the 2026-11-06 nightly QA run (new `QA_SET=4` landscape-phone playthrough,
`QA_SET=4 node test/qa-playthrough.mjs docs/alpha/qa/2026-11-06/landscape`, match 1: Warden v Skyla on Neon Alley
at 844x390). The spec says "Landscape first, portrait supported" (`docs/spec/08-controls-ui-and-flow.md`).

During the plan phase the aim readout (`#aim-readout`, "missile · angle 39° · power 100%") sits at the bottom-left
of the HUD, in the same strip as the centred action bar (`#plan-bar`). `style.css` hides the readout only under
`@media (max-width: 640px)`, so on landscape phones (740..932px wide) both are shown and the first action button
(`#act-jump`) covers the end of the readout: the power value is half hidden and the button's frame is drawn
over the text.

- `docs/alpha/qa/2026-11-06/landscape/m1-neonalley-844x390-plan-T5.png` (readout "power 100%" runs under JUMP)

Measured by the new `test/aim-readout-overlap.mjs` on main ad3060b:

| Viewport | Readout box | Overlap |
|---|---|---|
| 390x844 | hidden | — |
| 740x360 | [10,323,221,346] | act-jump 82x23 px |
| 844x390 | [10,353,221,376] | act-jump 32x23 px |
| 932x430 / 1024x600 / 1280x720 | clear | — |

Expected: the readout never shares space with an action button or FIRE — e.g. move it above the action bar
(bottom offset ≥ bar height) when the viewport is short, or hide it with a `max-height`/`(pointer: coarse)`
query as on portrait phones (touch players already see the aim arrow).
Actual: at 740x360 and 844x390 the JUMP button overlaps the readout text.

Repro: `python3 -m http.server 8123 & CHROMIUM_PATH=... node test/aim-readout-overlap.mjs` → 2 FAIL on main.
No seed (layout; Quick match, any map).

## Acceptance

- [ ] `node test/aim-readout-overlap.mjs` exits 0 (6 viewports).
- [ ] Screenshot in the Log of the plan phase at 844x390 with the readout and the action bar both fully legible
      (or the readout deliberately hidden).
- [ ] No regression: `node test/browser.mjs` and `node test/online-settings-layout.mjs` green.

## Log
- 2026-11-06 nightly QA: filed; added `test/aim-readout-overlap.mjs` (new file, not in CI) and `QA_SET=4`
  (landscape phone, 2 matches) to `test/qa-playthrough.mjs` (additions only).
