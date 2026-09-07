// Keyboard + mouse input with pointer-lock mouse look.
export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = new Set();
    this.mouseDX = 0;
    this.mouseDY = 0;
    this.fire = false;
    this.locked = false;
    this.sensitivity = 1.0;
    this.pressed = new Set(); // keys pressed this frame (edge)
    this.onEscape = null;
    this.onLockChange = null;

    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      this.keys.add(e.code);
      this.pressed.add(e.code);
      if (e.code === 'Escape' && this.onEscape) this.onEscape();
      if (['Space', 'Tab'].includes(e.code)) e.preventDefault();
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => { this.keys.clear(); this.fire = false; });

    document.addEventListener('mousemove', (e) => {
      if (!this.locked) return;
      this.mouseDX += e.movementX;
      this.mouseDY += e.movementY;
    });
    document.addEventListener('mousedown', (e) => {
      if (!this.locked) return;
      if (e.button === 0) this.fire = true;
      if (e.button === 2) this.pressed.add('MouseRight');
      if (e.button === 1) { this.pressed.add('MouseMiddle'); e.preventDefault(); }
    });
    document.addEventListener('mouseup', (e) => { if (e.button === 0) this.fire = false; });
    document.addEventListener('contextmenu', (e) => { if (this.locked) e.preventDefault(); });
    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === this.canvas;
      if (!this.locked) { this.fire = false; this.keys.clear(); }
      if (this.onLockChange) this.onLockChange(this.locked);
    });
  }

  lock() {
    if (this.locked) return;
    try {
      const p = this.canvas.requestPointerLock({ unadjustedMovement: true });
      if (p && p.catch) p.catch(() => this.canvas.requestPointerLock());
    } catch (e) {
      try { this.canvas.requestPointerLock(); } catch (e2) { /* unsupported */ }
    }
  }

  unlock() {
    if (document.pointerLockElement) document.exitPointerLock();
  }

  down(code) { return this.keys.has(code); }
  justPressed(code) { return this.pressed.has(code); }

  // Movement axes: x = strafe (+right), y = forward (+forward)
  axes() {
    let x = 0, y = 0;
    if (this.down('KeyW') || this.down('ArrowUp')) y += 1;
    if (this.down('KeyS') || this.down('ArrowDown')) y -= 1;
    if (this.down('KeyD') || this.down('ArrowRight')) x += 1;
    if (this.down('KeyA') || this.down('ArrowLeft')) x -= 1;
    const l = Math.hypot(x, y);
    if (l > 1) { x /= l; y /= l; }
    return { x, y };
  }

  consumeMouse() {
    const dx = this.mouseDX * 0.0022 * this.sensitivity;
    const dy = this.mouseDY * 0.0022 * this.sensitivity;
    this.mouseDX = 0; this.mouseDY = 0;
    return { dx, dy };
  }

  endFrame() { this.pressed.clear(); }
}
