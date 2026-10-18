// 3D pieces for Pinky's 2.5D Storybook: everything looks like it's made of
// paper, crayon and cardboard, with layers of scenery at different depths.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { rng, crayonPattern, paperCanvas } from './paint.js';
import { renderIntroDrawing } from '../scenes/intro.js';

export const S = 1 / 58; // 58 game pixels = 1 meter
export const GROUND_Y = 440;
export const toX = (x) => x * S;
export const toY = (y) => (GROUND_Y - y) * S;
export const DEPTH = 3.2; // how deep the play path is (z from -DEPTH/2 to +DEPTH/2)

const texCache = new Map();
function canvasTex(key, w, h, draw, repeat = null) {
  if (texCache.has(key)) return texCache.get(key);
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; }
  texCache.set(key, t);
  return t;
}

// crayon-colored texture (back-and-forth strokes on paper)
export function crayonTex(color, base = '#fbf4e6', key = '') {
  return canvasTex('crayon' + color + base + key, 256, 256, (g, w, h) => {
    g.drawImage(paperCanvas(256, base, 7), 0, 0);
    g.fillStyle = crayonPattern(g, color, { density: 6, alpha: 0.7, angle: -0.6, seed: color.length });
    g.fillRect(0, 0, w, h);
    g.fillStyle = crayonPattern(g, color, { density: 9, alpha: 0.35, angle: 0.5, seed: 9 });
    g.fillRect(0, 0, w, h);
  }, true);
}

function groundFrontTex() {
  return canvasTex('groundFront', 512, 256, (g, w, h) => {
    g.drawImage(paperCanvas(256, '#f3e2c4', 11), 0, 0, 256, 256);
    g.drawImage(paperCanvas(256, '#f3e2c4', 12), 256, 0, 256, 256);
    // soil colored in brown crayon, lighter near the top
    g.fillStyle = crayonPattern(g, '#a87650', { density: 7, alpha: 0.55, angle: -0.4, seed: 4 });
    g.fillRect(0, 40, w, h);
    // grass band with blades along the top edge
    g.fillStyle = crayonPattern(g, '#5fbf4a', { density: 5, alpha: 0.85, angle: 0.2, seed: 6 });
    g.fillRect(0, 0, w, 46);
    const r = rng(8);
    g.strokeStyle = '#3f9a3a'; g.lineCap = 'round'; g.lineWidth = 3;
    for (let x = 0; x < w; x += 7) {
      g.beginPath(); g.moveTo(x, 46); g.lineTo(x + (r() - 0.5) * 8, 46 + 10 + r() * 14); g.stroke();
    }
    // little pebbles and roots doodled in the soil
    for (let i = 0; i < 14; i++) {
      g.strokeStyle = 'rgba(90,60,40,0.6)'; g.lineWidth = 2;
      g.beginPath(); g.arc(r() * w, 90 + r() * 150, 4 + r() * 6, 0, Math.PI * 2); g.stroke();
    }
  }, true);
}

function grassTopTex() {
  return canvasTex('grassTop', 256, 256, (g, w, h) => {
    g.drawImage(paperCanvas(256, '#e9f7d8', 13), 0, 0);
    g.fillStyle = crayonPattern(g, '#6fcf5a', { density: 5, alpha: 0.8, angle: 0.9, seed: 3 });
    g.fillRect(0, 0, w, h);
    const r = rng(2);
    const cols = ['#ff8fb8', '#ffe27a', '#ffffff', '#b48aff'];
    for (let i = 0; i < 16; i++) {
      g.fillStyle = cols[i % 4];
      const x = r() * w, y = r() * h;
      for (let k = 0; k < 5; k++) { const a = (k / 5) * Math.PI * 2; g.beginPath(); g.arc(x + Math.cos(a) * 4, y + Math.sin(a) * 4, 3, 0, 7); g.fill(); }
      g.fillStyle = '#ffcf3a'; g.beginPath(); g.arc(x, y, 2, 0, 7); g.fill();
    }
  }, true);
}

function mat(opts) { return new THREE.MeshStandardMaterial({ roughness: 0.9, metalness: 0, ...opts }); }

function shadowed(m) { m.castShadow = true; m.receiveShadow = true; return m; }

// ---------------- Ground strips ----------------
export function makeGround(seg, bottomY = 760) {
  const w = (seg.x1 - seg.x0) * S;
  const h = (bottomY - seg.y) * S;
  const geo = new THREE.BoxGeometry(w, h, DEPTH, Math.max(1, Math.round(w)), 1, 1);
  // uv repeat by size so the textures don't stretch
  const uv = geo.attributes.uv;
  const n = geo.attributes.normal;
  for (let i = 0; i < uv.count; i++) {
    const nz = n.getZ(i), ny = n.getY(i);
    if (Math.abs(nz) > 0.5) uv.setXY(i, uv.getX(i) * w / 4, uv.getY(i) * h / 2);
    else if (ny > 0.5) uv.setXY(i, uv.getX(i) * w / 3, uv.getY(i) * DEPTH / 3);
  }
  const front = mat({ map: groundFrontTex() });
  const top = mat({ map: grassTopTex() });
  const side = mat({ map: groundFrontTex() });
  // box face order: +x, -x, +y, -y, +z, -z
  const m = shadowed(new THREE.Mesh(geo, [side, side, top, side, front, side]));
  m.position.set(toX((seg.x0 + seg.x1) / 2), toY(seg.y) - h / 2, 0);
  // soft grassy lip along the front edge
  const lip = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, w, 8, 1), mat({ color: '#6fcf5a' }));
  lip.rotation.z = Math.PI / 2;
  lip.position.set(0, h / 2 - 0.02, DEPTH / 2);
  m.add(lip);
  return m;
}

// ---------------- Blocks (giant everyday objects) ----------------
export function makeBlock(b) {
  const w = b.w * S, h = b.h * S;
  const cx = toX(b.x + b.w / 2), cy = toY(b.y + b.h / 2);
  const g = new THREE.Group();
  g.position.set(cx, cy, 0);
  if (b.kind === 'crayon') {
    // a giant crayon lying on its side across the path
    const r = h / 2;
    const bodyLen = w - r * 2.2;
    const body = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(r, r, bodyLen, 12), mat({ color: b.color, roughness: 0.55 })));
    body.rotation.z = Math.PI / 2;
    body.position.x = -r * 1.1;
    g.add(body);
    // paper wrapper with stripes and a label
    const wrapTex = canvasTex('wrapper', 512, 128, (x, W, H) => {
      x.fillStyle = '#c63b3b'; x.fillRect(0, 0, W, H);
      x.fillStyle = '#1a1a1a'; x.fillRect(0, 10, W, 8); x.fillRect(0, H - 18, W, 8);
      x.fillStyle = '#ffffff'; x.font = 'bold 54px "Chalkboard SE", "Comic Sans MS", sans-serif'; x.textAlign = 'center';
      x.fillText('RED', W * 0.25, 84); x.fillText('RED', W * 0.75, 84);
    });
    const wrap = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(r * 1.02, r * 1.02, bodyLen * 0.62, 24, 1, true), mat({ map: wrapTex, roughness: 0.8 })));
    wrap.rotation.z = Math.PI / 2;
    wrap.position.x = -r * 1.1;
    g.add(wrap);
    const tip = shadowed(new THREE.Mesh(new THREE.ConeGeometry(r, r * 2.2, 12), mat({ color: b.color, roughness: 0.5 })));
    tip.rotation.z = -Math.PI / 2;
    tip.position.x = bodyLen / 2 - r * 1.1 + r * 1.1;
    g.add(tip);
    g.userData.top = h / 2;
  } else if (b.kind === 'book') {
    const cover = mat({ color: b.color, roughness: 0.7 });
    const pages = mat({ map: canvasTex('pages', 64, 64, (x, W, H) => { x.fillStyle = '#fffaf0'; x.fillRect(0, 0, W, H); x.strokeStyle = '#e6dcc8'; for (let i = 2; i < H; i += 4) { x.beginPath(); x.moveTo(0, i); x.lineTo(W, i); x.stroke(); } }) });
    const book = shadowed(new THREE.Mesh(new THREE.BoxGeometry(w, h, DEPTH * 0.9), [pages, cover, cover, cover, pages, pages]));
    g.add(book);
    // a doodled title on the spine side facing us
    const spine = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.98, h * 0.98), mat({ map: canvasTex('spine' + b.color, 256, 64, (x, W, H) => {
      x.fillStyle = b.color; x.fillRect(0, 0, W, H);
      x.fillStyle = 'rgba(255,255,255,0.85)'; x.fillRect(0, 8, W, 6); x.fillRect(0, H - 14, W, 6);
      x.fillStyle = '#ffffff'; x.font = 'bold 30px "Chalkboard SE", "Comic Sans MS", sans-serif'; x.textAlign = 'center'; x.fillText('★ STORIES ★', W / 2, H / 2 + 10);
    }) }));
    spine.position.z = DEPTH * 0.45 + 0.01;
    g.add(spine);
  } else if (b.kind === 'button') {
    // a giant sewing button
    const btn = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(w / 2, w / 2, DEPTH * 0.6, 32), mat({ color: b.color, roughness: 0.35 })));
    btn.rotation.x = Math.PI / 2;
    btn.scale.y = 1;
    g.add(btn);
    for (const [dx, dy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      const hole = new THREE.Mesh(new THREE.CircleGeometry(w * 0.06, 16), mat({ color: '#4a6a8a' }));
      hole.position.set(dx * w * 0.13, dy * w * 0.13 - h * 0.05, DEPTH * 0.3 + 0.01);
      g.add(hole);
    }
    g.scale.y = h / w * 1.0;
  } else {
    // a soft paper-mache mound
    const m = shadowed(new THREE.Mesh(new THREE.CapsuleGeometry(h * 0.9, w - h * 1.8, 6, 16), mat({ map: crayonTex('#6fcf5a', '#e9f7d8') })));
    m.rotation.z = Math.PI / 2;
    m.scale.set(1, 1, DEPTH / (h * 1.8));
    m.position.y = -h * 0.35;
    g.add(m);
  }
  return g;
}

// ---------------- One-way platforms ----------------
export function makeOneway(o) {
  const w = o.w * S;
  const g = new THREE.Group();
  g.position.set(toX(o.x + o.w / 2), toY(o.y), 0);
  if (o.kind === 'branch') {
    const br = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.13, w, 8), mat({ color: '#8a5a3c' })));
    br.rotation.z = Math.PI / 2;
    br.position.y = -0.1;
    g.add(br);
    // a few leaves on the branch
    const leafMat = mat({ color: '#7cc96b', side: THREE.DoubleSide });
    for (let i = 0; i < 4; i++) {
      const leaf = shadowed(new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 6), leafMat));
      leaf.scale.set(1, 0.5, 0.7);
      leaf.position.set((i / 3 - 0.5) * w * 0.9, 0.02 + (i % 2) * 0.05, (i % 2 ? -1 : 1) * 0.3);
      g.add(leaf);
    }
  } else if (o.kind === 'lily') {
    const pad = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(w / 2, w / 2, 0.08, 24, 1, false, 0.3, Math.PI * 2 - 0.6), mat({ color: '#5fae55' })));
    pad.scale.z = 1.2;
    pad.position.y = -0.04;
    g.add(pad);
    const flower = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 8), mat({ color: '#ffd1e3', emissive: '#ff9ecb', emissiveIntensity: 0.3 }));
    flower.position.set(w * 0.25, 0.08, 0.2);
    g.add(flower);
  } else {
    // a thick wobbly crayon scribble line you can stand on
    const pts = [];
    const r = rng(o.x);
    for (let i = 0; i <= 10; i++) pts.push(new THREE.Vector3((i / 10 - 0.5) * w, -0.08 + (r() - 0.5) * 0.05, (r() - 0.5) * 0.4));
    const curve = new THREE.CatmullRomCurve3(pts);
    const tube = shadowed(new THREE.Mesh(new THREE.TubeGeometry(curve, 40, 0.09, 8), mat({ color: '#ff8fb8', roughness: 0.6 })));
    g.add(tube);
    const flat = new THREE.Mesh(new THREE.BoxGeometry(w, 0.1, DEPTH * 0.5), mat({ map: crayonTex('#ff8fb8', '#fff0f6'), transparent: true, opacity: 0.85 }));
    flat.position.y = -0.06;
    flat.receiveShadow = true;
    g.add(flat);
  }
  return g;
}

// ---------------- Moving platforms ----------------
export function makeMover(m) {
  const w = m.w * S;
  const g = new THREE.Group();
  if (m.kind === 'boat') {
    // a folded paper boat
    const paper = mat({ map: canvasTex('boatpaper', 128, 128, (x, W, H) => { x.drawImage(paperCanvas(128, '#ffffff', 5), 0, 0); x.strokeStyle = 'rgba(80,120,200,0.35)'; for (let i = 0; i < H; i += 12) { x.beginPath(); x.moveTo(0, i); x.lineTo(W, i); x.stroke(); } }), side: THREE.DoubleSide, roughness: 0.95 });
    const hullShape = new THREE.Shape();
    hullShape.moveTo(-w / 2 - 0.2, 0); hullShape.lineTo(w / 2 + 0.2, 0); hullShape.lineTo(w / 2 - 0.15, -0.45); hullShape.lineTo(-w / 2 + 0.15, -0.45); hullShape.lineTo(-w / 2 - 0.2, 0);
    const hull = shadowed(new THREE.Mesh(new THREE.ExtrudeGeometry(hullShape, { depth: 1.0, bevelEnabled: false }), paper));
    hull.position.z = -0.5;
    g.add(hull);
    const sailShape = new THREE.Shape();
    sailShape.moveTo(-w * 0.3, 0); sailShape.lineTo(0, 0.9); sailShape.lineTo(w * 0.3, 0); sailShape.lineTo(-w * 0.3, 0);
    const sail = shadowed(new THREE.Mesh(new THREE.ShapeGeometry(sailShape), paper));
    sail.position.z = -0.45;
    g.add(sail);
  } else {
    // a little cloud you can ride
    const cm = mat({ color: '#ffffff', emissive: '#ffe6f2', emissiveIntensity: 0.35, roughness: 1 });
    for (let i = 0; i < 6; i++) {
      const p = shadowed(new THREE.Mesh(new THREE.IcosahedronGeometry(0.32 + (i % 3) * 0.08, 2), cm));
      p.position.set((i / 5 - 0.5) * w * 0.9, -0.15 + (i % 2) * 0.08, ((i * 7) % 3 - 1) * 0.3);
      g.add(p);
    }
  }
  return g;
}

export function makeBouncy(b) {
  const w = b.w * S;
  const g = new THREE.Group();
  g.position.set(toX(b.x + b.w / 2), toY(b.y), 0);
  const cols = ['#ffffff', '#ffd1e3', '#ffe8f2'];
  for (let i = 0; i < 7; i++) {
    const p = shadowed(new THREE.Mesh(new THREE.SphereGeometry(0.28 + (i % 3) * 0.06, 16, 12), mat({ color: cols[i % 3], emissive: '#ffc4dc', emissiveIntensity: 0.25, roughness: 0.6 })));
    p.position.set((i / 6 - 0.5) * w * 0.85, -0.25 + Math.sin(i) * 0.06, ((i * 5) % 3 - 1) * 0.35);
    g.add(p);
  }
  return g;
}

export function makeWater(wt) {
  const w = (wt.x1 - wt.x0) * S;
  const g = new THREE.Group();
  g.position.set(toX((wt.x0 + wt.x1) / 2), toY(wt.y), 0);
  if (wt.dry) return g;
  const waterMat = new THREE.MeshStandardMaterial({ map: crayonTex('#4cc3ff', '#d8f2ff', 'w'), transparent: true, opacity: 0.85, roughness: 0.2, emissive: '#2a8ad0', emissiveIntensity: 0.15 });
  const surf = new THREE.Mesh(new THREE.BoxGeometry(w, 2.4, DEPTH, 40, 1, 1), waterMat);
  surf.position.y = -1.2;
  surf.receiveShadow = true;
  g.add(surf);
  g.userData.surf = surf;
  // wavy white crayon lines on the front
  for (let k = 0; k < 3; k++) {
    const pts = [];
    for (let i = 0; i <= 40; i++) pts.push(new THREE.Vector3((i / 40 - 0.5) * w, -0.25 - k * 0.5 + Math.sin(i * 0.9 + k) * 0.06, DEPTH / 2 + 0.02));
    const line = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 80, 0.025, 4), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.7 }));
    g.add(line);
  }
  return g;
}

export function makeThorns(hz) {
  const g = new THREE.Group();
  g.position.set(toX(hz.x + hz.w / 2), toY(hz.y + hz.h), 0);
  const w = hz.w * S;
  const m = mat({ color: '#6a3a8a', roughness: 0.6 });
  const r = rng(hz.x);
  for (let i = 0; i < 14; i++) {
    const c = shadowed(new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.35 + r() * 0.25, 5), m));
    c.position.set((r() - 0.5) * w, 0.18, (r() - 0.5) * DEPTH * 0.6);
    c.rotation.set((r() - 0.5) * 0.8, 0, (r() - 0.5) * 0.8);
    g.add(c);
  }
  // scribbly bush body
  const body = shadowed(new THREE.Mesh(new THREE.IcosahedronGeometry(w * 0.45, 1), mat({ color: '#8a5aaa', flatShading: true })));
  body.scale.set(1, 0.4, 0.8);
  body.position.y = 0.05;
  g.add(body);
  return g;
}

// A fluffy dust bunny
export function makeBunny() {
  const g = new THREE.Group();
  const geo = new THREE.IcosahedronGeometry(0.34, 3);
  const p = geo.attributes.position;
  const r = rng(3);
  for (let i = 0; i < p.count; i++) {
    const k = 1 + (r() - 0.5) * 0.35;
    p.setXYZ(i, p.getX(i) * k, p.getY(i) * k, p.getZ(i) * k);
  }
  geo.computeVertexNormals();
  const body = shadowed(new THREE.Mesh(geo, mat({ color: '#a9a3b8', roughness: 1, flatShading: true })));
  body.position.y = 0.32;
  g.add(body);
  const eyeMat = new THREE.MeshBasicMaterial({ color: '#2a2030' });
  const eyes = [];
  for (const s of [-1, 1]) {
    const e = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 6), eyeMat);
    e.position.set(s * 0.1, 0.38, 0.3);
    g.add(e);
    eyes.push(e);
  }
  // little ears
  for (const s of [-1, 1]) {
    const ear = shadowed(new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 6), mat({ color: '#b9b3c8' })));
    ear.scale.set(0.6, 1.4, 0.5);
    ear.position.set(s * 0.15, 0.66, 0);
    g.add(ear);
  }
  g.userData = { body, eyes };
  return g;
}

// A star sticker on a stick: the checkpoint
export function makeCheckpoint() {
  const g = new THREE.Group();
  const stick = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 1.5, 6), mat({ color: '#d9a066' })));
  stick.position.y = 0.75;
  g.add(stick);
  const s = new THREE.Shape();
  for (let i = 0; i < 10; i++) { const a = Math.PI / 2 + (i * Math.PI) / 5; const rr = i % 2 ? 0.14 : 0.32; const x = Math.cos(a) * rr, y = Math.sin(a) * rr; if (i === 0) s.moveTo(x, y); else s.lineTo(x, y); }
  const star = shadowed(new THREE.Mesh(new THREE.ExtrudeGeometry(s, { depth: 0.06, bevelEnabled: true, bevelSize: 0.03, bevelThickness: 0.03, bevelSegments: 2 }), mat({ color: '#c9c3d4', roughness: 0.4 })));
  star.position.set(0, 1.55, 0);
  g.add(star);
  g.userData.star = star;
  return g;
}

// The goal: a big heart sticker
export function makeGoal() {
  const g = new THREE.Group();
  const s = new THREE.Shape();
  s.moveTo(0, -0.55);
  s.bezierCurveTo(-0.8, 0, -0.5, 0.7, 0, 0.32);
  s.bezierCurveTo(0.5, 0.7, 0.8, 0, 0, -0.55);
  const heart = shadowed(new THREE.Mesh(new THREE.ExtrudeGeometry(s, { depth: 0.12, bevelEnabled: true, bevelSize: 0.05, bevelThickness: 0.05, bevelSegments: 3 }), mat({ color: '#ff6f9c', emissive: '#ff3f7a', emissiveIntensity: 0.4, roughness: 0.4 })));
  heart.position.y = 1.6;
  g.add(heart);
  const stick = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.2, 6), mat({ color: '#d9a066' })));
  stick.position.y = 0.6;
  g.add(stick);
  g.userData.heart = heart;
  return g;
}

// A torn scrap of paper with part of a drawing on it
export function scrapTexture(id) {
  return canvasTex('scrap' + id, 256, 256, (g, W, H) => {
    drawScrap(g, id, W, H, true);
  });
}

// ---------------- The drawing of Jacinta hugging Pinky ----------------
// One complete crayon picture. The three scraps Pinky finds are torn pieces of it,
// so at the end of the chapter they fit back together like a puzzle.
const PIC = 512;
let _picture = null;

function crayon(g, pts, color, width, seed = 1, alpha = 0.9) {
  const r = rng(seed);
  g.save();
  g.lineCap = 'round'; g.lineJoin = 'round'; g.strokeStyle = color;
  for (let pass = 0; pass < 3; pass++) {
    g.globalAlpha = alpha * (pass === 0 ? 0.85 : 0.45);
    g.lineWidth = width * (pass === 0 ? 1 : 0.6);
    g.beginPath();
    pts.forEach(([x, y], i) => { const jx = x + (r() - 0.5) * 2.2, jy = y + (r() - 0.5) * 2.2; if (i) g.lineTo(jx, jy); else g.moveTo(jx, jy); });
    g.stroke();
  }
  g.restore();
}
function ring(cx, cy, rx, ry, n = 36, turns = 1.05, start = 0) {
  const pts = [];
  for (let i = 0; i <= n * turns; i++) { const a = start + (i / n) * Math.PI * 2; pts.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]); }
  return pts;
}
// fill a path with color and a waxy crayon texture
function colorIn(g, pathFn, color, seed) {
  g.save();
  pathFn();
  g.clip();
  g.globalAlpha = 0.55;
  g.fillStyle = color;
  g.fillRect(0, 0, PIC, PIC);
  g.globalAlpha = 0.9;
  g.fillStyle = crayonPattern(g, color, { density: 5, alpha: 0.8, angle: -0.5 + (seed % 3) * 0.3, seed, size: 128 });
  g.fillRect(0, 0, PIC, PIC);
  g.restore();
}

function drawPicture() {
  if (_picture) return _picture;
  // Crop Jacinta and Pinky out of the very same crayon drawing shown in the intro
  const src = renderIntroDrawing();
  const c = document.createElement('canvas');
  c.width = c.height = PIC;
  const g = c.getContext('2d');
  g.drawImage(src, 470, 250, 640, 640, 0, 0, PIC, PIC);
  _picture = c;
  return c;
}

// the torn line between pieces (shared, so the pieces fit back together)
function tearLine(y0, seed, amp = 22) {
  const r = rng(seed);
  const pts = [];
  for (let x = 0; x <= PIC; x += 16) pts.push([x, y0 + (r() - 0.5) * amp + Math.sin(x * 0.05 + seed) * amp * 0.25]);
  return pts;
}
// tear "a" runs between her eyes and her smile; tear "b" runs below Pinky's smile
const TEARS = { a: tearLine(178, 5, 12), b: tearLine(330, 9, 18) };
const PIECES = { hair: [null, 'a'], smile: ['a', 'b'], hoodie: ['b', null] };

function piecePath(g, id) {
  const [top, bottom] = PIECES[id];
  g.beginPath();
  const T = top ? TEARS[top] : [[0, 0], [PIC, 0]];
  const B = bottom ? TEARS[bottom] : [[0, PIC], [PIC, PIC]];
  T.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
  for (let i = B.length - 1; i >= 0; i--) g.lineTo(B[i][0], B[i][1]);
  g.closePath();
}

function pieceBounds(id) {
  const [top, bottom] = PIECES[id];
  const y0 = top ? Math.min(...TEARS[top].map((p) => p[1])) : 0;
  const y1 = bottom ? Math.max(...TEARS[bottom].map((p) => p[1])) : PIC;
  return [y0, y1];
}

// Draw one torn scrap (centered in a W×H canvas)
export function drawScrap(g, id, W, H) {
  const pic = drawPicture();
  const [y0, y1] = pieceBounds(id);
  const ph = y1 - y0;
  const s = Math.min(W / PIC, H / ph) * 0.92;
  g.save();
  g.translate(W / 2 - (PIC * s) / 2, H / 2 - ((y0 + ph / 2) * s));
  g.scale(s, s);
  // paper shadow, then the piece
  g.save(); g.translate(4, 6); piecePath(g, id); g.fillStyle = 'rgba(60,30,60,0.25)'; g.fill(); g.restore();
  g.save(); piecePath(g, id); g.clip(); g.drawImage(pic, 0, 0); g.restore();
  piecePath(g, id); g.strokeStyle = 'rgba(200,180,160,0.9)'; g.lineWidth = 2; g.stroke();
  g.restore();
}

// The finished picture: pieces Pinky found are in place; missing ones are faint outlines
export function drawFinalPicture(g, W, H, found) {
  const pic = drawPicture();
  const s = Math.min(W, H) / PIC * 0.94;
  g.save();
  g.translate((W - PIC * s) / 2, (H - PIC * s) / 2);
  g.scale(s, s);
  for (const id of Object.keys(PIECES)) {
    if (found.includes(id)) {
      g.save(); piecePath(g, id); g.clip(); g.drawImage(pic, 0, 0); g.restore();
      piecePath(g, id); g.strokeStyle = 'rgba(200,180,160,0.7)'; g.lineWidth = 2; g.stroke();
    } else {
      g.save(); piecePath(g, id); g.fillStyle = 'rgba(255,255,255,0.35)'; g.fill();
      g.setLineDash([10, 8]); g.strokeStyle = 'rgba(255,255,255,0.9)'; g.lineWidth = 3; g.stroke(); g.restore();
    }
  }
  g.restore();
}

// ---------------- Background layers ----------------
// big paper-cutout hills, giant pencils, crayon flowers and a faraway house
export function makeBackdrop(level, rand) {
  const group = new THREE.Group();
  const width = level.width * S;
  const layers = [
    { z: -9, color: '#8fd47a', height: 3.5, rough: 1.2, base: -1 },
    { z: -18, color: '#b9a8e8', height: 6.5, rough: 2.0, base: -2 },
    { z: -34, color: '#9fb8f0', height: 11, rough: 3.5, base: -3 },
  ];
  for (const L of layers) {
    const shape = new THREE.Shape();
    const x0 = -20, x1 = width + 40;
    shape.moveTo(x0, L.base - 8);
    for (let x = x0; x <= x1; x += 2) {
      const y = L.base + L.height * (0.5 + 0.5 * Math.sin(x * 0.08 + L.z) * Math.cos(x * 0.031 - L.z * 0.3)) + Math.sin(x * 0.4) * 0.15 * L.rough;
      shape.lineTo(x, y);
    }
    shape.lineTo(x1, L.base - 8);
    const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.3, bevelEnabled: false });
    const m = new THREE.Mesh(geo, mat({ map: crayonTex(L.color, '#fbf4e6', 'hill' + L.z), roughness: 1 }));
    m.material.map.repeat.set(0.12, 0.12);
    m.position.z = L.z;
    m.receiveShadow = true;
    group.add(m);
  }
  // crayon flowers and pencil "trees" in the middle distance
  const flowerCols = ['#ff8fb8', '#ffe27a', '#b48aff', '#ff9a3c', '#7ec8ff'];
  for (let x = -5; x < width + 10; x += 2.2 + rand() * 2.5) {
    const z = -3.5 - rand() * 4;
    const y = 0;
    if (rand() < 0.35) {
      // a giant colored pencil standing up like a tree
      const col = flowerCols[Math.floor(rand() * flowerCols.length)];
      const h = 3 + rand() * 3;
      const pencil = new THREE.Group();
      const body = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, h, 6), mat({ color: col, roughness: 0.6 })));
      body.position.y = h / 2;
      pencil.add(body);
      const wood = shadowed(new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.6, 6), mat({ color: '#f2c88f' })));
      wood.position.y = h + 0.3;
      pencil.add(wood);
      const lead = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.2, 6), mat({ color: col }));
      lead.position.y = h + 0.55;
      pencil.add(lead);
      pencil.position.set(x, y - 0.4, z);
      pencil.rotation.z = (rand() - 0.5) * 0.25;
      group.add(pencil);
    } else {
      // a big crayon-drawn flower
      const col = flowerCols[Math.floor(rand() * flowerCols.length)];
      const h = 1 + rand() * 1.8;
      const f = new THREE.Group();
      const stem = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, h, 5), mat({ color: '#4c9a43' })));
      stem.position.y = h / 2;
      f.add(stem);
      const petalMat = mat({ color: col, emissive: col, emissiveIntensity: 0.1 });
      for (let i = 0; i < 6; i++) {
        const p = shadowed(new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 8), petalMat));
        const a = (i / 6) * Math.PI * 2;
        p.scale.set(1, 0.6, 0.35);
        p.position.set(Math.cos(a) * 0.24, h + Math.sin(a) * 0.24, 0);
        f.add(p);
      }
      const center = new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 8), mat({ color: '#ffcf3a' }));
      center.position.y = h;
      center.scale.z = 0.5;
      f.add(center);
      f.position.set(x, y - 0.3, z);
      group.add(f);
    }
  }
  // a faraway house with a warm, glowing window (Pinky's goal)
  const house = new THREE.Group();
  const walls = new THREE.Mesh(new THREE.BoxGeometry(9, 7, 6), mat({ color: '#ffd6e6' }));
  walls.position.y = 3.5;
  house.add(walls);
  const roof = new THREE.Mesh(new THREE.ConeGeometry(7.2, 4.5, 4), mat({ color: '#e0609a' }));
  roof.rotation.y = Math.PI / 4;
  roof.position.y = 9.2;
  house.add(roof);
  const win = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 2.4), new THREE.MeshStandardMaterial({ color: '#fff0b0', emissive: '#ffcf6a', emissiveIntensity: 2.2 }));
  win.position.set(-1.8, 4.2, 3.01);
  house.add(win);
  const win2 = win.clone();
  win2.position.x = 1.8;
  house.add(win2);
  const light = new THREE.PointLight('#ffcf6a', 30, 30);
  light.position.set(0, 4, 5);
  house.add(light);
  house.position.set(width + 14, -2, -40);
  house.scale.setScalar(1.3);
  group.add(house);
  group.userData.house = house;
  return group;
}

// sky dome that changes from night to dawn as Pinky travels
export function makeSky() {
  const uniforms = {
    uTop: { value: new THREE.Color('#1b2a6b') },
    uBottom: { value: new THREE.Color('#6a5aa8') },
    uStars: { value: 1 },
    uTime: { value: 0 },
  };
  const m = new THREE.Mesh(new THREE.SphereGeometry(400, 32, 16), new THREE.ShaderMaterial({
    uniforms, side: THREE.BackSide, depthWrite: false,
    vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: /* glsl */ `
      uniform vec3 uTop; uniform vec3 uBottom; uniform float uStars; uniform float uTime; varying vec3 vP;
      float hash(vec3 p){ p = fract(p*0.3183099+0.1); p *= 17.0; return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }
      void main(){
        float h = clamp(vP.y*1.4+0.2, 0.0, 1.0);
        vec3 c = mix(uBottom, uTop, h);
        vec3 q = vP*160.0; vec3 cell = floor(q); float r = hash(cell);
        if (r > 0.986 && vP.y > 0.0) {
          float d = length(q - cell - 0.5);
          c += vec3(1.0,0.95,0.8) * smoothstep(0.4, 0.0, d) * (0.6+0.4*sin(uTime*2.0+r*50.0)) * uStars;
        }
        gl_FragColor = vec4(c, 1.0);
      }`,
  }));
  m.userData.uniforms = uniforms;
  return m;
}
