# 09. Rendering and art pipeline

Rendering is a single 2D canvas (`src/render/renderer.js`) drawn every frame at device pixel ratio up to 2. Everything visual is optional art plus procedural fallbacks: a missing painting never breaks the game.

## Draw order per frame

1. Painted background (parallax 0.25, anchored to the bottom) or the procedural themed backdrop.
2. Screen shake offset (decays at 3 per second).
3. Kill floor (lava, water, void or neon), hazard overlays for announced zones, circles and points.
4. Terrain: painted kit tiles (top strip and face texture per rectangle with lift, outline, and theme extras: icicles and snow caps on ice, grass and vines on jungle, cloud puffs on sky, underglow on neo) or themed procedural slabs; slopes are drawn as triangles with the same kit.
5. Looped-edge markers or solid walls.
6. Mines, burning patches, static fields (crackling arcs), toxic clouds, singularity swirl, power-ups (icons with colour), Bastion walls, teleporter pads.
7. Bots (see rigs below) with nameplates, ready tags, deflector domes, shadows.
8. Projectiles with glow and trail; bombs with a red marker.
9. Flashes: lightning beams, cones, fireballs, rings, spike stars, crusher slab animation.
10. Painted VFX sprites if any sheets are loaded (optional layer).
11. Particles (squares and rotating debris chunks).
12. Aim guide, special callouts, floating damage numbers and labels.

## Camera

`cam = {x, y, zoom}` in pixels per unit. Targets: fit map, fit for plan (around the player's bot), frame action (bounding box of live bots and projectiles with margins, zoom between fit and 2.2x fit, or width/18 in portrait), focus. The camera eases toward its target each frame. A kill sets a punch target (1.4x zoom toward the KO point for 1.1 s).

## Bot art

### Painted stills
`art/sprites/bot_<id>_full.png`, 512x512 transparent, bot centred on its alpha centroid, facing right. Registered in `art/sprites/manifest.json` with per-bot `scale` and `dy` so each sits on its collision footprint at the right size for its weight class (heavies drawn taller). Intake: `tools/intake_sprites.py` (batch) or `tools/prep_sprite.py` (one file): keys a flat backdrop by flood fill from the border, trims, scales to 92% of a 512 canvas, centres on the alpha centroid.

### Cut-out rigs (the live animation system)
`src/render/cutout.js`. Each still is split at load time into parts by polygon masks (dilated 5 px so joints overlap): roles `weapon`, `body`, `head`, `legsF`, `legsB`, each with a pivot, drawn back to front in a per-bot order. Poses are tweens in still-pixel units:

- idle: body breathes (2.2 px), head and weapon lag slightly, hover bob and thruster glow for Skyla.
- fire: weapon kicks back by the bot's `recoil` (8 to 30 px) with a brief glow, body and head recoil with a lag, legs brace.
- jump: crouch for the first quarter, then legs tuck (front -0.38 rad, back +0.38), body stretches 5%.
- land: squash pulse (body down 14 px, 10% shorter, 8% wider), legs splay, head dips.
- hit: body knocked back 10 px with a wobble, head whips, weapon lifts.
- death: every part flies on its own ballistic arc with rotation and fades after 65%.
- specials use a per-bot style: `charge` (pull back, glow, thrust and hold), `swing` (underhand lob), `heavyShot` (sink on suspension, big recoil lifting the front), `slam` (deep crouch), `volley` (three bobs), `shield` (head part raises and lights), `rain` (nose up, thrusters flare), `blink` (stretch thin, vanish, re-form), `spin` (full roll), `burst` (compress then every part blasts outward).

Assignments: Bulwark charge / heavyShot; Magmaw slam / volley; Volt charge / swing; Warden shield / heavyShot; Skyla rain / charge; Phantom blink / swing; Ricochet spin / heavyShot; Gravitas charge / burst. Part polygons and pivots for all eight bots are in `CUTOUT` in `cutout.js`; `tools/rigview.html?bot=<id>` previews every state.

A rig overrides painted frame clips; a clip overrides the still; the still overrides the vector rig in `bots.js`. Airborne lean (rotation by vx) and the white hit flash remain procedural on top of any of them.

### Painted frame clips (optional)
`anim_<state>` parts in the sprite manifest: horizontal strips with `frames`, `fps`, `loop`. Intake from videos or contact sheets with `tools/frames_from_video.py` then `tools/intake_anim.py` (keys green, despills, aligns all frames with one transform per bot, writes WebP). Not used by the shipped build since the rigs replaced them, but the pipeline is intact.

## Backgrounds and terrain kits

- `art/maps/bg/manifest.json`: one painted JPEG per map (2048 wide), parallax 0.25, anchored bottom. Intake `tools/intake_backgrounds.py` from `art/maps/raw/`.
- `art/maps/terrain/manifest.json`: per map a `top` strip and a `face` texture (cut from scene paintings, seam-blended), with `tile` and `topTile` sizes in units, `lift` (how far the top strip rises above the collision top), `outline` colour and theme flags. Shared ice kit for both ice maps; sky maps share a face.

## Code-driven effects (`renderer.js`)

- `drawBolt`: jagged lightning between two points with additive glow, white core, and branches; shape re-rolls 12 times per second. Used for Chain Arc beams and Static Field arcs.
- `glowDisc`: additive radial glow. Used on projectiles, beam ends, fireballs, fields.
- Explosion: spike star flash, bold expanding ring with white inner ring, soft disc, layered fireball (six orange lobes, hot core, rising), debris chunks (rotating rectangles with gravity 22), smoke squares, shake 0.5 or 1.1.
- Muzzle: small spike star at the barrel. Jump: dust puffs. Land: dust burst scaled by impact.
- Blink: particle bursts at both ends. Gale: fading cone. Singularity: inward rings. Toxic: drifting green blobs. Deflector: translucent dome on the bot. Reflect: white flash. Teleport pads: rings at both ends. Crusher: slab animation over the zone. Geyser: themed column of particles.
- Damage numbers float up (red and large for 40+); KO label with the bot's name; special callouts (icon plus name) rise over the caster.
- Kill drama: camera punch, 0.22x slow motion for 0.75 s; 0.08x hit-stop for 90 ms on 40+ hits.

## Optional painted VFX sheets

`src/render/vfx.js` loads `art/vfx/manifest.json` strips (frames, fps, size in units, additive or normal blend, loop) and maps events to keys: explosion, explosion_big, muzzle, land_dust, jump_dust, blink_out, blink_in, gale, singularity, toxic_cloud, reflect, deflector, molten_patch, teleport_out, teleport_in, mine_blast, geyser, wall_break, shockwave, and `cast_<specialId>` per special. When a key is present the painted sprite replaces the procedural effect; otherwise the procedural one draws. Intake `tools/intake_vfx.py`.

## Icons

`src/render/icons.js` draws power-up icons and action icons (jump, missile, each special) procedurally in the move's accent colour; used on the action bar, the aim guide end marker, callouts and the Botpedia.

## Single-file build

A build script bundles `src/main.js` with esbuild into an IIFE and inlines the sprite manifest and images, backgrounds, terrain kits and VFX sheets as data URIs under `window.__SUPERBOTS_SPRITES`, `__SUPERBOTS_BG`, `__SUPERBOTS_TERRAIN`, `__SUPERBOTS_VFX`, producing one HTML file (about 6 MB) that runs from any host without fetches. The loaders check these globals first and fall back to fetching from `art/` when served normally.

## Art direction summary

Chunky painted cartoon robots with thick outer outlines, two-tone cel shading plus one soft gradient, warm key light upper left, cool rim light lower right. Each bot has one signature colour and one read (Bulwark's cannon, Warden's shield, Volt's rifle line). Backgrounds are painted scenes per map; terrain is cut from the same paintings so blocks match the scene. Effects are saturated and additive. The full production notes for animation are in `art/ANIMATION_BIBLE.html` and generation prompts in `art/PROMPTS.md` and `art/MAP_PROMPTS.md`.
