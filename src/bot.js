import * as THREE from '../vendor/three.module.min.js';

const _tmp = new THREE.Vector3();

function buildBotMesh(cls) {
  const g = new THREE.Group();
  const base = new THREE.MeshStandardMaterial({ color: cls.color, roughness: 0.45, metalness: 0.25 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x262d40, roughness: 0.6, metalness: 0.2 });
  const glow = new THREE.MeshStandardMaterial({ color: cls.accent, emissive: cls.color, emissiveIntensity: 2.0 });

  const r = cls.radius, h = cls.height;

  // Hover ring / base
  const ring = new THREE.Mesh(new THREE.TorusGeometry(r * 0.9, 0.12, 8, 24), glow);
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.35;
  g.add(ring);

  // Torso
  const torso = new THREE.Mesh(new THREE.BoxGeometry(r * 1.5, h * 0.45, r * 1.1), base);
  torso.position.y = h * 0.55;
  torso.castShadow = true;
  g.add(torso);

  // Hips
  const hips = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.55, r * 0.7, h * 0.25, 10), dark);
  hips.position.y = h * 0.26;
  hips.castShadow = true;
  g.add(hips);

  // Head
  const head = new THREE.Mesh(new THREE.BoxGeometry(r * 0.8, h * 0.2, r * 0.8), dark);
  head.position.y = h * 0.88;
  head.castShadow = true;
  g.add(head);
  const visor = new THREE.Mesh(new THREE.BoxGeometry(r * 0.7, h * 0.07, 0.1), glow);
  visor.position.set(0, h * 0.89, r * 0.42);
  g.add(visor);

  // Shoulders + guns (front is +Z in local space)
  const shoulderGeo = new THREE.BoxGeometry(r * 0.55, r * 0.5, r * 0.6);
  const gunGeo = new THREE.CylinderGeometry(0.11, 0.14, r * 1.4, 8);
  const muzzles = [];
  for (const side of [-1, 1]) {
    const sh = new THREE.Mesh(shoulderGeo, dark);
    sh.position.set(side * r * 1.0, h * 0.7, 0);
    sh.castShadow = true;
    g.add(sh);
    const gun = new THREE.Mesh(gunGeo, dark);
    gun.rotation.x = Math.PI / 2;
    gun.position.set(side * r * 1.0, h * 0.62, r * 0.7);
    g.add(gun);
    const tip = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.15, 8), glow);
    tip.rotation.x = Math.PI / 2;
    tip.position.set(side * r * 1.0, h * 0.62, r * 1.4);
    g.add(tip);
    const muzzle = new THREE.Object3D();
    muzzle.position.set(side * r * 1.0, h * 0.62, r * 1.5);
    g.add(muzzle);
    muzzles.push(muzzle);
  }

  // Back fins
  const fin = new THREE.Mesh(new THREE.BoxGeometry(r * 0.3, h * 0.35, r * 0.6), base);
  fin.position.set(0, h * 0.75, -r * 0.6);
  g.add(fin);

  // Shield bubble (hidden by default)
  const shield = new THREE.Mesh(
    new THREE.SphereGeometry(r * 1.9, 24, 16),
    new THREE.MeshStandardMaterial({ color: cls.accent, emissive: cls.color, emissiveIntensity: 1.5, transparent: true, opacity: 0.28, side: THREE.DoubleSide })
  );
  shield.position.y = h * 0.55;
  shield.visible = false;
  g.add(shield);

  // Point light for glow
  const light = new THREE.PointLight(cls.color, 12, 10, 2);
  light.position.y = h * 0.6;
  g.add(light);

  return { group: g, muzzles, ring, shield, torso, light, materials: { base, dark, glow } };
}

export class Bot {
  constructor(cls, scene, arena, { isPlayer = false, hpMul = 1, dmgMul = 1 } = {}) {
    this.cls = cls;
    this.scene = scene;
    this.arena = arena;
    this.isPlayer = isPlayer;
    this.name = isPlayer ? 'YOU' : cls.name.toUpperCase() + ' AI';
    this.hpMul = hpMul;
    this.dmgMul = dmgMul;

    this.pos = new THREE.Vector3();
    this.vel = new THREE.Vector3();
    this.yaw = 0;           // facing direction (radians), 0 = +Z
    this.radius = cls.radius;
    this.height = cls.height;

    const built = buildBotMesh(cls);
    this.mesh = built.group;
    this.muzzles = built.muzzles;
    this.ring = built.ring;
    this.shieldMesh = built.shield;
    this.torso = built.torso;
    this.light = built.light;
    this.materials = built.materials;
    scene.add(this.mesh);

    this.muzzleIndex = 0;
    this.reset();
  }

  reset() {
    this.maxHp = Math.round(this.cls.maxHp * this.hpMul);
    this.hp = this.maxHp;
    this.maxEnergy = this.cls.maxEnergy;
    this.energy = this.maxEnergy * 0.6;
    this.alive = true;
    this.deathTimer = 0;
    this.fireCooldown = 0;
    this.abilityCooldown = 0;
    this.specialCooldown = 0;
    this.stunTimer = 0;
    this.invulnTimer = 0;
    this.shieldTimer = 0;
    this.overdriveTimer = 0;
    this.hitFlash = 0;
    this.knockback = new THREE.Vector3();
    this.vel.set(0, 0, 0);
    this.damageDealt = 0;
    this.shotsFired = 0;
    this.shotsHit = 0;
    this.mesh.visible = true;
    this.mesh.scale.set(1, 1, 1);
    this.mesh.rotation.set(0, 0, 0);
    this.shieldMesh.visible = false;
    this.materials.base.emissive.set(0x000000);
    this.materials.base.emissiveIntensity = 0;
  }

  spawnAt(v, yaw) {
    this.pos.copy(v);
    this.yaw = yaw;
    this.syncMesh();
  }

  get speedMul() { return this.overdriveTimer > 0 ? 1.5 : 1; }
  get fireRateMul() { return this.overdriveTimer > 0 ? 2 : 1; }
  get stunned() { return this.stunTimer > 0; }
  get shielded() { return this.shieldTimer > 0; }

  forward() { return new THREE.Vector3(Math.sin(this.yaw), 0, Math.cos(this.yaw)); }
  right() { return new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw)); }

  // move: desired direction in world space (unit or zero)
  update(dt, moveDir) {
    // timers
    this.fireCooldown = Math.max(0, this.fireCooldown - dt);
    this.abilityCooldown = Math.max(0, this.abilityCooldown - dt);
    this.specialCooldown = Math.max(0, this.specialCooldown - dt);
    this.stunTimer = Math.max(0, this.stunTimer - dt);
    this.invulnTimer = Math.max(0, this.invulnTimer - dt);
    this.shieldTimer = Math.max(0, this.shieldTimer - dt);
    this.overdriveTimer = Math.max(0, this.overdriveTimer - dt);
    this.hitFlash = Math.max(0, this.hitFlash - dt * 6);
    this.energy = Math.min(this.maxEnergy, this.energy + this.cls.energyRegen * dt);

    if (!this.alive) {
      this.deathTimer += dt;
      const s = Math.max(0, 1 - this.deathTimer * 1.6);
      this.mesh.scale.set(s, s, s);
      this.mesh.rotation.z += dt * 4;
      this.mesh.position.y = this.deathTimer * 2;
      return;
    }

    const maxSpeed = this.cls.speed * this.speedMul * (this.stunned ? 0 : 1);
    const accel = this.cls.accel;
    const target = _tmp.copy(moveDir).multiplyScalar(maxSpeed);
    // accelerate towards target velocity
    const dvx = target.x - this.vel.x, dvz = target.z - this.vel.z;
    const dl = Math.hypot(dvx, dvz);
    const step = accel * dt;
    if (dl <= step) { this.vel.x = target.x; this.vel.z = target.z; }
    else { this.vel.x += dvx / dl * step; this.vel.z += dvz / dl * step; }

    // knockback decays
    this.knockback.multiplyScalar(Math.max(0, 1 - dt * 4));
    this.pos.x += (this.vel.x + this.knockback.x) * dt;
    this.pos.z += (this.vel.z + this.knockback.z) * dt;
    this.arena.resolveCircle(this.pos, this.radius);
    this.syncMesh(dt);
  }

  syncMesh(dt = 0) {
    this.mesh.position.set(this.pos.x, 0, this.pos.z);
    this.mesh.rotation.y = this.yaw;
    // subtle hover bob + bank on strafing
    const t = performance.now() * 0.001;
    this.mesh.position.y = Math.sin(t * 3 + this.pos.x) * 0.08 + (this.alive ? 0 : this.mesh.position.y);
    const r = this.right();
    const lateral = (this.vel.x * r.x + this.vel.z * r.z) / (this.cls.speed || 1);
    const fwd = this.forward();
    const longitudinal = (this.vel.x * fwd.x + this.vel.z * fwd.z) / (this.cls.speed || 1);
    this.mesh.rotation.z = -lateral * 0.18;
    this.mesh.rotation.x = longitudinal * 0.12;
    this.ring.rotation.z += dt * 2.5;
    this.shieldMesh.visible = this.shielded;
    if (this.shielded) {
      const p = 1 + Math.sin(t * 20) * 0.03;
      this.shieldMesh.scale.set(p, p, p);
    }
    // status glow
    if (this.stunned) {
      this.materials.base.emissive.set(0xffffff);
      this.materials.base.emissiveIntensity = 0.3 + Math.abs(Math.sin(t * 25)) * 0.6;
    } else if (this.overdriveTimer > 0) {
      this.materials.base.emissive.set(this.cls.color);
      this.materials.base.emissiveIntensity = 0.5 + Math.abs(Math.sin(t * 12)) * 0.5;
    } else if (this.hitFlash > 0) {
      this.materials.base.emissive.set(0xff3030);
      this.materials.base.emissiveIntensity = this.hitFlash * 1.5;
    } else {
      this.materials.base.emissiveIntensity = 0;
    }
    this.light.intensity = 8 + this.hitFlash * 20 + (this.overdriveTimer > 0 ? 10 : 0);
  }

  canFire() { return this.alive && !this.stunned && this.fireCooldown <= 0; }

  // Returns {origin, dir} for the next shot and applies cooldown.
  fire() {
    const w = this.cls.weapon;
    this.fireCooldown = w.cooldown / this.fireRateMul;
    const m = this.muzzles[this.muzzleIndex % this.muzzles.length];
    this.muzzleIndex++;
    const origin = new THREE.Vector3();
    m.getWorldPosition(origin);
    origin.y = this.height * 0.62;
    const dir = this.forward();
    this.shotsFired++;
    return { origin, dir };
  }

  canAbility() { return this.alive && !this.stunned && this.abilityCooldown <= 0 && this.energy >= this.cls.ability.cost; }
  canSpecial() { return this.alive && !this.stunned && this.specialCooldown <= 0 && this.energy >= this.cls.special.cost; }

  spendAbility() { this.energy -= this.cls.ability.cost; this.abilityCooldown = this.cls.ability.cooldown; }
  spendSpecial() { this.energy -= this.cls.special.cost; this.specialCooldown = this.cls.special.cooldown; }

  // Returns actual damage applied (0 if blocked).
  takeDamage(amount, fromDir) {
    if (!this.alive) return 0;
    if (this.invulnTimer > 0) return 0;
    if (this.shielded) return -1; // blocked
    const d = Math.min(this.hp, amount);
    this.hp -= d;
    this.hitFlash = 1;
    if (fromDir) {
      this.knockback.x += fromDir.x * amount * 0.12;
      this.knockback.z += fromDir.z * amount * 0.12;
    }
    if (this.hp <= 0) { this.hp = 0; this.alive = false; this.deathTimer = 0; }
    return d;
  }

  heal(n) { this.hp = Math.min(this.maxHp, this.hp + n); }
  addEnergy(n) { this.energy = Math.min(this.maxEnergy, this.energy + n); }

  center() { return new THREE.Vector3(this.pos.x, this.height * 0.55, this.pos.z); }
}
