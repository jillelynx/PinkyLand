// Builds the kid characters (Jacinta, Liev, neighborhood kids and grown-ups)
// out of smooth shapes, with a simple skeleton so they can walk, run,
// jump, swim, sit, wave and hug.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { humanFaceTexture } from './faces.js';
import { makeRandom, damp } from '../util/noise.js';

const mats = new Map();
function mat(color, opts = {}) {
  const key = color + JSON.stringify(opts);
  if (!mats.has(key)) {
    const m = new THREE.MeshStandardMaterial({ color, roughness: opts.roughness ?? 0.75, metalness: 0, ...opts });
    mats.set(key, m);
  }
  return mats.get(key);
}
function fabric(color, opts = {}) {
  const key = 'fab' + color + JSON.stringify(opts);
  if (!mats.has(key)) {
    mats.set(key, new THREE.MeshPhysicalMaterial({ color, roughness: 0.9, sheen: 0.8, sheenRoughness: 0.6, sheenColor: new THREE.Color(color).lerp(new THREE.Color('#ffffff'), 0.5), ...opts }));
  }
  return mats.get(key);
}

function mesh(geo, material, { cast = true } = {}) {
  const m = new THREE.Mesh(geo, material);
  m.castShadow = cast;
  m.receiveShadow = true;
  return m;
}

function stripeTexture(colors, stripes = 6) {
  const c = document.createElement('canvas');
  c.width = 64; c.height = 128;
  const g = c.getContext('2d');
  const h = c.height / stripes;
  for (let i = 0; i < stripes; i++) {
    g.fillStyle = colors[i % colors.length];
    g.fillRect(0, i * h, 64, h);
  }
  // knit ribs
  g.fillStyle = 'rgba(0,0,0,0.06)';
  for (let x = 0; x < 64; x += 6) g.fillRect(x, 0, 2, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

function jerseyTexture(style) {
  const W = 512, H = 256;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d');
  g.fillStyle = style.jersey;
  g.fillRect(0, 0, W, H);
  // subtle fabric pattern
  g.fillStyle = 'rgba(255,255,255,0.06)';
  for (let y = 0; y < H; y += 6) g.fillRect(0, y, W, 2);
  // side stripes (u = 0.25 and 0.75 are the sides)
  g.fillStyle = style.jerseyStripe;
  for (const u of [0.25, 0.75]) g.fillRect(W * u - 10, 0, 20, H);
  // collar band
  g.fillRect(0, 0, W, 16);
  // number on the back (u = 0.5)
  g.font = 'bold 120px "Arial Rounded MT Bold", Arial, sans-serif';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.lineWidth = 8; g.strokeStyle = style.jerseyStripe;
  g.fillStyle = style.jerseyStripe;
  g.fillText(style.jerseyNumber, W * 0.5, H * 0.45);
  // small number on the front chest (u = 0 / 1 wraps)
  g.font = 'bold 44px Arial, sans-serif';
  g.fillText(style.jerseyNumber, W * 0.07, H * 0.32);
  // a little star crest
  g.beginPath();
  const sx = W * 0.94, sy = H * 0.32;
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const r = i % 2 ? 9 : 20;
    g.lineTo(sx + Math.cos(a) * r, sy + Math.sin(a) * r);
  }
  g.fill();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// Skin-fade haircut with a lightning bolt shaved into one side.
function fadeHairTexture(style, bolt = true) {
  const W = 512, H = 256;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d');
  const rnd = makeRandom(4);
  // the cap covers theta 0..thetaLen; canvas top = crown, bottom = cap edge
  const hair = new THREE.Color(style.hair), skin = new THREE.Color(style.skin), mix = new THREE.Color();
  for (let x = 0; x < W; x++) {
    const u = x / W;
    // distance from the face (front is u = 0.25)
    let du = Math.abs(u - 0.25); du = Math.min(du, 1 - du);
    const front = Math.max(0, 1 - du / 0.16); // 1 at the front
    const hairEnd = H * (1 - front * 0.62); // hairline higher at the forehead
    const fadeStart = hairEnd * (front > 0.2 ? 0.98 : 0.5);
    for (let y = 0; y < hairEnd; y += 2) {
      // short hair darkens toward a skin-colored fade near the bottom
      let t = y < fadeStart ? 0 : (y - fadeStart) / Math.max(1, hairEnd - fadeStart);
      t = Math.min(1, t * (0.85 + rnd() * 0.3));
      mix.copy(hair).lerp(skin, Math.pow(t, 0.8) * 0.85);
      const n = 0.88 + rnd() * 0.24;
      g.fillStyle = `rgb(${Math.min(255, mix.r * 255 * n) | 0},${Math.min(255, mix.g * 255 * n) | 0},${Math.min(255, mix.b * 255 * n) | 0})`;
      g.fillRect(x, y, 1, 2);
    }
  }
  if (bolt) {
    // lightning bolt shaved into the +x side (u = 0.5)
    g.fillStyle = style.skin;
    const bx = W * 0.5, by = H * 0.74;
    g.beginPath();
    const pts = [[-30, -34], [14, -34], [0, -8], [28, -8], [-20, 40], [-8, 6], [-38, 6]];
    pts.forEach(([px, py], i) => (i ? g.lineTo(bx + px * 1.25, by + py * 0.85) : g.moveTo(bx + px * 1.25, by + py * 0.85)));
    g.closePath();
    g.fill();
    g.strokeStyle = 'rgba(0,0,0,0.12)'; g.lineWidth = 2; g.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function hexToRgb(hex, k = 1) {
  const c = new THREE.Color(hex);
  return [Math.min(255, c.r * 255 * k) | 0, Math.min(255, c.g * 255 * k) | 0, Math.min(255, c.b * 255 * k) | 0].join(',');
}

// Returns { full, hooded }: all the curls, and just the few that peek out of her hood
function curlyHairGeometry(headR, rand, style) {
  const parts = [];
  const hoodParts = [];
  // a curl stays visible under the hood if it frames her face (inside the hood opening)
  const peeks = (x, y, z) => Math.abs(Math.atan2(x, z)) < 0.72 && y > -0.75 * headR && z > 0.2 * headR;
  const colA = new THREE.Color(style.hair), colB = new THREE.Color(style.hairHighlight || style.hair);
  const addColored = (g, t, where = null, onlyHood = false) => {
    g = g.index ? g.toNonIndexed() : g;
    const c = colA.clone().lerp(colB, t);
    const arr = new Float32Array(g.attributes.position.count * 3);
    for (let i = 0; i < arr.length; i += 3) { arr[i] = c.r; arr[i + 1] = c.g; arr[i + 2] = c.b; }
    g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
    g.deleteAttribute('uv');
    if (!onlyHood) parts.push(g);
    if (onlyHood || (where && peeks(...where))) hoodParts.push(g);
  };
  // base volume of curls over the scalp (fibonacci sphere)
  const N = 150;
  for (let i = 0; i < N; i++) {
    const y = 1 - (i / (N - 1)) * 1.6; // from top down to below equator
    const r = Math.sqrt(Math.max(0, 1 - y * y));
    const phi = i * 2.39996;
    const x = Math.cos(phi) * r, z = Math.sin(phi) * r;
    // keep the face clear
    if (z > 0.35 && y < 0.42) continue;
    if (z > 0.0 && y < 0.05 && Math.abs(x) < 0.85) continue;
    const s = headR * (0.2 + rand() * 0.1);
    const rr = headR * (1.02 + rand() * 0.1);
    const g = rand() < 0.55 ? new THREE.IcosahedronGeometry(s, 1) : new THREE.TorusGeometry(s * 0.7, s * 0.38, 5, 8);
    g.rotateX(rand() * 6); g.rotateY(rand() * 6);
    g.translate(x * rr, y * rr, z * rr);
    addColored(g, rand(), [x * rr, y * rr, z * rr]);
  }
  // longer curls falling to the shoulders around the back and sides
  const rings = style.hairLength === 'long' ? 7 : 4;
  for (let ring = 0; ring < rings; ring++) {
    const yy = -headR * (0.15 + ring * 0.27);
    const count = 16 + Math.min(ring, 3);
    for (let k = 0; k < count; k++) {
      const spread = ring < 3 ? 1.55 : 1.7; // lower curls wrap forward over the shoulders
      const a = Math.PI * 0.5 + (k / (count - 1) - 0.5) * Math.PI * spread; // around the back
      const rad = headR * (0.95 + Math.min(ring, 4) * 0.09 + rand() * 0.08);
      const x = Math.cos(a) * rad, z = -Math.sin(a) * rad * 0.9;
      const s = headR * (0.2 + rand() * 0.07);
      const g = rand() < 0.5 ? new THREE.IcosahedronGeometry(s, 1) : new THREE.TorusGeometry(s * 0.7, s * 0.38, 5, 8);
      g.rotateX(rand() * 6); g.rotateZ(rand() * 6);
      g.translate(x, yy + (rand() - 0.5) * 0.03, z);
      addColored(g, rand(), [x, yy, z]);
    }
  }
  // fluffy bangs
  for (let k = 0; k < 9; k++) {
    const a = (k / 8 - 0.5) * 1.5;
    const s = headR * (0.17 + rand() * 0.05);
    const g = new THREE.TorusGeometry(s * 0.7, s * 0.4, 5, 8);
    g.rotateY(rand() * 3);
    g.translate(Math.sin(a) * headR * 0.88, headR * (0.6 + Math.cos(a * 2) * 0.08), Math.cos(a) * headR * 0.78);
    addColored(g, rand(), [0, headR, headR]);
  }
  // with the hood up, a few long curls spill out below it, in front of her shoulders
  for (const side of [-1, 1]) {
    for (let k = 0; k < 4; k++) {
      const s = headR * (0.18 + rand() * 0.05);
      const g = rand() < 0.5 ? new THREE.IcosahedronGeometry(s, 1) : new THREE.TorusGeometry(s * 0.7, s * 0.38, 5, 8);
      g.rotateX(rand() * 6); g.rotateZ(rand() * 6);
      g.translate(side * headR * (0.78 + k * 0.04), -headR * (0.95 + k * 0.26), headR * (0.42 - k * 0.04));
      addColored(g, rand(), null, true);
    }
  }
  const full = mergeGeometries(parts);
  full.computeVertexNormals();
  const hooded = mergeGeometries(hoodParts);
  hooded.computeVertexNormals();
  return { full, hooded };
}

export class Kid {
  /**
   * @param {object} style colors and options from style.js
   * @param {object} o
   * @param {'jacinta'|'liev'|'kid'} o.kind
   */
  constructor(style, { kind = 'kid' } = {}) {
    this.style = style;
    this.kind = kind;
    this.root = new THREE.Group();
    this.root.name = style.name;
    this.body = new THREE.Group();
    this.root.add(this.body);
    const adult = !!style.adult;
    const S = style.height ? (adult ? style.height / 1.25 : style.height) : 1;
    const rand = makeRandom(style.name.length * 77);

    // proportions (meters before scale)
    const headR = adult ? 0.17 : 0.22;
    const thigh = adult ? 0.36 : 0.2, shin = adult ? 0.36 : 0.2;
    const torsoLen = adult ? 0.5 : 0.34;
    const hipY = 0.07 + shin + thigh;
    this.dims = { headR, thigh, shin, torsoLen, hipY, S };
    this.body.scale.setScalar(adult ? 1.25 * S / 1.73 * 1.38 : S);

    const skin = mat(style.skin, { roughness: 0.6 });
    const topColor = style.hoodie || style.jersey || style.top;
    const topMat = kind === 'jacinta' ? fabric(topColor) : kind === 'liev' ? new THREE.MeshStandardMaterial({ map: jerseyTexture(style), roughness: 0.6 }) : fabric(topColor);
    const bottomMat = fabric(style.shorts || style.bottom, { sheen: 0.3, roughness: 0.6 });
    const shoeMat = mat(style.shoes || '#ffffff', { roughness: 0.5 });

    // hips
    this.hips = new THREE.Group();
    this.hips.position.y = hipY;
    this.body.add(this.hips);
    const pelvis = mesh(new THREE.CylinderGeometry(0.15, 0.165, 0.14, 16), bottomMat);
    pelvis.scale.z = 0.8;
    this.hips.add(pelvis);

    // legs
    const longPants = adult || style.pants;
    this.legs = [];
    for (const side of [-1, 1]) {
      const leg = new THREE.Group();
      leg.position.set(side * 0.078, -0.02, 0);
      this.hips.add(leg);
      const thighMat = longPants ? bottomMat : skin;
      const th = mesh(new THREE.CapsuleGeometry(adult ? 0.065 : 0.058, thigh - 0.06, 4, 10), thighMat);
      th.position.y = -thigh / 2;
      leg.add(th);
      // shorts leg opening
      if (!longPants) {
        const sl = mesh(new THREE.CylinderGeometry(0.082, 0.095, 0.1, 14, 1, true), bottomMat);
        sl.material = bottomMat;
        sl.position.y = -0.05;
        leg.add(sl);
        if (style.shortsTrim) {
          const trim = mesh(new THREE.TorusGeometry(0.094, 0.009, 6, 18), mat(style.shortsTrim));
          trim.rotation.x = Math.PI / 2;
          trim.position.y = -0.1;
          trim.rotation.z = side * 0.25; // dolphin-shorts curve
          leg.add(trim);
        }
      }
      const knee = new THREE.Group();
      knee.position.y = -thigh;
      leg.add(knee);
      const shinMat = longPants ? bottomMat : style.socks ? fabric(style.socks) : skin;
      const sh = mesh(new THREE.CapsuleGeometry(adult ? 0.058 : 0.052, shin - 0.05, 4, 10), shinMat);
      sh.position.y = -shin / 2;
      knee.add(sh);
      if (style.socks) {
        const top = mesh(new THREE.TorusGeometry(0.056, 0.012, 6, 16), fabric(style.jerseyStripe || '#ffffff'));
        top.rotation.x = Math.PI / 2;
        top.position.y = -0.04;
        knee.add(top);
      }
      // leg warmers (only shown when chilly)
      let warmer = null;
      if (style.legWarmers) {
        const wt = stripeTexture(style.legWarmers, 8);
        warmer = mesh(new THREE.CylinderGeometry(0.07, 0.078, shin * 0.72, 16, 4), new THREE.MeshStandardMaterial({ map: wt, roughness: 1 }));
        // slouchy bunching
        const p = warmer.geometry.attributes.position;
        for (let i = 0; i < p.count; i++) {
          const y = p.getY(i);
          const k = 1 + Math.sin(y * 60) * 0.06;
          p.setX(i, p.getX(i) * k); p.setZ(i, p.getZ(i) * k);
        }
        warmer.geometry.computeVertexNormals();
        warmer.position.y = -shin * 0.58;
        warmer.visible = false;
        knee.add(warmer);
      }
      const foot = new THREE.Group();
      foot.position.y = -shin;
      knee.add(foot);
      const shoe = mesh(new THREE.SphereGeometry(1, 16, 12), shoeMat);
      shoe.scale.set(0.068, 0.05, 0.115);
      shoe.position.set(0, -0.025, 0.035);
      foot.add(shoe);
      const sole = mesh(new THREE.CylinderGeometry(1, 1, 1, 16), mat(style.shoeAccent || '#dddddd'));
      sole.scale.set(0.07, 0.018, 0.118);
      sole.position.set(0, -0.06, 0.035);
      foot.add(sole);
      this.legs.push({ leg, knee, foot, warmer });
    }

    // torso
    this.spine = new THREE.Group();
    this.spine.position.y = 0.04;
    this.hips.add(this.spine);
    const torsoR = adult ? 0.17 : 0.155;
    const torsoGeo = new THREE.CapsuleGeometry(torsoR, torsoLen - torsoR * 1.2, 6, 18);
    const torso = mesh(torsoGeo, topMat);
    torso.position.y = torsoLen / 2 - 0.02;
    torso.scale.set(1, 1, 0.8);
    this.spine.add(torso);
    this.torso = torso;

    if (kind === 'jacinta') {
      // kangaroo pocket
      const pocket = mesh(new THREE.CapsuleGeometry(0.045, 0.12, 4, 8), fabric(style.hoodieInner));
      pocket.rotation.z = Math.PI / 2;
      pocket.scale.set(1, 1, 0.35);
      pocket.position.set(0, 0.1, torsoR * 0.78);
      this.spine.add(pocket);
      // drawstrings
      for (const s of [-1, 1]) {
        const str = mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.12, 5), mat('#ffffff'));
        str.position.set(s * 0.04, torsoLen - 0.12, torsoR * 0.8 + 0.01);
        this.spine.add(str);
        const tip = mesh(new THREE.SphereGeometry(0.012, 6, 6), mat('#ffffff'));
        tip.position.set(s * 0.04, torsoLen - 0.19, torsoR * 0.8 + 0.01);
        this.spine.add(tip);
      }
      // hem band
      const hem = mesh(new THREE.TorusGeometry(torsoR * 0.98, 0.022, 8, 24), fabric(style.hoodieInner));
      hem.rotation.x = Math.PI / 2;
      hem.scale.set(1, 0.8, 1);
      hem.position.y = 0.0;
      this.spine.add(hem);
    }

    // neck + head
    this.neck = new THREE.Group();
    this.neck.position.y = torsoLen - 0.01;
    this.spine.add(this.neck);
    const neckM = mesh(new THREE.CylinderGeometry(0.05, 0.055, 0.08, 10), skin);
    neckM.position.y = 0.03;
    this.neck.add(neckM);
    this.head = new THREE.Group();
    this.head.position.y = 0.05 + headR * 0.92;
    this.neck.add(this.head);

    this.faceOpts = { skin: style.skin, eyes: style.eyes, freckles: !!style.freckles, glasses: !!style.glasses, brows: style.brows || null, smile: style.smile || 'open' };
    this.mood = 'happy';
    this.headMat = new THREE.MeshStandardMaterial({ map: humanFaceTexture({ ...this.faceOpts, mood: 'happy' }), roughness: 0.6 });
    const headM = mesh(new THREE.SphereGeometry(headR, 40, 28), this.headMat);
    headM.scale.set(1, 0.97, 0.95);
    this.head.add(headM);
    for (const s of [-1, 1]) {
      const ear = mesh(new THREE.SphereGeometry(headR * 0.2, 10, 8), skin);
      ear.scale.set(0.6, 1, 0.8);
      ear.position.set(s * headR * 0.96, -headR * 0.05, -headR * 0.05);
      this.head.add(ear);
    }

    // hair
    if (kind === 'jacinta') {
      const hairGeos = curlyHairGeometry(headR, rand, style);
      const hairMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.75 });
      const hair = mesh(hairGeos.full, hairMat);
      this.hairHooded = mesh(hairGeos.hooded, hairMat);
      this.hairHooded.visible = false;
      this.head.add(this.hairHooded);
      this.head.add(hair);
      this.hair = hair;
    } else if (kind === 'liev') {
      const cap = mesh(new THREE.SphereGeometry(headR * 1.035, 40, 20, 0, Math.PI * 2, 0, Math.PI * 0.56),
        new THREE.MeshStandardMaterial({ map: fadeHairTexture(style, true), alphaTest: 0.5, roughness: 0.9 }), { cast: false });
      cap.scale.copy(headM.scale);
      this.head.add(cap);
      // fuller, textured top with a heavy fringe (bangs) falling over the forehead
      const hairTop = mat(style.hair, { roughness: 0.9 });
      const hairHi = mat(style.hairHighlight || style.hair, { roughness: 0.9 });
      const top = mesh(new THREE.SphereGeometry(headR * 1.1, 32, 14, 0, Math.PI * 2, 0, Math.PI * 0.36), hairTop);
      top.scale.set(0.97, 0.95, 1.0);
      top.position.y = headR * 0.04;
      this.head.add(top);
      // tousled locks on top
      for (let i = 0; i < 14; i++) {
        const lock = mesh(new THREE.CapsuleGeometry(headR * 0.12, headR * 0.35, 3, 6), i % 3 ? hairTop : hairHi);
        const a = (i / 14) * Math.PI * 2;
        lock.position.set(Math.cos(a) * headR * 0.45, headR * 0.95, Math.sin(a) * headR * 0.45);
        lock.rotation.set(Math.sin(a) * 0.9 + 0.2, a, -Math.cos(a) * 0.9);
        lock.scale.set(1, 1, 0.6);
        this.head.add(lock);
      }
      // bangs: flattened locks sweeping down over the forehead
      for (let i = 0; i < 9; i++) {
        const t = i / 8 - 0.5;
        const lock = mesh(new THREE.CapsuleGeometry(headR * 0.12, headR * 0.5, 3, 6), i % 2 ? hairTop : hairHi);
        const ang = t * 1.7;
        lock.position.set(Math.sin(ang) * headR * 0.95, headR * 0.5, Math.cos(ang) * headR * 0.9);
        lock.rotation.order = 'YXZ';
        lock.rotation.set(-0.45, ang, t * 0.5);
        lock.scale.set(1, 1, 0.45);
        this.head.add(lock);
      }
    } else {
      this._genericHair(style, headR, headM, rand);
    }

    // arms
    this.arms = [];
    const shoulderY = torsoLen - 0.07;
    const upper = adult ? 0.28 : 0.15, fore = adult ? 0.26 : 0.14;
    const longSleeves = kind === 'jacinta' || style.longSleeves;
    for (const side of [-1, 1]) {
      const sh = new THREE.Group();
      sh.position.set(side * (torsoR + 0.03), shoulderY, 0);
      this.spine.add(sh);
      const ua = mesh(new THREE.CapsuleGeometry(adult ? 0.055 : 0.05, upper - 0.05, 4, 10), longSleeves || true ? topMat : skin);
      ua.position.y = -upper / 2;
      sh.add(ua);
      const elbow = new THREE.Group();
      elbow.position.y = -upper;
      sh.add(elbow);
      const fa = mesh(new THREE.CapsuleGeometry(adult ? 0.047 : 0.044, fore - 0.05, 4, 10), longSleeves ? topMat : skin);
      fa.position.y = -fore / 2;
      elbow.add(fa);
      if (longSleeves) {
        const cuff = mesh(new THREE.TorusGeometry(0.043, 0.012, 6, 14), fabric(style.hoodieInner || topColor));
        cuff.rotation.x = Math.PI / 2;
        cuff.position.y = -fore + 0.02;
        elbow.add(cuff);
      }
      const hand = mesh(new THREE.SphereGeometry(adult ? 0.05 : 0.045, 12, 10), skin);
      hand.scale.set(0.85, 1, 0.75);
      hand.position.y = -fore - 0.01;
      elbow.add(hand);
      const handSlot = new THREE.Group();
      handSlot.position.y = -fore - 0.03;
      elbow.add(handSlot);
      this.arms.push({ sh, elbow, hand: handSlot });
    }

    // hood with bear ears (Jacinta)
    if (kind === 'jacinta') {
      const hoodMat = fabric(style.hoodie);
      const inner = fabric(style.hoodieInner);
      // hood down: rests on her upper back
      this.hoodDown = new THREE.Group();
      const hd = mesh(new THREE.SphereGeometry(0.15, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.55), hoodMat);
      hd.scale.set(1.1, 0.7, 0.8);
      hd.rotation.x = -2.3;
      this.hoodDown.add(hd);
      for (const s of [-1, 1]) {
        const ear = this._bearEar(hoodMat, inner);
        ear.position.set(s * 0.1, -0.02, -0.08);
        ear.rotation.set(-1.9, 0, s * 0.3);
        this.hoodDown.add(ear);
      }
      this.hoodDown.position.set(0, torsoLen - 0.03, -torsoR * 0.75);
      this.spine.add(this.hoodDown);
      // hood up: over her curls (used when chilly)
      this.hoodUp = new THREE.Group();
      const hu = mesh(new THREE.SphereGeometry(headR * 1.32, 28, 18, Math.PI * 0.82, Math.PI * 1.36, 0, Math.PI * 0.72), hoodMat);
      hu.material = hoodMat;
      this.hoodUp.add(hu);
      const rim = mesh(new THREE.TorusGeometry(headR * 1.2, 0.03, 8, 24, Math.PI * 1.25), inner);
      rim.rotation.set(0, 0, -Math.PI * 0.125 + Math.PI / 2 - Math.PI * 0.5);
      rim.position.set(0, headR * 0.05, headR * 0.62);
      rim.rotation.set(0, 0, Math.PI * -0.12);
      this.hoodUp.add(rim);
      for (const s of [-1, 1]) {
        const ear = this._bearEar(hoodMat, inner);
        ear.scale.setScalar(1.25);
        ear.position.set(s * headR * 0.85, headR * 0.98, -headR * 0.05);
        ear.rotation.set(0, 0, -s * 0.45);
        this.hoodUp.add(ear);
      }
      this.hoodUp.visible = false;
      this.head.add(this.hoodUp);
    }

    // backpack (for carrying Pinky)
    this.backpack = new THREE.Group();
    const bp = mesh(new THREE.CapsuleGeometry(0.12, 0.1, 6, 12), fabric('#b9a6ff'));
    bp.scale.set(1.1, 1, 0.6);
    this.backpack.add(bp);
    const flap = mesh(new THREE.CapsuleGeometry(0.06, 0.12, 4, 10), fabric('#a08cf0'));
    flap.rotation.z = Math.PI / 2;
    flap.scale.set(1, 1, 0.4);
    flap.position.set(0, -0.06, 0.07);
    this.backpack.add(flap);
    for (const s of [-1, 1]) {
      const strap = mesh(new THREE.TorusGeometry(0.11, 0.014, 6, 14, Math.PI), fabric('#8f7ae0'));
      strap.rotation.y = Math.PI / 2;
      strap.position.set(s * 0.09, 0.02, 0.12);
      this.backpack.add(strap);
    }
    this.backpack.position.set(0, torsoLen * 0.55, kind === 'jacinta' ? -0.3 : -torsoR * 0.8 - 0.06);
    this.backpackSlot = new THREE.Group();
    this.backpackSlot.position.set(0.02, 0.12, 0);
    this.backpack.add(this.backpackSlot);
    this.backpack.visible = false;
    this.spine.add(this.backpack);

    // animation state
    this.phase = 0;
    this.blinkTimer = 2 + Math.random() * 3;
    this.blinking = 0;
    this.time = Math.random() * 10;
    this.anim = { speed: 0, grounded: true, vy: 0, swim: 0, sit: 0, action: null, actionT: 0, run: 0, lookYaw: 0 };
    this._sw = 0; this._sit = 0; this._air = 0; this._act = 0; this._run = 0;
  }

  _bearEar(outer, inner) {
    const g = new THREE.Group();
    const o = mesh(new THREE.SphereGeometry(0.05, 14, 10), outer);
    o.scale.set(1, 1, 0.5);
    g.add(o);
    const i = mesh(new THREE.SphereGeometry(0.03, 12, 8), inner);
    i.scale.set(1, 1, 0.4);
    i.position.z = 0.02;
    g.add(i);
    return g;
  }

  _genericHair(style, headR, headM, rand) {
    const hairMat = mat(style.hair, { roughness: 0.9 });
    const cap = mesh(new THREE.SphereGeometry(headR * 1.04, 32, 16, 0, Math.PI * 2, 0, Math.PI * 0.42), hairMat);
    cap.scale.copy(headM.scale);
    // tilt so hair covers the back more than the forehead
    cap.rotation.x = -0.35;
    this.head.add(cap);
    if (style.hairStyle === 'puffs') {
      for (const s of [-1, 1]) {
        const g = new THREE.IcosahedronGeometry(headR * 0.55, 3);
        const p = g.attributes.position;
        for (let i = 0; i < p.count; i++) {
          const k = 1 + (rand() - 0.5) * 0.08;
          p.setXYZ(i, p.getX(i) * k, p.getY(i) * k, p.getZ(i) * k);
        }
        g.computeVertexNormals();
        const puff = mesh(g, hairMat);
        puff.position.set(s * headR * 0.8, headR * 0.75, -headR * 0.1);
        this.head.add(puff);
      }
    } else if (style.hairStyle === 'spiky') {
      for (let i = 0; i < 9; i++) {
        const cone = mesh(new THREE.ConeGeometry(0.05, 0.13, 6), hairMat);
        const a = (i / 9) * Math.PI * 2;
        cone.position.set(Math.cos(a) * headR * 0.55, headR * 0.85, Math.sin(a) * headR * 0.55 - 0.03);
        cone.rotation.set(Math.sin(a) * 0.6, 0, -Math.cos(a) * 0.6);
        this.head.add(cone);
      }
    } else if (style.hairStyle === 'bun') {
      const bun = mesh(new THREE.SphereGeometry(headR * 0.42, 16, 12), hairMat);
      bun.position.set(0, headR * 0.85, -headR * 0.55);
      this.head.add(bun);
    }
    if (style.cap) {
      const c = mesh(new THREE.SphereGeometry(headR * 1.08, 24, 12, 0, Math.PI * 2, 0, Math.PI * 0.4), mat(style.cap));
      c.position.y = headR * 0.05;
      this.head.add(c);
      const brim = mesh(new THREE.CylinderGeometry(headR * 0.7, headR * 0.7, 0.015, 20, 1, false, -Math.PI / 2, Math.PI), mat(style.cap));
      brim.position.set(0, headR * 0.45, headR * 0.6);
      brim.rotation.x = 0.15;
      this.head.add(brim);
    }
    if (style.beard) {
      const b = mesh(new THREE.SphereGeometry(headR * 1.02, 24, 12, Math.PI * 0.0, Math.PI, Math.PI * 0.62, Math.PI * 0.3), hairMat);
      b.rotation.y = 0;
      this.head.add(b);
    }
  }

  setMood(mood) {
    if (this.mood === mood) return;
    this.mood = mood;
    this.headMat.map = humanFaceTexture({ ...this.faceOpts, mood });
    this.headMat.needsUpdate = true;
  }

  setChilly(chilly) {
    for (const l of this.legs) if (l.warmer) l.warmer.visible = chilly;
    if (this.hoodUp) {
      this.hoodUp.visible = chilly;
      this.hoodDown.visible = !chilly;
      // hood up: only the curls framing her face (and a few spilling out) show
      if (this.hair) this.hair.visible = !chilly;
      if (this.hairHooded) this.hairHooded.visible = chilly;
    }
  }

  playAction(name, duration = 1.5) {
    this.anim.action = name;
    this.anim.actionT = duration;
  }

  update(dt) {
    const a = this.anim;
    this.time += dt;
    // blinking
    this.blinkTimer -= dt;
    if (this.blinkTimer < 0) {
      this.blinking = 0.14;
      this.blinkTimer = 2.5 + Math.random() * 3.5;
      this.headMat.map = humanFaceTexture({ ...this.faceOpts, mood: this.mood, blink: true });
    }
    if (this.blinking > 0) {
      this.blinking -= dt;
      if (this.blinking <= 0) this.headMat.map = humanFaceTexture({ ...this.faceOpts, mood: this.mood });
    }
    if (a.actionT > 0) { a.actionT -= dt; if (a.actionT <= 0) a.action = a.persist ? a.action : null; }

    const speed = a.speed;
    const moving = Math.min(1, speed / 2.2);
    this._run = damp(this._run, a.run ? 1 : 0, 6, dt);
    this.phase += dt * (3 + speed * 2.4);
    const air = a.grounded ? 0 : 1;
    this._air = damp(this._air, air, 10, dt);
    this._sw = damp(this._sw, a.swim ? 1 : 0, 5, dt);
    this._sit = damp(this._sit, a.sit ? 1 : 0, 5, dt);

    const sw = this._sw, sit = this._sit, ai = this._air * (1 - sw);
    const ph = this.phase;
    const amp = (0.55 + this._run * 0.35) * moving * (1 - ai) * (1 - sw) * (1 - sit);
    const [L, R] = this.legs;
    const [AL, AR] = this.arms;

    // legs
    let lx = Math.sin(ph) * amp, rx = -Math.sin(ph) * amp;
    let lk = Math.max(0, Math.sin(ph + 1.4)) * amp * 1.3, rk = Math.max(0, -Math.sin(ph + 1.4)) * amp * 1.3;
    // air: tuck
    lx += ai * (-0.6); rx += ai * (-0.1); lk += ai * 1.0; rk += ai * 0.4;
    // swim: flutter kick
    if (sw > 0.01) {
      const k = Math.sin(this.time * 8) * 0.35 * sw;
      lx = lx * (1 - sw) + k; rx = rx * (1 - sw) - k; lk = lk * (1 - sw) + 0.2 * sw; rk = rk * (1 - sw) + 0.2 * sw;
    }
    // sit: legs forward
    lx = lx * (1 - sit) - 1.45 * sit; rx = rx * (1 - sit) - 1.45 * sit;
    lk = lk * (1 - sit) + 1.3 * sit; rk = rk * (1 - sit) + 1.3 * sit;
    L.leg.rotation.x = lx; R.leg.rotation.x = rx;
    L.knee.rotation.x = lk; R.knee.rotation.x = rk;
    L.leg.rotation.z = -0.03; R.leg.rotation.z = 0.03;

    // arms
    let alx = -Math.sin(ph) * amp * 0.9, arx = Math.sin(ph) * amp * 0.9;
    let alz = 0.12 + ai * 0.5, arz = -0.12 - ai * 0.5;
    let ale = -0.25 - this._run * 0.7 * moving, are = -0.25 - this._run * 0.7 * moving;
    alx -= ai * 0.4; arx -= ai * 0.4;
    if (sw > 0.01) {
      const st = this.time * 2.2;
      alx = alx * (1 - sw) + (-2.6 + Math.sin(st) * 0.6) * sw;
      arx = arx * (1 - sw) + (-2.6 + Math.sin(st) * 0.6) * sw;
      alz = alz * (1 - sw) + (0.3 + Math.cos(st) * 0.5) * sw;
      arz = arz * (1 - sw) - (0.3 + Math.cos(st) * 0.5) * sw;
    }
    // idle sway
    const idle = (1 - moving) * (1 - ai) * (1 - sw);
    const breath = Math.sin(this.time * 2) * 0.02;
    alz += idle * 0.04 + breath; arz -= idle * 0.04 + breath;

    const act = a.action;
    this._act = damp(this._act, act ? 1 : 0, 8, dt);
    const ac = this._act;
    if (act === 'wave' || this._lastAct === 'wave') {
      arx = arx * (1 - ac) + (-2.7) * ac; arz = arz * (1 - ac) + (-0.3 + Math.sin(this.time * 10) * 0.35) * ac; are = are * (1 - ac) - 0.3 * ac;
    } else if (act === 'hug' || this._lastAct === 'hug') {
      alx = alx * (1 - ac) - 1.4 * ac; arx = arx * (1 - ac) - 1.4 * ac;
      alz = alz * (1 - ac) - 0.5 * ac; arz = arz * (1 - ac) + 0.5 * ac;
      ale = ale * (1 - ac) - 1.2 * ac; are = are * (1 - ac) - 1.2 * ac;
    } else if (act === 'give' || act === 'carry' || this._lastAct === 'give' || this._lastAct === 'carry') {
      alx = alx * (1 - ac) - 1.1 * ac; arx = arx * (1 - ac) - 1.1 * ac;
      alz = alz * (1 - ac) - 0.15 * ac; arz = arz * (1 - ac) + 0.15 * ac;
      ale = ale * (1 - ac) - 0.6 * ac; are = are * (1 - ac) - 0.6 * ac;
    } else if (act === 'cheer' || this._lastAct === 'cheer') {
      const j = Math.abs(Math.sin(this.time * 7));
      alx = alx * (1 - ac) - 2.9 * ac; arx = arx * (1 - ac) - 2.9 * ac;
      alz = alz * (1 - ac) + 0.3 * ac; arz = arz * (1 - ac) - 0.3 * ac;
      this.body.position.y = j * 0.12 * ac;
    } else if (act === 'sad' || this._lastAct === 'sad') {
      alx = alx * (1 - ac) - 0.9 * ac; arx = arx * (1 - ac) - 0.9 * ac;
      ale = ale * (1 - ac) - 1.6 * ac; are = are * (1 - ac) - 1.6 * ac;
      alz = alz * (1 - ac) - 0.3 * ac; arz = arz * (1 - ac) + 0.3 * ac;
    } else if (act === 'point' || this._lastAct === 'point') {
      arx = arx * (1 - ac) - 1.6 * ac; are = are * (1 - ac) + 0 * ac;
    }
    if (act) this._lastAct = act;
    if (!act && ac < 0.02) this._lastAct = null;

    AL.sh.rotation.x = alx; AR.sh.rotation.x = arx;
    AL.sh.rotation.z = alz; AR.sh.rotation.z = arz;
    AL.elbow.rotation.x = ale; AR.elbow.rotation.x = are;

    // body
    const bob = Math.abs(Math.sin(ph)) * 0.035 * moving * (1 - ai) * (1 - sw) * (1 - sit);
    if (act !== 'cheer') this.body.position.y = bob - sit * (this.dims.thigh + 0.02) * this.body.scale.y + breath * 0.2;
    this.spine.rotation.x = (0.08 * moving + this._run * 0.2 * moving) * (1 - sw) + (act === 'sad' ? 0.25 * ac : 0) + (act === 'hug' ? 0.12 * ac : 0);
    this.spine.rotation.y = Math.sin(ph) * 0.08 * moving * (1 - sw);
    this.body.rotation.x = sw * 1.25;
    this.body.position.z = 0;
    if (sw > 0.01) this.body.position.y += sw * 0.55;
    // head looks around a bit while idle
    this.head.rotation.y = Math.sin(this.time * 0.4) * 0.25 * idle + (a.lookYaw || 0);
    this.head.rotation.x = -sw * 0.9 + Math.sin(this.time * 0.7) * 0.04 * idle + (act === 'sad' ? 0.35 * ac : 0);
    this.head.rotation.z = Math.sin(this.time * 0.5) * 0.05 * idle;
  }
}
