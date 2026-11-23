---
id: QA-48
milestone: M1
role: client-ui
status: todo
depends: []
severity: P2
---
# QA-48: A short, steep aim draws its dots and move icon over the shooter's own HP number

Found by the 2026-11-24 nightly QA run (`QA_SET=2 node test/qa-playthrough.mjs <dir>`, match 3: Gravitas v Skyla
on Cloud Steps at 1280x720; the match seed is `Date.now()`, so the exact frame does not replay, but the aim does).

Screenshot: `docs/alpha/qa/2026-11-24/m3-cloudsteps-1280x720-plan-T5.jpg` — plan phase T5, aim readout
"missile · angle 127° · power 32%". The first aim-guide dot and its orange glow sit on the left end of the "You"
nameplate, on top of the HP chip, so the player's own HP ("80" in the roster) reads as a smudged "30". The
missile icon that rides the end of the arc floats beside the name, just above the capsule.

## Repro
1. `python3 -m http.server 8123`, open `index.html` at 1280x720 (also seen at 390x844 on Glacier Fortress).
2. Start any Quick match, pick the missile, and drag an aim up and back (angle ~110–140°) at low power (~25–40%).
3. Look at your own nameplate while aiming.

- **Expected:** your own HP chip and name stay readable while you aim — the nameplate is the one number you need
  most in the plan phase.
- **Actual:** the aim guide (`drawAimGuide`) is drawn after `drawBots` in `src/render/renderer.js` (see the draw
  order in `render()`: `drawBots(info)` … `if (info.aim) this.drawAimGuide(info.aim)`), and an upward arc leaves
  the bot through its nameplate (nameplate sits at `y - r*1.75 - z*0.5`), so the first dots and their 2.1x glow
  paint over the HP chip.

## Suggested fix (owner decides)
Either skip guide dots that fall inside the shooter's nameplate rect, or draw the shooter's nameplate again after
the aim guide (the dots then pass behind it). Keep the guide visible past the nameplate.

## Acceptance
- A new browser test (`test/aim-guide-nameplate.mjs`) starts a Quick match at 1280x720 and 390x844, sets a steep
  low-power aim, reads the canvas pixels of the player's HP chip with and without the aim, and asserts the chip is
  unchanged (or that no guide point lands inside the nameplate rect).
- Gates stay green.

## Log
- 2026-11-24: filed by nightly QA.
