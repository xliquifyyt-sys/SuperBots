# 06. Hazards and map elements

All map elements are data on the map definition and logic in `World.startTurn`, `World.resolve` and `World.step`. Hazards are disabled by the host setting `hazards: false` and are suspended during Sudden Death. Every hazard that strikes gives a warning banner the turn before, so players can plan around it. The AI reads the same warnings.

## Timing convention

Hazards use the turn counter modulo `every`. "Fires on turn N" means it strikes during the resolve of turn N; the warning is shown during turn N-1's announce. Types marked "from turn `every`" skip turn 1 even when `every` would match (they check `turn > 1`).

## Hazard types

### risingLava (`{every, amount}`)
Every `every` turns (from turn `every`), the kill floor y decreases by `amount` units (the lava comes up). Warning "Lava rises next turn", then "The lava rises!". Projectiles below the new floor splash; bots below it die. Sudden Death resets the floor to the map's base value. Used by Ember Pit (every 4, 0.8).

### geyser (`{every, points, count, dmg, radius}`)
The turn before: `count` points are drawn at random (seeded) from `points` and shown as warning circles. On the hazard turn, at the start of the resolve, each chosen point erupts: every bot whose outline is within `radius` takes `dmg` hazard damage and is launched (vy -= 12, vx += (x - gx) x 3). Used by Ember Pit (every 4, 1 of 4 points) and Magma Works (every 3, 2 of 5 points).

### lavaPatch (`{every, dmg, turns, w}`)
Every `every` turns (from turn `every`) a burning patch appears at a random walkable spot (`randomGroundSpot`: random x in [1.5, width-1.5], the topmost terrain surface under it, if above the kill floor). The patch is `w` wide and lasts `turns` turns. During a resolve, a grounded bot whose body overlaps the patch horizontally and sits within 1.1 vertically takes `dmg` once per turn. Magmaw ignores patches. Molten Slam leaves the same kind of patch (w 4, turns 3, dmg 15). Used by both lava maps (every 3, 20 damage, 2 turns, 3 wide).

### gusts (`{every, strength}`)
Every `every` turns `windX = +/- strength` (side at random) for that turn only; other turns windX is 0. Warning "Gust next turn", then a banner with the direction. Wind acts on airborne bots at windX x 0.25 per second (not Skyla) and on projectiles at windX x 0.6 per second. Used by Frost Hollow (4, 9), Glacier Fortress (3, 10), Cloud Steps (3, 7), Nimbus Reach (3, 11).

### wind (`{max}`)
A constant wind re-rolled every turn uniformly in [-max, max] and announced. Not used by a shipped map but supported.

### mines (`{every, dmg, radius, label}`), timed form
Every `every` turns (from turn `every`) one spike mine is planted on a random walkable surface (0.15 above it). Warning the turn before. Mines accumulate without limit; detonated mines are removed for good. A mine detonates when a bot's outline comes within 0.45 of it or a projectile comes within its body radius + 0.45: an explosion of `dmg` at `radius` with knock 1.3 (credited to the projectile's owner if any). Used by Canopy Ruins and Temple Crossing (every 3, 20 damage, radius 1.2).

The legacy fixed form (`mines: [[x, y, 'fixed']]` on the map with a hazard `{type:'mines', respawn, random}`) places mines at match start, respawns them `respawn` turns after detonation, and optionally scatters non-fixed mines to a new random spot. No shipped map uses it any more, but the code path exists.

### crusher (`{x, w, top, bottom, every, dmg, label}`)
A zone x..x+w, top..bottom. Warning the turn before, "THIS TURN" banner with the zone highlighted on the hazard turn, and at the start of that resolve every bot whose body overlaps the zone horizontally and whose centre is between top and bottom + 0.6 takes `dmg` hazard damage and is shoved sideways (6 units/s away from the zone centre) and down (3). Used by Temple Crossing as the "Log drop" (x 19, w 8, y 1 to 7, every 5, 35 damage).

### reactor (`{x, y, r, every, dmg, label}`)
A circle. Warning the turn before, danger ring on the hazard turn; at the start of that resolve every bot inside takes `dmg` and is pushed radially outward at 7 with a 2 lift. Used by Neon Alley and Skyline Grid as the "EMP pulse" (every 4, 15 damage).

## Air strikes

Independent of map hazards; host setting Off / Rare (8% per turn) / Normal (18% per turn), rolled from turn 2 when none is scheduled, never in Sudden Death. The warning turn says "Air strike next turn"; the strike turn says "AIR STRIKE INCOMING, TAKE COVER". No location is given because the whole map is carpeted: `max(6, round(width / 1.6))` bombs spaced evenly with +/-0.3 jitter, held for 2.2 to 3.2 s so player actions resolve first, then falling nearly vertically. Each bomb: 20 damage, radius 1.2. Any bot with terrain above it is safe; any exposed bot is hit. The AI treats exposure during a warning as high danger and moves under cover.

## Looped edges (`teleporters: true`)

On Magma Works, Glacier Fortress, Temple Crossing, Nimbus Reach and Skyline Grid, a bot or projectile crossing x = 0 reappears at x = width and vice versa. A bot that arrives inside terrain is lifted onto the surface above. Bombs do not wrap. On other maps the edges are solid for bots (body clamped inside, vx reversed at 0.3) and projectiles are lost 1 unit outside.

## Teleporter pads (`pads: [{x, y, to, label}]`)

A bot whose outline comes within 0.75 of a pad during a resolve is moved to `to` with zero velocity, airborne, and cannot use a pad again for 0.8 s. Cloud Steps has one pad (21, 13) to (17.5, 3.1); Nimbus Reach has two rescue pads at the bottom corners (5, 20) and (44, 20) both to the top-centre platform (25, 7.5). The renderer draws pads as glowing rings and the teleport event flashes both ends.

## Kill floors

`killFloor: {type, y}` with types lava, water, void, neon. Only lava is special: Magmaw's first contact per turn bounces it out (vy -15) with 2 turns of lava immunity afterwards; every other case kills. Rising lava only exists on Ember Pit.

## Fields, clouds and walls (created by specials)

- **Static field** (Volt): radius 3, 2 turn counters; applies Shocked at end of turn to anyone inside.
- **Toxic cloud** (Phantom): radius 2.4, this turn only; 5 damage every 0.4 s, max 7 ticks per bot.
- **Singularity** (Gravitas): radius 9.1 pull for 2.6 s of simulated time; half gravity inside; the turn cannot end while it runs.
- **Burning patch** (Magmaw slam): 4 wide, 3 turns, 15 damage per touch.
- **Bastion Wall** (Bulwark): 3 segments of 0.4 x 0.85, 10 HP each, 3 turn counters, blocks enemy projectiles.

## Walkable surface helper

`randomGroundSpot()` tries up to 30 times: pick x uniformly in [1.5, width - 1.5], find the topmost terrain rectangle whose span covers x (0.1 tolerance), and return a point 0.45 above its top if that top is at least 0.5 above the kill floor. Used by timed mines and burning ground. The spot can be on any platform, including floating ones.
