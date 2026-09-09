# Art

- `reference/` — high-resolution renders of the live bot rigs, plus silhouette
  control maps. Generated, not hand-made: re-run `node tools/refpack.mjs` after
  any rig change. These are inputs to art production, not shipped assets.
- `PROMPTS.md` — the generation pack: house style suffix, negative prompt, and a
  per-bot subject prompt.
- `sprites/` — finished art drops here. Missing files fall back to the vector
  rigs, so a partial set never breaks the build.
