// Coverage test: across a batch of headless matches, every special, power-up,
// hazard and rule must show up in the event log at least once.
import { Match } from '../src/core/match.js';
import { BOTS, BOT_IDS, POWERUP_IDS } from '../src/core/defs.js';
import { TURN } from '../src/core/defs.js';
import { PHYS } from '../src/core/defs.js';
import { MAP_IDS } from '../src/core/maps.js';
import { polyPush } from '../src/core/sim.js';

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

// M0-12: two bots through Nimbus rescue vents in the same turn (both vents share one exit),
// and a bot sent to an exit another bot already stands on, all end the turn outside terrain
// (hull more than 0.25 inside a solid fails) and not stacked inside each other.
{
  const rp = (rc) => [[rc.x, rc.y], [rc.x + rc.w, rc.y], [rc.x + rc.w, rc.y + rc.h], [rc.x, rc.y + rc.h]];
  // place(w) runs before the resolve; late(w) runs mid-resolve just before the minimum resolve time
  // is about to pass, so a late arrival can be the last thing that happens before the turn ends.
  const ventCase = (label, ids, place, late) => {
    const m = new Match(ids.map((botId, k) => ({ name: 'V' + k, botId, team: k, isAI: true })), { map: 'nimbus', hazards: false, powerups: 'off', airStrikes: 'off' }, 12);
    m.start();
    const w = m.world;
    w.startTurn();
    place(w);
    for (const b of w.bots) w.submit(b.id, { type: 'skip' });
    w.resolve();
    let ended = false;
    while (late && !ended && w.time < TURN_LATE) ended = w.step(PHYS.dt);
    if (late && !ended) late(w);
    if (!ended) w.runToEnd();
    const tps = w.events.filter((e) => e.type === 'teleport' && e.from).length;
    let bad = '';
    for (const b of w.bots) {
      if (!b.alive) { bad += ` ${b.botId} died`; continue; }
      for (const rc of w.physTerrain) { const h = polyPush(w.botPoly(b), rp(rc)); if (h && h.depth > 0.25) bad += ` ${b.botId} ${h.depth.toFixed(2)} inside R(${rc.x},${rc.y})`; }
    }
    const [a, c] = w.bots;
    if (a.alive && c.alive) { const h = polyPush(w.botPoly(a), w.botPoly(c)); if (h && h.depth > 0.25) bad += ` bots overlap ${h.depth.toFixed(2)}`; }
    if (bad || tps < (label === 'same step' ? 2 : 1)) { errors++; console.log(`ERROR rescue vent (M0-12, ${label}): teleports ${tps}${bad}`); }
  };
  const drop = (b, x, y) => { b.x = x; b.y = y; b.vx = 0; b.vy = 0; b.grounded = false; };
  const TURN_LATE = PHYS.minSimTime - 2 * PHYS.dt;
  // Both vents fire on the same step: Gravitas through the left vent, Volt through the right.
  ventCase('same step', ['gravitas', 'volt'], () => {}, (w) => { drop(w.bots[0], 5, 19.4); drop(w.bots[1], 44, 19.4); });
  // Volt arrives a moment after Gravitas through the same vent (the bughunt seed 9402 repro).
  ventCase('same vent', ['gravitas', 'volt'], (w) => { drop(w.bots[0], 5, 19.4); drop(w.bots[1], 30, 18.3); }, (w) => drop(w.bots[1], 5, 19.4));
  // Warden already stands on the exit; Skyla comes through the vent (QA-1a repro).
  ventCase('occupied exit', ['warden', 'skyla'], (w) => { drop(w.bots[0], 25, 7.3); drop(w.bots[1], 30, 18.3); }, (w) => drop(w.bots[1], 5, 19.4));
}

// QA-1d (found again by M0-12's bughunt run): a timed spike mine's spot never overlaps a block.
{
  let bad = 0, n = 0;
  for (const mapId of MAP_IDS) {
    const m = new Match([{ name: 'A', botId: 'volt', team: 0, isAI: true }, { name: 'B', botId: 'warden', team: 1, isAI: true }], { map: mapId, powerups: 'off', airStrikes: 'off' }, 31);
    const w = m.world;
    for (let k = 0; k < 400; k++) {
      const pt = w.mineSpot();
      if (!pt) continue;
      n++;
      if (w.map.terrain.some((rc) => { const px = Math.max(rc.x, Math.min(pt.x, rc.x + rc.w)), py = Math.max(rc.y, Math.min(pt.y - 0.15, rc.y + rc.h)); return Math.hypot(pt.x - px, pt.y - 0.15 - py) < PHYS.mineClearance; })) bad++;
    }
  }
  if (bad || n < 1000) { errors++; console.log(`ERROR mine spot (QA-1d): ${bad} of ${n} sampled spots overlap a block`); }
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
