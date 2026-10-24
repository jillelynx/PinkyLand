// Sea life for Pinky Land's coral reef: corals (staghorn, brain, table, fans), tube sponges,
// kelp, swaying anemones, shells and starfish on the sand, schools of neon fish and little
// shrimp. At night the reef glows softly. Also: the glowing (bioluminescent) pond.
// Everything is "instanced" (one shape drawn many times) so it stays fast.
import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { sharedUniforms } from './terrain.js';
import { makeRandom, makeNoise2D } from '../util/noise.js';

// ---------------------------------------------------------------- shared helpers
// A standard material that (a) sways gently in the current and (b) glows a little with its
// own colour, more at night.
function reefMaterial({ sway = 0, swayFreq = 1.6, glow = 0.12, nightGlow = 0.35, key, ...opts }) {
  const m = new THREE.MeshStandardMaterial({ roughness: 0.75, metalness: 0, vertexColors: true, ...opts });
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = sharedUniforms.uTime;
    shader.uniforms.uNight = sharedUniforms.uNight;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uTime;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        float ph = 0.0;
        #ifdef USE_INSTANCING
          ph = instanceMatrix[3].x * 0.7 + instanceMatrix[3].z * 0.4;
        #endif
        float k = max(position.y, 0.0);
        transformed.x += sin(uTime * ${swayFreq.toFixed(2)} + ph + position.y * 2.0) * ${sway.toFixed(3)} * k * k;
        transformed.z += cos(uTime * ${(swayFreq * 0.8).toFixed(2)} + ph * 1.3) * ${(sway * 0.6).toFixed(3)} * k * k;`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uNight;')
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        totalEmissiveRadiance += diffuseColor.rgb * (${glow.toFixed(3)} + ${nightGlow.toFixed(3)} * uNight);`);
  };
  m.customProgramCacheKey = () => 'reef-' + key;
  return m;
}

// give a geometry a vertex colour (white, or a gradient function of y)
function paint(g, fn) {
  const p = g.attributes.position, c = [];
  const col = new THREE.Color();
  for (let i = 0; i < p.count; i++) { fn(col, p.getX(i), p.getY(i), p.getZ(i)); c.push(col.r, col.g, col.b); }
  g.setAttribute('color', new THREE.Float32BufferAttribute(c, 3));
  return g;
}
const prep = (g) => { if (g.index) g = g.toNonIndexed(); for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal' && k !== 'color') g.deleteAttribute(k); return g; };

// ---------------------------------------------------------------- shapes (all stand on y = 0)
function staghornGeo(rand) {
  const parts = [];
  const up = new THREE.Vector3(0, 1, 0);
  const branch = (start, dir, len, rad, depth) => {
    const g = new THREE.CylinderGeometry(rad * 0.7, rad, len, 6, 1);
    g.translate(0, len / 2, 0);
    g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(up, dir));
    g.translate(start.x, start.y, start.z);
    parts.push(prep(g));
    const tip = start.clone().addScaledVector(dir, len);
    const cap = new THREE.SphereGeometry(rad * 0.75, 6, 4); cap.translate(tip.x, tip.y, tip.z); parts.push(prep(cap));
    if (depth > 0) {
      const n = 2 + Math.floor(rand() * 2);
      for (let i = 0; i < n; i++) {
        const d = dir.clone().add(new THREE.Vector3((rand() - 0.5) * 1.4, rand() * 0.5, (rand() - 0.5) * 1.4)).normalize();
        if (d.y < 0.25) d.y = 0.25;
        branch(tip, d.normalize(), len * (0.6 + rand() * 0.2), rad * 0.72, depth - 1);
      }
    }
  };
  for (let i = 0; i < 3; i++) branch(new THREE.Vector3((rand() - 0.5) * 0.2, 0, (rand() - 0.5) * 0.2), new THREE.Vector3((rand() - 0.5) * 0.8, 1, (rand() - 0.5) * 0.8).normalize(), 0.42, 0.07, 2);
  const g = mergeGeometries(parts);
  return paint(g, (c, x, y) => c.setScalar(0.75 + Math.min(1, y / 1.2) * 0.35));
}

function brainGeo(seed) {
  const noise = makeNoise2D(seed);
  let g = new THREE.SphereGeometry(0.5, 28, 18, 0, Math.PI * 2, 0, Math.PI * 0.6);
  g.deleteAttribute('normal'); g.deleteAttribute('uv'); g = mergeVertices(g);
  const p = g.attributes.position, v = new THREE.Vector3();
  const ridge = [];
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const r = Math.abs(Math.sin(noise(v.x * 6, v.z * 6 + v.y * 4) * 9)); // wiggly maze ridges
    ridge.push(r);
    v.multiplyScalar(1 + r * 0.06);
    v.y = (v.y - 0.06) * 1.0;
    p.setXYZ(i, v.x, v.y, v.z);
  }
  g.translate(0, -0.12, 0);
  const col = []; for (const r of ridge) { const s = 0.6 + r * 0.45; col.push(s, s, s); }
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g = g.toNonIndexed(); g.computeVertexNormals();
  return g;
}

function tableGeo(rand) {
  const stalk = prep(new THREE.CylinderGeometry(0.06, 0.1, 0.35, 7)); stalk.translate(0, 0.175, 0);
  const top = new THREE.CylinderGeometry(0.55, 0.45, 0.07, 18, 1);
  const p = top.attributes.position;
  for (let i = 0; i < p.count; i++) { const a = Math.atan2(p.getZ(i), p.getX(i)); const r = 1 + Math.sin(a * 5 + 1) * 0.08 + Math.sin(a * 11) * 0.04; p.setX(i, p.getX(i) * r); p.setZ(i, p.getZ(i) * r); }
  top.translate(0, 0.38, 0);
  const g = mergeGeometries([stalk, prep(top)]);
  return paint(g, (c, x, y) => c.setScalar(y > 0.34 ? 1.0 : 0.7));
}

function fanTexture() {
  const cv = document.createElement('canvas'); cv.width = cv.height = 128;
  const g = cv.getContext('2d');
  g.strokeStyle = '#ffffff'; g.lineCap = 'round';
  const br = (x, y, a, len, w, d) => {
    const x2 = x + Math.cos(a) * len, y2 = y - Math.sin(a) * len;
    g.lineWidth = w; g.beginPath(); g.moveTo(x, y); g.lineTo(x2, y2); g.stroke();
    if (d > 0) { br(x2, y2, a + 0.45, len * 0.72, w * 0.75, d - 1); br(x2, y2, a - 0.45, len * 0.72, w * 0.75, d - 1); }
  };
  br(64, 126, Math.PI / 2, 34, 5, 6);
  // the fine net between the branches
  g.globalAlpha = 0.5; g.lineWidth = 1;
  for (let r = 20; r < 120; r += 7) { g.beginPath(); g.arc(64, 126, r, Math.PI * 1.08, Math.PI * 1.92); g.stroke(); }
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function spongeGeo(rand) {
  const parts = [];
  for (let i = 0; i < 5; i++) {
    const h = 0.35 + rand() * 0.55, r = 0.07 + rand() * 0.05;
    const g = new THREE.CylinderGeometry(r * 1.2, r, h, 10, 1, true);
    g.translate((rand() - 0.5) * 0.35, h / 2, (rand() - 0.5) * 0.35);
    parts.push(prep(g));
  }
  const g = mergeGeometries(parts);
  return paint(g, (c, x, y) => c.setScalar(0.6 + Math.min(1, y / 0.8) * 0.5));
}

function anemoneGeo(rand) {
  const parts = [];
  const col = prep(new THREE.CylinderGeometry(0.16, 0.2, 0.18, 12)); col.translate(0, 0.09, 0);
  parts.push(paint(col, (c) => c.setRGB(0.55, 0.45, 0.5)));
  const disc = prep(new THREE.CylinderGeometry(0.17, 0.16, 0.03, 12)); disc.translate(0, 0.19, 0);
  parts.push(paint(disc, (c) => c.setRGB(0.9, 0.8, 0.85)));
  for (let i = 0; i < 46; i++) {
    const a = rand() * Math.PI * 2, rr = 0.03 + rand() * 0.13;
    const len = 0.22 + rand() * 0.16;
    const t = new THREE.CylinderGeometry(0.004, 0.018, len, 4, 3);
    // bend outward like a soft finger
    const p = t.attributes.position;
    for (let k = 0; k < p.count; k++) { const y = p.getY(k) + len / 2; const f = (y / len); p.setX(k, p.getX(k) + f * f * 0.09); }
    t.translate(0, len / 2, 0);
    t.rotateZ(-0.25 - rr * 2.2);
    t.rotateY(a);
    t.translate(Math.cos(a) * rr, 0.19, -Math.sin(a) * rr);
    parts.push(paint(prep(t), (c, x, y) => { const f = Math.min(1, Math.max(0, (y - 0.19) / 0.35)); c.setRGB(0.75 + f * 0.25, 0.7 + f * 0.3, 0.75 + f * 0.25); }));
  }
  return mergeGeometries(parts);
}

function kelpGeo(rand) {
  const parts = [];
  for (let i = 0; i < 4; i++) {
    const h = 1.0 + rand() * 1.0;
    const g = new THREE.PlaneGeometry(0.12, h, 1, 10);
    const p = g.attributes.position;
    for (let k = 0; k < p.count; k++) { const y = p.getY(k) + h / 2; p.setX(k, p.getX(k) * (1 - y / h * 0.5) + Math.sin(y * 3 + i) * 0.05); }
    g.translate((rand() - 0.5) * 0.3, h / 2, (rand() - 0.5) * 0.3);
    g.rotateY(rand() * Math.PI);
    parts.push(paint(prep(g), (c, x, y) => c.setScalar(0.6 + Math.min(1, y / 2) * 0.5)));
  }
  return mergeGeometries(parts);
}

function conchGeo() {
  const pts = [];
  for (let i = 0; i <= 14; i++) { const t = i / 14; pts.push(new THREE.Vector2(Math.sin(t * Math.PI) * 0.09 * (1.15 - t * 0.7) + 0.005, t * 0.3 - 0.05)); }
  const g = new THREE.LatheGeometry(pts, 14);
  const p = g.attributes.position;
  for (let k = 0; k < p.count; k++) { const y = p.getY(k), a = Math.atan2(p.getZ(k), p.getX(k)); const r = 1 + 0.18 * Math.max(0, Math.sin(a * 1 + y * 40)) ; p.setX(k, p.getX(k) * r); p.setZ(k, p.getZ(k) * r); }
  g.rotateZ(Math.PI / 2); g.translate(0, 0.07, 0);
  return paint(prep(g), (c, x) => { const s = 0.75 + 0.25 * Math.sin(x * 60); c.setRGB(1, 0.85 * s + 0.1, 0.8 * s + 0.1); });
}
function scallopGeo() {
  const g = new THREE.CircleGeometry(0.13, 18, Math.PI * 0.15, Math.PI * 0.7);
  const p = g.attributes.position;
  for (let k = 0; k < p.count; k++) { const x = p.getX(k), y = p.getY(k); const a = Math.atan2(y, x); const r = Math.hypot(x, y); p.setZ(k, Math.cos(a * 18) * 0.008 * r / 0.13 + r * 0.25); }
  g.rotateX(-Math.PI / 2 + 0.35); g.translate(0, 0.03, 0.05);
  return paint(prep(g), (c, x, y, z) => { const a = Math.atan2(z - 0.05, x); c.setScalar(0.75 + 0.25 * Math.cos(a * 18)); });
}
function cowrieGeo() {
  const g = new THREE.SphereGeometry(0.07, 14, 10); g.scale(1.5, 0.75, 1); g.translate(0, 0.045, 0);
  return paint(prep(g), (c, x, y, z) => { const spot = Math.sin(x * 90) * Math.sin(z * 90) > 0.6 ? 0.6 : 1; c.setScalar(y < 0.02 ? 0.95 : spot); });
}
function starfishGeo() {
  const sh = new THREE.Shape();
  for (let i = 0; i <= 10; i++) { const a = (i / 10) * Math.PI * 2 + Math.PI / 2, r = i % 2 ? 0.05 : 0.17; i ? sh.lineTo(Math.cos(a) * r, Math.sin(a) * r) : sh.moveTo(Math.cos(a) * r, Math.sin(a) * r); }
  const g = new THREE.ExtrudeGeometry(sh, { depth: 0.03, bevelEnabled: true, bevelThickness: 0.015, bevelSize: 0.02, bevelSegments: 2 });
  g.rotateX(-Math.PI / 2); g.translate(0, 0.01, 0);
  return paint(prep(g), (c, x, y, z) => c.setScalar(0.8 + 0.2 * Math.sin(x * 120) * Math.sin(z * 120)));
}
function sandDollarGeo() {
  const g = new THREE.CylinderGeometry(0.1, 0.1, 0.012, 20); g.translate(0, 0.006, 0);
  return paint(prep(g), (c, x, y, z) => { const a = Math.atan2(z, x), r = Math.hypot(x, z); const petal = r > 0.02 && r < 0.07 && Math.abs(Math.sin(a * 2.5)) < 0.25 ? 0.75 : 1; c.setScalar(petal); });
}

// a little neon fish: round body, forked tail and a fin (faces +z)
function neonFishGeo() {
  // a slim, tall little fish body (faces +z) with a forked tail, a top fin and two dark eyes
  const body = new THREE.SphereGeometry(0.1, 14, 10); body.scale(0.32, 0.62, 1.15);
  // flat fins drawn on both sides so you can see them from anywhere
  const twoSided = (v) => { const g = new THREE.BufferGeometry(); const back = [];
    for (let i = 0; i < v.length; i += 9) back.push(v[i], v[i + 1], v[i + 2], v[i + 6], v[i + 7], v[i + 8], v[i + 3], v[i + 4], v[i + 5]);
    g.setAttribute('position', new THREE.Float32BufferAttribute([...v, ...back], 3)); g.computeVertexNormals(); return g; };
  const tail = twoSided([0, 0, -0.09, 0, 0.09, -0.24, 0, 0.015, -0.17, 0, 0, -0.09, 0, -0.015, -0.17, 0, -0.09, -0.24, 0, 0, -0.09, 0, 0.015, -0.17, 0, -0.015, -0.17]);
  const fin = twoSided([0, 0.055, 0.05, 0, 0.11, -0.05, 0, 0.05, -0.08, 0, -0.055, 0.0, 0, -0.085, -0.05, 0, -0.05, -0.06]);
  const parts = [prep(body), prep(tail), prep(fin)];
  for (const sx of [-1, 1]) { const eye = new THREE.SphereGeometry(0.013, 6, 5); eye.translate(sx * 0.028, 0.015, 0.075); parts.push(paint(prep(eye), (c) => c.setScalar(0.05))); }
  const g = mergeGeometries(parts.map((x) => x.attributes.color ? x : paint(x, (c, x0, y, z) => { if (y < -0.025 && z > -0.09) c.setScalar(1.25); else if (Math.abs(y - 0.0) < 0.014 && z > -0.09 && z < 0.07) c.setRGB(1.7, 1.7, 1.7); else c.setScalar(1); })));
  return g;
}

// a little shrimp: a curled row of shell segments, a tail fan and long feelers (faces +z)
function shrimpGeo() {
  const parts = [];
  for (let i = 0; i < 6; i++) {
    const a = -0.4 + i * 0.32;
    const r = 0.035 - i * 0.003;
    const s = new THREE.SphereGeometry(r, 8, 6); s.scale(1, 0.9, 1.2);
    s.translate(0, 0.06 + Math.sin(a) * 0.05, 0.06 - i * 0.03);
    parts.push(prep(s));
  }
  const fan = new THREE.ConeGeometry(0.03, 0.06, 5); fan.rotateX(Math.PI / 2 + 0.5); fan.scale(1.4, 0.4, 1); fan.translate(0, 0.04, -0.13);
  parts.push(prep(fan));
  for (const sx of [-1, 1]) {
    const ant = new THREE.CylinderGeometry(0.002, 0.003, 0.2, 3); ant.rotateX(Math.PI / 2 - 0.5); ant.rotateY(sx * 0.35); ant.translate(sx * 0.03, 0.12, 0.16);
    parts.push(prep(ant));
    const eye = new THREE.SphereGeometry(0.008, 5, 4); eye.translate(sx * 0.018, 0.085, 0.09); parts.push(paint(prep(eye), (c) => c.setScalar(0.1)));
  }
  for (let i = 0; i < 4; i++) for (const sx of [-1, 1]) {
    const leg = new THREE.CylinderGeometry(0.002, 0.002, 0.05, 3); leg.translate(sx * 0.02, 0.03, 0.05 - i * 0.025); parts.push(prep(leg));
  }
  const g = mergeGeometries(parts.map((p) => (p.attributes.color ? p : paint(p, (c, x, y) => c.setScalar(0.85 + y * 2.5)))));
  return g;
}

// ---------------------------------------------------------------- the reef
export function addSeaLife(level, { center, inner, outer, minDepth = -1.0, maxDepth = -6.5, angle = [0.12, 0.88], seed = 31 }) {
  const scene = level.scene, terrain = level.terrain, world = level.world;
  const rand = makeRandom(seed);
  const spots = [];
  // gather sandy spots on the reef shelf (and pack extra around the reef's heart)
  for (let tries = 0; tries < 6000 && spots.length < 900; tries++) {
    let x, z;
    if (tries % 3 === 0) { const a = rand() * Math.PI * 2, r = Math.sqrt(rand()) * 26; x = center.x + Math.cos(a) * r; z = center.z + Math.sin(a) * r; }
    else { const a = Math.PI * (angle[0] + rand() * (angle[1] - angle[0])), r = inner + rand() * (outer - inner); x = Math.cos(a) * r; z = Math.sin(a) * r; }
    const h = terrain.getHeight(x, z);
    if (h < minDepth && h > maxDepth) spots.push({ x, z, h });
  }
  const take = () => spots[Math.floor(rand() * spots.length)];
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), sc = new THREE.Vector3();
  const group = new THREE.Group();
  scene.add(group);
  const place = (geo, mat, count, colors, { scale = [0.8, 1.4], tilt = 0.15, sink = 0, flat = false } = {}) => {
    const im = new THREE.InstancedMesh(geo, mat, count);
    for (let i = 0; i < count; i++) {
      const s = take(); if (!s) break;
      const k = scale[0] + rand() * (scale[1] - scale[0]);
      e.set((rand() - 0.5) * tilt, rand() * Math.PI * 2, (rand() - 0.5) * tilt);
      q.setFromEuler(e); v.set(s.x, s.h - sink * k, s.z); sc.set(k, flat ? k : k * (0.85 + rand() * 0.3), k);
      m4.compose(v, q, sc); im.setMatrixAt(i, m4);
      im.setColorAt(i, new THREE.Color(colors[Math.floor(rand() * colors.length)]));
    }
    im.castShadow = false; im.receiveShadow = true;
    if (im.instanceColor) im.instanceColor.needsUpdate = true;
    group.add(im);
    return im;
  };
  const NEON = ['#ff4fa8', '#ff8a2a', '#b45cff', '#ffd23a', '#2af0d0', '#ff5a5a', '#5ad1ff'];
  place(staghornGeo(rand), reefMaterial({ key: 'stag', sway: 0.01, glow: 0.15, nightGlow: 0.45 }), 80, ['#ff7fb0', '#ffa45c', '#c08cff', '#ffd76b', '#ff6b7f'], { scale: [0.7, 1.5] });
  place(brainGeo(seed), reefMaterial({ key: 'brain', glow: 0.08, nightGlow: 0.3, roughness: 0.9 }), 50, ['#d6e36a', '#ff9fc4', '#7fe0c9', '#ffb76b', '#b9a3ff'], { scale: [0.6, 1.4], flat: true });
  place(tableGeo(rand), reefMaterial({ key: 'table', glow: 0.1, nightGlow: 0.35 }), 22, ['#9fe6c4', '#ffc38a', '#c8b0ff'], { scale: [0.8, 1.5] });
  const fanMat = reefMaterial({ key: 'fan', sway: 0.05, swayFreq: 1.2, glow: 0.18, nightGlow: 0.5, map: fanTexture(), transparent: true, alphaTest: 0.35, side: THREE.DoubleSide });
  const fanGeo = new THREE.PlaneGeometry(1.0, 1.0, 1, 6); fanGeo.translate(0, 0.5, 0);
  place(paint(fanGeo, (c) => c.setScalar(1)), fanMat, 40, ['#b45cff', '#ff4f7a', '#ff9a3c', '#ff6fd0'], { scale: [0.6, 1.3], tilt: 0.25 });
  place(spongeGeo(rand), reefMaterial({ key: 'sponge', side: THREE.DoubleSide, glow: 0.15, nightGlow: 0.45 }), 34, ['#ffd23a', '#3fa8ff', '#ff8a2a', '#a35cff'], { scale: [0.8, 1.6] });
  place(kelpGeo(rand), reefMaterial({ key: 'kelp', sway: 0.12, swayFreq: 1.0, side: THREE.DoubleSide, glow: 0.05, nightGlow: 0.15 }), 60, ['#4fa84a', '#7cc04a', '#3d8f6a'], { scale: [0.8, 1.6] });
  const anemoneMat = reefMaterial({ key: 'anem', sway: 0.35, swayFreq: 2.2, glow: 0.25, nightGlow: 0.8 });
  const anemones = place(anemoneGeo(rand), anemoneMat, 48, ['#ff6fb5', '#7dff9a', '#c47dff', '#ffb35a', '#5ae6ff'], { scale: [0.9, 1.8], tilt: 0.1 });
  // shells and starfish on the sand
  const shellMat = reefMaterial({ key: 'shell', glow: 0.06, nightGlow: 0.1, roughness: 0.4 });
  place(conchGeo(), shellMat, 26, ['#ffd1b8', '#ffb3c7', '#ffe6c2', '#f3c6ff'], { scale: [0.9, 1.6], tilt: 0.4, flat: true });
  place(scallopGeo(), reefMaterial({ key: 'scallop', side: THREE.DoubleSide, glow: 0.06, nightGlow: 0.1 }), 34, ['#ff9a8a', '#ffc38a', '#ffe08a', '#ffb3d9', '#e8d4ff'], { scale: [0.9, 1.7], tilt: 0.3, flat: true });
  place(cowrieGeo(), shellMat, 26, ['#fff0dc', '#d9a07a', '#ffd6e6'], { scale: [0.9, 1.5], tilt: 0.3, flat: true });
  place(starfishGeo(), shellMat, 34, ['#ff6a3a', '#ff4f8a', '#ffb23a', '#b45cff', '#3fb0ff'], { scale: [0.8, 1.6], tilt: 0.15, flat: true });
  place(sandDollarGeo(), shellMat, 18, ['#f2e6d0'], { scale: [0.9, 1.4], tilt: 0.1, flat: true });

  // ---- schools of neon fish
  const fishMat = reefMaterial({ key: 'fish', glow: 0.35, nightGlow: 0.9, roughness: 0.35 });
  fishMat.onBeforeCompile = ((orig) => (shader) => {
    orig(shader);
    shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      float tail = smoothstep(0.0, -0.2, position.z);
      float fp = 0.0;
      #ifdef USE_INSTANCING
        fp = instanceMatrix[3].x * 4.0 + instanceMatrix[3].z * 3.0;
      #endif
      transformed.x += sin(uTime * 14.0 + fp) * 0.05 * tail;`);
  })(fishMat.onBeforeCompile);
  fishMat.customProgramCacheKey = () => 'reef-fish2';
  const schools = [];
  const nSchools = 7, perSchool = 16;
  const fishIM = new THREE.InstancedMesh(neonFishGeo(), fishMat, nSchools * perSchool);
  fishIM.frustumCulled = false;
  for (let s = 0; s < nSchools; s++) {
    const home = take();
    const col = new THREE.Color(NEON[s % NEON.length]);
    const sch = { home: new THREE.Vector3(home.x, 0, home.z), t: rand() * 10, sp: 0.12 + rand() * 0.1, r: 4 + rand() * 6, fish: [] };
    for (let f = 0; f < perSchool; f++) {
      sch.fish.push({ off: new THREE.Vector3((rand() - 0.5) * 1.6, (rand() - 0.5) * 0.7, (rand() - 0.5) * 1.6), ph: rand() * 6.28, s: 0.8 + rand() * 0.5 });
      fishIM.setColorAt(s * perSchool + f, col.clone().offsetHSL((rand() - 0.5) * 0.04, 0, (rand() - 0.5) * 0.1));
    }
    schools.push(sch);
  }
  fishIM.instanceColor.needsUpdate = true;
  group.add(fishIM);

  // ---- shrimp: little hoppers on the sand and around the anemones
  const shrimpMat = reefMaterial({ key: 'shrimp', glow: 0.3, nightGlow: 0.85, roughness: 0.4 });
  const nShrimp = 44;
  const shrimpIM = new THREE.InstancedMesh(shrimpGeo(), shrimpMat, nShrimp);
  const shrimp = [];
  for (let i = 0; i < nShrimp; i++) {
    const s = take();
    shrimp.push({ x: s.x, z: s.z, yaw: rand() * 6.28, hop: 0, wait: rand() * 3, vx: 0, vz: 0, y: 0, s: 1.4 + rand() * 0.8 });
    shrimpIM.setColorAt(i, new THREE.Color(['#ff5fa2', '#ff8a3a', '#7ff0ff', '#ffe05a', '#c77dff'][i % 5]));
  }
  shrimpIM.instanceColor.needsUpdate = true;
  shrimpIM.frustumCulled = false;
  group.add(shrimpIM);

  const fishPos = [];
  const update = (dt) => {
    // fish: each school drifts around its patch of reef; each fish keeps its spot in the school
    let n = 0;
    for (const sch of schools) {
      sch.t += dt * sch.sp;
      const cx = sch.home.x + Math.cos(sch.t) * sch.r, cz = sch.home.z + Math.sin(sch.t * 1.3) * sch.r * 0.7;
      const dx = -Math.sin(sch.t) * sch.r, dz = Math.cos(sch.t * 1.3) * sch.r * 0.7 * 1.3;
      const yaw = Math.atan2(dx, dz);
      const floor = terrain.getHeight(cx, cz);
      const cy = Math.min(world.waterLevel - 0.6, floor + 1.0 + Math.sin(sch.t * 2) * 0.3);
      for (const f of sch.fish) {
        f.ph += dt;
        v.set(cx + f.off.x + Math.sin(f.ph * 1.7) * 0.15, cy + f.off.y + Math.sin(f.ph * 2.3) * 0.08, cz + f.off.z + Math.cos(f.ph * 1.3) * 0.15);
        v.y = Math.max(v.y, terrain.getHeight(v.x, v.z) + 0.25);
        q.setFromEuler(e.set(0, yaw + Math.sin(f.ph * 2) * 0.15, 0));
        sc.setScalar(f.s * 1.6);
        m4.compose(v, q, sc); fishIM.setMatrixAt(n, m4);
        if (!fishPos[n]) fishPos[n] = new THREE.Vector3();
        fishPos[n].copy(v);
        n++;
      }
    }
    fishIM.instanceMatrix.needsUpdate = true;
    // shrimp: sit, then do a quick little backwards flick to a new spot
    shrimp.forEach((s, i) => {
      if (s.hop > 0) {
        s.hop -= dt;
        s.x += s.vx * dt; s.z += s.vz * dt;
        s.y = Math.sin((1 - s.hop / 0.45) * Math.PI) * 0.25;
      } else {
        s.y = 0; s.wait -= dt;
        if (s.wait < 0) {
          s.wait = 1.5 + rand() * 4; s.hop = 0.45;
          const back = s.yaw + Math.PI + (rand() - 0.5) * 1.2;
          s.vx = Math.sin(back) * 0.8; s.vz = Math.cos(back) * 0.8;
          s.yaw += (rand() - 0.5) * 1.5;
          const h = terrain.getHeight(s.x + s.vx * 0.45, s.z + s.vz * 0.45);
          if (h > minDepth || h < maxDepth) { s.vx *= -1; s.vz *= -1; }
        }
      }
      const h = terrain.getHeight(s.x, s.z);
      v.set(s.x, h + s.y, s.z);
      q.setFromEuler(e.set(0, s.yaw, 0));
      sc.setScalar(s.s);
      m4.compose(v, q, sc); shrimpIM.setMatrixAt(i, m4);
    });
    shrimpIM.instanceMatrix.needsUpdate = true;
  };
  const nearAny = (list, pos, d) => list.some((p) => p && p.distanceTo(pos) < d);
  const shrimpPos = () => shrimp.map((s) => new THREE.Vector3(s.x, terrain.getHeight(s.x, s.z), s.z));
  const reefPts = spots.slice(0, 200).map((s) => new THREE.Vector3(s.x, s.h, s.z));
  const under = (pos) => pos.y < world.waterLevel - 0.3;
  // things for Jacinta's journal (spotted when you swim near them)
  const list = [
    { name: 'Neon Fish', journalKey: 'neonfish', object: fishIM, update, near: (pos, d) => under(pos) && nearAny(fishPos, pos, 6) },
    { name: 'Rainbow Shrimp', journalKey: 'shrimp', object: shrimpIM, update: () => {}, near: (pos) => under(pos) && nearAny(shrimpPos(), pos, 3.5) },
    { name: 'Corals & Anemones', journalKey: 'coral', object: anemones, update: () => {}, near: (pos) => under(pos) && nearAny(reefPts, pos, 4) },
    { name: 'Sea Shells & Starfish', journalKey: 'seashells', object: group, update: () => {}, near: (pos) => under(pos) && nearAny(reefPts, pos, 3) },
  ];
  return { group, list };
}

// ---------------------------------------------------------------- glowing pond at night
// Tiny blue-green lights in the water that shimmer in slow waves, and swirl brighter
// around you when you swim through them.
export function addBioluminescence(scene, { center, radius, waterLevel = 0, terrain, count = 2400 }) {
  const pos = [], seed = [];
  const rand = makeRandom(91);
  for (let i = 0; i < count * 3 && pos.length / 3 < count; i++) {
    const a = rand() * Math.PI * 2, r = Math.sqrt(rand()) * radius;
    const x = center.x + Math.cos(a) * r, z = center.z + Math.sin(a) * r;
    const h = terrain.getHeight(x, z);
    if (h > waterLevel - 0.25) continue;
    const depth = Math.min(1.2, waterLevel - h - 0.1);
    pos.push(x, waterLevel + 0.03 - rand() * rand() * depth * 0.15, z);
    seed.push(rand() * 100);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('aSeed', new THREE.Float32BufferAttribute(seed, 1));
  const uniforms = { uTime: sharedUniforms.uTime, uNight: sharedUniforms.uNight, uPlayer: { value: new THREE.Vector3(9999, 0, 0) }, uScale: { value: window.innerHeight / 2 } };
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms,
    vertexShader: /* glsl */ `
      attribute float aSeed; uniform float uTime; uniform float uNight; uniform vec3 uPlayer; uniform float uScale;
      varying float vGlow; varying vec3 vCol;
      float h2(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
        return mix(mix(h2(i), h2(i+vec2(1,0)), f.x), mix(h2(i+vec2(0,1)), h2(i+vec2(1,1)), f.x), f.y); }
      void main(){
        vec3 p = position;
        p.x += sin(uTime * 0.3 + aSeed) * 0.15; p.z += cos(uTime * 0.25 + aSeed * 1.3) * 0.15;
        // slow shimmering waves of light drifting across the pond
        float wave = vn(p.xz * 0.35 + vec2(uTime * 0.12, -uTime * 0.08));
        float wave2 = vn(p.xz * 0.9 - vec2(uTime * 0.2, uTime * 0.15));
        float tw = 0.5 + 0.5 * sin(uTime * (1.0 + fract(aSeed) * 3.0) + aSeed * 7.0);
        float near = 1.0 - smoothstep(0.5, 3.0, distance(p.xz, uPlayer.xz));
        vGlow = (0.12 + pow(wave, 2.0) * 2.2 + pow(wave2, 3.0) * 1.2) * (0.4 + 0.6 * tw) + near * (1.2 + tw);
        vGlow *= smoothstep(0.35, 0.85, uNight);
        vCol = mix(vec3(0.1, 0.85, 1.0), vec3(0.2, 1.0, 0.6), fract(aSeed * 0.37));
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_PointSize = (0.16 + near * 0.1) * uScale / -mv.z;
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      varying float vGlow; varying vec3 vCol;
      void main(){
        float d = length(gl_PointCoord - 0.5);
        float a = smoothstep(0.5, 0.0, d) * vGlow;
        if (a < 0.01) discard;
        gl_FragColor = vec4(vCol * a, a);
      }`,
  });
  const pts = new THREE.Points(g, mat);
  pts.frustumCulled = false;
  pts.renderOrder = 7;
  scene.add(pts);
  return { points: pts, update: (playerPos) => { if (playerPos) uniforms.uPlayer.value.copy(playerPos); uniforms.uScale.value = window.innerHeight / 2; } };
}
