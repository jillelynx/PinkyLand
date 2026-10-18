// Grass that sways in the wind (and bends around the player),
// flowers, blossom trees, bushes and rocks.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { makeRandom, makeNoise2D } from '../util/noise.js';
import { sharedUniforms } from './terrain.js';

export const playerUniform = { value: new THREE.Vector3(9999, 0, 9999) };

// Inject wind motion into a material. `heightScale` controls how sway grows with height.
export function addWind(material, { strength = 0.18, heightPow = 2.0, push = true, key = 'wind' } = {}) {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = sharedUniforms.uTime;
    shader.uniforms.uWind = sharedUniforms.uWind;
    shader.uniforms.uPlayer = playerUniform;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>
        uniform float uTime; uniform float uWind; uniform vec3 uPlayer;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        {
          vec4 ip = vec4(0.0,0.0,0.0,1.0);
          #ifdef USE_INSTANCING
            ip = instanceMatrix * ip;
          #endif
          ip = modelMatrix * ip;
          float hgt = max(position.y, 0.0);
          float k = pow(hgt, ${heightPow.toFixed(2)});
          float gust = sin(ip.x*0.05 + uTime*0.7) * 0.5 + 0.5;
          float sway = sin(uTime*1.8 + ip.x*0.35 + ip.z*0.27) * (0.6 + gust*0.8);
          transformed.x += sway * ${strength.toFixed(3)} * k * uWind;
          transformed.z += cos(uTime*1.3 + ip.z*0.31) * ${(strength * 0.5).toFixed(3)} * k * uWind;
          ${push ? `
          vec2 toP = ip.xz - uPlayer.xz;
          float dist = length(toP);
          float bend = (1.0 - smoothstep(0.0, 1.4, dist)) * step(abs(ip.y - uPlayer.y), 2.0);
          #ifdef USE_INSTANCING
            vec3 away = normalize(vec3(toP.x, 0.0, toP.y) + 1e-4);
            away = transpose(mat3(instanceMatrix)) * away; // cheap 'undo rotation'
            away = normalize(away + 1e-4);
            transformed += away * bend * 0.6 * k;
            transformed.y -= bend * 0.25 * k;
          #endif` : ''}
        }`);
  };
  material.customProgramCacheKey = () => key + strength + heightPow + push;
  return material;
}

function bladeGeometry() {
  const g = new THREE.BufferGeometry();
  // 4 segments, tapered blade with a slight curve
  const segs = 4, w = 0.07;
  const pos = [], col = [], idx = [];
  const base = new THREE.Color('#3f8f3a'), tip = new THREE.Color('#c8f07a');
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    const width = w * (1 - t * 0.92);
    const bend = t * t * 0.12;
    pos.push(-width, t, bend, width, t, bend);
    const c = base.clone().lerp(tip, t);
    col.push(c.r, c.g, c.b, c.r, c.g, c.b);
    if (i < segs) {
      const a = i * 2;
      idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
  }
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  // make normals point up for soft, even lighting like a meadow
  const n = g.attributes.normal;
  for (let i = 0; i < n.count; i++) n.setXYZ(i, 0, 1, 0.3);
  return g;
}

/**
 * Scatter grass across terrain.
 * @param where (x,z,h) => density 0..1
 */
// A little clump of 3 blades (more grass for the same cost)
function clumpGeometry() {
  const parts = [];
  for (let i = 0; i < 3; i++) {
    const b = bladeGeometry();
    b.rotateY((i / 3) * Math.PI * 2 + i * 0.4);
    b.scale(1, 0.8 + i * 0.15, 1);
    b.translate(Math.cos(i * 2.1) * 0.05, 0, Math.sin(i * 2.1) * 0.05);
    parts.push(b);
  }
  return mergeGeometries(parts);
}

/**
 * Scatter grass across terrain. Grass is split into square tiles so tiles that
 * are off-screen aren't drawn, which lets us have lots more grass.
 * @param where (x,z,h) => density 0..1
 */
export function createGrass(terrain, { count = 60000, area = 200, center = [0, 0], where, seed = 11, tint, height = [0.3, 0.75], width = [0.45, 0.75], tile = 22 } = {}) {
  const rand = makeRandom(seed);
  const geo = clumpGeometry();
  const mat = addWind(new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: 0.85 }),
    { strength: 0.22, heightPow: 1.6, push: true, key: 'grass' });
  const buckets = new Map();
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3();
  const e = new THREE.Euler();
  let n = 0, tries = 0;
  while (n < count && tries < count * 4) {
    tries++;
    const x = center[0] + (rand() - 0.5) * area;
    const z = center[1] + (rand() - 0.5) * area;
    const h = terrain.getHeight(x, z);
    const d = where(x, z, h);
    if (d <= 0 || rand() > d) continue;
    p.set(x, h - 0.02, z);
    e.set((rand() - 0.5) * 0.3, rand() * Math.PI * 2, (rand() - 0.5) * 0.3);
    q.setFromEuler(e);
    const hs = height[0] + rand() * (height[1] - height[0]);
    s.set(width[0] + rand() * (width[1] - width[0]), hs, 1);
    m.compose(p, q, s);
    const c = new THREE.Color().setHSL(0.24 + rand() * 0.08, 0.55 + rand() * 0.2, 0.55 + rand() * 0.15);
    if (tint) tint(x, z, c, rand);
    const key = Math.floor(x / tile) + ',' + Math.floor(z / tile);
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push([m.clone(), c]);
    n++;
  }
  const group = new THREE.Group();
  for (const list of buckets.values()) {
    const mesh = new THREE.InstancedMesh(geo, mat, list.length);
    list.forEach(([mm, cc], i) => { mesh.setMatrixAt(i, mm); mesh.setColorAt(i, cc); });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingSphere();
    mesh.boundingSphere.radius += 1.5; // room for swaying
    mesh.receiveShadow = true;
    group.add(mesh);
  }
  return group;
}

function flowerHeadGeometry(petals = 5) {
  const shape = new THREE.Shape();
  const R = 0.11;
  for (let i = 0; i <= 64; i++) {
    const a = (i / 64) * Math.PI * 2;
    const r = R * (0.55 + 0.45 * Math.abs(Math.cos(a * petals / 2)));
    const x = Math.cos(a) * r, y = Math.sin(a) * r;
    if (i === 0) shape.moveTo(x, y); else shape.lineTo(x, y);
  }
  const g = new THREE.ShapeGeometry(shape, 1);
  g.rotateX(-Math.PI / 2);
  // cup the petals slightly
  const p = g.attributes.position;
  const col = [];
  for (let i = 0; i < p.count; i++) {
    const r = Math.hypot(p.getX(i), p.getZ(i));
    p.setY(i, r * r * 4);
    const center = r < 0.03;
    col.push(center ? 1.0 : 1, center ? 0.85 : 1, center ? 0.3 : 1);
  }
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.computeVertexNormals();
  return g;
}

export function createFlowers(terrain, { count = 3000, area = 200, center = [0, 0], where, seed = 21, palette } = {}) {
  const rand = makeRandom(seed);
  const colors = (palette || ['#ff9ecb', '#ffd1e8', '#ffffff', '#ffe27a', '#c9a8ff', '#ff7fa8', '#9fd8ff']).map((h) => new THREE.Color(h));
  const stemGeo = new THREE.CylinderGeometry(0.008, 0.012, 1, 4, 1);
  stemGeo.translate(0, 0.5, 0);
  const headGeo = flowerHeadGeometry(5);
  const stemMat = addWind(new THREE.MeshStandardMaterial({ color: '#4c9a43', roughness: 0.9 }), { strength: 0.08, heightPow: 1.5, key: 'stem' });
  const headMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, side: THREE.DoubleSide, emissive: '#000000' });
  const stems = new THREE.InstancedMesh(stemGeo, stemMat, count);
  const heads = new THREE.InstancedMesh(headGeo, headMat, count);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3();
  let n = 0, tries = 0;
  const noise = makeNoise2D(seed);
  while (n < count && tries < count * 6) {
    tries++;
    const x = center[0] + (rand() - 0.5) * area, z = center[1] + (rand() - 0.5) * area;
    const h = terrain.getHeight(x, z);
    const d = where(x, z, h);
    if (d <= 0 || rand() > d) continue;
    const hh = 0.25 + rand() * 0.35;
    q.setFromEuler(new THREE.Euler(0, rand() * 6.28, 0));
    p.set(x, h, z);
    s.set(1, hh, 1);
    m.compose(p, q, s);
    stems.setMatrixAt(n, m);
    p.set(x, h + hh, z);
    const hsz = 0.8 + rand() * 0.7;
    s.set(hsz, hsz, hsz);
    q.setFromEuler(new THREE.Euler((rand() - 0.5) * 0.5, rand() * 6.28, (rand() - 0.5) * 0.5));
    m.compose(p, q, s);
    heads.setMatrixAt(n, m);
    // flowers grow in color patches
    const patch = Math.floor((noise(x * 0.05, z * 0.05) * 0.5 + 0.5) * colors.length * 1.3 + rand() * 1.2) % colors.length;
    heads.setColorAt(n, colors[patch]);
    n++;
  }
  stems.count = heads.count = n;
  [stems, heads].forEach((im) => { im.instanceMatrix.needsUpdate = true; im.frustumCulled = false; });
  if (heads.instanceColor) heads.instanceColor.needsUpdate = true;
  const group = new THREE.Group();
  group.add(stems, heads);
  return group;
}

// ---------- Trees ----------
function blobGeometry(rand, radius, detail = 2) {
  const g = new THREE.IcosahedronGeometry(radius, detail);
  const p = g.attributes.position;
  const v = new THREE.Vector3();
  const noise = makeNoise2D(Math.floor(rand() * 1000));
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const k = 1 + noise(v.x * 1.7 + v.y, v.z * 1.7 - v.y) * 0.12;
    v.multiplyScalar(k);
    p.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  return g;
}

function treeGeometries(rand, kind) {
  const trunkParts = [];
  const leafParts = [];
  const height = kind === 'tall' ? 5.5 : kind === 'willow' ? 4 : 3.6;
  const trunk = new THREE.CylinderGeometry(0.16, 0.32, height, 7, 4);
  trunk.translate(0, height / 2, 0);
  // gentle bend
  const tp = trunk.attributes.position;
  for (let i = 0; i < tp.count; i++) {
    const y = tp.getY(i);
    tp.setX(i, tp.getX(i) + Math.sin(y * 0.6) * 0.15);
  }
  trunkParts.push(trunk);
  // a couple of branches
  for (let b = 0; b < 3; b++) {
    const br = new THREE.CylinderGeometry(0.05, 0.1, 1.4, 5);
    br.translate(0, 0.7, 0);
    br.rotateZ((b % 2 ? 1 : -1) * (0.7 + rand() * 0.3));
    br.rotateY(rand() * 6.28);
    br.translate(0, height * (0.55 + b * 0.12), 0);
    trunkParts.push(br);
  }
  const blobs = kind === 'tall' ? 6 : 7;
  for (let i = 0; i < blobs; i++) {
    const r = (kind === 'tall' ? 1.1 : 1.3) + rand() * 0.6;
    const g = blobGeometry(rand, r, 2);
    const a = rand() * Math.PI * 2;
    const d = i === 0 ? 0 : 0.9 + rand() * 0.7;
    const y = height + (i === 0 ? 0.6 : (rand() - 0.3) * 1.4);
    g.translate(Math.cos(a) * d, y, Math.sin(a) * d);
    leafParts.push(g);
  }
  const trunkGeo = mergeGeometries(trunkParts.map((g) => (g.index ? g.toNonIndexed() : g)));
  const leafGeo = mergeGeometries(leafParts.map((g) => (g.index ? g.toNonIndexed() : g)));
  // vertex color: lighter on top for a sun-kissed look
  const lp = leafGeo.attributes.position;
  const col = new Float32Array(lp.count * 3);
  let minY = Infinity, maxY = -Infinity;
  for (let i = 0; i < lp.count; i++) { minY = Math.min(minY, lp.getY(i)); maxY = Math.max(maxY, lp.getY(i)); }
  for (let i = 0; i < lp.count; i++) {
    const t = (lp.getY(i) - minY) / (maxY - minY);
    const k = 0.72 + t * 0.4;
    col[i * 3] = k; col[i * 3 + 1] = k; col[i * 3 + 2] = k;
  }
  leafGeo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  trunkGeo.computeVertexNormals();
  leafGeo.computeVertexNormals();
  return { trunkGeo, leafGeo, height };
}

/**
 * spots: [{x,z,kind,scale,color}]
 */
export function createTrees(terrain, spots, { seed = 5 } = {}) {
  const rand = makeRandom(seed);
  const group = new THREE.Group();
  const kinds = ['round', 'tall', 'round2'];
  const geos = {};
  for (const k of kinds) geos[k] = treeGeometries(rand, k === 'round2' ? 'round' : k);
  const trunkMat = new THREE.MeshStandardMaterial({ color: '#8a5a3c', roughness: 1 });
  const leafMat = addWind(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8 }),
    { strength: 0.04, heightPow: 1.0, push: false, key: 'leaves' });
  const colliders = [];
  // group spots by kind for instancing
  for (const k of kinds) {
    const list = spots.filter((s) => (s.kind || 'round') === k);
    if (!list.length) continue;
    const trunks = new THREE.InstancedMesh(geos[k].trunkGeo, trunkMat, list.length);
    const leaves = new THREE.InstancedMesh(geos[k].leafGeo, leafMat, list.length);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3();
    list.forEach((sp, i) => {
      const h = terrain.getHeight(sp.x, sp.z);
      const sc = sp.scale ?? (0.85 + rand() * 0.5);
      p.set(sp.x, h - 0.1, sp.z);
      q.setFromEuler(new THREE.Euler(0, rand() * 6.28, 0));
      s.setScalar(sc);
      m.compose(p, q, s);
      trunks.setMatrixAt(i, m);
      leaves.setMatrixAt(i, m);
      leaves.setColorAt(i, new THREE.Color(sp.color || '#7cc96b'));
      colliders.push({ type: 'cyl', x: sp.x, z: sp.z, r: 0.45 * sc, top: h + geos[k].height * sc * 0.8, bottom: h - 1 });
    });
    trunks.castShadow = leaves.castShadow = true;
    trunks.receiveShadow = leaves.receiveShadow = true;
    if (leaves.instanceColor) leaves.instanceColor.needsUpdate = true;
    group.add(trunks, leaves);
  }
  return { group, colliders };
}

export function createRocks(terrain, spots, { seed = 9, color = '#a9a3b8' } = {}) {
  const rand = makeRandom(seed);
  const group = new THREE.Group();
  const colliders = [];
  const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.9, flatShading: true });
  const geos = [0, 1, 2].map(() => {
    const g = new THREE.IcosahedronGeometry(1, 1);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      p.setXYZ(i, p.getX(i) * (0.8 + rand() * 0.4), p.getY(i) * (0.6 + rand() * 0.3), p.getZ(i) * (0.8 + rand() * 0.4));
    }
    g.computeVertexNormals();
    return g;
  });
  for (const s of spots) {
    const m = new THREE.Mesh(geos[Math.floor(rand() * 3)], mat);
    const sc = s.scale ?? 0.6 + rand() * 1.2;
    const h = terrain.getHeight(s.x, s.z);
    m.scale.set(sc, sc * (s.flat ? 0.5 : 0.8), sc);
    m.position.set(s.x, h + sc * 0.15, s.z);
    m.rotation.y = rand() * 6.28;
    m.castShadow = true; m.receiveShadow = true;
    group.add(m);
    colliders.push({ type: 'cyl', x: s.x, z: s.z, r: sc * 0.85, top: h + sc * (s.flat ? 0.5 : 0.8) * 0.75, bottom: h - 2 });
  }
  return { group, colliders };
}

export function createBushes(terrain, spots, { seed = 13 } = {}) {
  const rand = makeRandom(seed);
  const parts = [];
  for (let i = 0; i < 5; i++) {
    let g = blobGeometry(rand, 0.55 + rand() * 0.25, 2); if (g.index) g = g.toNonIndexed();
    const a = rand() * 6.28;
    g.translate(Math.cos(a) * 0.45, 0.45 + rand() * 0.2, Math.sin(a) * 0.45);
    parts.push(g);
  }
  const geo = mergeGeometries(parts);
  geo.computeVertexNormals();
  const mat = addWind(new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.85 }), { strength: 0.03, heightPow: 1, push: false, key: 'bush' });
  const im = new THREE.InstancedMesh(geo, mat, spots.length);
  const m = new THREE.Matrix4();
  spots.forEach((s, i) => {
    const h = terrain.getHeight(s.x, s.z);
    const sc = s.scale ?? 0.8 + rand() * 0.6;
    m.compose(new THREE.Vector3(s.x, h - 0.1, s.z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, rand() * 6, 0)), new THREE.Vector3(sc, sc, sc));
    im.setMatrixAt(i, m);
    im.setColorAt(i, new THREE.Color(s.color || '#5fae55'));
  });
  im.castShadow = im.receiveShadow = true;
  if (im.instanceColor) im.instanceColor.needsUpdate = true;
  return im;
}
