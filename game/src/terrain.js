// Cloudrunner — terrain. One job: build the canyon the game flies through
// and answer the one question the flight model keeps asking: how high is
// the ground at (x, z)? The same height function shapes the mesh, places
// the trees and decides every crash, so the picture and the physics agree.

import { WORLD } from './config.js';

// Deterministic value noise: a few sines, no RNG, so the canyon is identical
// every run and every screenshot.
function noise2(x, z) {
  return (
    Math.sin(x * 0.011 + z * 0.007) * 0.55 +
    Math.sin(x * 0.027 - z * 0.013 + 1.7) * 0.3 +
    Math.sin(x * 0.061 + z * 0.043 + 4.2) * 0.15
  );
}

function riverX(z) {
  return Math.sin(z * 0.0016) * 55 + Math.sin(z * 0.0007 + 2.0) * 30;
}

// Ground height in metres at (x, z). Valley floor near the river, canyon
// walls rising steeply on both sides, peaks capped with snow.
export function heightAt(x, z) {
  const rx = riverX(z);
  const d = Math.abs(x - rx);            // distance from the river centreline
  const wall = Math.max(0, (d - 130) / 320); // 0 in the valley, 1 on the rim
  const wallH = Math.pow(Math.min(1, wall), 1.6) * WORLD.wallHeight;
  const valley = noise2(x, z) * 7 * (1 - Math.min(1, wall));
  const riverbed = -2.5 * Math.exp(-(d * d) / (2 * 45 * 45));
  const rim = noise2(x * 0.5 + 9, z * 0.5) * 26 * Math.min(1, wall);
  let h = wallH + valley + riverbed + rim;
  // Flatten the ground under both runways so each strip sits on level earth.
  for (const r of [WORLD.runway, WORLD.farRunway]) {
    const dx = Math.abs(x - r.x), dz = Math.abs(z - r.z);
    if (dx < r.width / 2 + 40 && dz < r.length / 2 + 40) {
      const fx = Math.max(0, 1 - Math.max(0, dx - r.width / 2) / 40);
      const fz = Math.max(0, 1 - Math.max(0, dz - r.length / 2) / 40);
      const f = Math.min(fx, fz); // 1 on the strip, fading to 0 outside it
      h = h * (1 - f) + 2.0 * f;
    }
  }
  return h;
}

function lerpColor(a, b, t) {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

export class Terrain {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    this.group.name = 'terrain';
    scene.add(this.group);
    this._buildSky();
    this._buildGround();
    this._buildRiver();
    this._buildRunways();
    this._buildTrees();
    this._buildRocks();
    this._buildClouds();
    this._buildLights();
  }

  _buildSky() {
    // A gradient sky dome: pale horizon, deep blue overhead, plus the sun.
    const geo = new THREE.SphereGeometry(4200, 24, 16);
    const colors = [];
    const pos = geo.attributes.position;
    const top = [0.16, 0.45, 0.78];
    const horizon = [0.75, 0.9, 1.0];
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i) / 4200; // -1 .. 1
      const t = Math.max(0, Math.min(1, (y + 0.08) / 0.55));
      const c = lerpColor(horizon, top, t);
      colors.push(c[0], c[1], c[2]);
    }
    geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    const mat = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false });
    const dome = new THREE.Mesh(geo, mat);
    dome.name = 'sky-dome';
    this.group.add(dome);
    // Sun disc, low in the west, so the canyon walls catch long light.
    const sun = new THREE.Mesh(
      new THREE.CircleGeometry(90, 32),
      new THREE.MeshBasicMaterial({ color: 0xfff2c0, fog: false })
    );
    sun.position.set(-2600, 900, -2600);
    sun.lookAt(0, 0, 0);
    sun.name = 'sun-disc';
    this.group.add(sun);
    this.scene.fog = new THREE.Fog(0xcfe6f5, WORLD.fogNear, WORLD.fogFar);
  }

  _buildGround() {
    const W = WORLD.width, L = WORLD.length;
    const segX = 120, segZ = 220;
    const geo = new THREE.PlaneGeometry(W, L, segX, segZ);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position;
    const colors = new Float32Array(pos.count * 3);
    const grass = [0.24, 0.47, 0.22];
    const meadow = [0.42, 0.6, 0.26];
    const rock = [0.55, 0.48, 0.4];
    const cliff = [0.42, 0.38, 0.34];
    const sand = [0.78, 0.7, 0.5];
    const snow = [0.94, 0.96, 0.99];
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i) - 1800; // centre the strip on the canyon (z +200 .. -3800)
      const h = heightAt(x, z);
      pos.setY(i, h);
      pos.setZ(i, z);
      const d = Math.abs(x - riverX(z));
      let c;
      if (h > 215) c = lerpColor(rock, snow, Math.min(1, (h - 215) / 45));
      else if (h > 130) c = lerpColor(cliff, rock, (h - 130) / 85);
      else if (d < 70) c = lerpColor(sand, meadow, Math.min(1, d / 70));
      else c = lerpColor(meadow, grass, noise2(x, z) * 0.5 + 0.5);
      // Slope darkening: steep faces read as rock.
      const slope = Math.abs(heightAt(x + 6, z) - h) + Math.abs(heightAt(x, z + 6) - h);
      if (slope > 5 && h < 215) c = lerpColor(c, cliff, Math.min(0.7, (slope - 5) / 12));
      colors[i * 3] = c[0]; colors[i * 3 + 1] = c[1]; colors[i * 3 + 2] = c[2];
    }
    geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geo.computeVertexNormals();
    const mat = new THREE.MeshLambertMaterial({ vertexColors: true });
    const ground = new THREE.Mesh(geo, mat);
    ground.receiveShadow = true;
    ground.name = 'ground';
    this.group.add(ground);
  }

  _buildRiver() {
    const pts = [];
    for (let z = 200; z >= -3800; z -= 40) pts.push(new THREE.Vector2(riverX(z), z));
    const shape = new THREE.Shape();
    shape.moveTo(pts[0].x - 26, pts[0].y);
    for (const p of pts) shape.lineTo(p.x - 26, p.y);
    for (let i = pts.length - 1; i >= 0; i--) shape.lineTo(pts[i].x + 26, pts[i].y);
    shape.closePath();
    const geo = new THREE.ShapeGeometry(shape);
    geo.rotateX(-Math.PI / 2);
    const mat = new THREE.MeshLambertMaterial({ color: 0x2f7fc4, transparent: true, opacity: 0.92 });
    const river = new THREE.Mesh(geo, mat);
    river.position.y = WORLD.riverY + 1.2;
    river.name = 'river';
    this.group.add(river);
  }

  _buildRunways() {
    this.runways = [];
    for (const spec of [WORLD.runway, WORLD.farRunway]) {
      const g = new THREE.Group();
      const strip = new THREE.Mesh(
        new THREE.BoxGeometry(spec.width, 1.2, spec.length),
        new THREE.MeshLambertMaterial({ color: 0x2c2f36 })
      );
      strip.position.set(spec.x, 2.2, spec.z);
      strip.receiveShadow = true;
      g.add(strip);
      // Centreline dashes and threshold bars.
      const markMat = new THREE.MeshBasicMaterial({ color: 0xf2f5f7 });
      for (let dz = -spec.length / 2 + 24; dz < spec.length / 2 - 12; dz += 32) {
        const dash = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.3, 16), markMat);
        dash.position.set(spec.x, 3.0, spec.z + dz);
        g.add(dash);
      }
      for (const end of [-1, 1]) {
        const bar = new THREE.Mesh(new THREE.BoxGeometry(spec.width - 8, 0.3, 5), markMat);
        bar.position.set(spec.x, 3.0, spec.z + end * (spec.length / 2 - 10));
        g.add(bar);
      }
      // Edge lights, warm amber, lit.
      const lightGeo = new THREE.SphereGeometry(1.1, 8, 6);
      const lightMat = new THREE.MeshBasicMaterial({ color: 0xffc46b });
      for (let dz = -spec.length / 2 + 8; dz <= spec.length / 2 - 8; dz += 40) {
        for (const side of [-1, 1]) {
          const l = new THREE.Mesh(lightGeo, lightMat);
          l.position.set(spec.x + side * (spec.width / 2 - 2), 3.4, spec.z + dz);
          g.add(l);
        }
      }
      g.name = spec === WORLD.runway ? 'runway-home' : 'runway-far';
      this.group.add(g);
      this.runways.push({ ...spec, group: g });
    }
  }

  _buildTrees() {
    // Low-poly pines on the valley floor and lower slopes, instanced.
    const trunkGeo = new THREE.CylinderGeometry(0.7, 1.0, 5, 6);
    const trunkMat = new THREE.MeshLambertMaterial({ color: 0x5a4128 });
    const coneGeo = new THREE.ConeGeometry(4.2, 13, 7);
    const coneMat = new THREE.MeshLambertMaterial({ color: 0x2c5a2e });
    const count = 420;
    const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, count);
    const cones = new THREE.InstancedMesh(coneGeo, coneMat, count);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const s = new THREE.Vector3();
    let placed = 0;
    let seed = 7;
    const rand = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    while (placed < count) {
      const x = (rand() - 0.5) * 1250;
      const z = 180 - rand() * 3900;
      const h = heightAt(x, z);
      const d = Math.abs(x - riverX(z));
      if (h > 120 || d < 60 || Math.abs(x) < 40) continue; // keep the strip and river clear
      const sc = 0.8 + rand() * 1.1;
      m.compose(new THREE.Vector3(x, h + 2.2 * sc, z), q, new THREE.Vector3(sc, sc, sc));
      trunks.setMatrixAt(placed, m);
      m.compose(new THREE.Vector3(x, h + (5 + 6) * sc, z), q, new THREE.Vector3(sc, sc, sc));
      cones.setMatrixAt(placed, m);
      placed++;
    }
    trunks.count = placed; cones.count = placed;
    trunks.castShadow = true; cones.castShadow = true;
    trunks.name = 'tree-trunks'; cones.name = 'tree-tops';
    this.group.add(trunks, cones);
  }

  _buildRocks() {
    const geo = new THREE.DodecahedronGeometry(6, 0);
    const mat = new THREE.MeshLambertMaterial({ color: 0x6b6258 });
    const count = 160;
    const rocks = new THREE.InstancedMesh(geo, mat, count);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();
    let seed = 31;
    const rand = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    for (let i = 0; i < count; i++) {
      const x = (rand() - 0.5) * 1300;
      const z = 180 - rand() * 3900;
      const h = heightAt(x, z);
      const sc = 0.5 + rand() * 1.8;
      e.set(rand() * 3, rand() * 3, rand() * 3);
      q.setFromEuler(e);
      m.compose(new THREE.Vector3(x, h + 2 * sc, z), q, new THREE.Vector3(sc, sc * 0.7, sc));
      rocks.setMatrixAt(i, m);
    }
    rocks.castShadow = true;
    rocks.name = 'rocks';
    this.group.add(rocks);
  }

  _buildClouds() {
    // Soft billboard puffs drifting slowly over the canyon.
    this.clouds = [];
    const mat = new THREE.MeshLambertMaterial({ color: 0xffffff, transparent: true, opacity: 0.85 });
    let seed = 97;
    const rand = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    for (let i = 0; i < 22; i++) {
      const g = new THREE.Group();
      const puffs = 3 + Math.floor(rand() * 3);
      for (let j = 0; j < puffs; j++) {
        const r = 14 + rand() * 22;
        const s = new THREE.Mesh(new THREE.SphereGeometry(r, 10, 8), mat);
        s.position.set((rand() - 0.5) * 60, (rand() - 0.5) * 8, (rand() - 0.5) * 26);
        s.scale.y = 0.45;
        g.add(s);
      }
      g.position.set((rand() - 0.5) * 1200, 290 + rand() * 130, 180 - rand() * 3900);
      g.name = 'cloud-' + i;
      this.group.add(g);
      this.clouds.push({ group: g, speed: 1.5 + rand() * 2.5 });
    }
  }

  _buildLights() {
    const hemi = new THREE.HemisphereLight(0xbfe3ff, 0x4a5a3a, 0.85);
    hemi.name = 'hemi-light';
    this.scene.add(hemi);
    const sun = new THREE.DirectionalLight(0xfff1cf, 1.5);
    sun.position.set(-900, 1400, -600);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.camera.left = -260; sun.shadow.camera.right = 260;
    sun.shadow.camera.top = 260; sun.shadow.camera.bottom = -260;
    sun.shadow.camera.near = 100; sun.shadow.camera.far = 4000;
    sun.shadow.bias = -0.0006;
    sun.name = 'sun-light';
    this.scene.add(sun);
    this.sun = sun;
  }

  // Keep the shadow frustum and the clouds near the aircraft.
  update(dt, planePos) {
    this.sun.position.set(planePos.x - 900, 1400, planePos.z - 600);
    this.sun.target.position.set(planePos.x, 0, planePos.z);
    this.sun.target.updateMatrixWorld();
    for (const c of this.clouds) {
      c.group.position.x += c.speed * dt;
      if (c.group.position.x > 750) c.group.position.x = -750;
    }
  }

  // Which runway (if any) the point (x, z) is over, else null.
  runwayAt(x, z) {
    for (const r of this.runways) {
      if (Math.abs(x - r.x) <= r.width / 2 && Math.abs(z - r.z) <= r.length / 2) return r;
    }
    return null;
  }
}
