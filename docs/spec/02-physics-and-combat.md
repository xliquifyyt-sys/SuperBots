# 02. Physics and combat

Everything here is in `src/core/sim.js` with constants in `src/core/defs.js` (`PHYS`, `DMG`, `TURN`). The simulation has no rendering dependencies and runs identically in the browser and in Node.

## Constants

| Name | Value | Meaning |
|---|---|---|
| dt | 1/60 s | fixed simulation step |
| gravity | 19 units/s^2 | downward (+y) |
| airDrag | 0.05 /s | velocity damping on bots every step |
| groundFriction | 6 /s | horizontal damping while grounded |
| botRestitution | 0.15 | bounce on terrain for impacts faster than 2.5 units/s; 0 for gentler contacts |
| slopeGrip | 2.6 units/s | below this speed a bot on a ramp stops instead of creeping |
| restSpeed | 0.35 units/s | a grounded bot slower than this counts as at rest |
| maxSimTime / minSimTime | 6 s / 0.8 s | bounds on a turn's resolve |
| missileSpeed | 33 units/s | base projectile launch speed at full power; specials multiply it |
| missileSpeedMul | 1.25 | the basic missile is 25% faster than base |
| missileKnock | 1.25 | the basic missile shoves 25% harder than knock 1.0 |
| jumpSpeed | 19.57 units/s | full-power jump launch speed for a medium bot |
| weightJump | light 1.18, medium 1.0, heavy 0.86 | jump speed multiplier |
| weightKnockback | light 1.3, medium 1.0, heavy 0.6 | knockback taken multiplier |
| mass | light 0.7, medium 1.0, heavy 1.6 | bot-bot collision mass |
| botBump | 0.35 | restitution between bots |
| knockbackPerDamage | 0.336 units/s per damage point | base shove |
| botVisualScale | 1.25 | sprites are drawn 25% larger than the 1-unit body |
| botRadius | 0.5 | legacy radius, now used only for spawn helpers and particles |
| accuracyGuide | low 0.3, medium 0.55, high 0.85 | fraction of the trajectory shown to the player |
| DMG.missile / missileRadius | 25 / 1.0 | |
| DMG.selfDestruct / radius | 30 / 1.5 | |
| DMG.airStrikeBomb / radius | 20 / 1.2 | |
| DMG.poison / burn | 10 / 8 per turn | |
| TURN.suddenDeathHp | 60 | |
| TURN.maxChainKills | 3 | self-destruct chain depth |

## Bot bodies

Each bot is a convex polygon (`BOT_HULLS`, see 03) traced from its sprite. Widths range from 1.5 (Ricochet) to 3.0 (Warden) units; bottoms sit about 0.6 below the centre. The polygon is mirrored for facing left. `facing` is set from the aim's horizontal sign when an action launches, and from horizontal velocity above 1.5 units/s while moving.

The same polygon is used for: terrain and wall collision (SAT push-out), slope collision (push through the sloped face only), bot-bot collision, projectile hits (distance from the projectile centre to the polygon less than the projectile radius), blast tests (distance from the blast centre to the polygon less than the blast radius), mines (0.45), teleporter pads (0.75), power-ups (0.6), fields and clouds (point inside radius), the kill floor (bottom extent), and the arena edges (left and right extents).

## Terrain

Maps are axis-aligned rectangles plus right-triangle slopes. Bots are pushed out of rectangles along the minimum-penetration axis. Slopes push only through their hypotenuse so wide bodies do not wedge at the foot. Contact with a surface whose normal points up (ny < -0.5) counts as grounded; a slope contact sets `onSlope`.

Wedge rescue: if a bot's centre is still inside any solid after resolution, it is lifted to the top of that block.

## Movement step for a bot

```
vy += gravity * dt
if windX and not Skyla and not grounded: vx += windX * 0.25 * dt
if singularity active and within its radius and farther than 0.3: accelerate 16 units/s^2 toward it, and only half gravity applies
drag: v *= 1 - airDrag * dt
substeps = clamp(ceil(speed * dt / 0.22), 1, 6); move and resolve terrain each substep
edges: looped maps wrap x by map width (then landAfterWrap lifts the bot onto the surface if it arrived inside terrain); solid maps clamp the body inside with vx reversed at 0.3
if grounded: vx *= 1 - groundFriction * dt; on a slope the same damping applies to vy and the bot stops completely below slopeGrip; on flat ground vy is clamped to 0; |vx| < 0.05 snaps to 0
```

Landing (grounded this step, airborne before) triggers Molten Slam and ends the airborne state once nearly still. The updraft release fires when a pending Updraft bot's vy becomes >= 0.

Kill floor: if the body's bottom goes below `lavaY` the bot dies (cause "fell") unless Magmaw's lava surf applies. Also dies beyond y > height + 3 or y < -12.

## Jump

`speed = jumpSpeed * power * weightJump[weight] * (Thrusters ? sqrt(1.75) : 1)`; velocity = aim * speed, with vy forced to at most -2 (always leaves the ground). Sets airborne. Ricochet gets one terrain bounce (restitution 0.65 when |normal velocity| > 3). Jump preview in the UI runs exactly this motion including drag, substeps, wind and the landing rule, so the dotted guide ends where the bot will land.

Airborne bots lean into their travel direction visually; the sim is unaffected.

## Projectiles

Spawned 0.7 units from the bot centre along the aim with velocity aim x speed, where `speed = missileSpeed * power * speedMul * (missile ? 1.25 : 1) * (Volt missile ? 1.15 : 1)`. Fields: body radius `r` (0.18 default), gravity multiplier, wind flag (bombs ignore wind), life 6 s, bounces, splitAt, onImpact handler, reflected count, knock multiplier, status effect, trail.

Each step (substepped so a fast shot moves at most 0.25 units per substep): `vy += gravity * g * dt; vx += windX * 0.6 * dt` if wind applies; move; then test in order: split (apex, if splitAt), looped-edge wrap or out-of-bounds (1 unit outside on solid maps), floor (below kill floor + 0.2 or below map height + 2), terrain rectangles, slope triangles, walls not owned by the shooter, live mines (within r + 0.45), bots.

Bot hit test: distance from the projectile centre to the bot polygon < r (+0.55 if the bot has a Deflector up). The shooter cannot be hit by its own shot until the shot has fully left its body outline (then it can, for example a lob that falls back). A bot with Deflector, or holding an unused Reflector Coat, reverses the projectile instead of being hit: velocity negated, owner becomes the reflector, `reflected++`.

Impacts: `out`, `floor`, `expire` do nothing (floor emits a splash). `split` spawns children. Pinball terrain hits bounce while bounces remain. Mine hits detonate the mine. Wall hits damage the wall by the projectile's damage (10 if none), breaking it at 0. Then the onImpact handler (toxic cloud, singularity, static field) and finally `explode` at the impact point with the projectile's damage (Pinball adds 5 per bounce taken), radius, knock, fromAbove (vy > 2), effect, and excludeSelf for shards.

## Explosions and knockback

`explode(x, y, radius, dmg, source, opts)`:
1. Emits an explosion event (big if radius >= 1.4).
2. Damages every wall segment within radius by dmg; broken segments are removed.
3. For every living bot (skipping the source when excludeSelf, and the source's teammates when enemiesOnly) whose polygon is within radius: apply damage, then if still alive add velocity `k = dmg * 0.336 * knock * weightKnockback[target]` along the direction from the blast to the bot, with an extra upward bias (`vy += (ny - 0.45) * k`), and set it airborne. Status effects attached to the blast apply when damage landed (or when the blast deals 0 by design).

Knockback multipliers per source: missile 1.25, Siege Shell 2.2, Shockwave 2.5, Molten Slam 1.5, mines 1.3, self-destruct 1.2, everything else 1.0. Bulwark with a wall standing takes 0; Gravitas takes the heavy 0.6.

## Damage formula (`applyDamage`)

```
dmg = amount
if source is not status/hazard: dmg *= settings.damage (0.75, 1, 1.5)
if attacker has Amp: dmg *= 1.5
if attacker has Rally: dmg *= 1.1
if attacker and target are teammates and friendly fire is off: dmg = 0 (a "Friendly" 0 is shown)
if target has Plating: dmg *= 0.5
if target is Warden and the hit came from above: dmg *= 0.8
dmg = round(dmg)
hp -= dmg; stats updated; damage event (crit flag when dmg >= 40)
if hp <= 0: kill(target, attacker)
```

Status and hazard damage ignores the host damage multiplier but still respects Plating.

## Bot-bot collisions

Every pair of living bots whose polygons overlap is separated in proportion to the other's mass, then an impulse with restitution 0.35 is applied along the contact normal using the two masses. A bot resting on top of another counts as grounded. Contact power-ups transfer on any contact: Toxin gives Poison (3 counters), Frost gives Frozen (2), Shockwire gives Shocked (2); the holder loses the charge.

## Walls (Bastion Wall)

Walls are rectangles with owner, hp, turns, colour and segment index. They block projectiles from anyone but the owner, are solid for bots, take damage from projectiles and blasts, and expire by turns. Bulwark is knockback-immune while any of its walls stand.

## Status effects

| Effect | Applied by (starting counter) | Behaviour | Removed by |
|---|---|---|---|
| poison | Toxin contact (3) | 10 damage at the start of each turn while the counter > 0 | Repair Kit |
| burn | Ember Spit hit (2) | 8 damage at the start of the next turn; Magmaw immune | Repair Kit |
| frozen | Frost contact (2) | Jump unavailable next turn (also blocks Molten Slam, Updraft, Blink Strike) | time |
| rooted | Anchor Bolt hit (2) | same as frozen | time |
| shocked | Static Field (3), Shockwire contact (2) | Specials unavailable while the counter > 0 after this turn's cleanup | Overclock, time |
| amp | Amp pickup (4) | +50% damage dealt | time |
| plating | Plating pickup (4) | -50% damage taken | time |
| thrusters | Thrusters pickup (4) | jump speed x sqrt(1.75) (distance x1.75) | time |
| reflector | Reflector Coat pickup (2) | first projectile to hit the bot each turn is reflected | time |
| rally | Rally Beacon pickup (3) | +10% damage; the pickup also gave +20 HP with overheal up to 20 that decays 10 per turn | time |

Counters decrement by 1 at the end of each turn and the effect is gone at 0. A counter of 2 applied during a turn therefore covers the next turn only; 3 covers the next two.

## Air strike bombs

Kind `bomb`: owner none, 20 damage, radius 1.2, knock 1.0, fall straight (vx +/-0.15), no wind. Exposed bots across the whole map are hit; anything with terrain overhead is sheltered. Bombs do not wrap on looped maps.

## Events

Every notable moment emits an event `{type, t, ...}` into `world.events` for the turn: fire, jump, land, special, damage, eliminated, explosion, beam, blink, gale, split, bounce, reflect, deflector, toxic, singularity, patch, pickup, powerupSpawn, mine, mineSpawn, wallHit, wallBreak, effect, contact, teleport, geyser, crusher, reactorPulse, airstrike, bomb, splash, lavaSurf, suddenDeath. The renderer and audio consume these; the sim never depends on them.
