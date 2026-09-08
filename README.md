# Super Bots

A simultaneous-turn 2D artillery brawler for 2 to 8 bots, in the Brawlbots genre. Everyone aims and fires at the same time, the deterministic sim resolves every action at once, and the last bot (or team) standing wins.

This is the v0.1 single-player prototype of the [Super Bots design document](docs/GDD-v0.1.md): every rule, bot, power-up, map and host setting from the GDD is implemented, and the other players are AI. It runs in the browser with no build step and installs as a PWA.

## Play

```bash
git clone https://github.com/xliquifyyt-sys/SuperBots.git
cd SuperBots
python3 -m http.server 8000      # any static server works
```

Open <http://localhost:8000>. A static server is required because the game uses ES modules.

- **Quick 1v1** drops you on a Standard map against a random bot.
- **Custom Game** is the host lobby: up to 8 players, teams, map choice, and every host setting from the GDD (plan timer, turn cap, power-up level and pool, air strikes, hazards, starting HP, damage, cooldowns, bot restrictions, friendly fire) plus the Classic / Chaos / Tactical / Mirror presets.

### Controls

| Action | Desktop | Touch |
| --- | --- | --- |
| Aim | drag anywhere on the arena | drag anywhere |
| Choose action | Jump / Missile / Special buttons | same |
| Lock in | FIRE | FIRE |
| Camera | wheel to zoom, right-drag to pan, double-click to recenter | pinch to zoom, two-finger drag to pan, ⌖ to recenter |
| Bot info | click a bot | tap a bot |
| Playback | SKIP, 1×/2×/4× | same |

The dotted trajectory shows 30 / 55 / 85 % of the flight for low / medium / high accuracy bots. If the plan timer runs out, your current aim is used; if you never aimed, you skip.

## What is implemented

**Turn loop.** Announce → Plan (10/15/20/30 s) → Resolve (deterministic fixed-step sim) → Playback with auto-framing camera, damage numbers and eliminations → Cleanup.

**Bots.** All eight from the GDD with both specials and their passives:

| Bot | Special 1 | Special 2 | Passive |
| --- | --- | --- | --- |
| Bulwark | Bastion Wall | Siege Shell | knockback immune while the wall stands |
| Magmaw | Molten Slam | Ember Spit | survives the first lava contact each turn |
| Volt | Chain Arc | Static Field | +15 % missile speed |
| Warden | Deflector | Anchor Bolt | 20 % less damage from above |
| Skyla | Updraft | Gale Shot | ignores wind |
| Phantom | Blink Strike | Toxic Bomb | kill shortens next cooldown |
| Ricochet | Pinball (bounce count parameter) | Split Shot | jump bounces once |
| Gravitas | Singularity | Shockwave | heavy knockback resistance |

**Rules.** Jump and Missile every turn, cooldown specials, elimination by HP, kill floor or leaving the map, self-destruct blasts with chain kills, ten power-ups with the GDD stacking rules, Sudden Death (respawn at 50 HP, no specials, alternating Jump/Missile), turn cap with highest-HP or Sudden Death tiebreak, teams with friendly-fire toggle and Rally Beacon.

**Maps.** Ten maps across five theme kits, one Standard and one Battle map each: Lava (Ember Pit, Magma Works), Ice (Frost Hollow, Glacier Fortress), Jungle (Canopy Ruins, Temple Crossing), Sky (Cloud Steps, Nimbus Reach) and Neo City (Neon Alley, Skyline Grid). Hazards: rising lava, geysers, falling icicles, blizzard gusts, spike mines, log drops, wind, EMP pulses, teleporter edges. Air strikes give a one-turn warning with no location, then standard missiles rain across the whole map, so overhead cover matters.

**AI.** Each AI bot samples aims through the same trajectory preview the player sees, refines the best one, weighs specials situationally (walls when under fire, Chain Arc through cover, Singularity on clusters, Gale Shot toward ledges, contact power-ups by body-slamming), dodges when enemies have a line on it, retreats from announced hazards and grabs power-ups. Three difficulty tiers change aim noise, sample count and special usage.

## Project layout

```
index.html, style.css     Shell, HUD and menus
src/main.js               Menus, lobby, settings persistence, match lifecycle
src/core/defs.js          Every tunable number: bots, power-ups, physics, settings, presets
src/core/maps.js          Ten maps and five theme kits
src/render/themes.js      Painted backgrounds, platforms, kill floors and hazard decor per theme
src/render/bots.js        Bot rigs and move animations
src/core/sim.js           Deterministic World: physics, actions, specials, damage, hazards
src/core/match.js         Turn-loop state machine, win checks, Sudden Death, turn cap
src/core/rng.js           Seeded PRNG
src/ai/planner.js         AI action planner
src/render/renderer.js    Canvas renderer, camera, particles, aim guide
src/ui/game.js            In-game controller: input, HUD, playback
src/audio.js              Procedural WebAudio sound
test/                     Headless simulation tests (Node, no browser needed)
docs/GDD-v0.1.md          The design document this build implements
```

The sim has no DOM dependencies, so the whole game logic runs headless in Node. That is how the tests work and how a server build would run it.

## Tests

```bash
node test/headless.mjs 40    # batch of AI matches with mixed sizes/modes/maps; prints win rates
node test/features.mjs       # asserts every special, power-up, hazard and rule fires at least once
node test/balance.mjs 3      # 1v1 round-robin balance report
node test/stress.mjs 250     # randomised host settings, sizes and modes
node test/browser.mjs        # Playwright browser smoke test (needs playwright-core and a static server on :8123)
node test/bughunt.mjs 5      # 8-bot invariant checks on every map (embedding, stuck bots, misplaced pickups)
node test/trace.mjs phantom volt frosthollow 7 hard   # turn-by-turn trace of one duel
```

## Deploy

Enable GitHub Pages with the "GitHub Actions" source and the included workflow publishes the game on every push to `main`.

## License

MIT.
