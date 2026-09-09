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
