---
id: QA-26
milestone: M1
role: client-ui
status: todo
depends: []
severity: P2
---
# QA-26: Special callout pill spawns on the caster's own name tag and fades into a blank grey tile

Found by the 2026-10-27 nightly QA run (`QA_SET=2 node test/qa-playthrough.mjs <dir>`, set 2). The match seed is
`Date.now()`, so the exact frames are not reproducible; use the test below.

When a bot casts a special, `Renderer.drawCallouts()` pops the dark callout pill (icon + special name) directly on top
of that bot's nameplate, so the caster's name and part of its HP chip are hidden at the moment everyone is watching
it. As the callout fades (`globalAlpha` 1 → 0 over the last 30% of its life) the `rgba(13,16,24,0.85)` pill turns a
pale translucent grey over bright skies/ice, and the white special name, which already sits outside the pill (QA-19),
disappears against the light background. What is left is a ghostly grey square with an icon sitting on the bot's
name — it reads as a stuck UI tile, not a callout.

Evidence (JPEG):
- `docs/alpha/qa/2026-10-27/m4-nimbus-390x844-resolve-T6.jpg` — Kilo (Ricochet) at x≈225, y≈615: grey tile with the
  pink Pinball icon covers the top of "Kilo" and the space above its HP bar.
- `docs/alpha/qa/2026-10-27/m2-glacierfort-390x844-resolve-T6.jpg` — Juno (Volt) at x≈285, y≈505: grey tile with the
  lightning icon right above the "Juno KO" label, no special name readable.

Cause (read from code): `src/render/renderer.js` `drawCallouts` places the pill centre at
`cy = y - z * 1.7 - z * 0.6 * k` with half-height `size * 0.6` (`size = max(22, z * 0.72)`), i.e. spanning roughly
`y - 2.13z … y - 1.27z` at spawn. `drawBots` puts the name text baseline at `y - r*1.75 - z*0.5 - z*0.12` ≈ `y - 1.5z`
and the HP bar at ≈ `y - 1.375z`, so the pill sits squarely on the nameplate and only rises 0.6 units over its whole
life. `drawCallouts` runs after `drawBots`, so the pill always wins.

Expected: the callout pops clearly above the caster's nameplate (name and HP chip readable throughout), and stays
legible while it fades on bright maps.
Actual: on every special cast the pill covers 100% of the caster's name box (and 44% of the HP chip at zoom 22)
from the first frame.

Repro: `python3 -m http.server 8123 & CHROMIUM_PATH=... node test/callout-nameplate.mjs` → on main
**32/32 callouts FAIL** ("pill covers name 100% / HP chip 44%" at zoom 22, "100% / 11%" at zoom 40, from t=0.02 s).

Related: QA-19 (name text overflows the pill — fix together), QA-21 (combat labels on the name tag; same nameplate
geometry).

## Acceptance

- [ ] `node test/callout-nameplate.mjs` exits 0 (presentation only; no `World` writes).
- [ ] `node test/callout-fit.mjs` still reports no new problems compared with main.
- [ ] Screenshot in the Log of a special cast on a bright map (Nimbus Reach or Glacier Fortress, 390x844) with the
      caster's name, HP chip and the callout all readable.
- [ ] Browser smoke gate and determinism 6 green.

## Log
- 2026-10-27 nightly QA: filed; added `test/callout-nameplate.mjs` (new file, drives the real `drawCallouts`).
