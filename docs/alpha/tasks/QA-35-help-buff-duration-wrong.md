---
id: QA-35
milestone: M1
role: client-ui
status: todo
depends: []
severity: P3
---
# QA-35: How to Play says every buff lasts 4 turns; Reflector Coat and Rally Beacon last 2

Found by the 2026-11-09 nightly QA run while reading the menu screens at 390x844 and 1280x720.

## Repro

`node test/help-text.mjs` (new, not a CI gate). On main (07a6942):

```
FAIL buffs: help says every buff lasts 4 turns; defs disagree: Reflector Coat 2, Rally Beacon 2
```

The aim-guide percentages (30/55/85%) and the Sudden Death respawn HP (60) on the same screen match `defs.js`.

## Expected / actual

- Expected: the How to Play power-up line (`index.html` ~line 185, `#menu-help`) matches `POWERUPS` in
  `src/core/defs.js`: Amp, Plating and Thrusters last 4 turns; Reflector Coat (`turns: 2`) and Rally Beacon
  (`turns: 2`) last 2. The sim uses these values (`src/core/sim.js` ~line 1206 `addEffect(b, 'reflector', pu.turns)`).
- Actual: "buffs apply the same turn and last 4 turns" for all buffs.

Seed: n/a (static text). Screenshot: `docs/alpha/qa/2026-11-09/menu-help-390x844.png`.

## Fix

Text-only change in `index.html`, e.g. "buffs apply the same turn and last 2–4 turns (see Botpedia)", or generate
the line from `POWERUPS`. No gameplay number changes.

## Acceptance

- `node test/help-text.mjs` passes.
- `test/browser.mjs` still passes.

## Log

- 2026-11-09 (qa): filed; `test/help-text.mjs` added.
- 2026-11-10 (qa nightly): still fails. Note: the sim keeps Rally Beacon active for 3 turns, not the 2 in defs
  (filed as QA-36), so settle QA-36 first and make the help text match the result.
