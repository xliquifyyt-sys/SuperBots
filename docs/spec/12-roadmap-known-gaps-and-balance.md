# 12. Roadmap, known gaps and balance

## Built and verified (build v44)

Full turn loop; 8 bots with passives and 16 specials including two point-target moves; 10 power-ups; 10 maps across 5 themes with painted backgrounds and terrain; 9 hazard types, air strikes, looped edges, teleporter pads, timed mines; teams up to 4, friendly fire, turn cap, Sudden Death; host settings and presets; AI with 3 tiers; body-outline collision; cut-out rig animation for every bot and move; code-driven effects; hit-stop and kill slow motion; synthesized audio for every event; PWA shell; single-file build; headless test harnesses.

## Not built

1. **Online multiplayer, beyond custom games with friends.** Built since v44 (see [docs/ONLINE.md](../ONLINE.md)): guest/Google/Apple accounts, friends by username or friend code, presence, lobby invites, an authoritative Node server that resolves each turn with the same sim and broadcasts actions, per-turn fingerprints, AI takeover on disconnect and reconnect by history replay. Not built: matchmaking or quick-play queues, spectators, emotes or chat, mobile push delivery.
2. **Recorded audio and music.** Everything is synthesized.
3. **Onboarding.** No tutorial.
4. **Progression and retention.** No XP, unlocks, skins, missions or ladders. Botpedia exists.
5. **Native packaging.** No Capacitor or store assets.
6. **Painted effect sheets and projectile sprites.** Supported by the engine, not produced.
7. **Destructible terrain.**

## Parity with Brawlbots: what still separates the two

- Social play (the chat bar and rooms) is the core of Brawlbots; this build has friends, invites and private online custom games but no chat, public rooms or matchmaking.
- Audio quality.
- Per-bot projectile art and painted impact effects (the engine has the slots).
- A first-time flow.

## Balance snapshot

Measured 15 October 2026 after QA-1a (AI fixes for Skyla's Updraft and the AI's point-target moves; no ability numbers changed) with `node test/balance.mjs 3`: AI-versus-AI 1v1 round robin, all 56 ordered pairings x 3 seeds = 168 duels, average 6.9 turns per duel.

| Bot | Win rate | Avg damage dealt per game | In 40-60% band |
|---|---|---|---|
| Bulwark | 60% | 110 | yes |
| Volt | 57% | 107 | yes |
| Warden | 52% | 105 | yes |
| Ricochet | 40% | 100 | yes |
| Magmaw | 36% | 65 | no (low) |
| Phantom | 33% | 78 | no (low) |
| Gravitas | 33% | 75 | no (low) |
| Skyla | 26% | 57 | no (low) |

Four of eight bots are inside the 40 to 60% target band and the spread is 26 to 60% (it was 12 to 69% before QA-1a). With 3 seeds each bot plays 42 duels, so one duel is about 2.4 points; treat differences under about 10 points as noise. The 8-seed run (`node test/balance.mjs 8`) gives Bulwark 51%, Volt 58%, Warden 56%, Ricochet 40%, Gravitas 40%, Magmaw 32%, Skyla 30%, Phantom 29%. The previous snapshot (14 October 2026, `06ac459`: Warden 69%, Bulwark 62%, Volt 55%, Ricochet 52%, Magmaw 45%, Gravitas 29%, Phantom 21%, Skyla 12%) is superseded: Skyla's Updraft rain was hitting Skyla herself, and AI Blinks ignored the spot the planner picked. Refresh with `node test/balance.mjs 3`; the CI gate is `node scripts/ci/balance-gate.mjs 2`.

## Known issues and inconsistencies

- Occasional AI-versus-AI stalemates where two bots mirror jumps until the turn cap (seen once in 300 games).
- The vector rigs in `bots.js` are a fallback only and lag the painted designs.
- Turn-cap HP tiebreak with `onTurnCap: hp` picks the first tied entry rather than declaring a draw.

## Suggested order of remaining work

1. Online beyond friend lobbies: matchmaking, spectators, chat and emotes, then async play on the same authoritative server. The alpha plan in [docs/alpha/](../alpha/ALPHA.md) supersedes this list.
2. Recorded sound set and per-theme music with ducking.
3. Kill and impact polish: KO banner with killer name, per-bot projectile sprites, painted cast bursts.
4. Balance pass with the harness after each tuning change.
5. Tutorial and difficulty ramp.
6. Progression, then store packaging.
