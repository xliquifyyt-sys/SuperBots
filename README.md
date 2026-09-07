# Super Bots

A 3D 1v1 arena combat game in the browser. Pick a combat bot, drop into a neon arena, and fight an adaptive AI in a best-of-three match.

Built with Three.js and vanilla JavaScript. No build step, no framework, no asset downloads: open `index.html` from any static web server and play.

## Play

```bash
git clone https://github.com/xliquifyyt-sys/SuperBots.git
cd SuperBots
python3 -m http.server 8000      # or: npx serve .
```

Then open <http://localhost:8000>. A static server is required because the game uses ES modules; opening the file directly from disk will not work in most browsers.

The repository also ships a GitHub Pages workflow. Enable Pages with the **GitHub Actions** source in the repo settings and every push to `main` deploys the game.

## Controls

| Action | Keys |
| --- | --- |
| Move | W A S D or arrow keys |
| Aim / turn | Mouse (pointer lock) |
| Fire | Left click |
| Ability | Space, Shift, or right click |
| Special | E, Q, or middle click |
| Pause | Esc |

## Bots

| Bot | Role | Weapon | Ability | Special |
| --- | --- | --- | --- | --- |
| **Striker** | Fast skirmisher, 100 HP | Twin Blasters, rapid fire | Dash: burst forward, briefly invulnerable | Overdrive: double fire rate and +50% speed for 4s |
| **Titan** | Tank, 170 HP | Siege Cannon, slow shells with splash damage | Barrier: absorb all damage for 1.6s | Ground Slam: 45 damage shockwave with knockback |
| **Phantom** | Glass cannon, 80 HP | Rail Lance, piercing high-damage shots | Blink: teleport 9m | EMP Pulse: stun the enemy for 1.8s and drain energy |

Abilities cost energy. Energy regenerates over time and can be topped up with energy cells in the arena. Repair kits restore health. Both pickups respawn.

## Rules

- First to win two rounds takes the match.
- Each round lasts 90 seconds. If time runs out, the bot with the higher health fraction wins the round.
- Bots swap spawn sides every round.

## The AI

The opponent is a state-driven controller with three difficulty tiers (Rookie, Veteran, Elite). It:

- navigates the arena with A* over a coarse grid and steers around obstacles with feelers,
- tracks the player only while it has line of sight and hunts the last-known position otherwise,
- keeps the preferred range for its class and strafes unpredictably,
- leads its shots against a moving target, with aim error and reaction time scaled by difficulty,
- dodges incoming projectiles sideways,
- retreats to repair kits when losing, and grabs energy cells when low,
- uses its ability and special situationally (Barrier when taking damage, Blink to dodge, Slam at close range, EMP when in range, and so on).

Elite difficulty also gives the AI extra health and damage.

## Project layout

```
index.html          Page shell, HUD markup, and menu screens
style.css           HUD and menu styling
src/main.js         Menus, settings, persistence, match flow wiring
src/game.js         Renderer, scene, match/round state machine, abilities, camera
src/bot.js          Bot entity: mesh, movement, health/energy, status effects
src/ai.js           NavGrid (A*) and the AI controller
src/arena.js        Arena geometry, obstacle collision, line-of-sight tests
src/projectiles.js  Projectile simulation and hit detection
src/particles.js    GPU point-sprite particle system
src/hud.js          DOM HUD, kill feed, minimap
src/audio.js        Procedural WebAudio sound effects and ambient drone
src/config.js       All tuning: bot classes, weapons, difficulty, round rules
vendor/             Pinned Three.js build (MIT)
```

Settings (sensitivity, volume, music, shadows) and your win/loss record are stored in `localStorage`.

## Testing

A headless smoke test drives the game through a full match with Playwright and asserts there are no runtime errors. Run it locally with:

```bash
npm install --no-save playwright-core
python3 -m http.server 8123 &
node test/smoke.mjs
```

The test needs a Chromium binary. Set `CHROMIUM_PATH` if it is not on the default Playwright path.

## License

MIT. Three.js is included under its own MIT license; see `vendor/THREE-LICENSE`.
