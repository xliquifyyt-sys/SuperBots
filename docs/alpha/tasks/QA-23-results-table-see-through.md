---
id: QA-23
milestone: M1
role: client-ui
status: todo
depends: []
severity: P3
---
# QA-23: Results table has no solid backing, so the animated sky (birds, islands) scrolls through the stat rows

Found by the 2026-10-23 nightly QA run (`QA_SET=2 node test/qa-playthrough.mjs docs/alpha/qa/2026-10-23`, match 4:
Bulwark in a 4p teams game on Nimbus Reach at 390x844).

On the results screen the world keeps rendering behind `#menu-result`. The only thing between the stats and the
map is the generic `.screen` backdrop (`style.css` line 93: a radial gradient that is only `rgba(13,17,25,0.6)` at
the centre), and `#result-table` has no background of its own. On the bright sky theme the parallax layer from
`src/render/themes.js` (`case 'sky'`: birds drawn at `h * (0.1..0.4)`, floating islands) lands exactly in the
table's band, so dark bird strokes cross the numbers and an island sits behind the Ricochet row:

- `docs/alpha/qa/2026-10-23/m4-nimbus-390x844-result.jpg` (two birds over "109" / the Magmaw row, island behind
  "Ricochet")

The birds animate, so the clutter moves across the text while the player reads the scoreboard. Dark maps hide
the problem (`m2-glacierfort-390x844-result.jpg` reads cleanly).

Expected: the results table sits on an opaque (or near-opaque, ≥0.9) panel, so nothing from the world shows
through the text on any theme.
Actual: on sky maps background sprites are visible through and on top of the stat rows.

Repro: Play → Nimbus Reach (or Cloud Steps), any bots, play to the end at 390x844; look at the results screen.
Or `python3 -m http.server 8123 & QA_SET=2 CHROMIUM_PATH=... node test/qa-playthrough.mjs /tmp/qa 3` and open
`m4-nimbus-390x844-result.png`.

Related: QA-4 (the same table is cut off at phone width; fix together).

## Acceptance

- [ ] `#result-table` (or the whole results card) has a background with alpha ≥ 0.9; presentation only.
- [ ] Two screenshots of the results region on Nimbus Reach at 390x844 taken 1 s apart differ by < 1% of pixels
      inside the table's bounding box (no world animation bleeding through) — add this as a check in a new test file.
- [ ] Screenshot in the Log at 390x844 and 1280x720; browser smoke gate green.

## Log
- 2026-10-23 nightly QA: filed.
