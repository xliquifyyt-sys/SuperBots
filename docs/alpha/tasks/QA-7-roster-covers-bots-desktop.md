---
id: QA-7
milestone: M1
role: client-ui
status: todo
depends: []
severity: P2
---
# QA-7: HUD roster covers a bot at the top-right of the map (desktop)

Found by the 2026-10-15 nightly QA run (`QA_SET=2 node test/qa-playthrough.mjs <dir> 3`, Gravitas v
Skyla on Cloud Steps at 1280x720, seed of the playthrough's own LCG 12345). Skyla spawns on the
top-right ledge of Cloud Steps; the camera fit puts that ledge directly under `#roster`
(right: 8px, top: 70px). The roster panel draws over Nova's name tag and HP bar on every plan and
playback frame, and the READY! tag pokes out from behind it.

Screenshots: `docs/alpha/qa/2026-10-15/m3-cloudsteps-1280x720-plan-T1.jpg`, `docs/alpha/qa/2026-10-15/m3-cloudsteps-1280x720-resolve-T2.jpg`.

Expected: no bot, name tag or HP bar is hidden behind a HUD panel — either the camera fit reserves the
HUD corners (safe insets) or the roster fades/moves when a bot is under it.
Actual: the opponent's name and HP are unreadable for the whole match.

## Acceptance

- [ ] A Playwright check (new test, or added to `test/qa-playthrough.mjs`) projects each living bot's
      tag rect to screen and asserts it does not intersect `#roster`, `.hud-top` buttons or the action
      bar, at 1280x720, 844x390 and 390x844, on every map's 1v1 and 4p spawns.
- [ ] Screenshot of Cloud Steps 1v1 at 1280x720 in the Log with both tags readable.
- [ ] Browser smoke gate green.

## Log
