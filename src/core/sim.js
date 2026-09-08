// Deterministic turn simulation for Super Bots.
// The World holds every bot, projectile, wall, field and power-up. Each turn:
//   startTurn()  -> pre-turn effects, hazard announcements, power-up spawns
//   submit()     -> one action per bot
//   resolve()    -> applies movement/launches, then step(dt) until done()
//   endTurn()    -> pickups, cooldown ticks, expiry
// All randomness goes through this.rng so replays are deterministic.

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
    this.mines = (map.mines || []).map(([x, y]) => { const pt = { x, y }; for (let g = 0; g < 40; g++) { let hit = null; for (const rc of map.terrain) { const px = Math.max(rc.x, Math.min(pt.x, rc.x + rc.w)), py = Math.max(rc.y, Math.min(pt.y, rc.y + rc.h)); if (Math.hypot(pt.x - px, pt.y - py) < 0.45) { hit = rc; break; } } if (!hit) break; pt.y = hit.y - 0.6; } return { x: pt.x, y: pt.y, alive: true, timer: 0 }; });
    this.singularity = null;
    this.lavaY = map.killFloor.y;
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
        stats: { dealt: 0, taken: 0, kills: 0, turnsAlive: 0, specials: 0 },
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
    for (const rc of this.solids()) {
      const hit = circleRectPush(b.x, b.y, PHYS.botRadius, rc);
      if (!hit) continue;
      b.x += hit.nx * hit.depth; b.y += hit.ny * hit.depth;
      const vn = b.vx * hit.nx + b.vy * hit.ny;
      if (vn < 0) {
        const rest = (b.bounceLeft > 0 && b.airborne) ? 0.65 : PHYS.botRestitution;
        if (b.bounceLeft > 0 && b.airborne && Math.abs(vn) > 3) { b.bounceLeft--; this.emit('bounce', { x: b.x, y: b.y }); }
        b.vx -= (1 + rest) * vn * hit.nx; b.vy -= (1 + rest) * vn * hit.ny;
      }
      if (hit.ny < -0.5) touchedGround = true;
    }
    // Wedge rescue: a bot trapped between two stacked blocks (one pushing up, one
    // pushing down) would oscillate forever. If the centre is still inside any
    // solid, lift the bot to the top of that block.
    for (let g = 0; g < 8; g++) {
      let inside = null;
      for (const rc of this.solids()) { if (b.x > rc.x && b.x < rc.x + rc.w && b.y > rc.y && b.y < rc.y + rc.h) { inside = rc; break; } }
      if (!inside) break;
      b.y = inside.y - PHYS.botRadius;
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
    for (const b of this.bots) { b.killsTurn = 0; b.reflectorUsed = false; if (b.alive) b.stats.turnsAlive++; }

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
          for (const mn of this.mines) if (!mn.alive) { mn.timer--; if (mn.timer <= 0) { mn.alive = true; this.emit('mineSpawn', { x: mn.x, y: mn.y }); } }
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
          if (b.x > h.x - PHYS.botRadius && b.x < h.x + h.w + PHYS.botRadius && b.y > h.top && b.y < h.bottom + 0.6) {
            this.applyDamage(b, h.dmg, { type: 'hazard', label: 'Crusher' });
            b.vx += (b.x < h.x + h.w / 2 ? -1 : 1) * 6; b.vy += 3;
          }
        }
      } else if (ph.type === 'geyser') {
        for (const [gx, gy] of ph.points) {
          this.emit('geyser', { x: gx, y: gy, r: ph.h.radius });
          for (const b of this.alive()) {
            if (Math.hypot(b.x - gx, b.y - gy) < ph.h.radius + PHYS.botRadius) {
              this.applyDamage(b, ph.h.dmg, { type: 'hazard', label: 'Geyser' });
              b.vy -= 12; b.vx += (b.x - gx) * 3;
            }
          }
        }
      } else if (ph.type === 'reactor') {
        const h = ph.h;
        this.emit('reactorPulse', { x: h.x, y: h.y, r: h.r });
        for (const b of this.alive()) {
          if (Math.hypot(b.x - h.x, b.y - h.y) < h.r + PHYS.botRadius) {
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
      const n = Math.max(4, Math.round((this.map.width / 3) * 0.7));
      for (let i = 0; i < n; i++) {
        const x = (i + 0.5) * (this.map.width / n) + this.rng.range(-1.2, 1.2);
        this.projectiles.push({
          x, y: -2 - this.rng.range(0, 6), vx: this.rng.range(-2.5, 2.5), vy: 4, owner: null, kind: 'missile', dmg: DMG.missile, radius: DMG.missileRadius,
          delay: 2.2 + this.rng.range(0, 1.2), bounces: 0, bounced: 0, life: 9, r: PROJ_R, gravity: 1, wind: 1, color: '#ff7a2f', trail: [], knock: 1, effect: null, splitAt: false, onImpact: null, reflected: 0,
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
    const speed = PHYS.missileSpeed * aim.power * (opts.speedMul ?? 1) * (b.def.id === 'volt' && opts.kind === 'missile' ? 1.15 : 1);
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
    this.spawnProjectile(b, aim, { kind: 'missile' });
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
      if (this.solids().some((rc) => circleRectPush(cx, cy, PHYS.botRadius * 0.9, rc))) break;
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
      if (d > radius + PHYS.botRadius) continue;
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
      if (this.map.teleporters) { if (b.x < 0) { b.x += this.map.width; this.emit('teleport', { bot: b.id }); } else if (b.x > this.map.width) { b.x -= this.map.width; this.emit('teleport', { bot: b.id }); } }
      else { if (b.x < PHYS.botRadius) { b.x = PHYS.botRadius; b.vx = Math.abs(b.vx) * 0.3; } if (b.x > this.map.width - PHYS.botRadius) { b.x = this.map.width - PHYS.botRadius; b.vx = -Math.abs(b.vx) * 0.3; } }
      b.grounded = onGround;
      if (onGround) { const f = Math.max(0, 1 - PHYS.groundFriction * dt); b.vx *= f; if (Math.abs(b.vx) < 0.05) b.vx = 0; if (b.vy > 0) b.vy = 0; }
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
      if (b.y + PHYS.botRadius > this.lavaY) {
        if (this.map.killFloor.type === 'lava' && b.def.id === 'magmaw' && b.lavaImmune <= 0 && !b.lavaTouched) {
          b.lavaTouched = true; b.lavaImmune = 2; b.vy = -15; b.y = this.lavaY - PHYS.botRadius - 0.05;
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
          if (Math.hypot(b.x - f.x, b.y - f.y) > f.r + PHYS.botRadius) continue;
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
        if (Math.abs(b.x - pch.x) < pch.w / 2 + PHYS.botRadius && Math.abs(b.y - pch.y) < 1.1 && b.grounded) {
          pch.touched = pch.touched || {};
          if (pch.touched[b.id]) continue;
          pch.touched[b.id] = true;
          this.applyDamage(b, pch.dmg, { type: 'status', label: 'Burning ground' });
        }
      }
    }
    // Power-ups are grabbed the moment a bot touches them (buffs apply immediately, mid-turn)
    for (const b of this.alive()) {
      for (let i = this.powerups.length - 1; i >= 0; i--) {
        const pu = this.powerups[i];
        if (Math.hypot(b.x - pu.x, b.y - pu.y) < PHYS.botRadius + 0.6) { this.powerups.splice(i, 1); this.applyPowerup(b, pu.id); }
      }
    }
    // Mines: bots that touch one set it off
    if (this.settings.hazards) for (const mn of this.mines) {
      if (!mn.alive) continue;
      for (const b of this.alive()) if (Math.hypot(b.x - mn.x, b.y - mn.y) < PHYS.botRadius + 0.45) { this.detonateMine(mn, null); break; }
    }
    // Bot-bot collisions and contact effects
    const alive = this.alive();
    for (let i = 0; i < alive.length; i++) for (let j = i + 1; j < alive.length; j++) {
      const a = alive[i], c = alive[j];
      const dx = c.x - a.x, dy = c.y - a.y, d = Math.hypot(dx, dy), min = PHYS.botRadius * 2;
      if (d >= min || d < 1e-6) continue;
      const nx = dx / d, ny = dy / d, push = (min - d) / 2;
      a.x -= nx * push; a.y -= ny * push; c.x += nx * push; c.y += ny * push;
      const rel = (c.vx - a.vx) * nx + (c.vy - a.vy) * ny;
      if (rel < 0) { const imp = -rel * 0.5; a.vx -= nx * imp; a.vy -= ny * imp; c.vx += nx * imp; c.vy += ny * imp; }
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
    if (p.delay && p.delay > 0) { p.delay -= dt; return null; }
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
    for (const rc of this.map.terrain) {
      const h = circleRectPush(p.x, p.y, p.r, rc);
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
      if (b.id === p.owner && p.reflected === 0 && this.time - (p.born || 0) < 0.3) continue; // don't hit yourself at launch
      const hitR = PHYS.botRadius + p.r + (b.deflector ? 0.55 : 0);
      if (Math.hypot(b.x - p.x, b.y - p.y) < hitR) {
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
        for (const b of this.alive()) if (Math.hypot(b.x - f.x, b.y - f.y) < f.r + PHYS.botRadius) this.addEffect(b, 'shocked', 2);
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
      const ghost = { x: b.x, y: b.y, vx: 0, vy: 0, def: b.def, airborne: true, bounceLeft: b.def.id === 'ricochet' ? 1 : 0, grounded: false };
      const s = PHYS.jumpSpeed * (type === 'moltenSlam' ? Math.max(aim.power, 0.6) : aim.power) * this.jumpMul(b);
      ghost.vx = aim.dx * s; ghost.vy = aim.dy * s * (type === 'updraft' ? 2 : 1);
      if (ghost.vy > -2) ghost.vy = -2;
      let apex = null;
      for (let i = 0; i < 240; i++) {
        ghost.vy += PHYS.gravity * PHYS.dt;
        if (this.windX && b.def.id !== 'skyla') ghost.vx += this.windX * 0.25 * PHYS.dt;
        ghost.x += ghost.vx * PHYS.dt; ghost.y += ghost.vy * PHYS.dt;
        if (!apex && ghost.vy >= 0) apex = [ghost.x, ghost.y];
        if (this.map.teleporters) { if (ghost.x < 0) ghost.x += this.map.width; else if (ghost.x > this.map.width) ghost.x -= this.map.width; }
        else ghost.x = Math.max(PHYS.botRadius, Math.min(this.map.width - PHYS.botRadius, ghost.x));
        let landed = false;
        for (const rc of this.solids()) {
          const h = circleRectPush(ghost.x, ghost.y, PHYS.botRadius, rc);
          if (!h) continue;
          ghost.x += h.nx * h.depth; ghost.y += h.ny * h.depth;
          const vn = ghost.vx * h.nx + ghost.vy * h.ny;
          if (vn < 0) {
            if (ghost.bounceLeft > 0 && Math.abs(vn) > 3) { ghost.bounceLeft--; ghost.vx -= 1.65 * vn * h.nx; ghost.vy -= 1.65 * vn * h.ny; }
            else { landed = h.ny < -0.5; ghost.vx -= (1 + PHYS.botRestitution) * vn * h.nx; ghost.vy -= (1 + PHYS.botRestitution) * vn * h.ny; }
          }
        }
        points.push([ghost.x, ghost.y]);
        if (landed && Math.abs(ghost.vy) < 3) { impact = { type: 'land', x: ghost.x, y: ghost.y }; break; }
        if (ghost.y + PHYS.botRadius > this.lavaY) { impact = { type: 'floor', x: ghost.x, y: ghost.y }; break; }
      }
      return { points, impact, apex };
    }
    if (type === 'blinkStrike') {
      const maxD = this.map.width * 0.6 * aim.power;
      let tx = b.x, ty = b.y;
      for (let d = 0.25; d <= maxD; d += 0.25) {
        const cx = b.x + aim.dx * d, cy = b.y + aim.dy * d;
        if (cx < 0.6 || cx > this.map.width - 0.6 || cy < 0.6 || cy > this.lavaY - 0.8) break;
        if (this.solids().some((rc) => circleRectPush(cx, cy, PHYS.botRadius * 0.9, rc))) break;
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
    const speed = PHYS.missileSpeed * aim.power * (opts.speedMul ?? 1) * (b.def.id === 'volt' && opts.kind === 'missile' ? 1.15 : 1);
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
