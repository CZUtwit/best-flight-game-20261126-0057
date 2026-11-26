// Cloudrunner — game constants, world layout and mission definitions.
// One job: every number the rest of the game reads lives here, so tuning
// the flight feel or the course never means hunting through the code.

export const WORLD = {
  // Canyon runs along -Z. The runway sits at z = 0, the course ends at z = -3600.
  length: 4000,          // terrain length in metres (z from +200 to -3800)
  width: 1400,           // terrain width in metres (x from -700 to +700)
  wallHeight: 260,       // canyon walls rise this high above the river
  riverY: 0,             // river surface height
  runway: { x: 0, z: 60, length: 320, width: 46, headingDeg: 0 },
  farRunway: { x: 0, z: -3520, length: 320, width: 46, headingDeg: 0 },
  startPos: { x: 0, y: 8, z: 180 },
  startHeadingDeg: 0,  // facing -Z, down the canyon (heading 000 = north)
  fogNear: 350,
  fogFar: 2600,
  skyTop: 0x2f7fc4,
  skyBottom: 0xbfe6ff,
};

export const PLANE = {
  maxSpeed: 92,          // m/s at full throttle, level flight
  cruiseSpeed: 58,
  minSpeed: 26,          // below this the wing stops flying
  accel: 14,             // m/s^2 at full throttle
  drag: 0.35,            // quadratic drag coefficient
  climbRate: 16,         // m/s at best climb
  sinkRate: 9,
  rollRate: 1.9,         // rad/s at full aileron
  pitchRate: 1.1,        // rad/s at full elevator
  maxRoll: 1.15,         // rad of bank
  maxPitch: 0.55,        // rad nose up/down
  turnRate: 0.55,        // rad/s of heading change at full bank
  groundClearance: 4.5,  // metres above terrain before a strike counts
};

export const FUEL = {
  capacity: 100,
  burnCruise: 0.55,      // % per second at cruise throttle
  burnFull: 1.15,        // % per second at full throttle
  burnIdle: 0.18,
  ringBonus: 4,          // % back per ring threaded
  lowWarn: 25,
};

export const RINGS = [
  // Twelve glowing gates down the canyon. Each: centre (x, y, z), radius, name.
  { x: 0,    y: 55,  z: -180,  r: 16, name: 'Gate 1' },
  { x: -70,  y: 70,  z: -420,  r: 16, name: 'Gate 2' },
  { x: 90,   y: 48,  z: -660,  r: 15, name: 'Gate 3' },
  { x: -40,  y: 90,  z: -900,  r: 16, name: 'Gate 4' },
  { x: 120,  y: 60,  z: -1150, r: 15, name: 'Gate 5' },
  { x: -110, y: 75,  z: -1400, r: 16, name: 'Gate 6' },
  { x: 30,   y: 45,  z: -1650, r: 14, name: 'Gate 7' },
  { x: -90,  y: 95,  z: -1900, r: 16, name: 'Gate 8' },
  { x: 80,   y: 55,  z: -2150, r: 15, name: 'Gate 9' },
  { x: -30,  y: 70,  z: -2450, r: 16, name: 'Gate 10' },
  { x: 60,   y: 50,  z: -2750, r: 15, name: 'Gate 11' },
  { x: 0,    y: 60,  z: -3100, r: 18, name: 'Final Gate' },
];

export const CHECKPOINTS = [
  // Canyon Dash gates: fewer, wider, built for speed.
  { x: 0,   y: 60, z: -400,  r: 22, name: 'Checkpoint 1' },
  { x: -90, y: 80, z: -1000, r: 22, name: 'Checkpoint 2' },
  { x: 100, y: 55, z: -1700, r: 22, name: 'Checkpoint 3' },
  { x: -60, y: 85, z: -2400, r: 22, name: 'Checkpoint 4' },
  { x: 0,   y: 60, z: -3200, r: 24, name: 'Finish' },
];

export const MISSIONS = {
  rings: {
    id: 'rings',
    title: 'Ring Run',
    tagline: 'Thread 12 glowing gates down the canyon, then land on the far runway.',
    objective: 'Thread the rings, then land on the far runway.',
    rings: RINGS,
    needRings: 8,        // minimum gates to qualify for the landing bonus
    ringScore: 100,
    landScore: 500,
    fuelOn: true,
  },
  dash: {
    id: 'dash',
    title: 'Canyon Dash',
    tagline: 'A pure time trial: five wide checkpoints, full throttle, fastest line wins.',
    objective: 'Hit all 5 checkpoints as fast as you can, then land.',
    rings: CHECKPOINTS,
    needRings: 5,
    ringScore: 60,
    landScore: 300,
    fuelOn: false,       // dash is flat-out; no fuel pressure
  },
  landing: {
    id: 'landing',
    title: 'Precision Landing',
    tagline: 'Take off, fly one short circuit, and grease it onto the centreline.',
    objective: 'Fly the circuit and land inside the touchdown zone.',
    rings: [ { x: 0, y: 120, z: -600, r: 20, name: 'Downwind' }, { x: 0, y: 70, z: -1400, r: 20, name: 'Base' } ],
    needRings: 0,
    ringScore: 50,
    landScore: 800,      // landing quality is the whole score here
    fuelOn: true,
  },
};

export const SCORING = {
  crashPenalty: 150,
  ringStreakBonus: 25,   // extra per consecutive ring without a miss
  timeBonusPerSec: 2,    // Ring Run: bonus for finishing fast (up to a cap)
  timeBonusCap: 240,
};
