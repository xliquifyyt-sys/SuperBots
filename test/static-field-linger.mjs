// Volt's Static Field (spec 06: "radius 3, 2 turn counters; applies Shocked at end of turn to anyone
// inside") stays on the map, drawn as a crackling yellow disc, for the whole next turn. A bot that is
// inside it at that second cleanup must be Shocked too, otherwise the field the player sees is inert
// (QA-45). Also checks the first cleanup still shocks a bot inside.
// Usage: node test/static-field-linger.mjs   (exit 1 on any failure; not a CI gate yet)
import { Match } from '../src/core/match.js';
import { BOTS } from '../src/core/defs.js';

const players = [
  { name: 'A', botId: 'volt', team: 0, isAI: true }, { name: 'B', botId: 'warden', team: 1, isAI: true },
];
const settings = { map: 'emberpit', mode: 'ffa', hazards: false, powerups: 'off', airStrikes: 'off', planTimer: 15, turnCap: 0 };
let failed = 0;
const check = (ok, msg) => { if (!ok) failed++; console.log(ok ? 'ok  ' : 'FAIL', msg); };

// Field exactly as World.impact() leaves it for a Static Field shell, centred on the target bot.
const place = (w, at) => w.fields.push({ x: at.x, y: at.y, r: BOTS.volt.s2.radius, turns: 2, kind: 'static' });

// 1. Bot inside at the first cleanup -> Shocked.
{
  const m = new Match(players, settings, 11); m.start();
  const w = m.world, t = w.bots[1];
  place(w, t); w.endTurn();
  check(w.hasEffect(t, 'shocked'), `first cleanup: bot inside the field is Shocked (effects ${JSON.stringify(t.effects)})`);
}
// 2. Field still drawn next turn; a bot standing in it at the second cleanup -> Shocked.
{
  const m = new Match(players, settings, 11); m.start();
  const w = m.world, t = w.bots[1];
  place(w, { x: t.x + 20, y: t.y });              // field lands away from the bot
  w.endTurn(); w.startTurn();
  const live = w.fields.some((f) => f.kind === 'static');
  check(live, `field still on the map (and rendered) during the next turn: ${live}`);
  const f = w.fields.find((q) => q.kind === 'static');
  if (f) { t.x = f.x; t.y = f.y; }                  // bot walks into the visible field
  t.effects = {};
  w.endTurn();
  check(w.hasEffect(t, 'shocked'), `second cleanup: bot that moved into the still-visible field is Shocked (effects ${JSON.stringify(t.effects)})`);
}
console.log(failed ? `\n${failed} static field check(s) failed` : '\nall static field checks pass');
process.exit(failed ? 1 : 0);
