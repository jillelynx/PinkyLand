// Objects in the world: campfire, tent, sleeping bag, collectibles,
// the magic portal, a waterfall, lily pads, houses and playground.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { sharedUniforms } from './terrain.js';
import { makeRandom } from '../util/noise.js';

const std = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.8, ...o });
function shadow(m, cast = true) { m.castShadow = cast; m.receiveShadow = true; return m; }

// ---------------- Campfire ----------------
export class Campfire {
  constructor(scene, pos) {
    this.group = new THREE.Group();
    this.group.position.copy(pos);
    scene.add(this.group);
    // ring of stones
    const stoneMat = std('#9a93a8', { flatShading: true });
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2;
      const s = shadow(new THREE.Mesh(new THREE.DodecahedronGeometry(0.16, 0), stoneMat));
      s.position.set(Math.cos(a) * 0.55, 0.06, Math.sin(a) * 0.55);
      s.scale.set(1, 0.7, 1);
      s.rotation.set(Math.random(), Math.random(), 0);
      this.group.add(s);
    }
    // crossed logs
    const logMat = std('#7a4a2a');
    for (let i = 0; i < 4; i++) {
      const l = shadow(new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.8, 7), logMat));
      l.rotation.z = Math.PI / 2 - 0.5;
      l.rotation.y = (i / 4) * Math.PI;
      l.position.y = 0.18;
      this.group.add(l);
    }
    // glowing embers bed
    const embers = new THREE.Mesh(new THREE.CircleGeometry(0.35, 16), new THREE.MeshBasicMaterial({ color: '#ff7a2a' }));
    embers.rotation.x = -Math.PI / 2;
    embers.position.y = 0.03;
    this.group.add(embers);
    // flames: layered cones with an animated glow shader
    this.flameMat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      uniforms: { uTime: sharedUniforms.uTime, uLit: { value: 1 } },
      vertexShader: /* glsl */ `
        uniform float uTime; varying vec2 vUv; varying float vH;
        void main(){
          vUv = uv; vec3 p = position; vH = uv.y;
          p.x += sin(uTime*7.0 + p.y*8.0) * 0.05 * uv.y;
          p.z += cos(uTime*6.0 + p.y*7.0) * 0.05 * uv.y;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(p,1.0);
        }`,
      fragmentShader: /* glsl */ `
        uniform float uTime; uniform float uLit; varying vec2 vUv; varying float vH;
        void main(){
          float flick = 0.8 + 0.2*sin(uTime*13.0 + vUv.x*20.0);
          vec3 col = mix(vec3(1.0,0.85,0.35), vec3(1.0,0.3,0.1), vH);
          float a = (1.0 - vH) * flick * uLit;
          gl_FragColor = vec4(col * 1.6, a);
        }`,
    });
    this.flames = [];
    for (let i = 0; i < 3; i++) {
      const f = new THREE.Mesh(new THREE.ConeGeometry(0.28 - i * 0.06, 0.9 - i * 0.15, 12, 4, true), this.flameMat);
      f.position.y = 0.45 - i * 0.05;
      f.rotation.y = i;
      this.group.add(f);
      this.flames.push(f);
    }
    // warm flickering light
    this.light = new THREE.PointLight('#ffa257', 6, 12, 1.6);
    this.light.position.y = 0.8;
    this.light.castShadow = false;
    this.group.add(this.light);
    // floating sparks
    const n = 40;
    const g = new THREE.BufferGeometry();
    const p = new Float32Array(n * 3);
    const seeds = new Float32Array(n);
    for (let i = 0; i < n; i++) { seeds[i] = Math.random() * 10; }
    g.setAttribute('position', new THREE.BufferAttribute(p, 3));
    g.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1));
    this.sparks = new THREE.Points(g, new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: { uTime: sharedUniforms.uTime, uLit: { value: 1 } },
      vertexShader: /* glsl */ `
        attribute float aSeed; uniform float uTime; varying float vA;
        void main(){
          float t = fract(uTime*0.35 + aSeed);
          vec3 p = vec3(sin(aSeed*7.0 + t*4.0)*0.3*t, t*3.0, cos(aSeed*5.0 + t*3.0)*0.3*t);
          vA = 1.0 - t;
          vec4 mv = modelViewMatrix * vec4(p,1.0);
          gl_PointSize = 60.0 / -mv.z;
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */ `
        uniform float uLit; varying float vA;
        void main(){ float d = length(gl_PointCoord-0.5); float a = smoothstep(0.5,0.0,d)*vA*uLit; gl_FragColor = vec4(1.0,0.6,0.2,a); }`,
    }));
    this.sparks.frustumCulled = false;
    this.sparks.position.y = 0.3;
    this.group.add(this.sparks);
    this.lit = true;
    this.t = 0;
    this.collider = { type: 'cyl', x: pos.x, z: pos.z, r: 0.6, top: pos.y + 0.3, bottom: pos.y - 1, noStand: true };
  }

  setLit(on) {
    this.lit = on;
    this.flameMat.uniforms.uLit.value = on ? 1 : 0;
    this.sparks.material.uniforms.uLit.value = on ? 1 : 0;
    this.light.visible = on;
  }

  update(dt, night) {
    this.t += dt;
    const flick = 0.85 + Math.sin(this.t * 17) * 0.08 + Math.sin(this.t * 7.3) * 0.07;
    this.light.intensity = (2.5 + night * 6) * flick;
    for (const f of this.flames) f.scale.y = 0.9 + Math.sin(this.t * 9 + f.rotation.y) * 0.1;
  }
}

// ---------------- Tent & sleeping bag ----------------
export function createTent() {
  const g = new THREE.Group();
  const canvas = document.createElement('canvas');
  canvas.width = 256; canvas.height = 256;
  const c = canvas.getContext('2d');
  c.fillStyle = '#ffc7dc'; c.fillRect(0, 0, 256, 256);
  c.fillStyle = '#ffffff';
  for (let x = 0; x < 256; x += 64) c.fillRect(x, 0, 32, 256);
  c.fillStyle = '#ff8fb8';
  for (let i = 0; i < 6; i++) { const x = 30 + i * 40, y = 60 + (i % 2) * 90; c.beginPath(); c.moveTo(x, y + 8); c.bezierCurveTo(x - 14, y - 6, x - 6, y - 16, x, y - 6); c.bezierCurveTo(x + 6, y - 16, x + 14, y - 6, x, y + 8); c.fill(); }
  const tex = new THREE.CanvasTexture(canvas); tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  const fabricMat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9, side: THREE.DoubleSide });
  // triangular prism tent
  const shape = new THREE.Shape();
  shape.moveTo(-1.1, 0); shape.lineTo(0, 1.5); shape.lineTo(1.1, 0); shape.lineTo(-1.1, 0);
  const body = new THREE.ExtrudeGeometry(shape, { depth: 2.2, bevelEnabled: false });
  body.translate(0, 0, -1.1);
  const tent = shadow(new THREE.Mesh(body, fabricMat));
  g.add(tent);
  // open doorway (dark triangle on the front)
  const door = new THREE.Mesh(new THREE.ShapeGeometry((() => { const s = new THREE.Shape(); s.moveTo(-0.55, 0); s.lineTo(0, 1.05); s.lineTo(0.55, 0); return s; })()), new THREE.MeshBasicMaterial({ color: '#4a2a3a' }));
  door.position.z = 1.11;
  g.add(door);
  // little bunting flags
  const flagMat = ['#ffe27a', '#9fd8ff', '#c9a8ff', '#ff9ecb'].map((col) => new THREE.MeshStandardMaterial({ color: col, side: THREE.DoubleSide }));
  for (let i = 0; i < 6; i++) {
    const f = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.16, 3), flagMat[i % 4]);
    f.position.set(0, 1.45, -1 + i * 0.4);
    f.rotation.x = Math.PI;
    g.add(f);
  }
  // sleeping bag peeking out
  const bag = createSleepingBag();
  bag.position.set(0, 0.02, 0.6);
  g.add(bag);
  // lantern
  const lantern = new THREE.Group();
  const glass = new THREE.Mesh(new THREE.SphereGeometry(0.1, 12, 10), new THREE.MeshStandardMaterial({ color: '#fff3c4', emissive: '#ffd27a', emissiveIntensity: 2 }));
  lantern.add(glass);
  const lightL = new THREE.PointLight('#ffd27a', 1.5, 4);
  lantern.add(lightL);
  lantern.position.set(0.8, 0.12, 1.3);
  g.add(lantern);
  return g;
}

export function createSleepingBag() {
  const bag = new THREE.Group();
  const b = shadow(new THREE.Mesh(new THREE.CapsuleGeometry(0.28, 1.2, 6, 12), new THREE.MeshPhysicalMaterial({ color: '#b9a6ff', roughness: 0.6, sheen: 1, sheenColor: new THREE.Color('#ffffff') })));
  b.rotation.x = Math.PI / 2;
  b.scale.set(1, 1, 0.45);
  b.position.y = 0.12;
  bag.add(b);
  const pillow = shadow(new THREE.Mesh(new THREE.CapsuleGeometry(0.14, 0.3, 4, 10), std('#ffffff')));
  pillow.rotation.z = Math.PI / 2;
  pillow.position.set(0, 0.2, -0.75);
  pillow.scale.set(1, 1, 0.6);
  bag.add(pillow);
  return bag;
}

// ---------------- Collectibles ----------------
const collectGeos = {};
function starGeometry() {
  if (collectGeos.star) return collectGeos.star;
  const s = new THREE.Shape();
  for (let i = 0; i < 10; i++) {
    const a = Math.PI / 2 + (i * Math.PI) / 5;
    const r = i % 2 ? 0.13 : 0.3;
    if (i === 0) s.moveTo(Math.cos(a) * r, Math.sin(a) * r); else s.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.08, bevelEnabled: true, bevelThickness: 0.04, bevelSize: 0.04, bevelSegments: 3 });
  g.center();
  collectGeos.star = g;
  return g;
}

function shellGeometry() {
  if (collectGeos.shell) return collectGeos.shell;
  // a scallop shell: ribbed fan
  const g = new THREE.SphereGeometry(0.22, 24, 12, Math.PI * 0.15, Math.PI * 0.7, 0, Math.PI / 2);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i);
    const a = Math.atan2(z, x);
    const k = 1 + Math.sin(a * 22) * 0.04;
    p.setXYZ(i, x * k, p.getY(i) * 0.45, z * k);
  }
  g.computeVertexNormals();
  collectGeos.shell = g;
  return g;
}

function featherGeometry() {
  if (collectGeos.feather) return collectGeos.feather;
  const s = new THREE.Shape();
  s.moveTo(0, -0.3);
  s.bezierCurveTo(0.12, -0.1, 0.12, 0.2, 0, 0.32);
  s.bezierCurveTo(-0.1, 0.2, -0.1, -0.1, 0, -0.3);
  const g = new THREE.ShapeGeometry(s, 8);
  collectGeos.feather = g;
  return g;
}

export const COLLECTIBLE_INFO = {
  star: { name: 'Dream Star', color: '#ffe27a', emissive: '#ffcf3a' },
  shell: { name: 'Pink Shell', color: '#ffc2d6', emissive: '#ff8fb8' },
  feather: { name: 'Rainbow Feather', color: '#9fd8ff', emissive: '#5ab0ff' },
  seaglass: { name: 'Sea Glass', color: '#7ff2e6', emissive: '#3fd8c8' },
  flower: { name: 'Moon Flower', color: '#ffffff', emissive: '#c9a8ff' },
  heart: { name: 'Kindness Heart', color: '#ff7fa8', emissive: '#ff3f7a' },
  litter: { name: 'Litter', color: '#c8c8c8', emissive: '#000000' },
  cape: { name: 'Sky Cape', color: '#22a7e0', emissive: '#22a7e0' },
  bandage: { name: 'Bandage', color: '#ffe0c4', emissive: '#ffffff' },
};

export function createCollectible(kind) {
  const info = COLLECTIBLE_INFO[kind];
  const group = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: info.color, emissive: info.emissive, emissiveIntensity: 0.7, roughness: 0.35, metalness: 0.1 });
  let m;
  if (kind === 'star') m = new THREE.Mesh(starGeometry(), mat);
  else if (kind === 'shell') { m = new THREE.Mesh(shellGeometry(), new THREE.MeshStandardMaterial({ color: info.color, emissive: info.emissive, emissiveIntensity: 0.3, roughness: 0.4, side: THREE.DoubleSide })); }
  else if (kind === 'feather') { m = new THREE.Mesh(featherGeometry(), new THREE.MeshStandardMaterial({ color: info.color, emissive: info.emissive, emissiveIntensity: 0.6, side: THREE.DoubleSide })); }
  else if (kind === 'seaglass') { m = new THREE.Mesh(new THREE.DodecahedronGeometry(0.15, 0), new THREE.MeshPhysicalMaterial({ color: info.color, emissive: info.emissive, emissiveIntensity: 0.5, roughness: 0.2, transmission: 0.4, thickness: 0.3 })); }
  else if (kind === 'flower') {
    m = new THREE.Group();
    for (let i = 0; i < 6; i++) {
      const petal = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8), new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: '#c9a8ff', emissiveIntensity: 0.8 }));
      petal.scale.set(1, 0.3, 0.5);
      const a = (i / 6) * Math.PI * 2;
      petal.position.set(Math.cos(a) * 0.09, 0, Math.sin(a) * 0.09);
      petal.rotation.y = -a;
      m.add(petal);
    }
    const center = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 8), new THREE.MeshStandardMaterial({ color: '#ffe27a', emissive: '#ffcf3a', emissiveIntensity: 1 }));
    m.add(center);
  } else if (kind === 'heart') {
    const s = new THREE.Shape();
    s.moveTo(0, -0.25);
    s.bezierCurveTo(-0.35, 0.0, -0.25, 0.32, 0, 0.15);
    s.bezierCurveTo(0.25, 0.32, 0.35, 0.0, 0, -0.25);
    const g = new THREE.ExtrudeGeometry(s, { depth: 0.08, bevelEnabled: true, bevelThickness: 0.04, bevelSize: 0.04, bevelSegments: 3 });
    g.center();
    m = new THREE.Mesh(g, mat);
  } else if (kind === 'litter') {
    // big, bright pieces so they're easy to spot in the grass
    const r = Math.random();
    if (r < 0.33) {
      m = new THREE.Group();
      const can = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.32, 16), std('#e8343c', { metalness: 0.5, roughness: 0.3 }));
      const band = new THREE.Mesh(new THREE.CylinderGeometry(0.112, 0.112, 0.08, 16), std('#ffffff', { roughness: 0.4 }));
      const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.02, 16), std('#cfd3d8', { metalness: 0.8, roughness: 0.25 }));
      rim.position.y = 0.165;
      m.add(can, band, rim);
      m.rotation.z = Math.PI / 2;
    } else if (r < 0.66) {
      m = new THREE.Mesh(new THREE.IcosahedronGeometry(0.2, 1), std('#ffffff', { flatShading: true, roughness: 0.9 }));
      m.scale.set(1, 0.8, 0.9);
    } else {
      m = new THREE.Group();
      const box = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.24, 0.12), std('#f2b233'));
      const top = new THREE.Mesh(new THREE.BoxGeometry(0.345, 0.07, 0.125), std('#2f7de1'));
      top.position.y = 0.09;
      const straw = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.16, 6), std('#ff5fa2'));
      straw.position.set(0.1, 0.18, 0); straw.rotation.z = -0.3;
      m.add(box, top, straw);
      m.rotation.z = Math.PI / 2 - 0.25;
    }
    m.position.y = 0.1;
  } else if (kind === 'cape') {
    m = createCape(info.color, 0.9);
    m.rotation.x = 0.2;
  } else if (kind === 'bandage') {
    m = new THREE.Group();
    const strip = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.02, 0.09), std('#f2c9a4'));
    const pad = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.03, 0.08), std('#ffffff'));
    m.add(strip, pad);
  }
  m.traverse?.((o) => { if (o.isMesh) o.castShadow = true; });
  group.add(m);
  // soft sparkle halo
  if (kind === 'litter') {
    // a gentle white glint so litter catches your eye
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: '#ffffff', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.35 }));
    halo.scale.setScalar(0.9);
    halo.position.y = 0.15;
    group.add(halo);
  } else {
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: info.emissive, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.55 }));
    halo.scale.setScalar(1.0);
    group.add(halo);
  }
  group.userData = { kind, spin: kind !== 'litter' && kind !== 'shell', base: 0, t: Math.random() * 6, inner: m };
  return group;
}

let _glow;
export function glowTexture() {
  if (_glow) return _glow;
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.25, 'rgba(255,255,255,0.5)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 128, 128);
  _glow = new THREE.CanvasTexture(c);
  return _glow;
}

export function animateCollectible(obj, dt) {
  const u = obj.userData;
  u.t += dt;
  if (u.spin) u.inner.rotation.y += dt * 1.6;
  u.inner.position.y = Math.sin(u.t * 2) * 0.08;
}

// ---------------- Magic cape ----------------
// Shiny turquoise satin cape (like Jacinta's real one!)
export function createCape(color = '#22a7e0', size = 1) {
  const pivot = new THREE.Group();
  const geo = new THREE.PlaneGeometry(0.42 * size, 0.62 * size, 6, 10);
  geo.translate(0, -0.31 * size, 0);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i);
    // flare out at the bottom and gather at the neck
    const t = -y / (0.62 * size);
    p.setX(i, x * (0.55 + t * 0.7));
    p.setZ(i, -Math.cos((x / (0.42 * size)) * Math.PI) * 0.03 * t - t * 0.02);
  }
  geo.computeVertexNormals();
  const mat = new THREE.MeshPhysicalMaterial({ color, roughness: 0.25, metalness: 0.05, sheen: 1, sheenColor: new THREE.Color('#bff0ff'), clearcoat: 0.6, side: THREE.DoubleSide });
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = true;
  pivot.add(m);
  // little tie at the neck
  const tie = new THREE.Mesh(new THREE.TorusGeometry(0.05 * size, 0.015 * size, 6, 12), mat);
  tie.position.z = 0.03;
  pivot.add(tie);
  return pivot;
}

// ---------------- Portal ----------------
export class Portal {
  constructor(scene, pos, yaw = 0) {
    this.group = new THREE.Group();
    this.group.position.copy(pos);
    this.group.rotation.y = yaw;
    scene.add(this.group);
    this.uniforms = { uTime: sharedUniforms.uTime, uPower: { value: 0 } };
    const mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
      uniforms: this.uniforms,
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: /* glsl */ `
        uniform float uTime; uniform float uPower; varying vec2 vUv;
        void main(){
          vec2 p = vUv - 0.5; p.y *= 0.8;
          float r = length(p);
          float a = atan(p.y, p.x);
          float swirl = sin(a*5.0 + r*22.0 - uTime*3.0)*0.5+0.5;
          float swirl2 = sin(a*3.0 - r*14.0 + uTime*2.0)*0.5+0.5;
          vec3 c = mix(vec3(1.0,0.55,0.8), vec3(0.6,0.75,1.0), swirl2);
          c = mix(c, vec3(1.0,0.95,0.7), swirl*0.4);
          float mask = smoothstep(0.5, 0.3, r);
          float core = smoothstep(0.3, 0.0, r);
          gl_FragColor = vec4(c * (0.7 + core), mask * (0.25 + 0.75*uPower) * (0.6 + 0.4*swirl));
        }`,
    });
    this.disc = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 3.0), mat);
    this.disc.position.y = 1.6;
    this.group.add(this.disc);
    // a ring of heart-lights around the portal
    this.hearts = [];
    for (let i = 0; i < 5; i++) {
      const h = createCollectible('heart');
      const a = Math.PI / 2 + (i - 2) * 0.55;
      h.position.set(Math.cos(a) * 1.5, 1.6 + Math.sin(a) * 1.7, 0);
      h.scale.setScalar(0.8);
      h.userData.inner.material = h.userData.inner.material.clone();
      h.userData.inner.material.emissiveIntensity = 0.05;
      h.userData.inner.material.color.set('#a8a0b0');
      h.children[1].material = h.children[1].material.clone();
      h.children[1].material.opacity = 0;
      this.group.add(h);
      this.hearts.push(h);
    }
    // arch of stones / flowers
    const arch = new THREE.Mesh(new THREE.TorusGeometry(1.45, 0.12, 10, 40, Math.PI), new THREE.MeshStandardMaterial({ color: '#d9c8ff', roughness: 0.5, emissive: '#ffb3d9', emissiveIntensity: 0.2 }));
    arch.position.y = 1.6;
    arch.scale.y = 1.15;
    this.group.add(arch);
    for (const s of [-1, 1]) {
      const post = shadow(new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.16, 1.65, 10), arch.material));
      post.position.set(s * 1.45, 0.82, 0);
      this.group.add(post);
    }
    this.light = new THREE.PointLight('#ffb3e0', 0, 10);
    this.light.position.y = 1.6;
    this.group.add(this.light);
    this.power = 0;
    this.lit = 0;
  }

  setHearts(n) {
    this.lit = n;
    this.hearts.forEach((h, i) => {
      const on = i < n;
      h.userData.inner.material.color.set(on ? '#ff7fa8' : '#a8a0b0');
      h.userData.inner.material.emissiveIntensity = on ? 0.9 : 0.05;
      h.children[1].material.opacity = on ? 0.6 : 0;
    });
  }

  update(dt) {
    const target = this.lit / 5;
    this.power += (target - this.power) * Math.min(1, dt * 2);
    this.uniforms.uPower.value = this.power;
    this.light.intensity = this.power * 6;
    this.disc.visible = this.power > 0.02;
    this.hearts.forEach((h) => animateCollectible(h, dt));
  }
}

// ---------------- Waterfall ----------------
export class Waterfall {
  constructor(scene, { top, bottom, width = 3, z = 0, yaw = 0, x = 0 }) {
    this.group = new THREE.Group();
    this.group.position.set(x, 0, z);
    this.group.rotation.y = yaw;
    scene.add(this.group);
    const h = top - bottom;
    const geo = new THREE.PlaneGeometry(width, h, 8, 20);
    const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const y = p.getY(i);
      const t = (h / 2 - y) / h; // 0 top .. 1 bottom
      p.setZ(i, Math.pow(t, 2.2) * 1.2 + Math.sin(p.getX(i) * 3) * 0.05);
    }
    geo.translate(0, bottom + h / 2, 0);
    this.mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: true,
      uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uNight: { value: 0 } }]),
      vertexShader: /* glsl */ `
        #include <fog_pars_vertex>
        varying vec2 vUv;
        void main(){ vUv = uv; vec4 mvPosition = modelViewMatrix * vec4(position,1.0); gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
        }`,
      fragmentShader: /* glsl */ `
        #include <fog_pars_fragment>
        uniform float uTime; uniform float uNight; varying vec2 vUv;
        float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233)))*43758.5453); }
        float n(vec2 p){ vec2 i=floor(p), f=fract(p); vec2 u=f*f*(3.0-2.0*f);
          return mix(mix(hash(i),hash(i+vec2(1,0)),u.x), mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),u.x), u.y); }
        void main(){
          vec2 uv = vUv;
          float streaks = n(vec2(uv.x*18.0, uv.y*3.0 + uTime*2.5)) * 0.6 + n(vec2(uv.x*40.0, uv.y*6.0 + uTime*4.0)) * 0.4;
          vec3 col = mix(vec3(0.55,0.88,0.95), vec3(1.0), smoothstep(0.45, 0.85, streaks));
          col *= mix(1.0, 0.45, uNight);
          float edge = smoothstep(0.0, 0.12, uv.x) * smoothstep(1.0, 0.88, uv.x);
          float a = (0.55 + streaks * 0.4) * edge;
          gl_FragColor = vec4(col, a);
          #include <fog_fragment>
        }`,
    });
    this.mat.uniforms.uTime = sharedUniforms.uTime;
    const sheet = new THREE.Mesh(geo, this.mat);
    sheet.renderOrder = 6;
    this.group.add(sheet);
    // mist at the bottom
    const mist = [];
    const mistMat = new THREE.SpriteMaterial({ map: glowTexture(), color: '#ffffff', transparent: true, opacity: 0.35, depthWrite: false });
    for (let i = 0; i < 14; i++) {
      const s = new THREE.Sprite(mistMat);
      s.position.set((Math.random() - 0.5) * width, bottom + 0.3, 1.2 + Math.random() * 0.8);
      s.scale.setScalar(1.5 + Math.random() * 1.5);
      s.userData.t = Math.random() * 6;
      this.group.add(s);
      mist.push(s);
    }
    this.mist = mist;
    this.bottom = bottom;
    // a little rainbow arc in the mist
    const rainbowMat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
      uniforms: { uDay: { value: 1 } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
      fragmentShader: /* glsl */ `
        uniform float uDay; varying vec2 vUv;
        vec3 hue(float h){ return clamp(abs(mod(h*6.0+vec3(0,4,2),6.0)-3.0)-1.0, 0.0, 1.0); }
        void main(){ float t = vUv.y; float a = smoothstep(0.0,0.15,t)*smoothstep(1.0,0.85,t);
          gl_FragColor = vec4(hue(t*0.8), a*0.22*uDay); }`,
    });
    this.rainbowMat = rainbowMat;
    const rb = new THREE.Mesh(new THREE.RingGeometry(2.2, 2.7, 40, 1, 0, Math.PI), rainbowMat);
    rb.position.set(0, bottom, 2.4);
    this.group.add(rb);
    this.worldPos = new THREE.Vector3(x, bottom, z);
  }

  update(dt, night) {
    this.mat.uniforms.uNight.value = night;
    this.rainbowMat.uniforms.uDay.value = 1 - night;
    for (const s of this.mist) {
      s.userData.t += dt;
      s.position.y = this.bottom + 0.3 + (s.userData.t % 3) * 0.4;
      s.material.opacity = 0.3;
    }
  }
}

// ---------------- Lily pads & lotus flowers ----------------
export function createLilyPads(spots, waterLevel) {
  const g = new THREE.Group();
  const padGeo = new THREE.CircleGeometry(0.45, 20, 0.3, Math.PI * 2 - 0.4);
  padGeo.rotateX(-Math.PI / 2);
  const padMat = std('#5fae55', { side: THREE.DoubleSide, roughness: 0.5 });
  const lotusMat = new THREE.MeshStandardMaterial({ color: '#ffd1e3', emissive: '#ff9ecb', emissiveIntensity: 0.25, roughness: 0.5 });
  for (const s of spots) {
    const p = new THREE.Mesh(padGeo, padMat);
    p.position.set(s.x, waterLevel + 0.03, s.z);
    p.rotation.y = Math.random() * 6;
    p.scale.setScalar(0.7 + Math.random() * 0.8);
    p.receiveShadow = true;
    g.add(p);
    if (s.flower) {
      const lotus = new THREE.Group();
      for (let i = 0; i < 8; i++) {
        const petal = new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 8), lotusMat);
        petal.scale.set(0.5, 1, 0.25);
        const a = (i / 8) * Math.PI * 2;
        petal.position.set(Math.cos(a) * 0.07, 0.08, Math.sin(a) * 0.07);
        petal.rotation.set(Math.sin(a) * 0.5, 0, -Math.cos(a) * 0.5);
        lotus.add(petal);
      }
      lotus.position.set(s.x, waterLevel + 0.04, s.z);
      g.add(lotus);
    }
  }
  return g;
}

// ---------------- Earth: houses, playground, bench ----------------
export function createHouse({ color = '#ffe0b3', roof = '#d9605a', door = '#7a4a8a', w = 6, d = 5, h = 3.2 }) {
  const g = new THREE.Group();
  const wall = shadow(new THREE.Mesh(new THREE.BoxGeometry(w, h, d), std(color)));
  wall.position.y = h / 2;
  g.add(wall);
  const roofShape = new THREE.Shape();
  roofShape.moveTo(-w / 2 - 0.4, 0); roofShape.lineTo(0, 2); roofShape.lineTo(w / 2 + 0.4, 0); roofShape.lineTo(-w / 2 - 0.4, 0);
  const roofGeo = new THREE.ExtrudeGeometry(roofShape, { depth: d + 0.6, bevelEnabled: false });
  roofGeo.translate(0, 0, -(d + 0.6) / 2);
  const r = shadow(new THREE.Mesh(roofGeo, std(roof)));
  r.position.y = h;
  g.add(r);
  const dr = new THREE.Mesh(new THREE.BoxGeometry(1.0, 1.9, 0.1), std(door));
  dr.position.set(0, 0.95, d / 2 + 0.03);
  g.add(dr);
  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 8), std('#ffd700', { metalness: 0.8, roughness: 0.3 }));
  knob.position.set(0.35, 0.95, d / 2 + 0.1);
  g.add(knob);
  const winMat = new THREE.MeshStandardMaterial({ color: '#bfe6ff', emissive: '#ffd98a', emissiveIntensity: 0, roughness: 0.2 });
  for (const s of [-1, 1]) {
    const win = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.0, 0.1), winMat);
    win.position.set(s * w * 0.3, h * 0.6, d / 2 + 0.03);
    g.add(win);
    const frame = new THREE.Mesh(new THREE.BoxGeometry(1.25, 0.08, 0.15), std('#ffffff'));
    frame.position.set(s * w * 0.3, h * 0.6 - 0.55, d / 2 + 0.05);
    g.add(frame);
    // flower box
    const box = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.2, 0.25), std('#8a5a3c'));
    box.position.set(s * w * 0.3, h * 0.6 - 0.65, d / 2 + 0.15);
    g.add(box);
    for (let i = 0; i < 5; i++) {
      const fl = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), std(['#ff7fa8', '#ffe27a', '#c9a8ff'][i % 3]));
      fl.position.set(s * w * 0.3 - 0.45 + i * 0.22, h * 0.6 - 0.5, d / 2 + 0.18);
      g.add(fl);
    }
  }
  // chimney
  const ch = shadow(new THREE.Mesh(new THREE.BoxGeometry(0.6, 1.4, 0.6), std('#b06a5a')));
  ch.position.set(w * 0.25, h + 1.3, 0);
  g.add(ch);
  g.userData.windowMat = winMat;
  g.userData.size = { w, d, h };
  return g;
}

export function createPlayground() {
  const g = new THREE.Group();
  const metal = std('#ff9a3c', { metalness: 0.3, roughness: 0.5 });
  // swing set
  const swing = new THREE.Group();
  for (const s of [-1, 1]) {
    for (const k of [-1, 1]) {
      const leg = shadow(new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 2.8, 8), metal));
      // A-frame: legs meet at the top bar and spread apart at the ground
      leg.position.set(s * 1.6, 1.3, k * 0.42);
      leg.rotation.x = -k * 0.3;
      swing.add(leg);
    }
  }
  const bar = shadow(new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 3.4, 8), metal));
  bar.rotation.z = Math.PI / 2;
  bar.position.y = 2.6;
  swing.add(bar);
  swing.userData.seats = [];
  for (const s of [-0.7, 0.7]) {
    const seatG = new THREE.Group();
    seatG.position.set(s, 2.6, 0);
    for (const k of [-0.2, 0.2]) {
      const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 1.9, 4), std('#555555'));
      rope.position.set(k, -0.95, 0);
      seatG.add(rope);
    }
    const seat = shadow(new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.05, 0.22), std('#3d7ea6')));
    seat.position.y = -1.9;
    seatG.add(seat);
    swing.add(seatG);
    swing.userData.seats.push(seatG);
  }
  g.add(swing);
  // slide
  const slide = new THREE.Group();
  const ladder = shadow(new THREE.Mesh(new THREE.BoxGeometry(0.7, 2, 0.1), std('#7cc576')));
  ladder.position.set(0, 1, -1.2);
  ladder.rotation.x = -0.2;
  slide.add(ladder);
  const platform = shadow(new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.1, 0.9), std('#7cc576')));
  platform.position.set(0, 1.9, -0.8);
  slide.add(platform);
  const chute = shadow(new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.06, 2.8), std('#ffd34d')));
  chute.position.set(0, 1.0, 0.65);
  chute.rotation.x = 0.68;
  slide.add(chute);
  slide.position.set(4.5, 0, 0);
  g.add(slide);
  return g;
}

export function createBench() {
  const g = new THREE.Group();
  const wood = std('#b8794a');
  for (let i = 0; i < 3; i++) {
    const slat = shadow(new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.06, 0.14), wood));
    slat.position.set(0, 0.45, -0.16 + i * 0.16);
    g.add(slat);
  }
  for (let i = 0; i < 2; i++) {
    const back = shadow(new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.12, 0.05), wood));
    back.position.set(0, 0.65 + i * 0.18, -0.26);
    g.add(back);
  }
  for (const s of [-0.8, 0.8]) {
    const leg = shadow(new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.45, 0.45), std('#555566')));
    leg.position.set(s, 0.22, 0);
    g.add(leg);
  }
  return g;
}

export function createTrashBin() {
  const g = new THREE.Group();
  const bin = shadow(new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.28, 0.9, 16, 1, true), std('#4f9d69', { side: THREE.DoubleSide })));
  bin.position.y = 0.45;
  g.add(bin);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.03, 6, 20), std('#3d7a52'));
  rim.rotation.x = Math.PI / 2;
  rim.position.y = 0.9;
  g.add(rim);
  const bottom = new THREE.Mesh(new THREE.CircleGeometry(0.28, 16), std('#2d5a3a'));
  bottom.rotation.x = -Math.PI / 2;
  bottom.position.y = 0.05;
  g.add(bottom);
  return g;
}

export function createBike() {
  const g = new THREE.Group();
  const wheelMat = std('#333333');
  for (const z of [-0.45, 0.45]) {
    const w = shadow(new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.04, 8, 20), wheelMat));
    w.position.set(0, 0.04, z);
    w.rotation.x = Math.PI / 2;
    g.add(w);
  }
  const frame = shadow(new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.9), std('#c9a8ff')));
  frame.position.set(0, 0.08, 0);
  g.add(frame);
  g.rotation.z = 0;
  return g;
}

export function createSign(text, { color = '#fff6e0', board = '#b8794a' } = {}) {
  const g = new THREE.Group();
  const post = shadow(new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 1.4, 6), std(board)));
  post.position.y = 0.7;
  g.add(post);
  const c = document.createElement('canvas');
  c.width = 256; c.height = 128;
  const x = c.getContext('2d');
  x.fillStyle = color; x.fillRect(0, 0, 256, 128);
  x.fillStyle = '#5a3a2a';
  x.font = 'bold 34px "Chalkboard SE", "Marker Felt", "Comic Sans MS", sans-serif';
  x.textAlign = 'center'; x.textBaseline = 'middle';
  const lines = text.split('\n');
  lines.forEach((l, i) => x.fillText(l, 128, 64 + (i - (lines.length - 1) / 2) * 38));
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const boardM = shadow(new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.5, 0.06), [std(board), std(board), std(board), std(board), new THREE.MeshStandardMaterial({ map: t }), std(board)]));
  boardM.position.y = 1.3;
  g.add(boardM);
  return g;
}

export function createFence(length = 10) {
  const parts = [];
  const n = Math.floor(length / 0.6);
  for (let i = 0; i <= n; i++) {
    const p = new THREE.BoxGeometry(0.1, 0.8, 0.06);
    p.translate(-length / 2 + i * 0.6, 0.4, 0);
    parts.push(p);
  }
  for (const y of [0.3, 0.6]) {
    const r = new THREE.BoxGeometry(length, 0.07, 0.04);
    r.translate(0, y, 0.04);
    parts.push(r);
  }
  return shadow(new THREE.Mesh(mergeGeometries(parts), std('#ffffff')));
}

// Coral for reefs
export function createCoral(spots, terrain) {
  const g = new THREE.Group();
  const rand = makeRandom(77);
  const colors = ['#ff7fa8', '#ffb36b', '#c9a8ff', '#7ff2e6', '#ffe27a', '#ff6b6b'];
  for (const s of spots) {
    const h = terrain.getHeight(s.x, s.z);
    const col = colors[Math.floor(rand() * colors.length)];
    const mat = new THREE.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: 0.25, roughness: 0.7 });
    const type = rand();
    const piece = new THREE.Group();
    if (type < 0.4) {
      // branching coral
      for (let i = 0; i < 6; i++) {
        const b = new THREE.Mesh(new THREE.CapsuleGeometry(0.06, 0.5 + rand() * 0.4, 3, 6), mat);
        b.position.y = 0.3;
        b.rotation.set((rand() - 0.5) * 1.2, 0, (rand() - 0.5) * 1.2);
        piece.add(b);
      }
    } else if (type < 0.7) {
      // brain coral
      const b = new THREE.Mesh(new THREE.SphereGeometry(0.4, 16, 12), mat);
      b.scale.y = 0.7;
      piece.add(b);
    } else {
      // fan coral
      const f = new THREE.Mesh(new THREE.CircleGeometry(0.5, 16, 0, Math.PI), new THREE.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: 0.3, side: THREE.DoubleSide, transparent: true, opacity: 0.85 }));
      f.position.y = 0.05;
      piece.add(f);
    }
    piece.position.set(s.x, h, s.z);
    piece.rotation.y = rand() * 6;
    piece.scale.setScalar(0.8 + rand() * 0.8);
    g.add(piece);
  }
  return g;
}
