// Cloudrunner — input. One job: turn keyboard, mouse and touch into a
// single clean control state the flight model reads every frame.
// Keyboard: arrows or WASD pitch/roll, Shift/Ctrl or W/S throttle,
// Space airbrake, P pause, R restart, M mute. Mouse: hold and drag to steer.

export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = new Set();
    this.pitch = 0;       // -1 (nose down) .. +1 (nose up), from keys/mouse
    this.roll = 0;        // -1 (left) .. +1 (right)
    this.throttleDelta = 0;
    this.brake = false;
    this.mouseSteer = false;
    this.mouseX = 0;
    this.mouseY = 0;
    this.pressed = new Set(); // one-shot keys consumed by the game loop
    this._onKeyDown = (e) => this._key(e, true);
    this._onKeyUp = (e) => this._key(e, false);
    this._onMouseDown = (e) => { if (e.button === 0) { this.mouseSteer = true; this._mouse(e); } };
    this._onMouseUp = () => { this.mouseSteer = false; this.mouseX = 0; this.mouseY = 0; };
    this._onMouseMove = (e) => { if (this.mouseSteer) this._mouse(e); };
    this._onBlur = () => { this.keys.clear(); this.mouseSteer = false; this.pitch = 0; this.roll = 0; };
    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);
    canvas.addEventListener('mousedown', this._onMouseDown);
    window.addEventListener('mouseup', this._onMouseUp);
    window.addEventListener('mousemove', this._onMouseMove);
    window.addEventListener('blur', this._onBlur);
    canvas.addEventListener('touchstart', (e) => { e.preventDefault(); const t = e.touches[0]; this.mouseSteer = true; this._touch(t); }, { passive: false });
    canvas.addEventListener('touchmove', (e) => { e.preventDefault(); if (this.mouseSteer) this._touch(e.touches[0]); }, { passive: false });
    canvas.addEventListener('touchend', () => { this.mouseSteer = false; this.mouseX = 0; this.mouseY = 0; });
  }

  _key(e, down) {
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    const gameKeys = ['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '];
    if (gameKeys.includes(k) || (down && ['w', 'a', 's', 'd'].includes(k))) e.preventDefault();
    if (down) {
      if (!this.keys.has(k)) this.pressed.add(k);
      this.keys.add(k);
    } else {
      this.keys.delete(k);
    }
  }

  _mouse(e) {
    const r = this.canvas.getBoundingClientRect();
    this.mouseX = ((e.clientX - r.left) / r.width) * 2 - 1;
    this.mouseY = ((e.clientY - r.top) / r.height) * 2 - 1;
  }

  _touch(t) {
    const r = this.canvas.getBoundingClientRect();
    this.mouseX = ((t.clientX - r.left) / r.width) * 2 - 1;
    this.mouseY = ((t.clientY - r.top) / r.height) * 2 - 1;
  }

  wasPressed(key) {
    const k = key.length === 1 ? key.toLowerCase() : key;
    if (this.pressed.has(k)) { this.pressed.delete(k); return true; }
    return false;
  }

  endFrame() { this.pressed.clear(); }

  // Read the current control axes. Mouse steering blends with the keys.
  update() {
    const k = this.keys;
    let pitch = 0;
    let roll = 0;
    if (k.has('arrowup') || k.has('w')) pitch += 1;
    if (k.has('arrowdown') || k.has('s')) pitch -= 1;
    if (k.has('arrowleft') || k.has('a')) roll -= 1;
    if (k.has('arrowright') || k.has('d')) roll += 1;
    if (this.mouseSteer) {
      roll += this.mouseX * 1.4;
      pitch -= this.mouseY * 1.2;
    }
    this.pitch = Math.max(-1, Math.min(1, pitch));
    this.roll = Math.max(-1, Math.min(1, roll));
    let td = 0;
    if (k.has('shift')) td += 1;
    if (k.has('control')) td -= 1;
    this.throttleDelta = td;
    this.brake = k.has(' ');
  }

  dispose() {
    window.removeEventListener('keydown', this._onKeyDown);
    window.removeEventListener('keyup', this._onKeyUp);
    this.canvas.removeEventListener('mousedown', this._onMouseDown);
    window.removeEventListener('mouseup', this._onMouseUp);
    window.removeEventListener('mousemove', this._onMouseMove);
    window.removeEventListener('blur', this._onBlur);
  }
}
