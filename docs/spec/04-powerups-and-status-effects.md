# 04. Power-ups and status effects

## Spawn rules (implemented)

- Candidate positions are the map's `powerups` list. A position is free when no power-up sits within 0.5 of it. The chosen point is lifted straight up until a 0.45 circle is clear of terrain.
- Spawning happens at turn start from turn 2 onward, never during Sudden Death, and only while the count on the field is below the cap: 3 on Standard maps, 5 on Battle maps.
- Spawn chance per turn by host setting: Off 0; Low 0.25 (Standard) or 0.35 (Battle); Normal 0.5 or 1.0; High 1.0.
- Type selection is weighted (table below) over the pool minus: types already on the field (each type at most once), types the host disabled in the power-up pool, and Rally Beacon outside Teams mode.
- Power-ups never expire. They are collected the instant a bot's body comes within 0.6 of them during a resolve, and buffs apply immediately mid-turn.
- Gale Shot slides power-ups in its cone 3.5 units along the aim and drops them back to the ground.

## Catalogue

| Power-up | Kind | Weight | Turns | Effect |
|---|---|---|---|---|
| Repair Kit (`repair`) | instant | 12 | - | +40 HP (capped at max). Also clears Poison and Burn. |
| Overclock (`overclock`) | instant | 8 | - | Both special cooldowns to 0. Also clears Shocked. |
| Amp (`amp`) | buff | 8 | 4 | +50% damage dealt. Counter 4 (this turn plus three). |
| Plating (`plating`) | buff | 8 | 4 | -50% damage taken. Counter 4. |
| Toxin (`toxin`) | contact | 6 | 4 | Held for 4 turns; the next bot touched is Poisoned (3 counters). |
| Frost (`frost`) | contact | 6 | 4 | Held for 4 turns; the next bot touched is Frozen (2 counters). |
| Thrusters (`thrusters`) | buff | 7 | 4 | Jump distance x1.75 (speed x sqrt(1.75)). Counter 4. |
| Reflector Coat (`reflector`) | buff | 5 | 2 | The first projectile to hit the bot each turn is reflected back along its path and becomes the bot's own. Counter 2 (this turn and next). |
| Shockwire (`shockwire`) | contact | 5 | 4 | Held for 4 turns; the next bot touched is Shocked (2 counters). |
| Rally Beacon (`rally`) | buff, teams only | 6 | 2 | Every living teammate and the picker: +20 HP (overheal above max up to 20, decaying 10 per turn) and +10% damage (counter 3). |

Icons and colours (for the HUD): repair `+` #5cff7a, overclock `⟳` #5ff2ff, amp `▲` #ff7a2f, plating `◆` #c0c8d8, toxin `☠` #9dff2f, frost `❄` #b5f4ff, thrusters `⇈` #ffd84f, reflector `◐` #e8f0ff, shockwire `⚡` #ffe23a, rally `★` #ff9cf0.

## Stacking rules

- Picking the same buff again refreshes its counter to the larger value; no stacking of magnitude.
- Amp and Plating coexist.
- Only one contact charge is held at a time; a new contact pickup replaces the previous one.
- Contact charges are consumed by the first bot-bot contact of any kind, including a teammate.
- Rally overheal: HP can sit up to 20 above max; each turn start it decays by 10 toward max.

## Status effects

See the table in 02 for counters and behaviour. In short:

| Effect | Does | Blocks |
|---|---|---|
| Poison | 10 per turn start | |
| Burn | 8 at next turn start (Magmaw immune) | |
| Frozen / Rooted | | Jump, Molten Slam, Updraft, Blink Strike |
| Shocked | | Special 1 and Special 2 |
| Amp / Plating / Thrusters / Reflector / Rally | modifiers above | |

The HUD shows a floating label when an effect is applied ("POISON", "SHOCKED"...) and lists active effects in the bot info panel. The action bar greys out blocked actions during planning.
