# 11. Architecture, determinism and tests

## Stack

Vanilla JavaScript ES modules, no build step for development (serve the folder statically), one 2D canvas, WebAudio. Optional esbuild bundle for a single-file distribution. PWA manifest and service worker for installability. GitHub Pages workflow deploys `main`.

## Module map

```
index.html, style.css        shell, HUD, menus
src/main.js                  menus, lobby, settings persistence, match lifecycle, localStorage
src/core/defs.js             every tunable number: PHYS, DMG, TURN, BOTS, POWERUPS, settings, presets, AI tiers
src/core/maps.js             THEMES, MAPS (10), spawn helpers
src/core/hulls.js            BOT_HULLS convex outlines (generated)
src/core/rng.js              seeded PRNG (mulberry-style), hashSeed
src/core/sim.js              World: physics, actions, specials, damage, hazards, power-ups, preview
src/core/match.js            Match: phases, timers, AI submission, win checks, Sudden Death, turn cap, log
src/ai/planner.js            AIPlanner
src/render/renderer.js       canvas renderer, camera, effects, aim guide, HUD overlays
src/render/bots.js           drawBot entry, body transform, vector rigs (fallback)
src/render/cutout.js         cut-out rig data and poses
src/render/sprites.js        painted still and clip loading
src/render/vfx.js            painted effect sheets
src/render/backgrounds.js    painted backgrounds
src/render/terrain.js        painted terrain kits
src/render/themes.js         procedural fallback backdrops and slabs
src/render/icons.js          action and power-up icons
src/ui/game.js               GameController: input, HUD, playback, audio dispatch
src/audio.js                 synth engine
tools/                       intake and generation tools, bug hunt, spec generator, rig viewer
test/                        headless simulation tests
art/                         sprites, backgrounds, terrain kits, references, production docs
docs/                        GDD, roadmap, status, this spec
```

## Separation

`src/core` and `src/ai` have no DOM or canvas dependency. `Match` is driven by `update(dt)` from the app; the renderer and audio consume `world.events`. This is the boundary a server would sit on: run `Match` headlessly, send actions in, send the event log and state out.

## Determinism contract

- Fixed step 1/60 s; all loops have fixed iteration limits; substep counts derive from state only.
- All randomness goes through `RNG(seed)`: map pick and restrictions use `seed ^ 0x9e3779b9`, the AI uses `seed ^ 0x51ed27`, the world uses the seed directly. RNG calls happen in a fixed order (hazards, air strike roll, power-up spawn) at turn start.
- AI planning is side-effect free on the `World`: only the server (or a local match) plans, and a network client (`clock = 'client'`) only replays the server's action list. So `AIPlanner` draws only from its own RNG (`seed ^ 0x51ed27`) and never from `world.rng`, and never writes world state; world helpers it calls that need randomness take an explicit RNG (`randomGroundSpot(tries, rng)`). A planner draw from `world.rng` desyncs every client (QA-1). Guarded by `test/ai-purity.mjs` and `test/net-parity.mjs`.
- No wall-clock reads inside the sim. Playback speed, skip, slow motion and hit-stop only change how fast real time maps to simulated steps, never the steps themselves.
- `Match.simulateHeadless(players, settings, seed)` plays a whole match with AI for everyone; the same seed and roster always produce the same result. This is what makes lockstep multiplayer feasible: clients submit actions, one authority (or every client identically) runs the sim.

## Action format

```
{ type: 'jump' | 'missile' | 's1' | 's2' | 'skip',
  aim: { dx, dy, power, tx?, ty? },   // unit vector and power 0.15..1; tx,ty for point-target moves
  param?: number,                     // Pinball bounce count
  locked?: boolean }                  // UI only
```

## Event format

`{ type, t, ...fields }` appended to `world.events` during a turn; `match.log` keeps every turn's events. Types are listed in 02. Position fields are world units.

## Tests and tools

| Command | Purpose |
|---|---|
| `node test/determinism.mjs 6` | same seed and actions produce identical worlds (gate; online play depends on it) |
| `node test/rules.mjs` | targeted rule assertions (gate) |
| `node test/net-parity.mjs 2` | server-style (plans AI) vs client-style (replays actions) on every map, digests must match every turn (CI) |
| `node test/ai-purity.mjs 1` | every `AIPlanner.plan()` call leaves `world.rng` and the world state untouched (CI) |
| `node test/online-8p.mjs [map]` | real server, 4 ws clients + 4 server AI; every client digest-identical every turn |
| `node test/online.mjs` | scripted clients against the real server: friends, invite, full match, reconnect |
| `node test/online-browser.mjs` | two Chromium windows through the real online menus (needs `CHROMIUM_PATH`) |
| `node test/bughunt.mjs 5` | 8-bot invariant checks on every map (gate runs `2`) |
| `node test/headless.mjs 40` | batch of AI matches, mixed sizes, modes and maps; win rates |
| `node test/features.mjs` | asserts every special, power-up, hazard and rule fires at least once |
| `node test/balance.mjs 3` | 1v1 round robin of all 56 bot pairings |
| `node test/stress.mjs 250` | randomised host settings |
| `node test/browser.mjs` | Playwright smoke test (needs a static server on port 8123 or `BASE_URL`, and `CHROMIUM_PATH`) |
| `node tools/bughunt.mjs 10` | per-turn invariants on every map: embedded or stuck bots, lost pickups, flow stats |
| `node test/trace.mjs phantom volt frozenkeel 7 hard` | turn-by-turn trace of one duel (an unknown map id exits non-zero and lists the valid ids) |
| `node test/mapid.mjs` | unknown map ids throw in `Match` and are dropped by the server's `sanitizeSettings`; known ids, `random` and the battle-map fallback are unchanged (gate) |
| `python3 tools/gen_hulls.py` | regenerate body outlines from sprites |
| `python3 tools/gen_spec.py` | regenerate the data-driven spec files |
| `tools/rigview.html` | rig state viewer |

Current state at build v44: 100-game sweep 0 errors, 0 draws, 0 turn-cap hits; bug hunt no invariant violations; browser sweep no page errors.

Update 14 October 2026 (`main` at 06ac459): `node test/bughunt.mjs 2` reports no issues, but `node test/bughunt.mjs 4` and above report 7 "bot embedded in terrain" hits, all Ricochet against a glacierfort step rect. See [M0-05](../alpha/tasks/M0-05.md).

## Performance notes

Backgrounds are drawn as one image per frame; terrain kits are tiled per rectangle; effects use additive blending. A mid-range phone holds 60 fps on Standard maps; Battle maps with 8 bots and many particles can dip. Caching the background and terrain layers to offscreen canvases and capping device pixel ratio at 2 (already done) are the known next steps.
