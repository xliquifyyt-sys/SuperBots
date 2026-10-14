# Super Bots alpha — definition of done

Alpha = the whole game, playable online with friends on web, Android and iOS, at Brawl
Bots presentation quality. Monetization comes in the next build and is out of scope.

The alpha ships when every line below is true and verified by a gate, a screenshot set
or a device report recorded in the task that closed it.

## Game
- [ ] All 8 bots with both specials and passives; every bot 40–60% in `balance.mjs 4`.
- [ ] All 10 maps across 5 themes, each at the Ember Pit art bar (painted terrain kit,
      readable solid ground, themed kill floor, hazards with drawn effects).
- [ ] Rule set written down in docs/spec and matching the code (shared win on mutual
      wipe, Sudden Death on turn-cap tie, aim guide 30/55/85%, decided divergences).
- [ ] AI on three tiers; no stalemates in 300-game stress.

## Presentation (the Brawl Bots bar)
- [ ] Every bot has drawn frame clips: idle, jump, land, fire, hit, death, s1, s2.
- [ ] Painted VFX sheets for explosions, KO burst and all 16 specials; projectile sprites.
- [ ] Illustrated, labeled action bar; KO banner naming killer and victim; results screen
      with MVP and per-bot stats; menus in the same illustrated style.
- [ ] Recorded SFX for every event cue and a music loop per theme with ducking.
- [ ] 60 fps p95 on an 8-bot Battle map at 4x CPU throttle; real-device report on one
      mid-range Android and one iPhone.

## Online
- [ ] Accounts (guest, Google, Apple), profile, friends, presence, invites.
- [ ] Private rooms with codes and invite links; quick match (2p and 4p FFA) with a
      rating; reconnect mid-match; spectators; quick chat / emotes in planning.
- [ ] Server-side action validation; zero desyncs in a 200-match scripted swarm.
- [ ] Deployed on Render with persistent data, health check, logs, and a load test of
      100 concurrent clients recorded.

## Product
- [ ] 60-second interactive tutorial; difficulty ramp for new players.
- [ ] Progression without payment: XP, levels, bot unlocks by play, per-bot mastery,
      daily missions, seasonal ladder, profile stats.
- [ ] Settings: audio, haptics, graphics quality, language-ready strings.
- [ ] Android and iOS builds from CI; internal testing tracks (Play internal testing,
      TestFlight) live; privacy policy and data-safety answers drafted; crash reporting.

## Gates that must be green on main
determinism, rules, headless, features, bughunt, balance band, online, online-browser,
browser smoke, Android debug build.
