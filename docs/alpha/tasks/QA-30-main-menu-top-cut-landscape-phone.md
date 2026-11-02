---
id: QA-30
milestone: M1
role: client-ui
status: todo
depends: []
severity: P2
---
# QA-30: Main menu loses its logo and top button on landscape phones (unreachable by scrolling)

Found by the 2026-11-02 nightly QA run (exploratory probe of the menus at landscape phone sizes; the spec says
"Landscape first, portrait supported", `docs/spec/08-controls-ui-and-flow.md`). At 844x390 (iPhone 12–14 landscape)
the main menu opens with the SUPERBOTS logo and subtitle completely above the screen and the QUICK 1v1 button cut
off at the top edge. Scrolling does not bring them back: the menu scrolls only downwards (to the account chip and
match record), and `scrollTop = 0` still leaves the logo at y = -143.

- `docs/alpha/qa/2026-11-02/qa30-menu-main-844x390.jpg` (QUICK 1v1 cut, no logo)
- `docs/alpha/qa/2026-11-02/qa30-menu-main-740x360.jpg` (small Android landscape: QUICK 1v1 23px cut)

Cause: `style.css` `.screen` is `display: flex; flex-direction: column; justify-content: center; overflow-y: auto`.
When a centred flex column is taller than its scroll container, the overflow is split evenly above and below and
the part above the start edge is not scrollable. `#menu-main` (557px of content in a 390px screen) is the only menu
screen without `.wide` (which switches to `flex-start`) that grows past the viewport; `#menu-pause` is short enough.

Expected: every menu screen's content is visible or reachable by scrolling at every supported size — e.g.
`justify-content: safe center` on `.screen` (or `margin: auto` on the first/last child), and/or a tighter
landscape layout for the main menu (smaller logo, buttons in two columns) under a `max-height` media query.
Actual: at 844x390, 740x360 and 932x430 the logo is unreachable; at 844x390 and 740x360 the first button is cut.

Repro: `python3 -m http.server 8123 & CHROMIUM_PATH=... node test/screen-overflow.mjs` → 3 FAIL on main
(`menu-main` at 844x390, 740x360, 932x430); the other 32 screen/viewport cases pass. No seed (static layout).

## Acceptance

- [ ] `node test/screen-overflow.mjs` exits 0 (all 7 menu screens x 5 viewports).
- [ ] Screenshot in the Log of the main menu at 844x390 with the logo and QUICK 1v1 fully visible (or reachable).
- [ ] No regression at 390x844 and 1280x720: `node test/browser.mjs` and `node test/online-settings-layout.mjs` green.

## Log
- 2026-11-02 nightly QA: filed; added `test/screen-overflow.mjs` (new file, not in CI).
