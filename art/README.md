# Art

- `reference/` — high-resolution renders of the live bot rigs, plus silhouette
  control maps. Generated, not hand-made: re-run `node tools/refpack.mjs` after
  any rig change. These are inputs to art production, not shipped assets.
- `PROMPTS.md` — the generation pack: house style suffix, negative prompt, and a
  per-bot subject prompt.
- `sprites/` — finished art drops here. Missing files fall back to the vector
  rigs, so a partial set never breaks the build.

## Dropping finished art into the game

1. Clean and normalise the raw generated file:

   ```
   python3 tools/prep_sprite.py ~/Downloads/bulwark.png bulwark --part full
   ```

   It strips a flat backdrop by flood-filling inward from the border, so white
   highlights inside the artwork survive. Then it trims, scales, and centres on a
   512 square. Add `--pivot-x 0.42` when a long barrel drags the bounding-box
   centre off the chassis, so the bot sits on its collision centre rather than
   floating to one side.

2. Register it in `art/sprites/manifest.json`:

   ```json
   { "bulwark": { "full": { "file": "bot_bulwark_full.png", "scale": 1.34, "dy": 0 } } }
   ```

   `scale` 1.34 matches the footprint of a rig rendered by `tools/refpack.mjs`.
   Nudge `scale` and `dy` until the bot sits right; no code change needed.

3. Reload. Any bot without an entry keeps its vector rig, so a partial art set
   is always safe.

## Batch intake

Drop every raw render into `art/sprites/raw/` named after its bot (`magmaw.png`,
`volt.png`, or anything containing the bot id), then run one command:

```
python3 tools/intake_sprites.py
```

Each file is background-stripped, trimmed, centred on its alpha-weighted
centroid, and registered in the manifest. Existing `scale` and `dy` tuning is
preserved, so re-running after a re-generation will not undo hand adjustments.

Bot ids: bulwark, magmaw, volt, warden, skyla, phantom, ricochet, gravitas.

## Asking for map changes

Two different kinds of change, two different routes.

**Layout and gameplay** (platform positions, gaps, pits, spawns, hazards,
power-up spots) live in `src/core/maps.js`. These need no prompt at all. Describe
the change in plain words and it gets edited directly.

To point at an exact spot, use the coordinate grids in
`art/reference/maps/grid/`. The game's world units are what the code uses, so a
request phrased in grid coordinates maps straight onto the data:

> On Ember Pit, move the ledge at x 2-6, y 9 up to y 7, and widen it to 5 wide.

Regenerate the grids after any layout edit:

```
python3 -m http.server 8123 --directory .
node tools/gridrender.mjs
```

**Theme art** (how a map looks rather than how it plays) is regenerated in
Scenario from `art/MAP_PROMPTS.md`. Change the theme's prompt, regenerate the
affected layer, and drop it into `art/maps/raw/`. One theme change affects both
maps that share it.

## Painted map backgrounds

Drop a background into `art/maps/bg/` and register it:

```json
{ "emberpit": { "file": "bg_emberpit.png", "parallax": 0.25, "anchor": "bottom" } }
```

`parallax` is how far the painting slides against the camera: 0 locks it in
place, 1 moves it with the world. `anchor` pins it to the bottom or centres it.
The image is cover-fitted and repeated horizontally, so a wide map never runs
past its edge. Any map without an entry keeps its procedural backdrop.

**The background must contain no platforms.** In game, platforms are collision
rectangles drawn from coordinates in `src/core/maps.js`, on top of the
background. A backdrop with platforms painted into it shows those painted shapes
behind the real ones, which reads as a doubled, misaligned mess. Platform art
belongs in the terrain kit, not the background.

### Batch intake for backgrounds

Drop the clean, platform-free paintings into `art/maps/raw/` named after their
map (`bg_emberpit.png`, `magmaworks background.jpg`, anything containing the map
id), then:

```
python3 tools/intake_backgrounds.py
```

Each is resized to 2048 wide, saved as JPEG so it stays small enough to inline
into the single-file build, and registered with a default parallax of 0.25.

## Painted terrain kits

A map listed in `art/maps/terrain/manifest.json` draws its platforms with painted
tiles instead of the procedural theme painter:

```json
{ "emberpit": { "top": "lava_ember_top.jpg", "face": "lava_ember_face.jpg",
                "tile": 3.2, "topTile": 3.0, "lift": 0.25 } }
```

- `top` is the surface crust strip, repeated along the top edge of every platform
  and along the surface of every slope.
- `face` is the body texture, repeated in both directions under the crust.
- `tile` / `topTile` are how many world units one repeat spans; bigger numbers
  make the blocks look larger.
- `lift` is how far the crust rises above the collision surface.

Both pieces must tile seamlessly on their left and right edges (`face` on top and
bottom too). The current lava kits were cut out of the two Scenario scene
paintings in `art/maps/raw/` (`Lava2-4.png` for Ember Pit, `Lava4-8.png` for
Magma Works) with a seam-blend pass. The ice kits add `snowCap` (a scalloped white mound drawn over the top edge)
and `icicles` (a fringe under every platform), with `outline` set to navy. The
jungle kits use `grass` (blades along the top edge) and `vines` (hanging under
wide platforms). The sky kits use `clouds` (white puffs under wide platforms) and the neo kits
`underglow` (a cyan light strip along the bottom edge). All ten maps now have a
painted background and a painted kit.
Maps without an entry keep the procedural look, so themes can be converted one
at a time.

