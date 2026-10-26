---
id: QA-25
milestone: M1
role: client-ui
status: todo
depends: []
severity: P3
---
# QA-25: Explosion smoke draws as hard-edged grey squares that hang in the air

Found by the 2026-10-26 nightly QA run (extra exploratory set, `QA_SET=3 node test/qa-playthrough.mjs <dir> 4`:
Phantom in a 6p FFA on Magma Works at 1280x720; also visible in set 1 match 2, Bulwark on Frozen Keel). The match
seed is `Date.now()`, so the exact frame is not reproducible, but every unpainted explosion produces it.

After almost every missile/special explosion, 3–6 flat grey squares (≈25–35 px on a 1280x720 screen) float upward
for about a second, well away from the blast. With no fireball or debris left around them they read as rendering
glitches (stuck UI tiles), not smoke.

Evidence:
- `docs/alpha/qa/2026-10-26/set3/m5-magmaworks-1280x720-plan-T5.jpg` — four grey squares at roughly
  (630,170), (570,235), (610,385), (770,490), above the lava and the upper platform.
- `docs/alpha/qa/2026-10-26/m2-frozenkeel-1280x720-resolve-T6.jpg` — two squares left of the centre ice block
  (x≈180–200, y≈490 in the 1280 frame).

Cause (read from code): `Renderer.handleEvent` case `explosion`, when no painted explosion sheet exists
(`src/render/renderer.js`, the line after the debris burst):
`this.emit(e.x, e.y, 10, { speed: 1.8, life: 1.1, size: 0.55, color: 'rgba(70,70,75,0.7)', gravity: -3 })`.
`drawParticles()` draws every non-chunk particle with `fillRect`, so these 0.55-unit smoke puffs (≈2.7x the usual
spark size) become solid squares fading linearly from alpha 0.7. Same root as the toxic cloud in QA-20, but this one
fires on every explosion, so it is on screen in nearly every playback.

Expected: explosion smoke reads as soft smoke — round (arc) or radial-gradient puffs that grow as they fade — or is
dropped from the fallback until the painted `explosion` sheet arrives (art queue). Small sparks can stay square.
Actual: grey squares drift up from every blast.

Not an art-queue item: this is the procedural fallback that ships until the painted sheet exists.

## Acceptance

- [ ] Particles larger than ~0.3 world units (smoke, toxic) are drawn round/soft in `drawParticles()` (or emitted
      with a `soft` flag that is), and no fallback particle is drawn as a square larger than 12 px at zoom 40.
- [ ] A browser test (e.g. extend `test/fx-occlusion.mjs`, additions only) fires an `explosion` event through
      `handleEvent`, renders one frame, and asserts that no particle with `size >= 0.3` is drawn via `fillRect`.
- [ ] All CI gates green.

## Log

- 2026-10-26 nightly QA: filed (qa).
