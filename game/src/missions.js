// Cloudrunner — missions. One job: what counts as a sortie. Each mission
// names its gates, its fuel rule and its scoring, and this file turns the
// raw events of a flight (a ring threaded, a landing, a crash) into the
// score and the win/lose call, so the main loop never does arithmetic.

import { MISSIONS, SCORING } from './config.js';

export class Mission {
  constructor(id) {
    const def = MISSIONS[id] || MISSIONS.rings;
    this.def = def;
    this.id = def.id;
    this.title = def.title;
    this.tagline = def.tagline;
    this.objective = def.objective;
    this.ringDefs = def.rings;
    this.needRings = def.needRings;
    this.ringScore = def.ringScore;
    this.landScore = def.landScore;
    this.fuelOn = def.fuelOn;
    this.score = 0;
    this.ringsPassed = 0;
    this.ringsMissed = 0;
    this.streak = 0;
    this.crashes = 0;
    this.timeSec = 0;
    this.finished = false;
    this.outcome = null; // 'landed' | 'crashed-out' | null
  }

  onRing(passed) {
    if (passed) {
      this.ringsPassed++;
      this.streak++;
      this.score += this.ringScore + (this.streak > 1 ? SCORING.ringStreakBonus * (this.streak - 1) : 0);
    } else {
      this.ringsMissed++;
      this.streak = 0;
    }
    return this.score;
  }

  onCrash() {
    this.crashes++;
    this.streak = 0;
    this.score = Math.max(0, this.score - SCORING.crashPenalty);
    return this.score;
  }

  // Landing quality: 0..1 from touchdown (centreline, gentle, slow).
  // Returns the points awarded.
  onLanding(quality) {
    const qualified = this.ringsPassed >= this.needRings;
    const pts = Math.round(this.landScore * quality * (qualified ? 1 : 0.4));
    this.score += pts;
    // Fast finish bonus on the Ring Run, capped.
    if (this.id === 'rings' && qualified) {
      const bonus = Math.max(0, Math.min(SCORING.timeBonusCap, Math.round((420 - this.timeSec) * SCORING.timeBonusPerSec)));
      this.score += bonus;
    }
    this.finished = true;
    this.outcome = 'landed';
    return pts;
  }

  onOutOfFuel() {
    this.finished = true;
    this.outcome = 'crashed-out';
  }

  statusLine() {
    if (this.id === 'landing') {
      return 'Fly the circuit, then land inside the touchdown zone. Landing quality is the score.';
    }
    return this.ringsPassed + ' of ' + this.ringDefs.length + ' gates threaded' +
      (this.ringsPassed >= this.needRings ? ' — enough to land for the bonus.' : ' — need ' + this.needRings + ' to qualify.');
  }
}
