// Canvas 2D renderer: chunky high-contrast art with thick outlines, parallax
// theme backgrounds, particles, damage numbers and aim guides.

import { THEMES } from '../core/maps.js';
import { PHYS, POWERUPS, TEAM_COLORS } from '../core/defs.js';
import { drawBot, ANIM_LENGTH } from './bots.js';
import { paintBackdrop, paintTerrain, paintFloor, paintMine, paintCrusher } from './themes.js';
import { drawPowerupIcon, drawActionIcon } from './icons.js';
import { loadSprites } from './sprites.js';
import { loadBackgrounds, getBackground, drawBackground } from './backgrounds.js';
import { loadTerrain, getTerrainKit, paintPaintedTerrain } from './terrain.js';

function rgbaHex(h, a) { const n = parseInt(h.slice(1), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`; }
const EFFECT_ICONS = { poison: '☠', burn: '🔥', frozen: '❄', rooted: '⚓', shocked: '⚡', smoked: '☁', amp: '▲', plating: '◆', thrusters: '⇈', reflector: '◐', rally: '★' };
const EFFECT_COLORS = { poison: '#9dff2f', burn: '#ff8a2f', frozen: '#b5f4ff', rooted: '#3ddc97', shocked: '#ffe23a', smoked: '#c8c8d8', amp: '#ff7a2f', plating: '#c0c8d8', thrusters: '#ffd84f', reflector: '#e8f0ff', rally: '#ff9cf0' };

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.world = null;
    this.theme = THEMES.neo;
    this.cam = { x: 0, y: 0, zoom: 30 };     // zoom = pixels per unit
    this.camTarget = { x: 0, y: 0, zoom: 30 };
    this.userZoom = 1; this.userPan = { x: 0, y: 0 };
    this.particles = [];
    this.numbers = [];
    this.flashes = [];
    this.shake = 0;
    loadSprites();
    loadBackgrounds();
    loadTerrain();
    this.callouts = [];
    this.time = 0;
    this.eventCursor = 0;
    this.deadFx = new Set();
    this.anims = new Map();   // bot id -> { anim, start }
    this.onEvent = null;   // hook for audio
    this.dpr = 1;
    this.resize();
  }

  resize() {
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.w = window.innerWidth; this.h = window.innerHeight;
    this.canvas.width = Math.floor(this.w * this.dpr); this.canvas.height = Math.floor(this.h * this.dpr);
    this.canvas.style.width = this.w + 'px'; this.canvas.style.height = this.h + 'px';
  }

  setWorld(world) {
    this.world = world;
    this.theme = THEMES[world.map.theme];
    this.particles = []; this.numbers = []; this.flashes = []; this.eventCursor = 0; this.deadFx.clear(); this.anims.clear();
    this.userZoom = 1; this.userPan = { x: 0, y: 0 };
    this.fitMap(true);
  }

  // ----- camera -----
  // Height of the playable area: sky down to just below the kill floor.
  playHeight() { const w = this.world; return Math.min(w.map.height, w.lavaY + 1.2); }

  // Vertical camera centre that keeps the kill floor near the bottom of the viewport when there is spare height.
  centreY(zoom) {
    const visible = (this.h - 140) / zoom;
    const ph = this.playHeight();
    return Math.min(ph / 2, ph + 0.6 - visible / 2) + 0.4;
  }

  fitMap(snap = false) {
    const m = this.world.map;
    const pad = 1.5;
    const zoom = Math.min(this.w / (m.width + pad * 2), (this.h - 140) / (this.playHeight() + pad));
    this.camTarget = { x: m.width / 2, y: this.centreY(zoom), zoom };
    if (snap) this.cam = { ...this.camTarget };
  }

  isPortrait() { return this.h > this.w * 1.1; }

  // Plan-phase camera: whole map on wide screens, a window around (x, y) on portrait phones.
  fitForPlan(x, y) {
    if (!this.isPortrait()) return this.fitMap();
    const m = this.world.map;
    const zoom = Math.max(this.w / 22, Math.min(this.w / (m.width + 3), (this.h - 140) / (this.playHeight() + 1.5)));
    const visW = this.w / zoom;
    const cx = Math.max(visW / 2 - 1, Math.min(m.width - visW / 2 + 1, x));
    this.camTarget = { x: cx, y: Math.min(this.centreY(zoom), y + 2), zoom };
  }

  frameAction(points) {
    if (!points.length) return this.fitMap();
    const m = this.world.map;
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const [x, y] of points) { minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y); }
    minX -= 4; maxX += 4; minY -= 4; maxY += 3;
    const zoomFit = Math.min(this.w / (m.width + 3), (this.h - 140) / (this.playHeight() + 1.5));
    const maxZoom = this.isPortrait() ? this.w / 18 : zoomFit * 2.2;
    const zoom = Math.max(zoomFit, Math.min(maxZoom, this.w / (maxX - minX), (this.h - 140) / (maxY - minY)));
    const visW = this.w / zoom;
    const cx = Math.max(Math.min(visW / 2 - 1, m.width / 2), Math.min(m.width - visW / 2 + 1, (minX + maxX) / 2));
    this.camTarget = { x: cx, y: Math.min(this.centreY(zoom), Math.max(m.height * 0.3, (minY + maxY) / 2)), zoom };
  }

  focusOn(x, y, zoomMul = 1.6) {
    const m = this.world.map;
    const zoomFit = Math.min(this.w / (m.width + 3), (this.h - 140) / (m.height + 1.5));
    this.camTarget = { x, y, zoom: zoomFit * zoomMul };
  }

  toScreen(x, y) {
    const z = this.cam.zoom * this.userZoom;
    return [this.w / 2 + (x - this.cam.x - this.userPan.x) * z, this.h / 2 - 40 + (y - this.cam.y - this.userPan.y) * z];
  }
  toWorld(sx, sy) {
    const z = this.cam.zoom * this.userZoom;
    return [(sx - this.w / 2) / z + this.cam.x + this.userPan.x, (sy - this.h / 2 + 40) / z + this.cam.y + this.userPan.y];
  }

  // ----- events -> effects -----
  consumeEvents() {
    const w = this.world;
    const evs = w.events;
    while (this.eventCursor < evs.length) {
      const e = evs[this.eventCursor++];
      if (e.t > w.time + 0.001) { this.eventCursor--; break; } // not yet reached in playback
      this.handleEvent(e);
    }
  }

  playAnim(botId, anim) {
    if (botId === undefined || botId === null) return;
    const cur = this.anims.get(botId);
    if (cur && cur.anim === 'death') return;
    this.anims.set(botId, { anim, start: this.time });
  }

  animState(b) {
    const a = this.anims.get(b.id);
    if (!a) return { anim: 'idle', t: 0 };
    const t = (this.time - a.start) / (ANIM_LENGTH[a.anim] || 0.5);
    if (t >= 1 && a.anim !== 'death') { this.anims.delete(b.id); return { anim: 'idle', t: 0 }; }
    return { anim: a.anim, t: Math.min(1, t) };
  }

  handleEvent(e) {
    const T = this.theme;
    switch (e.type) {
      case 'jump': this.playAnim(e.bot, 'jump'); break;
      case 'fire': this.playAnim(e.bot, 'fire'); break;
      case 'special': { const b = this.world.bots[e.bot]; this.playAnim(e.bot, b && b.def.s1.name === e.name ? 's1' : 's2'); break; }
      case 'damage': if (e.amount > 0) this.playAnim(e.bot, 'hit'); break;
      case 'eliminated': this.playAnim(e.bot, 'death'); break;
      case 'blink': break;
    }
    switch (e.type) {
      case 'explosion': {
        const n = e.big ? 42 : 22;
        this.emit(e.x, e.y, n, { speed: 5 + e.radius * 3, life: 0.6, size: 0.18 + e.radius * 0.1, color: e.color, gravity: 10 });
        this.emit(e.x, e.y, 10, { speed: 1.8, life: 1.1, size: 0.55, color: 'rgba(70,70,75,0.7)', gravity: -3 });
        // cartoon burst: white spike star for one beat, then a bold expanding ring
        this.flashes.push({ star: true, x: e.x, y: e.y, r: Math.max(1, e.radius * 1.15), t: 0, life: 0.14, color: '#ffffff', seed: (e.x * 7 + e.y * 13) % 100 });
        this.flashes.push({ ring2: true, x: e.x, y: e.y, r: Math.max(1, e.radius * 1.25), t: 0, life: 0.42, color: e.color });
        this.flashes.push({ x: e.x, y: e.y, r: e.radius * 0.8, t: 0, life: 0.3, color: e.color });
        this.shake += e.big ? 1.1 : 0.5;
        break;
      }
      case 'damage':
        if (e.amount > 0) this.numbers.push({ x: e.x, y: e.y - 0.8, text: `-${e.amount}`, color: e.crit ? '#ff4d4d' : '#ffffff', t: 0, life: 1.1, big: e.crit });
        else this.numbers.push({ x: e.x, y: e.y - 0.8, text: e.label || 'blocked', color: '#a0a8b8', t: 0, life: 0.9 });
        break;
      case 'eliminated':
        this.emit(e.x, e.y, 60, { speed: 9, life: 1.2, size: 0.25, color: this.world.bots[e.bot].color, gravity: 14 });
        this.numbers.push({ x: e.x, y: e.y - 1.4, text: this.world.bots[e.bot].name + ' KO', color: '#ff4d4d', t: 0, life: 1.6, big: true });
        this.shake += 1;
        break;
      case 'pickup': this.numbers.push({ x: e.x, y: e.y - 1, text: e.name, color: POWERUPS[e.id].color, t: 0, life: 1.3 }); this.emit(e.x, e.y, 16, { speed: 3, life: 0.6, size: 0.15, color: POWERUPS[e.id].color, gravity: -4 }); break;
      case 'jump': this.emit(e.x, e.y + 0.4, 8, { speed: 2, life: 0.4, size: 0.2, color: '#ffffff', gravity: 6 }); break;
      case 'fire': this.emit(e.x, e.y, 6, { speed: 2, life: 0.25, size: 0.15, color: '#ffffff' }); this.flashes.push({ star: true, x: e.x, y: e.y - 0.2, r: 0.55, t: 0, life: 0.1, color: '#ffe9a8', seed: (e.x * 11) % 100 }); break;
      case 'beam': this.flashes.push({ beam: true, x1: e.x1, y1: e.y1, x2: e.x2, y2: e.y2, color: e.color, t: 0, life: 0.45 }); this.shake += 0.4; break;
      case 'blink': this.emit(e.from[0], e.from[1], 20, { speed: 3, life: 0.5, size: 0.18, color: e.color }); this.emit(e.to[0], e.to[1], 20, { speed: 3, life: 0.5, size: 0.18, color: e.color }); break;
      case 'gale': this.flashes.push({ cone: true, x: e.x, y: e.y, dx: e.dx, dy: e.dy, len: e.len, t: 0, life: 0.5, color: '#8fd3ff' }); break;
      case 'crusher': this.flashes.push({ crusher: true, x: e.x, w: e.w, top: e.top, bottom: e.bottom, t: 0, life: 0.9 }); this.shake += 1.2; break;
      case 'geyser': this.emit(e.x, e.y, 50, { speed: 8, life: 0.9, size: 0.22, color: T.floorColor, gravity: 12, up: true }); this.flashes.push({ x: e.x, y: e.y, r: e.r, t: 0, life: 0.5, color: T.floorColor }); break;
      case 'reactorPulse': this.flashes.push({ x: e.x, y: e.y, r: e.r, t: 0, life: 0.7, color: T.light, ring: true }); this.shake += 0.6; break;
      case 'airstrike': this.numbers.push({ x: e.x, y: 1.5, text: 'AIR STRIKE', color: '#ff4d4d', t: 0, life: 1.2, big: true }); break;
      case 'splash': this.emit(e.x, e.y, 14, { speed: 4, life: 0.6, size: 0.18, color: T.floorColor, gravity: 10, up: true }); break;
      case 'toxic': for (let i = 0; i < 30; i++) this.emit(e.x + (Math.random() - 0.5) * e.r, e.y + (Math.random() - 0.5) * e.r, 1, { speed: 0.5, life: 2.2, size: 0.7, color: '#9dff2f', gravity: -0.5 }); break;
      case 'singularity': this.flashes.push({ x: e.x, y: e.y, r: e.r, t: 0, life: 2.6, color: '#9aa4b8', ring: true }); break;
      case 'reflect': this.flashes.push({ x: e.x, y: e.y, r: 0.6, t: 0, life: 0.3, color: '#ffffff' }); break;
      case 'wallBreak': this.emit(e.x, e.y, 20, { speed: 4, life: 0.7, size: 0.2, color: '#4f7cff', gravity: 10 }); break;
      case 'bounce': this.emit(e.x, e.y, 6, { speed: 2, life: 0.3, size: 0.12, color: e.color || '#fff' }); break;
      case 'contact': this.numbers.push({ x: this.world.bots[e.to].x, y: this.world.bots[e.to].y - 1, text: e.kind.toUpperCase() + '!', color: POWERUPS[e.kind].color, t: 0, life: 1 }); break;
      case 'suddenDeath': this.shake += 1; break;
      case 'mine': this.emit(e.x, e.y, 30, { speed: 7, life: 0.6, size: 0.2, color: '#ff4d4d', gravity: 8 }); this.flashes.push({ x: e.x, y: e.y, r: 1.2, t: 0, life: 0.35, color: '#ff8a2f' }); this.shake += 0.5; break;
      case 'mineSpawn': this.emit(e.x, e.y, 10, { speed: 2, life: 0.5, size: 0.15, color: '#fff' }); break;
      case 'lavaSurf': this.emit(e.x, e.y, 20, { speed: 5, life: 0.6, size: 0.2, color: '#ff5a1f', gravity: 12, up: true }); break;
      case 'teleport': {
        if (e.from) { this.emit(e.from[0], e.from[1], 22, { speed: 4, life: 0.5, size: 0.16, color: '#bff6ff', gravity: -6 }); this.flashes.push({ x: e.from[0], y: e.from[1], r: 1.1, t: 0, life: 0.35, color: '#bff6ff', ring: true }); }
        if (e.to) { this.emit(e.to[0], e.to[1], 22, { speed: 4, life: 0.5, size: 0.16, color: '#ffffff', gravity: 5 }); this.flashes.push({ x: e.to[0], y: e.to[1], r: 1.1, t: 0, life: 0.45, color: '#ffffff', ring: true }); }
        break;
      }
      case 'bomb': this.emit(e.x, e.y + 0.5, 3, { speed: 1, life: 0.4, size: 0.12, color: '#ffd08a', gravity: 20 }); break;
      case 'effect': { const b = this.world.bots[e.bot]; if (b) this.numbers.push({ x: b.x, y: b.y - 1.1, text: String(e.effect).toUpperCase(), color: EFFECT_COLORS[e.effect] || '#ffffff', t: 0, life: 1.0 }); break; }
      case 'special': { const b = this.world.bots[e.bot]; if (b) { const sp = b.def.s1.name === e.name ? b.def.s1 : b.def.s2; this.callouts.push({ bot: e.bot, kind: sp.id, name: sp.name, color: b.color, t: 0, life: 1.0 }); this.emit(e.x, e.y, 14, { speed: 3.5, life: 0.4, size: 0.16, color: b.color }); } break; }
    }
    if (this.onEvent) this.onEvent(e);
  }

  emit(x, y, n, o) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, s = (o.speed || 3) * (0.4 + Math.random() * 0.8);
      const vy = o.up ? -Math.abs(Math.sin(a)) * s : Math.sin(a) * s;
      this.particles.push({ x, y, vx: Math.cos(a) * s, vy, life: (o.life || 0.6) * (0.6 + Math.random() * 0.7), t: 0, size: (o.size || 0.2) * (0.6 + Math.random() * 0.8), color: o.color || '#fff', g: o.gravity || 0 });
    }
    if (this.particles.length > 1500) this.particles.splice(0, this.particles.length - 1500);
  }

  // ----- main draw -----
  update(dt, ctxInfo) {
    this.dt = dt;
    this.time += dt;
    const k = 1 - Math.pow(0.002, dt);
    this.cam.x += (this.camTarget.x - this.cam.x) * k;
    this.cam.y += (this.camTarget.y - this.cam.y) * k;
    this.cam.zoom += (this.camTarget.zoom - this.cam.zoom) * k;
    this.shake = Math.max(0, this.shake - dt * 3);
    for (const p of this.particles) { p.t += dt; p.vy += p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 1 - dt * 1.5; }
    this.particles = this.particles.filter((p) => p.t < p.life);
    for (const n of this.numbers) { n.t += dt; n.y -= dt * 0.9; }
    this.numbers = this.numbers.filter((n) => n.t < n.life);
    for (const f of this.flashes) f.t += dt;
    this.flashes = this.flashes.filter((f) => f.t < f.life);
    this.draw(ctxInfo || {});
  }

  draw(info) {
    const c = this.ctx, T = this.theme, w = this.world;
    c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    // sky
    if (!w) { const g = c.createLinearGradient(0, 0, 0, this.h); g.addColorStop(0, T.sky[0]); g.addColorStop(1, T.sky[1]); c.fillStyle = g; c.fillRect(0, 0, this.w, this.h); return; }
    const camInfo = { x: this.cam.x + this.userPan.x, y: this.cam.y + this.userPan.y, zoom: this.cam.zoom * this.userZoom };
    const bg = getBackground(w.map.id);
    if (bg) drawBackground(c, bg, w.map.id, { w: this.w, h: this.h }, camInfo, w.map);
    else paintBackdrop(c, T, w.map, { w: this.w, h: this.h }, camInfo, this.time);
    const sx = (Math.random() - 0.5) * this.shake * 6, sy = (Math.random() - 0.5) * this.shake * 6;
    c.save(); c.translate(sx, sy);
    this.drawKillFloor();
    this.drawHazardOverlays(info);
    this.drawTerrain();
    this.drawEdges();
    this.drawMines();
    this.drawPatchesFields();
    this.drawPowerups();
    this.drawWalls();
    this.drawPads();
    this.drawBots(info);
    this.drawProjectiles();
    this.drawFlashes();
    this.drawParticles();
    this.drawKillFloorSurface();
    if (info.aim) this.drawAimGuide(info.aim);
    this.drawCallouts();
    this.drawNumbers();
    c.restore();
  }

  drawParallax() {
    const c = this.ctx, T = this.theme, w = this.world, z = this.cam.zoom * this.userZoom;
    const layers = [{ color: T.far, speed: 0.15, h: 0.45 }, { color: T.mid, speed: 0.3, h: 0.3 }];
    for (const L of layers) {
      const off = -(this.cam.x * L.speed) * z;
      c.fillStyle = L.color;
      const baseY = this.h * (1 - L.h) + (this.cam.y - w.map.height / 2) * L.speed * z * 0.5;
      const period = 260;
      for (let x = (off % period) - period; x < this.w + period; x += period) {
        if (T.floor === 'void') { // clouds
          c.beginPath(); c.ellipse(x + 130, baseY + 30, 120, 34, 0, 0, Math.PI * 2); c.ellipse(x + 60, baseY + 50, 70, 26, 0, 0, Math.PI * 2); c.fill();
        } else { // skyline blocks / rock spires
          const hgt = 60 + ((x / period) * 37 % 90 + 90) % 90;
          c.fillRect(x, baseY - hgt, 90, this.h);
          c.fillRect(x + 120, baseY - hgt * 0.6, 60, this.h);
          c.fillRect(x + 200, baseY - hgt * 1.3, 40, this.h);
        }
      }
    }
  }

  rectScreen(r) {
    const [x, y] = this.toScreen(r.x, r.y);
    const z = this.cam.zoom * this.userZoom;
    return [x, y, r.w * z, r.h * z];
  }

  drawTerrain() {
    const z = this.cam.zoom * this.userZoom;
    const rects = this.world.map.terrain.map((r) => { const [x, y, W, H] = this.rectScreen(r); return { x, y, w: W, h: H, world: r }; });
    const slopes = (this.world.map.slopes || []).map((s) => { const [x, y, W, H] = this.rectScreen(s); return { x, y, w: W, h: H, dir: s.dir }; });
    const kit = getTerrainKit(this.world.map.id);
    if (kit) paintPaintedTerrain(this.ctx, kit, rects, z, slopes);
    else paintTerrain(this.ctx, this.theme, rects, z, this.time, slopes);
  }

  // The arena is bounded left and right. Show it: solid themed walls on normal
  // maps, glowing portal edges on teleporter maps.
  drawEdges() {
    const c = this.ctx, w = this.world, T = this.theme, z = this.cam.zoom * this.userZoom;
    const [xl] = this.toScreen(0, 0), [xr] = this.toScreen(w.map.width, 0);
    const [, yTop] = this.toScreen(0, -4);
    const [, yBot] = this.toScreen(0, w.lavaY + 0.8);
    if (!w.map.teleporters) {
      const wallW = Math.max(6, z * 0.9);
      for (const [x, flip] of [[xl, -1], [xr, 1]]) {
        const kit = getTerrainKit(w.map.id);
        const g = c.createLinearGradient(x, 0, x + flip * wallW, 0);
        g.addColorStop(0, this.theme.rockLite); g.addColorStop(1, this.theme.rock);
        c.fillStyle = g;
        if (kit) { const p = c.createPattern(kit.face, 'repeat'); const s = (kit.tile * z) / kit.face.width; if (p && p.setTransform) p.setTransform(new DOMMatrix([s, 0, 0, s, x, yTop])); if (p) c.fillStyle = p; }
        c.fillRect(flip < 0 ? x - wallW : x, yTop, wallW, yBot - yTop);
        c.lineWidth = Math.max(2, z * 0.08); c.strokeStyle = '#0b0e14';
        c.strokeRect(flip < 0 ? x - wallW : x, yTop, wallW, yBot - yTop);
        // rivets / cracks so it reads as a wall
        c.fillStyle = 'rgba(0,0,0,0.25)';
        for (let yy = yTop + z; yy < yBot; yy += z * 1.6) c.fillRect((flip < 0 ? x - wallW : x) + wallW * 0.3, yy, wallW * 0.4, Math.max(2, z * 0.08));
      }
    } else {
      for (const [x] of [[xl], [xr]]) {
        c.save();
        c.globalAlpha = 0.55 + Math.sin(this.time * 4) * 0.2;
        c.strokeStyle = T.light; c.lineWidth = Math.max(3, z * 0.14); c.setLineDash([z * 0.5, z * 0.35]);
        c.lineDashOffset = -this.time * z * 1.5;
        c.beginPath(); c.moveTo(x, yTop); c.lineTo(x, yBot); c.stroke();
        c.setLineDash([]);
        const g = c.createLinearGradient(x - z * 0.8, 0, x + z * 0.8, 0);
        g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(0.5, rgbaHex(T.light, 0.18)); g.addColorStop(1, 'rgba(0,0,0,0)');
        c.fillStyle = g; c.fillRect(x - z * 0.8, yTop, z * 1.6, yBot - yTop);
        c.restore();
      }
    }
  }

  drawMines() {
    const z = this.cam.zoom * this.userZoom;
    for (const mn of this.world.mines) { const [x, y] = this.toScreen(mn.x, mn.y); paintMine(this.ctx, x, y, z, this.time, mn.alive); }
  }

  drawKillFloorSurface() { /* floor is fully painted in drawKillFloor */ }

  drawKillFloor() {
    const z = this.cam.zoom * this.userZoom;
    const [, y0] = this.toScreen(0, this.world.lavaY);
    paintFloor(this.ctx, this.theme, y0, { w: this.w, h: this.h }, z, this.time, (sx) => this.toWorld(sx, 0)[0]);
  }

  drawHazardOverlays(info) {
    const c = this.ctx, w = this.world, z = this.cam.zoom * this.userZoom;
    const pulse = 0.35 + Math.abs(Math.sin(this.time * 4)) * 0.35;
    for (const a of w.hazardAnnounce) {
      const col = a.type === 'danger' ? `rgba(255,60,60,${pulse})` : 'rgba(255,200,60,0.35)';
      c.fillStyle = col; c.strokeStyle = col; c.lineWidth = 3; c.setLineDash([8, 6]);
      if (a.zone) { const [x, y, W, H] = this.rectScreen(a.zone); c.globalAlpha = 0.25; c.fillRect(x, y, W, H); c.globalAlpha = 1; c.strokeRect(x, y, W, H); }
      if (a.circle) { const [x, y] = this.toScreen(a.circle.x, a.circle.y); c.beginPath(); c.arc(x, y, a.circle.r * z, 0, Math.PI * 2); c.globalAlpha = 0.2; c.fill(); c.globalAlpha = 1; c.stroke(); }
      if (a.points) for (const [px, py] of a.points) { const [x, y] = this.toScreen(px, py); c.beginPath(); c.arc(x, y, (a.radius || 1.4) * z, 0, Math.PI * 2); c.globalAlpha = 0.25; c.fill(); c.globalAlpha = 1; c.stroke(); }
      if (a.strike !== undefined) { const [x] = this.toScreen(a.strike, 0); c.globalAlpha = 0.18; c.fillRect(x - 2.4 * z, 0, 4.8 * z, this.h); c.globalAlpha = 1; c.beginPath(); c.moveTo(x, 0); c.lineTo(x, this.h); c.stroke(); }
      if (a.type === 'powerup') { const [x, y] = this.toScreen(a.x, a.y); c.strokeStyle = POWERUPS[a.id].color; c.beginPath(); c.arc(x, y, 0.7 * z * (1 + pulse * 0.3), 0, Math.PI * 2); c.stroke(); }
      c.setLineDash([]);
    }
    // wind indicator arrows in the sky
    if (w.windX) {
      c.fillStyle = 'rgba(255,255,255,0.35)';
      const n = Math.min(6, Math.ceil(Math.abs(w.windX) / 2));
      for (let i = 0; i < 24; i++) {
        const px = ((i * 97 + this.time * w.windX * 30) % (this.w + 80) + this.w + 80) % (this.w + 80) - 40;
        const py = 30 + (i * 53) % Math.max(60, this.h * 0.35);
        c.fillRect(px, py, 14 + n * 4, 2);
      }
    }
  }

  drawPatchesFields() {
    const c = this.ctx, w = this.world, z = this.cam.zoom * this.userZoom;
    for (const p of w.patches) {
      const [x, y] = this.toScreen(p.x, p.y);
      for (let i = 0; i < 7; i++) {
        const fx = x + (i - 3) * p.w * z / 7, fy = y - Math.abs(Math.sin(this.time * 6 + i)) * z * 0.6;
        c.fillStyle = i % 2 ? '#ff6a1f' : '#ffb347';
        c.beginPath(); c.moveTo(fx - z * 0.2, y); c.lineTo(fx, fy - z * 0.5); c.lineTo(fx + z * 0.2, y); c.closePath(); c.fill();
      }
    }
    for (const f of w.fields) {
      const [x, y] = this.toScreen(f.x, f.y);
      if (f.kind === 'toxic') { for (let i = 0; i < 10; i++) { c.fillStyle = i % 2 ? 'rgba(125,210,30,0.4)' : 'rgba(60,120,20,0.45)'; c.beginPath(); c.arc(x + Math.cos(i * 0.7 + this.time) * f.r * z * 0.55, y + Math.sin(i * 1.3 + this.time * 0.7) * f.r * z * 0.5, f.r * z * 0.5, 0, Math.PI * 2); c.fill(); } c.fillStyle = 'rgba(180,255,90,0.8)'; for (let i = 0; i < 6; i++) { const a = this.time * 2 + i * 1.05; c.beginPath(); c.arc(x + Math.cos(a) * f.r * z * 0.6, y + Math.sin(a * 1.4) * f.r * z * 0.5, z * 0.06, 0, Math.PI * 2); c.fill(); } }
      else { c.strokeStyle = '#ffe23a'; c.lineWidth = 2; c.setLineDash([4, 4]); c.beginPath(); c.arc(x, y, f.r * z, 0, Math.PI * 2); c.stroke(); c.setLineDash([]); c.fillStyle = 'rgba(255,226,58,0.15)'; c.fill(); for (let i = 0; i < 5; i++) { const a = this.time * 9 + i * 1.3; c.strokeStyle = '#ffe23a'; c.beginPath(); c.moveTo(x, y); c.lineTo(x + Math.cos(a) * f.r * z, y + Math.sin(a) * f.r * z * 0.8); c.stroke(); } }
    }
    if (w.singularity && w.singularity.t > 0) {
      const [x, y] = this.toScreen(w.singularity.x, w.singularity.y);
      c.strokeStyle = '#9aa4b8'; c.lineWidth = 2;
      for (let i = 0; i < 3; i++) { const r = ((this.time * 2 + i / 3) % 1) * w.singularity.r * z; c.globalAlpha = 1 - r / (w.singularity.r * z); c.beginPath(); c.arc(x, y, w.singularity.r * z - r, 0, Math.PI * 2); c.stroke(); }
      c.globalAlpha = 1; c.fillStyle = '#111'; c.beginPath(); c.arc(x, y, 0.35 * z, 0, Math.PI * 2); c.fill();
    }
  }

  drawPowerups() {
    const c = this.ctx, z = this.cam.zoom * this.userZoom;
    for (const p of this.world.powerups) {
      const [x, y] = this.toScreen(p.x, p.y - 0.15);
      drawPowerupIcon(c, p.id, x, y, Math.max(8, z * 0.46), { float: true, time: this.time });
    }
  }

  drawWalls() {
    const c = this.ctx, z = this.cam.zoom * this.userZoom;
    for (const wl of this.world.walls) {
      const [x, y, W, H] = this.rectScreen(wl.rect);
      c.fillStyle = wl.color; c.fillRect(x, y, W, H);
      c.strokeStyle = '#0d1018'; c.lineWidth = Math.max(2, z * 0.07); c.strokeRect(x, y, W, H);
      c.fillStyle = 'rgba(255,255,255,0.35)'; c.fillRect(x + W * 0.3, y + 2, W * 0.2, H - 4);
    }
  }

  // Bot art: one signature shape per bot, thick outline, team colour.
  // Teleporter pads: a glowing ring with a rising swirl, so they read as an exit.
  drawPads() {
    const c = this.ctx, w = this.world, z = this.cam.zoom * this.userZoom;
    for (const pad of w.pads || []) {
      const [x, y] = this.toScreen(pad.x, pad.y);
      const r = z * 0.75, pulse = 0.85 + Math.sin(this.time * 3 + pad.x) * 0.15;
      const g = c.createRadialGradient(x, y, r * 0.1, x, y, r * 1.5);
      g.addColorStop(0, 'rgba(150,230,255,0.55)'); g.addColorStop(1, 'rgba(150,230,255,0)');
      c.fillStyle = g; c.beginPath(); c.arc(x, y, r * 1.5, 0, Math.PI * 2); c.fill();
      c.strokeStyle = '#9fe8ff'; c.lineWidth = Math.max(2, z * 0.09);
      c.beginPath(); c.ellipse(x, y + r * 0.35, r, r * 0.35, 0, 0, Math.PI * 2); c.stroke();
      c.strokeStyle = 'rgba(255,255,255,0.9)'; c.lineWidth = Math.max(1.5, z * 0.05);
      for (let i = 0; i < 3; i++) {
        const t2 = ((this.time * 0.8 + i / 3) % 1);
        c.globalAlpha = (1 - t2) * pulse;
        c.beginPath(); c.ellipse(x, y + r * 0.35 - t2 * r * 1.6, r * (1 - t2 * 0.6), r * 0.3 * (1 - t2 * 0.6), 0, 0, Math.PI * 2); c.stroke();
      }
      c.globalAlpha = 1;
    }
  }

  drawBots(info) {
    const c = this.ctx, w = this.world, z = this.cam.zoom * this.userZoom;
    for (const b of w.bots) {
      if (!b.alive) { const a = this.anims.get(b.id); if (!a || a.anim !== 'death' || this.time - a.start > ANIM_LENGTH.death) continue; }
      const [x, y] = this.toScreen(b.x, b.y);
      const r = PHYS.botRadius * z;
      const facing = info.facing && info.facing[b.id] !== undefined ? info.facing[b.id] : (b.vx < -0.1 ? -1 : 1);
      const isSel = info.selected === b.id;
      c.save(); c.translate(x, y);
      // shadow
      c.fillStyle = 'rgba(0,0,0,0.25)'; c.beginPath(); c.ellipse(0, r * 0.95, r * 0.9, r * 0.25, 0, 0, Math.PI * 2); c.fill();
      // deflector dome
      if (b.deflector) { c.fillStyle = 'rgba(61,220,151,0.25)'; c.strokeStyle = '#3ddc97'; c.lineWidth = 3; c.beginPath(); c.arc(0, 0, r * 2.1, 0, Math.PI * 2); c.fill(); c.stroke(); }
      if (w.hasEffect(b, 'reflector')) { c.strokeStyle = '#ffffff'; c.lineWidth = 2; c.setLineDash([3, 3]); c.beginPath(); c.arc(0, 0, r * 1.5, 0, Math.PI * 2); c.stroke(); c.setLineDash([]); }
      if (w.hasEffect(b, 'plating')) { c.strokeStyle = '#c0c8d8'; c.lineWidth = 4; c.beginPath(); c.arc(0, 0, r * 1.25, 0, Math.PI * 2); c.stroke(); }
      const st = this.animState(b);
      const wasGrounded = this._grounded ? this._grounded.get(b.id) : undefined;
      if (!this._airTime) this._airTime = new Map();
      this._airTime.set(b.id, b.grounded ? 0 : (this._airTime.get(b.id) || 0) + this.dt);
      if (wasGrounded === false && b.grounded && st.anim === 'idle') {
        const hard = (this._lastAir || 0) > 0.45;
        this.playAnim(b.id, 'land'); this.emit(b.x, b.y + 0.45, hard ? 16 : 8, { speed: hard ? 3.2 : 2.2, life: 0.35, size: 0.18, color: 'rgba(255,255,255,0.8)', gravity: 3 });
        if (hard) this.shake += 0.25;
        if (this.onEvent) this.onEvent({ type: 'land', hard, bot: b.id });
      }
      if (!b.grounded) this._lastAir = this._airTime.get(b.id);
      (this._grounded || (this._grounded = new Map())).set(b.id, b.grounded);
      drawBot(c, b.def, r * 1.67 * PHYS.botVisualScale, { ...this.animState(b), facing, vx: b.vx, vy: b.vy, grounded: b.grounded, color: b.color, hp: b.hp / b.maxHp, id: b.id }, this.time);
      c.restore();

      if (!b.alive) continue;
      // selection ring
      if (isSel) { c.strokeStyle = '#ffffff'; c.lineWidth = 2; c.setLineDash([5, 4]); c.beginPath(); c.arc(x, y, r * 1.6 + Math.sin(this.time * 5) * 2, 0, Math.PI * 2); c.stroke(); c.setLineDash([]); }
      // Brawlbots-style nameplate: dark capsule, HP chip, identity-coloured bar
      // with a white ghost segment that drains after damage.
      const bw = Math.max(40, r * 3.1), bh = Math.max(6, z * 0.2);
      const by = y - r * 1.75 - z * 0.5;
      const frac = Math.max(0, Math.min(1, b.hp / b.maxHp));
      if (!this._ghost) this._ghost = new Map();
      let gh = this._ghost.get(b.id); if (gh === undefined || gh < frac) gh = frac;
      gh = Math.max(frac, gh - this.dt * 0.35); this._ghost.set(b.id, gh);
      const chipW = Math.max(16, z * 0.62), capH = bh + Math.max(3, z * 0.1);
      const capX = x - bw / 2 - chipW * 0.55, capW = bw + chipW * 0.7;
      c.fillStyle = 'rgba(13,16,24,0.92)'; c.beginPath(); c.roundRect(capX - 2, by - (capH - bh) / 2 - 1, capW + 4, capH + 2, capH); c.fill();
      c.strokeStyle = 'rgba(255,255,255,0.18)'; c.lineWidth = 1; c.stroke();
      // HP chip
      c.fillStyle = '#1c2230'; c.beginPath(); c.roundRect(capX, by - (capH - bh) / 2, chipW, capH, capH * 0.4); c.fill();
      c.fillStyle = '#fff'; c.font = `bold ${Math.max(8, Math.round(z * 0.26))}px sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillText(String(Math.ceil(b.hp)), capX + chipW / 2, by + bh / 2);
      // bar track + ghost + fill
      const tx = capX + chipW + z * 0.06, tw = capX + capW - tx - z * 0.1;
      c.fillStyle = '#252b38'; c.beginPath(); c.roundRect(tx, by, tw, bh, bh / 2); c.fill();
      if (gh > frac + 0.002) { c.fillStyle = 'rgba(255,255,255,0.85)'; c.beginPath(); c.roundRect(tx, by, tw * gh, bh, bh / 2); c.fill(); }
      if (frac > 0) { c.fillStyle = b.color; c.beginPath(); c.roundRect(tx, by, Math.max(bh, tw * frac), bh, bh / 2); c.fill();
        c.fillStyle = 'rgba(255,255,255,0.35)'; c.beginPath(); c.roundRect(tx, by, Math.max(bh, tw * frac), bh * 0.45, bh / 2); c.fill(); }
      if (b.hp > b.maxHp) { c.fillStyle = '#ff9cf0'; c.beginPath(); c.roundRect(tx, by, tw * Math.min(1, (b.hp - b.maxHp) / 20) * 0.3, bh, bh / 2); c.fill(); }
      // name above, READY! when locked in
      c.fillStyle = '#fff'; c.font = `bold ${Math.max(10, Math.round(z * 0.32))}px sans-serif`; c.textBaseline = 'bottom';
      c.strokeStyle = '#0d1018'; c.lineWidth = 3; c.strokeText(b.name, x, by - z * 0.12); c.fillText(b.name, x, by - z * 0.12);
      if (info.ready && info.ready.has(b.id)) {
        c.save(); c.translate(x - bw / 2 - z * 0.1, by - z * 0.55); c.rotate(-0.08);
        c.font = `italic 900 ${Math.max(10, Math.round(z * 0.3))}px sans-serif`; c.textAlign = 'center';
        c.strokeStyle = '#5a3a00'; c.lineWidth = 3; c.strokeText('READY!', 0, 0);
        c.fillStyle = '#ffd23a'; c.fillText('READY!', 0, 0); c.restore();
        c.textAlign = 'center';
      }
      // effects
      const keys = Object.keys(b.effects).filter((k) => b.effects[k] > 0);
      if (b.contact) keys.push(b.contact);
      keys.forEach((k, i) => {
        const ex = x - (keys.length - 1) * z * 0.24 + i * z * 0.48, ey = y + r * 1.6 + z * 0.3;
        if (POWERUPS[k]) { drawPowerupIcon(c, k, ex, ey, z * 0.2, { flat: true }); return; }
        c.fillStyle = EFFECT_COLORS[k] || '#fff';
        c.beginPath(); c.arc(ex, ey, z * 0.19, 0, Math.PI * 2); c.fill();
        c.fillStyle = '#0d1018'; c.font = `bold ${Math.round(z * 0.22)}px sans-serif`;
        c.fillText(EFFECT_ICONS[k] || '?', ex, ey + 1);
      });
      // team badge
      if (w.teamsMode) { c.fillStyle = TEAM_COLORS[b.team % 4]; c.beginPath(); c.arc(x + bw / 2 + z * 0.2, by + bh / 2, z * 0.14, 0, Math.PI * 2); c.fill(); }
    }
  }

  drawBotShape(shape, r, b) {
    const c = this.ctx;
    const eye = () => { c.fillStyle = '#fff'; c.beginPath(); c.arc(r * 0.35, -r * 0.2, r * 0.28, 0, Math.PI * 2); c.fill(); c.fillStyle = '#0d1018'; c.beginPath(); c.arc(r * 0.45, -r * 0.2, r * 0.13, 0, Math.PI * 2); c.fill(); };
    const bob = Math.sin(this.time * 4 + b.id) * r * 0.05;
    c.translate(0, bob);
    c.fillStyle = b.color;
    switch (shape) {
      case 'block': // Bulwark: wide square with visor slit
        c.beginPath(); c.roundRect(-r, -r * 0.9, r * 2, r * 1.9, r * 0.2); c.fill(); c.stroke();
        c.fillStyle = '#0d1018'; c.fillRect(-r * 0.2, -r * 0.45, r * 1.0, r * 0.3); c.fillStyle = '#5ff2ff'; c.fillRect(-r * 0.1, -r * 0.4, r * 0.8, r * 0.2);
        c.fillStyle = '#0d1018'; c.fillRect(-r * 1.1, -r * 0.5, r * 0.25, r * 1.2); c.fillRect(r * 0.85, -r * 0.5, r * 0.25, r * 1.2);
        break;
      case 'jaw': // Magmaw: round with a big toothy mouth
        c.beginPath(); c.arc(0, 0, r, 0, Math.PI * 2); c.fill(); c.stroke();
        c.fillStyle = '#0d1018'; c.beginPath(); c.moveTo(-r * 0.2, r * 0.15); c.lineTo(r * 0.95, r * 0.05); c.lineTo(r * 0.85, r * 0.55); c.lineTo(-r * 0.1, r * 0.6); c.closePath(); c.fill();
        c.fillStyle = '#fff'; for (let i = 0; i < 4; i++) { c.beginPath(); c.moveTo(r * 0.05 + i * r * 0.22, r * 0.12); c.lineTo(r * 0.15 + i * r * 0.22, r * 0.38); c.lineTo(r * 0.25 + i * r * 0.22, r * 0.12); c.closePath(); c.fill(); }
        eye();
        break;
      case 'bolt': // Volt: diamond body with antenna
        c.beginPath(); c.moveTo(0, -r * 1.05); c.lineTo(r * 0.95, 0); c.lineTo(0, r * 1.0); c.lineTo(-r * 0.95, 0); c.closePath(); c.fill(); c.stroke();
        c.beginPath(); c.moveTo(0, -r * 1.0); c.lineTo(r * 0.15, -r * 1.5); c.stroke(); c.fillStyle = '#fff'; c.beginPath(); c.arc(r * 0.15, -r * 1.5, r * 0.12, 0, Math.PI * 2); c.fill();
        eye();
        break;
      case 'shield': // Warden: tall rounded shield shape
        c.beginPath(); c.moveTo(-r * 0.9, -r * 0.9); c.lineTo(r * 0.9, -r * 0.9); c.lineTo(r * 0.9, r * 0.2); c.quadraticCurveTo(r * 0.9, r * 1.05, 0, r * 1.1); c.quadraticCurveTo(-r * 0.9, r * 1.05, -r * 0.9, r * 0.2); c.closePath(); c.fill(); c.stroke();
        c.strokeStyle = '#0d1018'; c.beginPath(); c.moveTo(0, -r * 0.7); c.lineTo(0, r * 0.8); c.stroke();
        eye();
        break;
      case 'wing': // Skyla: sleek oval with wing fins
        c.beginPath(); c.moveTo(-r * 1.15, r * 0.1); c.lineTo(-r * 0.4, -r * 0.25); c.lineTo(-r * 0.5, r * 0.5); c.closePath(); c.fill(); c.stroke();
        c.beginPath(); c.ellipse(0, 0, r, r * 0.75, 0, 0, Math.PI * 2); c.fill(); c.stroke();
        eye();
        break;
      case 'blade': // Phantom: hooded triangle
        c.beginPath(); c.moveTo(0, -r * 1.1); c.lineTo(r * 0.95, r * 0.9); c.lineTo(-r * 0.95, r * 0.9); c.closePath(); c.fill(); c.stroke();
        c.fillStyle = '#0d1018'; c.beginPath(); c.moveTo(-r * 0.45, r * 0.15); c.lineTo(r * 0.6, r * 0.15); c.lineTo(r * 0.45, r * 0.5); c.lineTo(-r * 0.3, r * 0.5); c.closePath(); c.fill();
        c.fillStyle = '#fff'; c.fillRect(r * 0.05, r * 0.22, r * 0.35, r * 0.12);
        break;
      case 'ball': // Ricochet: sphere with a band
        c.beginPath(); c.arc(0, 0, r, 0, Math.PI * 2); c.fill(); c.stroke();
        c.fillStyle = '#0d1018'; c.beginPath(); c.arc(0, 0, r, -0.4, 0.5); c.arc(0, 0, r * 0.7, 0.5, -0.4, true); c.closePath(); c.fill();
        eye();
        break;
      case 'orb': // Gravitas: ringed planet
      default:
        c.beginPath(); c.arc(0, 0, r * 0.85, 0, Math.PI * 2); c.fill(); c.stroke();
        c.beginPath(); c.ellipse(0, r * 0.1, r * 1.35, r * 0.35, -0.3, 0, Math.PI * 2); c.stroke();
        eye();
        break;
    }
  }

  drawProjectiles() {
    const c = this.ctx, z = this.cam.zoom * this.userZoom;
    for (const p of this.world.projectiles) {
      if (p.trail.length > 1) {
        c.strokeStyle = p.color; c.lineWidth = Math.max(2, z * 0.1); c.globalAlpha = 0.6; c.beginPath();
        const start = Math.max(0, p.trail.length - 40);
        for (let i = start; i < p.trail.length; i++) { const [x, y] = this.toScreen(p.trail[i][0], p.trail[i][1]); if (i === start) c.moveTo(x, y); else c.lineTo(x, y); }
        c.stroke(); c.globalAlpha = 1;
      }
      const [x, y] = this.toScreen(p.x, p.y);
      c.fillStyle = p.color; c.strokeStyle = '#0d1018'; c.lineWidth = 2;
      c.beginPath(); c.arc(x, y, Math.max(3, p.r * z * 1.2), 0, Math.PI * 2); c.fill(); c.stroke();
      if (p.kind === 'bomb') { c.fillStyle = '#ff4d4d'; c.beginPath(); c.moveTo(x, y - 12); c.lineTo(x + 6, y - 4); c.lineTo(x - 6, y - 4); c.closePath(); c.fill(); }
    }
  }

  drawFlashes() {
    const c = this.ctx, z = this.cam.zoom * this.userZoom;
    for (const f of this.flashes) {
      const k = f.t / f.life;
      if (f.beam) { const [x1, y1] = this.toScreen(f.x1, f.y1), [x2, y2] = this.toScreen(f.x2, f.y2); c.strokeStyle = f.color; c.globalAlpha = 1 - k; c.lineWidth = z * 0.35 * (1 - k) + 2; c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke(); c.strokeStyle = '#fff'; c.lineWidth = 2; c.stroke(); c.globalAlpha = 1; continue; }
      if (f.cone) { const [x, y] = this.toScreen(f.x, f.y); const a = Math.atan2(f.dy, f.dx); c.fillStyle = f.color; c.globalAlpha = 0.35 * (1 - k); c.beginPath(); c.moveTo(x, y); c.arc(x, y, f.len * z * Math.min(1, k * 3), a - 0.56, a + 0.56); c.closePath(); c.fill(); c.globalAlpha = 1; continue; }
      if (f.crusher) { const [x, y, W] = this.rectScreen({ x: f.x, y: f.top, w: f.w, h: 1 }); const drop = Math.min(1, k * 3); const [, yb] = this.toScreen(0, f.bottom); const h = (yb - y) * drop; paintCrusher(c, this.theme, x, y, W, h, k, z); continue; }
      const [x, y] = this.toScreen(f.x, f.y);
      if (f.star) {
        // comic spike star: alternating long/short points
        const R = f.r * z * (0.8 + k * 0.5), pts = 10;
        c.globalAlpha = 1 - k * 0.6; c.fillStyle = f.color;
        c.beginPath();
        for (let i = 0; i < pts * 2; i++) { const a = (i / (pts * 2)) * Math.PI * 2 + (f.seed || 0); const rr = i % 2 === 0 ? R : R * 0.42; const px = x + Math.cos(a) * rr, py = y + Math.sin(a) * rr; i === 0 ? c.moveTo(px, py) : c.lineTo(px, py); }
        c.closePath(); c.fill();
        c.globalAlpha = 1; continue;
      }
      if (f.ring2) {
        const R = f.r * z * (0.25 + k * 0.95);
        c.globalAlpha = (1 - k) * 0.9;
        c.strokeStyle = f.color; c.lineWidth = Math.max(3, z * 0.22 * (1 - k)); c.beginPath(); c.arc(x, y, R, 0, Math.PI * 2); c.stroke();
        c.strokeStyle = '#ffffff'; c.lineWidth = Math.max(1.5, z * 0.08 * (1 - k)); c.beginPath(); c.arc(x, y, R * 0.88, 0, Math.PI * 2); c.stroke();
        c.globalAlpha = 1; continue;
      }
      c.globalAlpha = 1 - k;
      if (f.ring) { c.strokeStyle = f.color; c.lineWidth = 4; c.beginPath(); c.arc(x, y, f.r * z * (0.2 + k * 0.8), 0, Math.PI * 2); c.stroke(); }
      else { c.fillStyle = f.color; c.beginPath(); c.arc(x, y, f.r * z * (0.6 + k * 0.6), 0, Math.PI * 2); c.fill(); c.fillStyle = '#fff'; c.beginPath(); c.arc(x, y, f.r * z * 0.5 * (1 - k), 0, Math.PI * 2); c.fill(); }
      c.globalAlpha = 1;
    }
  }

  drawParticles() {
    const c = this.ctx, z = this.cam.zoom * this.userZoom;
    for (const p of this.particles) {
      const [x, y] = this.toScreen(p.x, p.y);
      c.globalAlpha = 1 - p.t / p.life; c.fillStyle = p.color;
      c.fillRect(x - p.size * z / 2, y - p.size * z / 2, p.size * z, p.size * z);
    }
    c.globalAlpha = 1;
  }

  // A special's icon and name pop over the bot that used it, then rise and fade.
  drawCallouts() {
    const c = this.ctx, z = this.cam.zoom * this.userZoom;
    for (let i = this.callouts.length - 1; i >= 0; i--) {
      const co = this.callouts[i]; co.t += this.dt;
      if (co.t >= co.life) { this.callouts.splice(i, 1); continue; }
      const b = this.world.bots[co.bot]; if (!b) continue;
      const k = co.t / co.life, pop = k < 0.15 ? k / 0.15 : 1, fade = k > 0.7 ? 1 - (k - 0.7) / 0.3 : 1;
      const [x, y] = this.toScreen(b.x, b.y);
      const cy = y - z * 1.7 - z * 0.6 * k, size = Math.max(22, z * 0.72) * (0.6 + 0.4 * pop);
      c.save(); c.globalAlpha = fade;
      c.fillStyle = 'rgba(13,16,24,0.85)'; c.beginPath(); c.roundRect(x - size * 1.1, cy - size * 0.6, size * 2.2, size * 1.2, size * 0.3); c.fill();
      c.strokeStyle = co.color; c.lineWidth = 2; c.stroke();
      drawActionIcon(c, co.kind, x - size * 0.45, cy, size * 0.75);
      c.fillStyle = '#fff'; c.font = `bold ${Math.max(9, size * 0.34)}px sans-serif`; c.textAlign = 'left'; c.textBaseline = 'middle';
      c.fillText(co.name.toUpperCase(), x - size * 0.02, cy);
      c.restore();
    }
  }

  drawNumbers() {
    const c = this.ctx, z = this.cam.zoom * this.userZoom;
    for (const n of this.numbers) {
      const [x, y] = this.toScreen(n.x, n.y);
      c.globalAlpha = Math.min(1, (n.life - n.t) * 2);
      c.font = `bold ${Math.round(z * (n.big ? 0.62 : 0.42))}px sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.lineWidth = 4; c.strokeStyle = '#0d1018'; c.strokeText(n.text, x, y); c.fillStyle = n.color; c.fillText(n.text, x, y);
    }
    c.globalAlpha = 1;
  }

  // Dotted trajectory preview, styled per move (like Brawlbots):
  // jump = plain white dots with a landing marker, missile = glowing coloured
  // dots that shrink along the arc, specials = glowing diamond dots in the
  // move's accent colour with a pulsing impact ring.
  drawAimGuide(aim) {
    const c = this.ctx, z = this.cam.zoom * this.userZoom;
    const { points, fraction, color, impact, radius, hidden } = aim;
    if (hidden) return;
    const style = aim.style || 'missile';
    const accent = aim.accent || color;
    const n = Math.max(2, Math.floor(points.length * fraction));
    const step = style === 'jump' ? 4 : 3;
    for (let i = 0; i < n; i += step) {
      const [x, y] = this.toScreen(points[i][0], points[i][1]);
      const f = i / n;
      const dr = Math.max(3, z * (style === 'jump' ? 0.105 : 0.115) * (1 - f * 0.2));
      c.globalAlpha = 1 - f * 0.15;
      if (style === 'jump') {
        c.fillStyle = '#ffffff'; c.strokeStyle = 'rgba(13,16,24,0.8)'; c.lineWidth = 1.5;
        c.beginPath(); c.arc(x, y, dr, 0, Math.PI * 2); c.fill(); c.stroke();
      } else {
        // soft glow behind the dot
        c.fillStyle = accent; c.globalAlpha = (1 - f * 0.35) * 0.28;
        c.beginPath(); c.arc(x, y, dr * 2.1, 0, Math.PI * 2); c.fill();
        c.globalAlpha = 1 - f * 0.3;
        if (style === 'special') {
          c.save(); c.translate(x, y); c.rotate(Math.PI / 4);
          c.fillStyle = '#ffffff'; c.strokeStyle = accent; c.lineWidth = Math.max(1.5, dr * 0.5);
          c.fillRect(-dr * 0.72, -dr * 0.72, dr * 1.44, dr * 1.44); c.strokeRect(-dr * 0.72, -dr * 0.72, dr * 1.44, dr * 1.44);
          c.restore();
        } else {
          const g = c.createRadialGradient(x, y, 0, x, y, dr);
          g.addColorStop(0, '#ffffff'); g.addColorStop(0.55, accent); g.addColorStop(1, accent);
          c.fillStyle = g; c.strokeStyle = 'rgba(13,16,24,0.7)'; c.lineWidth = 1.2;
          c.beginPath(); c.arc(x, y, dr, 0, Math.PI * 2); c.fill(); c.stroke();
        }
      }
    }
    c.globalAlpha = 1;
    // the move's icon rides at the end of the arc (like Brawlbots)
    { const last = points[Math.max(0, n - 1)];
      const end = impact ? [impact.x, impact.y] : last;
      const [ex, ey] = this.toScreen(end[0], end[1]);
      const bob = Math.sin(this.time * 5) * z * 0.05;
      drawActionIcon(c, aim.iconKind || style, ex, ey - z * 0.55 + bob, Math.max(9, z * 0.3)); }
    // landing / impact marker
    if (impact) {
      const [x, y] = this.toScreen(impact.x, impact.y);
      if (style === 'jump') {
        // landing marker: bouncing down-chevron over a ground tick
        const bob = Math.sin(this.time * 6) * z * 0.06;
        c.strokeStyle = '#ffffff'; c.lineWidth = Math.max(2.5, z * 0.06); c.lineCap = 'round';
        c.beginPath(); c.moveTo(x - z * 0.18, y - z * 0.55 + bob); c.lineTo(x, y - z * 0.32 + bob); c.lineTo(x + z * 0.18, y - z * 0.55 + bob); c.stroke();
        c.globalAlpha = 0.85; c.beginPath(); c.ellipse(x, y + z * 0.05, z * 0.26, z * 0.09, 0, 0, Math.PI * 2); c.stroke(); c.globalAlpha = 1;
      } else if (radius) {
        const pulse = 1 + Math.sin(this.time * 5) * 0.05;
        c.strokeStyle = accent; c.lineWidth = 2.5; c.setLineDash([5, 5]);
        c.beginPath(); c.arc(x, y, radius * z * pulse, 0, Math.PI * 2); c.stroke(); c.setLineDash([]);
        c.globalAlpha = 0.15; c.fillStyle = accent; c.beginPath(); c.arc(x, y, radius * z * pulse, 0, Math.PI * 2); c.fill(); c.globalAlpha = 1;
        c.fillStyle = '#ffffff'; c.beginPath(); c.arc(x, y, Math.max(2.5, z * 0.07), 0, Math.PI * 2); c.fill();
      }
    }
    if (aim.origin) {
      const [x, y] = this.toScreen(aim.origin[0], aim.origin[1]);
      const [x2, y2] = this.toScreen(aim.origin[0] + aim.dx * (0.8 + aim.power * 1.6), aim.origin[1] + aim.dy * (0.8 + aim.power * 1.6));
      c.strokeStyle = '#fff'; c.lineWidth = 3; c.beginPath(); c.moveTo(x, y); c.lineTo(x2, y2); c.stroke();
      c.fillStyle = '#fff'; c.beginPath(); c.arc(x2, y2, 5, 0, Math.PI * 2); c.fill();
    }
  }
}
