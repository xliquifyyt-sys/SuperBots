---
id: QA-12
milestone: M1
role: client-ui
status: todo
depends: []
severity: P2
---
# QA-12: Lobby map picker uses 10px sub-labels and 45px buttons, and leaves ragged rows on phones

Found by the 2026-10-16 nightly QA run. M0-11 and M0-13 brought the bot cards and the host-settings
grid up to the 12px text / 48px target rules, but the map picker (`#map-list`) was not covered:

- Every map button's sub-label (`<small>`: "Standard · lava · 2-4p", "any eligible") renders at **10px**.
- Every map button is **45px** tall (`.map-list button { min-height: 40px }` + padding).
- At 390x844 the buttons are content-width flex items, so rows end 39–124px short of the column's
  right edge (measured): the grid looks ragged next to the full-width settings grid above it.

Repro: `python3 -m http.server 8123 & CHROMIUM_PATH=... node test/lobby-maplist.mjs` (new, exits 1 on main).
Screenshots: `docs/alpha/qa/2026-10-16/m5-neonalley-390x844-lobby.jpg` (bottom),
`docs/alpha/qa/2026-10-16/m4-templecrossing-1280x720-lobby.jpg` (right column).

Expected: sub-labels ≥12px, buttons ≥48px, rows fill the column on phones (e.g. a 2-column grid under 640px).
Actual: 10px, 45px, ragged.

## Acceptance

- [ ] `node test/lobby-maplist.mjs` exits 0, and it is added to the CI browser job.
- [ ] `node test/browser.mjs` and `node test/online-settings-layout.mjs` still pass.
- [ ] Screenshots of the map picker at 390x844 and 1280x720 in the Log.

## Log
