# Super Bots — Game Design Document

**Version:** 0.1 (draft)
**Date:** 7 September 2026
**Status:** For internal review
**Platform:** Mobile-first web (PWA), desktop-compatible
**Scope of this build:** Private custom games only

---

## 1. Vision

Super Bots is a simultaneous-turn artillery brawler for 2–8 players. Every player aims and fires at the same time, the server resolves all shots at once, and the last bot (or team) standing wins. It takes the proven turn structure of the Brawlbots genre and extends it with custom lobbies, four-team matches, large battle maps, new stage themes, a fresh bot roster, and an expanded power-up pool.

### 1.1 Design pillars

1. **Everyone acts at once.** No waiting for your turn. Each round is a short burst of decision-making followed by a chaotic, readable payoff.
2. **Readable chaos.** Eight players firing simultaneously must still be legible. Maps, projectile trails, and playback pacing all serve this.
3. **Bots are personalities.** Each bot is a distinct fantasy with two specials that create a play pattern, not just a stat block.
4. **Host controls the party.** Custom rules are the product. The host should be able to shape a match to their group in under a minute.
5. **Original in every visible way.** Mechanics are genre conventions; names, art, sound, UI, and bot designs are entirely ours.

### 1.2 What we are not building (this release)

- Public matchmaking, ranked, or MMR
- Progression, unlocks, or monetisation
- Native app store builds
- Spectator mode (deferred to v0.2)
- Destructible terrain (deferred; see §11)

---

## 2. Reference: how the genre baseline works

Distilled from the Brawlbots public rules, as a shared reference for the team. We replicate the *structure*, not the content.

| Element | Baseline behaviour |
|---|---|
| Turn structure | Simultaneous. All players choose an action, then all actions resolve at once. |
| Bot definition | Health points, weight, accuracy. |
| Accuracy | Determines the length of the aim guide (dotted trajectory preview). |
| Default actions (every turn) | Jump; medium missile. |
| Special weapons | Two per bot, each with a multi-turn cooldown. |
| Aiming | Drag on screen; dotted line shows trajectory. Some weapons have a secondary parameter button. |
| Elimination | HP reaches 0, falls in water, or leaves bounds. |
| Death | Bot self-destructs, damaging nearby enemies. |
| Stage hazards | Random air strike (announced a turn ahead); teleporter edges on some maps. |
| Win condition | Last bot standing. If all remaining bots die in the same turn, all of them win. |
| Power-ups (baseline set of 6) | Health, Cooldown reset, Damage +50%, Armor (−50% damage taken), Poison contact, Freeze contact. |
| Bot archetypes observed | Heavy (high HP, low accuracy), accurate medium, lightweight, control/utility. |
| Ability archetypes observed | Bouncy rocket, cluster rocket, pointer/split grenade, wall-piercing beam, reflective shield, big-radius grenade, AoE stomp, teleport + attack, lingering gas/cloud, knockback shockwave, lifesteal projectile, temporary invulnerability, gravity pull, root/snare, multi-charge burst, forward dash. |

**Open questions to verify by playing:** exact turn timer, current max players, current map count, whether a team mode exists today, projectile count limits per turn, how simultaneous collisions are ordered.

---

## 3. Core game loop

### 3.1 Match flow

```
Lobby → Bot select → [Turn loop] → Results → Rematch / Back to lobby
```

### 3.2 Turn loop

| Phase | Duration | What happens |
|---|---|---|
| **Announce** | 1–2 s | Air strike warning, power-up spawn preview, status effect ticks (poison, burn). |
| **Plan** | 15 s default (host: 10/15/20/30) | Each player picks one action: Jump, Missile, Special 1, or Special 2. Drag to aim. Tap Fire to lock in. Timer expires → auto-fire last aim, or Skip if nothing set. |
| **Resolve** | Server-side, instant | Server runs the deterministic sim: jumps, then projectiles, then contact effects, then environmental hazards, then eliminations. |
| **Playback** | 3–8 s (scales with action count) | All clients replay the sim. Camera frames the action. Damage numbers, eliminations, and power-up pickups shown. |
| **Cleanup** | 1 s | Cooldowns decrement, power-ups expire, new power-ups spawn, win check. |

### 3.3 Resolution order (deterministic)

1. Pre-turn effects: poison/burn damage, root/freeze expiry.
2. Movement actions (jumps, dashes, teleports) resolve simultaneously via physics.
3. Projectiles launched simultaneously; physics runs until all projectiles are at rest or expired (max 6 s sim time).
4. Contact effects applied (poison/ice/shock transfer on bot-to-bot collision).
5. Environmental hazards: air strike, rising lava, wind gust.
6. Elimination check: HP ≤ 0, out of bounds, in kill floor. Self-destruct blasts applied, then re-check (chain kills allowed, max 3 iterations).
7. Power-up pickups (bot overlapping a power-up at rest).
8. Win check.

### 3.4 Win conditions

- **Free-for-all:** last bot alive. If all remaining bots die in the same turn → **Sudden Death** (§3.5).
- **Teams:** last team with ≥ 1 living bot. If all remaining teams are wiped in the same turn → Sudden Death between the bots that died that turn.
- **Turn cap (optional):** host sets 20/30/40 turns. On cap: team/player with highest total HP remaining wins; if tied, Sudden Death between the tied players/teams.

### 3.5 Sudden Death

Triggered when the match would otherwise end with no bot standing.

- All bots that died in that final turn **respawn** on their original spawn pads with 50 HP (no status effects, no power-up buffs).
- Bots eliminated in earlier turns stay out.
- **Power-ups and air strikes are disabled.** Existing power-ups on the map are removed. Map hazards (lava, wind, teleporters) remain active.
- **Specials are disabled.** Only Jump and the standard Missile are available.
- **Alternating cooldown:** Jump and Missile each have a 1-turn cooldown. Using Missile on turn N means only Jump is available on turn N+1, and vice versa. On the first Sudden Death turn both are available.
- Sudden Death continues until one bot (or team) is left. If another simultaneous wipe occurs, Sudden Death repeats with the bots from that turn.
- HUD: "SUDDEN DEATH" banner, red vignette, the unavailable action button greyed with a "1" cooldown badge.

Design note: the alternating cooldown forces a read on the opponent — if they fired last turn, they must move this turn, so you can lead your shot. If they jumped, they will fire, so reposition.

---

## 4. Bots

### 4.1 Bot model

| Attribute | Range | Effect |
|---|---|---|
| **HP** | 80–150 | Health pool. |
| **Weight** | Light / Medium / Heavy | Jump distance, knockback resistance, fall/impact behaviour. Heavy = short jump, high knockback resistance. |
| **Accuracy** | Low / Medium / High | Aim guide length: 30% / 55% / 85% of full trajectory. |
| **Default: Jump** | — | Arc jump; distance scales inversely with weight. |
| **Default: Missile** | 25 dmg, radius 1.0 | Standard arc projectile, blast radius ~1 bot width. |
| **Special 1** | Cooldown 2–4 turns | Bot-specific. |
| **Special 2** | Cooldown 2–5 turns | Bot-specific. |
| **Passive** (optional) | — | One small always-on trait for identity (e.g. ledge grab). |

Damage reference: standard missile = 25. A 100 HP bot dies to 4 clean missiles. Specials range 15–60.

### 4.2 Launch roster — 8 original bots

All names, designs, and abilities are original. Archetype coverage: 2 heavy, 3 medium, 2 light, 1 control.

| # | Bot | Class | HP | Weight | Acc | Special 1 | Special 2 | Passive |
|---|---|---|---|---|---|---|---|---|
| 01 | **Bulwark** | Heavy tank | 150 | Heavy | Med | **Bastion Wall** (CD 3): deploys a 3-segment barrier in front for 2 turns; blocks projectiles, destroyed by 40 dmg. | **Siege Shell** (CD 4): slow heavy shell, 55 dmg, radius 1.5, strong knockback. | Immune to knockback while Bastion Wall is up. |
| 02 | **Magmaw** | Heavy brawler | 140 | Heavy | Low | **Molten Slam** (CD 3): jumps and slams, 35 dmg radius 1.5, leaves a burning patch (10 dmg/turn, 2 turns). | **Ember Spit** (CD 2): 3 short-range fire globs, 12 dmg each, apply Burn (8 dmg/turn, 2 turns). | Immune to Burn and lava damage for 1 turn after entering lava. |
| 03 | **Volt** | Medium marksman | 100 | Medium | High | **Chain Arc** (CD 3): beam that pierces terrain and bots, 30 dmg, arcs to one additional bot within range for 15. | **Static Field** (CD 4): drops a field at impact; bots inside can't use specials next turn, 10 dmg. | Missile speed +15%. |
| 04 | **Warden** | Medium defender | 120 | Medium | Med | **Deflector** (CD 3): dome shield for 1 turn; reflects projectiles back along their path. | **Anchor Bolt** (CD 3): projectile that roots the target for 1 turn (no jump) and deals 20. | Takes 20% less damage from projectiles that hit from above. |
| 05 | **Skyla** | Medium aerial | 95 | Medium | High | **Updraft** (CD 2): jump with 2× height; can fire missile at apex (combo action). | **Gale Shot** (CD 3): wide wind cone that pushes bots, projectiles, and power-ups; 10 dmg. | Not affected by map wind. |
| 06 | **Phantom** | Light assassin | 85 | Light | High | **Blink Strike** (CD 3): teleport to aim point (max 60% map width), then release 3 shards, 10 dmg each. | **Smoke Bomb** (CD 3): opaque cloud at impact for 1 turn; bots inside can't be targeted by homing effects and hide their aim guide. | After a kill, next special cooldown −1. |
| 07 | **Ricochet** | Light trickster | 90 | Light | Med | **Pinball** (CD 2): missile that bounces up to 4 times, 15 dmg per bot hit, gains +5 dmg per bounce. | **Split Shot** (CD 3): projectile splits into 4 at apex, 12 dmg each. | Own jump bounces once off terrain. |
| 08 | **Gravitas** | Control | 110 | Medium | Low | **Singularity** (CD 4): pulls all bots within a large radius toward the impact point for the rest of the resolve step. | **Shockwave** (CD 3): radial burst from self, 25 dmg to all within radius 2, moderate knockback. | Heavier-than-weight: knockback resistance of Heavy while keeping Medium jump. |

Design intent per bot:

- **Bulwark / Magmaw** anchor team fights and punish clustering.
- **Volt / Warden** are the "reliable" mediums new players gravitate to.
- **Skyla** is the mobility/positioning pick and the Sky-theme signature bot.
- **Phantom / Ricochet** reward skilled aim and map knowledge.
- **Gravitas** is the team-play enabler: Singularity → teammate's Siege Shell is the headline combo.

### 4.3 Expansion candidates (post-launch)

Tide (water/whirlpool), Hive (deployable turret drone), Mirage (decoy clone), Frostbite (freeze + shatter), Rampart (deployable trampoline pad for teammates).

---

## 5. Power-ups

### 5.1 Spawn rules

- Spawn on **designated spawn points** defined per map (never inside walls; never within 1.5 bot widths of a spawn pad).
- Base spawn rate: 1 power-up every 2 turns on Standard maps; 1 per turn on Battle maps. Host can set Off / Low / Normal / High.
- Max simultaneously on map: Standard 3, Battle 5.
- Unpicked power-ups expire after 6 turns.
- Spawn selection is weighted; server RNG seeded per match for determinism.
- Preview: next turn's spawn location flashes during Announce so players can contest it.

### 5.2 Power-up catalogue

Baseline set (6) plus 4 new — 10 total. Weights are relative.

| Power-up | Type | Effect | Duration | Weight |
|---|---|---|---|---|
| **Repair Kit** | Instant | +40 HP (cap at max). | — | 12 |
| **Overclock** | Instant | Reset both special cooldowns. | — | 8 |
| **Amp** | Buff | +50% damage dealt. | 2 turns | 8 |
| **Plating** | Buff | −50% damage taken. | 2 turns | 8 |
| **Toxin** | Contact | Next bot you collide with is Poisoned (10 dmg/turn, 3 turns). | Until used or 3 turns | 6 |
| **Frost** | Contact | Next bot you collide with is Frozen (no jump next turn). | Until used or 3 turns | 6 |
| **Thrusters** *(new)* | Buff | Jump distance ×1.75; can jump twice per turn (second jump as a follow-up action). | 2 turns | 7 |
| **Reflector Coat** *(new)* | Buff | The first projectile to hit you this turn is reflected back. | 1 turn | 5 |
| **Shockwire** *(new)* | Contact | Next bot you collide with is Shocked: its specials are disabled next turn. | Until used or 3 turns | 5 |
| **Rally Beacon** *(new, teams only)* | Buff | You and all teammates get +20 HP and +10% damage. Spawns only in team modes. | 2 turns (dmg) / instant (HP) | 6 |

### 5.3 Stacking rules

- Same buff picked twice: refresh duration, no stacking.
- Amp + Plating can coexist.
- Contact effects: only one contact effect held at a time; picking a second replaces the first.
- Rally Beacon HP can push above max HP up to +20 (overheal decays 10/turn).

---

## 6. Maps

### 6.1 Map model

Every map is a Tiled JSON file with these layers:

| Layer | Content |
|---|---|
| `terrain` | Collision geometry (static polygons). |
| `decor` | Non-colliding art. |
| `spawns` | Player spawn pads, tagged by team slot (1–8) and by mode (`ffa`, `teams`). |
| `powerups` | Power-up spawn points. |
| `hazards` | Kill floor (water/lava/void), teleporter edges, wind zones, moving platforms. |
| `camera` | Bounds and default framing. |

Map metadata: `size` (Standard / Large), `theme`, `minPlayers`, `maxPlayers`, `recommendedPlayers`, `hazards[]`.

### 6.2 Size classes

| Class | Width (bot widths) | Players | Spawn spacing | Notes |
|---|---|---|---|---|
| **Standard** | 24–30 | 2–4 | ≥ 5 | Fast, high-contact. |
| **Large / Battle** | 40–52 | 4–8 (playable at 2) | ≥ 6, with cover between adjacent pads | Multi-lane layouts; 2+ distinct "arenas" connected by chokepoints or teleporters. |

### 6.3 Battle map design rules

1. Eight spawn pads arranged so no pad has direct line-of-fire to more than 2 others at turn 1.
2. At least one cover element (pillar, overhang) between adjacent pads.
3. Central contested zone with the richest power-up spawns.
4. Teleporter edges (left ↔ right) to prevent corner-camping and shorten travel.
5. Camera: default frames the whole map; auto-zooms to the action cluster during playback; player can pinch to override.
6. Team modes: pads assigned so teammates spawn adjacent (within 6 widths) and opposing teams are spread evenly.

### 6.4 Launch map list

| Map | Theme | Size | Signature hazard |
|---|---|---|---|
| **Scrapyard** | Industrial | Standard | Crusher platform that drops every 5 turns on a marked zone. |
| **Caldera** | Lava | Standard | Lava kill floor rises 1 unit every 6 turns. |
| **Stratos** | Sky | Standard | Floating islands; constant wind (direction announced each turn) alters trajectories. |
| **Foundry** | Lava | Large / Battle | Two lava-split platforms joined by a bridge; lava geysers erupt at announced points. |
| **Nimbus Reach** | Sky | Large / Battle | Three altitude tiers; gusts every 3 turns; teleporter edges. |
| **Reactor Core** | Industrial | Large / Battle | Central reactor emits a pulse every 4 turns (15 dmg to anyone inside the ring). |

### 6.5 Theme kits

Each theme is a package: tileset, background layers (parallax ×3), kill-floor visual, ambient particles, music loop, 2 SFX variants for impacts, and one signature hazard behaviour.

| Theme | Palette | Kill floor | Signature hazard |
|---|---|---|---|
| Industrial | Steel grey, hazard orange, cyan lights | Acid pool | Crusher / reactor pulse |
| Lava | Charcoal, magma orange, ash | Lava (rising) | Geysers, burning patches |
| Sky | Pale blue, cloud white, gold | Open sky (void) | Wind, gusts |
| Future: Glacier | Ice blue, white, violet | Freezing water | Slippery slopes, ice shards |
| Future: Neon City | Black, magenta, cyan | Electrified rail | Moving billboards, EMP |

---

## 7. Custom games

### 7.1 Lobby

- Host creates a room → 6-character room code + shareable deep link (`superbots.gg/j/ABC123`).
- Up to 8 players. Room stays open while host is connected; host can transfer ownership.
- Lobby shows: player list with chosen bot, team assignment (drag-and-drop or tap-to-cycle), ready state, rules summary.
- Quick chat / emotes only (no free text in v0.1).

### 7.2 Host settings

| Setting | Options | Default |
|---|---|---|
| Mode | Free-for-all · Teams | FFA |
| Team layout | 2v2 · 2v2v2 · 2v2v2v2 · 3v3 · 4v4 · 2v2v2v2 (Large only) | — |
| Map | Any map meeting player-count constraints · Random | Random |
| Plan timer | 10 · 15 · 20 · 30 s | 15 |
| Turn cap | Off · 20 · 30 · 40 | Off |
| On turn cap | Highest HP wins · Sudden Death | Highest HP |
| Power-ups | Off · Low · Normal · High | Normal |
| Power-up pool | Toggle individual power-ups | All on |
| Air strikes | Off · Rare · Normal | Normal |
| Map hazards | On · Off | On |
| Starting HP | 75% · 100% · 150% | 100% |
| Damage | 75% · 100% · 150% | 100% |
| Cooldowns | Normal · Fast (−1 turn) | Normal |
| Bot restrictions | Ban list · Mirror (everyone same bot) · Random assignment | None |
| Friendly fire | On · Off | Off |
| Spectate after death | On · Off | On |

Presets: **Classic**, **Chaos** (High power-ups, Fast cooldowns, 150% damage), **Tactical** (30 s timer, Low power-ups, hazards off), **Mirror Match**.

### 7.3 Team rules

- Teams share a colour and outline; teammate aim guides are visible to each other during Plan.
- Friendly fire off by default: teammates take 0 damage from each other's projectiles but still receive knockback and status effects (keeps positioning skill relevant).
- Team win condition per §3.4.
- Rally Beacon spawns only in team modes.

### 7.4 Disconnects

- Disconnected player has 2 turns to reconnect; their bot auto-skips.
- After 2 turns, bot enters **Sentry mode**: fires a standard missile at the nearest enemy each turn until killed.
- Host disconnect: ownership passes to the longest-connected player.

---

## 8. Controls and UX (mobile first)

- **Aim:** drag anywhere on screen; trajectory preview length by accuracy. Fine-tune: two-finger hold to slow drag sensitivity.
- **Action bar:** four buttons (Jump, Missile, Special 1, Special 2) bottom-right; secondary parameter button appears when relevant (e.g. Pinball bounce count, Bastion Wall angle).
- **Fire:** large button bottom-centre; long-press to lock and preview for teammates.
- **Camera:** pinch-zoom, pan; double-tap to recentre on own bot.
- **Info:** tap any bot to see HP, active effects, cooldowns.
- **Playback controls:** skip-to-end (per player, doesn't affect others), replay last turn.
- **Portrait and landscape** both supported; landscape default.
- Target performance: 60 fps on a 2022 mid-range Android; total initial load < 5 MB.

---

## 9. Technical design

### 9.1 Stack

| Layer | Choice | Rationale |
|---|---|---|
| Rendering | Phaser 3 (WebGL, Canvas fallback) | Mature mobile web support, scene management, tilemap loader. |
| Physics | Planck.js (Box2D port) | Deterministic with fixed timestep; same lib runs on server. |
| Client shell | React + Vite | Lobby, settings, menus. Game canvas mounted inside. |
| Server | Node.js + Colyseus | Rooms, presence, reconnection, state sync out of the box. |
| Language | TypeScript throughout | Shared types and game constants. |
| Shared package | `@superbots/core` | Bot/power-up/map definitions, sim engine, resolution logic. Imported by client and server. |
| Persistence | Postgres (room history, match logs); Redis (live room registry) | Minimal for v0.1. |
| Hosting | Fly.io or Railway for game servers; Cloudflare Pages for client | Low ops overhead; regional deployment. |

### 9.2 Determinism contract

- Fixed timestep 1/60 s; fixed iteration counts.
- All randomness from a per-match seeded PRNG (`seedrandom`); RNG calls in a defined order.
- No floating-point divergence: sim runs only on the server; clients receive the **action log** (positions/events per frame) and replay it. Clients never simulate for authority.
- Action log compressed (delta-encoded, ~2–6 KB per turn at 8 players).

### 9.3 Message flow per turn

```
Server → all:   turn_start { turn, seed, hazards, powerupPreview, deadline }
Client → server: action { type, aim, params }        (once, before deadline)
Server → all:   turn_resolved { log[], stateAfter, eliminations, winner? }
```

### 9.4 Repo layout

```
superbots/
  packages/
    core/        # sim, definitions, resolution — no rendering
    client/      # React shell + Phaser scenes
    server/      # Colyseus rooms
    tools/       # map validator, balance sheet exporter
  assets/
    maps/        # Tiled JSON
    themes/      # per-theme kits
```

---

## 10. Art direction

- **Style:** chunky, high-contrast 2D with thick outlines; readable at small sizes. Slight toy-like proportions.
- **Bots:** silhouettes must be distinguishable at 40 px. Each bot has one signature colour and one signature shape.
- **Teams:** colour-blind-safe team palette (blue, orange, green, purple) plus pattern overlay.
- **VFX:** projectile trails colour-coded by owner team; explosions scale to blast radius exactly (what you see is the hitbox).
- **UI:** dark UI with theme-tinted accents; large touch targets (≥ 48 px).

Everything here is original. No names, character concepts, art, sound, or UI elements are to be borrowed from any existing game.

---

## 11. Roadmap

| Phase | Weeks | Deliverable |
|---|---|---|
| **0. Design lock** | 1–2 | This doc finalised; balance spreadsheet; paper-prototype 3 bots. |
| **1. Sim core** | 3–5 | `@superbots/core` with Jump, Missile, 3 bots, 1 map, headless tests. Deterministic replay verified. |
| **2. Networked prototype** | 6–8 | Colyseus room, 2–4 players, plan/resolve/playback loop, placeholder art. Mobile touch aim working. |
| **3. Lobby & custom rules** | 9–10 | Room codes, teams up to 4, full host settings, presets, reconnect. |
| **4. Content pass 1** | 11–14 | All 8 bots, 10 power-ups, 6 maps, 3 theme kits, Sudden Death. |
| **5. Polish & closed test** | 15–17 | Audio, VFX, tutorial, performance pass, 50-person friends-and-family test. |
| **6. v0.1 release** | 18 | Private-games build live. |

Post-v0.1: spectator mode, destructible terrain experiment, Glacier and Neon City themes, 4 more bots, match replays and sharing.

---

## 12. Balance and playtest plan

- All numbers live in `core/definitions/*.json`; a spreadsheet exporter round-trips them so designers can tune without code.
- Per-bot telemetry: pick rate, win rate, avg damage dealt, avg turns survived, special usage rate.
- Target bands after closed test: win rate 40–60% for every bot; no power-up picked > 2× the median.
- Playtest cadence: twice weekly from Phase 2; 8-player Battle map sessions from Phase 4.

---

## 13. Open questions

1. Confirm baseline turn timer, max players, and team mode existence by playing the reference game.
2. Should Skyla's Updraft-plus-missile count as one action or consume the Missile slot? (Leaning: one combo action, cooldown 2.)
3. Rising lava on Caldera — fixed cadence or accelerate after turn 15?
4. Should aim guides of enemies be visible during Plan (fully hidden vs. show origin only)? Affects Phantom's Smoke Bomb value.
5. Portrait-mode viability on Battle maps — may need to lock landscape for Large maps.
6. Sentry mode aggression — nearest enemy vs. lowest HP enemy?

---

## Appendix A — Damage and HP quick reference

| Source | Damage |
|---|---|
| Standard missile | 25 |
| Self-destruct blast | 30, radius 1.5 |
| Air strike (per bomb, 3 bombs) | 20, radius 1.2 |
| Poison | 10/turn |
| Burn | 8/turn |
| Lava contact | 25/turn while in contact |
| Reactor pulse | 15 |
| Fall out of bounds | Elimination |

## Appendix B — Status effects

| Effect | Applied by | Behaviour | Cleansed by |
|---|---|---|---|
| Poisoned | Toxin, Volt Static Field (no) | 10 dmg/turn, 3 turns | Repair Kit |
| Burning | Magmaw, burning patches | 8 dmg/turn, 2 turns | Entering water; Repair Kit |
| Frozen | Frost | No jump next turn | — |
| Rooted | Warden Anchor Bolt | No jump or dash next turn | — |
| Shocked | Shockwire, Volt Static Field | Specials disabled next turn | Overclock |
| Smoked | Phantom Smoke Bomb | Aim guide hidden; immune to homing | — |
| Amped / Plated | Amp / Plating | ±50% damage | — |
