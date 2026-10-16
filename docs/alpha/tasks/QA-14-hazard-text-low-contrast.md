---
id: QA-14
milestone: M1
role: client-ui
status: todo
depends: []
severity: P3
---
# QA-14: In-world "AIR STRIKE" callout fades to pale pink on a white sky on Frozen Keel

Found by the 2026-10-16 nightly QA run (`node test/qa-playthrough.mjs <dir> 1`, Frozen Keel at
1280x720, turn 6 playback). The floating "AIR STRIKE" text (`src/render/renderer.js` ~286, a floating
number in `#ff4d4d`) has no outline or backing; as it fades over Frozen Keel's bright ice sky it turns
a faint pink that is hard to read. Same family as
QA-9 (SKIP/FIRE unreadable on bright maps), but this is canvas text in the renderer, not a DOM button.

Screenshot: `docs/alpha/qa/2026-10-16/m2-frozenkeel-1280x720-resolve-T6.jpg` (centre top).

Expected: in-world callouts keep ≥4.5:1 contrast on every theme (dark outline/shadow or a pill backing).
Actual: low-contrast text on ice and sky maps.

## Acceptance

- [ ] In-world announcement/callout text gets an outline or backing (presentation only; no `World` writes).
- [ ] Screenshot on Frozen Keel and Cloud Steps during an air strike in the Log.
- [ ] Browser smoke gate and determinism 6 green.

## Log
