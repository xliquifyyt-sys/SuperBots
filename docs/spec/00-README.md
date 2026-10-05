# Super Bots: complete specification

This folder is the full description of Super Bots as it exists in this repository at build v44. It is written so that a coding agent can rebuild the game in any engine (Higgsfield, Unity, Godot, Phaser, a custom canvas) and end up with the same rules, numbers, maps, bots and feel. Where the spec and the source disagree, the source in `src/` wins; the generated files are produced directly from it.

## Files

| File | Contents |
|---|---|
| `01-game-overview-and-loop.md` | What the game is, match flow, the five phases, timers, deterministic resolution order, win conditions, Sudden Death, turn cap |
| `02-physics-and-combat.md` | Units, constants, movement, jump, projectiles, collisions, damage formula, knockback, self-destruct, status effects, walls |
| `03-bots.md` (generated) | All 8 bots: stats, passives, both specials with every number and how each resolves, body outlines |
| `04-powerups-and-status-effects.md` | Spawn rules, the 10 power-ups, stacking, status effect table |
| `05-maps.md` (generated) | All 10 maps: full terrain coordinates, slopes, spawns, power-up points, kill floors, looped edges, pads, hazards; theme kits |
| `06-hazards-and-map-elements.md` | Every hazard type, air strikes, looped edges, teleporter pads, mines, burning ground, fields |
| `07-ai.md` | The AI planner: candidate generation, scoring, difficulty tiers |
| `08-controls-ui-and-flow.md` | Menus, lobby, host settings and presets, HUD, aiming (vector and point-target), playback, results, persistence |
| `09-rendering-and-art-pipeline.md` | Render layers, camera, painted sprites, backgrounds, terrain kits, cut-out rigs (part maps and motion styles), code-driven VFX, kill drama, art intake tools |
| `10-audio.md` | Event to sound mapping and the synth design |
| `11-architecture-determinism-and-tests.md` | Module map, event system, headless simulation, test harnesses, single-file build, PWA |
| `12-roadmap-known-gaps-and-balance.md` | What is not built, what Brawlbots parity still needs, balance snapshot, known issues |

Regenerate the generated files after any change to `src/core/defs.js`, `src/core/maps.js` or `src/core/hulls.js`:

```
python3 tools/gen_spec.py
```

## One-paragraph summary

Super Bots is a 2D side-view, simultaneous-turn artillery brawler for 2 to 8 players, in the Brawlbots genre. Each turn every player secretly picks one action (Jump, Missile, Special 1 or Special 2) and an aim, then all actions resolve at once in a deterministic physics simulation that everyone watches as playback. Bots have HP, a weight class and an accuracy rating; each has a passive and two cooldown specials. Maps have hazards on timers, power-ups, kill floors, and sometimes looped edges. Last bot or team standing wins; a simultaneous wipe triggers Sudden Death. The current build is single-player versus AI in the browser, with no networking.

## Conventions used throughout

- **World unit**: one unit is the width of the original bot body (bots are drawn 1.25x larger than that). Maps are 30 or 46 to 50 units wide.
- **Coordinates**: x grows right, y grows down, (0, 0) is the top-left of the map. Gravity is positive y.
- **Time**: the simulation runs at a fixed 1/60 s step. A turn's resolve lasts between 0.8 s and 6 s of simulated time.
- **Aim**: a unit vector (dx, dy) plus power in [0.15, 1]. Point-target moves carry a map position (tx, ty) instead.
- **Turn counters**: effects and cooldowns are integers decremented at the end of each turn. "Lasts 2 turns" in the UI means a counter that starts at 2 or 3 depending on whether the pickup turn counts; the exact starting counters are listed per effect.
- **Seeded RNG**: every random decision uses the match seed, so the same inputs replay identically. See 11.

## Suggested reading order for an implementer

1. `01` for the loop and phases.
2. `02` for the physics and damage rules the whole game depends on.
3. `03` and `05` as data to load.
4. `04`, `06` for the systems that sit on top.
5. `07` only if the single-player AI is in scope.
6. `08`, `09`, `10` for presentation.
7. `11` for determinism, which is what makes multiplayer possible later.
