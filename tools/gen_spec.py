#!/usr/bin/env python3
"""Generate the data-driven spec files (bots, maps) in docs/spec/ from the game's own definitions.

    node -e "..."  # not needed: this script shells out to node to export defs.js and maps.js as JSON
    python3 tools/gen_spec.py
"""
import json, os, subprocess, sys
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'docs', 'spec')
os.makedirs(OUT, exist_ok=True)

def node_json(expr):
    js = f"import('{ROOT}/src/core/defs.js').then(async d => {{ const m = await import('{ROOT}/src/core/maps.js'); const h = await import('{ROOT}/src/core/hulls.js'); process.stdout.write(JSON.stringify(({expr})(d, m, h))); }})"
    return json.loads(subprocess.check_output(['node', '-e', js], cwd=ROOT))

data = node_json("(d, m, h) => ({ BOTS: d.BOTS, POWERUPS: d.POWERUPS, PHYS: d.PHYS, DMG: d.DMG, TURN: d.TURN, MAPS: Object.fromEntries(Object.entries(m.MAPS).map(([k, v]) => [k, { ...v, terrain: v.terrain.filter(r => !r.step) }])), THEMES: m.THEMES, HULLS: h.BOT_HULLS })")
BOTS, PU, PHYS, DMG, MAPS, THEMES, HULLS = data['BOTS'], data['POWERUPS'], data['PHYS'], data['DMG'], data['MAPS'], data['THEMES'], data['HULLS']

# ---------------- bots ----------------
# Implementation details that live in sim.js rather than defs.js, kept here so the spec is complete.
IMPL = {
    'bastionWall': dict(kind='Point-target placement', detail=[
        'Player taps or drags anywhere on the map; the tap point is the wall position (aim.tx, aim.ty). AI aims use the legacy rule: 1.35 units toward the aim side of the caster.',
        'Three stacked segments, each 0.4 wide x 0.85 tall (total column 0.4 x 2.55), centred on the point. The column is clamped inside the arena and pushed out of any terrain it overlaps.',
        'Each segment has wallHp HP (10). Projectiles that are not the owner\'s hit a segment and deal their damage to it; blasts within their radius also damage segments. Broken segments vanish (wallBreak event).',
        'Walls last turns:3 counters (placed turn plus two more), decremented at the start of each resolve.',
        'Passive hook: while any wall owned by Bulwark stands, Bulwark takes zero knockback (knockMul returns 0).']),
    'siegeShell': dict(kind='Projectile', detail=['speedMul 0.8, projectile radius 0.3, gravity 1.15x, knock 2.2x, colour #ffb347.']),
    'moltenSlam': dict(kind='Jump then blast on landing', detail=[
        'Performs a normal jump with power = max(aim.power, 0.6); sets slamPending.',
        'On the first landing while airborne: explode at (x, y+0.2) with dmg 35 / radius 3.5 / knock 1.5, excludeSelf, and push a burning patch {w:4, turns:3, dmg:15} at (x, y+0.4).',
        'Blocked while Frozen or Rooted (it counts as a jump).']),
    'emberSpit': dict(kind='Projectile x3', detail=['Three projectiles at angle offsets -9, 0, +9 degrees, speedMul 0.6, radius 0.14 body, each applies Burn (effect {burn:2}) on a damaging hit.']),
    'chainArc': dict(kind='Instant beam', detail=[
        'Line from the caster along the aim across the whole map (length = hypot(mapW, mapH)). Ignores terrain and walls.',
        'Every living bot whose centre is within 0.75 (PHYS.botRadius + 0.25) of the line takes 40 (label "Chain Arc"). Note: this is still a circle test, not the body outline.',
        'Then the nearest bot within arcRange 6 of the FIRST hit bot that was not already hit takes arcDmg 15 (label "Arc"). No knockback from either hit.',
        'Emits beam events for the renderer (lightning).']),
    'staticField': dict(kind='Projectile with lingering field', detail=[
        'On impact: normal blast (30 dmg, radius 3) with effect {shocked: 3}, and a static field {r: 3, turns: 2} is left at the impact point.',
        'At end of turn, every bot inside the field gets Shocked for shockTurns (3 counters = no specials for the next 2 turns).']),
    'deflector': dict(kind='Self buff', detail=[
        'Sets b.deflector = 1 for this turn (decremented at end of turn).',
        'Any projectile that comes within its radius + 0.55 of the body is reversed (vx, vy negated), its owner becomes Warden, reflected++, and it continues. The reflected shot can hit its original shooter.']),
    'anchorBolt': dict(kind='Projectile', detail=['speedMul 1.05, radius 0.9, dmg 45, effect {rooted: 2} (no jump next turn).']),
    'updraft': dict(kind='Jump then projectile rain', detail=[
        'Normal jump with vertical speed doubled (vyMul 2); sets updraftPending.',
        'At the apex (vy >= 0) spawns `missiles` (5) rain projectiles straight down with dx spread -0.5 .. +0.5, power 0.75, kind rain, dmg 18, radius 0.9, body 0.16.',
        'Blocked while Frozen or Rooted.']),
    'galeShot': dict(kind='Instant cone', detail=[
        'Cone of half-angle 30 degrees, reach 15, from the caster along the aim.',
        'Each enemy inside: 20 damage (label "Gale"), then a shove of 20 x knockMul(target) x brace along the aim, plus -2.5 vertical. brace = max(0.25, 1 - max(0, velocityIntoWind)/16), so a bot moving into the wind resists.',
        'Projectiles in the cone get +20 velocity along the aim; power-ups slide 3.5 units along the aim (clamped inside the map, dropped to ground).']),
    'blinkStrike': dict(kind='Point-target teleport then shards', detail=[
        'Player taps anywhere; arrival = nearest spot to the tap where the body outline fits in open air (ring search up to 6 units; clamped inside the arena and above the kill floor). AI aims use the legacy rule: walk along the aim line up to 60% of map width x power until terrain.',
        'Caster is placed there with zero velocity, airborne.',
        'Then `shards` (3) projectiles at angle offsets -14, 0, +14 degrees, speedMul 0.85, dmg 8, radius 0.8, body 0.14, excludeSelf on impact. Shards aim at the nearest enemy within 9 units of the arrival point (dy lifted by 0.15, power 0.35 + d/12); otherwise along the original aim.',
        'Blocked while Frozen or Rooted.']),
    'toxicBomb': dict(kind='Projectile with cloud', detail=[
        'No blast damage. On impact leaves a toxic field {r: 2.4, turns: 1}.',
        'While the turn resolves the field ticks every 0.4 s: every bot inside takes 5 (label "Toxic", credited to the owner), at most 7 ticks per bot (35 max). The cloud is removed at end of turn.']),
    'pinball': dict(kind='Projectile with bounces', detail=[
        'Secondary parameter: bounce count 1..4 (default 4), shown as a button during planning.',
        'Projectile body r 0.3 (sp.r), dmg 35, radius 0.9. On terrain contact while bounced < bounces: reflect velocity with 1.85x restitution and continue. Final impact damage = dmg + 5 x bounces taken.']),
    'splitShot': dict(kind='Projectile that splits', detail=[
        'When vertical velocity crosses from up to down (apex), the shot splits into 4 children at angle offsets -32, -11, +11, +32 degrees with speed x1.1, body 0.14, life 5 s. Each child explodes for 15 / radius 0.8.']),
    'singularity': dict(kind='Projectile with pull field', detail=[
        'No blast damage. On impact sets the world singularity {x, y, r: 9.1, t: 2.6 s}.',
        'Every step, every living bot within r (and farther than 0.3) is accelerated toward the point at 16 units/s^2 and feels only half gravity. The turn cannot end while the pull is active.']),
    'shockwave': dict(kind='Instant self blast', detail=['explode at the caster: dmg 50, radius 5, knock 2.5, excludeSelf. Hits allies too unless friendly fire is off (then 0 damage but still counted as a blast on them with knockback).']),
}
PASSIVE_IMPL = {
    'bulwark': 'knockMul(b) returns 0 while b.wallImmune (set each resolve to "any wall with owner == Bulwark exists").',
    'magmaw': 'addEffect ignores burn for Magmaw; burning patches skip Magmaw. Kill floor of type lava: the first contact per turn sets vy = -15, lifts the body above the floor, lavaImmune = 2 turns, emits lavaSurf. Later contacts that turn, or while lavaImmune is active, kill normally.',
    'volt': 'spawnProjectile multiplies missile speed by 1.15 when the owner is Volt and kind is missile.',
    'warden': 'applyDamage multiplies by 0.8 when src.fromAbove (projectile vy > 2 at impact).',
    'skyla': 'Wind acceleration on airborne bots (windX x 0.25 per second) is skipped for Skyla. Gale pushes still apply.',
    'phantom': 'On a kill, killer.cdBonus = 1; the next special cast uses cd = max(1, sp.cd - 1) and clears the bonus.',
    'ricochet': 'doJump sets bounceLeft = 1; on terrain contact while airborne with |vn| > 3 the body rebounds with restitution 0.65 and bounceLeft is consumed.',
    'gravitas': 'knockMul(b) returns the heavy factor (0.6) although weight is medium (jump 1.0x, mass 1.0).',
}
WEIGHT = {'light': (1.18, 1.3, 0.7), 'medium': (1.0, 1.0, 1.0), 'heavy': (0.86, 0.6, 1.6)}
GUIDE = {'low': 0.3, 'medium': 0.55, 'high': 0.85}

def hull_extents(pts):
    xs = [p[0] for p in pts]; ys = [p[1] for p in pts]
    return min(xs), max(xs), min(ys), max(ys)

def bot_md(b):
    bid = b['id']; j, k, mass = WEIGHT[b['weight']]
    l, r, t, bo = hull_extents(HULLS[bid])
    out = [f"## {b['name']} (`{bid}`)", '', f"*{b['cls']}.* {b['desc']}", '',
           '| Stat | Value |', '|---|---|',
           f"| HP | {b['hp']} |", f"| Weight | {b['weight']} (jump x{j}, knockback taken x{k if bid != 'gravitas' else 0.6}, mass {mass}) |",
           f"| Accuracy | {b['accuracy']} (aim guide shows {int(GUIDE[b['accuracy']]*100)}% of the flight) |",
           f"| Colour | `{b['color']}` |", f"| Body outline | width {l:.2f} .. {r:.2f}, height {t:.2f} .. {bo:.2f} (world units, centre at 0,0, facing right) |", '',
           f"**Passive: {b['passive']}**  ", f"Implementation: {PASSIVE_IMPL[bid]}", '']
    for slot in ('s1', 's2'):
        s = b[slot]; impl = IMPL[s['id']]
        nums = {k2: v for k2, v in s.items() if k2 not in ('id', 'name', 'desc', 'cd', 'target', 'param')}
        out += [f"### {slot.upper()}: {s['name']} (`{s['id']}`)", '',
                f"- Cooldown: {s['cd']} turns (fast cooldowns setting: {max(1, s['cd']-1)}).",
                f"- Kind: {impl['kind']}." + (' Target: point on the map (tap/drag), not an aim vector.' if s.get('target') == 'point' else ''),
                f"- Numbers: `{json.dumps(nums)}`" if nums else '- Numbers: none beyond cooldown.',
                f"- In-game text: {s['desc']}"]
        if s.get('param'): out.append(f"- Secondary parameter: {s['param']['name']} {s['param']['values']} (default {s['param']['default']}).")
        out += ['- How it resolves:'] + [f"  - {d}" for d in impl['detail']] + ['']
    return '\n'.join(out)

bots_doc = ['# 03. Bots', '', 'Generated by `tools/gen_spec.py` from `src/core/defs.js`, `src/core/sim.js` and `src/core/hulls.js`. Every bot has the two universal actions (Jump and Missile, see 02-physics-and-combat.md) plus a passive and two cooldown specials. Cooldowns are set when the special is cast and tick down by 1 at the end of every turn; a special is usable when its counter is 0.', '',
            '## Roster summary', '', '| Bot | Class | HP | Weight | Accuracy | S1 (cd) | S2 (cd) |', '|---|---|---|---|---|---|---|']
for b in BOTS.values():
    bots_doc.append(f"| {b['name']} | {b['cls']} | {b['hp']} | {b['weight']} | {b['accuracy']} | {b['s1']['name']} ({b['s1']['cd']}) | {b['s2']['name']} ({b['s2']['cd']}) |")
bots_doc += ['', '## Weight classes', '', '| Weight | Jump speed multiplier | Knockback taken | Mass (bot-bot collisions) |', '|---|---|---|---|']
for w, (j, k, m) in WEIGHT.items(): bots_doc.append(f"| {w} | {j} | {k} | {m} |")
bots_doc += ['', 'Gravitas is the exception: medium jump and mass, heavy (0.6x) knockback.', '',
             '## Universal actions', '', f"- **Missile**: 25 damage, blast radius 1.0, speed {PHYS['missileSpeed']} x power x {PHYS['missileSpeedMul']} (= {PHYS['missileSpeed']*PHYS['missileSpeedMul']:.2f} units/s at full power), knock {PHYS['missileKnock']}x, projectile body radius 0.18, gravity 1x, affected by wind.",
             f"- **Jump**: launch speed {PHYS['jumpSpeed']} x power x weight multiplier along the aim; vertical component is at least 2 upward. Thrusters power-up multiplies by sqrt(1.75).", '',
             '## Per-bot specification', '']
for b in BOTS.values(): bots_doc.append(bot_md(b))
bots_doc += ['## Body outlines (collision and hit shapes)', '', 'Each bot collides and is hit using a single convex polygon traced from its painted sprite (`src/core/hulls.js`, generated by `tools/gen_hulls.py`). Points are in world units relative to the bot centre, facing right; the sim mirrors them when the bot faces left. The same polygon is used for terrain collision, bot-bot collision, projectile hits, blast radius tests, mines, pads, power-ups, fields and the kill floor.', '']
for bid, pts in HULLS.items(): bots_doc.append(f"- `{bid}`: {json.dumps(pts)}")
open(os.path.join(OUT, '03-bots.md'), 'w').write('\n'.join(bots_doc) + '\n')

# ---------------- maps ----------------
HZ_TEXT = {
    'risingLava': lambda h: f"**Rising lava** every {h['every']} turns (from turn {h['every']}): the kill floor rises by {h['amount']} units. Warning banner the turn before. Resets on Sudden Death.",
    'geyser': lambda h: f"**Geysers** every {h['every']} turns: the turn before, {h['count']} of the points {h['points']} are chosen and shown as warnings; on the hazard turn they erupt at the start of the resolve: {h['dmg']} damage and an upward launch (vy -12, vx += (x - gx) x 3) to any bot whose outline is within radius {h['radius']}.",
    'lavaPatch': lambda h: f"**Burning ground** every {h['every']} turns (from turn {h['every']}): a patch {h['w']} wide appears on a random walkable surface, lasts {h['turns']} turns, deals {h['dmg']} on first contact per turn per bot (Magmaw immune).",
    'gusts': lambda h: f"**Gust** every {h['every']} turns: windX is set to +/-{h['strength']} (random side) for that turn only, 0 otherwise; warning the turn before. Wind accelerates airborne bots by windX x 0.25 per second and projectiles by windX x 0.6 per second. Skyla ignores the bot push.",
    'wind': lambda h: f"**Wind** every turn: windX random in [-{h['max']}, {h['max']}], announced.",
    'mines': lambda h: f"**Spike mines** every {h['every']} turns (from turn {h['every']}): one mine is planted on a random walkable surface (warning the turn before). Mines accumulate. A bot whose outline comes within 0.45 of a mine, or a projectile within its body radius + 0.45, detonates it: {h['dmg']} damage, radius {h['radius']}, knock 1.3x. Detonated timed mines do not respawn.",
    'crusher': lambda h: f"**{h.get('label','Crusher')}** every {h['every']} turns over the zone x {h['x']}..{h['x']+h['w']}, y {h['top']}..{h['bottom']}: the zone is shown as a warning the turn before and as danger on the hazard turn; at the start of that resolve every bot overlapping the zone takes {h['dmg']} and is shoved sideways (6) and down (3).",
    'reactor': lambda h: f"**{h.get('label','Reactor pulse')}** every {h['every']} turns centred at ({h['x']}, {h['y']}) radius {h['r']}: warning the turn before; at the start of the hazard resolve every bot inside takes {h['dmg']} and is pushed radially outward at 7 with a 2 lift.",
}
def map_md(m):
    out = [f"## {m['name']} (`{m['id']}`)", '', f"*{m['blurb']}*", '',
           '| Property | Value |', '|---|---|',
           f"| Theme | {m['theme']} |", f"| Size class | {m['size']} |", f"| Dimensions | {m['width']} x {m['height']} units |",
           f"| Players | {m['minPlayers']} to {m['maxPlayers']} (recommended {m['recommended']}) |",
           f"| Kill floor | {m['killFloor']['type']} at y = {m['killFloor']['y']} |",
           f"| Edges | {'looped: leaving one side enters the other (bots and projectiles); the arrival is lifted onto the surface if it lands inside terrain' if m.get('teleporters') else 'solid: bots stop at x = 0 and x = width with 0.3 restitution; projectiles leave the map beyond 1 unit outside'} |", '',
           '**Terrain rectangles** (x, y, w, h; y grows downward):', '', '| x | y | w | h |', '|---|---|---|---|']
    for r in m['terrain']: out.append(f"| {r['x']} | {r['y']} | {r['w']} | {r['h']} |")
    if m.get('slopes'):
        out += ['', '**Slopes** (right triangles; x, y is the top-left of the bounding box; dir 1 rises toward +x, -1 toward -x):', '', '| x | y | w | h | dir |', '|---|---|---|---|---|']
        for s in m['slopes']: out.append(f"| {s['x']} | {s['y']} | {s['w']} | {s['h']} | {s['dir']} |")
    out += ['', f"**Spawn pads** (8, picked evenly spaced for fewer players): {json.dumps(m['spawns'])}", '', f"**Power-up points**: {json.dumps(m['powerups'])}", '']
    if m.get('pads'): out += ['**Teleporter pads** (touching one flings the bot to `to` with zero velocity; 0.8 s cooldown):'] + [f"- ({p['x']}, {p['y']}) to {p['to']}" + (f" ({p['label']})" if p.get('label') else '') for p in m['pads']] + ['']
    if m.get('mines') is not None: out += [f"**Starting mines**: {m['mines'] if m['mines'] else 'none (mines arrive via the timed hazard)'}", '']
    out += ['**Hazards**:'] + [f"- {HZ_TEXT[h['type']](h)}" for h in m.get('hazards', [])] + ['']
    return '\n'.join(out)

maps_doc = ['# 05. Maps', '', 'Generated by `tools/gen_spec.py` from `src/core/maps.js`. Units are bot widths; (0, 0) is the top-left; y grows downward. Every map is a set of solid rectangles plus optional slope triangles, 8 spawn pads, power-up points, a kill floor, hazards, and optional teleporter pads and starting mines. Standard maps are 30 wide for 2 to 4 players; Battle maps are 46 to 50 wide for up to 8.', '',
            '## Map list', '', '| Map | Theme | Size | Players | Kill floor | Looped edges | Hazards |', '|---|---|---|---|---|---|---|']
for m in MAPS.values():
    maps_doc.append(f"| {m['name']} | {m['theme']} | {m['size']} | {m['minPlayers']}-{m['maxPlayers']} | {m['killFloor']['type']} | {'yes' if m.get('teleporters') else 'no'} | {', '.join(h.get('label') or h['type'] for h in m.get('hazards', []))} |")
maps_doc += ['', '## Theme kits', '', 'Each theme defines the procedural palette (used when painted art is missing) and the kill floor type. Painted backgrounds and terrain kits are registered per map in `art/maps/bg/manifest.json` and `art/maps/terrain/manifest.json` (see 09-rendering-and-art-pipeline.md).', '',
             '| Theme | Kill floor | Sky | Floor colour | Accent |', '|---|---|---|---|---|']
for t in THEMES.values(): maps_doc.append(f"| {t['name']} (`{t['id']}`) | {t['floor']} | {t['sky'][0]} to {t['sky'][1]} | {t['floorColor']} | {t['accent']} |")
maps_doc += ['', '## Spawn selection', '', '`pickSpawns(map, n)` returns the first n pads when n >= 8, else pads at indices round(i x 7 / (n - 1)) so players spread across the map. In Teams mode the roster is sorted by team first so teammates get adjacent pads. Before turn 1 every bot is dropped straight down from its pad until it rests on terrain (`settle`).', '',
             '## Per-map data', '']
for m in MAPS.values(): maps_doc.append(map_md(m))
open(os.path.join(OUT, '05-maps.md'), 'w').write('\n'.join(maps_doc) + '\n')

print('wrote 03-bots.md, 05-maps.md')
