import * as THREE from '../vendor/three.module.min.js';

// Pooled point-sprite particle system for sparks, smoke and explosions.
export class Particles {
  constructor(scene, max = 3000) {
    this.max = max;
    this.count = 0;
    this.pos = new Float32Array(max * 3);
    this.col = new Float32Array(max * 3);
    this.vel = new Float32Array(max * 3);
    this.life = new Float32Array(max);
    this.maxLife = new Float32Array(max);
    this.size = new Float32Array(max);
    this.gravity = new Float32Array(max);

    const geo = new THREE.BufferGeometry();
    this.posAttr = new THREE.BufferAttribute(this.pos, 3);
    this.colAttr = new THREE.BufferAttribute(this.col, 3);
    this.sizeAttr = new THREE.BufferAttribute(this.size, 1);
    geo.setAttribute('position', this.posAttr);
    geo.setAttribute('color', this.colAttr);
    geo.setAttribute('aSize', this.sizeAttr);
    geo.setDrawRange(0, 0);

    const mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexColors: true,
      uniforms: { uScale: { value: window.innerHeight / 2 } },
      vertexShader: `
        attribute float aSize;
        varying vec3 vColor;
        uniform float uScale;
        void main() {
          vColor = color;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = aSize * uScale / -mv.z;
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: `
        varying vec3 vColor;
        void main() {
          vec2 uv = gl_PointCoord - 0.5;
          float d = length(uv);
          if (d > 0.5) discard;
          float a = smoothstep(0.5, 0.0, d);
          gl_FragColor = vec4(vColor, a);
        }`,
    });
    this.mat = mat;
    this.points = new THREE.Points(geo, mat);
    this.points.frustumCulled = false;
    scene.add(this.points);
    this._c = new THREE.Color();
  }

  resize(h) { this.mat.uniforms.uScale.value = h / 2; }

  emit(x, y, z, opts = {}) {
    const n = opts.count ?? 10;
    const speed = opts.speed ?? 6;
    const spread = opts.spread ?? 1;
    const life = opts.life ?? 0.6;
    const size = opts.size ?? 0.5;
    const grav = opts.gravity ?? 0;
    this._c.set(opts.color ?? 0xffffff);
    const dir = opts.dir;
    for (let k = 0; k < n; k++) {
      if (this.count >= this.max) return;
      const i = this.count++;
      const i3 = i * 3;
      this.pos[i3] = x; this.pos[i3 + 1] = y; this.pos[i3 + 2] = z;
      let vx = (Math.random() * 2 - 1), vy = (Math.random() * 2 - 1), vz = (Math.random() * 2 - 1);
      const l = Math.hypot(vx, vy, vz) || 1;
      vx /= l; vy /= l; vz /= l;
      if (dir) {
        vx = dir.x + vx * spread; vy = dir.y + vy * spread; vz = dir.z + vz * spread;
      }
      const s = speed * (0.4 + Math.random() * 0.8);
      this.vel[i3] = vx * s; this.vel[i3 + 1] = vy * s; this.vel[i3 + 2] = vz * s;
      const lt = life * (0.6 + Math.random() * 0.8);
      this.life[i] = lt; this.maxLife[i] = lt;
      this.size[i] = size * (0.6 + Math.random() * 0.8);
      this.gravity[i] = grav;
      const v = 0.7 + Math.random() * 0.5;
      this.col[i3] = this._c.r * v; this.col[i3 + 1] = this._c.g * v; this.col[i3 + 2] = this._c.b * v;
    }
  }

  update(dt) {
    let i = 0;
    while (i < this.count) {
      this.life[i] -= dt;
      if (this.life[i] <= 0) {
        // swap with last
        const last = this.count - 1;
        if (i !== last) {
          const a = i * 3, b = last * 3;
          for (let k = 0; k < 3; k++) {
            this.pos[a + k] = this.pos[b + k];
            this.vel[a + k] = this.vel[b + k];
            this.col[a + k] = this.col[b + k];
          }
          this.life[i] = this.life[last]; this.maxLife[i] = this.maxLife[last];
          this.size[i] = this.size[last]; this.gravity[i] = this.gravity[last];
        }
        this.count--;
        continue;
      }
      const i3 = i * 3;
      this.vel[i3 + 1] -= this.gravity[i] * dt;
      this.pos[i3] += this.vel[i3] * dt;
      this.pos[i3 + 1] += this.vel[i3 + 1] * dt;
      this.pos[i3 + 2] += this.vel[i3 + 2] * dt;
      if (this.pos[i3 + 1] < 0.05) { this.pos[i3 + 1] = 0.05; this.vel[i3 + 1] *= -0.3; }
      const f = this.life[i] / this.maxLife[i];
      const drag = 1 - dt * 2.5;
      this.vel[i3] *= drag; this.vel[i3 + 2] *= drag;
      this.size[i] *= 1 - dt * 0.6;
      this.col[i3] *= (0.985 + f * 0.015);
      i++;
    }
    this.posAttr.needsUpdate = true;
    this.colAttr.needsUpdate = true;
    this.sizeAttr.needsUpdate = true;
    this.points.geometry.setDrawRange(0, this.count);
  }

  clear() { this.count = 0; this.points.geometry.setDrawRange(0, 0); }
}
