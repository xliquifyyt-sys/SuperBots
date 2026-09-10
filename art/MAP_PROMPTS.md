# Map art generation pack

Maps are not sprites. A bot is one image; a map is a **theme**, and every theme
needs two different kinds of asset:

- **3 background layers** — single painted images, far to near, scrolling at
  different parallax speeds. Must tile horizontally so the scroll never seams.
- **6 terrain pieces** — the platform tile set. These must tile and must line up
  with collision rectangles the engine already owns, so they are the fussier half.

Five themes, so 15 background layers and 30 terrain pieces, 45 assets total.
Two maps share each theme, which is why theme art is the unit of work rather
than map art. Layout references for all ten maps are in `art/reference/maps/`.

## Background style suffix

Append to every background layer prompt.

```
game background art for a 2D side-scrolling platformer, painted cartoon style,
soft atmospheric depth with distance desaturating toward the sky colour, clean
readable shapes, no characters, no platforms, no foreground ground line, no
text, seamless horizontal tiling, wide 16:9 composition
```

## Terrain style suffix

Append to every terrain piece prompt.

```
2D game terrain tile, painted cartoon style, thick dark outline on the outer
silhouette, cel shaded with two tones, brightly lit top surface and a darker
front face with a hard edge between them, orthographic side view, seamless
horizontal tiling on the left and right edges, transparent background, no
characters, no text
```

## Negative prompt

Same for both classes, unchanged across every run.

```
photorealistic, 3D render, blurry, soft focus, painterly noise, drop shadow,
characters, robots, vehicles, text, watermark, logo, perspective distortion,
vanishing point, tilted horizon, cropped
```

---

## Background prompts, one per map

### Ember Pit  `emberpit`  &mdash; lava kit
```
the inside of an active volcano, a single vast cone rising from a lava lake, glowing fissures webbing the crater walls, thick ember haze, deep red-black rock against a dull orange glow from below
```

### Magma Works  `magmaworks`  &mdash; lava kit
```
the interior of a colossal iron foundry, blast furnaces and smelting towers, steel gantries and catwalks, channels of molten metal running between them, soot-stained girders, orange light and drifting smoke
```

### Frozen Keel  `frozenkeel`  &mdash; ice kit
```
a glacier cavern opening onto black freezing water, immense pale blue ice cliffs on both sides, icicles hanging from an unseen ceiling, cold white light diffusing through the ice, still water reflecting it
```

### Glacier Fortress  `glacierfort`  &mdash; ice kit
```
the interior of a vast fortress carved from glacier ice, ramparts and buttresses cut into blue ice walls, frozen arches, tattered frost-covered banners, faint green aurora light bleeding through the ceiling
```

### Canopy Ruins  `canopyruins`  &mdash; jungle kit
```
the interior of a towering rainforest, immense buttressed tree trunks receding into teal mist, a dense layered canopy far overhead, shafts of green light falling between the trunks, hanging creepers
```

### Temple Crossing  `templecrossing`  &mdash; jungle kit
```
an overgrown temple clearing deep in the jungle, ruined carved stonework half swallowed by roots, distant stepped ziggurats fading into warm green mist, shafts of sunlight, drifting spores
```

### Cloud Steps  `cloudsteps`  &mdash; sky kit
```
a bright open sky high above the world, soft cumulus banks stacked into the distance, small floating rock islands scattered far away, warm sunlight, pale blue fading to white near the horizon
```

### Nimbus Reach  `nimbus`  &mdash; sky kit
```
the high altitude sky, towering thunderhead cloud columns catching golden light, distant chains of floating islands, wind-streaked cirrus, deep blue above fading to pale gold at the horizon
```

### Neon Alley  `neonalley`  &mdash; neo kit
```
a narrow cyberpunk alley at night, walls crowded with layered neon signage in kanji and glyphs, fire escapes and tangled cables, steam venting from grates, magenta and cyan light on wet brick
```

### Skyline Grid  `skylinegrid`  &mdash; neo kit
```
a cyberpunk city seen from rooftop level at night, distant tower blocks with grids of lit windows, enormous holographic billboards, sagging power cables crossing the view, falling rain lit magenta and cyan
```

## Terrain piece breakdown

Generate the terrain set as one wide strip per theme, then cut into six pieces:

| Piece | What it is |
| --- | --- |
| `left` | The left end cap, with a finished outer edge |
| `mid` | The tileable middle. Its left and right edges must match each other |
| `right` | The right end cap |
| `top` | The surface material strip, cap alone |
| `face` | The front face texture, body alone |
| `trim` | The hanging decoration: icicles, vines, cables, cloud puffs |

## Delivery

- Backgrounds: 2048 x 1152 PNG or JPEG, horizontally tileable.
- Terrain: PNG with alpha, one-unit tile at 256 x 256.
- Naming: `bg_<theme>_<far|mid|near>.png`, `terrain_<theme>_<piece>.png`.
- Theme ids: `lava`, `ice`, `jungle`, `sky`, `neo`.

Drop everything into `art/maps/raw/` and I will wire it in.
