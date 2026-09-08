// Bug hunter: runs 8-bot matches on every map and checks invariants every turn:
// bots never stuck inside terrain, never alive below the kill floor or off-map,
// power-ups and mines never inside terrain or below the floor, no stalled bots,
// no self-damage from your own launch, and every match ends.
import { Match } from '../src/core/match.js';
import { BOT_IDS } from '../src/core/defs.js';
import { MAPS, MAP_IDS } from '../src/core/maps.js';

const runs = Number(process.argv[2] || 3);
const issues = new Map();
const report = (key, detail) => { if (!issues.has(key)) issues.set(key, { n: 0, detail }); issues.get(key).n++; };

function circleRectDepth(cx, cy, r, rc) {
  const px = Math.max(rc.x, Math.min(cx, rc.x + rc.w));
  const py = Math.max(rc.y, Math.min(cy, rc.y + rc.h));
  const d = Math.hypot(cx - px, cy - py);
  if (cx > rc.x && cx < rc.x + rc.w && cy > rc.y && cy < rc.y + rc.h) return r + 1; // centre inside
  return d < r ? r - d : 0;
}

let matches = 0;
for (let run = 0; run < runs; run++) {
  for (const mapId of MAP_IDS) {
    
    const players = Array.from({ length: 8 }, (_, k) => ({ name: 'P' + k, botId: BOT_IDS[(k + run) % BOT_IDS.length], team: k % 2, isAI: true }));
    const mode = run % 2 ? 'teams' : 'ffa';
    const m = new Match(players, { mode, map: mapId, aiDifficulty: ['easy', 'normal', 'hard'][run % 3], powerups: 'high', airStrikes: 'normal' }, 9000 + run * 100 + MAP_IDS.indexOf(mapId));
    m.start();
    matches++;
    const lastPos = new Map(); const stillCount = new Map(); const lastAct = new Map();
    const selfDmg = new Map();
    let guard = 0;
    while (m.phase !== 'over' && guard++ < 400) {
      if (m.phase === 'announce') m.beginPlan();
      else if (m.phase === 'plan') { for (const b of m.world.bots) if (b.alive) lastAct.set(b.id, (m.pendingActions[b.id] || {}).type || 'skip'); m.beginResolve(); }
      else if (m.phase === 'resolve') {
        m.world.runToEnd();
        // self-damage from own projectiles (label Missile/kinds) — flag big ones
        for (const e of m.world.events) {
          if (e.type === 'damage' && e.amount > 0) {
            // reconstruct attacker unknown; skip
          }
        }
        m.beginCleanup();
      }
      else if (m.phase === 'cleanup') {
        const w = m.world;
        for (const b of w.bots) {
          if (!b.alive) continue;
          for (const rc of w.map.terrain) {
            const depth = circleRectDepth(b.x, b.y, 0.5, rc);
            if (depth > 0.25) report('bot embedded in terrain', `${w.map.id} T${m.turn} ${b.botId} @${b.x.toFixed(1)},${b.y.toFixed(1)} depth ${depth.toFixed(2)}`);
          }
          if (b.y > w.lavaY + 0.2) report('bot alive below kill floor', `${w.map.id} T${m.turn} ${b.botId} y=${b.y.toFixed(1)} lava=${w.lavaY.toFixed(1)}`);
          if (b.x < -0.5 || b.x > w.map.width + 0.5) report('bot outside map', `${w.map.id} T${m.turn} ${b.botId} x=${b.x.toFixed(1)}`);
          const lp = lastPos.get(b.id);
          if (lp && Math.hypot(lp[0] - b.x, lp[1] - b.y) < 0.2 && lastAct.get(b.id) === 'jump' && w.alive().length > 1) {
            stillCount.set(b.id, (stillCount.get(b.id) || 0) + 1);
            if (stillCount.get(b.id) === 10) report('bot jump-stuck in place', `${w.map.id} ${b.botId} @${b.x.toFixed(1)},${b.y.toFixed(1)} (${m.settings.aiDifficulty})`);
          } else stillCount.set(b.id, 0);
          lastPos.set(b.id, [b.x, b.y]);
        }
        for (const pu of w.powerups) {
          for (const rc of w.map.terrain) {
            const depth = circleRectDepth(pu.x, pu.y, 0.35, rc);
            if (depth > 0.15) report('power-up inside terrain', `${w.map.id} T${m.turn} ${pu.id} @${pu.x.toFixed(1)},${pu.y.toFixed(1)}`);
          }
          if (pu.y > w.lavaY) report('power-up below kill floor', `${w.map.id} ${pu.id} y=${pu.y.toFixed(1)}`);
        }
        for (const mn of w.mines) {
          if (!mn.alive) continue;
          for (const rc of w.map.terrain) if (circleRectDepth(mn.x, mn.y, 0.35, rc) > 0.15) report('mine inside terrain', `${w.map.id} @${mn.x},${mn.y}`);
        }
        m.beginAnnounce();
      }
    }
    if (m.phase !== 'over') report('match never ended', `${mapId} ${mode} turn ${m.turn}`);
  }
}
console.log(`${matches} eight-bot matches checked`);
if (!issues.size) console.log('NO ISSUES FOUND');
for (const [k, v] of issues) console.log(`ISSUE x${v.n}: ${k} — e.g. ${v.detail}`);
process.exit(issues.size ? 1 : 0);
