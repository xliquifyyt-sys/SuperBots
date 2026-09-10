// Deep bug hunt (node tools/bughunt.mjs [gamesPerMap]): many matches per map with per-turn invariants and flow stats.
import { Match } from '../src/core/match.js';
import { MAPS, MAP_IDS } from '../src/core/maps.js';
import { BOT_IDS, PHYS } from '../src/core/defs.js';

const PER_MAP = Number(process.argv[2] || 30);
const R = PHYS.botRadius;
const issues = {};           // key -> [examples]
const note = (k, ex) => { (issues[k] ||= []); if (issues[k].length < 5) issues[k].push(ex); issues[k].n = (issues[k].n || 0) + 1; };
const flow = {};             // map -> stats

function insideRect(x, y, rc, pad = 0) { return x > rc.x + pad && x < rc.x + rc.w - pad && y > rc.y + pad && y < rc.y + rc.h - pad; }
function rectUnder(map, x, y) { // rect whose top the point stands on
  for (const rc of map.terrain) if (x >= rc.x - 0.1 && x <= rc.x + rc.w + 0.1 && Math.abs((y + R) - rc.y) < 0.15) return rc;
  return null;
}

for (const mapId of MAP_IDS) {
  const map = MAPS[mapId];
  const F = flow[mapId] = { games: 0, turns: [], deaths: {}, stood: new Set(), dmgPerTurn: 0, turnsTotal: 0, longTurns: 0, maxSteps: 0, pickups: 0, padUses: 0, wrapUses: 0, stuck: 0, idleTurns: 0, aliveTurns: 0 };
  for (let g = 0; g < PER_MAP; g++) {
    const n = Math.min(map.maxPlayers, 2 + (g % (map.maxPlayers - 1)));
    const roster = [];
    for (let i = 0; i < n; i++) roster.push({ name: 'P' + i, botId: BOT_IDS[(g * 5 + i * 3) % BOT_IDS.length], team: i, isAI: true, diff: ['medium', 'hard', 'easy'][(g + i) % 3] });
    const seed = 5000 + g * 13 + MAP_IDS.indexOf(mapId);
    let m;
    try {
      m = new Match(roster, { mode: 'ffa', map: mapId, turnCap: 60 }, seed);
      m.start();
    } catch (e) { note('start-crash', `${mapId} g${g}: ${e.message}`); continue; }
    const w = m.world;
    const lastPos = new Map(); const still = new Map();
    let guard = 0, turns = 0;
    try {
      while (m.phase !== 'over' && guard++ < 400) {
        if (m.phase === 'announce') m.beginPlan();
        else if (m.phase === 'plan') m.beginResolve();
        else if (m.phase === 'resolve') {
          let steps = 0; const hpBefore = w.bots.map((b) => b.hp);
          while (!w.step(PHYS.dt)) { if (++steps > 60 * 40) { note('turn-never-ends', `${mapId} g${g} t${w.turn}`); break; } }
          F.maxSteps = Math.max(F.maxSteps, steps); if (steps > 60 * 14) F.longTurns++;
          turns++; F.turnsTotal++;
          const dealt = w.bots.reduce((s, b, i) => s + Math.max(0, hpBefore[i] - b.hp), 0); F.dmgPerTurn += dealt;
          if (dealt === 0) F.idleTurns++;
          // per-turn invariants
          for (const ev of w.events) {
            if (ev.type === 'eliminated') F.deaths[ev.cause] = (F.deaths[ev.cause] || 0) + 1;
            if (ev.type === 'teleport') { if (ev.to) F.padUses++; else F.wrapUses++; }
            if (ev.type === 'pickup') F.pickups++;
          }
          for (const b of w.bots) {
            if (!b.alive) continue;
            F.aliveTurns++;
            if (!Number.isFinite(b.x) || !Number.isFinite(b.y)) { note('nan-position', `${mapId} g${g} t${w.turn} ${b.botId}`); continue; }
            if (b.y + R > w.lavaY + 0.01) note('alive-below-floor', `${mapId} g${g} t${w.turn} ${b.botId} y=${b.y.toFixed(2)} floor=${w.lavaY}`);
            if (!map.teleporters && (b.x < -0.5 || b.x > map.width + 0.5)) note('alive-out-of-bounds', `${mapId} g${g} t${w.turn} ${b.botId} x=${b.x.toFixed(2)}`);
            for (const rc of map.terrain) if (insideRect(b.x, b.y, rc, R * 0.6)) note('bot-embedded', `${mapId} g${g} t${w.turn} ${b.botId} at ${b.x.toFixed(1)},${b.y.toFixed(1)} in rect ${rc.x},${rc.y} ${rc.w}x${rc.h}`);
            if (!b.grounded && b.y < w.lavaY - 1) { /* airborne at turn end is fine (falling into pit resolves next turn) */ }
            const rc = rectUnder(map, b.x, b.y); if (rc) F.stood.add(map.terrain.indexOf(rc));
            const lp = lastPos.get(b.id);
            if (lp && Math.hypot(lp[0] - b.x, lp[1] - b.y) < 0.05) { still.set(b.id, (still.get(b.id) || 0) + 1); if (still.get(b.id) === 10) { F.stuck++; note('bot-still-10-turns', `${mapId} g${g} t${w.turn} ${b.botId} at ${b.x.toFixed(1)},${b.y.toFixed(1)} hp=${b.hp}`); } }
            else still.set(b.id, 0);
            lastPos.set(b.id, [b.x, b.y]);
          }
          for (const pu of w.powerups) {
            if (pu.y > w.lavaY - 0.3) note('powerup-below-floor', `${mapId} g${g} t${w.turn} ${pu.id || pu.name} y=${pu.y.toFixed(2)}`);
            for (const rc of map.terrain) if (insideRect(pu.x, pu.y, rc, 0.2)) note('powerup-embedded', `${mapId} g${g} t${w.turn} ${pu.id || pu.name} at ${pu.x.toFixed(1)},${pu.y.toFixed(1)}`);
          }
          for (const mn of w.mines) { if (!mn.alive) continue; for (const rc of map.terrain) if (insideRect(mn.x, mn.y, rc, 0.2)) note('mine-embedded', `${mapId} g${g} t${w.turn} mine at ${mn.x.toFixed(1)},${mn.y.toFixed(1)}`); if (mn.y > w.lavaY) note('mine-below-floor', `${mapId} g${g} t${w.turn}`); }
          m.beginCleanup();
        }
        else if (m.phase === 'cleanup') m.beginAnnounce();
      }
    } catch (e) { note('crash', `${mapId} g${g} t${w.turn}: ${e.stack.split('\n').slice(0, 2).join(' | ')}`); continue; }
    F.games++; F.turns.push(turns);
    if (turns >= 60) note('turn-cap', `${mapId} g${g} n=${n} alive=${w.bots.filter((b) => b.alive).map((b) => b.botId + '@' + b.x.toFixed(0) + ',' + b.y.toFixed(0)).join(' ')}`);
    if (m.phase !== 'over') note('guard-exhausted', `${mapId} g${g}`);
  }
}

console.log(`=== BUG HUNT: ${PER_MAP} games x ${MAP_IDS.length} maps ===`);
const keys = Object.keys(issues);
if (!keys.length) console.log('no invariant violations');
for (const k of keys) { console.log(`\n[${k}] x${issues[k].n}`); for (const ex of issues[k]) console.log('   ', ex); }
console.log('\n=== FLOW ===');
for (const mapId of MAP_IDS) {
  const F = flow[mapId], map = MAPS[mapId];
  const avg = F.turns.reduce((a, b) => a + b, 0) / Math.max(1, F.turns.length);
  const unused = map.terrain.map((rc, i) => (F.stood.has(i) || rc.step) ? null : `${rc.x},${rc.y} ${rc.w}x${rc.h}`).filter(Boolean);
  const d = Object.entries(F.deaths).map(([k, v]) => `${k}:${v}`).join(' ');
  console.log(`${mapId.padEnd(14)} games ${F.games} avgTurns ${avg.toFixed(1)} maxTurns ${Math.max(...F.turns)} dmg/turn ${(F.dmgPerTurn / Math.max(1, F.turnsTotal)).toFixed(1)} idleTurns ${(100 * F.idleTurns / Math.max(1, F.turnsTotal)).toFixed(0)}% longTurns ${F.longTurns} maxSteps ${F.maxSteps} pickups ${F.pickups} pads ${F.padUses} wraps ${F.wrapUses} stuck ${F.stuck}`);
  console.log(`   deaths: ${d || 'none'}`);
  if (unused.length) console.log(`   never stood on: ${unused.join(' | ')}`);
}
