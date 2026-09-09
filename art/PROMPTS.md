# Bot art generation pack

Everything here exists to turn `art/reference/*.png` into finished sprites at a
consistent quality. Regenerate the references any time a rig changes:

```
python3 -m http.server 8123 --directory .      # serve the repo
node tools/refpack.mjs                          # re-render all 24 reference images
```

## What each reference file is for

| File | Use |
| --- | --- |
| `bot_<id>_color.png` | Image-to-image base, and the reference you send a human artist |
| `bot_<id>_silhouette.png` | ControlNet conditioning map, locks the pose and proportions |
| `bot_<id>_pose-fire.png` | Second pose, shows how the weapon and body move when firing |

All are 1024 x 1024, transparent background, bot centred and facing right.

## House style suffix

Append this to every bot prompt. It is the whole reason eight separately
generated bots will look like one roster.

```
2D game sprite, side view facing right, painted cartoon style, thick dark
outline on the outer silhouette only, cel shaded with two tones and one soft
gradient, warm key light from upper left, cool rim light along the lower right
edge, saturated colours, chunky silhouette that reads at small size, small
armoured pilot visible in the cockpit, mechanical panel detail, transparent
background, centred, full body, no ground shadow
```

## Negative prompt

```
photorealistic, 3D render, blurry, soft focus, painterly noise, textured brush
strokes, drop shadow, background scenery, environment, text, watermark, logo,
multiple characters, cropped, cut off, extra limbs, motion blur
```

## Per-bot subject prompts

Each line goes before the house style suffix. The hex value is the bot's
dominant hue and must be preserved, because the nameplate, trajectory dots and
particle colours in game are all keyed to it.

**Bulwark** &mdash; `#4f7cff` deep blue, heavy weight class
```
a heavy armoured siege tank robot, wide blocky riveted chassis, thick frontal
bulldozer plating, dual heavy treads, a stubby large-bore cannon, deployable
shield panels folded on the hull, deep blue and gunmetal, built to hold a line
```

**Magmaw** &mdash; `#ff5a1f` molten orange, heavy weight class
```
a beast-machine with a huge hinged toothed jaw at the front, spiked armour
ridge along its back, glowing molten furnace core in the chest, scorched metal
plating, heavy clawed tracks, orange and charred brown, radiating heat
```

**Volt** &mdash; `#ffe23a` electric yellow, medium weight class
```
a precise marksman robot, slim tall frame, long rail cannon with copper coils
and a scope, exposed crackling electrical conduits, insulated hazard plating,
antenna array, bright yellow and matte black, clean and technical
```

**Warden** &mdash; `#3ddc97` emerald, medium weight class
```
a defender robot, rounded fortress body, a large curved energy shield emitter
on one arm, magnetic anchor harpoon launcher on the other, heavy stabiliser
feet, emerald green and brushed steel, calm and immovable
```

**Skyla** &mdash; `#8fd3ff` sky blue, medium weight class
```
an aerial robot, sleek aerodynamic fuselage, swept wings and a tail fin,
downward thruster nozzles glowing beneath, air intake vents, lightweight
plating, pale sky blue and white with orange accents, poised to lift off
```

**Phantom** &mdash; `#c46bff` violet, light weight class
```
a stealth assassin robot, narrow angular frame, twin energy blades, hooded
sensor visor, phase coils along the limbs emitting violet mist, minimal
plating for speed, violet and dark charcoal, half dissolving into vapour
```

**Ricochet** &mdash; `#ff4fa3` hot pink, light weight class
```
a trickster robot on one large spherical wheel, compact round body, angled
deflector plates and bumpers, a stubby wide-bore launcher, pinball flipper
detailing, hot pink and chrome, springy and off balance
```

**Gravitas** &mdash; `#9aa4b8` gunmetal, medium weight class
```
a gravity control robot, heavy central hovering orb suspended in a ring
cradle, articulated support struts instead of wheels, distortion lensing
around the core, weathered gunmetal grey with deep indigo energy, ominous
```

## Recommended generation settings

**ControlNet route, the reliable one.** Load `bot_<id>_silhouette.png` as a
ControlNet conditioning image using the scribble or lineart preprocessor, weight
around 0.7 to 0.9. This locks proportions so the generated bot still fits the
collision box and the four-part split still works.

**Image-to-image route.** Use `bot_<id>_color.png` at denoising strength 0.55 to
0.7. Lower keeps your existing shapes and colours, higher gives the model more
freedom. Start at 0.6.

**Style-trained route, the best result.** Generate one bot you are happy with,
then train a style model on it in a game-asset tool and generate the remaining
seven through that model. This is the only route that makes all eight genuinely
match rather than approximately match.

## After generation

1. Remove the background and check the alpha edge is clean, not haloed.
2. Split into the four parts named in the pipeline spec: body, weapon, drive, head.
3. Save each part on its own 512 x 512 transparent canvas, bot centred.
4. Name them `bot_<id>_<part>.png` and drop into `art/sprites/`.
