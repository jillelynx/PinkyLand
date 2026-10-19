// Furry, animated animals: Buddy the dog, Gil and Joe the cats, Molly and Bagel the
// rats, Albany the white squirrel, and little songbirds.
// Fur is made from many thin "shell" layers drawn just above the skin, which reads as
// soft fur instead of smooth shapes. Movement is animated by hand (legs, tail, head).
// When photos of the real animals arrive, adjust each one in PET_LOOKS below.
import * as THREE from 'three';
import { angleDamp, damp, makeRandom } from '../util/noise.js';

// ---------------------------------------------------------------- fur
const furCache = new Map();
function furMaterial({ color, belly = null, bellyMode = 0, density = 90, length = 0.02, layers = 12, droop = 0.5, key = '' }) {
  const id = [color, belly, bellyMode, density, length, layers, droop, key].join('|');
  if (furCache.has(id)) return furCache.get(id);
  const m = new THREE.MeshStandardMaterial({ color, roughness: 1, metalness: 0 });
  const uniforms = {
    uFurLen: { value: length }, uDensity: { value: density }, uDroop: { value: droop },
    uBelly: { value: new THREE.Color(belly || color) }, uBellyMode: { value: bellyMode },
  };
  m.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>
        uniform float uFurLen; uniform float uDensity; uniform float uDroop;
        varying float vLayer; varying vec3 vFurPos; varying vec3 vObjN;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        float layer = (float(gl_InstanceID) + 1.0) / ${layers.toFixed(1)};
        vLayer = layer;
        vFurPos = position * uDensity;
        vObjN = objectNormal;
        transformed += objectNormal * layer * uFurLen;
        transformed.y -= layer * layer * uFurLen * uDroop;`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
        uniform vec3 uBelly; uniform float uBellyMode;
        varying float vLayer; varying vec3 vFurPos; varying vec3 vObjN;
        float furHash(vec3 p){ p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        {
          vec3 cell = floor(vFurPos);
          vec3 f = fract(vFurPos) - 0.5;
          float h = furHash(cell);
          float strand = (0.55 + 0.45 * h) * (1.0 - length(f) * 1.35);
          if (strand < vLayer * 0.9) discard;
          float bellyK = 0.0;
          if (uBellyMode > 0.5) bellyK = smoothstep(-0.05, -0.45, vObjN.y);
          if (uBellyMode > 1.5) bellyK = max(bellyK, smoothstep(0.45, 0.8, vObjN.z) * smoothstep(0.2, -0.2, vObjN.y));
          diffuseColor.rgb = mix(diffuseColor.rgb, uBelly, bellyK);
          diffuseColor.rgb *= mix(0.55, 1.08, vLayer);
        }`);
  };
  m.customProgramCacheKey = () => 'fur' + layers;
  m.userData.layers = layers;
  furCache.set(id, m);
  return m;
}

// A furry body part: a solid base plus fur shells (one draw call for all the shells)
function furry(geo, opts) {
  const g = new THREE.Group();
  const baseColor = new THREE.Color(opts.color).multiplyScalar(0.7);
  const base = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: baseColor, roughness: 1 }));
  base.castShadow = true;
  base.receiveShadow = true;
  g.add(base);
  const mat = furMaterial(opts);
  const shells = new THREE.InstancedMesh(geo, mat, mat.userData.layers);
  const id = new THREE.Matrix4();
  for (let i = 0; i < mat.userData.layers; i++) shells.setMatrixAt(i, id);
  shells.castShadow = false;
  shells.receiveShadow = true;
  shells.frustumCulled = false;
  g.add(shells);
  return g;
}

function ellipsoid(rx, ry, rz, seg = 20) {
  const g = new THREE.SphereGeometry(1, seg, Math.round(seg * 0.7));
  g.scale(rx, ry, rz);
  return g;
}

function capsule(r, len, seg = 10) {
  return new THREE.CapsuleGeometry(r, len, 4, seg);
}

const solid = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.6, ...o });

function eye(r) {
  const g = new THREE.Group();
  const ball = new THREE.Mesh(new THREE.SphereGeometry(r, 14, 10), new THREE.MeshPhysicalMaterial({ color: '#141014', roughness: 0.15, clearcoat: 1 }));
  g.add(ball);
  const glint = new THREE.Mesh(new THREE.SphereGeometry(r * 0.3, 8, 6), new THREE.MeshBasicMaterial({ color: '#ffffff' }));
  glint.position.set(r * 0.35, r * 0.4, r * 0.75);
  g.add(glint);
  return g;
}

// ---------------------------------------------------------------- looks
export const PET_LOOKS = {
  buddy: { // short-legged dog (corgi-like)
    name: 'Buddy', kind: 'dog', len: 0.5, r: 0.13, legLen: 0.08, legR: 0.035, headR: 0.1, snout: 0.08,
    ears: 'pointy', earSize: 0.06, tail: { len: 0.12, r: 0.035, segs: 3, up: 0.6 },
    color: '#d98a3c', belly: '#fff5ea', bellyMode: 2, paws: '#fff5ea', nose: '#2a1a14', innerEar: '#f2b9a0',
    fur: { length: 0.018, layers: 12, density: 160 }, speed: 1.1,
  },
  gil: { // black short-haired cat
    name: 'Gil', kind: 'cat', len: 0.36, r: 0.085, legLen: 0.13, legR: 0.024, headR: 0.075, snout: 0.03,
    ears: 'cat', earSize: 0.05, tail: { len: 0.32, r: 0.018, segs: 6, up: 0.9 },
    color: '#1b1a1f', paws: '#1b1a1f', nose: '#3a2a30', innerEar: '#6a4a55', eyeColor: '#e3c14a',
    fur: { length: 0.008, layers: 8, density: 260 }, speed: 0.7, whiskers: true,
  },
  joe: { // black long-haired cat
    name: 'Joe', kind: 'cat', len: 0.38, r: 0.09, legLen: 0.12, legR: 0.026, headR: 0.078, snout: 0.03,
    ears: 'cat', earSize: 0.05, tail: { len: 0.32, r: 0.03, segs: 6, up: 0.8 },
    color: '#17161b', paws: '#17161b', nose: '#3a2a30', innerEar: '#6a4a55', eyeColor: '#9fd36a',
    fur: { length: 0.04, layers: 16, density: 110, droop: 0.9 }, speed: 0.55, whiskers: true,
  },
  molly: { // gray and white rat
    name: 'Molly', kind: 'rat', len: 0.17, r: 0.045, legLen: 0.025, legR: 0.012, headR: 0.035, snout: 0.035,
    ears: 'round', earSize: 0.022, tail: { len: 0.17, r: 0.007, segs: 6, up: -0.1, bare: true },
    color: '#9a98a2', belly: '#f7f5f2', bellyMode: 2, paws: '#f3d6d6', nose: '#f0a0b0', innerEar: '#f3c0c8',
    fur: { length: 0.006, layers: 8, density: 520 }, speed: 0.9, whiskers: true,
  },
  bagel: { // dark brown rat with white paws
    name: 'Bagel', kind: 'rat', len: 0.18, r: 0.047, legLen: 0.025, legR: 0.012, headR: 0.036, snout: 0.035,
    ears: 'round', earSize: 0.022, tail: { len: 0.18, r: 0.007, segs: 6, up: -0.1, bare: true },
    color: '#3a2618', paws: '#ffffff', nose: '#e898a8', innerEar: '#e8b0b8',
    fur: { length: 0.006, layers: 8, density: 520 }, speed: 0.9, whiskers: true,
  },
  albany: { // white squirrel
    name: 'Albany', kind: 'squirrel', len: 0.2, r: 0.055, legLen: 0.05, legR: 0.016, headR: 0.042, snout: 0.022,
    ears: 'tuft', earSize: 0.025, tail: { len: 0.26, r: 0.04, segs: 6, up: 1.6, bushy: true },
    color: '#f6f4f0', paws: '#f2ece4', nose: '#e8a0a8', innerEar: '#f2c4c8',
    fur: { length: 0.01, layers: 10, density: 320 }, speed: 1.6,
  },
};

// ---------------------------------------------------------------- one animal
export class Pet {
  constructor(look, world, home) {
    this.look = look;
    this.world = world;
    this.name = look.name;
    this.home = { ...home };
    this.root = new THREE.Group();
    this.root.name = look.name;
    this.rand = makeRandom(look.name.length * 13 + 7);
    const L = look;
    const fur = { color: L.color, belly: L.belly, bellyMode: L.bellyMode || 0, ...L.fur, key: L.name };
    const hipY = L.legLen + L.r * 0.85;
    this.hipY = hipY;

    this.body = new THREE.Group(); // tilts for sitting/standing
    this.body.position.y = hipY;
    this.root.add(this.body);
    // torso
    const torso = furry(ellipsoid(L.r, L.r * 0.92, L.len / 2), fur);
    this.body.add(torso);
    this.torso = torso;
    // chest/haunch bulges for a natural silhouette
    const chest = furry(ellipsoid(L.r * 0.95, L.r * 0.95, L.r * 1.1), fur);
    chest.position.set(0, L.r * 0.05, L.len * 0.28);
    this.body.add(chest);
    const haunch = furry(ellipsoid(L.r * 1.02, L.r * 1.0, L.r * 1.15), fur);
    haunch.position.set(0, L.r * 0.05, -L.len * 0.28);
    this.body.add(haunch);

    // head
    this.neck = new THREE.Group();
    this.neck.position.set(0, L.r * 0.55, L.len * 0.42);
    this.body.add(this.neck);
    this.head = new THREE.Group();
    this.head.position.set(0, L.headR * 0.5, L.headR * 0.6);
    this.neck.add(this.head);
    const skull = furry(ellipsoid(L.headR, L.headR * 0.92, L.headR * 1.05), { ...fur, bellyMode: L.kind === 'dog' ? 0 : fur.bellyMode });
    this.head.add(skull);
    // muzzle / snout
    const snoutColor = L.kind === 'dog' ? L.belly : L.color;
    const snout = furry(ellipsoid(L.headR * 0.55, L.headR * 0.45, L.snout * 0.7 + L.headR * 0.3), { ...fur, color: snoutColor, bellyMode: 0, key: L.name + 'snout' });
    snout.position.set(0, -L.headR * 0.22, L.headR * 0.75);
    this.head.add(snout);
    const nose = new THREE.Mesh(new THREE.SphereGeometry(L.headR * (L.kind === 'dog' ? 0.17 : 0.12), 12, 8), solid(L.nose, { roughness: 0.25 }));
    nose.position.set(0, -L.headR * 0.12, L.headR * 0.85 + L.snout * 0.7);
    this.head.add(nose);
    this.nose = nose;
    // eyes
    const er = L.headR * (L.kind === 'rat' || L.kind === 'squirrel' ? 0.2 : 0.17);
    for (const s of [-1, 1]) {
      const e = eye(er);
      if (L.eyeColor) e.children[0].material = new THREE.MeshPhysicalMaterial({ color: L.eyeColor, roughness: 0.15, clearcoat: 1 });
      e.position.set(s * L.headR * 0.48, L.headR * 0.22, L.headR * 0.78);
      if (L.eyeColor) {
        const pupil = new THREE.Mesh(new THREE.SphereGeometry(er * 0.62, 10, 8), new THREE.MeshBasicMaterial({ color: '#0a0a0a' }));
        pupil.scale.set(0.45, 1, 0.5);
        pupil.position.z = er * 0.55;
        e.add(pupil);
      }
      this.head.add(e);
    }
    // ears
    this.ears = [];
    for (const s of [-1, 1]) {
      const ear = new THREE.Group();
      const sz = L.earSize;
      let outer;
      if (L.ears === 'round') {
        outer = new THREE.Mesh(new THREE.SphereGeometry(sz, 14, 10), solid(L.innerEar, { roughness: 0.7 }));
        outer.scale.set(1, 1, 0.3);
      } else {
        outer = furry(new THREE.ConeGeometry(sz * 0.75, sz * 1.6, 10).translate(0, sz * 0.8, 0).scale(1, 1, 0.45), { ...fur, bellyMode: 0, key: L.name + 'ear' });
        const inner = new THREE.Mesh(new THREE.ConeGeometry(sz * 0.45, sz * 1.1, 8).translate(0, sz * 0.6, 0).scale(1, 1, 0.3), solid(L.innerEar, { roughness: 0.8 }));
        inner.position.z = sz * 0.06;
        ear.add(inner);
        if (L.ears === 'tuft') {
          const tuft = new THREE.Mesh(new THREE.ConeGeometry(sz * 0.2, sz * 0.8, 6), solid(L.color));
          tuft.position.y = sz * 1.9;
          ear.add(tuft);
        }
      }
      ear.add(outer);
      ear.position.set(s * L.headR * (L.ears === 'round' ? 0.62 : 0.5), L.headR * 0.68, -L.headR * 0.05);
      ear.rotation.z = -s * (L.ears === 'round' ? 0.5 : 0.25);
      ear.rotation.x = -0.15;
      this.head.add(ear);
      this.ears.push(ear);
    }
    // whiskers
    if (L.whiskers) {
      const wm = new THREE.LineBasicMaterial({ color: L.kind === 'cat' ? '#dddddd' : '#ffffff', transparent: true, opacity: 0.7 });
      const pts = [];
      for (const s of [-1, 1]) for (let k = 0; k < 3; k++) {
        const o = new THREE.Vector3(s * L.headR * 0.25, -L.headR * 0.2, L.headR * 0.9 + L.snout * 0.5);
        pts.push(o, o.clone().add(new THREE.Vector3(s * L.headR * 1.3, (k - 1) * L.headR * 0.25, -L.headR * 0.1)));
      }
      this.head.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pts), wm));
    }

    // legs
    this.legs = [];
    const pawMat = { ...fur, color: L.paws || L.color, bellyMode: 0, key: L.name + 'paw' };
    for (const [sx, sz, front] of [[-1, 1, true], [1, 1, true], [-1, -1, false], [1, -1, false]]) {
      const hip = new THREE.Group();
      hip.position.set(sx * L.r * 0.6, -L.r * 0.35, sz * L.len * 0.3);
      this.body.add(hip);
      const legH = hipY - L.r * 0.5;
      const leg = furry(capsule(L.legR, Math.max(0.001, legH - L.legR * 2)).translate(0, -legH / 2, 0), { ...fur, bellyMode: 0, key: L.name + 'leg' });
      hip.add(leg);
      const paw = furry(ellipsoid(L.legR * 1.25, L.legR * 0.8, L.legR * 1.6).translate(0, 0, L.legR * 0.5), pawMat);
      paw.position.y = -legH + L.legR * 0.6;
      hip.add(paw);
      this.legs.push({ hip, front, side: sx });
    }

    // tail: a chain of segments so it can curl and wag
    this.tail = [];
    const T = L.tail;
    let parent = this.body;
    const segLen = T.len / T.segs;
    const tailFur = T.bushy ? { ...fur, length: 0.045, layers: 16, density: 140, droop: 0.2, bellyMode: 0, key: L.name + 'tail' } : { ...fur, bellyMode: 0, key: L.name + 'tail' };
    for (let i = 0; i < T.segs; i++) {
      const seg = new THREE.Group();
      seg.position.set(0, i === 0 ? L.r * 0.3 : 0, i === 0 ? -L.len * 0.48 : -segLen);
      parent.add(seg);
      const rr = T.r * (1 - (i / T.segs) * (T.bushy ? 0.1 : 0.55));
      const geo = ellipsoid(rr, rr, segLen * 0.65).translate(0, 0, -segLen / 2);
      const m = T.bare ? new THREE.Mesh(geo, solid('#f0c4c8', { roughness: 0.8 })) : furry(geo, tailFur);
      seg.add(m);
      this.tail.push(seg);
      parent = seg;
    }

    // scale up a touch so small animals are easy to see and click on
    this.root.scale.setScalar(L.kind === 'rat' ? 1.35 : L.kind === 'squirrel' ? 1.3 : 1.15);

    // behavior state
    this.pos = this.root.position;
    this.yaw = this.rand() * 6;
    this.speed = 0;
    this.phase = 0;
    this.t = this.rand() * 10;
    this.state = 'idle';
    this.stateT = 1 + this.rand() * 3;
    this.target = null;
    this.pose = { sit: 0, stand: 0, sniff: 0, wag: 0 };
    this.lookYaw = 0;
    this.pos.set(home.x, world.groundHeight(home.x, home.z), home.z);
  }

  pick(r) { return this.rand() < r; }

  chooseNext() {
    const L = this.look;
    const r = this.rand();
    if (L.kind === 'cat') this.state = r < 0.35 ? 'sit' : r < 0.55 ? 'groom' : 'walk';
    else if (L.kind === 'dog') this.state = r < 0.25 ? 'sit' : r < 0.45 ? 'sniff' : 'walk';
    else if (L.kind === 'squirrel') this.state = r < 0.3 ? 'stand' : r < 0.5 ? 'sniff' : r < 0.62 && this.home.tree ? 'climb' : 'walk';
    else this.state = r < 0.35 ? 'stand' : r < 0.6 ? 'sniff' : 'walk';
    this.stateT = 2 + this.rand() * 4;
    if (this.state === 'walk') {
      const a = this.rand() * Math.PI * 2, d = this.rand() * this.home.r;
      this.target = new THREE.Vector2(this.home.x + Math.cos(a) * d, this.home.z + Math.sin(a) * d);
    }
    if (this.state === 'climb') { this.climbY = 0; this.climbUp = true; this.stateT = 9; }
  }

  update(dt, playerPos) {
    const L = this.look;
    const P = this.pose;
    this.t += dt;
    this.stateT -= dt;
    let moveSpeed = 0;
    const dxp = playerPos.x - this.pos.x, dzp = playerPos.z - this.pos.z;
    const pd = Math.hypot(dxp, dzp);

    // Buddy follows Jacinta around when she's close (but stays near home)
    if (this.followPlayer && pd < 7 && pd > 1.4 && Math.hypot(playerPos.x - this.home.x, playerPos.z - this.home.z) < this.home.follow) {
      this.state = 'follow';
      this.target = new THREE.Vector2(playerPos.x - dxp / pd * 1.2, playerPos.z - dzp / pd * 1.2);
      this.stateT = 0.5;
    }

    if (this.state === 'climb') {
      // run up the tree trunk, wait, then run back down
      const tr = this.home.tree;
      const ang = Math.atan2(this.pos.x - tr.x, this.pos.z - tr.z);
      if (this.climbY === 0 && Math.hypot(this.pos.x - tr.x, this.pos.z - tr.z) > 0.42) {
        const tx = tr.x + Math.sin(ang) * 0.38, tz = tr.z + Math.cos(ang) * 0.38;
        this.yaw = angleDamp(this.yaw, Math.atan2(tx - this.pos.x, tz - this.pos.z), 10, dt);
        const d = Math.hypot(tx - this.pos.x, tz - this.pos.z);
        this.pos.x += (tx - this.pos.x) / d * Math.min(d, L.speed * dt);
        this.pos.z += (tz - this.pos.z) / d * Math.min(d, L.speed * dt);
        moveSpeed = L.speed;
        this.pos.y = this.world.terrainHeight(this.pos.x, this.pos.z);
        this.body.rotation.x = damp(this.body.rotation.x, 0, 8, dt);
      } else {
        this.climbY += (this.climbUp ? 1 : -1) * dt * 1.4;
        if (this.climbY > tr.h) { this.climbY = tr.h; if (this.stateT < 5) this.climbUp = false; }
        if (this.climbY <= 0 && !this.climbUp) { this.climbY = 0; this.state = 'idle'; this.stateT = 1; this.body.rotation.x = 0; }
        this.pos.y = this.world.terrainHeight(this.pos.x, this.pos.z) + this.climbY;
        this.yaw = ang + Math.PI; // face the trunk
        this.body.rotation.x = damp(this.body.rotation.x, this.climbUp ? -1.45 : 1.45, 8, dt);
        moveSpeed = this.climbY === tr.h ? 0 : 1.2;
      }
    } else {
      if (this.stateT <= 0 && this.state !== 'follow') this.chooseNext();
      if (this.state === 'follow' && this.stateT <= 0) { this.state = 'idle'; this.stateT = 1; }
      if ((this.state === 'walk' || this.state === 'follow') && this.target) {
        const dx = this.target.x - this.pos.x, dz = this.target.y - this.pos.z;
        const d = Math.hypot(dx, dz);
        if (d < 0.08) { if (this.state === 'walk') { this.state = 'idle'; this.stateT = 1 + this.rand() * 2; } }
        else {
          const sp = (this.state === 'follow' ? 1.6 : 1) * L.speed * Math.min(1, d * 2);
          this.yaw = angleDamp(this.yaw, Math.atan2(dx, dz), 6, dt);
          this.pos.x += Math.sin(this.yaw) * sp * dt;
          this.pos.z += Math.cos(this.yaw) * sp * dt;
          moveSpeed = sp;
        }
      }
      this.world.collide(this.pos, 0.12, 0.3);
      this.pos.y = this.world.groundHeight(this.pos.x, this.pos.z, this.pos.y + 0.3);
    }
    this.speed = damp(this.speed, moveSpeed, 10, dt);
    this.root.rotation.y = this.yaw;

    // poses
    P.sit = damp(P.sit, this.state === 'sit' || this.state === 'groom' ? 1 : 0, 4, dt);
    P.stand = damp(P.stand, this.state === 'stand' ? 1 : 0, 5, dt);
    P.sniff = damp(P.sniff, this.state === 'sniff' ? 1 : 0, 5, dt);
    P.wag = damp(P.wag, pd < 4 || this.state === 'follow' ? 1 : 0.2, 3, dt);
    this.animate(dt, pd, Math.atan2(dxp, dzp));
  }

  animate(dt, pd, toPlayer) {
    const L = this.look;
    const P = this.pose;
    const sp = this.speed;
    const hop = L.kind === 'squirrel' || (L.kind === 'rat' && sp > 0.6);
    this.phase += dt * (sp * (L.kind === 'dog' ? 16 : L.kind === 'cat' ? 9 : 22) + 0.001);
    const ph = this.phase;
    const amp = Math.min(1, sp / Math.max(0.2, L.speed)) * (L.kind === 'cat' ? 0.5 : 0.7);
    // legs
    for (const leg of this.legs) {
      let a;
      if (hop) a = Math.sin(ph + (leg.front ? 0 : Math.PI)) * amp * 0.9;
      else {
        const diag = (leg.front ? 1 : -1) * leg.side > 0 ? 0 : Math.PI; // diagonal pairs move together
        a = Math.sin(ph + diag) * amp;
      }
      // sitting: back legs fold forward, front legs stay straight
      if (!leg.front) a = a * (1 - P.sit) - 1.1 * P.sit - 0.9 * P.stand;
      else a = a * (1 - P.sit) + 0.35 * P.sit - 0.6 * P.stand;
      leg.hip.rotation.x = a;
    }
    // body: bob while walking, sit up, or stand on hind legs
    const bob = hop ? Math.abs(Math.sin(ph)) * 0.06 * amp : Math.abs(Math.sin(ph * 2)) * 0.008 * amp;
    if (this.state !== 'climb') {
      this.body.rotation.x = -0.5 * P.sit - 1.15 * P.stand + 0.25 * P.sniff + (hop ? Math.sin(ph) * 0.15 * amp : 0);
      this.body.position.y = this.hipY + bob - P.sit * this.hipY * 0.35 + P.stand * L.len * 0.25;
    }
    // head: look at Jacinta when she's near, sniff the ground, or groom
    const rel = Math.atan2(Math.sin(toPlayer - this.yaw), Math.cos(toPlayer - this.yaw));
    const want = pd < 5 && Math.abs(rel) < 1.6 ? rel * 0.7 : Math.sin(this.t * 0.6) * 0.35;
    this.lookYaw = damp(this.lookYaw, this.state === 'groom' ? 1.2 * Math.sin(this.t * 1.5) : want, 4, dt);
    this.neck.rotation.y = this.lookYaw;
    this.neck.rotation.x = 0.55 * P.sniff + 0.45 * P.sit + 0.9 * P.stand + (this.state === 'groom' ? 0.5 : 0);
    this.nose.scale.setScalar(1 + Math.sin(this.t * 25) * 0.08 * (P.sniff + (L.kind === 'rat' ? 0.6 : 0)));
    // ears twitch now and then
    const tw = Math.sin(this.t * 1.7) > 0.97 ? 0.3 : 0;
    this.ears.forEach((e, i) => { e.rotation.x = -0.15 - tw * (i ? 1 : 0); });
    // tail: wag (dog), slow sway (cat), curl (squirrel), wiggle (rat)
    const T = L.tail;
    this.tail.forEach((seg, i) => {
      let yaw, pitch;
      // (positive pitch lifts the tail up; negative lets it hang down)
      if (L.kind === 'dog') { yaw = Math.sin(this.t * 14) * 0.6 * P.wag; pitch = i === 0 ? T.up : -0.1; }
      else if (L.kind === 'cat') { yaw = Math.sin(this.t * 1.6 - i * 0.6) * 0.25; pitch = i === 0 ? T.up * (1 - P.sit * 0.8) : i < 3 ? 0.05 : -0.22; }
      else if (L.kind === 'squirrel') { yaw = Math.sin(this.t * 3 - i * 0.5) * 0.12; pitch = i === 0 ? 1.35 : i < this.tail.length - 1 ? 0.32 : -0.5; }
      else { yaw = Math.sin(this.t * 2.5 - i * 0.8) * 0.3; pitch = i === 0 ? -0.25 : -0.06; }
      seg.rotation.set(pitch, yaw, 0);
    });
  }
}

// ---------------------------------------------------------------- songbirds
function bird(color, breast) {
  const g = new THREE.Group();
  const fur = { color, belly: breast, bellyMode: 1, length: 0.006, layers: 6, density: 600, key: 'bird' + color };
  const body = furry(ellipsoid(0.035, 0.032, 0.055), fur);
  g.add(body);
  const head = furry(ellipsoid(0.026, 0.026, 0.026), { ...fur, bellyMode: 0 });
  head.position.set(0, 0.03, 0.045);
  g.add(head);
  const beak = new THREE.Mesh(new THREE.ConeGeometry(0.008, 0.022, 6), solid('#e8a43a'));
  beak.rotation.x = Math.PI / 2;
  beak.position.set(0, 0.026, 0.074);
  g.add(beak);
  for (const s of [-1, 1]) {
    const e = eye(0.0055);
    e.position.set(s * 0.017, 0.036, 0.062);
    g.add(e);
  }
  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.004, 0.05).translate(0, 0, -0.025), solid(color));
  tail.position.set(0, 0.008, -0.05);
  tail.rotation.x = 0.25;
  g.add(tail);
  const wings = [];
  for (const s of [-1, 1]) {
    const pivot = new THREE.Group();
    pivot.position.set(s * 0.025, 0.015, 0.005);
    const shape = new THREE.Shape();
    shape.moveTo(0, 0.02); shape.quadraticCurveTo(0.07, 0.03, 0.09, -0.01); shape.quadraticCurveTo(0.05, -0.04, 0, -0.03); shape.lineTo(0, 0.02);
    const wg = new THREE.ShapeGeometry(shape);
    wg.rotateX(-Math.PI / 2);
    if (s < 0) wg.scale(-1, 1, 1);
    const w = new THREE.Mesh(wg, new THREE.MeshStandardMaterial({ color, side: THREE.DoubleSide, roughness: 0.8 }));
    w.castShadow = true;
    pivot.add(w);
    g.add(pivot);
    wings.push({ pivot, s });
  }
  g.userData.wings = wings;
  g.scale.setScalar(1.6);
  return g;
}

export class Songbirds {
  // perches: places a small bird can be seen when it lands, instead of
  // vanishing into tall grass — { x, z, y, hw, hd } (hw/hd = room to hop)
  constructor(scene, world, { center, count = 5, perches = null }) {
    this.world = world;
    this.perches = perches;
    this.birds = [];
    const colors = [['#5a7ab8', '#f2d0a0'], ['#c0392b', '#f0b090'], ['#8a6a4a', '#e8d8c0'], ['#e8c43a', '#fff0b0'], ['#6a8a5a', '#d8e0c0']];
    const rand = makeRandom(99);
    for (let i = 0; i < count; i++) {
      const [c, b] = colors[i % colors.length];
      const m = bird(c, b);
      scene.add(m);
      this.birds.push({
        m, t: rand() * 10, mode: i < 3 ? 'fly' : 'ground', modeT: 3 + rand() * 6,
        cx: center.x + (rand() - 0.5) * 6, cz: center.z + (rand() - 0.5) * 6, r: 4 + rand() * 6, h: 3 + rand() * 4,
        dir: rand() < 0.5 ? 1 : -1, gx: center.x + (rand() - 0.5) * 8, gz: center.z + (rand() - 0.5) * 6, hopT: 0, yaw: rand() * 6,
        center,
      });
    }
    this.rand = rand;
  }

  _pickPerch(b) {
    if (this.perches && this.perches.length) {
      // a perch not too far from where it is flying
      const p = b.m.position;
      const near = this.perches.filter((q) => Math.hypot(q.x - p.x, q.z - p.z) < 16);
      const list = near.length ? near : this.perches;
      const q = list[Math.floor(this.rand() * list.length)];
      b.perch = q;
      b.gx = q.x + (this.rand() - 0.5) * 2 * q.hw;
      b.gz = q.z + (this.rand() - 0.5) * 2 * q.hd;
    } else {
      b.perch = null;
      b.gx = b.center.x + (this.rand() - 0.5) * 10; b.gz = b.center.z + (this.rand() - 0.5) * 6;
    }
  }

  update(dt, playerPos) {
    if (!this._placed) {
      // birds that start on the ground start on a perch
      this._placed = true;
      for (const b of this.birds) if (b.mode === 'ground') { this._pickPerch(b); b.m.position.set(b.gx, b.perch ? b.perch.y : this.world.groundHeight(b.gx, b.gz), b.gz); }
    }
    for (const b of this.birds) {
      b.t += dt;
      b.modeT -= dt;
      const wings = b.m.userData.wings;
      if (b.mode === 'fly') {
        const a = b.t * 0.55 * b.dir;
        const x = b.cx + Math.cos(a) * b.r, z = b.cz + Math.sin(a) * b.r * 0.8;
        const y = this.world.terrainHeight(x, z) + b.h + Math.sin(b.t * 1.3) * 0.6;
        const nx = b.cx + Math.cos(a + 0.05 * b.dir) * b.r, nz = b.cz + Math.sin(a + 0.05 * b.dir) * b.r * 0.8;
        b.m.position.set(x, y, z);
        b.m.rotation.set(0, Math.atan2(nx - x, nz - z), -b.dir * 0.3);
        // flap, then glide for a moment (like real small birds)
        const flapping = Math.sin(b.t * 1.5) > -0.4;
        const f = flapping ? Math.sin(b.t * 38) * 1.0 : 0.15;
        wings.forEach((w) => { w.pivot.rotation.z = w.s * f; });
        if (b.modeT < 0) { b.mode = 'landing'; b.modeT = 0; this._pickPerch(b); }
      } else if (b.mode === 'landing') {
        const tx = b.gx, tz = b.gz, ty = b.perch ? b.perch.y : this.world.groundHeight(tx, tz);
        const p = b.m.position;
        const d = Math.hypot(tx - p.x, tz - p.z, ty - p.y);
        if (d < 0.1) { b.mode = 'ground'; b.modeT = 4 + this.rand() * 6; }
        else {
          const k = Math.min(1, (dt * 3.5) / d);
          b.m.rotation.set(0, Math.atan2(tx - p.x, tz - p.z), 0);
          p.x += (tx - p.x) * k * 1.2; p.y += (ty - p.y) * k * 1.2; p.z += (tz - p.z) * k * 1.2;
          wings.forEach((w) => { w.pivot.rotation.z = w.s * Math.sin(b.t * 40) * 0.9; });
        }
      } else {
        // hopping and pecking on the ground
        const p = b.m.position;
        b.hopT -= dt;
        if (b.hopT < 0) { b.hopT = 0.4 + this.rand() * 1.2; b.yaw += (this.rand() - 0.5) * 2; b.hopping = 0.25; }
        const pr = b.perch;
        if (b.hopping > 0) {
          b.hopping -= dt;
          if (!pr || pr.hw > 0) { p.x += Math.sin(b.yaw) * dt * 0.5; p.z += Math.cos(b.yaw) * dt * 0.5; }
          // stay on the perch (sidewalk, path, fence post)
          if (pr) { p.x = Math.min(pr.x + pr.hw, Math.max(pr.x - pr.hw, p.x)); p.z = Math.min(pr.z + pr.hd, Math.max(pr.z - pr.hd, p.z)); }
        }
        const peck = b.hopping > 0 ? 0 : Math.max(0, Math.sin(b.t * 9)) * 0.5;
        p.y = (pr ? pr.y : this.world.groundHeight(p.x, p.z)) + (b.hopping > 0 ? Math.sin((b.hopping / 0.25) * Math.PI) * 0.05 : 0);
        b.m.rotation.set(peck, b.yaw, 0);
        wings.forEach((w) => { w.pivot.rotation.z = w.s * 0.1; });
        // fly away if Jacinta comes running close, or after a while
        const close = Math.hypot(playerPos.x - p.x, playerPos.z - p.z) < 2.2;
        if (b.modeT < 0 || close) {
          b.mode = 'fly'; b.modeT = 5 + this.rand() * 8;
          b.cx = p.x; b.cz = p.z; b.t = 0;
          b.cx -= Math.cos(0) * b.r; // start the loop from where it is
        }
      }
    }
  }
}
