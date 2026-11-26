// Cloudrunner — aircraft. One job: build a plane that looks built, and
// fly it. The mesh is assembled from primitives (fuselage, wings, tail,
// canopy, propeller) in a sunrise-orange scheme; the flight model is an
// arcade model with real trade-offs: throttle sets speed, bank turns the
// plane, pitch trades speed for altitude, and below flying speed the wing
// stops holding you up.

import { PLANE, WORLD } from './config.js';

export function buildAircraftMesh() {
  const g = new THREE.Group();
  g.name = 'aircraft';
  const orange = new THREE.MeshStandardMaterial({ color: 0xff7a2f, roughness: 0.45, metalness: 0.25 });
  const cream = new THREE.MeshStandardMaterial({ color: 0xfff3df, roughness: 0.5, metalness: 0.15 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x2c313a, roughness: 0.6, metalness: 0.4 });
  const glass = new THREE.MeshStandardMaterial({ color: 0x9fd8ff, roughness: 0.12, metalness: 0.6 });

  // Fuselage: a tapered body, nose forward (-Z in local space).
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 1.15, 7.2, 12), orange);
  body.rotation.x = Math.PI / 2;
  body.castShadow = true;
  g.add(body);
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.85, 1.8, 12), cream);
  nose.rotation.x = -Math.PI / 2;
  nose.position.z = -4.5;
  nose.castShadow = true;
  g.add(nose);
  // Belly stripe.
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.5, 7.0), cream);
  stripe.position.set(0, -0.75, 0.2);
  g.add(stripe);
  // Main wing, slightly swept, with tip lights.
  const wing = new THREE.Mesh(new THREE.BoxGeometry(11.5, 0.28, 2.4), cream);
  wing.position.set(0, -0.15, 0.4);
  wing.castShadow = true;
  g.add(wing);
  const wingTipMat = new THREE.MeshBasicMaterial({ color: 0x37ff8a });
  for (const side of [-1, 1]) {
    const tip = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 6), side < 0 ? new THREE.MeshBasicMaterial({ color: 0xff4747 }) : wingTipMat);
    tip.position.set(side * 5.75, -0.15, 0.4);
    g.add(tip);
  }
  // Tail: horizontal stabiliser and a tall fin.
  const stab = new THREE.Mesh(new THREE.BoxGeometry(4.4, 0.22, 1.5), orange);
  stab.position.set(0, 0.25, 3.3);
  stab.castShadow = true;
  g.add(stab);
  const fin = new THREE.Mesh(new THREE.BoxGeometry(0.22, 2.1, 1.9), orange);
  fin.position.set(0, 1.05, 3.2);
  fin.castShadow = true;
  g.add(fin);
  // Canopy: a tinted bubble the pilot sits under.
  const canopy = new THREE.Mesh(new THREE.SphereGeometry(0.95, 14, 10), glass);
  canopy.scale.set(0.85, 0.62, 1.5);
  canopy.position.set(0, 0.85, -0.9);
  g.add(canopy);
  // Propeller: two blades on a spinner, spinning in flight. The group
  // rotates around Z (the prop shaft); each blade reaches out from it.
  const prop = new THREE.Group();
  prop.name = 'propeller';
  const spinner = new THREE.Mesh(new THREE.ConeGeometry(0.42, 1.0, 10), dark);
  spinner.rotation.x = -Math.PI / 2;
  spinner.position.z = -5.5;
  prop.add(spinner);
  const bladeMat = new THREE.MeshStandardMaterial({ color: 0x1c1f24, roughness: 0.4, metalness: 0.5 });
  for (const y of [1.7, -1.7]) {
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.28, 3.4, 0.12), bladeMat);
    blade.position.set(0, y, -5.35);
    prop.add(blade);
  }
  g.add(prop);
  g.userData.propeller = prop;
  // Landing gear, fixed, with lit wheels.
  for (const side of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 1.1, 6), dark);
    leg.position.set(side * 1.1, -1.25, -0.6);
    g.add(leg);
    const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.3, 12), dark);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(side * 1.1, -1.8, -0.6);
    g.add(wheel);
  }
  return g;
}

export class Aircraft {
  constructor(scene) {
    this.mesh = buildAircraftMesh();
    scene.add(this.mesh);
    this.reset();
  }

  reset() {
    this.pos = new THREE.Vector3(WORLD.startPos.x, WORLD.startPos.y, WORLD.startPos.z);
    this.heading = THREE.MathUtils.degToRad(WORLD.startHeadingDeg);
    this.pitch = 0;
    this.roll = 0;
    this.speed = 0;
    this.throttle = 0;
    this.verticalSpeed = 0;
    this.onGround = true;
    this.crashed = false;
    this.propSpin = 0;
    this._syncMesh();
  }

  _syncMesh() {
    this.mesh.position.copy(this.pos);
    this.mesh.rotation.set(0, 0, 0);
    this.mesh.rotateY(this.heading);
    this.mesh.rotateX(this.pitch);
    this.mesh.rotateZ(this.roll);
  }

  // One physics step. input: {pitch, roll, throttleDelta, brake} (-1..1).
  // Returns an event string ('stall' | 'ground' | null) the game may act on.
  step(dt, input, groundH) {
    if (this.crashed) return null;
    // Throttle: Shift up, Ctrl down, eased toward its target.
    this.throttle = THREE.MathUtils.clamp(this.throttle + input.throttleDelta * dt * 0.9, 0, 1);
    // Target speed from throttle; drag grows with the square of speed.
    const target = PLANE.minSpeed + (PLANE.maxSpeed - PLANE.minSpeed) * this.throttle;
    const drag = PLANE.drag * (this.speed / PLANE.maxSpeed);
    this.speed += ((target - this.speed) * 0.55 - drag * this.speed * 0.12) * dt;
    if (input.brake) this.speed = Math.max(0, this.speed - 22 * dt);
    this.speed = Math.max(0, this.speed);
    // Roll banks the plane; bank turns the heading (a banked turn).
    const rollTarget = input.roll * PLANE.maxRoll;
    this.roll += (rollTarget - this.roll) * Math.min(1, dt * 3.2);
    this.heading -= Math.sin(this.roll) * PLANE.turnRate * dt * (this.speed / PLANE.cruiseSpeed);
    // Pitch: elevator, stronger with airspeed; pitch trades speed for climb.
    const pitchTarget = input.pitch * PLANE.maxPitch;
    this.pitch += (pitchTarget - this.pitch) * Math.min(1, dt * 2.6);
    const flying = this.speed > PLANE.minSpeed;
    // Climb/sink from pitch, scaled by how well the wing is flying.
    const climb = flying ? Math.sin(this.pitch) * PLANE.climbRate * (this.speed / PLANE.cruiseSpeed) : -PLANE.sinkRate;
    this.verticalSpeed = climb;
    // Forward motion along the heading, plus climb.
    const fwd = new THREE.Vector3(-Math.sin(this.heading), 0, -Math.cos(this.heading));
    this.pos.addScaledVector(fwd, this.speed * dt);
    this.pos.y += climb * dt;
    // Ground: rolling on the strip, or a strike.
    const clearance = this.pos.y - groundH;
    if (clearance <= PLANE.groundClearance && this.speed < 4) {
      this.onGround = true;
      this.pos.y = groundH + PLANE.groundClearance;
      this.pitch = 0; this.roll = 0;
    } else {
      this.onGround = false;
    }
    // Propeller spins faster with throttle.
    this.propSpin += dt * (4 + this.throttle * 42);
    this.mesh.userData.propeller.rotation.z = this.propSpin;
    this._syncMesh();
    if (!flying && !this.onGround && this.speed < PLANE.minSpeed * 0.7) return 'stall';
    return null;
  }

  // Heading in degrees, 0 = north (-Z is 180 in this world, so normalise).
  headingDeg() {
    let d = THREE.MathUtils.radToDeg(this.heading) % 360;
    if (d < 0) d += 360;
    return d;
  }

  speedKnots() { return Math.round(this.speed * 1.94384); }
  altitudeFeet() { return Math.round(this.pos.y * 3.28084); }
}
