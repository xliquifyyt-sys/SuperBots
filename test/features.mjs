// Coverage test: across a batch of headless matches, every special, power-up,
// hazard and rule must show up in the event log at least once.
import { Match } from '../src/core/match.js';
import { BOTS, BOT_IDS, POWERUP_IDS } from '../src/core/defs.js';
import { TURN } from '../src/core/defs.js';
import { MAP_IDS } from '../src/core/maps.js';

const seen = { specials: new Set(), powerups: new Set(), events: new Set(), maps: new Set(), effects: new Set(), causes: new Set(), winTypes: new Set() };
let matches = 0, errors = 0;
const t0 = Date.now();
for (let i = 0; i < 90; i++) {
  const n = 2 + (i % 7);
  const players = Array.from({ length: n }, (_, k) => ({ name: 'P' + k, botId: BOT_IDS[(i + k * 3) % BOT_IDS.length], team: k % 2, isAI: true }));
  const teams = i % 2 === 0 && n % 2 === 0;
  const settings = { mode: teams ? 'teams' : 'ffa', map: MAP_IDS[i % MAP_IDS.length], aiDifficulty: 'hard', powerups: 'high', airStrikes: 'normal', turnCap: i % 5 === 0 ? 20 : 0, onTurnCap: i % 10 === 0 ? 'suddenDeath' : 'hp', cooldowns: i % 4 === 0 ? 'fast' : 'normal', friendlyFire: i % 6 === 0 };
  try {
    const r = Match.simulateHeadless(players, settings, 5000 + i);
    matches++;
    seen.maps.add(r.map);
    if (r.winner) seen.winTypes.add(r.winner.type + (r.winner.byCap ? '/cap' : ''));
    for (const l of r.log) for (const e of l.events) {
      seen.events.add(e.type);
      if (e.type === 'special') seen.specials.add(e.name);
      if (e.type === 'pickup') seen.powerups.add(e.id);
      if (e.type === 'effect') seen.effects.add(e.effect);
      if (e.type === 'eliminated') seen.causes.add(e.cause);
    }
  } catch (e) { errors++; console.log('ERROR', i, e.stack.split('\n').slice(0, 3).join(' | ')); }
}
// A same-turn wipe is a shared win, so this batch may never see Sudden Death.
// The remaining trigger is a turn-cap tie. Cover it explicitly.
{
  const m = new Match(
    [{ name: 'A', botId: 'volt', team: 0, isAI: true }, { name: 'B', botId: 'warden', team: 1, isAI: true }],
    { map: 'emberpit', hazards: false, powerups: 'off', airStrikes: 'off', turnCap: 1, onTurnCap: 'suddenDeath' },
    1,
  );
  m.start();
  m.turn = 2;
  m.world.bots[0].hp = 50;
  m.world.bots[1].hp = 50;
  m.checkWin();
  if (m.world.suddenDeath && m.world.events.some((e) => e.type === 'suddenDeath')) seen.events.add('suddenDeath');
  else { errors++; console.log('ERROR turn-cap tie did not enter Sudden Death'); }
}

// D-2: a power-up lasts TURN.powerupExpire turns counting its spawn turn, counts down with a
// powerupCountdown event each turn start, and is removed with a powerupExpire event.
{
  const m = new Match(
    [{ name: 'A', botId: 'volt', team: 0, isAI: true }, { name: 'B', botId: 'warden', team: 1, isAI: true }],
    { map: 'emberpit', hazards: false, powerups: 'high', airStrikes: 'off' },
    7,
  );
  m.start();
  const w = m.world;
  let pu = null, spawnTurn = 0, ok = true;
  const counts = [];
  for (let k = 0; k < 20 && ok; k++) {
    w.startTurn();
    if (!pu) {
      if (w.powerups.length) { pu = w.powerups[0]; spawnTurn = w.turn; if (pu.turnsLeft !== TURN.powerupExpire) ok = false; }
      continue;
    }
    const cd = w.events.find((e) => e.type === 'powerupCountdown' && e.id === pu.id);
    const ex = w.events.find((e) => e.type === 'powerupExpire' && e.id === pu.id);
    if (ex) {
      if (w.turn - spawnTurn !== TURN.powerupExpire || w.powerups.includes(pu)) ok = false;
      else { seen.events.add('powerupExpire'); }
      break;
    }
    if (!cd || cd.turnsLeft !== TURN.powerupExpire - (w.turn - spawnTurn) || !w.powerups.includes(pu)) { ok = false; break; }
    counts.push(cd.turnsLeft);
  }
  if (ok && pu && counts.join(',') === Array.from({ length: TURN.powerupExpire - 1 }, (_, i) => TURN.powerupExpire - 1 - i).join(',') && seen.events.has('powerupExpire')) seen.events.add('powerupCountdown');
  else { errors++; console.log('ERROR power-up expiry (D-2): spawn turn', spawnTurn, 'countdown', counts.join(','), 'ok', ok); }
}

// wallHit needs a projectile weaker than one wall segment, and only Blink Strike shards (8 vs 10 HP)
// are. The batch above may never put a shard into a wall, so cover it with real actions:
// Bulwark walls itself off, Phantom blinks to the far side, and its shards lock on to Bulwark.
{
  const m = new Match(
    [{ name: 'A', botId: 'bulwark', team: 0 }, { name: 'B', botId: 'phantom', team: 1 }],
    { map: 'frozenkeel', hazards: false, powerups: 'off', airStrikes: 'off' },
    3,
  );
  m.start();
  const w = m.world;
  w.bots[0].x = 9; w.bots[0].y = 7.6; w.bots[1].x = 21; w.bots[1].y = 7.6; w.settle();
  m.beginPlan();
  m.submitAction(0, { type: 's1', aim: { dx: 1, dy: 0, power: 1, tx: 11, ty: 7.4 }, locked: true });
  m.submitAction(1, { type: 's1', aim: { dx: -1, dy: 0, power: 1, tx: 13, ty: 7.6 }, locked: true });
  m.beginResolve();
  w.runToEnd();
  if (w.events.some((e) => e.type === 'wallHit')) seen.events.add('wallHit');
  else { errors++; console.log('ERROR Blink Strike shards into a Bastion Wall did not emit wallHit'); }
}

const allSpecials = BOT_IDS.flatMap((id) => [BOTS[id].s1.name, BOTS[id].s2.name]);
const missingSpecials = allSpecials.filter((s) => !seen.specials.has(s));
const missingPowerups = POWERUP_IDS.filter((p) => !seen.powerups.has(p));
const wantEvents = ['explosion', 'damage', 'eliminated', 'pickup', 'jump', 'fire', 'beam', 'blink', 'gale', 'crusher', 'geyser', 'reactorPulse', 'airstrike', 'toxic', 'singularity', 'reflect', 'wallBreak', 'bounce', 'contact', 'suddenDeath', 'split', 'patch', 'teleport', 'deflector', 'wallHit'];
wantEvents.push('powerupCountdown', 'powerupExpire');
const missingEvents = wantEvents.filter((e) => !seen.events.has(e));
console.log(`${matches} matches, ${errors} errors, ${Date.now() - t0}ms`);
console.log('maps:', [...seen.maps].join(', '));
console.log('win types:', [...seen.winTypes].join(', '));
console.log('elimination causes:', [...seen.causes].join(', '));
console.log('effects seen:', [...seen.effects].join(', '));
console.log('specials missing:', missingSpecials.length ? missingSpecials.join(', ') : 'none');
console.log('power-ups missing:', missingPowerups.length ? missingPowerups.join(', ') : 'none');
console.log('events missing:', missingEvents.length ? missingEvents.join(', ') : 'none');
if (errors || missingSpecials.length || missingPowerups.length || missingEvents.length) process.exit(1);
