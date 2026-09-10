// Procedural WebAudio sound effects. No audio files required.
class AudioEngine {
  constructor() { this.ctx = null; this.master = null; this.volume = 0.7; this.muted = false; this._last = {}; }
  init() {
    if (this.ctx) return;
    const C = window.AudioContext || window.webkitAudioContext;
    if (!C) return;
    this.ctx = new C();
    this.master = this.ctx.createGain(); this.master.gain.value = this.muted ? 0 : this.volume;
    this.master.connect(this.ctx.destination);
  }
  resume() { if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); }
  setVolume(v) { this.volume = v; if (this.master) this.master.gain.value = this.muted ? 0 : v; }
  setMuted(m) { this.muted = m; if (this.master) this.master.gain.value = m ? 0 : this.volume; }
  now() { return this.ctx ? this.ctx.currentTime : 0; }
  // Rate limit: the same sound at most once per `gap` seconds, so a burst of identical
  // events (twenty bombs, six damage ticks) reads as one sound instead of a buzz.
  _gate(key, gap = 0.06) { const t = this.now(); if (this._last[key] && t - this._last[key] < gap) return false; this._last[key] = t; return true; }
  _env(g, t, a, d, peak) { g.gain.cancelScheduledValues(t); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + d); }
  osc(type, f, dur, o = {}) {
    if (!this.ctx) return; const t = this.now() + (o.delay || 0);
    const s = this.ctx.createOscillator(), g = this.ctx.createGain();
    s.type = type; s.frequency.setValueAtTime(f, t);
    if (o.to) s.frequency.exponentialRampToValueAtTime(Math.max(20, o.to), t + dur);
    if (o.vib) { const l = this.ctx.createOscillator(), lg = this.ctx.createGain(); l.frequency.value = o.vib; lg.gain.value = o.vibDepth || f * 0.05; l.connect(lg); lg.connect(s.frequency); l.start(t); l.stop(t + dur + 0.05); }
    this._env(g, t, o.a ?? 0.005, dur, o.gain ?? 0.25);
    s.connect(g); g.connect(this.master); s.start(t); s.stop(t + dur + 0.05);
  }
  noise(dur, o = {}) {
    if (!this.ctx) return; const t = this.now() + (o.delay || 0);
    const len = Math.floor(this.ctx.sampleRate * dur), buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const src = this.ctx.createBufferSource(); src.buffer = buf;
    const f = this.ctx.createBiquadFilter(); f.type = o.filter || 'lowpass'; f.frequency.setValueAtTime(o.freq || 1000, t); if (o.q) f.Q.value = o.q;
    if (o.to) f.frequency.exponentialRampToValueAtTime(o.to, t + dur);
    const g = this.ctx.createGain(); this._env(g, t, o.a ?? 0.005, dur, o.gain ?? 0.3);
    src.connect(f); f.connect(g); g.connect(this.master); src.start(t); src.stop(t + dur + 0.05);
  }

  // --- moves ---
  fire() { if (!this._gate('fire')) return; this.osc('square', 520, 0.12, { to: 180, gain: 0.15 }); this.noise(0.1, { filter: 'highpass', freq: 2500, gain: 0.1 }); }
  heavyFire() { this.osc('square', 140, 0.3, { to: 50, gain: 0.3 }); this.noise(0.3, { freq: 900, to: 200, gain: 0.3 }); }
  jump() { this.osc('sine', 260, 0.18, { to: 620, gain: 0.18 }); this.noise(0.12, { filter: 'bandpass', freq: 900, gain: 0.08 }); }
  land(hard) { if (!this._gate('land', 0.1)) return; this.noise(hard ? 0.18 : 0.1, { freq: hard ? 500 : 800, to: 120, gain: hard ? 0.3 : 0.15 }); if (hard) this.osc('sine', 90, 0.12, { to: 40, gain: 0.25 }); }
  explosion(big) { if (!this._gate('explosion', 0.04)) return; this.noise(big ? 0.9 : 0.5, { freq: 1500, to: 80, gain: big ? 0.7 : 0.45 }); this.osc('sine', big ? 80 : 120, big ? 0.7 : 0.4, { to: 25, gain: 0.5 }); }
  hit() { if (!this._gate('hit', 0.05)) return; this.osc('triangle', 330, 0.12, { to: 110, gain: 0.25 }); }
  ko() { this.noise(1.1, { freq: 1800, to: 60, gain: 0.7 }); this.osc('sawtooth', 220, 0.6, { to: 40, gain: 0.3 }); }
  pickup() { this.osc('sine', 660, 0.1, { gain: 0.22 }); this.osc('sine', 990, 0.16, { gain: 0.22, delay: 0.09 }); }
  powerupSpawn() { if (!this._gate('puspawn', 0.2)) return; this.osc('triangle', 1200, 0.25, { to: 1800, gain: 0.1 }); this.osc('triangle', 1500, 0.25, { to: 2400, gain: 0.08, delay: 0.08 }); }
  bounce() { if (!this._gate('bounce', 0.05)) return; this.osc('square', 700, 0.06, { to: 1200, gain: 0.14 }); }
  splash(kind) { if (!this._gate('splash', 0.08)) return; if (kind === 'lava') { this.noise(0.4, { freq: 600, to: 150, gain: 0.3 }); this.osc('sine', 110, 0.3, { to: 50, gain: 0.2 }); } else if (kind === 'water') { this.noise(0.35, { filter: 'bandpass', freq: 1200, to: 400, gain: 0.3, q: 2 }); } else { this.noise(0.5, { filter: 'highpass', freq: 800, to: 3000, gain: 0.12 }); } }

  // --- specials, one voice each ---
  special(name) {
    switch (name) {
      case 'Bastion Wall': this.noise(0.25, { freq: 400, to: 120, gain: 0.35 }); this.osc('square', 90, 0.3, { to: 60, gain: 0.25 }); this.osc('square', 120, 0.2, { to: 80, gain: 0.2, delay: 0.12 }); break;
      case 'Siege Shell': this.heavyFire(); break;
      case 'Molten Slam': this.osc('sawtooth', 200, 0.4, { to: 900, gain: 0.2 }); this.noise(0.3, { filter: 'bandpass', freq: 300, to: 2000, gain: 0.2 }); break;
      case 'Ember Spit': [0, 0.07, 0.14].forEach((d) => this.noise(0.12, { filter: 'bandpass', freq: 1800, to: 500, gain: 0.22, delay: d })); break;
      case 'Chain Arc': this.beam(); break;
      case 'Static Field': this.osc('sawtooth', 1200, 0.25, { to: 200, gain: 0.18, vib: 40, vibDepth: 300 }); break;
      case 'Deflector': this.shield(); break;
      case 'Anchor Bolt': this.osc('square', 300, 0.2, { to: 90, gain: 0.25 }); this.noise(0.15, { filter: 'highpass', freq: 1500, gain: 0.15 }); break;
      case 'Updraft': this.noise(0.5, { filter: 'bandpass', freq: 500, to: 3000, gain: 0.3 }); this.osc('sine', 200, 0.45, { to: 900, gain: 0.18 }); break;
      case 'Gale Shot': this.gale(); break;
      case 'Blink Strike': this.blink(); break;
      case 'Toxic Bomb': this.osc('sine', 420, 0.3, { to: 160, gain: 0.2, vib: 8 }); break;
      case 'Pinball': this.osc('square', 880, 0.08, { to: 1320, gain: 0.18 }); this.osc('square', 1320, 0.08, { to: 1760, gain: 0.14, delay: 0.07 }); break;
      case 'Split Shot': this.osc('triangle', 700, 0.12, { to: 350, gain: 0.2 }); this.noise(0.1, { filter: 'highpass', freq: 2000, gain: 0.12 }); break;
      case 'Singularity': this.osc('sine', 60, 1.2, { to: 30, gain: 0.35, vib: 3, vibDepth: 8 }); this.osc('sawtooth', 2000, 0.6, { to: 100, gain: 0.08 }); break;
      case 'Shockwave': this.noise(0.45, { freq: 2500, to: 100, gain: 0.5 }); this.osc('sine', 70, 0.5, { to: 30, gain: 0.5 }); break;
      default: this.fire();
    }
  }
  beam() { this.osc('sawtooth', 1800, 0.35, { to: 300, gain: 0.22 }); this.noise(0.2, { filter: 'highpass', freq: 3000, gain: 0.15 }); }
  blink() { this.noise(0.25, { filter: 'bandpass', freq: 600, to: 4000, gain: 0.25 }); this.osc('sine', 300, 0.25, { to: 1400, gain: 0.18 }); }
  gale() { this.noise(0.6, { filter: 'bandpass', freq: 400, to: 1600, gain: 0.35 }); }
  shield() { this.osc('sine', 400, 0.4, { to: 900, gain: 0.2 }); }
  reflect() { this.osc('triangle', 1400, 0.12, { to: 2200, gain: 0.2 }); }
  split() { if (!this._gate('split', 0.1)) return; this.osc('triangle', 900, 0.1, { to: 1800, gain: 0.16 }); }
  toxicTick() { if (!this._gate('toxic', 0.35)) return; this.noise(0.15, { filter: 'bandpass', freq: 3000, to: 1500, gain: 0.1, q: 3 }); }
  wallHit() { if (!this._gate('wallhit', 0.08)) return; this.osc('square', 220, 0.1, { to: 120, gain: 0.2 }); this.noise(0.08, { freq: 2000, gain: 0.12 }); }
  wallBreak() { this.noise(0.5, { freq: 1200, to: 200, gain: 0.4 }); this.osc('square', 160, 0.3, { to: 50, gain: 0.25 }); }
  effect(kind) {
    if (!this._gate('effect:' + kind, 0.2)) return;
    if (kind === 'burn') this.noise(0.3, { filter: 'bandpass', freq: 900, to: 400, gain: 0.15 });
    else if (kind === 'poison') this.osc('sine', 500, 0.25, { to: 250, gain: 0.12, vib: 12 });
    else if (kind === 'shocked') this.osc('square', 2000, 0.15, { to: 400, gain: 0.12, vib: 60, vibDepth: 500 });
    else if (kind === 'rooted' || kind === 'frozen') this.osc('triangle', 900, 0.2, { to: 300, gain: 0.15 });
    else this.osc('sine', 700, 0.15, { to: 1000, gain: 0.1 });
  }
  contact() { this.osc('square', 1000, 0.08, { gain: 0.15 }); this.osc('square', 1500, 0.1, { gain: 0.15, delay: 0.08 }); }

  // --- map elements ---
  mine() { this.noise(0.45, { freq: 2000, to: 120, gain: 0.5 }); this.osc('sine', 150, 0.35, { to: 40, gain: 0.4 }); }
  mineSpawn() { if (!this._gate('minespawn', 0.15)) return; this.osc('square', 1800, 0.05, { gain: 0.1 }); this.osc('square', 1800, 0.05, { gain: 0.1, delay: 0.12 }); }
  geyser() { if (!this._gate('geyser', 0.2)) return; this.noise(0.7, { filter: 'bandpass', freq: 300, to: 1800, gain: 0.4, q: 1.5 }); this.osc('sine', 80, 0.5, { to: 160, gain: 0.25 }); }
  lavaRise() { this.noise(1.2, { freq: 300, to: 120, gain: 0.35 }); this.osc('sine', 55, 1.0, { to: 40, gain: 0.3 }); }
  lavaSurf() { this.noise(0.4, { filter: 'bandpass', freq: 700, to: 2500, gain: 0.3 }); }
  patch() { if (!this._gate('patch', 0.2)) return; this.noise(0.5, { freq: 900, to: 250, gain: 0.3 }); this.osc('sawtooth', 120, 0.4, { to: 60, gain: 0.15 }); }
  crusher() { this.noise(0.6, { freq: 700, to: 90, gain: 0.55 }); this.osc('sine', 60, 0.5, { to: 30, gain: 0.5 }); }
  reactor() { this.osc('sawtooth', 200, 0.7, { to: 1600, gain: 0.2 }); this.noise(0.5, { filter: 'highpass', freq: 1500, to: 6000, gain: 0.2, delay: 0.2 }); }
  gust() { this.noise(1.4, { filter: 'bandpass', freq: 250, to: 900, gain: 0.3, q: 0.8, a: 0.3 }); }
  teleport(pad) { if (!this._gate('teleport', 0.1)) return; if (pad) { this.osc('sine', 500, 0.3, { to: 2000, gain: 0.2 }); this.noise(0.25, { filter: 'bandpass', freq: 1500, to: 5000, gain: 0.15 }); } else { this.osc('sine', 900, 0.12, { to: 600, gain: 0.12 }); } }
  singularityPull() { if (!this._gate('sing', 0.5)) return; this.osc('sine', 45, 0.6, { to: 35, gain: 0.25, vib: 4, vibDepth: 6 }); }
  airstrike() { this.osc('sawtooth', 900, 1.2, { to: 200, gain: 0.15 }); [0, 0.4, 0.8].forEach((d) => this.osc('square', 660, 0.3, { to: 440, gain: 0.12, delay: d })); }
  bombWhistle() { if (!this._gate('whistle', 0.12)) return; this.osc('sine', 2200, 0.5, { to: 700, gain: 0.08 }); }

  // --- ui / flow ---
  tick() { this.osc('sine', 880, 0.05, { gain: 0.12 }); }
  ui() { this.osc('sine', 520, 0.06, { gain: 0.12 }); }
  warn() { this.osc('square', 330, 0.15, { gain: 0.15 }); this.osc('square', 330, 0.15, { gain: 0.15, delay: 0.2 }); }
  sudden() { this.osc('sawtooth', 110, 0.8, { to: 55, gain: 0.35 }); this.osc('sawtooth', 165, 0.8, { to: 82, gain: 0.25 }); }
  win() { [523, 659, 784, 1047].forEach((f, i) => this.osc('triangle', f, 0.35, { gain: 0.25, delay: i * 0.13 })); }
  lose() { [392, 349, 311, 262].forEach((f, i) => this.osc('sawtooth', f, 0.4, { gain: 0.18, delay: i * 0.2 })); }
  battleStart() { [330, 440, 660].forEach((f, i) => this.osc('square', f, 0.18, { gain: 0.16, delay: i * 0.1 })); this.noise(0.4, { freq: 2000, to: 300, gain: 0.2, delay: 0.3 }); }
}
export const audio = new AudioEngine();
