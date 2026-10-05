# 01. Game overview and turn loop

## What the game is

Super Bots is a simultaneous-turn artillery brawler. Everyone aims and commits at the same time; a deterministic physics simulation resolves every action together; players watch the playback; repeat until one bot or one team is left. The design pillars are: everyone acts at once, readable chaos with up to 8 bots, bots as personalities with two signature specials each, host-controlled custom rules, and original art and names.

Modes: **Free-for-all** (every bot for itself) and **Teams** (up to 4 teams: Blue, Orange, Green, Purple). The current build is local: one human plus AI opponents, or AI only.

## Match flow

```
Main menu -> Quick 1v1 | Custom Game lobby -> [Turn loop] -> Results -> Rematch | Menu
```

The lobby builds a roster of 2 to 8 players (name, bot, team, human or AI) and a settings object. `Match` picks the map (random among maps whose maxPlayers >= player count, or the chosen one), applies bot restrictions (mirror or random), assigns spawn pads, builds the `World`, and starts the loop.

## Phases

The match is a state machine with phases `announce -> plan -> resolve -> cleanup -> announce ...` and a terminal `over`. The app calls `match.update(dt)` every frame with real seconds.

| Phase | Duration | What happens |
|---|---|---|
| **announce** | 1.6 s + 0.4 s per announcement (max 3 extra) | `world.startTurn()` runs: turn counter increments, status damage ticks, hazards are scheduled or fired, air strikes are rolled, a power-up may spawn, per-turn action state resets. The win check runs. Banners show the hazard warnings ("Lava rises next turn", "AIR STRIKE INCOMING"). |
| **plan** | host setting: 10, 15, 20 or 30 s (default 15) | Each living human picks an action and aim. AI actions are computed at the start of this phase (deterministic) and submitted at the deadline. The phase ends early when every living human has locked in. |
| **resolve** | simulated time 0.8 to 6 s, played back in real time at 1x, 2x or 4x, or skipped | Every submitted action launches at t = 0; the physics steps at 1/60 s until the world is at rest. Pending hazards and the air strike rain fire at the start of this phase. |
| **cleanup** | 0.8 s | `world.endTurn()`: static fields apply Shocked, cooldowns and effect counters decrement, walls and fields and patches expire. The turn's events are appended to the match log. |
| **over** | terminal | Winner is set. Results screen. |

Timer expiry during plan: the player's current aim is used with the selected action; a player who never aimed skips. An action is submitted continuously while aiming, so the last state always counts.

## Turn start in detail (`startTurn`)

1. `turn++`, event list and simulated clock reset, per-bot per-turn flags reset. `turnsAlive` increments for living bots. A camping tracker counts turns a bot has not moved more than 0.3 units.
2. **Pre-turn status**: Poison deals 10, then Burn deals 8 (Magmaw immune). Rally overheal decays by up to 10 toward max HP.
3. **Hazards** (skipped if the host turned hazards off, and always during Sudden Death): each hazard entry on the map either announces a warning for next turn or fires or schedules itself for this turn. Details per type in 06.
4. **Air strike**: if one was scheduled for this turn it becomes pending (fires in resolve) with the banner "AIR STRIKE INCOMING, TAKE COVER". Otherwise, from turn 2 on, roll `rng < p` with p = 0.18 (normal) or 0.08 (rare) to schedule one for next turn ("Air strike next turn"). Off setting disables. No location is ever revealed because the strike covers the whole map.
5. **Power-up spawn**: from turn 2, if below the cap (3 on Standard maps, 5 on Battle maps), with probability by setting: Low 0.25 (Standard) / 0.35 (Battle), Normal 0.5 / 1.0, High 1.0. A free spawn point is chosen at random (no existing power-up within 0.5), lifted out of terrain, and a type is picked by weight from the pool, excluding types already on the field, types the host disabled, and Rally Beacon outside Teams mode. Power-ups never expire.
6. Action slots cleared.

## Resolve in detail (`resolve` then `step`)

At t = 0:
- Pending crusher, geyser and reactor hazards apply their damage and shoves.
- If an air strike is pending, `max(6, round(mapWidth / 1.6))` bombs are created above the map (y between -2 and -7, x evenly spaced with +/-0.3 jitter, vx +/-0.15, vy 6) with a 2.2 to 3.2 s delay before they start falling, so player actions land first.
- Wall lifetimes decrement; dead walls are removed; `wallImmune` is recomputed per bot.
- Every living bot's action launches: jump, missile, or special (see 02 and 03). Facing is set from the aim. In Sudden Death the action type is recorded for the alternating rule.

Then `step(1/60)` repeats until `done()`:
- Bots: gravity, wind (airborne, non-Skyla), singularity pull, air drag, substepped movement with terrain resolution, edge rule (loop or solid), ground friction and slope grip, slam and updraft triggers on landing or apex, kill floor and out-of-bounds elimination.
- Toxic clouds tick every 0.4 s. Burning patches scorch on contact. Teleporter pads fire. Power-ups are collected on touch (buffs apply mid-turn). Mines detonate on touch.
- Bot-bot collisions (mass-weighted) and contact effect transfers.
- Projectiles move, collide and impact.
- Singularity timer counts down.

`done()` is true when simulated time >= 6 s, or when all of these hold after at least 0.8 s: no projectiles, no active singularity, no pending slam or updraft, every living bot grounded (or already below the kill floor) and slower than 0.35 units/s.

## Resolution order summary

1. Pre-turn status damage (announce).
2. Hazard scheduling and warnings (announce).
3. Scheduled hazards strike (resolve t = 0).
4. All player actions launch simultaneously (resolve t = 0).
5. Physics until rest: movement, projectiles, contact effects, pickups, mines, pads, clouds, patches, kill floor.
6. Air strike bombs fall during the same resolve after their delay.
7. End of turn: static fields apply, counters decrement, expiries.
8. Win check at the next announce.

## Eliminations

A bot is eliminated when HP reaches 0, when its body crosses the kill floor (y + bottom extent > kill floor y), or when it leaves the map vertically (y > height + 3 or y < -12). Horizontal exit is impossible: edges are solid or looped.

On elimination by damage (not a fall) the bot **self-destructs**: a blast of 30 damage, radius 1.5, knock 1.2x, enemies only. Chains are allowed up to depth 3 (`maxChainKills`). The killer gets a kill credited, and Phantom's passive triggers. A fallen bot only shows a small white puff.

## Win conditions

Checked at the start of every announce.
- **FFA**: one living bot left wins. **Teams**: one team with a living bot left wins.
- **Zero standing**: all remaining bots died in the same turn. Those bots share the win (`winner.type === 'draw'`, `shared: true`). This does not start Sudden Death, including a wipe that happens during a Sudden Death round already started by a turn-cap tie.
- **Turn cap** (host setting 20, 30, 40 or off): once `turn > cap`, the player or team with the highest total HP wins. On a tie, the `onTurnCap` setting decides: `hp` picks the first tied entry; `suddenDeath` eliminates everyone else and runs Sudden Death among the tied bots.

## Sudden Death

- The bots that died in the deciding turn respawn on their original spawn pads with 60 HP, no effects, no contact power-up, no deflector. Everyone eliminated earlier stays out.
- Rising lava resets to the map's base kill floor. Power-ups on the field, walls, fields, patches and projectiles are cleared. Air strikes and power-up spawns stop. Map hazards stop (hazards block is skipped while suddenDeath is true).
- Specials are disabled. Jump and Missile alternate: after using Missile only Jump is available next turn, and after Jump only Missile. On the first Sudden Death turn both are available.
- Started only by a turn-cap tie (`onTurnCap: 'suddenDeath'`). HUD shows a SUDDEN DEATH banner and a red vignette. A later simultaneous wipe ends as a shared win.

## Turn log and stats

Each bot tracks `dealt`, `taken`, `kills`, `turnsAlive`, `specials`. The results screen shows per player: bot, HP, dealt, taken, KOs, specials, turn of death. A local record of games, wins and losses is kept in browser storage.
