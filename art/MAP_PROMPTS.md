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

## Lava — Ember Pit, Magma Works

**Far layer**
```
a vast volcanic cavern wall, distant jagged rock spires in silhouette, deep
ember red and near black, faint heat haze rising, dim orange glow from below
```
**Mid layer**
```
cracked basalt cliff faces with glowing orange fissures running through them,
iron scaffolding and hanging chains, industrial foundry structures, charred
brown rock and molten seams
```
**Near layer**
```
foreground volcanic rock pillars and hanging chains framing the screen edges,
almost black silhouettes with rim lighting from below, drifting ember sparks
```
**Terrain set**
```
charred black basalt rock platform, molten cracked crust along the top surface
with glowing orange seams, dark brittle stone body, brittle chipped edges
```

## Ice — Frozen Keel, Glacier Fortress

**Far layer**
```
a pale blue glacier cavern wall, enormous soft ice spikes hanging from above and
rising from below, cold white light diffusing through the ice
```
**Mid layer**
```
saturated cyan ice formations, a huge diagonal glacier sheet crossing the scene,
a frozen waterfall, crystalline facets catching light
```
**Near layer**
```
dark teal ice spikes framing the screen edges, deep blue shadowed ice, drifting
snow particles
```
**Terrain set**
```
translucent blue ice slab platform, thick fresh snow cap along the top surface,
crystal facets inside the ice body, icicles hanging from the underside
```

## Jungle — Canopy Ruins, Temple Crossing

**Far layer**
```
misty teal rainforest depth, distant tree trunks fading into haze, shafts of
green light, dense canopy silhouette high above
```
**Mid layer**
```
dense green jungle foliage, hanging vines and creepers, weathered stone temple
ruins half swallowed by growth, warm green and jade
```
**Near layer**
```
dark foreground jungle leaves and hanging vines framing the screen edges, deep
green silhouettes, drifting spores
```
**Terrain set**
```
weathered grey temple stone block platform, thick moss and grass cap along the
top surface, carved stone seams and cracks, small vines trailing from the
underside
```

## Sky — Cloud Steps, Nimbus Reach

**Far layer**
```
a bright open sky, soft cumulus cloud banks in the distance, warm sunlight, pale
blue fading to white near the horizon
```
**Mid layer**
```
large billowing cloud formations, distant floating rock islands with green tops,
soft golden light on the cloud tops
```
**Near layer**
```
wispy foreground clouds drifting across the screen edges, translucent white,
soft edges
```
**Terrain set**
```
floating island platform, warm sandstone rock body tapering to a point beneath,
bright green grass cap along the top surface, small cloud puffs clinging to the
underside
```

## Neo City — Neon Alley, Skyline Grid

**Far layer**
```
a deep indigo cyberpunk skyline at night, distant tower blocks with grids of lit
windows, faint magenta glow on the horizon
```
**Mid layer**
```
neon signs and holographic billboards on building faces, a giant glowing
holographic face projection, sagging power cables, cyan and magenta light
```
**Near layer**
```
dark foreground building edges framing the screen, silhouetted air conditioning
units and antennas, falling rain streaks lit by neon
```
**Terrain set**
```
dark metal industrial platform, riveted panel body with tread plate texture,
yellow and black hazard stripe cap along the top surface, cyan light strip
glowing along the underside
```

---

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
