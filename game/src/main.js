// Cloudrunner — main. One job: run the game. It builds the renderer and
// the scene, owns the state machine (menu, flying, paused, crashed,
// landed, over), drives the chase camera, and turns the flight model's
// numbers into crashes, ring passes and landings. Everything else is a
// module it calls; this file only wires them together.

import { WORLD, PLANE, FUEL, MISSIONS } from './config.js';
import { Input } from './input.js';
import { Terrain, heightAt } from './terrain.js';
import { Aircraft } from './aircraft.js';
import { Rings } from './rings.js';
import { Hud } from './hud.js';
import { AudioEngine } from './audio.js';
import { Mission } from './missions.js';

const RUNWAY_TOP = 2.8;
const LAND_SPEED_MAX = 46;
const LAND_SINK_MAX = 4.5;
const LAND_ALIGN_DEG = 26;

class Game {
  constructor() {
    this.canvas = document.getElementById('scene');
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(62, 1, 0.5, 9000);
    this.camera.position.set(0, 30, 230);
    this.terrain = new Terrain(this.scene);
    this.aircraft = new Aircraft(this.scene);
    this.input = new Input(this.canvas);
    this.hud = new Hud();
    this.audio = new AudioEngine();
    this.state = 'menu';
    this.mission = new Mission('rings');
    this.rings = new Rings(this.scene, this.mission.ringDefs);
    this.fuel = FUEL.capacity;
    this.timeSec = 0;
    this.crashes = 0;
    this.elapsed = 0;
    this.camPos = new THREE.Vector3(0, 30, 230);
    this.camTarget = new THREE.Vector3(0, 20, 0);
    this.shake = 0;
    this.crashTimer = 0;
    this.lastCheckpoint = null;
    this._resize();
    window.addEventListener('resize', () => this._resize());
    this._buildMenu();
    this._showMenu();
    this._wireKeys();
    this._applyShotParam();
    this.clock = new THREE.Clock();
    this.renderer.setAnimationLoop(() => this._frame());
  }

  _resize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  _buildMenu() {
    const menu = document.getElementById('menu');
    menu.innerHTML = '';
    const wrap = document.createElement('div');
    wrap.style.cssText = 'text-align:center;pointer-events:none;width:100%';
    const title = document.createElement('div');
    title.innerHTML = '<div style="font-size:54px;font-weight:800;color:#fff;letter-spacing:6px;text-shadow:0 3px 24px rgba(55,200,255,.9)">CLOUDRUNNER</div>' +
      '<div style="font-size:17px;color:#cfeeff;margin-top:6px">A canyon flight game — thread the rings, mind your fuel, land it clean.</div>';
    wrap.appendChild(title);
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;justify-content:center;margin-top:26px;pointer-events:none';
    for (const id of ['rings', 'dash', 'landing']) {
      const m = MISSIONS[id];
      const card = document.createElement('div');
      card.className = 'mission-card';
      card.innerHTML = '<h3>' + m.title + '</h3><p>' + m.tagline + '</p>';
      card.addEventListener('click', () => { this.audio.ensure(); this.startMission(id); });
      row.appendChild(card);
    }
    wrap.appendChild(row);
    const controls = document.createElement('div');
    controls.style.cssText = 'margin-top:26px;font-size:13px;color:#9fc6dd;line-height:1.9';
    controls.innerHTML = '<b style="color:#ffe08a">↑ ↓</b> pitch &nbsp; <b style="color:#ffe08a">← →</b> bank &amp; turn &nbsp; <b style="color:#ffe08a">Shift / Ctrl</b> throttle &nbsp; <b style="color:#ffe08a">Space</b> airbrake<br>Mouse: hold and drag to steer &nbsp;·&nbsp; <b style="color:#ffe08a">P</b> pause &nbsp; <b style="color:#ffe08a">R</b> restart &nbsp; <b style="color:#ffe08a">M</b> mute &nbsp; <b style="color:#ffe08a">Esc</b> menu';
    wrap.appendChild(controls);
    menu.appendChild(wrap);
  }

  _showMenu() {
    this.state = 'menu';
    document.getElementById('menu').style.display = 'flex';
    // The menu carries its own title; keep the HUD banner clear so the
    // two never print on top of each other.
    this.hud.clearBanner();
    // Park the plane on the home runway for the backdrop.
    this.aircraft.reset();
    this.aircraft.throttle = 0;
  }

  _wireKeys() {
    window.addEventListener('keydown', (e) => {
      if (e.key === 'p' || e.key === 'P') {
        if (this.state === 'flying') { this.state = 'paused'; this.hud.banner('PAUSED', 'Press P to keep flying.', ''); }
        else if (this.state === 'paused') { this.state = 'flying'; this.hud.clearBanner(); }
      }
      if (e.key === 'r' || e.key === 'R') { if (this.state !== 'menu') this.startMission(this.mission.id); }
      if (e.key === 'm' || e.key === 'M') { const m = this.audio.toggleMute(); this.hud.toast(m ? 'Sound muted' : 'Sound on'); }
      if (e.key === 'Escape') { if (this.state !== 'menu') this._showMenu(); }
    });
    this.canvas.addEventListener('mousedown', () => this.audio.ensure());
  }

  startMission(id) {
    this.mission = new Mission(id);
    this.rings = this._rebuildRings();
    this.hud.setMission(this.mission);
    document.getElementById('menu').style.display = 'none';
    this.aircraft.reset();
    this.fuel = FUEL.capacity;
    this.timeSec = 0;
    this.crashes = 0;
    this.lastCheckpoint = null;
    this.state = 'flying';
    this.hud.banner('', '', '');
    this.hud.toast(this.mission.title + ' — good luck, pilot');
    document.getElementById('status').textContent = this.mission.title + ' started';
    // Snap the chase camera behind the plane at once: lerping in from the
    // menu's orbit would leave the plane out of frame for seconds.
    this._snapCamera();
  }

  // Put the chase camera exactly where it belongs right now, no lerp.
  // v2: closer chase (12 m back, 4.5 m up) so the aircraft reads bigger.
  _snapCamera() {
    const ac = this.aircraft;
    const fwd = new THREE.Vector3(-Math.sin(ac.heading), 0, -Math.cos(ac.heading));
    this.camPos.copy(ac.pos).addScaledVector(fwd, -12).add(new THREE.Vector3(0, 4.5, 0));
    this.camTarget.copy(ac.pos).addScaledVector(fwd, 24).add(new THREE.Vector3(0, 1.2, 0));
    this.camera.position.copy(this.camPos);
    this.camera.lookAt(this.camTarget);
  }

  _rebuildRings() {
    this.scene.remove(this.rings.group);
    return new Rings(this.scene, this.mission.ringDefs);
  }

  // Ground height the flight model uses: the runway top when over a strip.
  _groundAt(x, z) {
    const t = heightAt(x, z);
    return this.terrain.runwayAt(x, z) ? Math.max(t, RUNWAY_TOP) : t;
  }

  _frame() {
    const dt = Math.min(this.clock.getDelta(), 0.05);
    this.elapsed += dt;
    this.input.update();
    if (this.state === 'flying') this._updateFlying(dt);
    else if (this.state === 'menu') this._updateMenu(dt);
    else if (this.state === 'crashed') {
      this.crashTimer -= dt;
      if (this.crashTimer <= 0) this._respawn();
    }
    this.terrain.update(dt, this.aircraft.pos);
    this.rings.animate(this.elapsed);
    this._updateCamera(dt);
    this._updateHud();
    this.renderer.render(this.scene, this.camera);
    this.input.endFrame();
  }

  _updateMenu(dt) {
    // Slow drift around the parked plane: the menu's living backdrop.
    const t = this.elapsed * 0.05;
    const p = this.aircraft.pos;
    this.camPos.lerp(new THREE.Vector3(p.x + Math.sin(t) * 26, p.y + 9, p.z + 34 + Math.cos(t) * 6), Math.min(1, dt * 1.2));
    this.camTarget.lerp(new THREE.Vector3(p.x, p.y + 3, p.z - 40), Math.min(1, dt * 1.2));
    this.audio.update(0, 0, true);
  }

  _updateFlying(dt) {
    const ac = this.aircraft;
    const groundH = this._groundAt(ac.pos.x, ac.pos.z);
    const event = ac.step(dt, this.input, groundH);
    this.timeSec += dt;
    this.mission.timeSec = this.timeSec;
    // Fuel: throttle decides the burn; rings pay some back.
    if (this.mission.fuelOn && !ac.onGround) {
      const burn = FUEL.burnIdle + (FUEL.burnFull - FUEL.burnIdle) * ac.throttle;
      this.fuel = Math.max(0, this.fuel - burn * dt);
      if (this.fuel <= 0) {
        ac.throttle = 0; // engine out: glide
        if (this.fuel <= 0 && ac.onGround && !this.terrain.runwayAt(ac.pos.x, ac.pos.z)) {
          this.mission.onOutOfFuel();
          this._endMission('Out of fuel — stranded in the canyon.', false);
          return;
        }
      }
    }
    if (event === 'stall' && !ac.onGround) this.hud.toast('Stalling — add throttle!');
    // Rings.
    const ringEvent = this.rings.update(ac.pos);
    if (ringEvent === 'pass') {
      this.mission.onRing(true);
      this.audio.ring();
      this.fuel = Math.min(FUEL.capacity, this.fuel + FUEL.ringBonus);
      this.lastCheckpoint = { x: ac.pos.x, y: ac.pos.y, z: ac.pos.z, heading: ac.heading };
      this.hud.toast('Gate ' + this.rings.passed + ' — +' + this.mission.ringScore + ' pts, fuel +4%');
    } else if (ringEvent === 'miss') {
      this.mission.onRing(false);
      this.audio.miss();
      this.hud.toast('Gate missed');
    }
    // Terrain strike: below the ground and not a gentle runway touchdown.
    const clearance = ac.pos.y - groundH;
    const runway = this.terrain.runwayAt(ac.pos.x, ac.pos.z);
    const gentle = ac.verticalSpeed > -LAND_SINK_MAX && ac.speed < LAND_SPEED_MAX;
    if (clearance <= 1.2) {
      if (runway && gentle && ac.speed > 8) {
        this._land(runway);
        return;
      }
      if (clearance <= 0.4) { this._crash(); return; }
    }
    // Out of the canyon (safety net): turn back, don't let the plane vanish.
    if (Math.abs(ac.pos.x) > 680 || ac.pos.z > 260 || ac.pos.z < -3750) {
      this.hud.toast('Turn back — the canyon ends here');
      ac.heading = Math.atan2(-ac.pos.x, 1800 - ac.pos.z) + Math.PI;
    }
    // Engine and wind follow the flight.
    this.audio.update(ac.throttle, ac.speed, ac.onGround);
  }

  _land(runway) {
    const ac = this.aircraft;
    // Landing quality: centreline, gentle sink, slow speed.
    const centre = 1 - Math.min(1, Math.abs(ac.pos.x - runway.x) / (runway.width / 2));
    const sink = 1 - Math.min(1, Math.abs(ac.verticalSpeed) / LAND_SINK_MAX);
    const spd = 1 - Math.min(1, Math.max(0, ac.speed - 18) / (LAND_SPEED_MAX - 18));
    const quality = Math.max(0.15, Math.min(1, centre * 0.45 + sink * 0.35 + spd * 0.2));
    const pts = this.mission.onLanding(quality);
    ac.speed = 0;
    ac.throttle = 0;
    ac.onGround = true;
    this.audio.land();
    const qWord = quality > 0.8 ? 'Greased it!' : quality > 0.55 ? 'A solid landing.' : 'Down — a bit rough.';
    this._endMission(qWord + ' Landing bonus +' + pts + ' pts.', true);
  }

  _crash() {
    const ac = this.aircraft;
    ac.crashed = true;
    this.crashes++;
    this.mission.onCrash();
    this.audio.crash();
    this.shake = 1.2;
    this.state = 'crashed';
    this.crashTimer = 1.7;
    this.hud.banner('CRASHED', 'The canyon wins this round. −' + 150 + ' pts.', this.crashes >= 3 ? 'Three strikes — the sortie is over.' : 'Respawning at your last gate…');
    document.getElementById('status').textContent = 'Crashed';
  }

  _respawn() {
    if (this.crashes >= 3) {
      this._endMission('Three crashes — the sortie is over.', false);
      return;
    }
    const cp = this.lastCheckpoint;
    const ac = this.aircraft;
    ac.crashed = false;
    if (cp) {
      ac.pos.set(cp.x, cp.y + 6, cp.z + 30);
      ac.heading = cp.heading;
    } else {
      ac.reset();
    }
    ac.pitch = 0; ac.roll = 0;
    ac.speed = PLANE.cruiseSpeed;
    ac.throttle = 0.55;
    ac.verticalSpeed = 0;
    this.fuel = Math.max(15, this.fuel - 8);
    this.state = 'flying';
    this.hud.clearBanner();
    this.hud.toast('Back in the air — watch the terrain');
  }

  _endMission(line, won) {
    this.state = 'over';
    const m = this.mission;
    const sub = 'Score ' + m.score.toLocaleString('en-US') + ' · Gates ' + m.ringsPassed + '/' + m.ringDefs.length +
      ' · Time ' + Math.floor(this.timeSec / 60) + ':' + String(Math.floor(this.timeSec % 60)).padStart(2, '0') +
      ' · Crashes ' + this.crashes;
    this.hud.banner(won ? 'MISSION COMPLETE' : 'SORTIE OVER', line, sub + '<br>Press <b>R</b> to fly it again, or <b>Esc</b> for another mission.');
    document.getElementById('status').textContent = (won ? 'Mission complete. ' : 'Sortie over. ') + sub;
  }

  _updateCamera(dt) {
    const ac = this.aircraft;
    const fwd = new THREE.Vector3(-Math.sin(ac.heading), 0, -Math.cos(ac.heading));
    const desired = ac.pos.clone().addScaledVector(fwd, -12).add(new THREE.Vector3(0, 4.5, 0));
    const k = this.state === 'menu' ? Math.min(1, dt * 1.2) : Math.min(1, dt * 4.5);
    this.camPos.lerp(desired, k);
    const target = ac.pos.clone().addScaledVector(fwd, 24).add(new THREE.Vector3(0, 1.2, 0));
    this.camTarget.lerp(target, Math.min(1, dt * 6));
    // Speed kick: a wider view when the air is rushing past.
    const fov = 62 + Math.min(9, (ac.speed / PLANE.maxSpeed) * 9);
    if (Math.abs(this.camera.fov - fov) > 0.05) { this.camera.fov += (fov - this.camera.fov) * Math.min(1, dt * 3); this.camera.updateProjectionMatrix(); }
    // Crash shake decays fast.
    let sx = 0, sy = 0;
    if (this.shake > 0.01) { sx = (Math.random() - 0.5) * this.shake; sy = (Math.random() - 0.5) * this.shake; this.shake *= Math.pow(0.02, dt); }
    this.camera.position.set(this.camPos.x + sx, this.camPos.y + sy, this.camPos.z);
    this.camera.lookAt(this.camTarget);
  }

  _updateHud() {
    const ac = this.aircraft;
    this.hud.update({
      altFt: ac.altitudeFeet(),
      knots: ac.speedKnots(),
      headingDeg: ac.headingDeg(),
      throttle: ac.throttle,
      fuel: this.fuel,
      score: this.mission.score,
      ringsPassed: this.rings.passed,
      ringsTotal: this.mission.ringDefs.length,
      timeSec: this.timeSec,
      pitch: ac.pitch,
      roll: ac.roll,
    });
  }

  // Screenshot helper: ?shot=cover|ring|land|menu poses the game so a
  // headless browser can capture a real render of a chosen moment.
  _applyShotParam() {
    const q = new URLSearchParams(window.location.search);
    const shot = q.get('shot');
    if (!shot) return;
    // Screenshot poses never show toasts: the frame stays clean.
    this.hud.quiet = true;
    const start = (id) => {
      this.startMission(id);
      this.aircraft.throttle = 0.72;
      this.aircraft.speed = PLANE.cruiseSpeed;
    };
    if (shot === 'menu') return; // stay on the menu
    if (shot === 'cover') {
      start('rings');
      // Lined up on Gate 5 (120, 60, -1150): 45 m out, dead ahead, so the
      // ring reads big in the cover frame.
      this.aircraft.pos.set(120, 60, -1105);
      this.aircraft.heading = 0;
      this.rings.nextIndex = 4; // Gate 5 ahead
      this.rings.passed = 4;
      this.mission.ringsPassed = 4;
      this.mission.score = 400;
    } else if (shot === 'ring') {
      start('rings');
      // Lined up on Gate 3 (90, 48, -660): 60 m out, on the centreline.
      this.aircraft.pos.set(90, 48, -600);
      this.aircraft.heading = 0;
      this.rings.nextIndex = 2; // Gate 3 just ahead
      this.rings.passed = 2;
      this.mission.ringsPassed = 2;
      this.mission.score = 200;
    } else if (shot === 'land') {
      start('rings');
      this.aircraft.pos.set(6, 42, -3320);
      this.aircraft.heading = 0.02;
      this.aircraft.speed = 34;
      this.aircraft.throttle = 0.3;
      this.rings.nextIndex = 12; // all gates done
      this.rings.passed = 12;
      this.mission.ringsPassed = 12;
      this.mission.score = 1250;
    }
    this.hud.clearBanner();
    // The camera snaps to the chase view at once, so the first rendered
    // frame already has the aircraft in it.
    this._snapCamera();
  }
}

window.addEventListener('DOMContentLoaded', () => { new Game(); });
