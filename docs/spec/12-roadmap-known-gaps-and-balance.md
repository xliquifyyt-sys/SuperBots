# 12. Roadmap, known gaps and balance

## Built and verified (build v44)

Full turn loop; 8 bots with passives and 16 specials including two point-target moves; 10 power-ups; 10 maps across 5 themes with painted backgrounds and terrain; 9 hazard types, air strikes, looped edges, teleporter pads, timed mines; teams up to 4, friendly fire, turn cap, Sudden Death; host settings and presets; AI with 3 tiers; body-outline collision; cut-out rig animation for every bot and move; code-driven effects; hit-stop and kill slow motion; synthesized audio for every event; PWA shell; single-file build; headless test harnesses.

## Not built

1. **Online multiplayer.** Rooms, room codes, lobby sync, action submission, authoritative resolution or lockstep replay, reconnection, spectators, emotes. The sim is deterministic and headless, which is the hard part; the networking layer does not exist.
2. **Recorded audio and music.** Everything is synthesized.
3. **Onboarding.** No tutorial.
4. **Progression and retention.** No XP, unlocks, skins, missions or ladders. Botpedia exists.
5. **Native packaging.** No Capacitor or store assets.
6. **Painted effect sheets and projectile sprites.** Supported by the engine, not produced.
7. **Destructible terrain.**

## Parity with Brawlbots: what still separates the two

- Social play (the chat bar and rooms) is the core of Brawlbots; this build is single-player.
- Audio quality.
- Per-bot projectile art and painted impact effects (the engine has the slots).
- A first-time flow.

## Balance snapshot

Last measured AI-versus-AI 1v1 round robin before the v41 ability pass: Warden 74%, Volt 64%, Bulwark 62%, Skyla 48%, Phantom 40%, Ricochet 38%, Gravitas 38%, Magmaw 33%. The v41 changes (Shockwave radius 5, Pinball 35, Blink anywhere, Gale 15 reach and 20 push, Static Field 2-turn shock, Slam radius 3.5, Wall 10 HP) have not been re-measured. Target band is 40 to 60%. Run `node test/balance.mjs 4` to refresh.

## Known issues and inconsistencies

- Chain Arc hit test uses a 0.75 circle around each bot instead of the body outline.
- Bulwark's knockback immunity applies wherever its wall stands, even far away.
- Occasional AI-versus-AI stalemates where two bots mirror jumps until the turn cap (seen once in 300 games).
- The vector rigs in `bots.js` are a fallback only and lag the painted designs.
- Turn-cap HP tiebreak with `onTurnCap: hp` picks the first tied entry rather than declaring a draw.

## Suggested order of remaining work

1. Online rooms (private codes first), then async play on the same lockstep.
2. Recorded sound set and per-theme music with ducking.
3. Kill and impact polish: KO banner with killer name, per-bot projectile sprites, painted cast bursts.
4. Balance pass with the harness after each tuning change.
5. Tutorial and difficulty ramp.
6. Progression, then store packaging.
