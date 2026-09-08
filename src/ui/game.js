// In-game controller: drives Match + Renderer, handles aim/touch input, camera
// gestures and the HUD.

import { PHYS, POWERUPS } from '../core/defs.js';
import { iconCanvas } from '../render/icons.js';
import { audio } from '../audio.js';

const $ = (id) => document.getElementById(id);
const SPECIAL_TYPE = (b, slot) => (slot === 's1' ? b.def.s1.id : b.def.s2.id);
const HEAVY = new Set(['siegeShell']);

export class GameController {
  constructor(canvas, renderer, cb) {
    this.canvas = canvas; this.r = renderer; this.cb = cb;
    this.match = null; this.me = null;
    this.selected = 'missile'; this.aim = null; this.locked = false; this.param = 4;
    this.pointers = new Map(); this.dragStart = null; this.dragMode = null; this.pinchDist = 0;
    this.lastPhase = null; this.lastTick = -1; this.infoBot = null; this.speed = 1;
    this.el = {
      hud: $('hud'), turn: $('turn-label'), phase: $('phase-label'), timer: $('phase-timer'), announce: $('announce'), sd: $('sd-banner'),
      center: $('center-msg'), roster: $('roster'), info: $('bot-info'), playback: $('playback-bar'), plan: $('plan-bar'), readout: $('aim-readout'),
      paramBox: $('param-box'), paramName: $('param-name'), paramBtn: $('param-btn'), fire: $('btn-fire'), vignette: $('vignette'),
      acts: { jump: $('act-jump'), missile: $('act-missile'), s1: $('act-s1'), s2: $('act-s2') },
    };
    this.centerTimer = 0;
    this._bindInput();
    for (const [k, b] of Object.entries(this.el.acts)) b.addEventListener('click', () => this.selectAction(k));
    this.el.fire.addEventListener('click', () => this.toggleLock());
    this.el.paramBtn.addEventListener('click', () => this.cycleParam());
    $('btn-skip').addEventListener('click', () => { if (this.match) this.match.skipRequested = true; });
    $('btn-speed').addEventListener('click', () => { this.speed = this.speed === 1 ? 2 : (this.speed === 2 ? 4 : 1); $('btn-speed').textContent = this.speed + '×'; if (this.match) this.match.playbackSpeed = this.speed; });
    $('btn-recenter').addEventListener('click', () => { this.r.userZoom = 1; this.r.userPan = { x: 0, y: 0 }; });
    $('btn-pause').addEventListener('click', () => this.cb.onPause && this.cb.onPause());
    this.r.onEvent = (e) => this._sound(e);
  }

  startMatch(match) {
    this.match = match;
    this.me = match.world.bots.find((b) => b.human) || null;
    this.r.setWorld(match.world);
    this.locked = false; this.aim = null; this.selected = 'missile'; this.lastPhase = null; this.infoBot = null;
    this.el.hud.classList.remove('hidden');
    this.el.info.classList.add('hidden');
    match.playbackSpeed = this.speed;
    match.onPhase = (p) => this._onPhase(p);
    match.start();
    this.showCenter('TURN 1', 1.2);
  }

  stop() { this.match = null; this.el.hud.classList.add('hidden'); }

  // ----- phases -----
  _onPhase(p) {
    const m = this.match, w = m.world;
    this.el.phase.textContent = { announce: 'ANNOUNCE', plan: 'PLAN', resolve: 'PLAYBACK', cleanup: 'CLEANUP', over: 'GAME OVER' }[p] || p.toUpperCase();
    this.el.turn.textContent = `TURN ${m.turn}${m.settings.turnCap ? ' / ' + m.settings.turnCap : ''}`;
    if (p === 'announce') {
      this.renderAnnouncements();
      this.r.fitMap();
      if (w.hazardAnnounce.some((a) => a.type === 'danger')) audio.warn();
      if (w.suddenDeath && m.announceInfo.some((a) => a.type === 'sudden')) { this.showCenter('SUDDEN DEATH', 2); audio.sudden(); }
      else if (m.turn > 1) this.showCenter(`TURN ${m.turn}`, 0.9);
    } else if (p === 'plan') {
      this.locked = false;
      this.el.playback.classList.add('hidden');
      if (this.me && this.me.alive) {
        this.el.plan.classList.remove('hidden');
        const avail = w.availableActions(this.me);
        if (!avail[this.selected]) this.selected = avail.missile ? 'missile' : (avail.jump ? 'jump' : 'missile');
        if (this.aim) this._submit(false);
        this.r.fitForPlan(this.me.x, this.me.y);
      } else {
        this.el.plan.classList.add('hidden');
        if (this.me && !this.me.alive && !this.spectMsg) { this.spectMsg = true; this.showCenter('ELIMINATED · SPECTATING', 2); }
      }
      this.updateActionBar();
    } else if (p === 'resolve') {
      this.el.plan.classList.add('hidden');
      this.el.playback.classList.remove('hidden');
      this.el.announce.innerHTML = '';
      this.r.eventCursor = 0;
    } else if (p === 'cleanup') {
      this.el.playback.classList.add('hidden');
    } else if (p === 'over') {
      this.el.plan.classList.add('hidden'); this.el.playback.classList.add('hidden');
      const won = this.me && m.winner && m.winner.ids.includes(this.me.id);
      this.showCenter(m.winner.type === 'draw' ? 'DRAW' : (won ? 'VICTORY' : (this.me ? 'DEFEAT' : 'GAME OVER')), 2.2);
      if (won) audio.win(); else audio.lose();
      setTimeout(() => this.cb.onOver && this.cb.onOver(m), 2300);
    }
    this.el.sd.classList.toggle('hidden', !w.suddenDeath);
    this.el.vignette.classList.toggle('on', w.suddenDeath);
  }

  renderAnnouncements() {
    const m = this.match;
    this.el.announce.innerHTML = '';
    for (const a of m.announceInfo) {
      const d = document.createElement('div');
      d.className = 'ann ' + (a.type || '');
      d.textContent = a.text;
      this.el.announce.appendChild(d);
    }
  }

  showCenter(text, secs) { this.el.center.textContent = text; this.el.center.classList.remove('hidden'); this.centerTimer = secs; }

  // ----- actions -----
  selectAction(k) {
    if (!this.me || !this.match || this.match.phase !== 'plan') return;
    const avail = this.match.world.availableActions(this.me);
    if (!avail[k]) return;
    this.selected = k; this.locked = false; audio.ui();
    this.updateActionBar();
    if (this.aim) this._submit(false);
  }

  cycleParam() {
    const sp = this.me.def.s1.param;
    if (!sp) return;
    const i = sp.values.indexOf(this.param);
    this.param = sp.values[(i + 1) % sp.values.length];
    this.el.paramBtn.textContent = String(this.param);
    if (this.aim) this._submit(false);
  }

  toggleLock() {
    if (!this.me || !this.match || this.match.phase !== 'plan') return;
    if (!this.aim) { this.showCenter('DRAG TO AIM FIRST', 1); return; }
    this.locked = !this.locked; audio.ui();
    this._submit(this.locked);
    this.updateActionBar();
  }

  _submit(locked) {
    if (!this.me || !this.aim) return;
    this.match.submitAction(this.me.id, { type: this.selected, aim: { ...this.aim }, param: this.selected === 's1' && this.me.def.s1.param ? this.param : undefined, locked });
  }

  updateActionBar() {
    if (!this.me) return;
    const w = this.match.world, b = this.me, avail = w.availableActions(b);
    const names = { jump: 'Jump', missile: 'Missile', s1: b.def.s1.name, s2: b.def.s2.name };
    const cds = { jump: 0, missile: 0, s1: b.cd1, s2: b.cd2 };
    for (const [k, el] of Object.entries(this.el.acts)) {
      el.querySelector('.act-name').textContent = names[k];
      el.classList.toggle('on', this.selected === k);
      el.disabled = !avail[k];
      const cd = el.querySelector('.cd');
      let badge = cds[k] > 0 ? cds[k] : 0;
      if (w.suddenDeath && ((k === 'jump' && b.sdLast === 'jump') || (k === 'missile' && b.sdLast === 'missile'))) badge = 1;
      if (w.hasEffect(b, 'shocked') && (k === 's1' || k === 's2')) badge = '⚡';
      if (w.hasEffect(b, 'frozen') && k === 'jump') badge = '❄';
      if (w.hasEffect(b, 'rooted') && k === 'jump') badge = '⚓';
      cd.textContent = String(badge); cd.classList.toggle('hidden', !badge);
    }
    const hasParam = this.selected === 's1' && b.def.s1.param;
    this.el.paramBox.classList.toggle('hidden', !hasParam);
    if (hasParam) { this.el.paramName.textContent = b.def.s1.param.name; this.el.paramBtn.textContent = String(this.param); }
    this.el.fire.textContent = this.locked ? 'LOCKED ✓' : 'FIRE';
    this.el.fire.classList.toggle('locked', this.locked);
  }

  // ----- input -----
  _bindInput() {
    const c = this.canvas;
    c.addEventListener('pointerdown', (e) => {
      c.setPointerCapture(e.pointerId);
      this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY });
      if (this.pointers.size === 2) { const [a, b] = [...this.pointers.values()]; this.pinchDist = Math.hypot(a.x - b.x, a.y - b.y); this.dragMode = 'pinch'; return; }
      const canAim = this.match && this.match.phase === 'plan' && this.me && this.me.alive && e.button === 0;
      this.dragMode = canAim ? 'aim' : 'pan';
      this.dragStart = { x: e.clientX, y: e.clientY, moved: false };
      if (this.dragMode === 'aim') this._aimFrom(e.clientX, e.clientY, true);
    });
    c.addEventListener('pointermove', (e) => {
      const p = this.pointers.get(e.pointerId); if (!p) return;
      const dx = e.clientX - p.x, dy = e.clientY - p.y;
      p.x = e.clientX; p.y = e.clientY;
      if (this.dragMode === 'pinch' && this.pointers.size === 2) {
        const [a, b] = [...this.pointers.values()]; const d = Math.hypot(a.x - b.x, a.y - b.y);
        if (this.pinchDist > 0) this.r.userZoom = Math.max(0.6, Math.min(3, this.r.userZoom * (d / this.pinchDist)));
        this.pinchDist = d;
        const z = this.r.cam.zoom * this.r.userZoom; this.r.userPan.x -= dx / z / 2; this.r.userPan.y -= dy / z / 2;
        return;
      }
      if (!this.dragStart) return;
      if (Math.hypot(e.clientX - this.dragStart.x, e.clientY - this.dragStart.y) > 6) this.dragStart.moved = true;
      if (this.dragMode === 'aim') this._aimFrom(e.clientX, e.clientY, false);
      else if (this.dragMode === 'pan') { const z = this.r.cam.zoom * this.r.userZoom; this.r.userPan.x -= dx / z; this.r.userPan.y -= dy / z; }
    });
    const up = (e) => {
      const p = this.pointers.get(e.pointerId);
      this.pointers.delete(e.pointerId);
      if (this.dragStart && p && !this.dragStart.moved && this.dragMode !== 'pinch') this._tap(e.clientX, e.clientY);
      if (this.pointers.size === 0) { this.dragMode = null; this.dragStart = null; }
    };
    c.addEventListener('pointerup', up); c.addEventListener('pointercancel', up);
    c.addEventListener('wheel', (e) => { e.preventDefault(); this.r.userZoom = Math.max(0.6, Math.min(3, this.r.userZoom * (e.deltaY < 0 ? 1.1 : 0.9))); }, { passive: false });
    c.addEventListener('contextmenu', (e) => e.preventDefault());
    c.addEventListener('dblclick', () => { this.r.userZoom = 1; this.r.userPan = { x: 0, y: 0 }; });
  }

  // Aim = direction from the drag start point, power = drag length. Aiming anywhere on screen works.
  _aimFrom(cx, cy, first) {
    if (first) { this.aimOrigin = { x: cx, y: cy }; return; }
    const dx = cx - this.aimOrigin.x, dy = cy - this.aimOrigin.y;
    const len = Math.hypot(dx, dy);
    if (len < 4) return;
    const power = Math.max(0.15, Math.min(1, len / Math.min(220, Math.min(window.innerWidth, window.innerHeight) * 0.35)));
    this.aim = { dx: dx / len, dy: dy / len, power };
    if (this.locked) { this.locked = false; this.updateActionBar(); }
    this._submit(false);
  }

  _tap(sx, sy) {
    if (!this.match) return;
    const [wx, wy] = this.r.toWorld(sx, sy);
    const hit = this.match.world.bots.find((b) => b.alive && Math.hypot(b.x - wx, b.y - wy) < PHYS.botRadius * 1.6);
    if (hit) { this.infoBot = hit; this._infoKey = null; this.renderInfo(); audio.ui(); }
    else { this.infoBot = null; this._infoKey = null; this.el.info.classList.add('hidden'); }
  }

  renderInfo() {
    const b = this.infoBot, w = this.match.world;
    if (!b || !b.alive) { this.el.info.classList.add('hidden'); return; }
    const STATUS = { poison: 'Poisoned: 10 damage per turn', burn: 'Burning: 8 damage per turn', frozen: 'Frozen: cannot jump', rooted: 'Rooted: cannot jump', shocked: 'Shocked: specials disabled' };
    const key = `${b.id}|${b.hp}|${b.cd1}|${b.cd2}|${JSON.stringify(b.effects)}|${b.contact}|${b.contactTurns}`;
    if (this._infoKey === key) return;
    this._infoKey = key;
    const el = this.el.info;
    el.innerHTML = '';
    const head = document.createElement('div');
    head.innerHTML = `<span class="close">✕</span><b>${b.name}</b> · ${b.def.name}<br>HP ${Math.ceil(b.hp)} / ${b.maxHp} · ${b.def.weight} · ${b.def.accuracy} accuracy<br>` +
      `${b.def.s1.name}: ${b.cd1 > 0 ? b.cd1 + ' turns' : 'ready'} · ${b.def.s2.name}: ${b.cd2 > 0 ? b.cd2 + ' turns' : 'ready'}` + (w.teamsMode ? `<br>Team ${b.team + 1}` : '');
    el.appendChild(head);
    const list = document.createElement('div'); list.className = 'pu-held';
    const addRow = (id, title, desc, turns) => {
      const row = document.createElement('div'); row.className = 'pu-row';
      if (id) row.appendChild(iconCanvas(id, 34));
      const t = document.createElement('div'); t.innerHTML = `<b>${title}</b> <span class="turns">${turns}</span><br><span class="d">${desc}</span>`;
      row.appendChild(t); list.appendChild(row);
    };
    for (const [k, n] of Object.entries(b.effects)) {
      if (n <= 0) continue;
      if (POWERUPS[k]) addRow(k, POWERUPS[k].name, POWERUPS[k].desc, `${n} turn${n === 1 ? '' : 's'} left`);
      else if (STATUS[k]) addRow(null, k.charAt(0).toUpperCase() + k.slice(1), STATUS[k], `${n} turn${n === 1 ? '' : 's'} left`);
    }
    if (b.contact) addRow(b.contact, POWERUPS[b.contact].name, POWERUPS[b.contact].desc, `${b.contactTurns} turn${b.contactTurns === 1 ? '' : 's'} left`);
    if (!list.children.length) { const none = document.createElement('div'); none.className = 'd'; none.textContent = 'No power-ups or effects.'; list.appendChild(none); }
    el.appendChild(list);
    const pas = document.createElement('div'); pas.className = 'd'; pas.innerHTML = `<i>${b.def.passive}</i>`; el.appendChild(pas);
    el.classList.remove('hidden');
    el.querySelector('.close').onclick = () => { this.infoBot = null; this._infoKey = null; el.classList.add('hidden'); };
  }

  // ----- per frame -----
  update(dt) {
    const m = this.match;
    if (!m) return;
    m.update(dt);
    const w = m.world;
    // timer
    if (m.phase === 'plan') {
      const t = Math.ceil(m.phaseTime);
      this.el.timer.textContent = String(Math.max(0, t));
      this.el.timer.classList.toggle('urgent', t <= 5);
      if (t <= 5 && t !== this.lastTick && this.me && this.me.alive) { audio.tick(); }
      this.lastTick = t;
    } else if (m.phase === 'announce') { this.el.timer.textContent = ''; }
    else { this.el.timer.textContent = ''; this.el.timer.classList.remove('urgent'); }
    // camera during playback
    if (m.phase === 'resolve') {
      this.r.consumeEvents();
      const pts = [];
      for (const b of w.bots) if (b.alive) pts.push([b.x, b.y]);
      for (const p of w.projectiles) pts.push([p.x, p.y]);
      this.r.frameAction(pts);
    }
    // aim guide
    let aimInfo = null; const facing = {};
    if (m.phase === 'plan' && this.me && this.me.alive && this.aim) {
      const type = this.selected === 's1' || this.selected === 's2' ? SPECIAL_TYPE(this.me, this.selected) : this.selected;
      const pv = w.previewAction(this.me, type, this.aim, this.selected === 's1' ? this.param : undefined);
      const frac = PHYS.accuracyGuide[this.me.def.accuracy];
      const radius = type === 'missile' ? 1 : (this.me.def[this.selected]?.radius || 0);
      aimInfo = { points: pv.points, fraction: type === 'jump' || type === 'blinkStrike' ? Math.max(frac, 0.7) : frac, color: this.me.color, impact: pv.impact, radius, origin: [this.me.x, this.me.y], dx: this.aim.dx, dy: this.aim.dy, power: this.aim.power };
      facing[this.me.id] = this.aim.dx < 0 ? -1 : 1;
      const ang = Math.round(-Math.atan2(this.aim.dy, this.aim.dx) * 180 / Math.PI);
      this.el.readout.textContent = `${type} · angle ${ang}° · power ${Math.round(this.aim.power * 100)}%${this.locked ? ' · LOCKED' : ''}`;
    } else if (m.phase === 'plan') this.el.readout.textContent = this.me && this.me.alive ? 'Drag anywhere to aim' : 'Spectating';
    this.r.update(dt, { aim: aimInfo, facing, selected: this.infoBot ? this.infoBot.id : (this.me ? this.me.id : -1) });
    // roster + info
    this.renderRoster();
    if (this.infoBot) this.renderInfo();
    if (this.centerTimer > 0) { this.centerTimer -= dt; if (this.centerTimer <= 0) this.el.center.classList.add('hidden'); }
  }

  renderRoster() {
    const m = this.match, w = m.world;
    const rows = w.bots.map((b) => {
      const locked = m.phase === 'plan' && m.pendingActions[b.id] && (m.pendingActions[b.id].locked || b.isAI);
      return `<div class="ros ${b.alive ? '' : 'dead'} ${b.human ? 'me' : ''}" style="border-left-color:${b.color}"><span class="lock">${locked ? '✓' : ''}</span><span class="n">${b.name}${b.human ? ' (you)' : ''}</span><span class="bar"><i style="width:${Math.max(0, Math.min(100, b.hp / b.maxHp * 100))}%;background:${b.hp / b.maxHp > 0.5 ? '#5cff7a' : (b.hp / b.maxHp > 0.25 ? '#ffd84f' : '#ff4d4d')}"></i></span><span class="hp">${Math.ceil(b.hp)}</span></div>`;
    }).join('');
    if (rows !== this._lastRoster) { this.el.roster.innerHTML = rows; this._lastRoster = rows; }
  }

  _sound(e) {
    switch (e.type) {
      case 'explosion': audio.explosion(e.big); break;
      case 'fire': audio.fire(); break;
      case 'special': if (HEAVY.has(e.name)) audio.heavyFire(); break;
      case 'jump': audio.jump(); break;
      case 'damage': if (e.amount > 0) audio.hit(); break;
      case 'eliminated': audio.ko(); break;
      case 'pickup': audio.pickup(); break;
      case 'beam': audio.beam(); break;
      case 'blink': audio.blink(); break;
      case 'gale': audio.gale(); break;
      case 'deflector': audio.shield(); break;
      case 'airstrike': audio.airstrike(); break;
      case 'suddenDeath': audio.sudden(); break;
    }
  }
}
