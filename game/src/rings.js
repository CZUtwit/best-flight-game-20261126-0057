// Cloudrunner — target rings. One job: build the glowing gates the pilot
// threads, and tell the game when one is passed (or missed). A ring is a
// torus with a pulsing emissive core and a soft halo sprite; passing is a
// 3D distance check, forgiving near the centre, and a miss is only scored
// when the plane flies past the ring's plane without going through.

export class Rings {
  constructor(scene, defs) {
    this.scene = scene;
    this.group = new THREE.Group();
    this.group.name = 'rings';
    scene.add(this.group);
    this.items = [];
    this.nextIndex = 0;
    this.passed = 0;
    this.missed = 0;
    this.streak = 0;
    for (const d of defs) this._add(d);
    this._updateNext();
  }

  _add(d) {
    const g = new THREE.Group();
    g.position.set(d.x, d.y, d.z);
    // The gate itself: a bright torus, edge-lit.
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(d.r, 1.1, 12, 40),
      new THREE.MeshStandardMaterial({ color: 0xff9a3d, emissive: 0xff6a00, emissiveIntensity: 1.4, roughness: 0.35, metalness: 0.2 })
    );
    ring.name = 'ring-' + d.name;
    g.add(ring);
    // Inner glow disc, faint, so the hole reads from far away.
    const disc = new THREE.Mesh(
      new THREE.CircleGeometry(d.r - 1.2, 32),
      new THREE.MeshBasicMaterial({ color: 0xffc46b, transparent: true, opacity: 0.16, side: THREE.DoubleSide })
    );
    g.add(disc);
    // A small beacon light on top, so the next gate is findable.
    const beacon = new THREE.Mesh(
      new THREE.SphereGeometry(1.4, 10, 8),
      new THREE.MeshBasicMaterial({ color: 0xffe08a })
    );
    beacon.position.set(0, d.r + 2.5, 0);
    g.add(beacon);
    g.userData.def = d;
    g.userData.ring = ring;
    g.userData.beacon = beacon;
    this.group.add(g);
    this.items.push({ def: d, group: g, state: 'pending' });
  }

  // The next gate to fly through. Null when the course is done.
  next() {
    return this.nextIndex < this.items.length ? this.items[this.nextIndex] : null;
  }

  // Called every frame with the plane position. Returns 'pass' | 'miss' | null.
  update(planePos) {
    const it = this.next();
    if (!it) return null;
    const c = it.def;
    const dx = planePos.x - c.x, dy = planePos.y - c.y, dz = planePos.z - c.z;
    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (dist < c.r - 1.5) {
      // Through the hole.
      it.state = 'passed';
      this.passed++;
      this.streak++;
      this.nextIndex++;
      this._markPassed(it);
      this._updateNext();
      return 'pass';
    }
    // Past the ring's plane without going through: a miss.
    if (planePos.z < c.z - 6 && dist > c.r + 4) {
      it.state = 'missed';
      this.missed++;
      this.streak = 0;
      this.nextIndex++;
      this._markMissed(it);
      this._updateNext();
      return 'miss';
    }
    return null;
  }

  _markPassed(it) {
    it.group.userData.ring.material = new THREE.MeshStandardMaterial({ color: 0x37ff8a, emissive: 0x0fae4e, emissiveIntensity: 1.6, roughness: 0.35, metalness: 0.2 });
    it.group.userData.beacon.material = new THREE.MeshBasicMaterial({ color: 0x37ff8a });
  }

  _markMissed(it) {
    it.group.userData.ring.material = new THREE.MeshStandardMaterial({ color: 0x8a94a3, emissive: 0x222222, emissiveIntensity: 0.4, roughness: 0.7, metalness: 0.1 });
    it.group.userData.beacon.material = new THREE.MeshBasicMaterial({ color: 0x8a94a3 });
  }

  _updateNext() {
    for (const it of this.items) {
      const active = it === this.next();
      it.group.userData.ring.material.emissiveIntensity = active ? 2.2 : (it.state === 'passed' ? 1.6 : 0.4);
      it.group.scale.setScalar(active ? 1.06 : 1.0);
    }
  }

  // Gentle pulse on the next gate so the eye finds it.
  animate(t) {
    const it = this.next();
    if (!it) return;
    const s = 1.05 + Math.sin(t * 3.2) * 0.03;
    it.group.scale.setScalar(s);
    it.group.userData.beacon.position.y = it.def.r + 2.5 + Math.sin(t * 2.0) * 1.2;
  }

  reset() {
    this.nextIndex = 0;
    this.passed = 0;
    this.missed = 0;
    this.streak = 0;
    for (const it of this.items) {
      it.state = 'pending';
      it.group.userData.ring.material = new THREE.MeshStandardMaterial({ color: 0xff9a3d, emissive: 0xff6a00, emissiveIntensity: 1.4, roughness: 0.35, metalness: 0.2 });
      it.group.userData.beacon.material = new THREE.MeshBasicMaterial({ color: 0xffe08a });
    }
    this._updateNext();
  }
}
