import * as THREE from '../vendor/three.module.min.js';

const _a = new THREE.Vector3();
const _b = new THREE.Vector3();

// Distance from point p to segment ab (3D). Returns {d, t}.
function pointSegDist(p, a, b) {
  _a.subVectors(b, a);
  const len2 = _a.lengthSq();
  let t = 0;
  if (len2 > 1e-9) t = Math.max(0, Math.min(1, _b.subVectors(p, a).dot(_a) / len2));
  _b.copy(a).addScaledVector(_a, t);
  return { d: _b.distanceTo(p), t };
}

export class Projectiles {
  constructor(scene, arena, particles, audio) {
    this.scene = scene;
    this.arena = arena;
    this.particles = particles;
    this.audio = audio;
    this.list = [];
    this.geoCache = new Map();
    this.matCache = new Map();
    this.onHit = null; // (proj, targetBot, damage) => void
  }

  _geo(size) {
    if (!this.geoCache.has(size)) this.geoCache.set(size, new THREE.SphereGeometry(size, 10, 8));
    return this.geoCache.get(size);
  }
  _mat(color) {
    if (!this.matCache.has(color)) {
      this.matCache.set(color, new THREE.MeshBasicMaterial({ color }));
    }
    return this.matCache.get(color);
  }

  spawn(owner, origin, dir) {
    const w = owner.cls.weapon;
    for (let i = 0; i < (w.pellets || 1); i++) {
      const d = dir.clone();
      if (w.spread > 0) {
        d.x += (Math.random() * 2 - 1) * w.spread;
        d.z += (Math.random() * 2 - 1) * w.spread;
        d.normalize();
      }
      const mesh = new THREE.Mesh(this._geo(w.size), this._mat(w.color));
      mesh.position.copy(origin);
      // Elongate rail shots
      if (w.pierce) {
        mesh.scale.set(1, 1, 6);
        mesh.lookAt(origin.clone().add(d));
      }
      this.scene.add(mesh);
      this.list.push({
        owner, mesh, w,
        pos: origin.clone(),
        vel: d.multiplyScalar(w.projectileSpeed),
        life: w.life,
        hitSet: new Set(),
        damage: Math.round(w.damage * owner.dmgMul),
      });
    }
    // muzzle flash
    this.particles.emit(origin.x, origin.y, origin.z, { count: 6, speed: 4, life: 0.15, size: 0.5, color: w.color, dir, spread: 0.6 });
  }

  update(dt, bots) {
    const prev = new THREE.Vector3();
    for (let i = this.list.length - 1; i >= 0; i--) {
      const p = this.list[i];
      p.life -= dt;
      prev.copy(p.pos);
      p.pos.addScaledVector(p.vel, dt);
      let dead = p.life <= 0;

      // Obstacle / wall hit
      const t = this.arena.segmentHit(prev.x, prev.z, p.pos.x, p.pos.z, p.pos.y);
      if (t >= 0) {
        p.pos.lerpVectors(prev, p.pos, t);
        this._impact(p, null);
        dead = true;
      }

      // Bot hits
      if (!dead) {
        for (const b of bots) {
          if (b === p.owner || !b.alive || p.hitSet.has(b)) continue;
          const c = b.center();
          const { d, t: st } = pointSegDist(c, prev, p.pos);
          if (d < b.radius * 1.15 + p.w.size) {
            p.hitSet.add(b);
            const hitPos = prev.clone().lerp(p.pos, st);
            const fromDir = p.vel.clone().normalize();
            const applied = b.takeDamage(p.damage, fromDir);
            if (applied > 0) { p.owner.shotsHit++; p.owner.damageDealt += applied; }
            if (this.onHit) this.onHit(p, b, applied, hitPos);
            if (applied === -1) this.audio.shieldHit(); else this.audio.hit();
            this.particles.emit(hitPos.x, hitPos.y, hitPos.z, {
              count: applied === -1 ? 8 : 14, speed: 7, life: 0.4, size: 0.5,
              color: applied === -1 ? 0xffffff : p.w.color, gravity: 6,
            });
            if (!p.w.pierce) { this._impact(p, b); dead = true; break; }
          }
        }
      }

      if (dead) {
        this.scene.remove(p.mesh);
        this.list.splice(i, 1);
      } else {
        p.mesh.position.copy(p.pos);
      }
    }
  }

  _impact(p, hitBot) {
    const { x, y, z } = p.pos;
    if (p.w.splash) {
      this.particles.emit(x, y, z, { count: 40, speed: 10, life: 0.6, size: 1.2, color: p.w.color, gravity: 4 });
      this.particles.emit(x, y, z, { count: 12, speed: 3, life: 0.9, size: 2.0, color: 0x555555 });
      this.audio.explosion();
      // Splash damage to any bot in radius (except the one directly hit)
      for (const b of this._bots || []) {
        if (b === hitBot || !b.alive || b === p.owner) continue;
        const dist = b.center().distanceTo(p.pos);
        if (dist < p.w.splash + b.radius) {
          const dir = b.center().sub(p.pos).normalize();
          const dmg = Math.round(p.w.splashDamage * p.owner.dmgMul);
          const applied = b.takeDamage(dmg, dir);
          if (applied > 0) p.owner.damageDealt += applied;
          if (this.onHit) this.onHit(p, b, applied, b.center());
        }
      }
    } else {
      this.particles.emit(x, y, z, { count: 6, speed: 4, life: 0.3, size: 0.4, color: p.w.color, gravity: 5 });
    }
  }

  setBots(bots) { this._bots = bots; }

  clear() {
    for (const p of this.list) this.scene.remove(p.mesh);
    this.list.length = 0;
  }
}
