# Super Bots v0.1 audit

**Date:** 5 October 2026
**Build audited:** `945c615` on `claude/upbeat-fermat-r7uyry` (the only branch in the repository)
**Scope:** Audit only. No game code was changed. Screenshots from a headless Chrome playthrough are listed at the end.

## Verdict

The prototype already plays the genre. A match is a real simultaneous-turn artillery fight: aim, lock, watch everyone move at once, take damage, die, and see a result. All eight bots, both specials, the ten power-ups, the ten maps, and the host rules exist and the sim survives hundreds of automated matches.

It does not yet look or feel like Brawl Bots. The gap is presentation. Bots are one painted still, cut into a handful of pieces and tweened. Effects, impacts, and the whole soundtrack are generated in code. The menus are a dark settings screen. At gameplay size the characters read as colored icons on tiled slabs, in front of paintings that are better than the things you actually stand on.

**Keep the vanilla canvas game.** The simulation is the part worth keeping, and it is already separated from the renderer. A move to Phaser, Pixi, Unity, or Godot would spend the next stretch of work re-housing rules that already run. The work that changes whether this feels like Brawl Bots is frame animation, a finished map, labeled touch controls, and recorded sound, inside the runtime that exists.

The first milestone should be one map and three bots brought up to that bar. Ember Pit, with Volt, Magmaw, and Ricochet. Those three sit inside or on the edge of the 40–60% win band in the latest 1v1 run. Warden, Bulwark, Skyla, and Phantom do not.

## Which branch is the real one

`claude/upbeat-fermat-r7uyry` is the whole repository.

- GitHub has one branch. `origin/HEAD` points at it. There is no `main`, no tags, and no other remote heads.
- The history is 82 commits on that line, ending 5 October 2026 with the spec under `docs/spec/`. Earlier commits are the prototype itself: maps, painted art, physics, abilities, cut-out rigs.
- `docs/STATUS.md` (7 September) describes an earlier, smaller build and is stale. `docs/spec/` was generated from the source and matches the game that runs. Where the GDD, the status note, and the spec disagree, the running source is the product, and the spec is the write-up of that source.
- `.github/workflows/pages.yml` publishes only on pushes to `main`. That workflow has never had a branch to run on. The README's deploy instructions describe a branch that does not exist.

## How this audit was done

Played the game in headless Chrome (Playwright, system Chrome) against the static server on port 8123. Captured the main menu, the lobby, Botpedia, plan-phase aim on five themes, playback of a missile explosion, Chain Arc, Pinball, Gale Shot, and Shockwave, an elimination, the results screen, an 8-bot match on Nimbus Reach, and a 390×844 phone-sized session including a real touch drag. No page errors.

Ran every suite named in the README. Results are in the test section.

Read every markdown file in `docs/` and `docs/spec/`, plus `art/README.md`, `art/PROMPTS.md`, `art/MAP_PROMPTS.md`, and the text of `art/ANIMATION_BIBLE.html`.

### What was verified about Brawl Bots

Fetched the official rules and bot list from [platoapp.com/en/games/brawlbots](https://platoapp.com/en/games/brawlbots) on 5 October 2026 (bot abilities as of Plato patch 36.0.0, sixteen bots). Downloaded and looked at the official images on that page: the marketing chooser, the control-panel diagram, the four weapon buttons, the secondary-parameter button, the bot stat card (health, weight, accuracy), the aim-pointer diagram, the mini stage diagram, portraits of Raptor, Nano, Shinobi, Rex, Baishe, Lionheart, and Xebes, and the illustrated ability cards for Raptor's shield and Rex's stomp.

Public player comments from r/PlatoApp (threads on the game itself, the point system, and power-up RNG) were read as text. They are opinions, not rules.

### What was not verified

- The live game was not played. Brawl Bots runs inside the Plato app (iOS, Android, macOS). There is no public web build of the match itself. Store pages for a standalone "Brawl Bots" app do not exist; it ships as one game inside Plato.
- Gameplay video was not watched. Searches from this environment did not return Plato Brawl Bots footage, and Reddit image URLs returned 403. Motion, screen shake, hit-stop, and sound of the reference game are **not** first-hand observations. `docs/ROADMAP.md` says an earlier session studied two videos frame by frame. This audit did not repeat that.
- Phone performance, thermals, and haptics were not measured. The frame-rate note below is headless desktop Chrome.
- The soundtrack was not listened to in a review pass. The finding on sound is from the code: there are no samples and no music.

## What Brawl Bots is, from the sources above

Simultaneous turns. Each player picks one of four actions (jump, a medium missile, and two cooldown specials), drags to aim, and confirms with Shoot. The aim guide is a dotted line, and **higher accuracy draws a longer line**. Some weapons have a second button that changes a parameter. A bot is health, weight, and accuracy. Tap a bot to read it.

Elimination is 0 health, falling in water, or leaving the stage. A dead bot self-destructs and hurts nearby enemies. The last bot standing wins. **If nobody is left, everyone who died that round wins together.** That is the official rule. Super Bots does not do this. It respawns those bots into Sudden Death.

Power-ups on the official page are six: health, cooldown reset, +50% damage, −50% damage taken, poison (10 per turn), and ice (no jump next turn). Maps are chosen at random. Some stages have edge teleporters, drawn as a green streak. An air strike is announced the turn before, with no location given in the rules text. The roster is sixteen illustrated characters (Panzer through Cat-apult), several of them paid. Ranked winners are listed on the page. Private games with friends are how Plato presents the product. Credits name two artists (Ken Tan, Qi Xyuan Tan) and an animator (Mark Gabot).

The official stills are thick-outline cartoon machines with a face or a creature read: a dinosaur, a ninja, a shark, a lion, a snake on a cloud. The control panel is four illustrated circular buttons plus a separate Shoot, and a small secondary button when a weapon has a setting. Ability cards are small comics of the move, not stat paragraphs.

Players describe the game as moreish and short. Complaints that showed up more than once: new bots cost premium currency, winning a match pays no coins, power-up placement feels unfair, and Lionheart can break weak ground and leave holes. Destructible terrain is a player report, not an official rule on the page. The GDD already defers destructible terrain. That matches a real feature of at least some reference maps, and it is absent here.

## Comparison

| Area | What the current build does | Where it sits against the reference |
|---|---|---|
| Bot art | Eight painted stills, one signature color each, thick outlines, a weapon read. Full-size files in `art/sprites/` have real character. In a match they are small. | The stills are in the right style family. They are not yet characters in motion, and at play size they do not carry the personality the reference portraits do. |
| Animation | `src/render/cutout.js` slices each still into four or five polygons and tweens them: a small idle bob, a recoil, a crouch, a squash, parts flung on death. No frame clips are registered. `art/vfx/manifest.json` is empty. Volt clip videos exist under `art/sprites/raw/anim/` and are not in the game. | The animation bible in this repo already says the reference reads as snappy because action frames are few and the settle is long, at about 12 fps, with effects on separate sheets. That pipeline is built and unused. What shipped is the fallback. |
| Juice | Code draws a spike-star explosion, an expanding ring, debris, floating damage numbers, a KO label, screen shake, a 90 ms hit-stop on hits of 40+, a 0.75 s slow-motion and a camera punch on a kill. Playback zooms toward the action. | The ingredients are the right list. In the captured frames the explosion is a flat orange burst and the death is a label plus that burst. A still cannot prove whether the timing feels good. There is no layered, drawn impact. |
| Maps | Ten maps, five painted backgrounds, textured slab tops and faces, themed extras (icicles, grass, cloud puffs, neon underglow). Kill floors read as lava, water, void, or neon. | The paintings are the best art in the build. The collision is a stack of rectangles, and it looks like one. On Cloud Steps the painting and the slabs both try to be the islands. Eight bots on Nimbus Reach are identifiable by color and hard to follow as a fight. |
| UI / HUD | Dark panels, a cyan outline, the system font. Turn and phase are clear. Nameplates have an HP bar. The action buttons are icons with no names. Results are a stats table titled VICTORY or DEFEAT. Botpedia is a card grid. | Information is all there. It looks like a tool for testing the sim. The reference panel is illustrated buttons you can tell apart without a legend. Under 640 px the roster and the aim readout are removed. |
| Sound | `src/audio.js` is a WebAudio synth: a noise burst for fire, a boom, a tick, a chime. No samples, no music, no per-bot voices. | A produced mobile game's sound is not something a synth preset reaches. This was not listened to as a mix; the absence of any recorded asset is the finding. |
| Turn feel | Announce, plan, resolve, playback, cleanup. Drag anywhere sets direction and power. The guide is the real trajectory, including Split Shot's children. FIRE locks. Skip and 1×/2×/4× work. AI waits until the human locks, then everyone resolves together. | The loop is the genre loop, and it is the strongest part of the prototype. Pacing in the automated duels averages about 8 turns in a 1v1 and about 11 in the stress mix. |
| Aim guide vs accuracy | The README, the in-game How to Play, and the GDD say the dotted line is 30% / 55% / 85% by accuracy. `src/ui/game.js` computes that fraction and then passes `fraction: 1`. Every human sees the whole arc. The spec (section 08) documents the full line. Low accuracy only adds noise to the AI. | This is a direct break with the reference rule that was verified on the official page, and with the text the player can read inside the game. Low-accuracy bots do not feel inaccurate to the human holding them. |
| Mobile | Portrait layout exists. Touch drag on a 390×844 viewport produced a real aim (Frozen Keel, missile, 58°, full power). Buttons are 64×56 and FIRE is 84×56, so they clear a 48 px target and they fill the width. No action names, no aim numbers, no roster. No haptics. | The input path works. The phone screen hides the text that makes the desktop screen understandable. |
| Performance | Headless desktop Chrome held about 61 frames per second during 8-bot playback on Nimbus Reach. `docs/spec/11` already says battle maps can dip on a phone and that backgrounds and terrain are redrawn every frame. | Desktop is fine. A 2022 mid-range Android, which the GDD names as the target, was not tested. |
| Social play | One human and AI, or all AI. Local record of wins and losses in `localStorage`. | The reference is a friends-and-ranked game with a chat surface and a roster people argue about. That product does not exist yet. The sim being deterministic is what makes it possible later. |

## Docs against the build

`docs/spec/` is a faithful description of the code that runs, including the numbers that drifted away from the GDD. Treat the GDD as the original pitch (7 September 2026), not as the spec of this build.

### In the game

- The five-phase turn loop, plan timers 10/15/20/30, lock, timeout, skip, and playback speeds.
- Eight bots, two specials each, passives, weight classes, body-outline collision.
- Ten power-ups and the stacking rules, including Rally Beacon in team games.
- Ten maps in five themes, with the hazards named in the spec (rising lava, geysers, burning ground, gusts, mines, log drop, EMP, air-strike carpet, looped edges, teleporter pads).
- Free-for-all, teams with up to four colors, friendly fire toggle, turn cap, Sudden Death (respawn at 60 HP, specials off, Jump and Missile alternate, cap of 6 rounds).
- Host presets Classic, Chaos, Tactical, Mirror.
- AI on three difficulties, using the same preview as the guide.
- PWA manifest and service worker. Canvas renderer, procedural audio.

### Not built

- Online play: room codes, reconnect, Sentry mode, emotes, spectators as a joined role. An eliminated human can watch the rest of the match.
- Accounts, progression, unlocks, missions, ranked ladder.
- A tutorial.
- Recorded sound and music.
- Painted effect sheets and projectile sprites. The loader exists. The manifest is empty.
- Frame animation clips in the shipped manifest.
- Tiled maps. Maps are data in `src/core/maps.js`.
- Destructible terrain.
- The GDD's tech stack: Phaser, Planck.js, React, Vite, Colyseus, TypeScript, Postgres. None of it is in the repo.
- The GDD's original map list (Scrapyard, Caldera, Stratos, Foundry, Reactor Core). Those names were replaced by the ten maps that ship. Ice and Neo City, which the GDD called future themes, are in the build. Nimbus Reach kept its name and changed its layout.

### Divergences that matter

Numbers below are the game, then the GDD.

- **Mutual wipe.** Official Brawl Bots: everyone who died that round wins. This game: Sudden Death. The GDD chose Sudden Death on purpose. It is still a different ending from the game people know.
- **Sudden Death health** is 60, not 50. Hazards also stop during Sudden Death. The GDD keeps map hazards running.
- **Aim guide** is the full arc for the human. The GDD, the README, and the How to Play page say otherwise. The spec tells the truth.
- **Power-ups never expire.** `TURN.powerupExpire` is 6 and unused. The GDD expires them after 6 turns. The spec says they stay until picked up.
- **Air strike** carpets the map (`max(6, round(width / 1.6))` bombs). The GDD appendix says 3 bombs. `DMG.airStrikeBombs` is 3 and unused.
- **Thrusters** multiply jump speed by `sqrt(1.75)`. The GDD also gives a second jump in the same turn. That second jump does not exist.
- **Phantom's second special** is a damaging toxic cloud. The GDD's Smoke Bomb hides aim guides and blocks homing. The smoke fantasy is gone.
- **Skyla's Updraft** is a high jump that drops five missiles by itself. The GDD's open question (one combo action versus spending the missile) was answered with an automatic rain, not a shot the player aims at the top.
- **Roster numbers moved a long way** and then moved again after the GDD. Examples from the generated spec: Bulwark 140 HP and a wall with 10 HP placed anywhere, not 150 HP and a 40 HP wall in front of him. Volt's Chain Arc is 40, not 30. Warden's Anchor Bolt is 45, not 20. Gravitas's Shockwave is 50 damage at radius 5, not 25 at radius 2. Ricochet's Pinball starts at 35, not 15. Health bands are squeezed into 120–140, so the light bots are much tougher than the GDD's 85–95.
- **README trace example is wrong.** `node test/trace.mjs phantom volt frosthollow 7 hard` uses a map id that does not exist (`frozenkeel` is the ice map). An unknown id is treated as random. The command played a wide map with an EMP pulse. The same arguments with `frozenkeel` played Frozen Keel, including the blizzard.
- **Botpedia portraits are drawn once at startup**, before sprite loads finish. The match uses the cut-out rig after the PNG arrives. The cards can stay on the vector fallback for the rest of the session.
- **Balance is outside the GDD band.** Fresh 1v1 round robin, 3 seeds, 168 duels, Elite vs Elite, standard maps: Warden 74%, Bulwark 71%, Volt 60%, Ricochet 55%, Magmaw 50%, Gravitas 43%, Phantom 31%, Skyla 17%. The GDD target is 40–60% each. `docs/spec/12` still quotes an older table and says the later ability pass was not remeasured. It has been remeasured now. Skyla and Phantom are the problem children. Warden and Bulwark are the problem adults.

## Tests

Run on 5 October 2026, Node 22, from the repo root. No game code was modified to make them pass.

| Command | Result |
|---|---|
| `node test/headless.mjs 40` | **Pass.** 40 matches, 0 errors, 0 draws, 4 Sudden Deaths, 73.7 s. Turns averaged 10.8 (min 3, max 32). Mixed sizes and modes, so the per-bot win rates in that log are not a ranking. |
| `node test/features.mjs` | **Pass.** 90 matches, 0 errors, 251 s. Every special, every power-up, and every event the harness requires showed up at least once. All 10 maps appeared. Win types seen: player and team. |
| `node test/balance.mjs 3` | **Pass** (the script always exits 0; it is a report). 168 duels, 108 s, average 8.2 turns. Win rates in the divergences section above. |
| `node test/stress.mjs 250` | **Pass.** 250 matches, 0 errors, 0 matches without a winner, 26 Sudden Deaths, average 11.2 turns, 534 s. Random player counts, modes, maps, and host settings. |
| `node test/bughunt.mjs 5` | **Fail.** 50 eight-bot matches. 7 reports of "bot embedded in terrain", example Ricochet on Glacier Fortress at the start of the match, circle-overlap depth 0.32. No reports of bots alive under the kill floor, bots outside the map, pickups or mines inside terrain, or matches that never ended. The probe is a circle of radius 0.5. Collision in the sim is the painted hull, so this is a warning to look at that spawn, not proof a body is stuck inside a block. |
| `node test/browser.mjs` | **Pass**, after installing `playwright-core` (it is not a dependency of the repo) and pointing Chrome at `/usr/local/bin/google-chrome`. Menu, lobby, a drag-aim, a special, and an 8-player match. The log reported no page errors. After six skipped turns of the 8-player match, all 8 bots were still alive, which is legal and slow. |
| `node test/trace.mjs phantom volt frosthollow 7 hard` | **Runs, and does not trace Frozen Keel.** See the map-id note above. `frozenkeel` with the same seed ends on turn 5 with Phantom winning after Volt falls during the blizzard. |

The browser smoke test is not repeatable from a clean clone until Playwright is installed and a Chromium path is set. The README says that. It is still easy to miss.

## Tech direction

**Stay on the vanilla canvas build for the vertical slice. Do not start a Phaser, Pixi, Unity, or Godot port as the next step.**

Why this runtime is the right one to keep:

- The rules already run, headless, from a seed and a list of actions. `src/core` and `src/ai` do not touch the DOM. That is the hard part of a later lockstep server, and it is done. About 1,300 lines of `sim.js` plus the match, the definitions, the maps, and the planner are the asset. A new engine keeps that code only if someone ports it by hand.
- One JavaScript runtime is also why the sim matches between a future server and the client. Unity and Godot make cross-platform float determinism a project of its own. The genre does not need a physics engine. It needs this fixed-step sim.
- Brawl Bots itself is 2D art inside a social app, made by a handful of people including one animator. It is not a 3D-engine game. Matching it is an art problem.
- The GDD's Phaser / React / Colyseus plan was a reasonable sketch before any code existed. The prototype answered the rules question without it. Re-adopting that stack now would rebuild menus and rendering in order to arrive back at today's match.
- A store build, when it is time, can wrap this client (Capacitor is the path `docs/ROADMAP.md` already names). That choice can wait until a phone has played the slice.

When a library is worth adding, later, and not as a rewrite:

- **Spine (or DragonBones) on a canvas or Pixi renderer**, if the roster grows and skins, emotes, and a third special start to multiply the frame count. Spine's web runtimes can draw into the page the sim already owns. DragonBones is the free option and the less maintained one. This is a production tool for the art, not a reason to throw out the match code.
- **PixiJS as a renderer swap**, only if the slice's finished frames, effects, and text cannot be composited crisply by the current canvas. The sim stays. The menus can stay.
- **Unity or Godot**, only if a later decision is a native-only game and the people making the animation already work in that editor. That decision is not supported by what is on screen today. It would discard a working, tested, deterministic match to buy an animation tool.

`docs/ROADMAP.md` puts online multiplayer first and art second. That order made sense for "is the toy fun with friends." The goal of this audit is whether the toy can look and feel like Brawl Bots. Friends on the current presentation will answer a different question. Private rooms should follow the slice, not lead it.

## Art pipeline

What is realistic for this roster:

1. **Frame animation for the slice, drawn to the animation bible.** Idle, fire, jump, land, hit, death, and both specials, about 8–14 fps, contact point locked, effects on their own sheets. The intake tools (`tools/intake_anim.py`, `tools/intake_vfx.py`) already turn a contact sheet or a video into clips the renderer will play. Volt's raw videos show the path was started and then replaced by the cut-out rig. The rig should remain the fallback for bots that do not have clips yet. It should not be the target.
2. **Who draws them.** The official reference credits a human animator. The prompts in `art/PROMPTS.md` can generate a still in the house style, and the current stills prove that. They are a weak way to get twelve frames that share a silhouette, a light direction, and a ground line. For two or three bots, a single illustrator following the bible, using the existing still as the model sheet, is the realistic path. Generated frames are usable as a rough only where the intake alignment can force one scale and one baseline.
3. **Skeletal animation after the slice, if the frames worked.** Spine is the right tool once a bot needs the same performance in many skins, or once sixteen specials make per-frame drawing the bottleneck. It is the wrong tool to learn in the same milestone as "make three bots feel alive." A cut-out of a single painting cannot get there: the joints are polygons, the mesh does not deform, and secondary motion (cloaks, antennae, jaws) is a sine wave.
4. **Maps.** Keep painting backgrounds per map and kits per theme. The slice's job on Ember Pit is to make the slabs look like they were cut from the volcano, including corners, lips, and the crater edge, so the player can see what is solid. The animation bible's rule for characters applies to terrain: if it does not read as a black shape at phone size, it is not done.
5. **Effects.** Draw the explosion family, the KO burst, Chain Arc, the slam, and the pinball bounce as sheets. Stop adding more procedural particle varieties. The renderer already prefers a painted sheet when the manifest has one.

## Roadmap

### Milestone 1 — vertical slice

One map, three bots, the core loop, at the quality bar above.

- **Map:** Ember Pit. One place, a kill floor you can see, a layout that is already a 1v1.
- **Bots:** Volt, Magmaw, Ricochet. A marksman, a heavy, a trickster. Their 1v1 win rates are 60%, 50%, and 55%.
- **Moves on screen:** jump, missile, Chain Arc, Molten Slam, Ember Spit, Pinball, Split Shot. Each has a drawn body clip and a drawn effect. Death is a clip, then the self-destruct.
- **The guide tells the truth.** Low accuracy shows 30% of the arc, medium 55%, high 85%, for the human as well as a number in a table. Update the How to Play text so it matches.
- **HUD:** action buttons with the move's name, a nameplate that survives a phone width, damage numbers that stay attached to the bot that was hit, a KO that names the victim. Results can stay a table for this milestone.
- **Sound:** a small recorded set for this map only. Missile, explosion, slam, pinball bounce, KO, UI tick, one lava loop that ducks during playback.
- **Phone:** play the slice in portrait and landscape on a real device and write down frame time. Fix only what that session shows. Caching the background is the known first optimization, and only if the phone needs it.
- **Out of this milestone:** the other five bots, the other nine maps, online play, accounts, destructible ground, Sudden Death tuning, and a store listing.

Done means a stranger can watch a 1v1 on Ember Pit with the sound on and recognize the genre without being told.

### Milestone 2 — the rest of the cast, one more place

Bring Bulwark, Warden, Skyla, Phantom, and Gravitas up to the same clip standard. Add Frozen Keel or Neon Alley, whichever painting is closer, and give it the same terrain treatment. Re-run `node test/balance.mjs 4` after every number change. Skyla at 17% and Warden at 74% get a pass before they are shown as finished characters. Decide here whether the next bots are frames or a Spine rig, using the slice as the evidence.

### Milestone 3 — the other maps, and the rules that drifted

Finish the five themes so every map meets the Ember Pit bar. Then pick the rule differences on purpose and write them down in the GDD so it matches the game: Sudden Death versus a shared win, the full-carpet air strike, power-ups that stay, Thrusters without a second jump, Toxic Bomb instead of Smoke Bomb. Fix or accept the Glacier Fortress overlap the bug hunt reported.

### Milestone 4 — private online matches

Two to four humans, a room code, the server runs this sim, clients send actions and play the log. Reconnect can be crude. No matchmaking, no accounts beyond a display name. This is the feature that makes the genre the thing people actually play. The determinism work is already done.

### Milestone 5 — a phone build people can install

Capacitor or an equivalent wrapper, safe areas, haptics on lock and on a KO, a first-run minute that teaches aim, power, jump, and a special. Only if milestones 1–4 are still happy on canvas. If the art could not be displayed well, this is the moment to put Pixi or Spine under the same sim. It is still not the moment to move the project to Unity or Godot unless the art team is already there.

### Milestone 6 — retention and a store

Progression, cosmetics, a ladder. Players of the reference game already complain that winning pays nothing, so this matters, and it matters after the match is worth winning. Store listing, privacy text, age rating, screenshots. Destructible terrain is an experiment after the solid maps feel finished, because it changes every shot in the sim.

## Screenshots

Captured 5 October 2026 from headless Chrome. Desktop frames are 1440×900. Phone frames are 390×844 at device scale 2. Paths:

| File | What it shows |
|---|---|
| `/opt/cursor/artifacts/screenshots/01-main-menu.png` | Main menu |
| `/opt/cursor/artifacts/screenshots/02-lobby.png` | Custom game lobby, players and bot cards |
| `/opt/cursor/artifacts/screenshots/02b-lobby-maps.png` | Map picker |
| `/opt/cursor/artifacts/screenshots/02c-lobby-settings.png` | Host settings |
| `/opt/cursor/artifacts/screenshots/03-botpedia.png` | Botpedia |
| `/opt/cursor/artifacts/screenshots/10-emberpit-plan-aim.png` | Ember Pit (lava), plan, missile aim guide |
| `/opt/cursor/artifacts/screenshots/11-emberpit-playback-explosion.png` | Ember Pit, playback, missile explosion and damage number |
| `/opt/cursor/artifacts/screenshots/12-emberpit-plan-chainarc.png` | Ember Pit, Chain Arc aim |
| `/opt/cursor/artifacts/screenshots/13-emberpit-elimination.png` | Ember Pit, elimination |
| `/opt/cursor/artifacts/screenshots/14-emberpit-results.png` | Results |
| `/opt/cursor/artifacts/screenshots/20-frozenkeel-plan-pinball.png` | Frozen Keel (ice), Pinball aim |
| `/opt/cursor/artifacts/screenshots/21-frozenkeel-playback-pinball.png` | Frozen Keel, Pinball in flight |
| `/opt/cursor/artifacts/screenshots/30-canopyruins-plan-gale.png` | Canopy Ruins (jungle), Gale Shot aim |
| `/opt/cursor/artifacts/screenshots/31-canopyruins-playback-gale.png` | Canopy Ruins, Gale Shot |
| `/opt/cursor/artifacts/screenshots/40-neonalley-plan-aim.png` | Neon Alley (neo), missile aim |
| `/opt/cursor/artifacts/screenshots/41-neonalley-plan-shockwave.png` | Neon Alley, Shockwave selected |
| `/opt/cursor/artifacts/screenshots/42-neonalley-playback-shockwave.png` | Neon Alley, Shockwave |
| `/opt/cursor/artifacts/screenshots/50-cloudsteps-plan-jump.png` | Cloud Steps (sky), jump guide |
| `/opt/cursor/artifacts/screenshots/60-nimbus-8bot-plan.png` | Nimbus Reach, 8 bots, plan |
| `/opt/cursor/artifacts/screenshots/61-nimbus-8bot-playback.png` | Nimbus Reach, 8 bots, playback |
| `/opt/cursor/artifacts/screenshots/70-mobile-menu.png` | Phone menu |
| `/opt/cursor/artifacts/screenshots/71-mobile-templecrossing-plan.png` | Phone, Temple Crossing (jungle battle), plan and aim |
| `/opt/cursor/artifacts/screenshots/72-mobile-templecrossing-explosion.png` | Phone, Temple Crossing, explosion |
| `/opt/cursor/artifacts/screenshots/73-mobile-touch-drag-aim.png` | Phone, Frozen Keel, touch drag aim |

`02b-lobby-scrolled.png` is a duplicate of the lobby and is not part of the set above.
