// Tiny procedural sound engine built on WebAudio. No asset files needed.

class AudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.volume = 0.7;
    this.enabled = true;
    this.musicNodes = null;
  }

  init() {
    if (this.ctx) return;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) { this.enabled = false; return; }
    this.ctx = new Ctx();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.volume;
    this.master.connect(this.ctx.destination);
  }

  resume() {
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  }

  setVolume(v) {
    this.volume = v;
    if (this.master) this.master.gain.value = v;
  }

  _env(gainNode, t, attack, decay, peak = 1) {
    const g = gainNode.gain;
    g.cancelScheduledValues(t);
    g.setValueAtTime(0.0001, t);
    g.linearRampToValueAtTime(peak, t + attack);
    g.exponentialRampToValueAtTime(0.0001, t + attack + decay);
  }

  _osc(type, freq, t, dur, opts = {}) {
    if (!this.ctx || !this.enabled) return;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (opts.slideTo !== undefined) o.frequency.exponentialRampToValueAtTime(Math.max(20, opts.slideTo), t + dur);
    this._env(g, t, opts.attack ?? 0.005, dur, opts.gain ?? 0.3);
    o.connect(g);
    g.connect(opts.dest || this.master);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  _noise(t, dur, opts = {}) {
    if (!this.ctx || !this.enabled) return;
    const len = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const f = this.ctx.createBiquadFilter();
    f.type = opts.filter || 'lowpass';
    f.frequency.setValueAtTime(opts.freq || 1200, t);
    if (opts.freqTo) f.frequency.exponentialRampToValueAtTime(opts.freqTo, t + dur);
    const g = this.ctx.createGain();
    this._env(g, t, opts.attack ?? 0.005, dur, opts.gain ?? 0.4);
    src.connect(f); f.connect(g); g.connect(this.master);
    src.start(t);
    src.stop(t + dur + 0.05);
  }

  now() { return this.ctx ? this.ctx.currentTime : 0; }

  shoot(kind = 'blaster') {
    if (!this.ctx) return;
    const t = this.now();
    if (kind === 'cannon') {
      this._osc('square', 120, t, 0.25, { slideTo: 40, gain: 0.35 });
      this._noise(t, 0.3, { freq: 900, freqTo: 200, gain: 0.35 });
    } else if (kind === 'rail') {
      this._osc('sawtooth', 1800, t, 0.35, { slideTo: 200, gain: 0.25 });
      this._osc('sine', 500, t, 0.2, { slideTo: 90, gain: 0.25 });
      this._noise(t, 0.15, { filter: 'highpass', freq: 2000, gain: 0.2 });
    } else {
      this._osc('square', 880, t, 0.09, { slideTo: 300, gain: 0.18 });
      this._noise(t, 0.06, { filter: 'highpass', freq: 3000, gain: 0.12 });
    }
  }

  hit() {
    if (!this.ctx) return;
    const t = this.now();
    this._osc('triangle', 300, t, 0.12, { slideTo: 120, gain: 0.3 });
    this._noise(t, 0.08, { freq: 2500, gain: 0.2 });
  }

  shieldHit() {
    if (!this.ctx) return;
    const t = this.now();
    this._osc('sine', 1200, t, 0.15, { slideTo: 1600, gain: 0.2 });
  }

  explosion() {
    if (!this.ctx) return;
    const t = this.now();
    this._noise(t, 1.1, { freq: 1600, freqTo: 60, gain: 0.7 });
    this._osc('sine', 90, t, 0.9, { slideTo: 25, gain: 0.6 });
  }

  pickup() {
    if (!this.ctx) return;
    const t = this.now();
    this._osc('sine', 660, t, 0.1, { gain: 0.25 });
    this._osc('sine', 990, t + 0.09, 0.14, { gain: 0.25 });
  }

  ability(kind) {
    if (!this.ctx) return;
    const t = this.now();
    if (kind === 'dash' || kind === 'blink') {
      this._noise(t, 0.25, { filter: 'bandpass', freq: 800, freqTo: 3000, gain: 0.3 });
      this._osc('sine', 300, t, 0.25, { slideTo: 1200, gain: 0.2 });
    } else if (kind === 'shield') {
      this._osc('sine', 400, t, 0.4, { slideTo: 800, gain: 0.25 });
    } else if (kind === 'slam') {
      this._noise(t, 0.6, { freq: 400, freqTo: 40, gain: 0.7 });
      this._osc('sine', 70, t, 0.5, { slideTo: 30, gain: 0.6 });
    } else if (kind === 'emp') {
      this._osc('sawtooth', 200, t, 0.6, { slideTo: 2000, gain: 0.25 });
      this._osc('square', 100, t + 0.1, 0.4, { slideTo: 50, gain: 0.2 });
    } else if (kind === 'overdrive') {
      this._osc('square', 220, t, 0.15, { gain: 0.2 });
      this._osc('square', 330, t + 0.12, 0.15, { gain: 0.2 });
      this._osc('square', 440, t + 0.24, 0.3, { gain: 0.2 });
    }
  }

  ui() {
    if (!this.ctx) return;
    const t = this.now();
    this._osc('sine', 520, t, 0.06, { gain: 0.15 });
  }

  countdown(final = false) {
    if (!this.ctx) return;
    const t = this.now();
    this._osc('sine', final ? 880 : 440, t, final ? 0.5 : 0.15, { gain: 0.3 });
  }

  win() {
    if (!this.ctx) return;
    const t = this.now();
    [523, 659, 784, 1047].forEach((f, i) => this._osc('triangle', f, t + i * 0.13, 0.35, { gain: 0.3 }));
  }

  lose() {
    if (!this.ctx) return;
    const t = this.now();
    [392, 349, 311, 262].forEach((f, i) => this._osc('sawtooth', f, t + i * 0.2, 0.4, { gain: 0.2 }));
  }

  // A very simple looping two-oscillator drone as ambient music.
  startMusic() {
    if (!this.ctx || this.musicNodes) return;
    const g = this.ctx.createGain();
    g.gain.value = 0.06;
    g.connect(this.master);
    const a = this.ctx.createOscillator();
    a.type = 'sawtooth'; a.frequency.value = 55;
    const b = this.ctx.createOscillator();
    b.type = 'triangle'; b.frequency.value = 82.5;
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.value = 300;
    const lfo = this.ctx.createOscillator();
    lfo.frequency.value = 0.15;
    const lfoGain = this.ctx.createGain();
    lfoGain.gain.value = 180;
    lfo.connect(lfoGain); lfoGain.connect(f.frequency);
    a.connect(f); b.connect(f); f.connect(g);
    a.start(); b.start(); lfo.start();
    this.musicNodes = { a, b, lfo, g };
  }

  stopMusic() {
    if (!this.musicNodes) return;
    const { a, b, lfo, g } = this.musicNodes;
    g.gain.linearRampToValueAtTime(0, this.now() + 0.5);
    setTimeout(() => { try { a.stop(); b.stop(); lfo.stop(); } catch (e) { /* ignore */ } }, 600);
    this.musicNodes = null;
  }
}

export const audio = new AudioEngine();
