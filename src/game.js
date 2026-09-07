import * as THREE from '../vendor/three.module.min.js';
import { ARENA, ROUND, PICKUPS, CAMERA, BOT_CLASSES } from './config.js';
import { Arena } from './arena.js';
import { Particles } from './particles.js';
import { Projectiles } from './projectiles.js';
import { Bot } from './bot.js';
import { AIController } from './ai.js';
import { HUD } from './hud.js';
import { audio } from './audio.js';

export class Game {
  constructor(canvas, input, callbacks) {
    this.canvas = canvas;
    this.input = input;
    this.cb = callbacks; // { onRoundEnd(result), onMatchEnd(result), onPause() }

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x070a12);
    this.scene.fog = new THREE.Fog(0x070a12, 60, 140);

    this.camera = new THREE.PerspectiveCamera(CAMERA.fov, 1, 0.1, 300);
    this.camPos = new THREE.Vector3(0, 20, -30);
    this.camLook = new THREE.Vector3();
    this.shake = 0;

    this._lights();
    this.arena = new Arena(this.scene);
    this.particles = new Particles(this.scene);
    this.projectiles = new Projectiles(this.scene, this.arena, this.particles, audio);
    this.projectiles.onHit = (p, target, applied, pos) => this._onProjectileHit(p, target, applied, pos);
    this.hud = new HUD();
    this._buildPickups();

    this.player = null;
    this.enemy = null;
    this.ai = null;
    this.bots = [];
    this.state = 'idle';
    this.running = false;
    this.lastTime = 0;
    this.roundTime = ROUND.duration;
    this.stateTimer = 0;
    this.score = { p: 0, e: 0 };
    this.round = 0;
    this.difficulty = null;
    this.menuOrbit = 0;
    this.stats = null;
    this.enemyVisible = false;
    this.enemyLastSeen = 0;
    this.paused = false;

    this._resize();
    window.addEventListener('resize', () => this._resize());
    this._loop = (t) => this._frame(t);
    requestAnimationFrame(this._loop);
  }

  _lights() {
    const hemi = new THREE.HemisphereLight(0x8fb7ff, 0x1a1020, 1.2);
    this.scene.add(hemi);
    const sun = new THREE.DirectionalLight(0xffffff, 2.2);
    sun.position.set(30, 50, 20);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    const s = ARENA.size / 2 + 4;
    sun.shadow.camera.left = -s; sun.shadow.camera.right = s;
    sun.shadow.camera.top = s; sun.shadow.camera.bottom = -s;
    sun.shadow.camera.near = 10; sun.shadow.camera.far = 140;
    sun.shadow.bias = -0.0002;
    sun.shadow.normalBias = 0.06;
    this.scene.add(sun);
    const rim = new THREE.DirectionalLight(0x4060ff, 0.8);
    rim.position.set(-30, 20, -40);
    this.scene.add(rim);
  }

  _buildPickups() {
    this.pickups = [];
    const healthMat = new THREE.MeshStandardMaterial({ color: 0x2aff66, emissive: 0x1fbb44, emissiveIntensity: 1.5 });
    const energyMat = new THREE.MeshStandardMaterial({ color: 0xffd84f, emissive: 0xffa500, emissiveIntensity: 1.5 });
    for (const p of this.arena.pickupPoints) {
      const isH = p.type === 'health';
      const mesh = new THREE.Mesh(
        isH ? new THREE.OctahedronGeometry(0.7) : new THREE.IcosahedronGeometry(0.6),
        isH ? healthMat : energyMat
      );
      mesh.position.set(p.pos.x, 1.2, p.pos.z);
      mesh.castShadow = true;
      const base = new THREE.Mesh(new THREE.RingGeometry(0.9, 1.3, 24), new THREE.MeshBasicMaterial({ color: isH ? 0x2aff66 : 0xffd84f, transparent: true, opacity: 0.5, side: THREE.DoubleSide }));
      base.rotation.x = -Math.PI / 2;
      base.position.set(p.pos.x, 0.03, p.pos.z);
      this.scene.add(mesh, base);
      this.pickups.push({ type: p.type, pos: p.pos.clone(), mesh, base, active: true, timer: 0 });
    }
  }

  nearestPickup(pos, type) {
    let best = null;
    for (const p of this.pickups) {
      if (!p.active || p.type !== type) continue;
      const d = p.pos.distanceTo(pos);
      if (!best || d < best.dist) best = { pos: p.pos, dist: d };
    }
    return best;
  }

  _resize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.particles.resize(h);
  }

  // ---------- Match lifecycle ----------

  startMatch(playerClassId, enemyClassId, difficulty) {
    this.difficulty = difficulty;
    for (const b of this.bots) this.scene.remove(b.mesh);
    this.projectiles.clear();
    this.particles.clear();

    this.player = new Bot(BOT_CLASSES[playerClassId], this.scene, this.arena, { isPlayer: true });
    this.enemy = new Bot(BOT_CLASSES[enemyClassId], this.scene, this.arena, { hpMul: difficulty.hpMul, dmgMul: difficulty.dmgMul });
    this.bots = [this.player, this.enemy];
    this.projectiles.setBots(this.bots);
    this.ai = new AIController(this.enemy, this.player, this.arena, difficulty, this);
    this.hud.setNames(this.player.name, this.enemy.name);
    this.score = { p: 0, e: 0 };
    this.round = 0;
    this.stats = { damageDealt: 0, damageTaken: 0, shotsFired: 0, shotsHit: 0, abilities: 0, timeStarted: performance.now() };
    this.hud.setScore(0, 0);
    this.hud.show(true);
    this.running = true;
    this.paused = false;
    this.startRound();
  }

  startRound() {
    this.round++;
    this.projectiles.clear();
    for (const p of this.pickups) this._setPickup(p, true);
    const flip = this.round % 2 === 0;
    const sp = this.arena.spawns;
    const a = flip ? sp[1] : sp[0], b = flip ? sp[0] : sp[1];
    this.player.reset();
    this.enemy.reset();
    this.player.spawnAt(a, Math.atan2(b.x - a.x, b.z - a.z));
    this.enemy.spawnAt(b, Math.atan2(a.x - b.x, a.z - b.z));
    this.ai.reset();
    this.roundTime = ROUND.duration;
    this.state = 'intro';
    this.stateTimer = ROUND.introTime;
    this.countdownShown = -1;
    this.hud.feed(`ROUND ${this.round}`, 'gold');
    // snap camera
    this._updateCamera(1, true);
  }

  _setPickup(p, active) {
    p.active = active;
    p.mesh.visible = active;
    p.base.material.opacity = active ? 0.5 : 0.12;
    p.timer = active ? 0 : PICKUPS.respawn;
  }

  pause() {
    if (!this.running || this.state === 'matchEnd') return;
    this.paused = true;
    this.input.unlock();
    if (this.cb.onPause) this.cb.onPause();
  }

  resume() {
    this.paused = false;
    this.lastTime = 0;
    this.input.lock();
  }

  quitMatch() {
    this.running = false;
    this.paused = false;
    this.state = 'idle';
    this.hud.show(false);
    this.input.unlock();
    this.projectiles.clear();
    for (const b of this.bots) this.scene.remove(b.mesh);
    this.bots = [];
    this.player = null; this.enemy = null;
  }

  // ---------- Frame ----------

  _frame(t) {
    requestAnimationFrame(this._loop);
    if (!this.lastTime) this.lastTime = t;
    let dt = Math.min(0.05, (t - this.lastTime) / 1000);
    this.lastTime = t;

    if (!this.running) {
      this._menuCamera(dt);
      this._animatePickups(dt);
      this.particles.update(dt);
      this.renderer.render(this.scene, this.camera);
      this.input.endFrame();
      return;
    }
    if (this.paused) {
      this.renderer.render(this.scene, this.camera);
      this.input.endFrame();
      return;
    }

    this._tick(dt);
    this.renderer.render(this.scene, this.camera);
    this.input.endFrame();
  }

  _menuCamera(dt) {
    this.menuOrbit += dt * 0.12;
    const r = 42;
    this.camera.position.set(Math.cos(this.menuOrbit) * r, 22, Math.sin(this.menuOrbit) * r);
    this.camera.lookAt(0, 1, 0);
  }

  _animatePickups(dt) {
    const t = performance.now() * 0.001;
    for (const p of this.pickups) {
      if (p.active) {
        p.mesh.rotation.y += dt * 1.5;
        p.mesh.position.y = 1.2 + Math.sin(t * 2 + p.pos.x) * 0.2;
      } else {
        p.timer -= dt;
        if (p.timer <= 0 && this.running) this._setPickup(p, true);
      }
    }
  }

  _tick(dt) {
    const inp = this.input;

    // Escape handled by input.onEscape (pointer lock exit) -> main pauses

    if (this.state === 'intro') {
      this.stateTimer -= dt;
      const n = Math.ceil(this.stateTimer);
      if (n !== this.countdownShown && n > 0) {
        this.countdownShown = n;
        this.hud.centerMessage(String(n), 900, 'count');
        audio.countdown(false);
      }
      if (this.stateTimer <= 0) {
        this.state = 'play';
        this.hud.centerMessage('FIGHT!', 900, 'fight');
        audio.countdown(true);
      }
      // allow looking around during countdown
      this._playerLook();
      this.player.update(dt, new THREE.Vector3());
      this.enemy.update(dt, new THREE.Vector3());
    } else if (this.state === 'play') {
      this.roundTime -= dt;
      this._playerControl(dt);
      this._enemyControl(dt);
      this.projectiles.update(dt, this.bots);
      this._pickupCollisions();
      this._checkRoundEnd();
    } else if (this.state === 'roundEnd' || this.state === 'matchEnd') {
      this.stateTimer -= dt;
      this.player.update(dt, new THREE.Vector3());
      this.enemy.update(dt, new THREE.Vector3());
      this.projectiles.update(dt, this.bots);
      if (this.stateTimer <= 0) {
        if (this.state === 'roundEnd') {
          this.startRound();
        } else {
          this.running = false;
          this.hud.show(false);
          this.input.unlock();
          if (this.cb.onMatchEnd) this.cb.onMatchEnd(this._matchResult());
          this.state = 'idle';
        }
      }
    }

    this._animatePickups(dt);
    this.particles.update(dt);
    this._updateCamera(dt);
    this.enemyVisible = this.enemy.alive && this.arena.hasLineOfSight(this.player.pos, this.enemy.pos);
    this.hud.update(dt, this.player, this.enemy, this.roundTime, {
      obstacles: this.arena.obstacles, pickups: this.pickups, enemyVisible: this.enemyVisible,
    });
  }

  _playerLook() {
    const { dx } = this.input.consumeMouse();
    if (this.player.alive && !this.player.stunned) this.player.yaw -= dx;
  }

  _playerControl(dt) {
    const p = this.player, inp = this.input;
    this._playerLook();
    const ax = inp.axes();
    const fwd = p.forward(), right = p.right();
    const move = new THREE.Vector3().addScaledVector(fwd, ax.y).addScaledVector(right, ax.x);
    if (move.lengthSq() > 1) move.normalize();
    p.update(dt, move);

    if (inp.fire && p.canFire()) this._fire(p);

    if ((inp.justPressed('Space') || inp.justPressed('ShiftLeft') || inp.justPressed('MouseRight')) && p.canAbility()) {
      this._useAbility(p, move);
    }
    if ((inp.justPressed('KeyE') || inp.justPressed('KeyQ') || inp.justPressed('MouseMiddle')) && p.canSpecial()) {
      this._useSpecial(p);
    }
  }

  _enemyControl(dt) {
    const e = this.enemy;
    const o = this.ai.think(dt);
    if (e.alive && !e.stunned) e.yaw = o.yaw;
    e.update(dt, o.move);
    if (o.fire && e.canFire()) this._fire(e);
    if (o.ability && e.canAbility()) this._useAbility(e, o.move);
    if (o.special && e.canSpecial()) this._useSpecial(e);
  }

  _fire(bot) {
    const { origin, dir } = bot.fire();
    this.projectiles.spawn(bot, origin, dir);
    const w = bot.cls.weapon;
    audio.shoot(w.splash ? 'cannon' : (w.pierce ? 'rail' : 'blaster'));
    if (bot.isPlayer) { this.stats.shotsFired++; this.shake += w.splash ? 0.25 : (w.pierce ? 0.2 : 0.05); }
  }

  _useAbility(bot, moveDir) {
    const ab = bot.cls.ability;
    bot.spendAbility();
    if (bot.isPlayer) this.stats.abilities++;
    audio.ability(ab.id);
    const dir = moveDir && moveDir.lengthSq() > 0.01 ? moveDir.clone().normalize() : bot.forward();
    if (ab.id === 'dash') {
      bot.vel.copy(dir).multiplyScalar(bot.cls.speed * 3.2);
      bot.invulnTimer = 0.25;
      this.particles.emit(bot.pos.x, 1, bot.pos.z, { count: 30, speed: 8, life: 0.4, size: 0.8, color: bot.cls.color, dir: dir.clone().negate(), spread: 0.5 });
      this.hud.feed(`${bot.name} used DASH`, bot.isPlayer ? 'cyan' : 'red');
    } else if (ab.id === 'shield') {
      bot.shieldTimer = ab.duration;
      this.hud.feed(`${bot.name} raised BARRIER`, bot.isPlayer ? 'cyan' : 'red');
    } else if (ab.id === 'blink') {
      const from = bot.pos.clone();
      // step in increments to stop before obstacles
      const step = 0.5;
      const target = bot.pos.clone();
      for (let d = step; d <= ab.distance; d += step) {
        const cand = from.clone().addScaledVector(dir, d);
        const test = cand.clone();
        this.arena.resolveCircle(test, bot.radius);
        if (test.distanceTo(cand) > 0.05) break;
        target.copy(cand);
      }
      this.particles.emit(from.x, 1.2, from.z, { count: 25, speed: 5, life: 0.5, size: 0.9, color: bot.cls.color });
      bot.pos.copy(target);
      bot.invulnTimer = 0.15;
      this.particles.emit(target.x, 1.2, target.z, { count: 25, speed: 5, life: 0.5, size: 0.9, color: bot.cls.color });
      this.hud.feed(`${bot.name} used BLINK`, bot.isPlayer ? 'cyan' : 'red');
    }
  }

  _useSpecial(bot) {
    const sp = bot.cls.special;
    bot.spendSpecial();
    if (bot.isPlayer) this.stats.abilities++;
    audio.ability(sp.id);
    const other = bot === this.player ? this.enemy : this.player;
    if (sp.id === 'overdrive') {
      bot.overdriveTimer = sp.duration;
      this.hud.feed(`${bot.name} activated OVERDRIVE`, bot.isPlayer ? 'cyan' : 'red');
    } else if (sp.id === 'slam') {
      this.shake += 0.8;
      const c = bot.pos;
      this.particles.emit(c.x, 0.5, c.z, { count: 120, speed: 14, life: 0.7, size: 1.0, color: bot.cls.color, gravity: 6 });
      this.particles.emit(c.x, 0.3, c.z, { count: 40, speed: 6, life: 1.0, size: 2.5, color: 0x666666 });
      // shockwave ring
      const ring = new THREE.Mesh(new THREE.RingGeometry(0.5, 1.0, 40), new THREE.MeshBasicMaterial({ color: bot.cls.color, transparent: true, opacity: 0.9, side: THREE.DoubleSide }));
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(c.x, 0.1, c.z);
      this.scene.add(ring);
      this._transient(ring, 0.5, (m, f) => { m.scale.setScalar(1 + f * sp.radius); m.material.opacity = 1 - f; });
      const d = other.pos.distanceTo(c);
      if (other.alive && d < sp.radius + other.radius) {
        const dir = other.pos.clone().sub(c).normalize();
        const applied = other.takeDamage(Math.round(sp.damage * bot.dmgMul), dir);
        other.knockback.addScaledVector(dir, 22);
        this._onDamage(bot, other, applied, other.center());
      }
      this.hud.feed(`${bot.name} used GROUND SLAM`, bot.isPlayer ? 'cyan' : 'red');
    } else if (sp.id === 'emp') {
      const c = bot.center();
      const ring = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16), new THREE.MeshBasicMaterial({ color: bot.cls.color, transparent: true, opacity: 0.5, wireframe: true }));
      ring.position.copy(c);
      this.scene.add(ring);
      this._transient(ring, 0.6, (m, f) => { m.scale.setScalar(1 + f * sp.radius); m.material.opacity = 0.6 * (1 - f); });
      const d = other.pos.distanceTo(bot.pos);
      if (other.alive && d < sp.radius) {
        if (other.shielded) {
          this.hud.feed(`${other.name}'s barrier absorbed the EMP`, 'gold');
        } else {
          other.stunTimer = sp.stun;
          other.energy = Math.max(0, other.energy - 40);
          other.vel.set(0, 0, 0);
          this.particles.emit(other.pos.x, 1.5, other.pos.z, { count: 40, speed: 5, life: 0.8, size: 0.7, color: 0xffffff });
          this.hud.feed(`${bot.name} STUNNED ${other.name}`, bot.isPlayer ? 'cyan' : 'red');
        }
      } else {
        this.hud.feed(`${bot.name} used EMP (out of range)`, bot.isPlayer ? 'cyan' : 'red');
      }
    }
  }

  // Simple one-shot animated mesh helper.
  _transient(mesh, duration, fn) {
    const start = performance.now();
    const step = () => {
      const f = Math.min(1, (performance.now() - start) / (duration * 1000));
      fn(mesh, f);
      if (f < 1) requestAnimationFrame(step);
      else { this.scene.remove(mesh); mesh.geometry.dispose(); mesh.material.dispose(); }
    };
    step();
  }

  _onProjectileHit(p, target, applied, pos) {
    this._onDamage(p.owner, target, applied, pos);
  }

  _onDamage(attacker, target, applied, pos) {
    if (attacker.isPlayer) {
      if (applied > 0) { this.stats.damageDealt += applied; this.hud.hitmarker(); }
      else if (applied === -1) this.hud.feed('Blocked by barrier', 'gold');
    }
    if (target.isPlayer && applied > 0) {
      this.stats.damageTaken += applied;
      this.hud.damageFlash(Math.min(1, applied / 40));
      this.shake += Math.min(0.5, applied / 60);
    }
    if (!target.alive && applied > 0) {
      this.particles.emit(pos.x, 1, pos.z, { count: 160, speed: 16, life: 1.2, size: 1.2, color: target.cls.color, gravity: 8 });
      this.particles.emit(pos.x, 1, pos.z, { count: 50, speed: 4, life: 1.6, size: 3, color: 0x444444 });
      audio.explosion();
      this.shake += 1.0;
    }
  }

  _pickupCollisions() {
    for (const p of this.pickups) {
      if (!p.active) continue;
      for (const b of this.bots) {
        if (!b.alive) continue;
        if (b.pos.distanceTo(p.pos) < b.radius + 1.0) {
          if (p.type === 'health') {
            if (b.hp >= b.maxHp) continue;
            b.heal(PICKUPS.healthAmount);
          } else {
            if (b.energy >= b.maxEnergy - 1) continue;
            b.addEnergy(PICKUPS.energyAmount);
          }
          this._setPickup(p, false);
          this.particles.emit(p.pos.x, 1.2, p.pos.z, { count: 25, speed: 5, life: 0.5, size: 0.7, color: p.type === 'health' ? 0x2aff66 : 0xffd84f });
          audio.pickup();
          this.hud.feed(`${b.name} grabbed ${p.type === 'health' ? 'REPAIR KIT' : 'ENERGY CELL'}`, b.isPlayer ? 'cyan' : 'red');
          break;
        }
      }
    }
  }

  _checkRoundEnd() {
    let winner = null;
    if (!this.player.alive && !this.enemy.alive) winner = 'draw';
    else if (!this.enemy.alive) winner = 'p';
    else if (!this.player.alive) winner = 'e';
    else if (this.roundTime <= 0) {
      const pf = this.player.hp / this.player.maxHp, ef = this.enemy.hp / this.enemy.maxHp;
      winner = pf > ef ? 'p' : (ef > pf ? 'e' : 'draw');
    }
    if (!winner) return;
    if (winner === 'p') this.score.p++;
    else if (winner === 'e') this.score.e++;
    this.hud.setScore(this.score.p, this.score.e);
    const msg = winner === 'p' ? 'ROUND WON' : (winner === 'e' ? 'ROUND LOST' : 'DRAW');
    const matchOver = this.score.p >= ROUND.toWin || this.score.e >= ROUND.toWin;
    if (matchOver) {
      this.state = 'matchEnd';
      this.stateTimer = ROUND.outroTime;
      const won = this.score.p > this.score.e;
      this.hud.centerMessage(won ? 'VICTORY' : 'DEFEAT', 2500, won ? 'win' : 'lose');
      if (won) audio.win(); else audio.lose();
    } else {
      this.state = 'roundEnd';
      this.stateTimer = ROUND.outroTime;
      this.hud.centerMessage(msg, 2200, winner === 'p' ? 'win' : (winner === 'e' ? 'lose' : ''));
      if (winner === 'p') audio.win(); else if (winner === 'e') audio.lose();
    }
    if (this.cb.onRoundEnd) this.cb.onRoundEnd({ winner, score: { ...this.score } });
  }

  _matchResult() {
    const s = this.stats;
    return {
      won: this.score.p > this.score.e,
      score: { ...this.score },
      rounds: this.round,
      damageDealt: Math.round(s.damageDealt),
      damageTaken: Math.round(s.damageTaken),
      accuracy: s.shotsFired ? Math.round((this.player.shotsHit / s.shotsFired) * 100) : 0,
      abilities: s.abilities,
      duration: Math.round((performance.now() - s.timeStarted) / 1000),
      playerClass: this.player.cls.name,
      enemyClass: this.enemy.cls.name,
      difficulty: this.difficulty.name,
    };
  }

  _updateCamera(dt, snap = false) {
    const p = this.player;
    if (!p) return;
    const back = p.forward().multiplyScalar(-CAMERA.distance);
    const desired = new THREE.Vector3(p.pos.x + back.x, CAMERA.height, p.pos.z + back.z);
    // keep camera out of obstacles: pull in if line from bot to camera is blocked
    const t = this.arena.segmentHit(p.pos.x, p.pos.z, desired.x, desired.z, CAMERA.height * 0.5);
    if (t >= 0 && t > 0.1) {
      desired.x = p.pos.x + (desired.x - p.pos.x) * (t - 0.05);
      desired.z = p.pos.z + (desired.z - p.pos.z) * (t - 0.05);
    }
    const look = new THREE.Vector3(p.pos.x, 1.6, p.pos.z).addScaledVector(p.forward(), CAMERA.lookAhead);
    if (snap) { this.camPos.copy(desired); this.camLook.copy(look); }
    else {
      const k = 1 - Math.pow(0.001, dt);
      this.camPos.lerp(desired, k);
      this.camLook.lerp(look, k * 1.3 > 1 ? 1 : k * 1.3);
    }
    this.shake = Math.max(0, this.shake - dt * 3);
    const s = this.shake * 0.35;
    this.camera.position.set(
      this.camPos.x + (Math.random() - 0.5) * s,
      this.camPos.y + (Math.random() - 0.5) * s,
      this.camPos.z + (Math.random() - 0.5) * s
    );
    this.camera.lookAt(this.camLook);
  }
}
