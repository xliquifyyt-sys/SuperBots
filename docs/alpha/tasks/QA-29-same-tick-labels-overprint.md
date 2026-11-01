---
id: QA-29
milestone: M1
role: client-ui
status: todo
depends: []
severity: P2
---
# QA-29: Two labels spawned on one tick print on top of each other ("TOXIN!" over "POISON")

Found by the 2026-11-01 nightly QA run (`node test/qa-playthrough.mjs docs/alpha/qa/2026-11-01`, set 1, match 2:
Bulwark v Phantom + Skyla on Frozen Keel, 1280x720; the match seed is `Date.now()`, so use the test below to
reproduce). On T2 a Toxin contact landed and the lime "TOXIN!" and "POISON" labels were drawn at the same spot, so
the text reads as an unreadable smear ("PTOXIN!!"):

- `docs/alpha/qa/2026-11-01/m2-frozenkeel-1280x720-resolve-T2.jpg` (centre-right, between Nova and Juno)

Cause: `src/core/sim.js` emits two events for one game fact on the same tick, and `src/render/renderer.js`
`handleEvent` gives both a floating label at almost the same anchor:

- `transferContact` → `addEffect` emits `effect` (label `POISON` / `FROZEN` / `SHOCKED` at `bot.y - 1.1`), then
  emits `contact` (label `TOXIN!` / `FROST!` / `SHOCKWIRE!` at `bot.y - 1`). 0.1 units apart: 76% overlap.
- `applyPowerup` emits `pickup` (`Amp` at `y - 1`) then `addEffect` (`AMP` at `y - 1.1`): 76% overlap.
- `explode` with `opts.effect` emits `damage` (`-15` at `y - 0.8`) then `effect` (`BURN` / `SHOCKED` at
  `y - 1.1`): 27–29% overlap.

Both labels rise at the same 0.9 units/s, so they stay stacked for their whole life.

Expected: labels that appear together on one bot are both readable — stack them (offset each new label above the
previous live one for that bot) or merge redundant pairs into one label (e.g. "TOXIN! POISONED").
Actual: 12/12 same-tick pairs overlap by more than 25% of the smaller label.

Repro: `python3 -m http.server 8123 & CHROMIUM_PATH=... node test/label-stack.mjs` → 12 FAIL on main.

Related, not duplicates: QA-21 (a label covers the bot's *nameplate*) and QA-16 (damage number on the HP chip).
A fix that moves labels above the nameplate (QA-21) still needs to separate the labels from each other.

## Acceptance

- [ ] `node test/label-stack.mjs` exits 0 (presentation only; no `World` writes, no change to the event stream).
- [ ] `node test/label-tag-overlap.mjs` no worse than before.
- [ ] Screenshot in the Log of a Toxin (or Frost) contact with both labels readable.
- [ ] Browser smoke gate and determinism 6 green.

## Log
- 2026-11-01 nightly QA: filed; added `test/label-stack.mjs` (new file, drives the real `handleEvent`).
