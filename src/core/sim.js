// Deterministic turn simulation for Super Bots.
// The World holds every bot, projectile, wall, field and power-up. Each turn:
//   startTurn()  -> pre-turn effects, hazard announcements, power-up spawns
//   submit()     -> one action per bot
//   resolve()    -> applies movement/launches, then step(dt) until done()
//   endTurn()    -> pickups, cooldown ticks, expiry
// All randomness goes through this.rng so replays are deterministic.

import { BOT_HULLS } from './hulls.js';
import { PHYS, DMG, TURN, BOTS, POWERUPS, POWERUP_IDS } from './defs.js';
import { RNG } from './rng.js';

const PROJ_R = 0.18;
const DEG = Math.PI / 180;

function circleRectPush(cx, cy, r, rect) {
  const px = Math.max(rect.x, Math.min(cx, rect.x + rect.w));
  const py = Math.max(rect.y, Math.min(cy, rect.y + rect.h));
  let dx = cx - px, dy = cy - py;
  const d2 = dx * dx + dy * dy;
  if (d2 >= r * r) return null;
  if (d2 < 1e-9) {
    // centre inside rect: push out along smallest penetration
    const l = cx - rect.x, rr = rect.x + rect.w - cx, t = cy - rect.y, b = rect.y + rect.h - cy;
    const m = Math.min(l, rr, t, b);
    if (m === t) return { nx: 0, ny: -1, depth: t + r };
    if (m === b) return { nx: 0, ny: 1, depth: b + r };
    if (m === l) return { nx: -1, ny: 0, depth: l + r };
    return { nx: 1, ny: 0, depth: rr + r };
  }
  const d = Math.sqrt(d2);
  return { nx: dx / d, ny: dy / d, depth: r - d };
}

function pointInRect(x, y, rc) { return x >= rc.x && x <= rc.x + rc.w && y >= rc.y && y <= rc.y + rc.h; }

// ---- Body outlines ----
// Every bot collides as the convex outline of its own sprite (BOT_HULLS), flipped
// with its facing. The same outline is used for terrain, other bots, projectiles
// and blasts, so what you see is exactly what can be hit and what gets stopped.
const FALLBACK_HULL = [[-0.5, -0.5], [0.5, -0.5], [0.5, 0.5], [-0.5, 0.5]];
function hullOf(def) { return BOT_HULLS[def.id] || FALLBACK_HULL; }
function hullExtents(def) {
  const H = hullOf(def); let l = 0, r = 0, t = 0, b = 0;
  for (const [x, y] of H) { if (x < l) l = x; if (x > r) r = x; if (y < t) t = y; if (y > b) b = y; }
  return { l, r, t, b };
}
function placedHull(def, x, y, facing) { const f = facing < 0 ? -1 : 1; return hullOf(def).map(([hx, hy]) => [x + hx * f, y + hy]); }
function rectPoly(rc) { return [[rc.x, rc.y], [rc.x + rc.w, rc.y], [rc.x + rc.w, rc.y + rc.h], [rc.x, rc.y + rc.h]]; }
function polyCentre(P) { let x = 0, y = 0; for (const [px, py] of P) { x += px; y += py; } return [x / P.length, y / P.length]; }
// Separating-axis test between two convex polygons. Returns the smallest push that
// moves A out of B as { nx, ny, depth } (pointing from B toward A), or null.
function polyPush(A, B) {
  let best = null;
  const test = (P) => {
    for (let i = 0; i < P.length; i++) {
      const [x1, y1] = P[i], [x2, y2] = P[(i + 1) % P.length];
      const ex = x2 - x1, ey = y2 - y1, len = Math.hypot(ex, ey); if (len < 1e-9) continue;
      const ax = -ey / len, ay = ex / len;
      let minA = Infinity, maxA = -Infinity, minB = Infinity, maxB = -Infinity;
      for (const [px, py] of A) { const d = px * ax + py * ay; if (d < minA) minA = d; if (d > maxA) maxA = d; }
      for (const [px, py] of B) { const d = px * ax + py * ay; if (d < minB) minB = d; if (d > maxB) maxB = d; }
      const o1 = maxA - minB, o2 = maxB - minA;
      if (o1 <= 0 || o2 <= 0) return false;
      const overlap = Math.min(o1, o2);
      if (!best || overlap < best.depth) best = { nx: o1 < o2 ? -ax : ax, ny: o1 < o2 ? -ay : ay, depth: overlap };
    }
    return true;
  };
  if (!test(A) || !test(B)) return null;
  return best;
}
// Ramps sit on ground and against walls, so their bottom and back edges are not real
// faces. A body inside the wedge is pushed out through the sloped face only.
function slopePush(P, tri) {
  const [ax, ay] = tri.pts[0], [bx, by] = tri.pts[1];
  const ex = bx - ax, ey = by - ay, len = Math.hypot(ex, ey) || 1;
  const nx = ey / len, ny = -ex / len;            // outward normal of the sloped face
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity, depth = 0;
  for (const [px, py] of P) {
    if (px < minX) minX = px; if (px > maxX) maxX = px; if (py < minY) minY = py; if (py > maxY) maxY = py;
    const d = (ax - px) * nx + (ay - py) * ny;     // how far this point sits behind the face
    if (d > depth) depth = d;
  }
  if (depth <= 0) return null;
  const s = tri.slope;
  if (maxX <= s.x || minX >= s.x + s.w || maxY <= s.y || minY >= s.y + s.h) return null;
  return { nx, ny, depth };
}
function distPointPoly(px, py, P) {
  let inside = true, best = Infinity;
  for (let i = 0; i < P.length; i++) {
    const [ax, ay] = P[i], [bx, by] = P[(i + 1) % P.length];
    const ex = bx - ax, ey = by - ay, len2 = ex * ex + ey * ey || 1e-9;
    const t = Math.max(0, Math.min(1, ((px - ax) * ex + (py - ay) * ey) / len2));
    const d = Math.hypot(px - (ax + ex * t), py - (ay + ey * t));
    if (d < best) best = d;
    if ((px - ax) * ey - (py - ay) * ex > 0) inside = false;
  }
  // winding can go either way once flipped, so test both senses
  if (!inside) { inside = true; for (let i = 0; i < P.length; i++) { const [ax, ay] = P[i], [bx, by] = P[(i + 1) % P.length]; if ((px - ax) * (by - ay) - (py - ay) * (bx - ax) < 0) { inside = false; break; } } }
  return inside ? 0 : best;
}

// Slopes collide as real right triangles: { pts: [[x,y] x3] } wound clockwise on screen
// (y down). Returns the push that moves a circle out of the triangle, like circleRectPush.
function slopeTri(s) {
  return s.dir === 1
    ? { pts: [[s.x, s.y + s.h], [s.x + s.w, s.y], [s.x + s.w, s.y + s.h]], slope: s }
    : { pts: [[s.x, s.y], [s.x + s.w, s.y + s.h], [s.x, s.y + s.h]], slope: s };
}
function circleTriPush(cx, cy, r, tri) {
  const P = tri.pts;
  let inside = true, best = null, hyp = null;
  for (let i = 0; i < 3; i++) {
    const [ax, ay] = P[i], [bx, by] = P[(i + 1) % 3];
    const ex = bx - ax, ey = by - ay;
    // outward normal: the triangles are wound so that (ey, -ex) points away from the interior
    const len = Math.hypot(ex, ey) || 1; const nx = ey / len, ny = -ex / len;
    const side = (cx - ax) * nx + (cy - ay) * ny;
    if (side > 0) inside = false;
    const t = Math.max(0, Math.min(1, ((cx - ax) * ex + (cy - ay) * ey) / (len * len)));
    const qx = ax + ex * t, qy = ay + ey * t;
    const d = Math.hypot(cx - qx, cy - qy);
    if (!best || d < best.d) best = { d, qx, qy, nx, ny, side };
    if (i === 0) hyp = { d, nx, ny };
  }
  if (inside) return { nx: hyp.nx, ny: hyp.ny, depth: hyp.d + r };
  if (best.d >= r) return null;
  if (best.d < 1e-6) return { nx: best.nx, ny: best.ny, depth: r };
  return { nx: (cx - best.qx) / best.d, ny: (cy - best.qy) / best.d, depth: r - best.d };
}

export class World {
  constructor(map, settings, players, seed) {
    this.map = map;
    this.settings = settings;
    this.rng = new RNG(seed);
    this.seed = seed;
    this.turn = 0;
    this.time = 0;
    this.events = [];
    this.projectiles = [];
    this.walls = [];
    this.patches = [];
    this.fields = [];
    this.powerups = [];
    this.beams = [];
    this.mines = (map.mines || []).map(([x, y, flag]) => { const pt = { x, y }; for (let g = 0; g < 40; g++) { let hit = null; for (const rc of map.terrain) { const px = Math.max(rc.x, Math.min(pt.x, rc.x + rc.w)), py = Math.max(rc.y, Math.min(pt.y, rc.y + rc.h)); if (Math.hypot(pt.x - px, pt.y - py) < 0.45) { hit = rc; break; } } if (!hit) break; pt.y = hit.y - 0.6; } return { x: pt.x, y: pt.y, alive: true, timer: 0, fixed: flag === 'fixed' }; });
    this.pads = (map.pads || []).map((p) => ({ ...p }));
    this.physTerrain = map.terrain.filter((rc) => !rc.step);   // stair steps stay in map.terrain for AI/spawn helpers only
    this.slopeTris = (map.slopes || []).map(slopeTri);
    this.singularity = null;
    this.lavaY = map.killFloor.y;
    const mineHz = (map.hazards || []).find((h) => h.type === 'mines');
    if (mineHz && mineHz.random) for (const mn of this.mines) if (!mn.fixed) this.scatterMine(mn);
    this.windX = 0;
    this.nextWind = 0;
    this.airStrike = null;      // { x, turn } scheduled
    this.pendingAirStrike = null;
    this.hazardAnnounce = [];
    this.pendingHazards = [];
    this.suddenDeath = false;
    this.sdRound = 0;
    this.stepping = false;
    this.lastActions = {};
    this.teamsMode = settings.mode === 'teams';

    this.bots = players.map((p, i) => {
      const def = BOTS[p.botId];
      const maxHp = Math.round(def.hp * settings.startingHp);
      return {
        id: i, slot: i, def, botId: p.botId, name: p.name, team: p.team ?? i, isAI: !!p.isAI, human: !p.isAI,
        color: p.color || def.color,
        x: p.spawn[0], y: p.spawn[1], vx: 0, vy: 0, spawn: [p.spawn[0], p.spawn[1]],
        hp: maxHp, maxHp, alive: true, grounded: false, airborne: false, diedTurn: -1,
        cd1: 0, cd2: 0, effects: {}, contact: null, contactTurns: 0,
        deflector: 0, wallImmune: false, lavaImmune: 0, lavaTouched: false, cdBonus: 0,
        action: null, bounceLeft: 0, slamPending: false, updraftPending: false, reflectorUsed: false,
        sdLast: null, killsTurn: 0,
        stats: { dealt: 0, taken: 0, kills: 0, turnsAlive: 0, specials: 0 }, facing: 1,
      };
    });
    this.settle();
  }

  // ----- helpers -----
  emit(type, data) { this.events.push({ type, t: this.time, ...data }); }
  alive() { return this.bots.filter((b) => b.alive); }
  enemiesOf(b) { return this.bots.filter((o) => o.alive && o !== b && !this.sameTeam(o, b)); }
  sameTeam(a, b) { return this.teamsMode && a.team === b.team; }
  solids() { return this.map.terrain.concat(this.walls.map((w) => w.rect)); }
  // Every solid a circle can be pushed out of: blocks, walls and slope triangles. Calls fn(hit, solid) per contact.
  botPoly(b) { return placedHull(b.def, b.x, b.y, b.facing || 1); }
  botExtents(b) { const e = hullExtents(b.def); return b.facing < 0 ? { l: -e.r, r: -e.l, t: e.t, b: e.b } : e; }
  // Same sweep as eachSolidHit, for a convex polygon; getPoly is re-read per solid
  // because the caller moves the body between contacts.
  eachSolidHitPoly(getPoly, fn) {
    for (const rc of this.physTerrain) { const h = polyPush(getPoly(), rectPoly(rc)); if (h) fn(h, rc); }
    for (const w of this.walls) { const h = polyPush(getPoly(), rectPoly(w.rect)); if (h) fn(h, w.rect, w); }
    for (const tri of this.slopeTris) { const h = slopePush(getPoly(), tri); if (h) fn(h, tri); }
  }
  eachSolidHit(cx, cy, r, fn) {
    for (const rc of this.physTerrain) { const h = circleRectPush(cx, cy, r, rc); if (h) fn(h, rc); }
    for (const w of this.walls) { const h = circleRectPush(cx, cy, r, w.rect); if (h) fn(h, w.rect, w); }
    for (const tri of this.slopeTris) { const h = circleTriPush(cx, cy, r, tri); if (h) fn(h, tri); }
  }
  hasEffect(b, k) { return (b.effects[k] || 0) > 0; }
  // True when a terrain rect sits above (x, y): a bot there is sheltered from things falling from the sky.
  hasCoverAbove(x, y) { return this.map.terrain.some((rc) => x > rc.x - 0.2 && x < rc.x + rc.w + 0.2 && rc.y + rc.h <= y - 0.4); }
  airStrikePending() { return this.pendingAirStrike ? 'now' : (this.airStrike ? 'next' : null); }
  addEffect(b, k, turns) { if (k === 'burn' && b.def.id === 'magmaw') return; b.effects[k] = Math.max(b.effects[k] || 0, turns); this.emit('effect', { bot: b.id, effect: k }); }
  cooldownMul() { return this.settings.cooldowns === 'fast' ? -1 : 0; }

  // Drop every bot onto the ground below its position before the match begins.
  settle() {
    for (const b of this.bots) {
      for (let i = 0; i < 400; i++) {
        b.vy += PHYS.gravity * PHYS.dt; b.y += b.vy * PHYS.dt;
        if (this.resolveBotTerrain(b)) { b.vy = 0; break; }
      }
      b.vy = 0; b.grounded = true;
    }
  }

  resolveBotTerrain(b) {
    let touchedGround = false;
    b.onSlope = false;
    this.eachSolidHitPoly(() => this.botPoly(b), (hit, solid) => {
      b.x += hit.nx * hit.depth; b.y += hit.ny * hit.depth;
      const vn = b.vx * hit.nx + b.vy * hit.ny;
      if (vn < 0) {
        const rest = (b.bounceLeft > 0 && b.airborne) ? 0.65 : (Math.abs(vn) < 2.5 ? 0 : PHYS.botRestitution);
        if (b.bounceLeft > 0 && b.airborne && Math.abs(vn) > 3) { b.bounceLeft--; this.emit('bounce', { x: b.x, y: b.y }); }
        b.vx -= (1 + rest) * vn * hit.nx; b.vy -= (1 + rest) * vn * hit.ny;
      }
      if (hit.ny < -0.5) { touchedGround = true; if (solid.pts) b.onSlope = true; }
    });
    // Wedge rescue: a bot trapped between two stacked blocks (one pushing up, one
    // pushing down) would oscillate forever. If the centre is still inside any
    // solid, lift the bot to the top of that block.
    for (let g = 0; g < 8; g++) {
      let inside = null;
      for (const rc of this.physTerrain.concat(this.walls.map((w) => w.rect))) { if (b.x > rc.x && b.x < rc.x + rc.w && b.y > rc.y && b.y < rc.y + rc.h) { inside = rc; break; } }
      if (!inside) break;
      b.y = inside.y - this.botExtents(b).b;
      if (b.vy > 0) b.vy = 0;
      touchedGround = true;
    }
    return touchedGround;
  }

  // ----- Turn phases -----
  startTurn() {
    this.turn++;
    this.events = [];
    this.time = 0;
    this.beams = [];
    this.hazardAnnounce = [];
    this.pendingHazards = [];
    const m = this.map;
    for (const b of this.bots) {
      b.killsTurn = 0; b.reflectorUsed = false; if (b.alive) b.stats.turnsAlive++;
      const lp = b.lastTurnPos; b.stillTurns = lp && Math.hypot(lp[0] - b.x, lp[1] - b.y) < 0.3 ? (b.stillTurns || 0) + 1 : 0; b.lastTurnPos = [b.x, b.y];
    }

    // 1. Pre-turn status effects
    for (const b of this.alive()) {
      if (this.hasEffect(b, 'poison')) this.applyDamage(b, DMG.poison, { type: 'status', label: 'Poison' });
      if (b.alive && this.hasEffect(b, 'burn') && b.def.id !== 'magmaw') this.applyDamage(b, DMG.burn, { type: 'status', label: 'Burn' });
      if (b.overheal > 0) { const d = Math.min(10, b.overheal); b.overheal -= d; b.hp = Math.max(b.maxHp, b.hp - d); }
    }

    // 2. Map hazards (announce this turn, or fire this turn if announced last turn)
    if (this.settings.hazards && !this.suddenDeath) {
      for (const h of m.hazards) {
        if (h.type === 'wind') {
          this.windX = Math.round(this.rng.range(-h.max, h.max) * 10) / 10;
          this.hazardAnnounce.push({ type: 'wind', text: `Wind ${this.windX >= 0 ? '→' : '←'} ${Math.abs(this.windX).toFixed(1)}` });
        } else if (h.type === 'gusts') {
          if (this.turn % h.every === 0) {
            this.windX = (this.rng.next() < 0.5 ? -1 : 1) * h.strength;
            this.hazardAnnounce.push({ type: 'wind', text: `${(h.label || 'Gust').toUpperCase()} ${this.windX > 0 ? '→' : '←'} ${h.strength}` });
          } else {
            this.windX = 0;
            if (this.turn % h.every === h.every - 1) this.hazardAnnounce.push({ type: 'warn', text: `${h.label || 'Gust'} next turn` });
          }
        } else if (h.type === 'risingLava') {
          if (this.turn > 1 && this.turn % h.every === 0) { this.lavaY -= h.amount; this.hazardAnnounce.push({ type: 'lava', text: 'The lava rises!' }); }
          else if (this.turn % h.every === h.every - 1) this.hazardAnnounce.push({ type: 'warn', text: 'Lava rises next turn' });
        } else if (h.type === 'mines') {
          if (h.every) {
            // Timed mines: one new mine lands on a random surface every `every` turns.
            // Detonated mines are gone for good; the field grows until someone clears it.
            this.mines = this.mines.filter((mn) => mn.alive);
            if (this.turn > 1 && this.turn % h.every === 0) {
              const pt = this.randomGroundSpot();
              if (pt) { const mn = { x: pt.x, y: pt.y - 0.15, alive: true, timer: 0 }; this.mines.push(mn); this.emit('mineSpawn', { x: mn.x, y: mn.y }); this.hazardAnnounce.push({ type: 'danger', text: `${(h.label || 'Spike mine').toUpperCase()} PLANTED` }); }
            } else if (this.turn % h.every === h.every - 1) {
              this.hazardAnnounce.push({ type: 'warn', text: `${h.label || 'Spike mine'} next turn` });
            }
          } else {
            for (const mn of this.mines) if (!mn.alive) { mn.timer--; if (mn.timer <= 0) { if (h.random && !mn.fixed) this.scatterMine(mn); mn.alive = true; this.emit('mineSpawn', { x: mn.x, y: mn.y }); } }
          }
        } else if (h.type === 'crusher') {
          const lbl = (h.label || 'Crusher').toUpperCase();
          if (this.turn % h.every === 0) { this.pendingHazards.push({ type: 'crusher', h }); this.hazardAnnounce.push({ type: 'danger', text: `${lbl} THIS TURN`, zone: { x: h.x, y: h.top, w: h.w, h: h.bottom - h.top } }); }
          else if (this.turn % h.every === h.every - 1) this.hazardAnnounce.push({ type: 'warn', text: `${h.label || 'Crusher'} next turn`, zone: { x: h.x, y: h.top, w: h.w, h: h.bottom - h.top } });
        } else if (h.type === 'geyser') {
          if (this.turn % h.every === 0 && this.pendingGeysers) {
            this.pendingHazards.push({ type: 'geyser', h, points: this.pendingGeysers });
            this.hazardAnnounce.push({ type: 'danger', text: `${(h.label || 'Geysers').toUpperCase()} ERUPT`, points: this.pendingGeysers, radius: h.radius });
            this.pendingGeysers = null;
          } else if (this.turn % h.every === h.every - 1) {
            const pts = [...h.points]; const chosen = [];
            for (let i = 0; i < h.count && pts.length; i++) chosen.push(pts.splice(this.rng.int(pts.length), 1)[0]);
            this.pendingGeysers = chosen;
            this.hazardAnnounce.push({ type: 'warn', text: `${h.label || 'Geysers'} next turn`, points: chosen, radius: h.radius });
          }
        } else if (h.type === 'lavaPatch') {
          if (this.turn > 1 && this.turn % h.every === 0) {
            const pt = this.randomGroundSpot();
            if (pt) {
              this.patches.push({ x: pt.x, y: pt.y, w: h.w || 3, turns: h.turns || 2, dmg: h.dmg || 20, touched: {} });
              this.emit('patch', { x: pt.x, y: pt.y, w: h.w || 3 });
              this.hazardAnnounce.push({ type: 'danger', text: `${(h.label || 'Burning ground').toUpperCase()} ERUPTS` });
            }
          } else if (this.turn % h.every === h.every - 1) {
            this.hazardAnnounce.push({ type: 'warn', text: `${h.label || 'Burning ground'} next turn` });
          }
        } else if (h.type === 'reactor') {
          if (this.turn % h.every === 0) { this.pendingHazards.push({ type: 'reactor', h }); this.hazardAnnounce.push({ type: 'danger', text: `${(h.label || 'Reactor pulse').toUpperCase()} THIS TURN`, circle: { x: h.x, y: h.y, r: h.r } }); }
          else if (this.turn % h.every === h.every - 1) this.hazardAnnounce.push({ type: 'warn', text: `${h.label || 'Reactor pulse'} next turn`, circle: { x: h.x, y: h.y, r: h.r } });
        }
      }
    } else {
      this.windX = 0;
    }

    // 3. Air strikes: a heads-up one turn ahead, then missiles rain over the whole map. No location is revealed.
    this.pendingAirStrike = null;
    if (this.airStrike && this.airStrike.turn === this.turn) {
      this.pendingAirStrike = this.airStrike; this.airStrike = null;
      this.hazardAnnounce.push({ type: 'danger', text: 'AIR STRIKE INCOMING — TAKE COVER', airstrike: 'now' });
    } else if (this.settings.airStrikes !== 'off' && !this.suddenDeath && this.turn >= 2) {
      const p = this.settings.airStrikes === 'rare' ? 0.08 : 0.18;
      if (this.rng.next() < p) {
        this.airStrike = { turn: this.turn + 1 };
        this.hazardAnnounce.push({ type: 'warn', text: 'Air strike next turn', airstrike: 'next' });
      }
    }

    // 4. Power-ups: spawn (they never despawn — they stay until a bot grabs them)
    if (this.settings.powerups !== 'off' && !this.suddenDeath && this.turn >= 2) {
      const battle = m.size === 'battle';
      const rate = { low: battle ? 0.35 : 0.25, normal: battle ? 1 : 0.5, high: 1 }[this.settings.powerups];
      const max = battle ? 5 : 3;
      if (this.powerups.length < max && this.rng.next() < rate) {
        const free = m.powerups.filter(([x, y]) => !this.powerups.some((p) => Math.abs(p.x - x) < 0.5 && Math.abs(p.y - y) < 0.5));
        // A power-up type can exist only once on the field at a time.
        const onField = new Set(this.powerups.map((p) => p.id));
        const pool = POWERUP_IDS.filter((id) => !onField.has(id) && this.settings.powerupPool[id] !== false && !(POWERUPS[id].teamsOnly && !this.teamsMode));
        if (free.length && pool.length) {
          const [px0, py0] = this.rng.pick(free);
          const pt = this.pushOutOfTerrain({ x: px0, y: py0 });
          const id = this.rng.weighted(pool, (k) => POWERUPS[k].weight);
          this.powerups.push({ x: pt.x, y: pt.y, id });
          this.emit('powerupSpawn', { x: pt.x, y: pt.y, id });
        }
      }
    }

    // 5. Reset per-turn action state
    for (const b of this.bots) { b.action = null; }
    this.lastActions = {};
    return this.hazardAnnounce;
  }

  // Which actions a bot may take this turn.
  availableActions(b) {
    const noJump = this.hasEffect(b, 'frozen') || this.hasEffect(b, 'rooted');
    const noSpecial = this.hasEffect(b, 'shocked') || this.suddenDeath;
    const sd = this.suddenDeath;
    return {
      jump: !noJump && !(sd && b.sdLast === 'jump'),
      missile: !(sd && b.sdLast === 'missile'),
      s1: !noSpecial && b.cd1 <= 0 && !(noJump && ['moltenSlam', 'updraft', 'blinkStrike'].includes(b.def.s1.id)),
      s2: !noSpecial && b.cd2 <= 0,
    };
  }

  submit(botId, action) {
    const b = this.bots[botId];
    if (!b.alive) return;
    b.action = action ? { ...action } : { type: 'skip' };
    this.lastActions[botId] = b.action;
  }

  resolve() {
    this.time = 0;
    this.stepping = true;
    this.singularity = null;
    this.fields = this.fields.filter((f) => f.turns > 0);
    for (const b of this.bots) { b.airborne = false; b.slamPending = false; b.updraftPending = false; b.bounceLeft = 0; b.lavaTouched = false; }

    // Map hazards that fire at the start of the resolve
    for (const ph of this.pendingHazards) {
      if (ph.type === 'crusher') {
        const h = ph.h;
        this.emit('crusher', { x: h.x, w: h.w, top: h.top, bottom: h.bottom });
        for (const b of this.alive()) {
          const ex = this.botExtents(b);
          if (b.x + ex.r > h.x && b.x + ex.l < h.x + h.w && b.y > h.top && b.y < h.bottom + 0.6) {
            this.applyDamage(b, h.dmg, { type: 'hazard', label: 'Crusher' });
            b.vx += (b.x < h.x + h.w / 2 ? -1 : 1) * 6; b.vy += 3;
          }
        }
      } else if (ph.type === 'geyser') {
        for (const [gx, gy] of ph.points) {
          this.emit('geyser', { x: gx, y: gy, r: ph.h.radius });
          for (const b of this.alive()) {
            if (distPointPoly(gx, gy, this.botPoly(b)) < ph.h.radius) {
              this.applyDamage(b, ph.h.dmg, { type: 'hazard', label: 'Geyser' });
              b.vy -= 12; b.vx += (b.x - gx) * 3;
            }
          }
        }
      } else if (ph.type === 'reactor') {
        const h = ph.h;
        this.emit('reactorPulse', { x: h.x, y: h.y, r: h.r });
        for (const b of this.alive()) {
          if (distPointPoly(h.x, h.y, this.botPoly(b)) < h.r) {
            this.applyDamage(b, h.dmg, { type: 'hazard', label: 'Reactor' });
            const d = Math.hypot(b.x - h.x, b.y - h.y) || 1;
            b.vx += (b.x - h.x) / d * 7; b.vy += (b.y - h.y) / d * 7 - 2;
          }
        }
      }
    }
    if (this.pendingAirStrike) {
      // Standard missiles fall from the sky across the whole map. They are held
      // until the end of the turn: player actions resolve first, then the rain lands.
      // One bomb every 2 units with a little jitter: blast radius 1.2 plus the bot's own
      // half-width covers the gaps, so an exposed bot is hit and a sheltered one is not.
      const n = Math.max(6, Math.round(this.map.width / 1.6));
      for (let i = 0; i < n; i++) {
        const x = (i + 0.5) * (this.map.width / n) + this.rng.range(-0.3, 0.3);
        this.projectiles.push({
          x, y: -2 - this.rng.range(0, 5), vx: this.rng.range(-0.15, 0.15), vy: 6, owner: null, kind: 'bomb', dmg: DMG.airStrikeBomb, radius: DMG.airStrikeRadius,
          delay: 2.2 + this.rng.range(0, 1.0), bounces: 0, bounced: 0, life: 9, r: PROJ_R, gravity: 1, wind: 0, color: '#ff7a2f', trail: [], knock: 1, effect: null, splitAt: false, onImpact: null, reflected: 0,
        });
      }
      this.emit('airstrike', { x: this.map.width / 2, count: n });
      this.pendingAirStrike = null;
    }

    // Wall lifetimes
    for (const w of this.walls) w.turns--;
    this.walls = this.walls.filter((w) => w.turns > 0 && w.hp > 0);
    for (const b of this.bots) b.wallImmune = this.walls.some((w) => w.owner === b.id);

    // Player actions (all launched at t = 0)
    for (const b of this.alive()) {
      const a = b.action || { type: 'skip' };
      if (a.type === 'skip') continue;
      const aim = this.normAim(a.aim);
      if (Math.abs(aim.dx) > 0.05) b.facing = aim.dx < 0 ? -1 : 1;
      if (a.type === 'jump') this.doJump(b, aim, 1, 1);
      else if (a.type === 'missile') this.fireMissile(b, aim);
      else if (a.type === 's1' || a.type === 's2') this.useSpecial(b, a.type, aim, a.param);
      if (this.suddenDeath) b.sdLast = a.type === 'jump' ? 'jump' : (a.type === 'missile' ? 'missile' : b.sdLast);
    }
  }

  normAim(aim) {
    if (!aim) return { dx: 1, dy: -0.5, power: 0.5 };
    const l = Math.hypot(aim.dx, aim.dy) || 1;
    return { dx: aim.dx / l, dy: aim.dy / l, power: Math.max(0.15, Math.min(1, aim.power ?? 1)) };
  }

  hitRadius(b) { return PHYS.hitRadius[b.def.weight] || PHYS.botRadius; }

  jumpMul(b) {
    let m = PHYS.weightJump[b.def.weight];
    if (this.hasEffect(b, 'thrusters')) m *= Math.sqrt(1.75);
    return m;
  }

  doJump(b, aim, vxMul = 1, vyMul = 1) {
    const s = PHYS.jumpSpeed * aim.power * this.jumpMul(b);
    b.vx = aim.dx * s * vxMul; b.vy = aim.dy * s * vyMul;
    if (b.vy > -2) b.vy = -2; // always leave the ground
    b.airborne = true; b.grounded = false;
    if (b.def.id === 'ricochet') b.bounceLeft = 1;
    this.emit('jump', { bot: b.id, x: b.x, y: b.y });
  }

  spawnProjectile(b, aim, opts) {
    const speed = PHYS.missileSpeed * aim.power * (opts.speedMul ?? 1) * (opts.kind === 'missile' ? PHYS.missileSpeedMul : 1) * (b.def.id === 'volt' && opts.kind === 'missile' ? 1.15 : 1);
    const ang = (opts.angleOffset || 0) * DEG;
    const cos = Math.cos(ang), sin = Math.sin(ang);
    const dx = aim.dx * cos - aim.dy * sin, dy = aim.dx * sin + aim.dy * cos;
    const p = {
      x: (opts.x ?? b.x) + dx * 0.7, y: (opts.y ?? b.y) + dy * 0.7, vx: dx * speed, vy: dy * speed,
      owner: b.id, kind: opts.kind, born: this.time, dmg: opts.dmg ?? DMG.missile, radius: opts.radius ?? DMG.missileRadius,
      bounces: opts.bounces || 0, bounced: 0, life: 6, r: opts.r ?? PROJ_R, gravity: opts.gravity ?? 1, wind: 1,
      color: opts.color || b.color, trail: [], knock: opts.knock ?? 1, effect: opts.effect || null, splitAt: opts.splitAt || false,
      onImpact: opts.onImpact || null, reflected: 0,
    };
    this.projectiles.push(p);
    return p;
  }

  fireMissile(b, aim) {
    this.spawnProjectile(b, aim, { kind: 'missile', knock: PHYS.missileKnock });
    this.emit('fire', { bot: b.id, x: b.x, y: b.y });
  }

  useSpecial(b, slot, aim, param) {
    const sp = slot === 's1' ? b.def.s1 : b.def.s2;
    const cdAdj = this.cooldownMul() - (b.cdBonus || 0);
    const cd = Math.max(1, sp.cd + cdAdj);
    if (slot === 's1') b.cd1 = cd; else b.cd2 = cd;
    b.cdBonus = 0;
    b.stats.specials++;
    this.emit('special', { bot: b.id, name: sp.name, x: b.x, y: b.y });
    switch (sp.id) {
      case 'bastionWall': {
        const side = aim.dx >= 0 ? 1 : -1;
        const wx = b.x + side * 1.35 - 0.2;
        for (let i = 0; i < 3; i++) this.walls.push({ rect: { x: wx, y: b.y + 0.7 - (i + 1) * 0.85, w: 0.4, h: 0.85 }, owner: b.id, hp: 40, turns: 3, color: b.color, seg: i });
        b.wallImmune = true;
        break;
      }
      case 'siegeShell': this.spawnProjectile(b, aim, { kind: 'siege', dmg: sp.dmg, radius: sp.radius, speedMul: 0.8, r: 0.3, knock: 2.2, gravity: 1.15, color: '#ffb347' }); break;
      case 'moltenSlam': this.doJump(b, { ...aim, power: Math.max(aim.power, 0.6) }, 1, 1); b.slamPending = true; break;
      case 'emberSpit':
        for (const off of [-9, 0, 9]) this.spawnProjectile(b, aim, { kind: 'ember', dmg: sp.dmg, radius: sp.radius, speedMul: 0.6, angleOffset: off, effect: { burn: 2 }, color: '#ff8a2f', r: 0.14 });
        break;
      case 'chainArc': this.chainArc(b, aim, sp); break;
      case 'staticField': this.spawnProjectile(b, aim, { kind: 'static', dmg: sp.dmg, radius: sp.radius, color: '#ffe23a', effect: { shocked: 2 }, onImpact: 'staticField' }); break;
      case 'deflector': b.deflector = 1; this.emit('deflector', { bot: b.id }); break;
      case 'anchorBolt': this.spawnProjectile(b, aim, { kind: 'anchor', dmg: sp.dmg, radius: sp.radius, effect: { rooted: 2 }, color: '#3ddc97', speedMul: 1.05 }); break;
      case 'updraft': this.doJump(b, aim, 1, 2); b.updraftPending = { aim }; break;
      case 'galeShot': this.galeShot(b, aim, sp); break;
      case 'blinkStrike': this.blinkStrike(b, aim, sp); break;
      case 'toxicBomb': this.spawnProjectile(b, aim, { kind: 'toxic', dmg: 0, radius: 0, color: '#9dff2f', onImpact: 'toxic' }); break;
      case 'pinball': this.spawnProjectile(b, aim, { kind: 'pinball', dmg: sp.dmg, radius: sp.radius, bounces: param ?? 4, color: '#ff4fa3', r: 0.22 }); break;
      case 'splitShot': this.spawnProjectile(b, aim, { kind: 'split', dmg: sp.dmg, radius: sp.radius, splitAt: true, color: '#ff4fa3' }); break;
      case 'singularity': this.spawnProjectile(b, aim, { kind: 'singularity', dmg: 0, radius: 0, color: '#9aa4b8', onImpact: 'singularity', r: 0.26 }); break;
      case 'shockwave': this.explode(b.x, b.y, sp.radius, sp.dmg, b, { knock: 2.3, excludeSelf: true, label: 'Shockwave', color: b.color }); break;
    }
  }

  chainArc(b, aim, sp) {
    const len = Math.hypot(this.map.width, this.map.height);
    const ex = b.x + aim.dx * len, ey = b.y + aim.dy * len;
    this.beams.push({ x1: b.x, y1: b.y, x2: ex, y2: ey, color: b.color, t: this.time });
    this.emit('beam', { x1: b.x, y1: b.y, x2: ex, y2: ey, color: b.color });
    const hit = [];
    for (const o of this.alive()) {
      if (o === b) continue;
      const t = Math.max(0, ((o.x - b.x) * aim.dx + (o.y - b.y) * aim.dy));
      const px = b.x + aim.dx * t, py = b.y + aim.dy * t;
      if (Math.hypot(o.x - px, o.y - py) < PHYS.botRadius + 0.25) hit.push({ o, t });
    }
    hit.sort((p, q) => p.t - q.t);
    for (const { o } of hit) this.applyDamage(o, sp.dmg, { type: 'beam', bot: b, label: 'Chain Arc' });
    if (hit.length) {
      const first = hit[0].o;
      let best = null, bd = sp.arcRange;
      for (const o of this.alive()) {
        if (o === b || hit.some((h) => h.o === o)) continue;
        const d = Math.hypot(o.x - first.x, o.y - first.y);
        if (d < bd) { bd = d; best = o; }
      }
      if (best) {
        this.beams.push({ x1: first.x, y1: first.y, x2: best.x, y2: best.y, color: b.color, t: this.time });
        this.emit('beam', { x1: first.x, y1: first.y, x2: best.x, y2: best.y, color: b.color });
        this.applyDamage(best, sp.arcDmg, { type: 'beam', bot: b, label: 'Arc' });
      }
    }
  }

  galeShot(b, aim, sp) {
    const len = 13, half = Math.cos(30 * DEG);
    this.emit('gale', { x: b.x, y: b.y, dx: aim.dx, dy: aim.dy, len });
    const inCone = (x, y) => {
      const dx = x - b.x, dy = y - b.y, d = Math.hypot(dx, dy);
      if (d < 0.01 || d > len) return false;
      return (dx * aim.dx + dy * aim.dy) / d > half;
    };
    for (const o of this.alive()) {
      if (o === b || !inCone(o.x, o.y)) continue;
      this.applyDamage(o, sp.dmg, { type: 'blast', bot: b, label: 'Gale' });
      if (!o.alive) continue;
      // Momentum matters: velocity against the wind cancels part of the shove.
      const opposing = -(o.vx * aim.dx + o.vy * aim.dy);           // >0 when moving into the wind
      const brace = Math.max(0.25, 1 - Math.max(0, opposing) / 16);
      const k = 17 * this.knockMul(o) * brace;
      o.vx += aim.dx * k; o.vy += aim.dy * k - 2.5; o.grounded = false;
    }
    for (const p of this.projectiles) if (inCone(p.x, p.y)) { p.vx += aim.dx * 20; p.vy += aim.dy * 20; }
    for (const pu of this.powerups) if (inCone(pu.x, pu.y)) { pu.x = Math.max(1, Math.min(this.map.width - 1, pu.x + aim.dx * 3.5)); this.dropToGround(pu); }
  }

  // A random spot on the topmost standable surface at some x, for hazards that
  // choose their own location. Returns null if nothing solid sits above the lava.
  randomGroundSpot(tries = 30) {
    for (let i = 0; i < tries; i++) {
      const x = this.rng.range(1.5, this.map.width - 1.5);
      let top = null;
      for (const rc of this.map.terrain) {
        if (x >= rc.x - 0.1 && x <= rc.x + rc.w + 0.1 && (top === null || rc.y < top)) top = rc.y;
      }
      if (top !== null && top < this.lavaY - 0.5) return { x, y: top - 0.45 };
    }
    return null;
  }

  // Move a mine to a fresh random surface. Falls back to leaving it put.
  scatterMine(mn) {
    const pt = this.randomGroundSpot();
    if (pt) { mn.x = pt.x; mn.y = pt.y - 0.15; }
  }

  // A wrapping map can put a bot inside whatever stands at the opposite edge,
  // because nothing guarantees the seam is open air. If the arrival point is
  // solid, set the bot down on the surface above it instead of leaving it stuck.
  landAfterWrap(b) {
    let inside = false;
    for (const rc of this.map.terrain) {
      if (b.x > rc.x && b.x < rc.x + rc.w && b.y > rc.y && b.y < rc.y + rc.h) { inside = true; break; }
    }
    if (!inside) return;
    let top = null;
    for (const rc of this.map.terrain) {
      if (b.x >= rc.x - 0.1 && b.x <= rc.x + rc.w + 0.1 && (top === null || rc.y < top)) top = rc.y;
    }
    if (top !== null) { b.y = top - this.botExtents(b).b - 0.02; b.vy = Math.min(0, b.vy); b.grounded = false; }
  }

  dropToGround(obj) {
    this.pushOutOfTerrain(obj, 0.4);
    for (let i = 0; i < 300; i++) {
      let hit = false;
      for (const rc of this.map.terrain) if (circleRectPush(obj.x, obj.y + 0.05, 0.4, rc)) { hit = true; break; }
      if (hit) break;
      obj.y += 0.05;
      if (obj.y > this.lavaY - 0.6) { obj.y = this.lavaY - 0.6; break; }
    }
  }

  blinkStrike(b, aim, sp) {
    const maxD = this.map.width * 0.6 * aim.power;
    let tx = b.x, ty = b.y;
    for (let d = 0.25; d <= maxD; d += 0.25) {
      const cx = b.x + aim.dx * d, cy = b.y + aim.dy * d;
      if (cx < 0.6 || cx > this.map.width - 0.6 || cy < 0.6 || cy > this.lavaY - 0.8) break;
      { let blocked = false; this.eachSolidHitPoly(() => placedHull(b.def, cx, cy, b.facing || 1), () => { blocked = true; }); if (blocked) break; }
      tx = cx; ty = cy;
    }
    this.emit('blink', { from: [b.x, b.y], to: [tx, ty], color: b.color });
    b.x = tx; b.y = ty; b.vx = 0; b.vy = 0; b.grounded = false; b.airborne = true;
    // Shards lock on to the nearest enemy from the arrival point (falls back to the aim direction).
    let shardAim = aim;
    let nearest = null, nd = 9;
    for (const o of this.enemiesOf(b)) { const d = Math.hypot(o.x - tx, o.y - ty); if (d < nd) { nd = d; nearest = o; } }
    if (nearest) { const dx = nearest.x - tx, dy = nearest.y - ty, d = Math.hypot(dx, dy) || 1; shardAim = { dx: dx / d, dy: dy / d - 0.15, power: Math.min(1, 0.35 + d / 12) }; }
    for (const off of [-21, -7, 7, 21]) this.spawnProjectile(b, shardAim, { kind: 'shard', dmg: sp.dmg, radius: sp.radius, speedMul: 0.85, angleOffset: off, color: '#e0a8ff', r: 0.14 });
  }

  // ----- Damage -----
  knockMul(b) {
    if (b.wallImmune && b.def.id === 'bulwark') return 0;
    if (b.def.id === 'gravitas') return PHYS.weightKnockback.heavy;
    return PHYS.weightKnockback[b.def.weight];
  }

  applyDamage(target, amount, src) {
    if (!target.alive || amount <= 0) return 0;
    const attacker = src.bot || null;
    let dmg = amount;
    if (src.type !== 'status' && src.type !== 'hazard') dmg *= this.settings.damage;
    if (attacker) {
      if (this.hasEffect(attacker, 'amp')) dmg *= 1.5;
      if (this.hasEffect(attacker, 'rally')) dmg *= 1.1;
      if (attacker !== target && this.sameTeam(attacker, target) && !this.settings.friendlyFire) dmg = 0;
    }
    if (this.hasEffect(target, 'plating')) dmg *= 0.5;
    if (target.def.id === 'warden' && src.fromAbove) dmg *= 0.8;
    dmg = Math.round(dmg);
    if (dmg <= 0) { if (attacker && attacker !== target && this.sameTeam(attacker, target)) this.emit('damage', { bot: target.id, x: target.x, y: target.y, amount: 0, label: 'Friendly' }); return 0; }
    target.hp -= dmg;
    target.stats.taken += dmg;
    if (attacker && attacker !== target) attacker.stats.dealt += dmg;
    this.emit('damage', { bot: target.id, x: target.x, y: target.y, amount: dmg, label: src.label || '', crit: dmg >= 40 });
    if (target.hp <= 0) { target.hp = 0; this.kill(target, attacker, src.label || 'destroyed', src.depth || 0); }
    return dmg;
  }

  kill(b, killer, cause, depth) {
    if (!b.alive) return;
    b.alive = false; b.diedTurn = this.turn; b.hp = 0;
    b.effects = {}; b.contact = null; b.deflector = 0;
    this.walls = this.walls.filter((w) => w.owner !== b.id);
    if (killer && killer !== b && killer.alive) {
      killer.stats.kills++; killer.killsTurn++;
      if (killer.def.id === 'phantom') killer.cdBonus = 1;
    }
    this.emit('eliminated', { bot: b.id, x: b.x, y: b.y, by: killer ? killer.id : null, cause });
    // Self-destruct blast damages nearby enemies (chain limited)
    if (depth < TURN.maxChainKills && cause !== 'fell') {
      this.explode(b.x, b.y, DMG.selfDestructRadius, DMG.selfDestruct, b, { label: 'Self-destruct', excludeSelf: true, enemiesOnly: true, depth: depth + 1, color: '#ff4d4d', knock: 1.2 });
    } else if (cause === 'fell') {
      this.emit('explosion', { x: b.x, y: b.y, radius: 0.8, color: '#ffffff' });
    }
  }

  // Area blast at (x,y). Applies damage + knockback, damages walls.
  explode(x, y, radius, dmg, source, opts = {}) {
    this.emit('explosion', { x, y, radius, color: opts.color || (source ? source.color : '#ffffff'), big: radius >= 1.4 });
    for (const w of this.walls) {
      const px = Math.max(w.rect.x, Math.min(x, w.rect.x + w.rect.w)), py = Math.max(w.rect.y, Math.min(y, w.rect.y + w.rect.h));
      if (Math.hypot(x - px, y - py) < radius) w.hp -= dmg;
    }
    const broken = this.walls.filter((w) => w.hp <= 0);
    if (broken.length) { this.walls = this.walls.filter((w) => w.hp > 0); this.emit('wallBreak', { x: broken[0].rect.x, y: broken[0].rect.y }); }
    for (const b of this.bots) {
      if (!b.alive) continue;
      if (opts.excludeSelf && b === source) continue;
      if (opts.enemiesOnly && source && this.sameTeam(b, source) && b !== source) continue;
      const d = Math.hypot(b.x - x, b.y - y);
      if (distPointPoly(x, y, this.botPoly(b)) > radius) continue;
      const nx = d > 0.01 ? (b.x - x) / d : 0, ny = d > 0.01 ? (b.y - y) / d : -1;
      let applied = 0;
      if (dmg > 0) applied = this.applyDamage(b, dmg, { type: 'blast', bot: source, label: opts.label, fromAbove: opts.fromAbove, depth: opts.depth || 0 });
      if (!b.alive) continue;
      const k = dmg * PHYS.knockbackPerDamage * (opts.knock ?? 1) * this.knockMul(b);
      b.vx += nx * k; b.vy += (ny - 0.45) * k; b.grounded = false;
      if (opts.effect && (applied > 0 || dmg === 0)) for (const [k2, v] of Object.entries(opts.effect)) this.addEffect(b, k2, v);
    }
  }

  // ----- Physics step -----
  step(dt) {
    if (!this.stepping) return true;
    this.time += dt;
    // Bots
    for (const b of this.bots) {
      if (!b.alive) continue;
      const prevGrounded = b.grounded;
      b.vy += PHYS.gravity * dt;
      if (this.windX && b.def.id !== 'skyla' && !b.grounded) b.vx += this.windX * 0.25 * dt;
      if (this.singularity && this.singularity.t > 0) {
        const s = this.singularity, dx = s.x - b.x, dy = s.y - b.y, d = Math.hypot(dx, dy);
        if (d < s.r && d > 0.3) { b.vx += dx / d * 16 * dt; b.vy += dy / d * 16 * dt - PHYS.gravity * dt * 0.5; b.grounded = false; }
      }
      const speed = Math.hypot(b.vx, b.vy);
      if (speed > 0.01) { const drag = 1 - PHYS.airDrag * dt; b.vx *= drag; b.vy *= drag; }
      // Substep fast movers so knockback can never tunnel a bot inside a block.
      const sub = Math.min(6, Math.max(1, Math.ceil((speed * dt) / 0.22)));
      let onGround = false;
      for (let ss = 0; ss < sub; ss++) {
        b.x += (b.vx * dt) / sub; b.y += (b.vy * dt) / sub;
        onGround = this.resolveBotTerrain(b) || onGround;
      }
      if (this.map.teleporters) { if (b.x < 0) { b.x += this.map.width; this.landAfterWrap(b); this.emit('teleport', { bot: b.id }); } else if (b.x > this.map.width) { b.x -= this.map.width; this.landAfterWrap(b); this.emit('teleport', { bot: b.id }); } }
      else { const ex = this.botExtents(b); if (b.x + ex.l < 0) { b.x = -ex.l; b.vx = Math.abs(b.vx) * 0.3; } if (b.x + ex.r > this.map.width) { b.x = this.map.width - ex.r; b.vx = -Math.abs(b.vx) * 0.3; } }
      b.grounded = onGround;
      if (Math.abs(b.vx) > 1.5) b.facing = b.vx < 0 ? -1 : 1;
      if (onGround) {
        const f = Math.max(0, 1 - PHYS.groundFriction * dt); b.vx *= f;
        if (b.onSlope) { b.vy *= f; if (Math.hypot(b.vx, b.vy) < PHYS.slopeGrip) { b.vx = 0; b.vy = 0; } } // rolling friction along the ramp, then static friction holds
        else if (b.vy > 0) b.vy = 0;
        if (Math.abs(b.vx) < 0.05) b.vx = 0;
      }
      if (!prevGrounded && onGround && b.airborne) {
        if (b.slamPending) {
          b.slamPending = false;
          const sp = b.def.s1;
          this.explode(b.x, b.y + 0.2, sp.radius, sp.dmg, b, { excludeSelf: true, label: 'Molten Slam', knock: 1.3, color: '#ff6a1f' });
          this.patches.push({ x: b.x, y: b.y + 0.4, w: 4, turns: 3, dmg: 15, touched: {} });
          this.emit('patch', { x: b.x, y: b.y + 0.4, w: 3 });
        }
        if (Math.abs(b.vy) < 1 && Math.abs(b.vx) < 1) b.airborne = false;
      }
      if (b.updraftPending && b.vy >= 0) {
        b.updraftPending = false;
        const sp = b.def.s1;
        for (const dx of [-0.28, 0, 0.28]) {
          this.spawnProjectile(b, { dx, dy: 1, power: 0.75 }, { kind: 'rain', dmg: sp.dmg, radius: sp.radius, color: b.color, r: 0.16 });
        }
        this.emit('fire', { bot: b.id, x: b.x, y: b.y });
      }
      // kill floor
      if (b.y + this.botExtents(b).b > this.lavaY) {
        if (this.map.killFloor.type === 'lava' && b.def.id === 'magmaw' && b.lavaImmune <= 0 && !b.lavaTouched) {
          b.lavaTouched = true; b.lavaImmune = 2; b.vy = -15; b.y = this.lavaY - this.botExtents(b).b - 0.05;
          this.emit('lavaSurf', { bot: b.id, x: b.x, y: b.y });
        } else {
          this.kill(b, null, 'fell', 0);
        }
      }
      if (b.y > this.map.height + 3 || b.y < -12) this.kill(b, null, 'fell', 0);
    }
    // Toxic clouds tick while the turn resolves: 5 damage every 0.4s, at most 7 ticks per bot.
    for (const f of this.fields) {
      if (f.kind !== 'toxic') continue;
      f.tickTimer += dt;
      if (f.tickTimer >= 0.4) {
        f.tickTimer -= 0.4;
        const fOwner = f.owner !== null && f.owner !== undefined ? this.bots[f.owner] : null;
        for (const b of this.alive()) {
          if (distPointPoly(f.x, f.y, this.botPoly(b)) > f.r) continue;
          if ((f.hits[b.id] || 0) >= 7) continue;
          f.hits[b.id] = (f.hits[b.id] || 0) + 1;
          this.applyDamage(b, 5, { type: 'status', bot: fOwner && fOwner !== b ? fOwner : null, label: 'Toxic' });
        }
      }
    }
    // Burning patches scorch on contact: 15 damage the moment a bot touches one (once per turn each).
    for (const pch of this.patches) {
      for (const b of this.alive()) {
        if (b.def.id === 'magmaw') continue;
        const pex = this.botExtents(b);
        if (b.x + pex.r > pch.x - pch.w / 2 && b.x + pex.l < pch.x + pch.w / 2 && Math.abs(b.y - pch.y) < 1.1 && b.grounded) {
          pch.touched = pch.touched || {};
          if (pch.touched[b.id]) continue;
          pch.touched[b.id] = true;
          this.applyDamage(b, pch.dmg, { type: 'status', label: 'Burning ground' });
        }
      }
    }
    // Teleporter pads fling a bot to their exit. The cooldown stops it looping
    // if the exit happens to sit near another pad.
    for (const b of this.alive()) {
      if (b.padCd > 0) { b.padCd -= dt; continue; }
      for (const pad of this.pads) {
        if (distPointPoly(pad.x, pad.y, this.botPoly(b)) < 0.75) {
          this.emit('teleport', { bot: b.id, from: [b.x, b.y], to: pad.to });
          b.x = pad.to[0]; b.y = pad.to[1];
          b.vx = 0; b.vy = 0; b.grounded = false; b.padCd = 0.8;
          break;
        }
      }
    }
    // Power-ups are grabbed the moment a bot touches them (buffs apply immediately, mid-turn)
    for (const b of this.alive()) {
      for (let i = this.powerups.length - 1; i >= 0; i--) {
        const pu = this.powerups[i];
        if (distPointPoly(pu.x, pu.y, this.botPoly(b)) < 0.6) { this.powerups.splice(i, 1); this.applyPowerup(b, pu.id); }
      }
    }
    // Mines: bots that touch one set it off
    if (this.settings.hazards) for (const mn of this.mines) {
      if (!mn.alive) continue;
      for (const b of this.alive()) if (distPointPoly(mn.x, mn.y, this.botPoly(b)) < 0.45) { this.detonateMine(mn, null); break; }
    }
    // Bot-bot collisions and contact effects
    const alive = this.alive();
    for (let i = 0; i < alive.length; i++) for (let j = i + 1; j < alive.length; j++) {
      const a = alive[i], c = alive[j];
      const hit = polyPush(this.botPoly(c), this.botPoly(a));   // push moving c away from a
      if (!hit) continue;
      const nx = hit.nx, ny = hit.ny, overlap = hit.depth;
      const ma = PHYS.mass[a.def.weight] || 1, mc = PHYS.mass[c.def.weight] || 1, mt = ma + mc;
      a.x -= nx * overlap * (mc / mt); a.y -= ny * overlap * (mc / mt); c.x += nx * overlap * (ma / mt); c.y += ny * overlap * (ma / mt);
      const rel = (c.vx - a.vx) * nx + (c.vy - a.vy) * ny;
      if (rel < 0) { const j = -(1 + PHYS.botBump) * rel / (1 / ma + 1 / mc); a.vx -= nx * j / ma; a.vy -= ny * j / ma; c.vx += nx * j / mc; c.vy += ny * j / mc; }
      // a bot standing on another bot's head counts as grounded
      if (ny > 0.7 && !a.grounded && a.vy >= -0.5) a.grounded = true; else if (ny < -0.7 && !c.grounded && c.vy >= -0.5) c.grounded = true;
      this.transferContact(a, c); this.transferContact(c, a);
    }
    // Projectiles
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      const res = this.stepProjectile(p, dt, false);
      if (res) { this.projectiles.splice(i, 1); this.projectileImpact(p, res); }
    }
    if (this.singularity) { this.singularity.t -= dt; }
    for (const b of this.bots) if (b.alive && b.lavaImmune > 0) { /* turn-based; decremented in endTurn */ }
    return this.done();
  }

  // Lift a point straight up until a 0.45-radius circle around it is clear of terrain.
  pushOutOfTerrain(pt, r = 0.45) {
    for (let guard = 0; guard < 60; guard++) {
      let hit = null;
      for (const rc of this.map.terrain) { if (circleRectPush(pt.x, pt.y, r, rc)) { hit = rc; break; } }
      if (!hit) return pt;
      pt.y = hit.y - r - 0.15;
    }
    return pt;
  }

  mineDef() { return this.map.hazards.find((h) => h.type === 'mines') || { dmg: 20, radius: 1.2, respawn: 4 }; }
  detonateMine(mn, source) {
    if (!mn.alive) return;
    const h = this.mineDef();
    mn.alive = false; mn.timer = h.respawn || 4;
    this.emit('mine', { x: mn.x, y: mn.y });
    this.explode(mn.x, mn.y, h.radius, h.dmg, source || null, { label: 'Spike mine', knock: 1.3, color: '#ff4d4d' });
  }

  transferContact(from, to) {
    if (!from.contact) return;
    const k = from.contact; from.contact = null; from.contactTurns = 0;
    if (k === 'toxin') this.addEffect(to, 'poison', 3);
    else if (k === 'frost') this.addEffect(to, 'frozen', 2);
    else if (k === 'shockwire') this.addEffect(to, 'shocked', 2);
    this.emit('contact', { from: from.id, to: to.id, kind: k });
  }

  // Advance one projectile. Returns null or an impact descriptor. ghost=true skips bot deflection side effects.
  stepProjectile(p, dt, ghost) {
    if (p.delay && p.delay > 0) { p.delay -= dt; if (p.delay <= 0 && p.owner === null && !ghost) this.emit('bomb', { x: p.x, y: p.y }); return null; }
    const spd = Math.hypot(p.vx, p.vy);
    const sub = Math.min(5, Math.max(1, Math.ceil((spd * dt) / 0.25)));
    if (sub > 1) {
      for (let i = 0; i < sub; i++) { const r = this.stepProjectileOnce(p, dt / sub, ghost); if (r) return r; }
      return null;
    }
    return this.stepProjectileOnce(p, dt, ghost);
  }

  stepProjectileOnce(p, dt, ghost) {
    p.life -= dt;
    if (p.life <= 0) return { type: 'expire' };
    const prevVy = p.vy;
    p.vy += PHYS.gravity * p.gravity * dt;
    if (p.wind) p.vx += this.windX * 0.6 * dt;
    p.x += p.vx * dt; p.y += p.vy * dt;
    if (!ghost && p.trail.length < 400 && (p.trail.length === 0 || Math.hypot(p.x - p.trail[p.trail.length - 1][0], p.y - p.trail[p.trail.length - 1][1]) > 0.2)) p.trail.push([p.x, p.y]);
    if (p.splitAt && prevVy < 0 && p.vy >= 0) return { type: 'split' };
    if (this.map.teleporters && p.kind !== 'bomb') { if (p.x < 0) p.x += this.map.width; else if (p.x > this.map.width) p.x -= this.map.width; }
    else if (p.x < -1 || p.x > this.map.width + 1) return { type: 'out' };
    if (p.y > this.lavaY + 0.2 || p.y > this.map.height + 2) return { type: 'floor' };
    // terrain & walls
    for (const rc of this.physTerrain) {
      const h = circleRectPush(p.x, p.y, p.r, rc);
      if (h) return { type: 'terrain', nx: h.nx, ny: h.ny, depth: h.depth };
    }
    for (const tri of this.slopeTris) {
      const h = circleTriPush(p.x, p.y, p.r, tri);
      if (h) return { type: 'terrain', nx: h.nx, ny: h.ny, depth: h.depth };
    }
    for (const w of this.walls) {
      if (w.owner === p.owner) continue;
      const h = circleRectPush(p.x, p.y, p.r, w.rect);
      if (h) return { type: 'wall', wall: w, nx: h.nx, ny: h.ny };
    }
    // mines
    if (this.settings.hazards) for (const mn of this.mines) if (mn.alive && Math.hypot(mn.x - p.x, mn.y - p.y) < p.r + 0.45) return { type: 'mine', mine: mn };
    // bots
    for (const b of this.bots) {
      if (!b.alive) continue;
      const hitR = p.r + (b.deflector ? 0.55 : 0);
      const dPoly = distPointPoly(p.x, p.y, this.botPoly(b));
      if (b.id === p.owner && p.reflected === 0 && !p.leftOwner) { // a shot can't hit its owner until it has cleared the owner's body
        if (dPoly >= hitR + 0.05) p.leftOwner = true;
        continue;
      }
      if (dPoly < hitR) {
        if (b.deflector || (this.hasEffect(b, 'reflector') && !b.reflectorUsed)) {
          if (!ghost) {
            if (!b.deflector) b.reflectorUsed = true;
            p.vx = -p.vx; p.vy = -p.vy; p.reflected++; p.owner = b.id; p.color = b.color;
            p.x += p.vx * dt * 2; p.y += p.vy * dt * 2;
            this.emit('reflect', { x: p.x, y: p.y, bot: b.id });
          }
          return ghost ? { type: 'bot', bot: b, reflected: true } : null;
        }
        return { type: 'bot', bot: b };
      }
    }
    return null;
  }

  projectileImpact(p, res) {
    const owner = p.owner !== null ? this.bots[p.owner] : null;
    if (res.type === 'out' || res.type === 'floor' || res.type === 'expire') {
      if (res.type === 'floor') this.emit('splash', { x: p.x, y: Math.min(p.y, this.lavaY), kind: this.map.killFloor.type });
      return;
    }
    if (res.type === 'split') {
      const ang = Math.atan2(p.vy, p.vx), sp = Math.hypot(p.vx, p.vy) * 1.1;
      for (const off of [-32, -11, 11, 32]) {
        const a = ang + off * DEG;
        this.projectiles.push({ ...p, x: p.x, y: p.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, splitAt: false, trail: [], life: 5, r: 0.14 });
      }
      this.emit('split', { x: p.x, y: p.y, color: p.color });
      return;
    }
    if (res.type === 'terrain' && p.kind === 'pinball' && p.bounced < p.bounces) {
      p.bounced++;
      p.x += res.nx * (res.depth + 0.02); p.y += res.ny * (res.depth + 0.02);
      const vn = p.vx * res.nx + p.vy * res.ny;
      p.vx -= 1.85 * vn * res.nx; p.vy -= 1.85 * vn * res.ny;
      this.projectiles.push(p);
      this.emit('bounce', { x: p.x, y: p.y, color: p.color });
      return;
    }
    if (res.type === 'mine') { this.detonateMine(res.mine, owner); }
    if (res.type === 'wall') {
      res.wall.hp -= p.dmg || 10;
      if (res.wall.hp <= 0) { this.walls = this.walls.filter((w) => w !== res.wall); this.emit('wallBreak', { x: res.wall.rect.x, y: res.wall.rect.y }); }
      else this.emit('wallHit', { x: p.x, y: p.y });
    }
    const fromAbove = p.vy > 2;
    switch (p.onImpact) {
      case 'toxic':
        this.fields.push({ x: p.x, y: p.y, r: BOTS.phantom.s2.radius, turns: 1, kind: 'toxic', owner: p.owner, tickTimer: 0, hits: {} });
        this.emit('toxic', { x: p.x, y: p.y, r: BOTS.phantom.s2.radius });
        return;
      case 'singularity':
        this.singularity = { x: p.x, y: p.y, r: BOTS.gravitas.s1.radius, t: 2.6 };
        this.emit('singularity', { x: p.x, y: p.y, r: BOTS.gravitas.s1.radius });
        return;
      case 'staticField':
        this.fields.push({ x: p.x, y: p.y, r: p.radius, turns: 2, kind: 'static' });
        break;
    }
    const dmg = p.kind === 'pinball' ? p.dmg + 5 * p.bounced : p.dmg;
    this.explode(p.x, p.y, p.radius, dmg, owner, {
      label: p.kind === 'bomb' ? 'Air strike' : (p.kind === 'missile' ? 'Missile' : p.kind), knock: p.knock, fromAbove, effect: p.effect, color: p.color,
      excludeSelf: p.kind === 'shard',
    });
  }

  done() {
    if (this.time >= PHYS.maxSimTime) { this.stepping = false; return true; }
    if (this.time < PHYS.minSimTime) return false;
    if (this.projectiles.length) return false;
    if (this.singularity && this.singularity.t > 0) return false;
    for (const b of this.alive()) {
      if (b.updraftPending || b.slamPending) return false;
      if (!b.grounded && b.y < this.lavaY) return false;
      if (Math.hypot(b.vx, b.vy) > PHYS.restSpeed) return false;
    }
    this.stepping = false;
    return true;
  }

  // Run the whole resolve to completion instantly (used by AI look-ahead and tests).
  runToEnd() { while (!this.step(PHYS.dt)) { /* spin */ } }

  endTurn() {
    // Static fields resolve at end of turn
    for (const f of this.fields) {
      if (f.kind === 'static' && !f.applied) {
        f.applied = true;
        for (const b of this.alive()) if (distPointPoly(f.x, f.y, this.botPoly(b)) < f.r) this.addEffect(b, 'shocked', 2);
      }
    }
    // Cooldowns, effect timers, expiry
    for (const b of this.bots) {
      if (!b.alive) continue;
      b.cd1 = Math.max(0, b.cd1 - 1); b.cd2 = Math.max(0, b.cd2 - 1);
      for (const k of Object.keys(b.effects)) { b.effects[k]--; if (b.effects[k] <= 0) delete b.effects[k]; }
      if (b.contact) { b.contactTurns--; if (b.contactTurns <= 0) b.contact = null; }
      if (b.deflector > 0) b.deflector--;
      if (b.lavaImmune > 0) b.lavaImmune--;
    }
    for (const f of this.fields) f.turns--;
    this.fields = this.fields.filter((f) => f.turns > 0);
    for (const p of this.patches) { p.turns--; p.touched = {}; }
    this.patches = this.patches.filter((p) => p.turns > 0);
  }

  applyPowerup(b, id) {
    const pu = POWERUPS[id];
    this.emit('pickup', { bot: b.id, x: b.x, y: b.y, id, name: pu.name });
    switch (id) {
      case 'repair': b.hp = Math.min(b.maxHp, b.hp + 40); delete b.effects.poison; delete b.effects.burn; break;
      case 'overclock': b.cd1 = 0; b.cd2 = 0; delete b.effects.shocked; break;
      case 'amp': case 'plating': case 'thrusters': this.addEffect(b, id, pu.turns); break;   // counts down at end of each turn; pickup turn is the first
      case 'reflector': this.addEffect(b, 'reflector', pu.turns); break;
      case 'toxin': case 'frost': case 'shockwire': b.contact = id; b.contactTurns = pu.turns; break;
      case 'rally':
        for (const o of this.alive()) if (this.sameTeam(o, b) || o === b) { o.hp += 20; if (o.hp > o.maxHp) { o.overheal = Math.min(20, o.hp - o.maxHp); o.hp = o.maxHp + o.overheal; } this.addEffect(o, 'rally', 3); }
        break;
    }
  }

  // ----- Sudden death -----
  enterSuddenDeath(diedThisTurn) {
    this.suddenDeath = true; this.sdRound++;
    this.lavaY = this.map.killFloor.y; // rising lava resets so spawn pads are safe
    this.powerups = []; this.airStrike = null; this.pendingAirStrike = null;
    this.walls = []; this.fields = []; this.patches = []; this.projectiles = [];
    for (const b of diedThisTurn) {
      b.alive = true; b.hp = TURN.suddenDeathHp; b.effects = {}; b.contact = null; b.deflector = 0;
      b.x = b.spawn[0]; b.y = b.spawn[1]; b.vx = 0; b.vy = 0; b.sdLast = null; b.diedTurn = -1;
    }
    this.settle();
    this.emit('suddenDeath', {});
  }

  // ----- Preview / look-ahead -----
  // Simulate the path of an action from bot b without mutating the world. Returns { points, impact }.
  previewAction(b, type, aimIn, param) {
    const aim = this.normAim(aimIn);
    const savedWind = this.windX;
    const points = [];
    let impact = null;
    if (type === 'jump' || type === 'moltenSlam' || type === 'updraft') {
      const ghost = { x: b.x, y: b.y, vx: 0, vy: 0, def: b.def, airborne: true, bounceLeft: b.def.id === 'ricochet' ? 1 : 0, grounded: false, facing: Math.abs(aim.dx) > 0.05 ? (aim.dx < 0 ? -1 : 1) : (b.facing || 1) };
      const gex = this.botExtents(ghost);
      const s = PHYS.jumpSpeed * (type === 'moltenSlam' ? Math.max(aim.power, 0.6) : aim.power) * this.jumpMul(b);
      ghost.vx = aim.dx * s; ghost.vy = aim.dy * s * (type === 'updraft' ? 2 : 1);
      if (ghost.vy > -2) ghost.vy = -2;
      let apex = null;
      let restFrames = 0;
      for (let i = 0; i < 300; i++) {
        ghost.vy += PHYS.gravity * PHYS.dt;
        if (this.windX && b.def.id !== 'skyla') ghost.vx += this.windX * 0.25 * PHYS.dt;
        const speed = Math.hypot(ghost.vx, ghost.vy);
        if (speed > 0.01) { const drag = 1 - PHYS.airDrag * PHYS.dt; ghost.vx *= drag; ghost.vy *= drag; }
        const sub = Math.min(6, Math.max(1, Math.ceil((speed * PHYS.dt) / 0.22)));
        let landed = false, onSlopeG = false;
        for (let ss = 0; ss < sub; ss++) {
          ghost.x += (ghost.vx * PHYS.dt) / sub; ghost.y += (ghost.vy * PHYS.dt) / sub;
          this.eachSolidHitPoly(() => this.botPoly(ghost), (h, solid) => {
            if (h.ny < -0.5 && solid.pts) onSlopeG = true;
            ghost.x += h.nx * h.depth; ghost.y += h.ny * h.depth;
            const vn = ghost.vx * h.nx + ghost.vy * h.ny;
            if (vn < 0) {
              if (ghost.bounceLeft > 0 && Math.abs(vn) > 3) { ghost.bounceLeft--; ghost.vx -= 1.65 * vn * h.nx; ghost.vy -= 1.65 * vn * h.ny; }
              else { const rest = Math.abs(vn) < 2.5 ? 0 : PHYS.botRestitution; ghost.vx -= (1 + rest) * vn * h.nx; ghost.vy -= (1 + rest) * vn * h.ny; }
            }
            if (h.ny < -0.5) landed = true;
          });
        }
        if (!apex && ghost.vy >= 0) apex = [ghost.x, ghost.y];
        if (this.map.teleporters) { if (ghost.x < 0) ghost.x += this.map.width; else if (ghost.x > this.map.width) ghost.x -= this.map.width; }
        else { if (ghost.x + gex.l < 0) { ghost.x = -gex.l; ghost.vx = Math.abs(ghost.vx) * 0.3; } if (ghost.x + gex.r > this.map.width) { ghost.x = this.map.width - gex.r; ghost.vx = -Math.abs(ghost.vx) * 0.3; } }
        if (landed) { const f = Math.max(0, 1 - PHYS.groundFriction * PHYS.dt); ghost.vx *= f; if (onSlopeG) { ghost.vy *= f; if (Math.hypot(ghost.vx, ghost.vy) < PHYS.slopeGrip) { ghost.vx = 0; ghost.vy = 0; } } else if (ghost.vy > 0) ghost.vy = 0; }
        points.push([ghost.x, ghost.y]);
        if (landed && Math.hypot(ghost.vx, ghost.vy) < 3) restFrames++; else restFrames = 0;
        if (restFrames >= 2) { impact = { type: 'land', x: ghost.x, y: ghost.y }; break; }
        if (ghost.y + gex.b > this.lavaY) { impact = { type: 'floor', x: ghost.x, y: ghost.y }; break; }
      }
      return { points, impact, apex };
    }
    if (type === 'blinkStrike') {
      const maxD = this.map.width * 0.6 * aim.power;
      let tx = b.x, ty = b.y;
      for (let d = 0.25; d <= maxD; d += 0.25) {
        const cx = b.x + aim.dx * d, cy = b.y + aim.dy * d;
        if (cx < 0.6 || cx > this.map.width - 0.6 || cy < 0.6 || cy > this.lavaY - 0.8) break;
        let blocked = false; this.eachSolidHitPoly(() => placedHull(b.def, cx, cy, aim.dx < 0 ? -1 : 1), () => { blocked = true; }); if (blocked) break;
        tx = cx; ty = cy; points.push([cx, cy]);
      }
      return { points, impact: { type: 'blink', x: tx, y: ty } };
    }
    if (type === 'chainArc' || type === 'galeShot' || type === 'shockwave' || type === 'deflector' || type === 'bastionWall') {
      const len = type === 'galeShot' ? 8 : (type === 'chainArc' ? 60 : 0);
      for (let d = 0; d < len; d += 0.5) points.push([b.x + aim.dx * d, b.y + aim.dy * d]);
      return { points, impact: null };
    }
    // projectile types
    const opts = this.projectileOptsFor(b, type, param);
    const savedTime = this.time;
    this.time = 1; // so the owner can be hit by reflections in preview
    const speed = PHYS.missileSpeed * aim.power * (opts.speedMul ?? 1) * (opts.kind === 'missile' ? PHYS.missileSpeedMul : 1) * (b.def.id === 'volt' && opts.kind === 'missile' ? 1.15 : 1);
    const p = { x: b.x + aim.dx * 0.7, y: b.y + aim.dy * 0.7, vx: aim.dx * speed, vy: aim.dy * speed, owner: b.id, kind: opts.kind, r: opts.r ?? PROJ_R, gravity: opts.gravity ?? 1, wind: 1, life: 6, bounces: opts.bounces || 0, bounced: 0, splitAt: opts.splitAt || false, reflected: 0, trail: [], radius: opts.radius ?? DMG.missileRadius, dmg: opts.dmg ?? DMG.missile };
    for (let i = 0; i < 400; i++) {
      const res = this.stepProjectile(p, PHYS.dt, true);
      points.push([p.x, p.y]);
      if (res) {
        if (res.type === 'terrain' && p.kind === 'pinball' && p.bounced < p.bounces) {
          p.bounced++;
          p.x += res.nx * (res.depth + 0.02); p.y += res.ny * (res.depth + 0.02);
          const vn = p.vx * res.nx + p.vy * res.ny;
          p.vx -= 1.85 * vn * res.nx; p.vy -= 1.85 * vn * res.ny;
          continue;
        }
        if (res.type === 'split') {
          // Simulate the four children so the guide and the AI see where they land.
          const ang = Math.atan2(p.vy, p.vx), sp = Math.hypot(p.vx, p.vy) * 1.1;
          const children = [];
          for (const off of [-32, -11, 11, 32]) {
            const a = ang + off * DEG;
            const cp = { ...p, x: p.x, y: p.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, splitAt: false, trail: [], life: 5, r: 0.14 };
            for (let j = 0; j < 300; j++) {
              const r2 = this.stepProjectile(cp, PHYS.dt, true);
              points.push([cp.x, cp.y]);
              if (r2) { if (r2.type !== 'out' && r2.type !== 'floor' && r2.type !== 'expire') children.push({ type: r2.type, x: cp.x, y: cp.y, bot: r2.bot ? r2.bot.id : null, radius: p.radius }); break; }
            }
          }
          impact = { type: 'split', x: p.x, y: p.y, children, radius: p.radius };
          break;
        }
        impact = { type: res.type, x: p.x, y: p.y, bot: res.bot ? res.bot.id : null, radius: p.radius };
        break;
      }
    }
    this.time = savedTime; this.windX = savedWind;
    return { points, impact };
  }

  projectileOptsFor(b, type, param) {
    const sp1 = b.def.s1, sp2 = b.def.s2;
    switch (type) {
      case 'missile': return { kind: 'missile' };
      case 'siegeShell': return { kind: 'siege', dmg: sp2.dmg, radius: sp2.radius, speedMul: 0.8, r: 0.3, gravity: 1.15 };
      case 'emberSpit': return { kind: 'ember', dmg: sp2.dmg, radius: sp2.radius, speedMul: 0.6, r: 0.14 };
      case 'staticField': return { kind: 'static', dmg: sp2.dmg, radius: sp2.radius };
      case 'anchorBolt': return { kind: 'anchor', dmg: sp2.dmg, radius: sp2.radius, speedMul: 1.05 };
      case 'toxicBomb': return { kind: 'toxic', dmg: 0, radius: BOTS.phantom.s2.radius };
      case 'pinball': return { kind: 'pinball', dmg: sp1.dmg, radius: sp1.radius, bounces: param ?? 4, r: 0.22 };
      case 'splitShot': return { kind: 'split', dmg: sp2.dmg, radius: sp2.radius, splitAt: true };
      case 'singularity': return { kind: 'singularity', dmg: 0, radius: sp1.radius, r: 0.26 };
      default: return { kind: 'missile' };
    }
  }

  // Serialise the minimum needed for the AI to clone and look ahead.
  snapshot() {
    return JSON.stringify({
      bots: this.bots.map((b) => ({ x: b.x, y: b.y, hp: b.hp, alive: b.alive })),
      lavaY: this.lavaY, windX: this.windX,
    });
  }
}

export { circleRectPush, pointInRect };
export { polyPush, distPointPoly, placedHull };
