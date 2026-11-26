// Cloudrunner — audio. One job: every sound the game makes, synthesised
// live with WebAudio. No audio files, no network: an engine drone that
// follows the throttle, wind that follows speed, and one-shot chimes for
// rings, landings and crashes. Starts on the first user gesture.

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this._engine = null;
    this._wind = null;
    this._windGain = null;
    this._started = false;
  }

  // Call from a user gesture (click / keypress) so the browser allows sound.
  ensure() {
    if (this._started) {
      if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AC();
      this._started = true;
      this._buildEngine();
      this._buildWind();
    } catch (e) {
      this.ctx = null; // sound is a garnish; a silent game still flies
    }
  }

  _buildEngine() {
    const ctx = this.ctx;
    // A low sawtooth drone through a low-pass filter: the propeller.
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.value = 62;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 420;
    const gain = ctx.createGain();
    gain.gain.value = 0.0;
    osc.connect(filter).connect(gain).connect(ctx.destination);
    osc.start();
    this._engine = { osc, filter, gain };
  }

  _buildWind() {
    const ctx = this.ctx;
    // Looped noise buffer through a band-pass: airflow over the canopy.
    const len = ctx.sampleRate * 2;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 700;
    filter.Q.value = 0.6;
    const gain = ctx.createGain();
    gain.gain.value = 0.0;
    src.connect(filter).connect(gain).connect(ctx.destination);
    src.start();
    this._wind = { filter, gain };
  }

  // throttle 0..1, speed m/s, onGround. Called every frame.
  update(throttle, speed, onGround) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    if (this._engine) {
      const g = onGround ? 0.02 : 0.03 + throttle * 0.05;
      this._engine.gain.gain.setTargetAtTime(g, t, 0.15);
      this._engine.osc.frequency.setTargetAtTime(52 + throttle * 68, t, 0.12);
      this._engine.filter.frequency.setTargetAtTime(320 + throttle * 700, t, 0.15);
    }
    if (this._wind) {
      const w = onGround ? 0 : Math.min(0.09, (speed / 92) * 0.09);
      this._wind.gain.gain.setTargetAtTime(w, t, 0.2);
      this._wind.filter.frequency.setTargetAtTime(500 + speed * 9, t, 0.2);
    }
  }

  _tone(freq, dur, type, vol, when) {
    if (!this.ctx || this.muted) return;
    const ctx = this.ctx;
    const o = ctx.createOscillator();
    o.type = type || 'sine';
    o.frequency.value = freq;
    const g = ctx.createGain();
    const t0 = ctx.currentTime + (when || 0);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol || 0.18, t0 + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g).connect(ctx.destination);
    o.start(t0);
    o.stop(t0 + dur + 0.05);
  }

  ring() { this._tone(880, 0.28, 'sine', 0.22); this._tone(1318, 0.34, 'sine', 0.16, 0.07); }
  miss() { this._tone(220, 0.3, 'triangle', 0.1); }
  land() { this._tone(392, 0.4, 'sine', 0.2); this._tone(523, 0.5, 'sine', 0.16, 0.1); }
  crash() {
    if (!this.ctx || this.muted) return;
    const ctx = this.ctx;
    const len = ctx.sampleRate * 0.5;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.value = 900;
    const g = ctx.createGain();
    g.gain.value = 0.4;
    src.connect(f).connect(g).connect(ctx.destination);
    src.start();
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.ctx && this._engine) {
      this._engine.gain.gain.setTargetAtTime(this.muted ? 0 : 0.03, this.ctx.currentTime, 0.05);
      this._wind.gain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.05);
    }
    return this.muted;
  }
}
