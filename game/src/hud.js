// Cloudrunner — HUD. One job: keep the instruments honest. Every number
// on screen comes from the flight model each frame; nothing here invents
// a value. The attitude ball, the throttle and fuel bars and the banner
// are the only dressing, and they read straight off the same state.

import { FUEL } from './config.js';

export class Hud {
  constructor() {
    this.el = {};
    this.quiet = false; // set in screenshot poses so no toast ever shows
    for (const id of ['alt-val', 'spd-val', 'hdg-val', 'score-val', 'rings-val', 'time-val', 'mode-val', 'obj-val', 'thr-fill', 'fuel-fill', 'horizon', 'banner-title', 'banner-sub', 'banner-hint', 'toast']) {
      this.el[id] = document.getElementById(id);
    }
    this._toastTimer = null;
  }

  setMission(mission) {
    this.el['mode-val'].textContent = mission.title;
    this.el['obj-val'].textContent = mission.objective;
  }

  // state: {altFt, knots, headingDeg, throttle, fuel, score, ringsPassed, ringsTotal, timeSec, pitch, roll}
  update(s) {
    this.el['alt-val'].textContent = Math.max(0, s.altFt).toLocaleString('en-US');
    this.el['spd-val'].textContent = Math.max(0, s.knots);
    this.el['hdg-val'].textContent = String(Math.round(s.headingDeg)).padStart(3, '0') + '°';
    this.el['score-val'].textContent = s.score.toLocaleString('en-US');
    this.el['rings-val'].textContent = s.ringsPassed + ' / ' + s.ringsTotal;
    const m = Math.floor(s.timeSec / 60);
    const sec = Math.floor(s.timeSec % 60);
    this.el['time-val'].textContent = m + ':' + String(sec).padStart(2, '0');
    this.el['thr-fill'].style.width = Math.round(s.throttle * 100) + '%';
    const fuel = this.el['fuel-fill'];
    fuel.style.width = Math.max(0, Math.round(s.fuel)) + '%';
    fuel.classList.toggle('low', s.fuel < FUEL.lowWarn);
    // Attitude ball: horizon slides with pitch, tilts with roll.
    const h = this.el['horizon'];
    const pitchPx = Math.max(-28, Math.min(28, -s.pitch * 48));
    h.style.top = (30 + pitchPx) + 'px';
    h.style.transform = 'rotate(' + (-s.roll * 57.3 * 0.9) + 'deg)';
  }

  banner(title, sub, hint) {
    this.el['banner-title'].textContent = title || '';
    this.el['banner-sub'].textContent = sub || '';
    this.el['banner-hint'].innerHTML = hint || '';
  }

  clearBanner() {
    this.banner('', '', '');
  }

  toast(text, ms) {
    if (this.quiet) return; // screenshot poses stay clean
    const t = this.el['toast'];
    t.textContent = text;
    t.style.opacity = '1';
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => { t.style.opacity = '0'; }, ms || 1800);
  }
}
