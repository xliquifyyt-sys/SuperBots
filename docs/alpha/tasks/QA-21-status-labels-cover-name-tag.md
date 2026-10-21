---
id: QA-21
milestone: M1
role: client-ui
status: todo
depends: []
severity: P3
---
# QA-21: Pickup / contact / effect labels spawn on the bot's name tag and hide its name

Found by the 2026-10-21 nightly QA run (`QA_SET=2 node test/qa-playthrough.mjs <dir>`, set 2; the match seed
is `Date.now()`, so use the test below to reproduce). Twice in one night a bot picked up the Frost power-up and the
light-blue "Frost" label was drawn exactly over the bot's own name, so the name read as "Frost" instead of "You" /
"Mira":

- `docs/alpha/qa/2026-10-21/m1-magmaworks-1280x720-resolve-T2.jpg` (left, Magmaw: "You" hidden under "Frost")
- `docs/alpha/qa/2026-10-21/m5-skylinegrid-1280x720-resolve-T2.jpg` (right, Bulwark "Mira" shows as "Frost")

Cause: `src/render/renderer.js` `handleEvent` pushes the `pickup` label at `e.y - 1`, `contact` at `bot.y - 1` and
`effect` at `bot.y - 1.1`. The nameplate sits at about `y - 1.375` world units (`by = y - r*1.75 - z*0.5`), and
labels rise at 0.9 units/s (`update`), so within 0–0.45 s each label lands on the name text and HP chip and stays
there for most of its life. `drawNumbers` runs last, so the label always wins. Same family as QA-16 (damage number
on the HP chip), which the new test also covers.

Expected: a bot's own status/pickup label never hides its name or HP while readable (spawn above the name tag,
or stack labels above it).
Actual: "Frost", "FROST!", "FROZEN" (and every other effect name) cover 80–100% of the name text.

Repro: `python3 -m http.server 8123 & CHROMIUM_PATH=... node test/label-tag-overlap.mjs` → 10/10 labels FAIL on
main (`pickup`, `contact`, `effect` at 81–100% of the name box; `damage` −25 at 36–76%, `blocked` on the HP chip).

## Acceptance

- [ ] `node test/label-tag-overlap.mjs` exits 0 (presentation only; no `World` writes).
- [ ] Screenshot in the Log of a power-up pickup with the bot's name and the label both readable.
- [ ] Browser smoke gate and determinism 6 green.

## Log
- 2026-10-21 nightly QA: filed; added `test/label-tag-overlap.mjs` (new file, drives the real `handleEvent`).
