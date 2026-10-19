---
id: QA-19
milestone: M1
role: client-ui
status: todo
depends: []
severity: P2
---
# QA-19: Special-move callout name spills out of its pill and off the screen edge ("STATIC FI…")

Found by the 2026-10-19 nightly QA run (`QA_SET=2 node test/qa-playthrough.mjs <dir> 1`, Phantom v Warden + Volt on
Glacier Fortress at 390x844, turn 5 playback; the match seed is `Date.now()`, so use the test below to reproduce).
When AI Volt cast Static Field at the right edge, the callout's dark pill held only the icon; the white name text ran
out of the pill over the bright ice background and was cut by the viewport edge, reading "STATIC FI".

Screenshot: `docs/alpha/qa/2026-10-19/m2-glacierfort-390x844-plan-T5.jpg (taken as the T5 plan screenshot, it caught the T5 playback)` (right edge, y≈660).

Cause: `Renderer.drawCallouts()` (`src/render/renderer.js` ~line 776) draws a fixed `size * 2.2` pill centred on the
bot, then starts the name at `x - size * 0.02` without measuring it. Every special name is wider than the
`size * 1.12` px left for it, so the text always overflows to the right. Nothing clamps the pill to the canvas.

Repro (new, report test): `python3 -m http.server 8123 & CHROMIUM_PATH=... node test/callout-fit.mjs`. It drives the
real `drawCallouts` with a recording context for all 16 specials at zoom 22 and 40, caster at screen centre and 8px from
each edge. **On main: 96/96 callouts overflow their pill** (e.g. `"BASTION WALL" 68px wide overflows its 48px pill by
44px` at centre), and 64 more are partly off-canvas at the edges.

Expected: the pill is sized from `measureText` of the name (plus icon and padding) and the whole callout is clamped
inside the canvas with a small margin.
Actual: name text overflows the pill on every cast; at the edge it is clipped by the viewport.

Related: QA-18 (floating combat text clipped at the edge; same clamp can serve both), QA-9 (white text on bright maps).

## Acceptance

- [ ] `node test/callout-fit.mjs` exits 0 (no overflow, nothing off-canvas). Add it to CI next to the browser gate
      (additions only).
- [ ] Before/after screenshot of a callout at the screen edge in the Log. Browser smoke gate and determinism 6 green.

## Log
