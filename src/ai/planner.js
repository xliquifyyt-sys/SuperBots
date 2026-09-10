// AI planner: for one bot, evaluates candidate actions by simulating them with the
// world's preview function and picks the best-scoring one with difficulty-scaled noise.

import { PHYS, DMG } from '../core/defs.js';

const DEG = Math.PI / 180;
const PROJECTILE_SPECIALS = ['siegeShell', 'emberSpit', 'staticField', 'anchorBolt', 'pinball', 'splitShot', 'singularity', 'toxicBomb'];
const JUMP_SPECIALS = ['moltenSlam', 'updraft', 'blinkStrike'];

export class AIPlanner {
  constructor(world, diff, rng) {
    this.world = world;
    this.diff = diff;
    this.rng = rng;
  }

  plan(b) {
    const w = this.world;
    const avail = w.availableActions(b);
    const enemies = w.enemiesOf(b);
    const allEnemies = w.enemiesOf(b);
    const candidates = [];
    // Accuracy stat scales AI aim noise the same way it shortens the player's guide.
    const noise = this.diff.aimNoise * ({ low: 1.55, medium: 1.15, high: 0.75 }[b.def.accuracy] || 1);

    // ---- Danger assessment ----
    let danger = this.dangerAt(b, b.x, b.y);
    // Threat: enemies with a line on us will shoot where we stand. Light bots dodge, heavies hold.
    const dodgeMul = { light: 1.35, medium: 0.9, heavy: 0.45 }[b.def.weight];
    let threat = 0;
    for (const e of allEnemies) { const d = Math.hypot(e.x - b.x, e.y - b.y); if (d < 30) threat += (d < 14 ? 10 : 6); }
    threat *= dodgeMul * (b.hp < b.maxHp * 0.45 ? 1.5 : 1);
    this.threat = threat; // rewarded to jumps only: enemies fire at where we stand now

    // ---- Projectile actions ----
    const projTypes = [];
    if (avail.missile) projTypes.push({ key: 'missile', type: 'missile', dmg: DMG.missile, radius: DMG.missileRadius });
    if (avail.s1 && PROJECTILE_SPECIALS.includes(b.def.s1.id)) projTypes.push({ key: 's1', type: b.def.s1.id, dmg: b.def.s1.dmg || 0, radius: b.def.s1.radius || 1, special: b.def.s1 });
    if (avail.s2 && PROJECTILE_SPECIALS.includes(b.def.s2.id)) projTypes.push({ key: 's2', type: b.def.s2.id, dmg: b.def.s2.dmg || 0, radius: b.def.s2.radius || 1, special: b.def.s2 });

    if (enemies.length) {
      for (const pt of projTypes) {
        const best = this.bestProjectileAim(b, pt, enemies);
        if (best) candidates.push(best);
      }
    }

    // ---- Instant specials ----
    for (const slot of ['s1', 's2']) {
      if (!avail[slot]) continue;
      const sp = b.def[slot];
      const c = this.evaluateInstant(b, slot, sp, enemies, allEnemies, danger);
      if (c) candidates.push(c);
    }

    // ---- Jumps ----
    const noShot = !candidates.some((c) => c.score > 5);
    if (avail.jump) {
      const j = this.bestJump(b, 'jump', 'jump', allEnemies, danger, noShot);
      if (j) candidates.push(j);
    }
    for (const slot of ['s1', 's2']) {
      if (!avail[slot] || !JUMP_SPECIALS.includes(b.def[slot].id)) continue;
      const j = this.bestJump(b, slot, b.def[slot].id, allEnemies, danger, noShot);
      if (j) candidates.push(j);
    }

    if (!candidates.length) return { type: avail.jump ? 'jump' : 'skip', aim: { dx: this.rng.next() < 0.5 ? -1 : 1, dy: -1, power: 0.6 }, locked: true };

    // Pick the best with a little randomness so bots aren't perfectly predictable.
    for (const c of candidates) c.score += this.rng.range(-3, 3) + (c.key === 'missile' ? 0 : this.rng.range(0, 6) * this.diff.specialIQ);
    candidates.sort((p, q) => q.score - p.score);
    const chosen = candidates[0];

    // Apply aim noise (angle jitter and power jitter) scaled by difficulty.
    const a = chosen.aim;
    const ang = Math.atan2(a.dy, a.dx) + this.rng.range(-noise, noise) * 2.2;
    const power = Math.max(0.15, Math.min(1, a.power * (1 + this.rng.range(-noise, noise) * 1.5)));
    return { type: chosen.key, aim: { dx: Math.cos(ang), dy: Math.sin(ang), power }, param: chosen.param, locked: true, debug: chosen.debug };
  }

  // How dangerous a spot is for bot b (higher = worse).
  dangerAt(b, x, y) {
    const w = this.world;
    let d = 0;
    if (y > w.lavaY - 2.2) d += (2.2 - (w.lavaY - y)) * 12;
    for (const a of w.hazardAnnounce) {
      if (a.zone && x > a.zone.x - 0.5 && x < a.zone.x + a.zone.w + 0.5 && y > a.zone.y - 0.5 && y < a.zone.y + a.zone.h + 1) d += a.type === 'danger' ? 45 : 25;
      if (a.circle && Math.hypot(x - a.circle.x, y - a.circle.y) < a.circle.r + 0.6) d += a.type === 'danger' ? 30 : 15;
      if (a.points) for (const [px, py] of a.points) if (Math.hypot(x - px, y - py) < (a.radius || 1.4) + 0.6) d += a.type === 'danger' ? 35 : 18;
      if (a.airstrike && !w.hasCoverAbove(x, y)) d += a.airstrike === 'now' ? 45 : 30; // missiles rain everywhere: get under something
    }
    for (const p of w.patches) if (Math.abs(x - p.x) < p.w / 2 + 0.5 && Math.abs(y - p.y) < 1.3 && b.def.id !== 'magmaw') d += 20;
    for (const mn of w.mines) if (mn.alive && Math.hypot(x - mn.x, y - mn.y) < 1.9) d += 28;
    for (const f of w.fields) if ((f.kind === 'static' || f.kind === 'toxic') && Math.hypot(x - f.x, y - f.y) < f.r + 0.5) d += f.kind === 'toxic' ? 25 : 15;
    // Being clumped with several enemies is dangerous (self-destructs, AoE)
    let near = 0;
    for (const e of w.enemiesOf(b)) if (Math.hypot(e.x - x, e.y - y) < 2.5) near++;
    if (near >= 2) d += 10 * near;
    return d;
  }

  aimSamples(count) {
    const out = [];
    const angles = Math.max(8, Math.round(count / 6));
    for (let i = 0; i < angles; i++) {
      const ang = 160 + (i / (angles - 1)) * 220; // 160° (left, slightly down) through 270° (up) to 380° (right, slightly down)
      for (const power of [0.35, 0.5, 0.65, 0.8, 0.92, 1]) out.push({ dx: Math.cos(ang * DEG), dy: Math.sin(ang * DEG), power });
    }
    return out;
  }

  bestProjectileAim(b, pt, enemies) {
    const param = pt.type === 'pinball' ? 4 : undefined;
    let best = null;
    for (const aim of this.aimSamples(this.diff.samples)) {
      const score = this.scoreProjectile(b, pt, enemies, aim, param);
      if (score === null) continue;
      if (!best || score > best.score) best = { key: pt.key, aim, score, param, debug: pt.type };
    }
    if (!best) return null;
    // Local refinement: perturb the best aim and keep improvements.
    const iters = Math.round(6 + this.diff.specialIQ * 18);
    for (let i = 0; i < iters; i++) {
      const ang = Math.atan2(best.aim.dy, best.aim.dx) + this.rng.range(-4, 4) * DEG;
      const power = Math.max(0.15, Math.min(1, best.aim.power + this.rng.range(-0.06, 0.06)));
      const aim = { dx: Math.cos(ang), dy: Math.sin(ang), power };
      const score = this.scoreProjectile(b, pt, enemies, aim, param);
      if (score !== null && score > best.score) best = { ...best, aim, score };
    }
    if (best.score <= 0 && pt.key !== 'missile') return null;
    if (best.key !== 'missile') best.score *= 0.6 + this.diff.specialIQ * 0.6;
    return best;
  }

  // Score one projectile aim. Returns null for useless shots (off map, into the floor).
  scoreProjectile(b, pt, enemies, aim, param) {
    const w = this.world;
    const baseDmg = pt.type === 'pinball' ? pt.dmg + 10 : pt.dmg;
    const pv = w.previewAction(b, pt.type, aim, param);
    const imp = pv.impact;
    if (!imp || imp.type === 'out' || imp.type === 'expire' || imp.type === 'floor') return null;
    let score = 0;
    const radius = (pt.radius || 1) + PHYS.botRadius;
    if (pt.type === 'singularity') {
      let n = 0, floorPull = 0;
      for (const e of enemies) { const d = Math.hypot(e.x - imp.x, e.y - imp.y); if (d < 7) { n++; if (imp.y > w.lavaY - 2.5) floorPull += 25; } }
      return n >= 2 ? 22 * n : (n === 1 ? 6 + floorPull : -5);
    }
    if (pt.type === 'toxicBomb') {
      let n = 0;
      for (const e of enemies) if (Math.hypot(e.x - imp.x, e.y - imp.y) < 2.6) n++;
      if (Math.hypot(b.x - imp.x, b.y - imp.y) < 2.8) n -= 2;
      return n > 0 ? 26 * n : -8;
    }
    if (imp.type === 'split') {
      // Split Shot: score each child impact.
      let total = 0;
      for (const ch of imp.children) {
        for (const e of enemies) { const d = Math.hypot(e.x - ch.x, e.y - ch.y); if (d < radius) total += baseDmg + (e.hp <= baseDmg ? 20 : 0); else if (d < radius + 2) total += 1.5 - (d - radius) * 0.6; }
        if (Math.hypot(b.x - ch.x, b.y - ch.y) < radius + 0.3) total -= baseDmg;
      }
      return total;
    }
    if (imp.type === 'mine') { let n = 0; for (const e of enemies) if (Math.hypot(e.x - imp.x, e.y - imp.y) < 1.8) n++; if (Math.hypot(b.x - imp.x, b.y - imp.y) < 1.8) n -= 2; return n > 0 ? 22 * n : -6; }
    for (const e of enemies) {
      const d = Math.hypot(e.x - imp.x, e.y - imp.y);
      if (d < radius) {
        const dmg = baseDmg * (imp.bot === e.id ? 1 : 0.95);
        score += dmg + (e.hp <= dmg ? 40 : 0) + (pt.special && pt.special.id === 'anchorBolt' ? 12 : 0) + (pt.type === 'staticField' ? 10 : 0) + (pt.type === 'emberSpit' ? 8 : 0);
        score += (radius - d) * 2; // reward the centre of the blast
      } else {
        score += Math.max(-3, 3 - (d - radius) * 1.2); // near misses give the refinement a gradient
      }
    }
    const ds = Math.hypot(b.x - imp.x, b.y - imp.y);
    if (ds < radius + 0.3) score -= baseDmg * 1.5;
    for (const t of w.bots) if (t.alive && t !== b && w.sameTeam(t, b) && Math.hypot(t.x - imp.x, t.y - imp.y) < radius) score -= w.settings.friendlyFire ? baseDmg : 8;
    return score;
  }

  evaluateInstant(b, slot, sp, enemies, allEnemies, danger) {
    const w = this.world;
    const iq = this.diff.specialIQ;
    const nearest = this.nearest(b, allEnemies);
    switch (sp.id) {
      case 'chainArc': {
        let best = null;
        for (const e of enemies) {
          const dx = e.x - b.x, dy = e.y - b.y, d = Math.hypot(dx, dy) || 1;
          const aim = { dx: dx / d, dy: dy / d, power: 1 };
          let hits = 0;
          for (const o of enemies) { const t = (o.x - b.x) * aim.dx + (o.y - b.y) * aim.dy; if (t > 0 && Math.hypot(o.x - (b.x + aim.dx * t), o.y - (b.y + aim.dy * t)) < 0.7) hits++; }
          const score = 30 * hits + (hits && enemies.some((o) => o !== e && Math.hypot(o.x - e.x, o.y - e.y) < 6) ? 15 : 0);
          if (!best || score > best.score) best = { key: slot, aim, score: score * (0.7 + iq * 0.5), debug: 'chainArc' };
        }
        return best;
      }
      case 'shockwave': {
        let n = 0; for (const e of allEnemies) if (Math.hypot(e.x - b.x, e.y - b.y) < sp.radius + 0.4) n++;
        return n ? { key: slot, aim: { dx: 1, dy: -1, power: 1 }, score: (25 * n + (n > 1 ? 15 : 0)) * (0.7 + iq * 0.5), debug: 'shockwave' } : null;
      }
      case 'galeShot': {
        if (!nearest) return null;
        const dx = nearest.x - b.x, dy = nearest.y - b.y, d = Math.hypot(dx, dy);
        if (d > 7.5) return null;
        const aim = { dx: dx / d, dy: dy / d, power: 1 };
        // Big value if the push sends them toward the kill floor or off a ledge
        let score = 10;
        const landX = nearest.x + aim.dx * 3.5;
        const overFloor = !w.map.terrain.some((rc) => landX > rc.x - 0.3 && landX < rc.x + rc.w + 0.3 && rc.y > nearest.y);
        if (overFloor) score += 45;
        if (nearest.y > w.lavaY - 3) score += 20;
        return { key: slot, aim, score: score * (0.6 + iq * 0.6), debug: 'gale' };
      }
      case 'deflector': {
        const threats = allEnemies.filter((e) => Math.hypot(e.x - b.x, e.y - b.y) < 16).length;
        const score = (b.hp < b.maxHp * 0.6 ? 18 : 6) + threats * 6 + (danger > 20 ? 8 : 0);
        return this.rng.next() < iq ? { key: slot, aim: { dx: 1, dy: -1, power: 1 }, score, debug: 'deflector' } : null;
      }
      case 'bastionWall': {
        if (!nearest || w.walls.some((x) => x.owner === b.id)) return null;
        const dx = nearest.x - b.x;
        const score = (b.hp < b.maxHp * 0.7 ? 16 : 6) + allEnemies.filter((e) => Math.abs(e.y - b.y) < 2.5).length * 6;
        return this.rng.next() < iq ? { key: slot, aim: { dx: Math.sign(dx) || 1, dy: 0, power: 1 }, score, debug: 'wall' } : null;
      }
    }
    return null;
  }

  nearest(b, list) {
    let best = null, bd = Infinity;
    for (const e of list) { const d = Math.hypot(e.x - b.x, e.y - b.y); if (d < bd) { bd = d; best = e; } }
    return best;
  }

  bestJump(b, key, type, enemies, dangerHere, noShot = false) {
    const w = this.world;
    let best = null;
    const wantMove = dangerHere > 12 || b.hp < b.maxHp * 0.3 || noShot;
    const nearest = this.nearest(b, enemies);
    for (const aim of this.aimSamples(Math.max(36, this.diff.samples * 0.6))) {
      if (aim.dy > 0.2) continue; // jumps go up
      const pv = w.previewAction(b, type, aim);
      const imp = pv.impact;
      if (!imp || imp.type !== 'land' && imp.type !== 'blink') continue;
      const lx = imp.x, ly = imp.y;
      const dangerThere = this.dangerAt(b, lx, ly);
      let score = (dangerHere - dangerThere) * 0.9 - 4; // moving costs a shot
      const moved = Math.hypot(lx - b.x, ly - b.y);
      if (moved > 2.5) score += (this.threat || 0) * (type === 'jump' ? 0.9 : 0.5); // dodging value
      const camping = (b.stillTurns || 0) >= 3 && (this.threat || 0) > 0;
      if (type === 'jump' && !wantMove && (this.threat || 0) < 8 && !camping) score -= 10;
      if (type === 'jump' && camping && moved > 2) score += 6 + 3 * Math.min(4, b.stillTurns); // sitting in one spot under fire gets stale
      // Power-ups
      for (const pu of w.powerups) { const d = Math.hypot(pu.x - lx, pu.y - ly); if (d < 1.4) score += pu.id === 'repair' && b.hp < b.maxHp * 0.7 ? 34 : 22; }
      // Spacing from enemies
      if (nearest) {
        const dNow = Math.hypot(nearest.x - b.x, nearest.y - b.y), dThen = Math.hypot(nearest.x - lx, nearest.y - ly);
        if (type === 'jump') { if (dThen < 2.5) score -= 8; if (dNow < 2.2 && dThen > 3) score += 8; }
        // No shot available: close the distance (but keep a little spacing)
        if (noShot && type === 'jump' && dThen < dNow - 0.5 && dThen > 3) score += 18 + Math.min(20, (dNow - dThen) * 2.5);
      }
      // Holding a contact power-up: landing on an enemy transfers it.
      if (b.contact && type === 'jump') for (const e of enemies) if (Math.hypot(e.x - lx, e.y - ly) < 1.1) score += 30;
      if (type === 'moltenSlam') {
        let n = 0; for (const e of enemies) if (Math.hypot(e.x - lx, e.y - ly) < b.def.s1.radius + 0.4) n++;
        score += n ? 35 * n + 10 : -15;
      } else if (type === 'blinkStrike') {
        let n = 0; for (const e of enemies) if (Math.hypot(e.x - lx, e.y - ly) < 3.2) n++;
        score += n ? 28 : -12;
        if (dangerThere > 15) score -= 15;
      } else if (type === 'updraft') {
        score += nearest && Math.hypot(nearest.x - lx, nearest.y - ly) < 12 ? 14 : 2;
        score += 6; // it also fires
      }
      if (score > (best ? best.score : -Infinity)) best = { key, aim, score, debug: type };
    }
    if (best && key !== 'jump') best.score *= 0.6 + this.diff.specialIQ * 0.6;
    return best;
  }
}
