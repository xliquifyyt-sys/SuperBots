---
id: QA-33
milestone: M1
role: client-ui
status: todo
depends: []
severity: P3
---
# QA-33: "ELIMINATED · SPECTATING" banner wraps with the dot alone on its own line

Found by the 2026-11-07 nightly QA run (`QA_SET=5 node test/qa-playthrough.mjs docs/alpha/qa/2026-11-07/set5`,
match 2: Skyla v Gravitas+Magmaw on Magma Works at 768x1024, you died T4).

When your bot dies, `src/ui/game.js` shows `showCenter('ELIMINATED · SPECTATING', 2)`. `#center-msg` uses
`font-size: clamp(34px, 7vw, 72px)` with `letter-spacing: 6px` and no `white-space` rule, so on any viewport where
the line does not fit it breaks at both spaces and renders three lines: "ELIMINATED" / "•" / "SPECTATING". The lone
dot in the middle reads as a glitch and the banner covers a third of the screen.

- `docs/alpha/qa/2026-11-07/set5/m2-magmaworks-768x1024-plan-T5.png`

Expected: two clean lines ("ELIMINATED" / "SPECTATING", no orphan separator) or one line that fits — e.g. use a
`<br>` or `\n` with `white-space: pre-line` instead of " · ", or keep the dot with a non-breaking space.
Actual: three lines with "•" alone in the middle.

Repro: the playthrough above; or any portrait viewport ≤ ~900px wide, start a match and lose your bot. No seed
needed (pure layout).

## Acceptance

- [ ] At 390x844, 768x1024 and 1280x720 the eliminated banner has no line that is only punctuation
      (Playwright: read `#center-msg` line boxes via `Range.getClientRects()`).
- [ ] Screenshots at 390x844 and 768x1024 in the Log.
- [ ] Browser smoke gate green.

## Log
- 2026-11-07 nightly QA: filed.
