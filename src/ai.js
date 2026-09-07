import * as THREE from '../vendor/three.module.min.js';
import { ARENA } from './config.js';

// Coarse grid A* navigation over the arena obstacles.
class NavGrid {
  constructor(arena, cell = 2, pad = 1.5) {
    this.cell = cell;
    this.n = Math.ceil(ARENA.size / cell);
    this.half = ARENA.size / 2;
    this.walkable = new Uint8Array(this.n * this.n);
    for (let j = 0; j < this.n; j++) {
      for (let i = 0; i < this.n; i++) {
        const { x, z } = this.toWorld(i, j);
        const inside = Math.abs(x) < this.half - pad && Math.abs(z) < this.half - pad;
        this.walkable[j * this.n + i] = inside && !arena.pointInObstacle(x, z, pad) ? 1 : 0;
      }
    }
  }
  toCell(x, z) {
    return {
      i: Math.max(0, Math.min(this.n - 1, Math.floor((x + this.half) / this.cell))),
      j: Math.max(0, Math.min(this.n - 1, Math.floor((z + this.half) / this.cell))),
    };
  }
  toWorld(i, j) { return { x: (i + 0.5) * this.cell - this.half, z: (j + 0.5) * this.cell - this.half }; }
  isWalk(i, j) { return i >= 0 && j >= 0 && i < this.n && j < this.n && this.walkable[j * this.n + i] === 1; }

  nearestWalkable(i, j) {
    if (this.isWalk(i, j)) return { i, j };
    for (let r = 1; r < 6; r++) {
      for (let dj = -r; dj <= r; dj++) for (let di = -r; di <= r; di++) {
        if (this.isWalk(i + di, j + dj)) return { i: i + di, j: j + dj };
      }
    }
    return { i, j };
  }

  // Returns array of world points (excluding start), or [] if unreachable.
  path(from, to) {
    const s = this.nearestWalkable(...Object.values(this.toCell(from.x, from.z)));
    const g = this.nearestWalkable(...Object.values(this.toCell(to.x, to.z)));
    const n = this.n;
    const key = (i, j) => j * n + i;
    const open = [];
    const gScore = new Map();
    const came = new Map();
    const closed = new Set();
    const h = (i, j) => Math.hypot(i - g.i, j - g.j);
    const sk = key(s.i, s.j);
    gScore.set(sk, 0);
    open.push({ i: s.i, j: s.j, f: h(s.i, s.j) });
    const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
    let iterations = 0;
    while (open.length && iterations++ < 4000) {
      let bi = 0;
      for (let k = 1; k < open.length; k++) if (open[k].f < open[bi].f) bi = k;
      const cur = open.splice(bi, 1)[0];
      const ck = key(cur.i, cur.j);
      if (cur.i === g.i && cur.j === g.j) {
        const out = [];
        let k = ck;
        while (k !== sk) {
          const i = k % n, j = Math.floor(k / n);
          const w = this.toWorld(i, j);
          out.push(new THREE.Vector3(w.x, 0, w.z));
          k = came.get(k);
        }
        out.reverse();
        return out;
      }
      if (closed.has(ck)) continue;
      closed.add(ck);
      for (const [di, dj] of dirs) {
        const ni = cur.i + di, nj = cur.j + dj;
        if (!this.isWalk(ni, nj)) continue;
        // no corner cutting
        if (di && dj && (!this.isWalk(cur.i + di, cur.j) || !this.isWalk(cur.i, cur.j + dj))) continue;
        const nk = key(ni, nj);
        const tentative = gScore.get(ck) + Math.hypot(di, dj);
        if (tentative < (gScore.get(nk) ?? Infinity)) {
          gScore.set(nk, tentative);
          came.set(nk, ck);
          open.push({ i: ni, j: nj, f: tentative + h(ni, nj) });
        }
      }
    }
    return [];
  }
}

const PREFERRED_RANGE = { striker: 11, titan: 9, phantom: 17 };

export class AIController {
  constructor(bot, enemy, arena, diff, game) {
    this.bot = bot;
    this.enemy = enemy;
    this.arena = arena;
    this.diff = diff;
    this.game = game;
    this.nav = game.nav || (game.nav = new NavGrid(arena, 2, Math.max(bot.radius, 1.3) + 0.3));
    this.state = 'engage';
    this.stateTimer = 0;
    this.strafeDir = 1;
    this.strafeTimer = 0;
    this.path = [];
    this.pathTimer = 0;
    this.pathTarget = null;
    this.reactionTimer = 0;
    this.aimYaw = 0;
    this.lastEnemyPos = enemy.pos.clone();
    this.lastHp = bot.hp;
    this.damageRecently = 0;
    this.fireHold = 0;
    this.wanderPoint = null;
  }

  reset() {
    this.state = 'engage';
    this.path = [];
    this.pathTarget = null;
    this.lastHp = this.bot.hp;
    this.damageRecently = 0;
  }

  // Compute the next output: { move: Vector3, yaw, fire, ability, special }
  think(dt) {
    const b = this.bot, e = this.enemy, d = this.diff;
    const out = { move: new THREE.Vector3(), yaw: b.yaw, fire: false, ability: false, special: false };
    if (!b.alive || !e.alive) return out;

    // damage tracking
    if (b.hp < this.lastHp) this.damageRecently += this.lastHp - b.hp;
    this.lastHp = b.hp;
    this.damageRecently = Math.max(0, this.damageRecently - dt * 25);

    const toEnemy = new THREE.Vector3().subVectors(e.pos, b.pos);
    const dist = toEnemy.length();
    const los = this.arena.hasLineOfSight(b.pos, e.pos);
    if (los) this.lastEnemyPos.copy(e.pos);

    // ----- State selection -----
    this.stateTimer -= dt;
    const hpFrac = b.hp / b.maxHp;
    const enemyHpFrac = e.hp / e.maxHp;
    const healthPickup = this.game.nearestPickup(b.pos, 'health');
    const energyPickup = this.game.nearestPickup(b.pos, 'energy');

    if (this.stateTimer <= 0) {
      this.stateTimer = 0.35 + Math.random() * 0.4;
      let next = 'engage';
      if (hpFrac < 0.35 && healthPickup && enemyHpFrac > hpFrac + 0.1 && Math.random() < 0.5 + d.abilityIQ * 0.4) next = 'retreat';
      else if (b.energy < 30 && energyPickup && energyPickup.dist < 18 && hpFrac > 0.4 && Math.random() < 0.6) next = 'energy';
      else if (!los) next = 'hunt';
      if (next !== this.state) { this.state = next; this.path = []; this.pathTarget = null; }
    }

    // ----- Movement -----
    const pref = PREFERRED_RANGE[b.cls.id] || 12;
    let goal = null;
    let directSteer = null;

    if (this.state === 'retreat' && healthPickup) goal = healthPickup.pos;
    else if (this.state === 'energy' && energyPickup) goal = energyPickup.pos;
    else if (this.state === 'hunt') goal = this.lastEnemyPos;
    else {
      // engage: keep preferred range and strafe
      this.strafeTimer -= dt;
      if (this.strafeTimer <= 0) {
        this.strafeTimer = 0.8 + Math.random() * 1.6;
        this.strafeDir = Math.random() < 0.5 ? -1 : 1;
      }
      const dirN = toEnemy.clone().normalize();
      const side = new THREE.Vector3(-dirN.z, 0, dirN.x).multiplyScalar(this.strafeDir);
      const steer = side.clone();
      if (dist > pref * 1.25) steer.add(dirN.multiplyScalar(1.2));
      else if (dist < pref * 0.6) steer.add(dirN.multiplyScalar(-1.0));
      directSteer = steer;
    }

    if (goal) {
      // path-follow with periodic replanning
      this.pathTimer -= dt;
      if (this.pathTimer <= 0 || !this.pathTarget || this.pathTarget.distanceTo(goal) > 3) {
        this.pathTimer = 0.7;
        this.pathTarget = goal.clone();
        this.path = this.nav.path(b.pos, goal);
      }
      while (this.path.length && this.path[0].distanceTo(b.pos) < 1.6) this.path.shift();
      const wp = this.path.length ? this.path[0] : goal;
      directSteer = new THREE.Vector3().subVectors(wp, b.pos);
      directSteer.y = 0;
      if (directSteer.lengthSq() > 0.01) directSteer.normalize();
    }

    // Dodge incoming projectiles: strafe perpendicular
    const dodge = this._dodgeVector();
    if (dodge) directSteer = directSteer ? directSteer.add(dodge.multiplyScalar(2)) : dodge;

    // Obstacle avoidance feelers
    if (directSteer && directSteer.lengthSq() > 0.01) {
      directSteer.normalize();
      const feel = 3.0;
      const ahead = b.pos.clone().addScaledVector(directSteer, feel);
      if (this.arena.segmentHit(b.pos.x, b.pos.z, ahead.x, ahead.z, 0.5) >= 0 || this.arena.pointInObstacle(ahead.x, ahead.z, b.radius)) {
        const left = new THREE.Vector3(-directSteer.z, 0, directSteer.x);
        const right = left.clone().negate();
        const lp = b.pos.clone().addScaledVector(left, feel);
        const rp = b.pos.clone().addScaledVector(right, feel);
        const lOk = !this.arena.pointInObstacle(lp.x, lp.z, b.radius) && Math.abs(lp.x) < this.arena.half - 1 && Math.abs(lp.z) < this.arena.half - 1;
        const rOk = !this.arena.pointInObstacle(rp.x, rp.z, b.radius) && Math.abs(rp.x) < this.arena.half - 1 && Math.abs(rp.z) < this.arena.half - 1;
        if (lOk && (!rOk || this.strafeDir > 0)) directSteer.add(left.multiplyScalar(1.5));
        else if (rOk) directSteer.add(right.multiplyScalar(1.5));
        else directSteer.negate();
        directSteer.normalize();
      }
      out.move.copy(directSteer);
    }

    // ----- Aiming -----
    // Lead the target based on its velocity and projectile speed, then add difficulty-scaled error.
    const w = b.cls.weapon;
    const lead = Math.min(dist / w.projectileSpeed, 0.8);
    const predicted = e.pos.clone().addScaledVector(e.vel, lead * (0.5 + d.abilityIQ * 0.5));
    const aimVec = predicted.sub(b.pos);
    let desiredYaw = Math.atan2(aimVec.x, aimVec.z);
    // wobble
    const t = performance.now() * 0.001;
    desiredYaw += Math.sin(t * 3.1 + b.pos.x) * d.aimError + Math.sin(t * 7.7) * d.aimError * 0.5;
    if (!los && this.state === 'hunt' && out.move.lengthSq() > 0.01) desiredYaw = Math.atan2(out.move.x, out.move.z);
    // turn rate limited
    let delta = desiredYaw - b.yaw;
    while (delta > Math.PI) delta -= Math.PI * 2;
    while (delta < -Math.PI) delta += Math.PI * 2;
    const turnRate = (3.5 + d.abilityIQ * 4) ;
    const maxStep = turnRate * dt;
    out.yaw = b.yaw + Math.max(-maxStep, Math.min(maxStep, delta));

    // ----- Firing -----
    this.reactionTimer -= dt;
    const aligned = Math.abs(delta) < 0.12 + (w.pierce ? 0 : 0.1);
    if (los && aligned && dist < 40) {
      if (this.reactionTimer <= -d.reaction) { out.fire = true; }
      if (this.reactionTimer > 0) this.reactionTimer = 0; // seen
    } else {
      this.reactionTimer = d.reaction; // reacquire
    }

    // ----- Abilities -----
    const iq = d.abilityIQ;
    const roll = Math.random() < iq * dt * 3; // rate-limited stochastic decisions
    const ab = b.cls.ability.id, sp = b.cls.special.id;
    if (b.canAbility()) {
      if (ab === 'dash') {
        if ((dodge && Math.random() < iq) || (this.state === 'retreat' && roll) || (dist > pref * 1.6 && los && roll)) out.ability = true;
      } else if (ab === 'shield') {
        if ((this.damageRecently > 20 && Math.random() < iq) || (dodge && Math.random() < iq * 0.8)) out.ability = true;
      } else if (ab === 'blink') {
        if ((dodge && Math.random() < iq) || (dist < 7 && roll) || (this.state === 'retreat' && roll)) out.ability = true;
      }
    }
    if (b.canSpecial()) {
      if (sp === 'overdrive') { if (los && dist < pref * 1.4 && Math.random() < iq * dt * 2) out.special = true; }
      else if (sp === 'slam') { if (dist < b.cls.special.radius * 0.85 && Math.random() < iq) out.special = true; }
      else if (sp === 'emp') { if (dist < b.cls.special.radius * 0.9 && los && Math.random() < iq * dt * 3) out.special = true; }
    }

    return out;
  }

  _dodgeVector() {
    const b = this.bot;
    const projs = this.game.projectiles.list;
    let best = null, bestT = Infinity;
    for (const p of projs) {
      if (p.owner === b) continue;
      const rel = new THREE.Vector3().subVectors(b.pos, p.pos);
      rel.y = 0;
      const speed = p.vel.length();
      if (speed < 1) continue;
      const dirN = p.vel.clone().normalize();
      const along = rel.dot(dirN);
      if (along < 0 || along > 18) continue;
      const perp = rel.clone().addScaledVector(dirN, -along);
      if (perp.length() < b.radius * 2.2) {
        const t = along / speed;
        if (t < bestT) {
          bestT = t;
          const side = new THREE.Vector3(-dirN.z, 0, dirN.x);
          const sign = perp.dot(side) >= 0 ? 1 : -1;
          best = side.multiplyScalar(sign);
        }
      }
    }
    if (best && Math.random() < this.diff.abilityIQ + 0.2) return best;
    return null;
  }
}
