// Friendly dragons of Pinky Land — each from a different storytelling tradition —
// plus dragon-winged horses and Belly Button the plush bear.
// Everything here is gentle: dragons glow, puff sparkles, giggle and chat.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { makeRandom, angleDamp, damp, smoothstep, lerp } from '../util/noise.js';

const UP = new THREE.Vector3(0, 1, 0);
const _v = new THREE.Vector3(), _w = new THREE.Vector3(), _m = new THREE.Matrix4();

const mats = new Map();
function std(color, o = {}) {
  const key = color + JSON.stringify(o);
  if (!mats.has(key)) mats.set(key, new THREE.MeshStandardMaterial({ color, roughness: 0.6, ...o }));
  return mats.get(key);
}
function mesh(geo, mat) { const m = new THREE.Mesh(geo, mat); m.castShadow = true; m.receiveShadow = true; return m; }
function sphere(r, mat, sx = 1, sy = 1, sz = 1) { const m = mesh(new THREE.SphereGeometry(r, 24, 16), mat); m.scale.set(sx, sy, sz); return m; }

// Scales: rows of little arcs, with a lighter striped belly band around v = 0.5
function scaleTexture(base, dark, belly, { feather = false } = {}) {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = base; g.fillRect(0, 0, 256, 128);
  g.strokeStyle = dark; g.lineWidth = 2;
  for (let y = 0; y < 128; y += 10) for (let x = (y / 10) % 2 ? 0 : 8; x < 256; x += 16) {
    g.beginPath(); g.arc(x, y, feather ? 9 : 7, 0.15 * Math.PI, 0.85 * Math.PI); g.stroke();
  }
  // belly band with plates
  g.fillStyle = belly; g.fillRect(0, 40, 256, 48);
  g.strokeStyle = 'rgba(0,0,0,0.12)'; g.lineWidth = 2;
  for (let x = 0; x < 256; x += 16) { g.beginPath(); g.moveTo(x, 40); g.lineTo(x, 88); g.stroke(); }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = THREE.RepeatWrapping; t.wrapT = THREE.RepeatWrapping;
  return t;
}

// Big, friendly cartoon eye: white, a large iris, and a sparkle
function friendlyEye(r, iris = '#3a2a1a') {
  const g = new THREE.Group();
  g.add(sphere(r, std('#ffffff', { roughness: 0.25 })));
  const ir = sphere(r * 0.62, std(iris, { roughness: 0.2 }), 1, 1, 0.5);
  ir.position.z = r * 0.72; g.add(ir);
  const pu = sphere(r * 0.36, std('#0b0b10', { roughness: 0.1 }), 1, 1, 0.5);
  pu.position.z = r * 0.86; g.add(pu);
  const hl = new THREE.Mesh(new THREE.SphereGeometry(r * 0.16, 10, 8), new THREE.MeshBasicMaterial({ color: '#ffffff' }));
  hl.position.set(r * 0.25, r * 0.3, r * 0.95); g.add(hl);
  return g;
}

// ---------------------------------------------------------------- a smooth body tube
// Rebuilt every frame from a "spine" of points (head first), so serpents can
// wiggle, swim and fly naturally.
export class SerpentBody {
  constructor(n, sides, radiusFn, material, uRepeat = 6) {
    this.n = n; this.sides = sides; this.radiusFn = radiusFn;
    const verts = n * (sides + 1);
    this.pos = new Float32Array(verts * 3);
    this.nor = new Float32Array(verts * 3);
    const uv = new Float32Array(verts * 2);
    const idx = [];
    for (let i = 0; i < n; i++) for (let j = 0; j <= sides; j++) {
      const k = i * (sides + 1) + j;
      uv[k * 2] = (i / (n - 1)) * uRepeat; uv[k * 2 + 1] = j / sides;
      if (i < n - 1 && j < sides) { const a = k, b = k + sides + 1; idx.push(a, b, a + 1, b, b + 1, a + 1); }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.BufferAttribute(this.nor, 3));
    g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    g.setIndex(idx);
    this.geo = g;
    this.mesh = new THREE.Mesh(g, material);
    this.mesh.castShadow = true; this.mesh.receiveShadow = true;
    this.mesh.frustumCulled = false;
    this.frames = Array.from({ length: n }, () => ({ p: new THREE.Vector3(), t: new THREE.Vector3(), side: new THREE.Vector3(1, 0, 0), up: new THREE.Vector3(0, 1, 0), r: 0 }));
  }

  update(spine) {
    const n = this.n, S = this.sides;
    let lastSide = this.frames[0].side;
    for (let i = 0; i < n; i++) {
      const f = this.frames[i];
      const a = spine[Math.max(0, i - 1)], b = spine[Math.min(n - 1, i + 1)];
      f.p.copy(spine[i]);
      f.t.subVectors(a, b); // points toward the head
      if (f.t.lengthSq() < 1e-8) f.t.set(0, 0, 1);
      f.t.normalize();
      f.side.crossVectors(UP, f.t);
      if (f.side.lengthSq() < 1e-4) f.side.copy(lastSide); else f.side.normalize();
      f.up.crossVectors(f.t, f.side).normalize();
      lastSide = f.side;
      f.r = this.radiusFn(i / (n - 1));
      for (let j = 0; j <= S; j++) {
        const ang = (j / S) * Math.PI * 2;
        const ca = Math.cos(ang), sa = Math.sin(ang);
        const nx = f.up.x * ca + f.side.x * sa, ny = f.up.y * ca + f.side.y * sa, nz = f.up.z * ca + f.side.z * sa;
        const k = (i * (S + 1) + j) * 3;
        this.pos[k] = f.p.x + nx * f.r; this.pos[k + 1] = f.p.y + ny * f.r; this.pos[k + 2] = f.p.z + nz * f.r;
        this.nor[k] = nx; this.nor[k + 1] = ny; this.nor[k + 2] = nz;
      }
    }
    this.geo.attributes.position.needsUpdate = true;
    this.geo.attributes.normal.needsUpdate = true;
    this.geo.computeBoundingSphere();
  }
}

// Spikes or frills along the top of a body tube
class DorsalRow {
  constructor(scene, count, geo, mat) {
    this.im = new THREE.InstancedMesh(geo, mat, count);
    this.im.castShadow = true; this.im.frustumCulled = false;
    this.count = count;
    scene.add(this.im);
    this._q = new THREE.Quaternion(); this._s = new THREE.Vector3(); this._p = new THREE.Vector3();
  }
  // place one spike on each chosen frame of a body
  update(body, from, to, sizeFn) {
    const fr = body.frames;
    for (let k = 0; k < this.count; k++) {
      const i = Math.round(lerp(from, to, k / Math.max(1, this.count - 1)) * (fr.length - 1));
      const f = fr[i];
      this._p.copy(f.p).addScaledVector(f.up, f.r * 0.85);
      // y axis = up, tilted back along the body
      _m.makeBasis(f.side, _v.copy(f.up).addScaledVector(f.t, -0.5).normalize(), _w.crossVectors(f.side, _v).normalize());
      this._q.setFromRotationMatrix(_m);
      const s = sizeFn(k / Math.max(1, this.count - 1), f.r);
      this._s.set(s, s, s);
      _m.compose(this._p, this._q, this._s);
      this.im.setMatrixAt(k, _m);
    }
    this.im.instanceMatrix.needsUpdate = true;
  }
}

// ---------------------------------------------------------------- bat-like dragon wing
export class DragonWing {
  constructor({ span = 2.6, chord = 1.5, membrane = '#ffb36b', bone = '#c0392b', side = 1 }) {
    this.side = side;
    this.pivot = new THREE.Group();
    // finger tips fan out from the wrist; the trailing edge scallops between them
    const wrist = new THREE.Vector2(span * 0.42, 0.18);
    const tips = [new THREE.Vector2(span, 0.0), new THREE.Vector2(span * 0.86, -chord * 0.62), new THREE.Vector2(span * 0.6, -chord * 0.95), new THREE.Vector2(span * 0.3, -chord * 1.0)];
    const shape = new THREE.Shape();
    shape.moveTo(0, 0.1);
    shape.lineTo(wrist.x, wrist.y);
    shape.lineTo(tips[0].x, tips[0].y);
    let prev = tips[0];
    for (let i = 1; i < tips.length; i++) {
      const t = tips[i];
      const mid = new THREE.Vector2((prev.x + t.x) / 2, (prev.y + t.y) / 2).lerp(wrist, 0.28);
      shape.quadraticCurveTo(mid.x, mid.y, t.x, t.y);
      prev = t;
    }
    shape.quadraticCurveTo(span * 0.1, -chord * 0.7, 0, -chord * 0.45);
    shape.lineTo(0, 0.1);
    const g = new THREE.ShapeGeometry(shape, 10);
    g.rotateX(Math.PI / 2); // lie flat: x = out, the skin trails back toward -z (behind the bones)
    if (side < 0) { g.scale(-1, 1, 1); }
    const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: membrane, side: THREE.DoubleSide, roughness: 0.7 }));
    m.castShadow = true;
    this.pivot.add(m);
    // arm and finger bones
    const bm = std(bone, { roughness: 0.5 });
    const boneTo = (a, b, r) => {
      const A = new THREE.Vector3(a.x * side, 0.02, a.y), B = new THREE.Vector3(b.x * side, 0.02, b.y);
      const len = A.distanceTo(B);
      const c = mesh(new THREE.CylinderGeometry(r * 0.6, r, len, 8), bm);
      c.position.copy(A).add(B).multiplyScalar(0.5);
      c.quaternion.setFromUnitVectors(UP, B.clone().sub(A).normalize());
      this.pivot.add(c);
    };
    boneTo(new THREE.Vector2(0, 0.1), wrist, span * 0.035);
    for (const t of tips) boneTo(wrist, t, span * 0.018);
    const claw = mesh(new THREE.ConeGeometry(span * 0.03, span * 0.08, 8), std('#fff2d6'));
    claw.position.set(wrist.x * side, 0.05, wrist.y + 0.02); claw.rotation.x = 0.6;
    this.pivot.add(claw);
    this.flap = 0; this.fold = 1;
  }
  // flap: -1..1 (down..up), fold: 0 spread .. 1 folded on the back
  pose(flap, fold) {
    const s = this.side;
    this.pivot.rotation.set(0, 0, 0);
    this.pivot.rotation.z = s * (flap * 0.75 + fold * 0.95);
    this.pivot.rotation.y = s * fold * 0.95;
    this.pivot.scale.set(1 - fold * 0.5, 1, 1 - fold * 0.25);
  }
}

// ---------------------------------------------------------------- helpers for flight paths
function groundAt(world, x, z) { return Math.max(world.terrainHeight(x, z), world.waterLevel); }

// keeps a trail of where the head has been, so the body can follow it
class Trail {
  constructor(start, segLen, n) {
    this.pts = [start.clone()];
    this.segLen = segLen; this.n = n;
    this.spine = Array.from({ length: n }, (_, i) => start.clone().add(new THREE.Vector3(0, 0, -i * segLen)));
  }
  push(p) {
    if (p.distanceTo(this.pts[0]) > this.segLen * 0.25) {
      this.pts.unshift(p.clone());
      if (this.pts.length > this.n * 6) this.pts.length = this.n * 6;
    } else this.pts[0].copy(p);
    // walk back along the trail placing a spine point every segLen
    let i = 1, acc = 0, prev = this.pts[0];
    this.spine[0].copy(this.pts[0]);
    for (let k = 1; k < this.pts.length && i < this.n; k++) {
      const cur = this.pts[k];
      let d = prev.distanceTo(cur);
      let from = prev.clone();
      while (acc + d >= this.segLen && i < this.n) {
        const t = (this.segLen - acc) / d;
        from.lerp(cur, t);
        this.spine[i].copy(from);
        d -= this.segLen - acc; acc = 0; i++;
      }
      acc += d; prev = cur;
    }
    // not enough trail yet: continue straight back
    for (; i < this.n; i++) {
      if (i >= 2) _v.subVectors(this.spine[i - 2], this.spine[i - 1]); else _v.set(0, 0, 0);
      if (_v.lengthSq() < 1e-8) _v.set(0, 0, 1);
      this.spine[i].copy(this.spine[i - 1]).addScaledVector(_v.normalize(), -this.segLen);
    }
  }
}

// ---------------------------------------------------------------- the dragons
// colours for the round winged dragons: Sir Ember (red) and Frost (snowy white)
export const EMBER_LOOK = { body: '#e0553a', belly: '#ffd38a', dark: '#a8352a', stripe: '#f0b860', spike: '#ffcf5a', eye: '#3b7a2e', membrane: '#ffb36b', bone: '#c0392b', puff: '#ffd36a' };
export const FROST_LOOK = { body: '#f4f8ff', belly: '#cfe9ff', dark: '#a9c8e8', stripe: '#a8d8ff', spike: '#8fd3ff', eye: '#3a7bd5', membrane: '#bfe6ff', bone: '#6aa8d8', puff: '#d8f4ff' };
export const DRAGON_INFO = {
  ember: { name: 'Sir Ember', key: 'dragon-ember', color: '#e0553a' },
  long: { name: 'Lóng Mei', key: 'dragon-long', color: '#e23d3d' },
  fjola: { name: 'Fjola', key: 'dragon-fjola', color: '#2f8fb0' },
  quetzi: { name: 'Quetzi', key: 'dragon-quetzi', color: '#2fae6a' },
  frost: { name: 'Frost', key: 'dragon-frost', color: '#7fc4f0' },
};

// A sparkly puff (instead of fire — Pinky Land dragons breathe sparkles!)
class SparklePuff {
  constructor(scene, color) {
    this.n = 40;
    const g = new THREE.BufferGeometry();
    this.p = new Float32Array(this.n * 3); this.v = new Float32Array(this.n * 3); this.life = new Float32Array(this.n);
    g.setAttribute('position', new THREE.BufferAttribute(this.p, 3));
    this.pts = new THREE.Points(g, new THREE.PointsMaterial({ color, size: 0.22, transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending }));
    this.pts.frustumCulled = false;
    scene.add(this.pts);
    this.k = 0;
  }
  emit(pos, dir, count = 14) {
    for (let c = 0; c < count; c++) {
      const i = this.k++ % this.n;
      this.p.set([pos.x, pos.y, pos.z], i * 3);
      this.v.set([dir.x * 3 + (Math.random() - 0.5) * 1.5, dir.y * 3 + Math.random() * 1.2, dir.z * 3 + (Math.random() - 0.5) * 1.5], i * 3);
      this.life[i] = 1;
    }
  }
  update(dt) {
    for (let i = 0; i < this.n; i++) {
      if (this.life[i] <= 0) { this.p[i * 3 + 1] = -999; continue; }
      this.life[i] -= dt * 0.9;
      for (let a = 0; a < 3; a++) this.p[i * 3 + a] += this.v[i * 3 + a] * dt;
      this.v[i * 3 + 1] += dt * 0.6;
    }
    this.pts.geometry.attributes.position.needsUpdate = true;
  }
}

// ---- Sir Ember: a round, friendly castle-story dragon with bat wings
export class WesternDragon {
  constructor(scene, world, { home, yaw = 0, roam, look = EMBER_LOOK, info = DRAGON_INFO.ember }) {
    this.scene = scene; this.world = world; this.home = home; this.homeYaw = yaw; this.roam = roam;
    this.info = info;
    this.name = this.info.name;
    const L = look;
    const { body, belly, dark } = L;
    const skin = new THREE.MeshStandardMaterial({ map: scaleTexture(body, dark, belly), roughness: 0.55 });
    const plain = std(body, { roughness: 0.55 }), bellyM = std(belly, { roughness: 0.6 }), horn = std('#fff2d6', { roughness: 0.4 });
    this.root = new THREE.Group();
    this.bodyG = new THREE.Group(); // tilts and bobs
    this.root.add(this.bodyG);
    // torso + belly
    const torso = sphere(1, plain, 0.95, 0.85, 1.55);
    this.bodyG.add(torso);
    const bel = sphere(1, bellyM, 0.8, 0.72, 1.35);
    bel.position.set(0, -0.2, 0.15);
    this.bodyG.add(bel);
    // belly stripes
    for (let i = 0; i < 6; i++) {
      const s = mesh(new THREE.TorusGeometry(0.62, 0.025, 6, 24, Math.PI), std(L.stripe));
      s.rotation.set(0, Math.PI / 2, Math.PI); s.position.set(0, -0.28, -0.6 + i * 0.28);
      s.scale.set(1.05 - Math.abs(i - 2.5) * 0.08, 1, 1);
      this.bodyG.add(s);
    }
    // legs (thigh + foot with claws)
    this.legs = [];
    for (const [sx, sz] of [[-1, 1], [1, 1], [-1, -1], [1, -1]]) {
      const hip = new THREE.Group();
      hip.position.set(sx * 0.62, -0.35, sz * 0.82);
      this.bodyG.add(hip);
      const thigh = sphere(0.36, plain, 0.9, 1.25, 1);
      thigh.position.y = -0.3; hip.add(thigh);
      const foot = sphere(0.26, plain, 1, 0.6, 1.35);
      foot.position.set(0, -0.72, 0.12); hip.add(foot);
      for (let c = -1; c <= 1; c++) { const cl = mesh(new THREE.ConeGeometry(0.05, 0.14, 8), horn); cl.rotation.x = Math.PI / 2; cl.position.set(c * 0.11, -0.76, 0.46); hip.add(cl); }
      this.legs.push({ hip, sx, sz });
    }
    // neck and tail tubes
    this.neck = new SerpentBody(10, 14, (t) => lerp(0.42, 0.3, t), skin, 2);
    this.tail = new SerpentBody(22, 12, (t) => 0.48 * Math.pow(1 - t, 0.9) + 0.04, skin, 5);
    scene.add(this.neck.mesh, this.tail.mesh);
    this.neckSpine = Array.from({ length: 10 }, () => new THREE.Vector3());
    this.tailSpine = Array.from({ length: 22 }, () => new THREE.Vector3());
    // spade on the tail tip
    this.spade = mesh(new THREE.OctahedronGeometry(0.28, 0), std(L.spike));
    this.spade.scale.set(1, 0.25, 1.4);
    scene.add(this.spade);
    // back spikes
    const spikeGeo = new THREE.ConeGeometry(0.12, 0.38, 8).translate(0, 0.19, 0);
    this.tailSpikes = new DorsalRow(scene, 10, spikeGeo, std(L.spike, { roughness: 0.4 }));
    this.neckSpikes = new DorsalRow(scene, 5, spikeGeo, std(L.spike, { roughness: 0.4 }));
    for (let i = 0; i < 4; i++) { const sp = mesh(spikeGeo, std(L.spike)); sp.position.set(0, 0.8, 0.9 - i * 0.55); sp.rotation.x = -0.4; sp.scale.setScalar(1.1); this.bodyG.add(sp); }
    // head
    this.head = new THREE.Group();
    scene.add(this.head);
    const skull = sphere(0.5, plain, 1, 0.92, 1);
    this.head.add(skull);
    const snout = mesh(new RoundedBoxGeometry(0.62, 0.42, 0.7, 4, 0.18), plain);
    snout.position.set(0, -0.1, 0.48); this.head.add(snout);
    const chin = mesh(new RoundedBoxGeometry(0.52, 0.16, 0.6, 3, 0.07), bellyM);
    chin.position.set(0, -0.3, 0.45); this.head.add(chin);
    for (const s of [-1, 1]) {
      const e = friendlyEye(0.16, L.eye);
      e.position.set(s * 0.27, 0.12, 0.3); e.rotation.y = s * 0.35;
      this.head.add(e);
      const brow = mesh(new THREE.CapsuleGeometry(0.05, 0.16, 4, 8), std(dark));
      brow.rotation.z = Math.PI / 2 + s * 0.25; brow.position.set(s * 0.27, 0.32, 0.36); this.head.add(brow);
      // swept-back horns
      const hornG = new THREE.Group();
      const h1 = mesh(new THREE.ConeGeometry(0.09, 0.55, 10).translate(0, 0.27, 0), horn);
      h1.rotation.x = -1.0; hornG.add(h1);
      hornG.position.set(s * 0.25, 0.38, -0.12); hornG.rotation.z = -s * 0.3;
      this.head.add(hornG);
      // little frilly ears
      const ear = mesh(new THREE.ConeGeometry(0.12, 0.3, 4).scale(1, 1, 0.3), std(L.membrane));
      ear.position.set(s * 0.48, 0.18, -0.05); ear.rotation.z = -s * 1.1; this.head.add(ear);
      // nostrils glow warmly
      const n = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), new THREE.MeshBasicMaterial({ color: L.puff }));
      n.position.set(s * 0.12, 0.04, 0.83); this.head.add(n);
    }
    // a big smile
    const smile = mesh(new THREE.TorusGeometry(0.2, 0.02, 6, 20, Math.PI * 0.8), std('#6a1f1a'));
    smile.rotation.set(Math.PI, 0, Math.PI * 0.1); smile.position.set(0, -0.12, 0.83); smile.rotation.x = Math.PI + 0.2;
    this.head.add(smile);
    // wings
    this.wings = [1, -1].map((s) => { const w = new DragonWing({ span: 3.0, chord: 1.7, membrane: L.membrane, bone: L.bone, side: s }); w.pivot.position.set(s * 0.55, 0.62, 0.45); this.bodyG.add(w.pivot); return w; });
    this.puff = new SparklePuff(scene, L.puff);
    scene.add(this.root);
    // behaviour
    this.state = 'rest'; this.stateT = 50 + Math.random() * 20;
    this.t = Math.random() * 10;
    this.pos = this.root.position;
    this.pos.set(home.x, world.terrainHeight(home.x, home.z), home.z);
    this.yaw = yaw;
    this.fly = 0; // 0 sitting .. 1 flying
    this.flyAng = 0;
    this.lookYaw = 0; this.lookPitch = 0;
    this.headPos = new THREE.Vector3();
  }

  get canTalk() { return !this.ridden && this.state === 'rest' && this.fly < 0.05; }
  talkPos() { return this.pos; }
  // where a rider sits: on his back, just in front of the wings
  seat(out = new THREE.Vector3()) { this.root.updateMatrixWorld(true); return this.bodyG.localToWorld(out.set(0, 0.92, 0.55)); }
  startRide() { this.ridden = true; this.state = 'ride'; this.rideFly = this.fly; this.rideBank = 0; }
  endRide() { this.ridden = false; this.state = 'return'; this.root.rotation.z = 0; }

  update(dt, ctx) {
    this.t += dt;
    const W = this.world, P = ctx.playerPos;
    this.stateT -= dt;
    const homeY = W.terrainHeight(this.home.x, this.home.z);
    if (this.ridden) {
      // a friend is riding: the level steers him (pos + yaw); he just flaps or walks
      this.fly = damp(this.fly, this.rideFly, 3, dt);
    } else if (this.state === 'rest') {
      this.fly = damp(this.fly, 0, 2, dt);
      this.pos.x = damp(this.pos.x, this.home.x, 1, dt); this.pos.z = damp(this.pos.z, this.home.z, 1, dt);
      this.pos.y = damp(this.pos.y, homeY, 2, dt);
      this.yaw = angleDamp(this.yaw, this.homeYaw, 1.2, dt);
      // don't fly away while a friend is chatting nearby
      if (this.stateT < 0 && Math.hypot(P.x - this.pos.x, P.z - this.pos.z) > 14) { this.state = 'takeoff'; this.stateT = 3; }
      if (Math.random() < dt * 0.08) this.puffSparkles();
    } else if (this.state === 'takeoff') {
      this.fly = damp(this.fly, 1, 1.5, dt);
      this.pos.y += dt * (2 + this.fly * 3);
      this.flyAng = Math.atan2(this.pos.z - this.roam.z, this.pos.x - this.roam.x);
      if (this.stateT < 0) { this.state = 'fly'; this.stateT = 34; }
    } else if (this.state === 'fly') {
      this.fly = 1;
      this.flyAng += dt * 0.16;
      const R = this.roam.r;
      const tx = this.roam.x + Math.cos(this.flyAng) * R, tz = this.roam.z + Math.sin(this.flyAng) * R;
      const ty = Math.max(groundAt(W, tx, tz) + 12, 22) + Math.sin(this.t * 0.6) * 2;
      const dx = tx - this.pos.x, dz = tz - this.pos.z;
      this.pos.x += dx * Math.min(1, dt * 0.8); this.pos.z += dz * Math.min(1, dt * 0.8); this.pos.y = damp(this.pos.y, ty, 0.8, dt);
      this.yaw = angleDamp(this.yaw, Math.atan2(-Math.sin(this.flyAng), Math.cos(this.flyAng)), 2, dt);
      if (this.stateT < 0) { this.state = 'return'; }
    } else if (this.state === 'return') {
      const dx = this.home.x - this.pos.x, dz = this.home.z - this.pos.z, d = Math.hypot(dx, dz);
      const sp = Math.min(9, d * 0.8 + 1);
      if (d > 0.3) { this.pos.x += (dx / d) * sp * dt; this.pos.z += (dz / d) * sp * dt; this.yaw = angleDamp(this.yaw, Math.atan2(dx, dz), 2, dt); }
      const ty = homeY + Math.min(20, d * 0.5);
      this.pos.y = damp(this.pos.y, ty, 1.2, dt);
      if (d < 0.6 && this.pos.y - homeY < 0.6) { this.state = 'rest'; this.stateT = 60 + Math.random() * 30; }
      this.fly = d < 6 ? damp(this.fly, 0.35, 2, dt) : 1;
    }
    // keep clear of the ground while flying
    if (this.state !== 'rest') this.pos.y = Math.max(this.pos.y, W.terrainHeight(this.pos.x, this.pos.z));
    this.root.rotation.y = this.yaw;
    this.root.rotation.z = this.ridden ? this.rideBank : 0;
    const f = this.fly;
    // body: lying down (resting) or stretched out (flying), breathing
    const breath = Math.sin(this.t * 1.6) * 0.03;
    this.bodyG.position.y = lerp(0.85, 1.3, Math.min(1, f * 2)) + breath;
    this.bodyG.scale.set(1 + breath * 0.6, 1 + breath, 1);
    this.bodyG.rotation.x = f > 0.5 ? -0.08 + Math.sin(this.t * 3) * 0.04 : 0;
    // legs: tucked flat when resting, dangling and tucked when flying
    for (const l of this.legs) {
      l.hip.rotation.x = lerp(l.sz > 0 ? -0.9 : 0.9, l.sz > 0 ? 0.6 : -0.9, f);
      l.hip.rotation.z = lerp(l.sx * 0.5, 0, f);
    }
    // wings: folded at rest, a slow sleepy stretch now and then; flapping in the air
    const flap = f > 0.3 ? Math.sin(this.t * 4.2) : Math.sin(this.t * 0.5) > 0.985 ? Math.sin(this.t * 6) * 0.5 : 0;
    for (const w of this.wings) w.pose(flap, 1 - Math.min(1, f * 1.5));
    this.root.updateMatrixWorld(true);
    // neck curve up to the head; the head looks at a nearby friend
    const near = P && this.pos.distanceTo(P) < 14 && f < 0.2;
    const toP = _v.copy(P).sub(this.pos);
    const wantYaw = near ? THREE.MathUtils.clamp(Math.atan2(toP.x, toP.z) - this.yaw, -1.2, 1.2) : Math.sin(this.t * 0.3) * 0.3;
    this.lookYaw = angleDamp(this.lookYaw, wantYaw, 2, dt);
    const nb = this.bodyG.localToWorld(new THREE.Vector3(0, 0.5, 1.15));
    const hl = new THREE.Vector3(Math.sin(this.lookYaw) * 1.1, lerp(1.35, 0.35, f) + 0.6, 1.1 + Math.cos(this.lookYaw) * 0.9);
    const hp = this.bodyG.localToWorld(hl);
    for (let i = 0; i < 10; i++) {
      const t = i / 9;
      // a gentle S-curve from chest to head
      const mid = this.bodyG.localToWorld(new THREE.Vector3(Math.sin(this.lookYaw) * 0.4, 0.5 + lerp(1.35, 0.35, f) * 0.9, 1.6));
      _w.copy(nb).lerp(mid, t).lerp(_v.copy(mid).lerp(hp, t), t);
      this.neckSpine[9 - i].copy(_w);
    }
    this.neck.update(this.neckSpine);
    this.head.position.copy(hp);
    const fwd = this.bodyG.localToWorld(new THREE.Vector3(Math.sin(this.lookYaw) * 4, hl.y - (f > 0.5 ? 0.6 : 0.1), 1.1 + Math.cos(this.lookYaw) * 4));
    this.head.lookAt(fwd);
    this.headPos.copy(hp);
    // tail: curls around beside him when resting, streams behind when flying
    for (let i = 0; i < 22; i++) {
      const t = i / 21;
      const sway = Math.sin(this.t * 1.4 - t * 3) * (0.25 + t * 0.5);
      const restX = Math.sin(t * 2.4) * 1.6 * t + sway * 0.4, restZ = -1.3 - Math.sin(t * 2.0) * 1.9 + t * 0.4;
      const flyX = sway * 0.6, flyZ = -1.3 - t * 3.6;
      const lp = new THREE.Vector3(lerp(restX, flyX, f), lerp(-0.55 - t * 0.25, -0.1 + t * 0.2, f) + (f > 0.5 ? Math.sin(this.t * 3 - t * 4) * 0.3 * t : 0), lerp(restZ, flyZ, f));
      this.tailSpine[i].copy(this.bodyG.localToWorld(lp));
    }
    this.tail.update(this.tailSpine);
    const tip = this.tail.frames[21];
    this.spade.position.copy(tip.p);
    this.spade.lookAt(_v.copy(tip.p).addScaledVector(tip.t, -1));
    this.tailSpikes.update(this.tail, 0.05, 0.85, (k) => 0.9 - k * 0.6);
    this.neckSpikes.update(this.neck, 0.1, 0.9, () => 0.7);
    this.puff.update(dt);
  }

  puffSparkles() {
    const dir = new THREE.Vector3(0, 0, 1).applyQuaternion(this.head.quaternion);
    this.puff.emit(this.head.localToWorld(new THREE.Vector3(0, 0.05, 0.9)), dir, 18);
  }
}

// ---- Serpent dragons (Lóng Mei, Quetzi, Fjola): long bodies that follow the head
class SerpentDragon {
  constructor(scene, world, { n, segLen, radius, mat, start }) {
    this.scene = scene; this.world = world;
    this.n = n;
    this.body = new SerpentBody(n, 16, radius, mat, n / 4);
    scene.add(this.body.mesh);
    this.trail = new Trail(start, segLen, n);
    this.head = new THREE.Group();
    scene.add(this.head);
    this.headPos = start.clone();
    this.t = Math.random() * 10;
  }
  // where a rider sits: on the back, a little way behind the head
  seat(out = new THREE.Vector3()) {
    const f = this.body.frames[Math.min(this.body.frames.length - 1, this.seatAt || 6)];
    return out.copy(f.p).addScaledVector(f.up, f.r * 0.85);
  }
  rideYaw() { const t = this.body.frames[0].t; return Math.atan2(t.x, t.z); }
  startRide() { this.ridden = true; }
  endRide() { this.ridden = false; }
  syncBody() {
    this.trail.push(this.headPos);
    this.body.update(this.trail.spine);
    const f0 = this.body.frames[0];
    this.head.position.copy(f0.p);
    this.head.lookAt(_v.copy(f0.p).add(f0.t));
  }
}

// Lóng Mei: a Chinese lóng — no wings, flies by magic, antlers, whiskers and a pearl
export class ChineseDragon extends SerpentDragon {
  constructor(scene, world, { home, roam }) {
    const start = new THREE.Vector3(home.x, world.terrainHeight(home.x, home.z) + 4, home.z);
    super(scene, world, { n: 46, segLen: 0.42, radius: (t) => 0.42 * (t < 0.06 ? 0.8 + t * 3 : 1 - Math.pow(t, 2.2) * 0.85), mat: new THREE.MeshStandardMaterial({ map: scaleTexture('#e23d3d', '#a81f2a', '#ffd54a'), roughness: 0.45 }), start });
    this.info = DRAGON_INFO.long; this.name = this.info.name;
    this.home = home; this.roam = roam;
    const red = std('#e23d3d', { roughness: 0.45 }), gold = std('#ffd54a', { roughness: 0.35, metalness: 0.2 }), cream = std('#fff1c9');
    const H = this.head;
    const skull = sphere(0.42, red, 1, 0.85, 1.1); H.add(skull);
    const snout = mesh(new RoundedBoxGeometry(0.5, 0.34, 0.7, 4, 0.14), red); snout.position.set(0, -0.06, 0.5); H.add(snout);
    const nose = sphere(0.14, gold, 1.4, 0.8, 1); nose.position.set(0, 0.06, 0.84); H.add(nose);
    for (const s of [-1, 1]) {
      const e = friendlyEye(0.13, '#d68a1a'); e.position.set(s * 0.24, 0.16, 0.28); e.rotation.y = s * 0.3; H.add(e);
      // deer-like antlers
      const ant = new THREE.Group();
      const main = mesh(new THREE.CylinderGeometry(0.03, 0.05, 0.7, 6).translate(0, 0.35, 0), cream); ant.add(main);
      for (const [y, a] of [[0.3, 0.8], [0.52, -0.7]]) { const br = mesh(new THREE.CylinderGeometry(0.02, 0.03, 0.3, 6).translate(0, 0.15, 0), cream); br.position.y = y; br.rotation.z = a * s; ant.add(br); }
      ant.position.set(s * 0.2, 0.32, -0.1); ant.rotation.set(-0.7, 0, -s * 0.35); H.add(ant);
      // long flowing whiskers
      const pts = []; for (let k = 0; k <= 8; k++) pts.push(new THREE.Vector3(s * (0.2 + k * 0.12), -0.05 - Math.sin(k * 0.6) * 0.15, 0.8 - k * 0.14));
      const wh = mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 16, 0.018, 5), gold); H.add(wh);
      // flame-like mane tufts
      for (let k = 0; k < 4; k++) { const m = mesh(new THREE.ConeGeometry(0.08, 0.42, 6), std('#ff9a3c')); m.position.set(s * 0.28, 0.05 - k * 0.08, -0.2 - k * 0.12); m.rotation.set(-1.6, 0, -s * 0.6); H.add(m); }
    }
    const smile = mesh(new THREE.TorusGeometry(0.16, 0.018, 6, 20, Math.PI * 0.8), std('#6a1f1a')); smile.rotation.set(Math.PI + 0.2, 0, Math.PI * 0.1); smile.position.set(0, -0.14, 0.82); H.add(smile);
    // the glowing pearl of good luck, held just in front
    this.pearl = new THREE.Mesh(new THREE.SphereGeometry(0.2, 20, 16), new THREE.MeshStandardMaterial({ color: '#fff7e0', emissive: '#ffe8a8', emissiveIntensity: 0.8, roughness: 0.15 }));
    scene.add(this.pearl);
    // golden back spines and four little legs
    this.spines = new DorsalRow(scene, 30, new THREE.ConeGeometry(0.1, 0.32, 6).translate(0, 0.16, 0), gold);
    this.legs = [];
    for (const at of [0.14, 0.14, 0.5, 0.5]) {
      const leg = new THREE.Group();
      const thigh = mesh(new THREE.CapsuleGeometry(0.08, 0.32, 4, 8).translate(0, -0.2, 0), red); leg.add(thigh);
      for (let c = -1; c <= 1; c++) { const cl = mesh(new THREE.ConeGeometry(0.03, 0.12, 6), gold); cl.position.set(c * 0.05, -0.46, 0.04); cl.rotation.x = 1.2; leg.add(cl); }
      scene.add(leg);
      this.legs.push({ leg, at, side: this.legs.length % 2 ? 1 : -1 });
    }
    this.tuft = mesh(new THREE.ConeGeometry(0.18, 0.6, 8), std('#ff9a3c')); scene.add(this.tuft);
    this.phase = 'roam'; this.phaseT = 40; this.blend = 0;
    this.ang = Math.random() * 6;
    this.hAng = 0;
  }
  get canTalk() { return !this.ridden && this.blend > 0.85; }
  talkPos() { return this.headPos; }
  update(dt, ctx) {
    this.t += dt;
    const W = this.world;
    this.phaseT -= dt;
    if (this.phaseT < 0) { this.phase = this.phase === 'roam' ? 'hover' : 'roam'; this.phaseT = this.phase === 'roam' ? 45 : 40; }
    // keep visiting while a friend is close by
    if (this.phase === 'hover' && this.phaseT < 1 && ctx.playerPos.distanceTo(this.headPos) < 10) this.phaseT = 5;
    this.blend = damp(this.blend, this.phase === 'hover' ? 1 : 0, 0.5, dt);
    // roaming: a big swooping loop around the island
    this.ang += dt * lerp(0.11, 0.16, this.blend);
    const R = this.roam.r;
    const rx = this.roam.x + Math.cos(this.ang) * R + Math.sin(this.t * 0.7) * 5;
    const rz = this.roam.z + Math.sin(this.ang) * R * 0.8;
    const ry = groundAt(W, rx, rz) + 11 + Math.sin(this.t * 1.1) * 3;
    // visiting: low, lazy circles around Lantern Hill
    const hx = this.home.x + Math.cos(this.ang * 2.2) * 6, hz = this.home.z + Math.sin(this.ang * 2.2) * 6;
    const hy = W.terrainHeight(hx, hz) + 2.4 + Math.sin(this.t * 1.5) * 0.4;
    const target = _w.set(lerp(rx, hx, this.blend), lerp(ry, hy, this.blend), lerp(rz, hz, this.blend));
    if (!this.ridden) this.headPos.lerp(target, Math.min(1, dt * 1.5));
    this.headPos.y = Math.max(this.headPos.y, W.terrainHeight(this.headPos.x, this.headPos.z) + 1.4);
    this.syncBody();
    // the body never dips into hills
    const sp = this.trail.spine;
    for (let i = 1; i < sp.length; i++) sp[i].y = Math.max(sp[i].y, W.terrainHeight(sp[i].x, sp[i].z) + 0.6);
    this.body.update(sp);
    this.spines.update(this.body, 0.08, 0.92, (k, r) => 0.8 + r * 0.5);
    const fr = this.body.frames;
    for (const L of this.legs) {
      const f = fr[Math.round(L.at * (fr.length - 1))];
      L.leg.position.copy(f.p).addScaledVector(f.side, L.side * f.r * 0.85).addScaledVector(f.up, -f.r * 0.3);
      _m.makeBasis(f.side, f.up, f.t); L.leg.quaternion.setFromRotationMatrix(_m);
      L.leg.rotateX(Math.sin(this.t * 4 + L.at * 10 + L.side) * 0.5 - 0.3);
      L.leg.rotateZ(L.side * 0.4);
    }
    const tail = fr[fr.length - 1];
    this.tuft.position.copy(tail.p); this.tuft.lookAt(_v.copy(tail.p).addScaledVector(tail.t, -1)); this.tuft.rotateX(Math.PI / 2);
    this.pearl.position.copy(this.head.localToWorld(_v.set(0, -0.35, 1.25)));
    this.pearl.rotation.y += dt;
  }
}

// Quetzi: a feathered serpent from old stories of Mexico — rainbow feather wings
export class FeatheredSerpent extends SerpentDragon {
  constructor(scene, world, { home, roam }) {
    const start = new THREE.Vector3(home.x, world.terrainHeight(home.x, home.z) + 4, home.z);
    super(scene, world, { n: 34, segLen: 0.4, radius: (t) => 0.32 * (t < 0.06 ? 0.85 + t * 2.5 : 1 - Math.pow(t, 1.8) * 0.85), mat: new THREE.MeshStandardMaterial({ map: scaleTexture('#2fae6a', '#1f7a4a', '#ffe27a', { feather: true }), roughness: 0.5 }), start });
    this.info = DRAGON_INFO.quetzi; this.name = this.info.name;
    this.home = home; this.roam = roam;
    const green = std('#2fae6a', { roughness: 0.5 }), gold = std('#ffd34d');
    const H = this.head;
    H.add(sphere(0.34, green, 1, 0.85, 1.1));
    const beak = mesh(new RoundedBoxGeometry(0.36, 0.26, 0.55, 4, 0.1), green); beak.position.set(0, -0.06, 0.4); H.add(beak);
    const nose = mesh(new THREE.ConeGeometry(0.08, 0.2, 8), gold); nose.rotation.x = Math.PI / 2; nose.position.set(0, 0, 0.72); H.add(nose);
    for (const s of [-1, 1]) { const e = friendlyEye(0.11, '#7a3a8a'); e.position.set(s * 0.2, 0.12, 0.22); e.rotation.y = s * 0.3; H.add(e); }
    const smile = mesh(new THREE.TorusGeometry(0.12, 0.015, 6, 20, Math.PI * 0.8), std('#1f4a2a')); smile.rotation.set(Math.PI + 0.2, 0, Math.PI * 0.1); smile.position.set(0, -0.1, 0.66); H.add(smile);
    const rainbow = ['#ff4d6d', '#ff9a3c', '#ffd34d', '#4cd38a', '#3ec1ff', '#7a6cff'];
    // a crest of long plumes
    rainbow.forEach((c, i) => { const p = mesh(new THREE.CapsuleGeometry(0.04, 0.5, 4, 8).translate(0, 0.25, 0), std(c)); p.position.set((i - 2.5) * 0.06, 0.25, -0.1); p.rotation.set(-0.9 - Math.abs(i - 2.5) * 0.08, 0, (i - 2.5) * 0.15); H.add(p); });
    // a ruff of feathers around the neck
    this.ruff = new THREE.Group();
    for (let i = 0; i < 14; i++) { const a = (i / 14) * Math.PI * 2; const p = mesh(new THREE.CapsuleGeometry(0.05, 0.32, 4, 6).translate(0, 0.2, 0), std(rainbow[i % 6])); p.rotation.z = a; p.rotation.x = 0.6; this.ruff.add(p); }
    scene.add(this.ruff);
    // feather wings
    this.wings = [1, -1].map((s) => {
      const piv = new THREE.Group();
      rainbow.forEach((c, i) => { const f = mesh(new THREE.CapsuleGeometry(0.09, 0.9 + i * 0.18, 4, 8).translate(0, 0.55 + i * 0.09, 0), std(c, { roughness: 0.6 })); f.scale.z = 0.25; f.rotation.z = -s * (Math.PI / 2 - 0.15 - i * 0.16); f.rotation.x = -i * 0.05; piv.add(f); });
      scene.add(piv);
      return { piv, s };
    });
    this.tailFan = new THREE.Group();
    rainbow.forEach((c, i) => { const f = mesh(new THREE.CapsuleGeometry(0.06, 0.5, 4, 6).translate(0, 0.28, 0), std(c)); f.scale.z = 0.3; f.rotation.z = (i - 2.5) * 0.25; this.tailFan.add(f); });
    scene.add(this.tailFan);
    this.phase = 'roam'; this.phaseT = 30; this.blend = 0;
    this.ang = Math.random() * 6;
  }
  get canTalk() { return !this.ridden && this.blend > 0.85; }
  talkPos() { return this.headPos; }
  update(dt, ctx) {
    this.t += dt;
    const W = this.world;
    this.phaseT -= dt;
    if (this.phaseT < 0) { this.phase = this.phase === 'roam' ? 'hover' : 'roam'; this.phaseT = this.phase === 'roam' ? 40 : 40; }
    if (this.phase === 'hover' && this.phaseT < 1 && ctx.playerPos.distanceTo(this.headPos) < 10) this.phaseT = 5;
    this.blend = damp(this.blend, this.phase === 'hover' ? 1 : 0, 0.5, dt);
    this.ang -= dt * lerp(0.14, 0.2, this.blend);
    const R = this.roam.r;
    const rx = this.roam.x + Math.cos(this.ang) * R, rz = this.roam.z + Math.sin(this.ang) * R;
    const ry = groundAt(W, rx, rz) + 9 + Math.sin(this.t * 0.9) * 3;
    const hx = this.home.x + Math.cos(this.ang * 2) * 4.5, hz = this.home.z + Math.sin(this.ang * 2) * 4.5;
    const hy = Math.max(W.terrainHeight(hx, hz), this.home.top || 0) + 2.6 + Math.sin(this.t * 1.7) * 0.4;
    const target = _w.set(lerp(rx, hx, this.blend), lerp(ry, hy, this.blend), lerp(rz, hz, this.blend));
    if (!this.ridden) this.headPos.lerp(target, Math.min(1, dt * 1.6));
    this.headPos.y = Math.max(this.headPos.y, W.terrainHeight(this.headPos.x, this.headPos.z) + 1.5);
    this.syncBody();
    const sp = this.trail.spine;
    for (let i = 1; i < sp.length; i++) sp[i].y = Math.max(sp[i].y, W.terrainHeight(sp[i].x, sp[i].z) + 0.5);
    this.body.update(sp);
    const fr = this.body.frames;
    const f2 = fr[2];
    this.ruff.position.copy(f2.p); _m.makeBasis(f2.side, f2.up, f2.t); this.ruff.quaternion.setFromRotationMatrix(_m);
    const wf = fr[7];
    const flap = Math.sin(this.t * 3.2);
    for (const w of this.wings) {
      w.piv.position.copy(wf.p).addScaledVector(wf.up, wf.r * 0.6).addScaledVector(wf.side, w.s * wf.r * 0.6);
      _m.makeBasis(wf.side, wf.up, wf.t); w.piv.quaternion.setFromRotationMatrix(_m);
      w.piv.rotateZ(w.s * flap * 0.55);
    }
    const tail = fr[fr.length - 1];
    this.tailFan.position.copy(tail.p); _m.makeBasis(tail.side, tail.up, tail.t); this.tailFan.quaternion.setFromRotationMatrix(_m); this.tailFan.rotateX(Math.PI / 2 + 0.3);
  }
}

// Fjola: a sea serpent from old Norse stories — swims with humps, a curly prow-like head
export class NordicSerpent extends SerpentDragon {
  constructor(scene, world, { cove, out, loop }) {
    const start = new THREE.Vector3(cove.x, world.waterLevel + 1, cove.z);
    super(scene, world, { n: 40, segLen: 0.55, radius: (t) => 0.5 * (t < 0.05 ? 0.75 + t * 5 : 1 - Math.pow(t, 2) * 0.8), mat: new THREE.MeshStandardMaterial({ map: scaleTexture('#2f8fb0', '#1d5f7a', '#d6f4f2'), roughness: 0.35 }), start });
    this.info = DRAGON_INFO.fjola; this.name = this.info.name;
    this.cove = cove; this.out = out; this.loop = loop;
    const blue = std('#2f8fb0', { roughness: 0.35 }), pale = std('#d6f4f2'), horn = std('#f2efe0');
    const H = this.head;
    H.add(sphere(0.48, blue, 1, 0.85, 1.15));
    const snout = mesh(new RoundedBoxGeometry(0.56, 0.36, 0.8, 4, 0.15), blue); snout.position.set(0, -0.08, 0.55); H.add(snout);
    const chin = mesh(new RoundedBoxGeometry(0.46, 0.12, 0.66, 3, 0.05), pale); chin.position.set(0, -0.27, 0.5); H.add(chin);
    for (const s of [-1, 1]) {
      const e = friendlyEye(0.15, '#2a6ad8'); e.position.set(s * 0.27, 0.15, 0.32); e.rotation.y = s * 0.35; H.add(e);
      // curling horns, like the carved prow of a longship
      const pts = []; for (let k = 0; k <= 10; k++) { const a = k * 0.42; pts.push(new THREE.Vector3(s * (0.22 + k * 0.015), 0.35 + Math.sin(a) * 0.35, -0.1 - (1 - Math.cos(a)) * 0.3)); }
      const hc = mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 20, 0.06, 6), horn); H.add(hc);
      // fin-like ear frills
      const fin = mesh(new THREE.ConeGeometry(0.22, 0.5, 5).scale(1, 1, 0.15), std('#7fe0d0', { side: THREE.DoubleSide })); fin.position.set(s * 0.45, 0.05, -0.1); fin.rotation.set(-0.6, 0, -s * 1.3); H.add(fin);
    }
    const smile = mesh(new THREE.TorusGeometry(0.18, 0.02, 6, 20, Math.PI * 0.8), std('#123a4a')); smile.rotation.set(Math.PI + 0.2, 0, Math.PI * 0.1); smile.position.set(0, -0.15, 0.93); H.add(smile);
    // a frill along the back with a knotwork-style stripe
    this.frill = new DorsalRow(scene, 28, new THREE.ConeGeometry(0.22, 0.5, 4).scale(0.35, 1, 1).translate(0, 0.22, 0), std('#7fe0d0', { roughness: 0.4 }));
    this.tailFin = mesh(new THREE.ConeGeometry(0.4, 0.9, 4).scale(0.2, 1, 1), std('#7fe0d0', { side: THREE.DoubleSide }));
    scene.add(this.tailFin);
    this.phase = 'swim'; this.phaseT = 30; this.ang = 0; this.blend = 0;
    this.seatAt = 3; // sit on her neck, above the waves
  }
  get canTalk() { return !this.ridden && this.blend > 0.85; }
  talkPos() { return this.headPos; }
  update(dt, ctx) {
    this.t += dt;
    const W = this.world, wl = W.waterLevel;
    this.phaseT -= dt;
    if (this.phaseT < 0) { this.phase = this.phase === 'swim' ? 'rest' : 'swim'; this.phaseT = this.phase === 'swim' ? 35 : 35; }
    if (this.phase === 'rest' && this.phaseT < 1 && ctx.playerPos.distanceTo(this.headPos) < 12) this.phaseT = 5;
    this.blend = damp(this.blend, this.phase === 'rest' ? 1 : 0, 0.45, dt);
    this.ang += dt * lerp(0.28, 0.02, this.blend);
    const L = this.loop;
    const sx = L.x + Math.cos(this.ang) * L.r, sz = L.z + Math.sin(this.ang) * L.r;
    const target = _w.set(lerp(sx, this.cove.x, this.blend), 0, lerp(sz, this.cove.z, this.blend));
    if (!this.ridden) {
      this.headPos.x += (target.x - this.headPos.x) * Math.min(1, dt * 1.2);
      this.headPos.z += (target.z - this.headPos.z) * Math.min(1, dt * 1.2);
    } else this.blend = damp(this.blend, 0, 2, dt);
    this.headPos.y = wl + lerp(this.ridden ? 1.1 : 0.9, 1.6, this.blend) + Math.sin(this.t * 1.6) * 0.15;
    this.trail.push(this.headPos);
    // humps: the body rises above the waves and dips below as she swims
    const sp = this.trail.spine;
    for (let i = 1; i < sp.length; i++) {
      const s = i / (sp.length - 1);
      const neck = 1 - smoothstep(0, 0.12, s);
      const hump = Math.sin(s * 14 - this.t * lerp(2.2, 0.8, this.blend)) * 0.75;
      const y = wl - 0.35 + hump * (1 - neck);
      sp[i].y = lerp(y, this.headPos.y - s * 6, neck);
      sp[i].y = Math.max(sp[i].y, W.terrainHeight(sp[i].x, sp[i].z) + 0.4);
    }
    this.body.update(sp);
    const f0 = this.body.frames[0];
    this.head.position.copy(f0.p);
    _v.copy(f0.t); _v.y = Math.max(-0.2, _v.y * 0.3); _v.normalize();
    this.head.lookAt(_w.copy(f0.p).add(_v));
    this.frill.update(this.body, 0.06, 0.95, (k) => 1 - k * 0.5);
    const tail = this.body.frames[this.body.frames.length - 1];
    this.tailFin.position.copy(tail.p); this.tailFin.lookAt(_v.copy(tail.p).addScaledVector(tail.t, -1)); this.tailFin.rotateX(Math.PI / 2);
  }
}

// ---------------------------------------------------------------- dragon-winged horses
// Wraps the existing horse model with a pair of soft dragon wings.
export function addDragonWings(holder, model, { color = '#ffd1e3', bone = '#c76b98', span = 1.3 } = {}) {
  const box = new THREE.Box3().setFromObject(model);
  const size = box.getSize(new THREE.Vector3()), c = box.getCenter(new THREE.Vector3());
  holder.worldToLocal(c);
  const wings = [1, -1].map((s) => {
    const w = new DragonWing({ span: span * size.y, chord: span * size.y * 0.55, membrane: color, bone, side: s });
    w.pivot.position.set(s * size.x * 0.18, c.y + size.y * 0.22, c.z + size.z * 0.12);
    holder.add(w.pivot);
    return w;
  });
  return wings;
}

// ---------------------------------------------------------------- Belly Button the plush bear
// Built from the photo: tall bean-shaped charcoal plush with white speckle dashes,
// a big cream belly, a white muzzle with a black nose and a stitched smile,
// embroidered eyes, small round ears (one with an orange lining) and stubby paws.
function speckleTexture() {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 512;
  const g = c.getContext('2d');
  g.fillStyle = '#45434c'; g.fillRect(0, 0, 512, 512);
  const r = makeRandom(5);
  for (let i = 0; i < 1400; i++) {
    const x = r() * 512, y = r() * 512, a = -1.2 + r() * 0.8, l = 6 + r() * 7;
    g.strokeStyle = `rgba(235,235,240,${0.55 + r() * 0.35})`; g.lineWidth = 2 + r() * 1.2; g.lineCap = 'round';
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}
function plushTexture(color) {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = color; g.fillRect(0, 0, 128, 128);
  const r = makeRandom(9);
  for (let i = 0; i < 1500; i++) { g.fillStyle = `rgba(${r() < 0.5 ? '255,255,255' : '180,170,160'},${r() * 0.18})`; g.fillRect(r() * 128, r() * 128, 2, 2); }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

export class BellyButton {
  constructor({ scale = 1 } = {}) {
    this.name = 'Belly Button';
    this.root = new THREE.Group();
    this.inner = new THREE.Group();
    this.root.add(this.inner);
    const fabricTex = speckleTexture(); fabricTex.repeat.set(2, 2);
    const fabric = new THREE.MeshStandardMaterial({ map: fabricTex, roughness: 0.98 });
    const cream = new THREE.MeshStandardMaterial({ map: plushTexture('#efe8de'), roughness: 1 });
    // tall bean body (lathe profile, wider at the bottom, rounded top)
    const prof = [];
    const H = 1.1;
    for (let i = 0; i <= 24; i++) {
      const t = i / 24, y = t * H;
      let r = 0.3 + Math.sin(t * Math.PI) * 0.04 - t * 0.04;
      if (t > 0.8) r *= Math.sqrt(Math.max(0, 1 - ((t - 0.8) / 0.2) ** 2));
      if (t < 0.06) r *= Math.sqrt(t / 0.06) * 0.6 + 0.4;
      prof.push(new THREE.Vector2(Math.max(0.001, r), y));
    }
    const body = mesh(new THREE.LatheGeometry(prof, 32), fabric);
    body.scale.set(1, 1, 0.92);
    this.inner.add(body);
    // big cream belly
    const belly = sphere(0.24, cream, 1, 1.45, 0.42);
    belly.position.set(0, 0.42, 0.21);
    this.inner.add(belly);
    // muzzle, nose and stitched smile
    const muzzle = sphere(0.15, cream, 1.05, 0.95, 0.75);
    muzzle.position.set(0, 0.86, 0.24);
    this.inner.add(muzzle);
    const nose = sphere(0.06, new THREE.MeshStandardMaterial({ color: '#141418', roughness: 0.6 }), 1.25, 0.9, 0.9);
    nose.position.set(0, 0.92, 0.355);
    this.inner.add(nose);
    const stitch = new THREE.MeshBasicMaterial({ color: '#1a1a1a' });
    const smilePts = []; for (let k = 0; k <= 10; k++) { const a = Math.PI * (0.15 + 0.7 * (k / 10)); smilePts.push(new THREE.Vector3(Math.cos(a) * 0.06, 0.835 - Math.sin(a) * 0.035, 0.345 - Math.abs(Math.cos(a)) * 0.02)); }
    this.inner.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(smilePts), 12, 0.006, 4), stitch));
    this.inner.add(at3(new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.04, 4), stitch), 0, 0.875, 0.35));
    // embroidered eyes (white with a black pupil)
    this.eyes = [];
    for (const s of [-1, 1]) {
      const e = new THREE.Group();
      e.add(new THREE.Mesh(new THREE.CircleGeometry(0.045, 20), new THREE.MeshStandardMaterial({ color: '#f4f6ff', roughness: 0.8 })));
      const p = new THREE.Mesh(new THREE.CircleGeometry(0.018, 14), new THREE.MeshBasicMaterial({ color: '#111' })); p.position.set(s * 0.004, 0.003, 0.002); e.add(p);
      const ring = new THREE.Mesh(new THREE.RingGeometry(0.045, 0.051, 24), new THREE.MeshBasicMaterial({ color: '#9fb0d0' })); ring.position.z = 0.001; e.add(ring);
      e.position.set(s * 0.17, 0.96, 0.19);
      e.lookAt(e.position.clone().add(new THREE.Vector3(s * 0.75, 0.05, 0.75)));
      this.inner.add(e);
      this.eyes.push(e);
    }
    // round ears, the left one with an orange lining like the photo
    for (const s of [-1, 1]) {
      const ear = sphere(0.085, fabric, 1, 1, 0.45);
      ear.position.set(s * 0.21, 1.06, 0.02); ear.rotation.z = -s * 0.35;
      this.inner.add(ear);
      const lining = sphere(0.05, std(s < 0 ? '#d9822b' : '#5a5862', { roughness: 1 }), 1, 1, 0.3);
      lining.position.set(s * 0.21, 1.055, 0.055); lining.rotation.z = -s * 0.35;
      this.inner.add(lining);
    }
    // stubby arms and feet
    this.arms = [];
    for (const s of [-1, 1]) {
      const pivot = new THREE.Group(); pivot.position.set(s * 0.27, 0.62, 0.05);
      const arm = sphere(0.075, fabric, 0.8, 1.6, 0.9); arm.position.y = -0.1; pivot.add(arm);
      pivot.rotation.z = s * 0.25;
      this.inner.add(pivot); this.arms.push({ pivot, s });
      const foot = sphere(0.08, fabric, 1, 0.75, 1.5); foot.position.set(s * 0.13, 0.04, 0.12); this.inner.add(foot);
      (this.feet = this.feet || []).push({ foot, s });
    }
    this.root.scale.setScalar(scale);
    // `pose` tips and squashes the whole plush; `inner` waddles inside it
    this.pose = new THREE.Group();
    this.root.add(this.pose);
    this.pose.add(this.inner);
    this.anim = { speed: 0, grounded: true, vy: 0, swim: false, sit: false, action: null, actionT: 0 };
    this.t = Math.random() * 10;
    this.squash = 0;
    this._sw = 0; this._sit = 0; this._air = 0;
    this.body = this.pose; // where a cape gets attached
  }
  playAction(name, d = 1.5) { this.anim.action = name; this.anim.actionT = d; }
  setMood() {}
  land(strength = 1) { this.squash = Math.min(1, 0.4 + strength * 0.6); }
  update(dt) {
    this.t += dt;
    const a = this.anim;
    if (a.actionT > 0) { a.actionT -= dt; if (a.actionT <= 0) a.action = null; }
    const walk = a.grounded && !a.swim ? Math.min(1, a.speed / 2.4) : 0;
    const k = (v, target, rate) => v + (target - v) * Math.min(1, dt * rate);
    this._sw = k(this._sw, a.swim ? 1 : 0, 5);
    this._sit = k(this._sit, a.sit ? 1 : 0, 6);
    this._air = k(this._air, !a.grounded && !a.swim ? 1 : 0, 10);
    this.squash = Math.max(0, this.squash - dt * 3.5);
    const step = this.t * (6 + a.speed * 2.2);
    // a happy side-to-side waddle when walking, a soft sway when standing still
    this.inner.rotation.z = Math.sin(step) * 0.14 * walk + Math.sin(this.t * 1.2) * 0.03 * (1 - walk);
    this.inner.position.y = Math.abs(Math.sin(step)) * 0.05 * walk;
    this.inner.rotation.x = 0.08 * walk;
    // little feet step forward and back
    for (const { foot, s } of this.feet) {
      foot.position.z = 0.12 + Math.sin(step + (s > 0 ? 0 : Math.PI)) * 0.08 * walk + this._sit * 0.12;
      foot.position.y = 0.04 + Math.max(0, Math.sin(step + (s > 0 ? 0 : Math.PI))) * 0.04 * walk;
    }
    // squash on landing, stretch in the air, float on his back in the water
    const sq = Math.sin(this.squash * Math.PI) * 0.22;
    const stretch = Math.max(-1, Math.min(1, (a.vy || 0) / 10)) * this._air;
    const sy = (1 - sq) * (1 + stretch * 0.12) * (1 - this._sit * 0.12) + Math.sin(this.t * 2) * 0.012;
    const sx = (1 + sq * 0.6) * (1 - stretch * 0.05) * (1 + this._sit * 0.06);
    this.pose.scale.set(sx, sy, sx);
    // in the water he lies back with his big belly to the sky, paddling his feet
    this.pose.rotation.x = -1.35 * this._sw + Math.sin(this.t * 1.8) * 0.05 * this._sw;
    this.pose.position.set(0, 0.42 * this._sw - 0.1 * this._sit, -0.25 * this._sw);
    this.pose.rotation.z = Math.sin(this.t * 1.5) * 0.08 * this._sw;
    // arms: swing when walking, up in the air when jumping, paddle when swimming
    const act = a.action;
    this.arms.forEach(({ pivot, s }) => {
      let z = 0.25 + Math.sin(this.t * 1.5) * 0.05;
      let x = Math.sin(step + (s > 0 ? Math.PI : 0)) * 0.5 * walk;
      z += this._air * 1.6;
      z += this._sw * (0.9 + Math.sin(this.t * 4 + (s > 0 ? 0 : Math.PI)) * 0.5);
      if (act === 'wave' && s > 0) z = 1.9 + Math.sin(this.t * 12) * 0.4;
      if (act === 'cheer') z = 2.3 + Math.sin(this.t * 14) * 0.25;
      if (act === 'hug') { z = 0.9; x = -1.2; }
      if (act === 'give' || act === 'point') { if (s > 0) { z = 0.6; x = -1.4; } }
      pivot.rotation.set(x, 0, s * z);
    });
    if (act === 'cheer') this.inner.position.y += Math.abs(Math.sin(this.t * 9)) * 0.15;
    if (act === 'sad') this.inner.rotation.x = 0.3;
  }
}
function at3(o, x, y, z) { o.position.set(x, y, z); return o; }
