# Super Bots — build status

_Last updated: 7 September 2026 (autonomous build session)_

## What was built

The repository now contains the v0.1 single-player prototype of the Super Bots GDD: a 2D simultaneous-turn artillery brawler in the Brawlbots mould, playable in the browser against AI with 2 to 8 bots. The earlier 3D prototype was removed as requested.

Everything in GDD sections 3 to 8 that can exist without a server is implemented:

| GDD area | Status |
| --- | --- |
| §3 Turn loop (Announce / Plan / Resolve / Playback / Cleanup) | Done. Plan timer 10/15/20/30 s, auto-fire on timeout, skip and 1×/2×/4× playback. |
| §3.3 Resolution order | Done. Pre-turn status ticks, simultaneous physics, contact transfer, hazards, eliminations with chain self-destructs (max 3), end-of-turn pickups, win check. |
| §3.4 Win conditions | Done. FFA, teams, turn cap with highest-HP or Sudden Death tiebreak. |
| §3.5 Sudden Death | Done. Respawn at 50 HP on original pads, specials/power-ups/air strikes off, alternating Jump/Missile cooldown with badge, banner and red vignette. |
| §4 Bots | All 8 with both specials, passives, weight/accuracy behaviour, Pinball bounce parameter. |
| §5 Power-ups | All 10 with spawn rates by map size, max on map, 6-turn expiry, weighted RNG, stacking rules, Rally Beacon teams-only. |
| §6 Maps | 10 maps (5 Standard, 5 Battle) across 5 theme kits (Lava, Ice, Jungle, Sky, Neo City) with painted backdrops, themed platforms, kill floors, spike mines and per-theme hazards. |
| §7 Custom games | Host settings, presets, teams up to 4, bot restrictions, friendly fire, power-up pool toggles. Room codes / networking are out of scope for local play. |
| §8 Controls | Drag-to-aim with accuracy-scaled guide, action bar, secondary parameter button, pinch/wheel zoom and pan, tap-for-info, playback skip, landscape and portrait, PWA manifest. |
| AI | Simulation-based planner with three difficulty tiers. |

## How the Brawlbots baseline was checked

The Plato site itself is blocked from this environment, so I verified the genre rules through search results and the official game description: simultaneous turns, jump + missile every turn, two cooldown specials per bot, bots defined by health / weight / accuracy, power-ups (health, cooldown reset, +50 % damage, poison-on-contact, freeze-on-contact), last bot standing. The GDD matches that baseline and this build follows the GDD. Video gameplay could not be watched from here.

## Testing done

Headless (Node, no browser):

- `test/headless.mjs`: 40–60 mixed matches (2–8 players, FFA and teams, all maps, all difficulties) complete with no errors or stalls.
- `test/features.mjs`: across 90 matches every special, every power-up, every hazard event, Sudden Death, teleporters, reflections, wall breaks, splits and turn-cap wins occur at least once.
- `test/balance.mjs`: 1v1 round-robin of all 56 bot pairings × 4 seeds on Elite.
- `test/stress.mjs`: 250 matches with fully randomised host settings, sizes and modes. No errors, every match reaches a winner.
- `test/browser.mjs`: Playwright script for the browser checks below.

Browser (headless Chromium via Playwright): menu, lobby, quick 1v1 with drag-aim and specials, 8-player teams match on Nimbus Reach, pause/quit, info popup. No console errors.

## Bugs found and fixed during simulation

1. Missiles could not reach across Standard maps (range 16 vs 24-unit spawn spacing). Missile speed raised for ~33-unit range.
2. Heavy bots could not clear 3-unit pillars and got boxed in at map edges forever. Pillars lowered to 2 units and jump power raised.
3. Sudden Death on Caldera respawned bots below the risen lava, killing them every turn. Lava resets on Sudden Death; repeated wipes cap at a draw.
4. AI never used Split Shot because the aim preview stopped at the apex. Preview now simulates all four children (also improves the player's guide).
5. AI never dodged, so HP pools decided every duel. Added threat-aware dodging (light bots dodge, heavies hold) and accuracy-scaled AI aim noise.

## Balance snapshot (1v1, Elite AI vs Elite AI)

Final run (168 duels): Warden 74 %, Volt 64 %, Bulwark 62 %, Skyla 48 %, Phantom 40 %, Ricochet 38 %, Gravitas 38 %, Magmaw 33 %. Before the AI fixes the spread was 26–76 %. Warden's Deflector is very strong against an AI that cannot bait it, and Magmaw's low accuracy now costs the AI real hits; both are worth watching in human play. The GDD target band is 40–60 %, so a numbers pass is still needed. All stats live in `src/core/defs.js`.

## Not built (per GDD scope or needs a server)

- Networking, lobbies with room codes, reconnection, Sentry mode, spectator mode.
- Tiled JSON map loading (maps are JS objects with the same layer concepts).
- Destructible terrain, Glacier / Neon City themes, expansion bots.

## Suggested next steps

1. Play a few matches on a phone and desktop and note anything that feels off in aiming or camera.
2. Decide on the open questions in GDD §13 (Updraft as one action is what is implemented; enemy aim guides are hidden).
3. If the design is approved, the `src/core` package is already server-ready: it has no DOM dependencies and is fully deterministic from a seed plus the action list.
