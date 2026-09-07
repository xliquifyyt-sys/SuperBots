import * as THREE from '../vendor/three.module.min.js';
import { ARENA } from './config.js';

// Axis-aligned box obstacle used for collision and line-of-sight.
class Obstacle {
  constructor(x, z, w, d, h) {
    this.minX = x - w / 2; this.maxX = x + w / 2;
    this.minZ = z - d / 2; this.maxZ = z + d / 2;
    this.h = h;
    this.cx = x; this.cz = z;
  }
}

function makeFloorTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 512;
  const g = c.getContext('2d');
  g.fillStyle = '#1a1f2b';
  g.fillRect(0, 0, 512, 512);
  g.strokeStyle = '#2b3446';
  g.lineWidth = 2;
  for (let i = 0; i <= 512; i += 64) {
    g.beginPath(); g.moveTo(i, 0); g.lineTo(i, 512); g.stroke();
    g.beginPath(); g.moveTo(0, i); g.lineTo(512, i); g.stroke();
  }
  g.strokeStyle = '#3d4b66';
  g.lineWidth = 4;
  g.strokeRect(2, 2, 508, 508);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(ARENA.size / 8, ARENA.size / 8);
  tex.anisotropy = 8;
  return tex;
}

export class Arena {
  constructor(scene) {
    this.scene = scene;
    this.obstacles = [];
    this.half = ARENA.size / 2;
    this.group = new THREE.Group();
    scene.add(this.group);
    this._build();
  }

  _build() {
    const S = ARENA.size;
    // Floor
    const floorMat = new THREE.MeshStandardMaterial({ map: makeFloorTexture(), roughness: 0.85, metalness: 0.15 });
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(S, S), floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    this.group.add(floor);

    // Outer ground beyond the arena, so the camera never sees the void.
    const outer = new THREE.Mesh(
      new THREE.PlaneGeometry(S * 4, S * 4),
      new THREE.MeshStandardMaterial({ color: 0x0b0e15, roughness: 1 })
    );
    outer.rotation.x = -Math.PI / 2;
    outer.position.y = -0.05;
    this.group.add(outer);

    // Walls
    const wallMat = new THREE.MeshStandardMaterial({ color: 0x39435a, roughness: 0.7, metalness: 0.1 });
    const glowMat = new THREE.MeshStandardMaterial({ color: 0x102030, emissive: 0x1e8cff, emissiveIntensity: 1.2 });
    const H = ARENA.wallHeight, T = ARENA.wallThickness, h = S / 2;
    const walls = [
      [0, -h - T / 2, S + T * 2, T],
      [0, h + T / 2, S + T * 2, T],
      [-h - T / 2, 0, T, S],
      [h + T / 2, 0, T, S],
    ];
    for (const [x, z, w, d] of walls) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, H, d), wallMat);
      m.position.set(x, H / 2, z);
      m.castShadow = true; m.receiveShadow = true;
      this.group.add(m);
      const strip = new THREE.Mesh(new THREE.BoxGeometry(w + 0.02, 0.15, d + 0.02), glowMat);
      strip.position.set(x, H * 0.55, z);
      this.group.add(strip);
    }

    // Obstacles: symmetric layout for a fair 1v1.
    const boxMat = new THREE.MeshStandardMaterial({ color: 0x4a5876, roughness: 0.65, metalness: 0.1 });
    const pillarMat = new THREE.MeshStandardMaterial({ color: 0x5d6c8e, roughness: 0.55, metalness: 0.15 });
    const layout = [
      // x, z, w, d, h
      [0, 0, 6, 6, 3.2],              // center block
      [-14, -14, 5, 5, 2.4],
      [14, 14, 5, 5, 2.4],
      [-14, 14, 5, 5, 2.4],
      [14, -14, 5, 5, 2.4],
      [0, -20, 12, 2, 2.0],
      [0, 20, 12, 2, 2.0],
      [-20, 0, 2, 12, 2.0],
      [20, 0, 2, 12, 2.0],
      [-8, 0, 2.2, 2.2, 4.5],         // pillars
      [8, 0, 2.2, 2.2, 4.5],
      [0, -8, 2.2, 2.2, 4.5],
      [0, 8, 2.2, 2.2, 4.5],
      [-26, -26, 3, 3, 1.6],
      [26, 26, 3, 3, 1.6],
      [-26, 26, 3, 3, 1.6],
      [26, -26, 3, 3, 1.6],
    ];
    for (const [x, z, w, d, hh] of layout) {
      const isPillar = w < 3 && d < 3 && hh > 4;
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, hh, d), isPillar ? pillarMat : boxMat);
      m.position.set(x, hh / 2, z);
      m.castShadow = true; m.receiveShadow = true;
      this.group.add(m);
      if (isPillar) {
        const cap = new THREE.Mesh(new THREE.BoxGeometry(w + 0.3, 0.2, d + 0.3), glowMat);
        cap.position.set(x, hh + 0.1, z);
        this.group.add(cap);
      }
      this.obstacles.push(new Obstacle(x, z, w, d, hh));
    }

    // Spawn points and pickup points
    this.spawns = [new THREE.Vector3(-26, 0, -8), new THREE.Vector3(26, 0, 8)];
    this.pickupPoints = [
      { pos: new THREE.Vector3(-26, 0, 26), type: 'health' },
      { pos: new THREE.Vector3(26, 0, -26), type: 'health' },
      { pos: new THREE.Vector3(0, 0, -27), type: 'energy' },
      { pos: new THREE.Vector3(0, 0, 27), type: 'energy' },
      { pos: new THREE.Vector3(-27, 0, 0), type: 'energy' },
      { pos: new THREE.Vector3(27, 0, 0), type: 'energy' },
    ];
  }

  // Keep a circle inside the arena and out of obstacles. Mutates pos, returns true if a collision happened.
  resolveCircle(pos, radius) {
    let hit = false;
    const lim = this.half - radius;
    if (pos.x < -lim) { pos.x = -lim; hit = true; }
    if (pos.x > lim) { pos.x = lim; hit = true; }
    if (pos.z < -lim) { pos.z = -lim; hit = true; }
    if (pos.z > lim) { pos.z = lim; hit = true; }
    for (const o of this.obstacles) {
      const cx = Math.max(o.minX, Math.min(pos.x, o.maxX));
      const cz = Math.max(o.minZ, Math.min(pos.z, o.maxZ));
      let dx = pos.x - cx, dz = pos.z - cz;
      const d2 = dx * dx + dz * dz;
      if (d2 < radius * radius) {
        hit = true;
        if (d2 < 1e-8) {
          // Center inside the box: push out along the smallest penetration axis.
          const pl = pos.x - o.minX, pr = o.maxX - pos.x, pt = pos.z - o.minZ, pb = o.maxZ - pos.z;
          const m = Math.min(pl, pr, pt, pb);
          if (m === pl) pos.x = o.minX - radius;
          else if (m === pr) pos.x = o.maxX + radius;
          else if (m === pt) pos.z = o.minZ - radius;
          else pos.z = o.maxZ + radius;
        } else {
          const d = Math.sqrt(d2);
          dx /= d; dz /= d;
          pos.x = cx + dx * radius;
          pos.z = cz + dz * radius;
        }
      }
    }
    return hit;
  }

  pointInObstacle(x, z, pad = 0) {
    for (const o of this.obstacles) {
      if (x > o.minX - pad && x < o.maxX + pad && z > o.minZ - pad && z < o.maxZ + pad) return true;
    }
    return false;
  }

  // Segment vs AABB (2D, ignoring height unless y provided). Returns t in [0,1] of first hit or -1.
  segmentHit(ax, az, bx, bz, y = 1) {
    let best = -1;
    const dx = bx - ax, dz = bz - az;
    for (const o of this.obstacles) {
      if (y > o.h) continue;
      let tmin = 0, tmax = 1;
      // X slab
      if (Math.abs(dx) < 1e-9) {
        if (ax < o.minX || ax > o.maxX) continue;
      } else {
        let t1 = (o.minX - ax) / dx, t2 = (o.maxX - ax) / dx;
        if (t1 > t2) [t1, t2] = [t2, t1];
        tmin = Math.max(tmin, t1); tmax = Math.min(tmax, t2);
        if (tmin > tmax) continue;
      }
      // Z slab
      if (Math.abs(dz) < 1e-9) {
        if (az < o.minZ || az > o.maxZ) continue;
      } else {
        let t1 = (o.minZ - az) / dz, t2 = (o.maxZ - az) / dz;
        if (t1 > t2) [t1, t2] = [t2, t1];
        tmin = Math.max(tmin, t1); tmax = Math.min(tmax, t2);
        if (tmin > tmax) continue;
      }
      if (best < 0 || tmin < best) best = tmin;
    }
    // Arena walls
    const h = this.half;
    const wallT = [];
    if (dx > 0) wallT.push((h - ax) / dx); else if (dx < 0) wallT.push((-h - ax) / dx);
    if (dz > 0) wallT.push((h - az) / dz); else if (dz < 0) wallT.push((-h - az) / dz);
    for (const t of wallT) if (t >= 0 && t <= 1 && (best < 0 || t < best)) best = t;
    return best;
  }

  hasLineOfSight(a, b) {
    return this.segmentHit(a.x, a.z, b.x, b.z, 1.2) < 0;
  }

  randomFreePoint(margin = 4) {
    for (let i = 0; i < 50; i++) {
      const x = (Math.random() * 2 - 1) * (this.half - margin);
      const z = (Math.random() * 2 - 1) * (this.half - margin);
      if (!this.pointInObstacle(x, z, 2)) return new THREE.Vector3(x, 0, z);
    }
    return new THREE.Vector3(0, 0, -25);
  }
}
