# Map art generation pack

Maps split into two asset classes that behave nothing alike:

- **Backgrounds, one per map.** A single painted image each, so all ten maps get
  their own. That is what lets Ember Pit read as a volcano interior and Magma
  Works as a foundry even though both are lava. Must tile horizontally.
- **Terrain kits, one per theme.** Tiles repeat across a map and must butt
  together seamlessly, so the two maps sharing a theme share one kit of six
  pieces. They also have to line up with collision rectangles the engine already
  owns, which makes them the fussier half.

Ten backgrounds plus five kits of six pieces is 40 assets. Layout references for
every map are in `art/reference/maps/`, with coordinate grids under `grid/`.

## Background style suffix

Append to every background prompt below.

```
game background art for a 2D side-scrolling platformer, painted cartoon style,
soft atmospheric depth with distance desaturating toward the sky colour, clean
readable shapes, no characters, no platforms, no foreground ground line, no
text, seamless horizontal tiling, wide 16:9 composition
```

## Terrain style suffix

Append to every terrain kit prompt.

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


## Terrain kit prompts

**Lava** &mdash; Ember Pit, Magma Works
```
charred black basalt rock platform, molten cracked crust along the top surface with glowing orange seams, dark brittle stone body, brittle chipped edges
```
**Ice** &mdash; Frozen Keel, Glacier Fortress
```
translucent blue ice slab platform, thick fresh snow cap along the top surface, crystal facets inside the ice body, icicles hanging from the underside
```
**Jungle** &mdash; Canopy Ruins, Temple Crossing
```
weathered grey temple stone block platform, thick moss and grass cap along the top surface, carved stone seams and cracks, small vines trailing from the underside
```
**Sky** &mdash; Cloud Steps, Nimbus Reach
```
floating island platform, warm sandstone rock body tapering to a point beneath, bright green grass cap along the top surface, small cloud puffs clinging to the underside
```
**Neo City** &mdash; Neon Alley, Skyline Grid
```
dark metal industrial platform, riveted panel body with tread plate texture, yellow and black hazard stripe cap along the top surface, cyan light strip glowing along the underside
```

## Terrain piece breakdown

Generate each theme's kit as one wide strip, then cut into six pieces. Generating
the pieces separately gives edges that do not match, and mismatched edges show on
every platform in the game rather than in one place:

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
- Naming: `bg_<map>.png`, `terrain_<theme>_<piece>.png`.
- Map ids: `emberpit`, `magmaworks`, `frozenkeel`, `glacierfort`, `canopyruins`,
  `templecrossing`, `cloudsteps`, `nimbus`, `neonalley`, `skylinegrid`.
- Theme ids: `lava`, `ice`, `jungle`, `sky`, `neo`.

Drop everything into `art/maps/raw/` and I will wire it in.
