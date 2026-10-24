// Big fluffy clouds. Some float high in the sky; some float low enough
// to bounce on like a soft trampoline.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { makeRandom } from '../util/noise.js';

function puffGeometry(rand, puffs = 9, spread = 1) {
  const parts = [];
  for (let i = 0; i < puffs; i++) {
    const r = (0.6 + rand() * 0.6) * (i === 0 ? 1.35 : 1);
    const g = new THREE.IcosahedronGeometry(r, 3);
    const a = (i / puffs) * Math.PI * 2 + rand();
    const d = i === 0 ? 0 : (0.7 + rand() * 0.6) * spread;
    g.translate(Math.cos(a) * d * 1.3, (rand() * 0.35) + (i === 0 ? 0.25 : 0), Math.sin(a) * d * 0.8);
    parts.push(g);
  }
  const geo = mergeGeometries(parts);
  // flatten the bottom a little so clouds look like real cumulus
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i);
    if (y < -0.15) p.setY(i, -0.15 + (y + 0.15) * 0.35);
  }
  geo.computeVertexNormals();
  return geo;
}

export class Clouds {
  constructor(scene, { count = 26, area = 700, height = [70, 130], seed = 3, bouncy = [] } = {}) {
    const rand = makeRandom(seed);
    this.group = new THREE.Group();
    this.material = new THREE.MeshStandardMaterial({
      color: 0xffffff, roughness: 1, metalness: 0, emissive: new THREE.Color('#d8e6ff'), emissiveIntensity: 0.55,
      flatShading: false,
    });
    this.bouncyMaterial = this.material.clone();
    this.bouncyMaterial.emissiveIntensity = 0.7;
    this.sky = [];
    const geos = [0, 1, 2, 3, 4].map(() => puffGeometry(rand, 8 + Math.floor(rand() * 5)));
    for (let i = 0; i < count; i++) {
      const m = new THREE.Mesh(geos[i % geos.length], this.material);
      const s = 9 + rand() * 14;
      m.scale.set(s, s * (0.55 + rand() * 0.25), s);
      m.position.set((rand() - 0.5) * area, height[0] + rand() * (height[1] - height[0]), (rand() - 0.5) * area);
      m.rotation.y = rand() * Math.PI * 2;
      m.userData.speed = 0.6 + rand() * 0.8;
      this.group.add(m);
      this.sky.push(m);
    }
    // Bouncy clouds the player can land on
    this.bouncy = [];
    for (const b of bouncy) {
      const m = new THREE.Mesh(puffGeometry(rand, 7, 0.8), this.bouncyMaterial);
      const s = b.size ?? 2.4;
      m.scale.set(s, s * 0.6, s);
      m.position.set(b.x, b.y, b.z);
      m.userData = { base: new THREE.Vector3(b.x, b.y, b.z), radius: s * 1.6, squish: 0, phase: rand() * 6 };
      this.group.add(m);
      this.bouncy.push(m);
    }
    scene.add(this.group);
    this.area = area;
  }

  // Returns the bouncy cloud the player is landing on (if any)
  bounceAt(pos, vy) {
    if (vy > 0) return null;
    for (const c of this.bouncy) {
      const d = c.userData;
      const dx = pos.x - c.position.x, dz = pos.z - c.position.z;
      const top = c.position.y + c.scale.y * 0.9;
      if (dx * dx + dz * dz < d.radius * d.radius && pos.y <= top && pos.y > top - 1.6) {
        d.squish = 1;
        return { cloud: c, top };
      }
    }
    return null;
  }

  update(dt, dayNight) {
    const night = dayNight.nightAmount;
    const c = dayNight.current;
    // clouds pick up sunrise/sunset tints
    this.material.emissive.copy(c.horizon).lerp(new THREE.Color('#ffffff'), 0.45);
    this.material.emissiveIntensity = 0.55 - night * 0.5;
    // at night the clouds turn dusky blue so the stars stay the stars of the show
    this.material.color.set('#ffffff').lerp(new THREE.Color('#2c3352'), night * 0.85);
    this.bouncyMaterial.emissive.copy(this.material.emissive).lerp(new THREE.Color('#ffd6ec'), 0.3);
    this.bouncyMaterial.emissiveIntensity = 0.7 - night * 0.4;
    for (const m of this.sky) {
      m.position.x += m.userData.speed * dt;
      if (m.position.x > this.area / 2) m.position.x -= this.area;
    }
    for (const m of this.bouncy) {
      const d = m.userData;
      d.phase += dt;
      d.squish = Math.max(0, d.squish - dt * 2.5);
      const sq = Math.sin(d.squish * Math.PI) * 0.25;
      m.position.y = d.base.y + Math.sin(d.phase * 0.8) * 0.25 - sq;
      const s = m.scale.x;
      m.scale.y = s * 0.6 * (1 - sq);
    }
  }
}
