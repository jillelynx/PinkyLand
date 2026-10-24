// Things for Snowdrop Island: igloos you can walk into, snowmen, sleds, the little
// ferry boat, snowy pine trees, glowing crystals, falling snow (on the cold side),
// rising sparkles (on the warm side), hot-spring steam, penguins and snow bunnies.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { makeRandom, angleDamp, damp } from '../util/noise.js';
import { sharedUniforms } from './terrain.js';

const std = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.8, ...o });
const shadow = (m) => { m.castShadow = true; m.receiveShadow = true; return m; };
const ball = (r, m, sx = 1, sy = 1, sz = 1) => { const b = shadow(new THREE.Mesh(new THREE.SphereGeometry(r, 18, 14), m)); b.scale.set(sx, sy, sz); return b; };

// a material that glows a little in its own colour (brighter at night)
export function glowMaterial(base = 0.35, night = 0.6, o = {}) {
  const m = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.25, ...o });
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uNight = sharedUniforms.uNight;
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform float uNight;')
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>\n totalEmissiveRadiance += diffuseColor.rgb * (${base.toFixed(2)} + ${night.toFixed(2)} * uNight);`);
  };
  m.customProgramCacheKey = () => `glow-${base}-${night}-${!!o.transparent}`;
  return m;
}

// ---------------------------------------------------------------- igloo
let blockTex = null;
function iceBlockTexture() {
  if (blockTex) return blockTex;
  const c = document.createElement('canvas'); c.width = 512; c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#f4f9ff'; g.fillRect(0, 0, 512, 256);
  const rows = 8, rh = 256 / rows;
  for (let r = 0; r < rows; r++) {
    const off = (r % 2) * 32;
    for (let x = -64; x < 512; x += 64) {
      const tint = 236 + Math.floor(Math.random() * 16);
      g.fillStyle = `rgb(${tint - 6},${tint},255)`;
      g.fillRect(x + off + 2, r * rh + 2, 60, rh - 4);
    }
  }
  g.strokeStyle = 'rgba(150,185,225,0.55)'; g.lineWidth = 3;
  for (let r = 0; r <= rows; r++) { g.beginPath(); g.moveTo(0, r * rh); g.lineTo(512, r * rh); g.stroke(); }
  for (let r = 0; r < rows; r++) for (let x = (r % 2) * 32; x < 512; x += 64) { g.beginPath(); g.moveTo(x, r * rh); g.lineTo(x, (r + 1) * rh); g.stroke(); }
  blockTex = new THREE.CanvasTexture(c); blockTex.colorSpace = THREE.SRGBColorSpace;
  blockTex.wrapS = blockTex.wrapT = THREE.RepeatWrapping;
  return blockTex;
}

/**
 * An igloo made of ice blocks, door facing local +z. Big enough to walk inside.
 * r: inside radius; ar: doorway / tunnel arch radius
 */
export function makeIgloo(r = 3.6, { ar = 1.3, lamp = true, cozy = true } = {}) {
  const group = new THREE.Group();
  const tex = iceBlockTexture().clone(); tex.needsUpdate = true; tex.repeat.set(Math.round(r * 2.2), Math.round(r * 0.9));
  const mat = std('#ffffff', { map: tex, side: THREE.DoubleSide, roughness: 0.55 });
  const thDoor = Math.acos(Math.min(0.95, ar / r));
  const gap = 2 * Math.asin(Math.min(0.95, (ar * 1.02) / r));
  const top = shadow(new THREE.Mesh(new THREE.SphereGeometry(r, 44, 14, 0, Math.PI * 2, 0, thDoor), mat));
  const ring = shadow(new THREE.Mesh(new THREE.SphereGeometry(r, 44, 6, Math.PI / 2 + gap / 2, Math.PI * 2 - gap, thDoor, Math.PI / 2 - thDoor), mat));
  group.add(top, ring);
  // a thick rim around the bottom so the walls look solid
  const rim = shadow(new THREE.Mesh(new THREE.TorusGeometry(r + 0.05, 0.16, 6, 44, Math.PI * 2 - gap), std('#e6f1ff')));
  rim.rotation.x = Math.PI / 2; rim.rotation.z = Math.PI / 2 + gap / 2; rim.position.y = 0.05; group.add(rim);
  // the entrance tunnel
  const doorZ = Math.sqrt(Math.max(0.1, r * r - ar * ar)), len = 1.5;
  const tun = new THREE.CylinderGeometry(ar + 0.12, ar + 0.12, len, 20, 1, true, Math.PI / 2, Math.PI);
  tun.rotateX(Math.PI / 2);
  const ttex = tex.clone(); ttex.needsUpdate = true; ttex.repeat.set(3, 1);
  const tunnel = shadow(new THREE.Mesh(tun, std('#ffffff', { map: ttex, side: THREE.DoubleSide, roughness: 0.55 })));
  tunnel.position.set(0, 0, doorZ + len / 2 - 0.25); group.add(tunnel);
  const arch = shadow(new THREE.Mesh(new THREE.TorusGeometry(ar + 0.14, 0.12, 6, 20, Math.PI), std('#e6f1ff')));
  arch.position.set(0, 0, doorZ + len - 0.25); group.add(arch);
  // floor of packed snow, and a cosy rug
  const floor = new THREE.Mesh(new THREE.CircleGeometry(r - 0.05, 40).rotateX(-Math.PI / 2), std('#dfe9f6', { roughness: 1 }));
  floor.position.y = 0.03; floor.receiveShadow = true; group.add(floor);
  if (cozy) {
    const rug = new THREE.Mesh(new THREE.CircleGeometry(r * 0.45, 28).rotateX(-Math.PI / 2), std('#ff9fc8', { roughness: 1 }));
    rug.position.set(0, 0.05, -r * 0.15); group.add(rug);
    const rug2 = new THREE.Mesh(new THREE.RingGeometry(r * 0.32, r * 0.38, 28).rotateX(-Math.PI / 2), std('#fff1c2', { roughness: 1 }));
    rug2.position.set(0, 0.06, -r * 0.15); group.add(rug2);
    // two puffy cushions and a folded blanket
    for (const [x, c] of [[-0.9, '#ffd1e3'], [0.9, '#cfe3ff']]) { const p = ball(0.38, std(c, { roughness: 1 }), 1, 0.45, 1); p.position.set(x * r * 0.4, 0.2, -r * 0.55); group.add(p); }
    const bl = shadow(new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.18, 0.6), std('#c9a2ff', { roughness: 1 })));
    bl.position.set(r * 0.5, 0.12, r * 0.05); bl.rotation.y = 0.5; group.add(bl);
  }
  // a little lantern (the big igloo gets a real warm light)
  const lan = new THREE.Group();
  lan.add(shadow(new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, 0.32, 8), std('#ffe9b0', { emissive: '#ffb84a', emissiveIntensity: 1.2 }))));
  const cap = new THREE.Mesh(new THREE.ConeGeometry(0.15, 0.12, 8), std('#7a4a2a')); cap.position.y = 0.22; lan.add(cap);
  lan.position.set(-r * 0.45, 0.17, -r * 0.1); group.add(lan);
  if (lamp) { const L = new THREE.PointLight('#ffc27a', 22, r * 2.6, 1.4); L.position.set(-r * 0.4, 1.0, -r * 0.1); group.add(L); }
  // solid walls: a ring of little posts (with a gap for the door) + tunnel walls
  const colliders = (x, z, yaw, groundY) => {
    const out = [], c = Math.cos(yaw), s = Math.sin(yaw);
    const W = (lx, lz) => [x + lx * c + lz * s, z - lx * s + lz * c];
    const n = Math.ceil((Math.PI * 2 * r) / 0.5);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2; // angle from +z
      let d = Math.abs(((a + Math.PI) % (Math.PI * 2)) - Math.PI);
      if (d < gap / 2 + 0.02) continue;
      const [wx, wz] = W(Math.sin(a) * (r + 0.1), Math.cos(a) * (r + 0.1));
      out.push({ type: 'cyl', x: wx, z: wz, r: 0.3, top: groundY + r * 0.85, bottom: groundY - 1, noStand: true });
    }
    for (let k = 0; k <= 4; k++) for (const sx of [-1, 1]) {
      const [wx, wz] = W(sx * (ar + 0.32), doorZ - 0.1 + (k / 4) * (len - 0.1));
      out.push({ type: 'cyl', x: wx, z: wz, r: 0.25, top: groundY + ar, bottom: groundY - 1, noStand: true });
    }
    return out;
  };
  return { group, colliders, r, doorZ: doorZ + len - 0.25 };
}

// ---------------------------------------------------------------- snowman
export function makeSnowman({ warm = false, seed = 1 } = {}) {
  const rand = makeRandom(seed);
  const g = new THREE.Group();
  const snow = warm ? std('#fff4fa', { roughness: 0.9, emissive: '#ffd6ec', emissiveIntensity: 0.15 }) : std('#f6faff', { roughness: 0.95 });
  const sizes = [0.58, 0.43, 0.31];
  let y = 0;
  const balls = [];
  sizes.forEach((r, i) => { y += r * (i === 0 ? 0.9 : 1.55); const b = ball(r, snow); b.position.y = y; g.add(b); balls.push(b); y += r * 0.1; });
  const head = balls[2], mid = balls[1];
  const coal = std('#222228', { roughness: 0.5 });
  for (const sx of [-1, 1]) { const e = ball(0.045, coal); e.position.set(sx * 0.11, head.position.y + 0.08, 0.27); g.add(e); }
  for (let i = 0; i < 5; i++) { const a = -0.9 + i * 0.45; const m = ball(0.03, coal); m.position.set(Math.sin(a) * 0.17, head.position.y - 0.1 - Math.cos(a) * 0.05 + 0.05, 0.27 + Math.cos(a) * 0.02 - 0.03); g.add(m); }
  for (let i = 0; i < 3; i++) { const b = ball(0.045, coal); b.position.set(0, mid.position.y + 0.2 - i * 0.2, 0.41 - Math.abs(i - 1) * 0.04); g.add(b); }
  const nose = shadow(new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.3, 10), std('#ff8a2a'))); nose.rotation.x = Math.PI / 2; nose.position.set(0, head.position.y, 0.42); g.add(nose);
  // stick arms
  const stick = std('#6b4423');
  for (const sx of [-1, 1]) {
    const arm = shadow(new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.03, 0.75, 6), stick));
    arm.position.set(sx * 0.6, mid.position.y + 0.12, 0); arm.rotation.z = sx * (1.0 + rand() * 0.4); g.add(arm);
    const tw = shadow(new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.015, 0.2, 5), stick));
    tw.position.set(sx * 0.82, mid.position.y + 0.3, 0); tw.rotation.z = sx * 0.3; g.add(tw);
  }
  // scarf
  const scarfCol = warm ? ['#ff7fb8', '#c58bff', '#ffb35c'][Math.floor(rand() * 3)] : ['#e8384f', '#3a7bd5', '#2fa86a'][Math.floor(rand() * 3)];
  const scarf = shadow(new THREE.Mesh(new THREE.TorusGeometry(0.27, 0.07, 8, 20), std(scarfCol, { roughness: 1 })));
  scarf.rotation.x = Math.PI / 2; scarf.position.y = head.position.y - 0.25; g.add(scarf);
  const tail = shadow(new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.4, 0.05), std(scarfCol, { roughness: 1 }))); tail.position.set(0.16, head.position.y - 0.45, 0.24); tail.rotation.z = 0.2; g.add(tail);
  if (warm) {
    // a crown of little glowing flowers
    for (let i = 0; i < 7; i++) { const a = (i / 7) * Math.PI * 2; const f = ball(0.055, glowMaterial(0.3, 0.6)); f.material.color.set(['#ff9fd0', '#ffe27a', '#b9a3ff', '#7ff2e6'][i % 4]); f.position.set(Math.sin(a) * 0.22, head.position.y + 0.24, Math.cos(a) * 0.22); g.add(f); }
  } else {
    // a little black top hat
    const hat = std('#26232b', { roughness: 0.6 });
    const brim = shadow(new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.03, 20), hat)); brim.position.y = head.position.y + 0.25; g.add(brim);
    const crown = shadow(new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.2, 0.32, 20), hat)); crown.position.y = head.position.y + 0.42; g.add(crown);
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.205, 0.205, 0.06, 20), std(scarfCol)); band.position.y = head.position.y + 0.3; g.add(band);
  }
  return g;
}

// ---------------------------------------------------------------- sled
export function makeSled(color = '#e8384f') {
  const g = new THREE.Group();
  const deck = shadow(new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.07, 1.15), std(color, { roughness: 0.6 })));
  deck.position.y = 0.2; g.add(deck);
  for (let i = 0; i < 4; i++) { const sl = new THREE.Mesh(new THREE.BoxGeometry(0.64, 0.072, 0.05), std('#fff1d6')); sl.position.set(0, 0.2, -0.4 + i * 0.27); g.add(sl); }
  const runnerMat = std('#b8c2cc', { metalness: 0.6, roughness: 0.3 });
  for (const sx of [-1, 1]) {
    const pts = [];
    for (let k = 0; k <= 12; k++) { const t = k / 12; const z = -0.6 + t * 1.3; const y = 0.04 + (t > 0.82 ? Math.pow((t - 0.82) / 0.18, 2) * 0.32 : 0); pts.push(new THREE.Vector3(sx * 0.27, y, z)); }
    g.add(shadow(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, 0.025, 6), runnerMat)));
    for (const z of [-0.4, 0.3]) { const post = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.16, 6), runnerMat); post.position.set(sx * 0.27, 0.12, z); g.add(post); }
  }
  // a pull rope
  const rope = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.015, 5, 16, Math.PI), std('#d9b27a'));
  rope.position.set(0, 0.32, 0.62); rope.rotation.x = -0.6; g.add(rope);
  return g;
}

// ---------------------------------------------------------------- the little ferry boat
export function makeFerry() {
  const g = new THREE.Group();
  const hull = shadow(new THREE.Mesh(new THREE.SphereGeometry(1, 24, 12, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), std('#ffffff', { roughness: 0.6, side: THREE.DoubleSide })));
  hull.scale.set(1.3, 0.75, 2.6); g.add(hull);
  const stripe = new THREE.Mesh(new THREE.TorusGeometry(1, 0.06, 6, 32), std('#ff7fb0'));
  stripe.rotation.x = Math.PI / 2; stripe.scale.set(1.3, 2.6, 1); stripe.position.y = -0.02; g.add(stripe);
  const deck = new THREE.Mesh(new THREE.CircleGeometry(1, 24).rotateX(-Math.PI / 2), std('#d9a066'));
  deck.scale.set(1.2, 1, 2.45); deck.position.y = -0.12; g.add(deck);
  for (const z of [-0.9, 0.7]) { const b = shadow(new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.12, 0.4), std('#b8794a'))); b.position.set(0, 0.15, z); g.add(b); }
  const mast = shadow(new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 3.6, 8), std('#8a5a3c'))); mast.position.set(0, 1.7, 0.2); g.add(mast);
  // the sail, with a big snowflake on it
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const x = c.getContext('2d');
  x.fillStyle = '#fff4fa'; x.fillRect(0, 0, 256, 256);
  x.strokeStyle = '#7fc4f0'; x.lineWidth = 10; x.lineCap = 'round';
  for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; x.beginPath(); x.moveTo(128, 150); x.lineTo(128 + Math.cos(a) * 70, 150 + Math.sin(a) * 70); x.stroke();
    for (const s of [-1, 1]) { x.beginPath(); x.moveTo(128 + Math.cos(a) * 42, 150 + Math.sin(a) * 42); x.lineTo(128 + Math.cos(a + s * 0.5) * 62, 150 + Math.sin(a + s * 0.5) * 62); x.stroke(); } }
  const st = new THREE.CanvasTexture(c); st.colorSpace = THREE.SRGBColorSpace;
  const sailShape = new THREE.Shape(); sailShape.moveTo(0, 0); sailShape.lineTo(0, 3.0); sailShape.quadraticCurveTo(1.0, 1.2, 1.7, 0.1); sailShape.lineTo(0, 0);
  const sg = new THREE.ShapeGeometry(sailShape, 12);
  const uv = sg.attributes.uv, p = sg.attributes.position; for (let i = 0; i < p.count; i++) uv.setXY(i, p.getX(i) / 1.7, p.getY(i) / 3.0);
  const sail = shadow(new THREE.Mesh(sg, std('#ffffff', { map: st, side: THREE.DoubleSide })));
  sail.rotation.y = -Math.PI / 2; sail.position.set(0.02, 0.35, 0.25); g.add(sail);
  const flag = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.3), std('#ff7fb0', { side: THREE.DoubleSide })); flag.position.set(0, 3.45, 0.47); flag.rotation.y = Math.PI / 2; g.add(flag);
  g.userData.flag = flag;
  return g;
}

// ---------------------------------------------------------------- snowy pine trees
export function createSnowPines(terrain, spots, { seed = 3 } = {}) {
  const rand = makeRandom(seed);
  const parts = [];
  const col = (geo, c) => { geo = geo.index ? geo.toNonIndexed() : geo; const cc = new THREE.Color(c), a = []; for (let i = 0; i < geo.attributes.position.count; i++) a.push(cc.r, cc.g, cc.b); geo.setAttribute('color', new THREE.Float32BufferAttribute(a, 3)); geo.deleteAttribute('uv'); return geo; };
  const trunk = new THREE.CylinderGeometry(0.16, 0.24, 1.4, 7); trunk.translate(0, 0.7, 0); parts.push(col(trunk, '#6b4a34'));
  [[1.6, 1.9, 1.0], [1.25, 1.6, 2.1], [0.85, 1.35, 3.1], [0.45, 1.0, 3.95]].forEach(([r, h, y]) => {
    const tier = new THREE.ConeGeometry(r, h, 9); tier.translate(0, y + h / 2, 0); parts.push(col(tier, '#2f6b52'));
    const cap = new THREE.ConeGeometry(r * 0.82, h * 0.55, 9); cap.translate(0, y + h * 0.72, 0); parts.push(col(cap, '#f4f9ff'));
  });
  const geo = mergeGeometries(parts); geo.computeVertexNormals();
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, flatShading: true });
  const im = new THREE.InstancedMesh(geo, mat, spots.length);
  im.castShadow = im.receiveShadow = true;
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), colliders = [];
  spots.forEach((s, i) => {
    const sc = s.scale ?? (0.75 + rand() * 0.6), h = terrain.getHeight(s.x, s.z);
    q.setFromEuler(new THREE.Euler(0, rand() * 6.28, 0));
    m.compose(new THREE.Vector3(s.x, h - 0.1, s.z), q, new THREE.Vector3(sc, sc * (0.9 + rand() * 0.25), sc));
    im.setMatrixAt(i, m);
    colliders.push({ type: 'cyl', x: s.x, z: s.z, r: 0.42 * sc, top: h + 4.5 * sc, bottom: h - 1 });
  });
  return { mesh: im, colliders };
}

// glowing crystal clusters for the magical warm side
export function createCrystals(terrain, spots, { seed = 5 } = {}) {
  const rand = makeRandom(seed);
  const geo = new THREE.OctahedronGeometry(0.3, 0); geo.scale(0.55, 1.8, 0.55); geo.translate(0, 0.45, 0);
  const n = spots.length * 5;
  const im = new THREE.InstancedMesh(geo, glowMaterial(0.35, 0.9, { transparent: true, opacity: 0.88, flatShading: true }), n);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
  const cols = ['#ff9fd0', '#c9a8ff', '#7ff2e6', '#ffe27a', '#ffb3e0'];
  let k = 0;
  for (const s of spots) {
    const col = new THREE.Color(cols[Math.floor(rand() * cols.length)]);
    for (let j = 0; j < 5; j++) {
      const a = rand() * 6.28, d = j ? 0.25 + rand() * 0.35 : 0;
      const x = s.x + Math.cos(a) * d, z = s.z + Math.sin(a) * d;
      e.set((rand() - 0.5) * 0.7, rand() * 6, (rand() - 0.5) * 0.7); q.setFromEuler(e);
      const sc = (j ? 0.45 + rand() * 0.5 : 1.1) * (s.scale || 1);
      m.compose(new THREE.Vector3(x, terrain.getHeight(x, z) - 0.05, z), q, new THREE.Vector3(sc, sc, sc));
      im.setMatrixAt(k, m); im.setColorAt(k, col.clone().offsetHSL((rand() - 0.5) * 0.05, 0, 0)); k++;
    }
  }
  im.instanceColor.needsUpdate = true;
  return im;
}

// ---------------------------------------------------------------- falling snow + warm sparkles
// Both live in a box that follows the camera; the shader hides the snow on the warm
// side (x > 0) and the sparkles on the cold side (x < 0).
export class SnowWeather {
  constructor(scene, { count = 3200, sparkles = 900, warmFrom = -6, warmTo = 14 } = {}) {
    this.uniforms = { uTime: sharedUniforms.uTime, uCenter: { value: new THREE.Vector3() }, uScale: { value: window.innerHeight / 2 }, uNight: sharedUniforms.uNight };
    const make = (n, warm) => {
      const a = new Float32Array(n * 3), s = new Float32Array(n);
      for (let i = 0; i < n; i++) { a[i * 3] = Math.random(); a[i * 3 + 1] = Math.random(); a[i * 3 + 2] = Math.random(); s[i] = Math.random(); }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(a, 3)); g.setAttribute('aSeed', new THREE.BufferAttribute(s, 1));
      const mat = new THREE.ShaderMaterial({
        transparent: true, depthWrite: false, blending: warm ? THREE.AdditiveBlending : THREE.NormalBlending, uniforms: this.uniforms,
        vertexShader: /* glsl */ `
          attribute float aSeed; uniform float uTime; uniform vec3 uCenter; uniform float uScale;
          varying float vA; varying vec3 vC;
          void main(){
            vec3 box = vec3(70.0, 34.0, 70.0);
            vec3 p = position;
            ${warm
              ? 'p.y = fract(p.y + uTime * (0.012 + aSeed * 0.01)); p.x = fract(p.x + sin(uTime * 0.5 + aSeed * 30.0) * 0.004);'
              : 'p.y = fract(p.y - uTime * (0.03 + aSeed * 0.02)); p.x = fract(p.x + uTime * 0.006 + sin(uTime + aSeed * 20.0) * 0.003); p.z = fract(p.z + cos(uTime * 0.7 + aSeed * 11.0) * 0.003);'}
            // place the box around the camera, wrapping so it never runs out
            vec3 w = uCenter + (fract(p - uCenter / box) - 0.5) * box;
            w.y = uCenter.y - 8.0 + p.y * box.y;
            float warm = smoothstep(${warmFrom.toFixed(1)}, ${warmTo.toFixed(1)}, w.x);
            vA = ${warm ? 'warm * (0.5 + 0.5 * sin(uTime * 3.0 + aSeed * 40.0))' : '(1.0 - warm) * 0.9'};
            vC = ${warm ? 'mix(vec3(1.0, 0.75, 0.9), vec3(1.0, 0.92, 0.6), fract(aSeed * 7.0))' : 'vec3(1.0)'};
            vec4 mv = modelViewMatrix * vec4(w, 1.0);
            gl_PointSize = ${warm ? '0.16' : '0.12 + aSeed * 0.08'} * uScale / -mv.z;
            gl_Position = projectionMatrix * mv;
          }`,
        fragmentShader: /* glsl */ `
          varying float vA; varying vec3 vC;
          void main(){ float d = length(gl_PointCoord - 0.5); float a = smoothstep(0.5, 0.15, d) * vA; if (a < 0.01) discard; gl_FragColor = vec4(vC, a); }`,
      });
      const pts = new THREE.Points(g, mat); pts.frustumCulled = false; pts.renderOrder = 8;
      scene.add(pts);
      return pts;
    };
    this.snow = make(count, false);
    this.sparkle = make(sparkles, true);
  }
  update(camera) { this.uniforms.uCenter.value.copy(camera.position); this.uniforms.uScale.value = window.innerHeight / 2; }
}

// soft steam rising off the hot spring
export function createSteam(scene, { x, y, z, r }) {
  const n = 160, a = new Float32Array(n * 3), s = new Float32Array(n);
  for (let i = 0; i < n; i++) { const ang = Math.random() * 6.28, d = Math.sqrt(Math.random()) * r; a[i * 3] = x + Math.cos(ang) * d; a[i * 3 + 1] = y; a[i * 3 + 2] = z + Math.sin(ang) * d; s[i] = Math.random(); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(a, 3)); g.setAttribute('aSeed', new THREE.BufferAttribute(s, 1));
  const uniforms = { uTime: sharedUniforms.uTime, uScale: { value: window.innerHeight / 2 } };
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, uniforms,
    vertexShader: /* glsl */ `attribute float aSeed; uniform float uTime; uniform float uScale; varying float vA;
      void main(){ float t = fract(uTime * 0.12 + aSeed); vec3 p = position; p.y += t * 3.5; p.x += sin(uTime * 0.6 + aSeed * 9.0) * t * 0.6;
        vA = sin(t * 3.14159) * 0.32; vec4 mv = modelViewMatrix * vec4(p, 1.0); gl_PointSize = (0.9 + t * 1.6) * uScale / -mv.z; gl_Position = projectionMatrix * mv; }`,
    fragmentShader: /* glsl */ `varying float vA; void main(){ float d = length(gl_PointCoord - 0.5); float a = smoothstep(0.5, 0.0, d) * vA; gl_FragColor = vec4(1.0, 0.97, 1.0, a); }`,
  });
  const pts = new THREE.Points(g, mat); pts.frustumCulled = false; pts.renderOrder = 6;
  scene.add(pts);
  return pts;
}

// ---------------------------------------------------------------- penguins
function makePenguin() {
  const black = std('#23262f', { roughness: 0.5 }), white = std('#fbfbff', { roughness: 0.6 }), orange = std('#ff9a2a', { roughness: 0.5 });
  const root = new THREE.Group();
  const body = new THREE.Group(); root.add(body);
  body.add(ball(0.24, black, 1, 1.35, 0.95));
  const belly = ball(0.2, white, 0.9, 1.25, 0.8); belly.position.set(0, -0.03, 0.08); body.add(belly);
  const head = new THREE.Group(); head.position.set(0, 0.38, 0.02); body.add(head);
  head.add(ball(0.16, black));
  const face = ball(0.12, white, 1.1, 0.9, 0.7); face.position.set(0, -0.01, 0.07); head.add(face);
  const beak = shadow(new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.14, 8), orange)); beak.rotation.x = Math.PI / 2; beak.position.set(0, -0.02, 0.19); head.add(beak);
  for (const sx of [-1, 1]) {
    const e = ball(0.025, std('#111111', { roughness: 0.2 })); e.position.set(sx * 0.06, 0.04, 0.135); head.add(e);
    const sh = ball(0.008, std('#ffffff')); sh.position.set(sx * 0.06 + 0.008, 0.05, 0.158); head.add(sh);
    const ch = ball(0.025, std('#ffb3c8')); ch.scale.set(1, 0.6, 0.4); ch.position.set(sx * 0.09, -0.04, 0.11); head.add(ch);
  }
  const flips = [1, -1].map((sx) => {
    const f = new THREE.Group(); f.position.set(sx * 0.23, 0.12, 0);
    const w = ball(0.11, black, 0.3, 1.2, 0.6); w.position.y = -0.11; f.add(w);
    body.add(f); return f;
  });
  const feet = [1, -1].map((sx) => { const f = ball(0.06, orange, 1, 0.35, 1.5); f.position.set(sx * 0.09, -0.32, 0.07); root.add(f); return f; });
  root.position.y = 0;
  body.position.y = 0.34;
  return { root, body, head, flips, feet };
}

export function addPenguins(scene, terrain, { area, count = 6, slideOn }) {
  const rand = makeRandom(13);
  const list = [];
  for (let i = 0; i < count; i++) {
    const m = makePenguin();
    const s = 0.9 + rand() * 0.35; m.root.scale.setScalar(s);
    const p = { m, x: area.x + (rand() - 0.5) * area.r, z: area.z + (rand() - 0.5) * area.r, yaw: rand() * 6, mode: 'stand', t: rand() * 3, tx: 0, tz: 0, slide: 0, ph: rand() * 6 };
    scene.add(m.root); list.push(p);
  }
  const update = (dt, ctx) => {
    for (const p of list) {
      p.t -= dt; p.ph += dt;
      const m = p.m;
      if (p.mode === 'stand' && p.t < 0) {
        const a = rand() * 6.28, d = rand() * area.r;
        p.tx = area.x + Math.cos(a) * d; p.tz = area.z + Math.sin(a) * d;
        p.mode = rand() < 0.35 ? 'slide' : 'walk'; p.t = p.mode === 'slide' ? 3.2 : 12;
      }
      let sp = 0;
      if (p.mode === 'walk' || p.mode === 'slide') {
        const dx = p.tx - p.x, dz = p.tz - p.z, d = Math.hypot(dx, dz);
        p.yaw = angleDamp(p.yaw, Math.atan2(dx, dz), p.mode === 'slide' ? 2 : 4, dt);
        sp = p.mode === 'slide' ? 3.2 : 0.55;
        if (d < 0.3 || p.t < 0) { p.mode = 'stand'; p.t = 2 + rand() * 4; sp = 0; }
      }
      // curious: turn to look at you
      const pp = ctx.playerPos;
      if (p.mode === 'stand' && pp && Math.hypot(pp.x - p.x, pp.z - p.z) < 5) p.yaw = angleDamp(p.yaw, Math.atan2(pp.x - p.x, pp.z - p.z), 3, dt);
      p.x += Math.sin(p.yaw) * sp * dt; p.z += Math.cos(p.yaw) * sp * dt;
      p.slide = damp(p.slide, p.mode === 'slide' ? 1 : 0, 6, dt);
      const walk = p.mode === 'walk' ? 1 : 0;
      m.root.position.set(p.x, terrain.getHeight(p.x, p.z) + (slideOn ? slideOn(p.x, p.z) : 0), p.z);
      m.root.rotation.y = p.yaw;
      m.body.rotation.z = Math.sin(p.ph * 9) * 0.12 * walk; // the waddle
      m.body.rotation.x = p.slide * 1.35;
      m.body.position.y = 0.34 - p.slide * 0.18;
      m.head.rotation.x = -p.slide * 1.0;
      m.flips.forEach((f, i) => { f.rotation.z = (i ? -1 : 1) * (0.15 + Math.max(0, Math.sin(p.ph * (walk ? 9 : 2.5))) * (walk ? 0.4 : 0.15) + p.slide * 1.1); });
      m.feet.forEach((f, i) => { f.position.z = 0.07 + Math.sin(p.ph * 9 + i * Math.PI) * 0.05 * walk; f.visible = p.slide < 0.5; });
    }
  };
  return { list, update };
}

// ---------------------------------------------------------------- snow bunnies
function makeBunny() {
  const fur = std('#ffffff', { roughness: 1 }), pink = std('#ffb3c8', { roughness: 0.8 });
  const root = new THREE.Group();
  const body = new THREE.Group(); root.add(body);
  body.add(ball(0.17, fur, 0.9, 0.85, 1.15));
  const head = new THREE.Group(); head.position.set(0, 0.14, 0.15); body.add(head);
  head.add(ball(0.11, fur));
  for (const sx of [-1, 1]) {
    const ear = new THREE.Group(); ear.position.set(sx * 0.05, 0.08, -0.02); ear.rotation.set(-0.25, 0, -sx * 0.18);
    const e = ball(0.05, fur, 0.7, 2.6, 0.45); e.position.y = 0.11; ear.add(e);
    const ie = ball(0.03, pink, 0.6, 2.4, 0.3); ie.position.set(0, 0.11, 0.015); ear.add(ie);
    head.add(ear);
    const eye = ball(0.02, std('#3a2030', { roughness: 0.2 })); eye.position.set(sx * 0.055, 0.03, 0.085); head.add(eye);
  }
  const nose = ball(0.018, pink); nose.position.set(0, -0.005, 0.11); head.add(nose);
  const tail = ball(0.07, fur); tail.position.set(0, 0.02, -0.2); body.add(tail);
  body.position.y = 0.15;
  return { root, body, head };
}

export function addSnowBunnies(scene, terrain, { area, count = 6, ok }) {
  const rand = makeRandom(29);
  const list = [];
  for (let i = 0; i < count; i++) {
    const m = makeBunny(); m.root.scale.setScalar(1.1 + rand() * 0.3);
    const b = { m, x: area.x + (rand() - 0.5) * area.r, z: area.z + (rand() - 0.5) * area.r, yaw: rand() * 6, t: rand() * 2, hop: 0, hops: 0, ph: rand() * 6 };
    scene.add(m.root); list.push(b);
  }
  const update = (dt, ctx) => {
    for (const b of list) {
      b.t -= dt; b.ph += dt;
      const pp = ctx.playerPos, pd = pp ? Math.hypot(pp.x - b.x, pp.z - b.z) : 99;
      if (b.hops <= 0 && b.t < 0) { b.hops = 2 + Math.floor(rand() * 4); b.yaw += (rand() - 0.5) * 2.4; if (Math.hypot(b.x - area.x, b.z - area.z) > area.r) b.yaw = Math.atan2(area.x - b.x, area.z - b.z); }
      if (pd < 2.5 && ctx.playerSpeed > 4 && b.hops <= 0) { b.hops = 5; b.yaw = Math.atan2(b.x - pp.x, b.z - pp.z); }
      let y = 0;
      if (b.hops > 0) {
        b.hop += dt * 2.6;
        y = Math.sin((b.hop % 1) * Math.PI) * 0.22;
        const nx = b.x + Math.sin(b.yaw) * 1.5 * dt, nz = b.z + Math.cos(b.yaw) * 1.5 * dt;
        if (!ok || ok(nx, nz)) { b.x = nx; b.z = nz; } else b.yaw += 2;
        if (b.hop >= 1) { b.hop = 0; b.hops--; if (b.hops <= 0) b.t = 1.5 + rand() * 4; }
      }
      b.m.root.position.set(b.x, terrain.getHeight(b.x, b.z) + y, b.z);
      b.m.root.rotation.y = b.yaw;
      b.m.body.rotation.x = b.hops > 0 ? -Math.sin((b.hop % 1) * Math.PI * 2) * 0.25 : 0;
      b.m.head.rotation.x = b.hops > 0 ? 0 : Math.sin(b.ph * 7) * 0.05; // a sniffy little nose wiggle
    }
  };
  return { list, update };
}
