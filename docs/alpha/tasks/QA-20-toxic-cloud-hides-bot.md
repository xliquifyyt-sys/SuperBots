---
id: QA-20
milestone: M1
role: client-ui
status: todo
depends: []
severity: P2
---
# QA-20: Toxic Bomb cloud draws as an opaque lime block that hides the bot inside it (and its name tag)

Found by the 2026-10-20 nightly QA run (`node test/qa-playthrough.mjs <dir> 3`, set 1: Warden in a 6p teams game on
Temple Crossing at 1280x720; the match seed is `Date.now()`, so use the test below to reproduce). On turn 2 playback a Toxic
Bomb cloud (Mira is the only Phantom) burst on Skyla (Kilo) on the right-hand ledge. For the next ~1 s Kilo was completely
invisible: a solid, hard-edged lime blob of overlapping squares covered the bot, its name tag ("Kil…" pokes out) and
its HP chip.

Screenshot: `docs/alpha/qa/2026-10-20/m4-templecrossing-1280x720-resolve-T2.jpg` (right side, x≈1070, y≈310).

Cause (read from code): no painted `toxic_cloud` sheet exists yet (`art/vfx/manifest.json` is empty), so
`Renderer.handleEvent` falls back to the procedural burst — 30 particles of `size: 0.7` world units (3.5x the usual
0.2), colour `#9dff2f`, `life: 2.2` s, almost no speed — all inside the 2.4-unit radius. `drawParticles()` draws them as
filled squares at `globalAlpha = 1 - t/life` *after* `drawBots()`, so for the first second the stack is effectively
opaque over the bot. The persistent field circles in `drawPatchesFields()` (alpha 0.4, drawn under the bots) already
show the cloud area on their own.

Repro (new, report test): `python3 -m http.server 8123 & CHROMIUM_PATH=... node test/fx-occlusion.mjs`. It drives the
real `handleEvent`/`emit` with each area effect centred on a bot and rasterises the bot's 1x1-unit box against the
particles as `drawParticles` draws them. **On main: toxic hides 86% of the bot at 0.3 s, 75% at 0.6 s, 42% at 1 s**;
every other effect (geyser, mine, blink, teleport, wallBreak, lavaSurf) is under 5% after 0.3 s.

Expected: a bot standing in a toxic cloud stays readable (silhouette, name tag and HP chip visible) — e.g. smaller,
softer, lower-alpha round puffs, or draw the toxic puffs before `drawBots()`, plus a poison tint on the bot itself.
Actual: the bot and its tag vanish behind solid lime squares for about a second.

Not an art-queue item: this is the procedural fallback that ships until a `toxic_cloud` sheet arrives, and even then the
fallback must not hide bots.

## Acceptance

- [ ] `node test/fx-occlusion.mjs` exits 0. Add it to CI next to the browser gate (additions only).
- [ ] Before/after screenshot of a bot inside a toxic cloud in the Log. Browser smoke gate and determinism 6 green.
- [ ] Renderer-only change: no file under `src/core` or `src/ai` touched.

## Log
- 2026-10-20 (qa): filed from the nightly playthrough; `test/fx-occlusion.mjs` added (report-only, not in CI).
