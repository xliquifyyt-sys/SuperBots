# 10. Audio

`src/audio.js` is a WebAudio synthesizer with rate-limited voices; there are no recorded samples yet. The in-game controller maps simulation events to sounds (`GameController._sound`) and the UI plays its own ticks. Replace the synth voices with recorded files by keeping the same function names.

## Event to sound map

| Event | Sound | Notes |
|---|---|---|
| fire | fire | short noise burst with a pitch drop |
| special | special(name) | per-special timbre keyed by name |
| jump | jump | rising tone |
| land | land(hard) | thud, louder when the landing is hard |
| damage (amount > 0) | hit | impact click |
| explosion | explosion(big) | low boom, longer for big |
| eliminated | ko | descending stinger |
| pickup | pickup | bright arpeggio |
| powerupSpawn | powerupSpawn | soft chime |
| beam | beam | electric buzz |
| blink | blink | whoosh and shimmer |
| gale | gale | wind swell |
| deflector | shield | hum |
| reflect | reflect | ping |
| split | split | triple pop |
| bounce | bounce | boing |
| splash | splash(kind) | lava hiss, water splash, void whoosh, neon zap |
| toxic | toxicTick | bubbling |
| singularity | singularityPull | low drone |
| wallHit / wallBreak | wallHit / wallBreak | clank / shatter |
| effect | effect(kind) | per-status sting |
| contact | contact | zap |
| mine / mineSpawn | mine / mineSpawn | blast / arming beep |
| geyser | geyser | steam burst |
| lavaSurf | lavaSurf | sizzle |
| patch | patch | crackle |
| crusher | crusher | heavy slam |
| reactorPulse | reactor | pulse |
| teleport | teleport(viaPad) | two-tone warp |
| airstrike | airstrike | siren |
| bomb | bombWhistle | falling whistle per bomb |
| suddenDeath | sudden | alarm |

UI: `ui()` on button presses, `tick()` on the last 5 seconds of the plan timer, `battleStart()` on the opening splash, `gust()` and `lavaRise()` when those hazards are announced.

## Design notes for a recorded set

- Per-bot missile fire variants (8), an explosion family by radius (small, medium, big), and impact variants by surface (rock, ice, metal, cloud).
- Specials need one cast sound each (16) and a few impact sounds (siege impact, static crackle, anchor thunk, toxic hiss, singularity drone, shockwave boom, gale whoosh, blink in and out, pinball bounce, split pop).
- Status effect stings for poison, burn, frozen, rooted, shocked, amp, plating.
- UI: tick, lock, button, timer warning, battle start, KO stinger, victory and defeat fanfares.
- Music: one loop per theme (lava, ice, jungle, sky, neo), ducked during playback, with a Sudden Death variant.
- Rate limiting: the same voice should not retrigger within about 40 ms (8 bots firing at once).
