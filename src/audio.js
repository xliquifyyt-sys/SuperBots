// Procedural WebAudio sound effects. No audio files required.
class AudioEngine {
  constructor() { this.ctx = null; this.master = null; this.volume = 0.7; this.muted = false; }
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
  _env(g, t, a, d, peak) { g.gain.cancelScheduledValues(t); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + d); }
  osc(type, f, dur, o = {}) {
    if (!this.ctx) return; const t = this.now() + (o.delay || 0);
    const s = this.ctx.createOscillator(), g = this.ctx.createGain();
    s.type = type; s.frequency.setValueAtTime(f, t);
    if (o.to) s.frequency.exponentialRampToValueAtTime(Math.max(20, o.to), t + dur);
    this._env(g, t, o.a ?? 0.005, dur, o.gain ?? 0.25);
    s.connect(g); g.connect(this.master); s.start(t); s.stop(t + dur + 0.05);
  }
  noise(dur, o = {}) {
    if (!this.ctx) return; const t = this.now() + (o.delay || 0);
    const len = Math.floor(this.ctx.sampleRate * dur), buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const src = this.ctx.createBufferSource(); src.buffer = buf;
    const f = this.ctx.createBiquadFilter(); f.type = o.filter || 'lowpass'; f.frequency.setValueAtTime(o.freq || 1000, t);
    if (o.to) f.frequency.exponentialRampToValueAtTime(o.to, t + dur);
    const g = this.ctx.createGain(); this._env(g, t, o.a ?? 0.005, dur, o.gain ?? 0.3);
    src.connect(f); f.connect(g); g.connect(this.master); src.start(t); src.stop(t + dur + 0.05);
  }
  // --- game sounds ---
  fire() { this.osc('square', 520, 0.12, { to: 180, gain: 0.15 }); this.noise(0.1, { filter: 'highpass', freq: 2500, gain: 0.1 }); }
  heavyFire() { this.osc('square', 140, 0.3, { to: 50, gain: 0.3 }); this.noise(0.3, { freq: 900, to: 200, gain: 0.3 }); }
  explosion(big) { this.noise(big ? 0.9 : 0.5, { freq: 1500, to: 80, gain: big ? 0.7 : 0.45 }); this.osc('sine', big ? 80 : 120, big ? 0.7 : 0.4, { to: 25, gain: 0.5 }); }
  jump() { this.osc('sine', 260, 0.18, { to: 620, gain: 0.18 }); }
  hit() { this.osc('triangle', 330, 0.12, { to: 110, gain: 0.25 }); }
  ko() { this.noise(1.1, { freq: 1800, to: 60, gain: 0.7 }); this.osc('sawtooth', 220, 0.6, { to: 40, gain: 0.3 }); }
  pickup() { this.osc('sine', 660, 0.1, { gain: 0.22 }); this.osc('sine', 990, 0.16, { gain: 0.22, delay: 0.09 }); }
  beam() { this.osc('sawtooth', 1800, 0.35, { to: 300, gain: 0.22 }); this.noise(0.2, { filter: 'highpass', freq: 3000, gain: 0.15 }); }
  blink() { this.noise(0.25, { filter: 'bandpass', freq: 600, to: 4000, gain: 0.25 }); this.osc('sine', 300, 0.25, { to: 1400, gain: 0.18 }); }
  gale() { this.noise(0.6, { filter: 'bandpass', freq: 400, to: 1600, gain: 0.35 }); }
  shield() { this.osc('sine', 400, 0.4, { to: 900, gain: 0.2 }); }
  tick() { this.osc('sine', 880, 0.05, { gain: 0.12 }); }
  ui() { this.osc('sine', 520, 0.06, { gain: 0.12 }); }
  warn() { this.osc('square', 330, 0.15, { gain: 0.15 }); this.osc('square', 330, 0.15, { gain: 0.15, delay: 0.2 }); }
  sudden() { this.osc('sawtooth', 110, 0.8, { to: 55, gain: 0.35 }); this.osc('sawtooth', 165, 0.8, { to: 82, gain: 0.25 }); }
  win() { [523, 659, 784, 1047].forEach((f, i) => this.osc('triangle', f, 0.35, { gain: 0.25, delay: i * 0.13 })); }
  lose() { [392, 349, 311, 262].forEach((f, i) => this.osc('sawtooth', f, 0.4, { gain: 0.18, delay: i * 0.2 })); }
  airstrike() { this.osc('sawtooth', 900, 1.2, { to: 200, gain: 0.15 }); }
}
export const audio = new AudioEngine();
