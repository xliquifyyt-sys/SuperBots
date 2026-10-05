# 08. Controls, UI and app flow

`index.html` (shell), `style.css`, `src/main.js` (menus, lobby, persistence, match lifecycle), `src/ui/game.js` (in-game controller). Landscape first, portrait supported, touch and mouse.

## Screens

- **Main menu**: Quick 1v1, Custom Game, Botpedia, Help, local record (games, wins, losses).
- **Lobby**: 2 to 8 slots (name, bot or Random, team 1 to 4, human or AI, AI difficulty), Add Bot and Fill to 8, bot cards with stats and specials, presets, settings grid, map list with blurbs and player counts, collapsible power-up pool toggles, Start Match. Teams mode requires at least two different teams.
- **Botpedia**: every bot with passive and specials; every power-up.
- **Help**: rules summary.
- **Pause**: Resume, Quit to menu.
- **Result**: VICTORY / DEFEAT / DRAW / GAME OVER, winner names or team, map, turn count, turn-cap note, per-player table (bot, HP, dealt, taken, KOs, specials, died on turn), Rematch (same roster, settings and a fresh seed), Back.

Preferences (name, bot, slots, settings) and the record persist in `localStorage` under `superbots.prefs` and `superbots.record`.

## Host settings

| Setting | Options | Default |
|---|---|---|
| mode | ffa, teams | ffa |
| map | random or a map id | random |
| planTimer | 10, 15, 20, 30 s | 15 |
| turnCap | 0 (off), 20, 30, 40 | 0 |
| onTurnCap | hp, suddenDeath | hp |
| powerups | off, low, normal, high | normal |
| powerupPool | per-type on/off | all on |
| airStrikes | off, rare, normal | normal |
| hazards | on/off | on |
| startingHp | 0.75, 1, 1.5 (multiplier) | 1 |
| damage | 0.75, 1, 1.5 (multiplier) | 1 |
| cooldowns | normal, fast (every special cooldown -1, min 1) | normal |
| restriction | none, mirror (everyone plays the host's bot), random | none |
| friendlyFire | on/off | off |
| aiDifficulty | easy, normal, hard | normal |

Presets: **Classic** (defaults), **Chaos** (high power-ups, fast cooldowns, 1.5x damage), **Tactical** (30 s timer, low power-ups, no hazards, rare air strikes), **Mirror Match** (restriction mirror).

Quick 1v1: the player's preferred bot versus a random bot on a random Standard map with the current settings forced to FFA.

## HUD during a match

- Top-left: menu button, turn number and phase label, phase timer (turns red and ticks audibly in the last 5 seconds of planning).
- Top-right: sound toggle, recenter camera.
- Announcement strip: hazard warnings and dangers for the turn; "SUDDEN DEATH" banner; centre messages ("BATTLE START", "TURN N", "ELIMINATED, SPECTATING", "VICTORY", "PICK A SPOT FIRST").
- Right: roster with HP bars, lock ticks for players who have committed.
- Over each bot: nameplate with HP chip and bar that shows a ghost segment draining after damage; READY tag during planning once locked; status effect labels float up when applied; a special's icon and name pop over the caster when it fires.
- Bot info panel: tap any bot for HP, effects, cooldowns.
- Playback bar: speed 1x / 2x / 4x and SKIP (runs the rest of the turn instantly; the result is identical because the sim is deterministic).
- Plan bar: aim readout (action, angle and power, or the picked spot for point-target moves), optional secondary parameter button (Pinball bounces 1 to 4), four action buttons with cooldown badges and disabled states, FIRE.

## Aiming

**Vector moves** (Jump, Missile, most specials): press anywhere on the arena and drag. Direction is from the press point to the finger; power is drag length over min(220 px, 35% of the shorter screen side), clamped to [0.15, 1]. The dotted guide shows the predicted path: for projectiles the simulated flight including gravity and wind until impact (with an impact ring sized to the blast radius, and all four Split Shot children); for jumps the exact landing with a bouncing chevron marker. The guide is drawn in full for the player's own bot (the accuracy fraction is used by the AI noise model). The move's icon rides at the end of the arc.

**Point-target moves** (Blink Strike, Bastion Wall): tap or drag anywhere; the spot under the finger is the target. The preview shows a pulsing ring at the Blink arrival (nudged to the nearest open space if the tap is inside terrain or off the arena, which the readout reports) or a dashed ghost of the three-segment wall column. Switching between a vector move and a point move clears the current aim.

Every aim change immediately submits the action unlocked; FIRE locks it (and ends the plan phase early once all humans are locked). Changing the action or aim after FIRE unlocks it again.

## Camera

Fits the whole map at match start; during planning it frames the player's bot; during playback it auto-frames all live bots and projectiles. Pinch or wheel to zoom (0.6x to 3x), drag with two fingers or right mouse to pan, double-tap or the recenter button to reset. A kill punches the camera in toward the KO for about a second.

## Playback pacing

The match advances simulated time at `playbackSpeed x timeScale`. The renderer sets `timeScale` to 0.08 for 90 ms on any hit of 40 or more (hit-stop) and to 0.22 for 0.75 s on a kill (slow motion). At 2x and 4x playback the slow motion is disabled. Skip runs the simulation to the end instantly.

## Spectating

An eliminated human keeps watching; the plan bar hides and the readout says Spectating. Matches with no humans (lobby full of AI) play out the same way.
