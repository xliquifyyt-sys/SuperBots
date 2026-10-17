---
id: QA-17
milestone: M1
role: client-ui
status: todo
depends: []
severity: P3
---
# QA-17: In-world KO callout reads "You KO" when the local player is knocked out

Found by the 2026-10-17 nightly QA run (`QA_SET=2 node test/qa-playthrough.mjs <dir> 3`, Bulwark in a
4p teams game on Nimbus Reach at 390x844, turn 6 playback). The local player's bot is KO'd and the
floating callout says "You KO" (`src/render/renderer.js` ~272: `bots[e.bot].name + ' KO'`). Players
read it as "you scored a KO", the opposite of what happened.

Screenshot: `docs/alpha/qa/2026-10-17/m4-nimbus-390x844-resolve-T6.jpg` (centre).

Expected: unambiguous victim wording, e.g. "KO: You" / "YOU'RE OUT" for the local player and "KO: Nova"
for others (and the killer when known — see M1-04).
Actual: "You KO".

## Acceptance

- [ ] The KO callout for the local player cannot be read as the player scoring a KO.
- [ ] Screenshot in the Log. Browser smoke gate and determinism 6 green.

## Log
