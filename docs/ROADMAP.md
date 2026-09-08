# Super Bots — Road to App Store / Play Store

Written after a frame-by-frame study of two Brawlbots gameplay videos (jungle 1v1, Neo City
match) and a 100-game automated validation run across all 10 maps and all 8 bots.

## Where the game stands

Stability is release-grade at the simulation level: 100 varied matches produced **0 errors,
0 draws, 0 turn-cap hits**, and the invariant checker (embedded bots, stuck bots, lost
power-ups) finds nothing across hundreds of eight-bot matches. The turn loop, all 16
specials, all 10 power-ups, hazards, sudden death, and teams all function.

What separates it from Brawlbots is almost entirely **presentation depth** and **product
packaging**, not mechanics.

## What was closed in this pass

- BATTLE START! / VICTORY! comic splash, armoured timer capsule, READY! tags over bots.
- Brawlbots-style nameplates: dark capsule, HP chip, identity-coloured bar, white ghost
  segment that drains after damage.
- Cartoon explosions (spike-star flash + bold ring + smoke), muzzle flash, landing dust,
  stronger screen shake.
- Neo City rebuilt from the video: holo face billboard, neon dragon sign, animated ad
  panels, cables, rain, tread-textured slabs.
- Balance: Phantom shards 6→9, Skyla Updraft 15→18 (they sat at 10% / 14% winrate over
  100 games; strongest bots sit near 38%).

## What has to be done for a real store release

### 1. Art: the single biggest gap
Brawlbots uses hand-painted / pre-rendered 3D assets. Procedural canvas art has hit its
ceiling. Needed:
- **Bot sprite sheets** (8 bots × idle/jump/fire/hit/death, 2 specials each). Painted or
  rendered from 3D, exported at 2–3 scales.
- **Terrain tile sets per theme** (slab bodies, edges, corner caps, decorations) instead of
  runtime-painted rectangles.
- **Background paintings per theme**, 2–3 parallax layers each.
- **VFX sprite sheets** for explosions and status effects.
An art bible per theme (palette, edge treatment, silhouette rules) keeps 5 themes coherent.

### 2. Multiplayer: the reason Brawlbots is fun
The current game is local vs AI. Brawlbots is a social game (its chat bar is always on
screen). A store release needs at minimum:
- **Async or realtime online matches** — the simultaneous-turn design is ideal for
  server-authoritative lockstep: clients submit actions, the server (or host) runs the same
  deterministic sim. The codebase is already deterministic and seeded, which is the hard part.
- Account/profile, matchmaking by rating, private rooms with invite links.
- Emotes / quick chat during planning.

### 3. Meta-game and retention
- Progression: XP per match, bot unlocks, cosmetic skins (recolours of existing rigs are cheap).
- Daily missions, win streaks, seasonal ladder.
- Botpedia is in place; add per-bot mastery stats.

### 4. Mobile packaging
- Wrap with **Capacitor** (web view) or port the renderer to a game engine. Capacitor is the
  fast path: the game is pure canvas + touch already, PWA manifest and service worker exist.
- Touch polish: bigger hit targets for the action bar, haptics on lock/explosion, safe-area
  insets (already partly handled), interruption handling (calls, background).
- 60fps on mid-range phones: cache backdrop layers to offscreen canvases (the biggest CPU
  cost), cap devicePixelRatio at 2.
- Store requirements: privacy policy, data-safety forms, age rating (cartoon violence),
  icons/splash screens, screenshots per device class.

### 5. Audio
Current audio is synthesized beeps. Needs a real SFX set (per-bot fire sounds, explosion
family, UI ticks, crowd stingers for KOs) and a music loop per theme with ducking during
playback.

### 6. Onboarding
- A 60-second interactive tutorial: aim, power, jump, grab a power-up, win a 1v1 vs a
  scripted dummy.
- Difficulty ramp for the AI (easy default; the AI already has tiers).

### 7. Remaining game-feel items (procedural, doable now)
- Camera: punch-in on kills, slight drift toward projectiles mid-flight.
- Turn playback pacing: brief slow-motion on the killing blow.
- Water/lava reflections of bots and explosions.
- Idle animations (weapon sway, blink lights) on bots while planning.

## Suggested order

1. Multiplayer prototype (async first) — validates the fun with real people while art is made.
2. Art replacement theme by theme (start with Neo City and Ice, the two strongest).
3. Capacitor wrap + device test matrix.
4. Audio set.
5. Meta-game + onboarding.
6. Store submission pass.
