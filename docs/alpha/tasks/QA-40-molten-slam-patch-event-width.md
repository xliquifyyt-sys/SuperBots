---
id: QA-40
milestone: M1
role: gameplay
status: todo
depends: []
severity: P3
---
# QA-40: Molten Slam's `patch` event reports width 3 for a 4-wide burning patch; painted shimmer lasts 6 s, not 3 turns

Found by the 2026-11-12 nightly QA run while reading the hazard code against spec 06.

`src/core/sim.js` (~line 884) Molten Slam pushes `{ w: 4, turns: 3, dmg: 15 }` into `world.patches` but emits
`this.emit('patch', { x, y, w: 3 })`. The renderer's painted path (`src/render/renderer.js` ~line 210) sizes the
`molten_patch` clip from the event — `size: e.w / 3` — and keeps it for `until: this.time + 6` seconds. So once the
`molten_patch` sheet is delivered (art/vfx/manifest.json is still `{}`, so today only the procedural flames in
`drawPatchesFields()` show and they use the correct `p.w`), the painted shimmer will be 3 units wide over a 4-unit
damage zone, and will vanish after 6 s of render time while the patch keeps burning for 3 turns (map lavaPatch
hazards emit their real `w` and last 2 turns, so they have the same lifetime problem).

Not visible today; filed so the art intake doesn't inherit it. Presentation only for the lifetime part; the event
field is sim output but nothing in the sim reads it, so changing it doesn't affect determinism.

## Expected / actual

- Expected: the `patch` event carries the patch's real width (4 for Molten Slam), and the painted patch is drawn
  from `world.patches` (or removed when the patch expires) rather than a fixed 6 s timer.
- Actual: event `w: 3` vs patch `w: 4`; painted fx expires after 6 s.

## Acceptance

- [ ] Molten Slam's `patch` event `w` equals the pushed patch's `w` (grep / a one-line check in `test/features.mjs`).
- [ ] With a test `molten_patch` sheet loaded, the painted patch spans the damage zone and stays until the patch
      leaves `world.patches` (screenshot at 1280x720 on Ember Pit).

## Log
- 2026-11-12 (qa): filed from code reading; no repro needed beyond the two lines quoted.
