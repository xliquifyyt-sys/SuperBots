// DOM-based heads-up display, damage feed, and minimap.
import { ARENA } from './config.js';

const $ = (id) => document.getElementById(id);

export class HUD {
  constructor() {
    this.el = {
      root: $('hud'),
      pHp: $('p-hp'), pHpText: $('p-hp-text'), pEnergy: $('p-energy'), pName: $('p-name'),
      eHp: $('e-hp'), eHpText: $('e-hp-text'), eName: $('e-name'),
      pAb: $('p-ab'), pSp: $('p-sp'), pAbKey: $('p-ab-key'), pSpKey: $('p-sp-key'),
      pAbCd: $('p-ab-cd'), pSpCd: $('p-sp-cd'), pAbName: $('p-ab-name'), pSpName: $('p-sp-name'),
      timer: $('timer'), scoreP: $('score-p'), scoreE: $('score-e'),
      center: $('center-msg'), feed: $('feed'), crosshair: $('crosshair'),
      status: $('status-line'), hitmark: $('hitmarker'), damageVignette: $('damage-vignette'),
      minimap: $('minimap'),
    };
    this.mm = this.el.minimap.getContext('2d');
    this.feedItems = [];
    this.hitmarkTimer = 0;
    this.vignette = 0;
    this.centerTimer = 0;
  }

  show(v) { this.el.root.classList.toggle('hidden', !v); }

  setNames(p, e) { this.el.pName.textContent = p; this.el.eName.textContent = e; }

  setScore(p, e) { this.el.scoreP.textContent = p; this.el.scoreE.textContent = e; }

  setTimer(sec) {
    const s = Math.max(0, Math.ceil(sec));
    this.el.timer.textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
    this.el.timer.classList.toggle('urgent', s <= 10);
  }

  centerMessage(text, ms = 1500, cls = '') {
    const c = this.el.center;
    c.textContent = text;
    c.className = 'center-msg ' + cls;
    c.classList.remove('hidden');
    this.centerTimer = ms / 1000;
  }

  feed(text, cls = '') {
    const d = document.createElement('div');
    d.className = 'feed-item ' + cls;
    d.textContent = text;
    this.el.feed.prepend(d);
    this.feedItems.push({ el: d, t: 3.2 });
    while (this.feedItems.length > 5) { const it = this.feedItems.shift(); it.el.remove(); }
  }

  hitmarker() { this.hitmarkTimer = 0.12; }
  damageFlash(strength = 0.6) { this.vignette = Math.min(1, this.vignette + strength); }

  update(dt, player, enemy, roundTime, player2Info) {
    const e = this.el;
    // Bars
    e.pHp.style.width = `${(player.hp / player.maxHp) * 100}%`;
    e.pHpText.textContent = `${Math.ceil(player.hp)} / ${player.maxHp}`;
    e.pEnergy.style.width = `${(player.energy / player.maxEnergy) * 100}%`;
    e.eHp.style.width = `${(enemy.hp / enemy.maxHp) * 100}%`;
    e.eHpText.textContent = `${Math.ceil(enemy.hp)}`;
    e.pHp.classList.toggle('low', player.hp / player.maxHp < 0.3);

    // Abilities
    const ab = player.cls.ability, sp = player.cls.special;
    e.pAbName.textContent = ab.name;
    e.pSpName.textContent = sp.name;
    const abReady = player.abilityCooldown <= 0 && player.energy >= ab.cost;
    const spReady = player.specialCooldown <= 0 && player.energy >= sp.cost;
    e.pAb.classList.toggle('ready', abReady);
    e.pSp.classList.toggle('ready', spReady);
    e.pAb.classList.toggle('noenergy', player.abilityCooldown <= 0 && player.energy < ab.cost);
    e.pSp.classList.toggle('noenergy', player.specialCooldown <= 0 && player.energy < sp.cost);
    e.pAbCd.style.height = `${(player.abilityCooldown / ab.cooldown) * 100}%`;
    e.pSpCd.style.height = `${(player.specialCooldown / sp.cooldown) * 100}%`;

    // Status line
    const st = [];
    if (player.overdriveTimer > 0) st.push(`OVERDRIVE ${player.overdriveTimer.toFixed(1)}s`);
    if (player.shielded) st.push(`BARRIER ${player.shieldTimer.toFixed(1)}s`);
    if (player.stunned) st.push('STUNNED');
    if (enemy.stunned) st.push('ENEMY STUNNED');
    if (enemy.shielded) st.push('ENEMY SHIELDED');
    e.status.textContent = st.join('   ');

    this.setTimer(roundTime);

    // Hitmarker & vignette
    this.hitmarkTimer -= dt;
    e.hitmark.classList.toggle('show', this.hitmarkTimer > 0);
    this.vignette = Math.max(0, this.vignette - dt * 1.8);
    e.damageVignette.style.opacity = this.vignette.toFixed(2);

    // Center message fade
    if (this.centerTimer > 0) {
      this.centerTimer -= dt;
      if (this.centerTimer <= 0) e.center.classList.add('hidden');
    }

    // Feed aging
    for (let i = this.feedItems.length - 1; i >= 0; i--) {
      const it = this.feedItems[i];
      it.t -= dt;
      if (it.t < 0.6) it.el.style.opacity = Math.max(0, it.t / 0.6);
      if (it.t <= 0) { it.el.remove(); this.feedItems.splice(i, 1); }
    }

    this.drawMinimap(player, enemy, player2Info);
  }

  drawMinimap(player, enemy, info) {
    const c = this.mm, W = this.el.minimap.width, H = this.el.minimap.height;
    const half = ARENA.size / 2;
    const sx = (x) => ((x + half) / ARENA.size) * W;
    const sz = (z) => ((z + half) / ARENA.size) * H;
    c.clearRect(0, 0, W, H);
    c.fillStyle = 'rgba(10,14,22,0.75)';
    c.fillRect(0, 0, W, H);
    c.strokeStyle = '#3d4b66'; c.lineWidth = 2;
    c.strokeRect(1, 1, W - 2, H - 2);
    // obstacles
    c.fillStyle = '#4d5a78';
    for (const o of info.obstacles) {
      c.fillRect(sx(o.minX), sz(o.minZ), (o.maxX - o.minX) / ARENA.size * W, (o.maxZ - o.minZ) / ARENA.size * H);
    }
    // pickups
    for (const p of info.pickups) {
      if (!p.active) continue;
      c.fillStyle = p.type === 'health' ? '#5cff7a' : '#ffd84f';
      c.beginPath(); c.arc(sx(p.pos.x), sz(p.pos.z), 3, 0, Math.PI * 2); c.fill();
    }
    // enemy (only if visible or recently seen)
    if (enemy.alive && info.enemyVisible) {
      c.fillStyle = '#ff4d4d';
      c.beginPath(); c.arc(sx(enemy.pos.x), sz(enemy.pos.z), 4.5, 0, Math.PI * 2); c.fill();
    }
    // player with heading
    if (player.alive) {
      const px = sx(player.pos.x), pz = sz(player.pos.z);
      c.fillStyle = '#5ff2ff';
      c.beginPath(); c.arc(px, pz, 4.5, 0, Math.PI * 2); c.fill();
      c.strokeStyle = '#5ff2ff'; c.lineWidth = 2;
      c.beginPath(); c.moveTo(px, pz); c.lineTo(px + Math.sin(player.yaw) * 10, pz + Math.cos(player.yaw) * 10); c.stroke();
    }
  }
}
