// Chapter 2 pieces for Pinky's Storybook: a garden, then the big house seen from
// a pillow's height — flower pots, kitchen counters, sofas, shelves and toys.
// Also the layered parallax scenery and the torn name-tag scraps.
import * as THREE from 'three';
import { rng, crayonPattern, paperCanvas } from './paint.js';

const S = 1 / 58, G = 440, DEPTH = 3.2;
const toX = (x) => x * S;
const toY = (y) => (G - y) * S;

const texCache = new Map();
function tex(key, w, h, draw, repeat = false) {
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
function mat(o) { return new THREE.MeshStandardMaterial({ roughness: 0.85, metalness: 0, ...o }); }
function sh(m) { m.castShadow = true; m.receiveShadow = true; return m; }
function crayonFill(key, color, base = '#fbf4e6') {
  return tex('hc' + key + color + base, 256, 256, (g, w, h) => {
    g.drawImage(paperCanvas(256, base, key.length + 3), 0, 0);
    g.fillStyle = crayonPattern(g, color, { density: 6, alpha: 0.75, angle: -0.5, seed: color.length });
    g.fillRect(0, 0, w, h);
  }, true);
}
function woodTex() {
  return tex('hwood', 512, 256, (g, w, h) => {
    const r = rng(4);
    for (let i = 0; i < 6; i++) {
      g.fillStyle = `hsl(${28 + r() * 6}, 48%, ${56 + r() * 10}%)`;
      g.fillRect(0, i * (h / 6), w, h / 6);
      g.strokeStyle = 'rgba(90,50,20,0.12)'; g.lineWidth = 1.5;
      for (let k = 0; k < 5; k++) { const y = i * (h / 6) + 5 + r() * (h / 6 - 10); g.beginPath(); g.moveTo(0, y); g.bezierCurveTo(w * 0.3, y + 4, w * 0.6, y - 4, w, y); g.stroke(); }
      g.fillStyle = 'rgba(70,40,20,0.35)'; g.fillRect(0, i * (h / 6), w, 2);
      for (let k = 0; k < 3; k++) g.fillRect(r() * w, i * (h / 6), 2, h / 6);
    }
  }, true);
}

function brickTex() {
  return tex('hbrick', 256, 256, (x, W, H) => { x.fillStyle = '#f1d9c8'; x.fillRect(0, 0, W, H); for (let r = 0; r < 8; r++) for (let c = -1; c < 4; c++) { x.fillStyle = ['#d9845a', '#e0916a', '#cf7a50'][(r + c + 3) % 3]; x.fillRect(c * 64 + (r % 2) * 32 + 3, r * 32 + 3, 58, 26); } }, true);
}

// ---------------------------------------------------------------- ground
export function houseGround(seg, bottomY = 760) {
  const w = (seg.x1 - seg.x0) * S, h = (bottomY - seg.y) * S;
  const geo = new THREE.BoxGeometry(w, h, DEPTH);
  const uv = geo.attributes.uv, n = geo.attributes.normal;
  for (let i = 0; i < uv.count; i++) {
    if (Math.abs(n.getZ(i)) > 0.5) uv.setXY(i, uv.getX(i) * w / 3, uv.getY(i) * h / 1.5);
    else if (n.getY(i) > 0.5) uv.setXY(i, uv.getX(i) * w / 3, uv.getY(i) * DEPTH / 3);
  }
  let top, front;
  if (seg.kind === 'tile') {
    top = mat({ map: tex('htile', 256, 256, (g, W, H) => { for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { g.fillStyle = (i + j) % 2 ? '#f7f3ea' : '#cde9dc'; g.fillRect(i * 64, j * 64, 64, 64); } g.strokeStyle = '#ffffff'; g.lineWidth = 4; for (let i = 0; i <= 4; i++) { g.beginPath(); g.moveTo(i * 64, 0); g.lineTo(i * 64, H); g.stroke(); g.beginPath(); g.moveTo(0, i * 64); g.lineTo(W, i * 64); g.stroke(); } }, true), roughness: 0.4 });
  } else top = mat({ map: woodTex(), roughness: 0.6 });
  front = mat({ map: tex('hfloorfront', 256, 256, (g, W, H) => { g.fillStyle = '#8a5a3c'; g.fillRect(0, 0, W, H); g.fillStyle = '#ffffff'; g.fillRect(0, 0, W, 26); g.fillStyle = 'rgba(0,0,0,0.12)'; g.fillRect(0, 26, W, 4); }, true) });
  const m = sh(new THREE.Mesh(geo, [front, front, top, front, front, front]));
  m.position.set(toX((seg.x0 + seg.x1) / 2), toY(seg.y) - h / 2, 0);
  return m;
}

// ---------------------------------------------------------------- solid blocks
const BLOCKS = {
  // a terracotta flower pot with a flower in it
  pot(b, w, h, g) {
    const pot = sh(new THREE.Mesh(new THREE.CylinderGeometry(w * 0.5, w * 0.4, h * 0.9, 24), mat({ map: crayonFill('pot', '#d9774a', '#f6d2b8') })));
    pot.position.y = -h * 0.05; g.add(pot);
    const rim = sh(new THREE.Mesh(new THREE.CylinderGeometry(w * 0.53, w * 0.53, h * 0.18, 24), mat({ color: '#c8653c' })));
    rim.position.y = h * 0.4; g.add(rim);
    const soil = new THREE.Mesh(new THREE.CircleGeometry(w * 0.48, 24), mat({ color: '#6a4a30' }));
    soil.rotation.x = -Math.PI / 2; soil.position.y = h * 0.5; g.add(soil);
    const col = b.color || '#ff8fb8';
    const stem = sh(new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.04, 1.2, 6), mat({ color: '#4c9a43' })));
    stem.position.set(-w * 0.25, h * 0.5 + 0.6, -0.5); g.add(stem);
    for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; const p = sh(new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), mat({ color: col }))); p.scale.set(1, 0.6, 0.4); p.position.set(-w * 0.25 + Math.cos(a) * 0.2, h * 0.5 + 1.2 + Math.sin(a) * 0.2, -0.5); g.add(p); }
  },
  // a wooden garden crate
  crate(b, w, h, g) {
    const wood = mat({ map: woodTex() });
    g.add(sh(new THREE.Mesh(new THREE.BoxGeometry(w, h, DEPTH * 0.8), wood)));
    for (const y of [-h * 0.3, h * 0.3]) { const slat = sh(new THREE.Mesh(new THREE.BoxGeometry(w * 1.01, h * 0.12, DEPTH * 0.82), mat({ color: '#a8703f' }))); slat.position.y = y; g.add(slat); }
  },
  // the brick wall of the house, under the open window
  wall(b, w, h, g) {
    const bricks = mat({ map: brickTex() });
    const geo = new THREE.BoxGeometry(w, h, DEPTH + 0.4);
    const uv = geo.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * w / 1.5, uv.getY(i) * h / 1.5);
    g.add(sh(new THREE.Mesh(geo, bricks)));
    const sill = sh(new THREE.Mesh(new THREE.BoxGeometry(w + 0.3, 0.14, DEPTH + 0.8), mat({ color: '#ffffff' })));
    sill.position.y = h / 2 + 0.07; g.add(sill);
  },
  // a kitchen counter: cupboards below, a countertop above
  counter(b, w, h, g) {
    const top = sh(new THREE.Mesh(new THREE.BoxGeometry(w + 0.2, 0.22, DEPTH + 0.3), mat({ color: '#e9d8c4', roughness: 0.4 })));
    top.position.y = h / 2 - 0.11; g.add(top);
    const body = sh(new THREE.Mesh(new THREE.BoxGeometry(w, h - 0.22, DEPTH), mat({ color: '#ffffff' })));
    body.position.y = -0.11; g.add(body);
    const doors = Math.max(1, Math.round(w / 1.6));
    for (let i = 0; i < doors; i++) {
      const d = new THREE.Mesh(new THREE.PlaneGeometry(w / doors - 0.12, h - 0.6), mat({ color: '#e8f4fb' }));
      d.position.set(-w / 2 + (i + 0.5) * (w / doors), -0.2, DEPTH / 2 + 0.01); g.add(d);
      const knob = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 8), mat({ color: '#c0c6cc', metalness: 0.7, roughness: 0.3 }));
      knob.position.set(-w / 2 + (i + 0.5) * (w / doors) + (i % 2 ? -1 : 1) * (w / doors) * 0.35, 0.3, DEPTH / 2 + 0.06); g.add(knob);
    }
  },
  // a jar of cookies or sugar on the counter
  jar(b, w, h, g) {
    const glass = sh(new THREE.Mesh(new THREE.CylinderGeometry(w * 0.48, w * 0.48, h * 0.85, 20), mat({ color: '#cfeaff', roughness: 0.1, transparent: true, opacity: 0.6 })));
    glass.position.y = -h * 0.07; g.add(glass);
    const lid = sh(new THREE.Mesh(new THREE.CylinderGeometry(w * 0.5, w * 0.5, h * 0.15, 20), mat({ color: b.color || '#ff8fb8' })));
    lid.position.y = h * 0.42; g.add(lid);
    for (let i = 0; i < 5; i++) { const c = new THREE.Mesh(new THREE.CylinderGeometry(w * 0.28, w * 0.28, 0.06, 14), mat({ color: '#d9a05a' })); c.position.set((i % 2 - 0.5) * w * 0.2, -h * 0.35 + i * 0.12, 0); c.rotation.z = 0.3 * (i % 2 ? 1 : -1); g.add(c); }
  },
  stool(b, w, h, g) {
    const seat = sh(new THREE.Mesh(new THREE.CylinderGeometry(w * 0.55, w * 0.55, 0.18, 24), mat({ color: b.color || '#9fd8ff' })));
    seat.position.y = h / 2 - 0.09; g.add(seat);
    for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { const l = sh(new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, h, 6), mat({ color: '#ffffff' }))); l.position.set(x * w * 0.35, 0, z * 0.5); l.rotation.set(z * 0.08, 0, -x * 0.08); g.add(l); }
  },
  // a big comfy sofa
  sofa(b, w, h, g) {
    const fab = mat({ map: crayonFill('sofa', '#7fb6e6', '#e6f2fb') });
    const seat = sh(new THREE.Mesh(new THREE.BoxGeometry(w, h * 0.7, DEPTH), fab)); seat.position.y = -h * 0.15; g.add(seat);
    const back = sh(new THREE.Mesh(new THREE.BoxGeometry(w, h * 1.4, 0.6), fab)); back.position.set(0, h * 0.45, -DEPTH / 2 - 0.1); g.add(back);
    for (const s of [-1, 1]) { const arm = sh(new THREE.Mesh(new THREE.CapsuleGeometry(0.35, DEPTH - 0.5, 4, 10), fab)); arm.rotation.x = Math.PI / 2; arm.position.set(s * (w / 2 - 0.1), h * 0.25, 0); g.add(arm); }
    for (let i = 0; i < 2; i++) { const c = sh(new THREE.Mesh(new THREE.BoxGeometry(w / 2 - 0.5, 0.25, DEPTH - 0.4), mat({ color: '#a9d0f2' }))); c.position.set((i - 0.5) * (w / 2 - 0.2), h / 2 - 0.12, 0); g.add(c); }
  },
  // wooden alphabet blocks
  toyblock(b, w, h, g) {
    const letters = 'ABCPNY';
    const n = Math.max(1, Math.round(h / w));
    for (let i = 0; i < n; i++) {
      const L = letters[(Math.round(b.x / 10) + i) % letters.length];
      const col = ['#e0457b', '#2f7de1', '#3f9a3a', '#ff9a3c', '#b48aff'][(Math.round(b.x / 7) + i) % 5];
      const face = mat({ map: tex('hblk' + L + col, 128, 128, (x, W, H) => { x.fillStyle = '#fff8ee'; x.fillRect(0, 0, W, H); x.strokeStyle = col; x.lineWidth = 10; x.strokeRect(6, 6, W - 12, H - 12); x.fillStyle = col; x.font = 'bold 84px "Chalkboard SE", "Comic Sans MS", sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(L, W / 2, H / 2 + 4); }) });
      const cube = sh(new THREE.Mesh(new THREE.BoxGeometry(w, h / n, Math.min(DEPTH, w * 1.4)), face));
      cube.position.y = -h / 2 + (i + 0.5) * (h / n);
      cube.rotation.y = (i % 2 ? 0.08 : -0.06);
      g.add(cube);
    }
  },
  // carpeted stairs
  stair(b, w, h, g) {
    g.add(sh(new THREE.Mesh(new THREE.BoxGeometry(w, h, DEPTH), mat({ map: woodTex() }))));
    const runner = sh(new THREE.Mesh(new THREE.BoxGeometry(w * 1.01, 0.06, DEPTH * 0.55), mat({ color: '#c0396a' })));
    runner.position.y = h / 2 + 0.02; g.add(runner);
  },
  // the upstairs floor
  floor(b, w, h, g) {
    const geo = new THREE.BoxGeometry(w, h, DEPTH);
    const uv = geo.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * w / 3, uv.getY(i) * h / 3);
    g.add(sh(new THREE.Mesh(geo, [mat({ color: '#f4ead8' }), mat({ color: '#f4ead8' }), mat({ map: woodTex() }), mat({ color: '#f4ead8' }), mat({ color: '#f4ead8' }), mat({ color: '#f4ead8' })])));
  },
  // the bed in Jacinta's room
  bed(b, w, h, g) {
    const frame = sh(new THREE.Mesh(new THREE.BoxGeometry(w, h * 0.5, DEPTH), mat({ color: '#f4e7da' }))); frame.position.y = -h * 0.25; g.add(frame);
    const quilt = sh(new THREE.Mesh(new THREE.BoxGeometry(w * 0.98, h * 0.5, DEPTH * 1.02), mat({ map: tex('hquilt', 128, 128, (x) => { x.fillStyle = '#ff9ec4'; x.fillRect(0, 0, 128, 128); x.fillStyle = '#ffd1e3'; for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) if ((i + j) % 2) x.fillRect(i * 32, j * 32, 32, 32); }, true) })));
    quilt.position.y = h * 0.25; g.add(quilt);
    const pillow = sh(new THREE.Mesh(new THREE.CapsuleGeometry(0.3, DEPTH * 0.5, 4, 10), mat({ color: '#ffffff' }))); pillow.rotation.x = Math.PI / 2; pillow.position.set(w / 2 - 0.6, h / 2 + 0.25, 0); g.add(pillow);
    const head = sh(new THREE.Mesh(new THREE.BoxGeometry(0.25, h * 2.2, DEPTH), mat({ color: '#f4e7da' }))); head.position.set(w / 2, h * 0.6, 0); g.add(head);
  },
};

export function houseBlock(b) {
  const f = BLOCKS[b.kind];
  if (!f) return null;
  const w = b.w * S, h = b.h * S;
  const g = new THREE.Group();
  g.position.set(toX(b.x + b.w / 2), toY(b.y + b.h / 2), 0);
  f(b, w, h, g);
  return g;
}

// ---------------------------------------------------------------- one-way platforms
const ONEWAYS = {
  leaf(o, w, g) {
    const s = new THREE.Shape();
    s.moveTo(-w / 2, 0); s.quadraticCurveTo(0, 0.5, w / 2, 0); s.quadraticCurveTo(0, -0.5, -w / 2, 0);
    const leaf = sh(new THREE.Mesh(new THREE.ShapeGeometry(s, 12), mat({ color: '#5fae55', side: THREE.DoubleSide })));
    leaf.rotation.x = -Math.PI / 2; leaf.scale.y = DEPTH / 0.9 * 0.6; leaf.position.y = -0.03; g.add(leaf);
    const vein = new THREE.Mesh(new THREE.BoxGeometry(w * 0.9, 0.02, 0.04), mat({ color: '#3f8a3a' })); vein.position.y = -0.01; g.add(vein);
    const stem = sh(new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 3, 6), mat({ color: '#4c9a43' }))); stem.position.set(-w / 2, -1.5, -0.6); g.add(stem);
  },
  rail(o, w, g) {
    const r = sh(new THREE.Mesh(new THREE.BoxGeometry(w, 0.16, 0.5), mat({ map: woodTex() }))); r.position.y = -0.08; g.add(r);
    for (let x = -w / 2 + 0.2; x < w / 2; x += 1.1) { const p = sh(new THREE.Mesh(new THREE.BoxGeometry(0.22, 2.4, 0.15), mat({ color: '#fff6ea' }))); p.position.set(x, -1.0, -0.4); g.add(p); const tip = sh(new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.3, 4), mat({ color: '#fff6ea' }))); tip.position.set(x, 0.35, -0.4); tip.rotation.y = Math.PI / 4; g.add(tip); }
  },
  flower(o, w, g) {
    // a giant sunflower head to stand on
    const head = sh(new THREE.Mesh(new THREE.CylinderGeometry(w * 0.35, w * 0.35, 0.16, 24), mat({ color: '#7a4a22' }))); head.position.y = -0.08; g.add(head);
    for (let i = 0; i < 14; i++) { const a = (i / 14) * Math.PI * 2; const p = sh(new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 6), mat({ color: '#ffd34d' }))); p.scale.set(1.4, 0.25, 0.6); p.position.set(Math.cos(a) * w * 0.48, -0.1, Math.sin(a) * w * 0.48); p.rotation.y = -a; g.add(p); }
    const stem = sh(new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 6, 8), mat({ color: '#4c9a43' }))); stem.position.set(0, -3.1, -0.3); g.add(stem);
  },
  shelf(o, w, g) {
    const board = sh(new THREE.Mesh(new THREE.BoxGeometry(w, 0.14, DEPTH * 0.7), mat({ map: woodTex() }))); board.position.set(0, -0.07, -0.4); g.add(board);
    for (const s of [-1, 1]) { const br = sh(new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.4, 0.4), mat({ color: '#d9d2c8' }))); br.position.set(s * (w / 2 - 0.3), -0.3, -1.4); g.add(br); }
    // a few little things on the shelf
    const r = rng(o.x);
    for (let i = 0; i < 4; i++) {
      const x = -w / 2 + 0.3 + r() * (w - 0.6);
      if (Math.abs(x) < 0.5) continue;
      const t = r() < 0.5 ? new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.5, 0.4), mat({ color: ['#e0457b', '#2f7de1', '#ffd34d', '#3f9a3a'][i % 4] })) : new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.1, 0.3, 10), mat({ color: '#ffffff' }));
      t.position.set(x, 0.2, -1.2); sh(t); g.add(t);
    }
  },
  sill(o, w, g) {
    const s = sh(new THREE.Mesh(new THREE.BoxGeometry(w, 0.16, DEPTH), mat({ color: '#ffffff' }))); s.position.y = -0.08; g.add(s);
  },
  tray(o, w, g) {
    const t = sh(new THREE.Mesh(new THREE.BoxGeometry(w, 0.1, DEPTH * 0.6), mat({ color: '#ff9ec4' }))); t.position.y = -0.05; g.add(t);
  },
};

export function houseOneway(o) {
  const f = ONEWAYS[o.kind];
  if (!f) return null;
  const g = new THREE.Group();
  g.position.set(toX(o.x + o.w / 2), toY(o.y), 0);
  f(o, o.w * S, g);
  return g;
}

// ---------------------------------------------------------------- movers and bouncers
export function houseMover(m) {
  const w = m.w * S;
  const g = new THREE.Group();
  if (m.kind === 'leafboat') {
    ONEWAYS.leaf({ x: m.x }, w, g);
    g.children.at(-1).visible = false; // no stem on a floating leaf
  } else if (m.kind === 'balloon') {
    const basket = sh(new THREE.Mesh(new THREE.CylinderGeometry(w * 0.45, w * 0.38, 0.4, 16), mat({ map: woodTex() }))); basket.position.y = -0.2; g.add(basket);
    const balloon = sh(new THREE.Mesh(new THREE.SphereGeometry(0.9, 24, 16), mat({ color: '#ff6fae', roughness: 0.3 }))); balloon.scale.y = 1.2; balloon.position.y = 2.6; g.add(balloon);
    for (const s of [-1, 1]) { const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 1.8, 4), mat({ color: '#ffffff' })); rope.position.set(s * w * 0.3, 0.9, 0); rope.rotation.z = -s * 0.2; g.add(rope); }
  } else if (m.kind === 'train') {
    const car = sh(new THREE.Mesh(new THREE.BoxGeometry(w, 0.5, 1.2), mat({ color: '#e0457b' }))); car.position.y = -0.3; g.add(car);
    for (const x of [-w / 3, w / 3]) for (const z of [-0.6, 0.6]) { const wh = sh(new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.1, 16), mat({ color: '#2f7de1' }))); wh.rotation.x = Math.PI / 2; wh.position.set(x, -0.6, z); g.add(wh); }
  } else return null;
  return g;
}

export function houseBouncy(b) {
  const w = b.w * S;
  const g = new THREE.Group();
  g.position.set(toX(b.x + b.w / 2), toY(b.y), 0);
  if (b.kind === 'mushroom') {
    const cap = sh(new THREE.Mesh(new THREE.SphereGeometry(w * 0.55, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), mat({ color: '#ff5a5a' }))); cap.scale.y = 0.6; cap.position.y = -0.35; g.add(cap);
    for (let i = 0; i < 7; i++) { const a = i * 2.3; const d = new THREE.Mesh(new THREE.CircleGeometry(0.1, 12), mat({ color: '#ffffff' })); d.position.set(Math.cos(a) * w * 0.3, -0.35 + 0.22 + Math.sin(i) * 0.05, Math.sin(a) * w * 0.3 + 0.1); d.lookAt(d.position.clone().multiplyScalar(2).setY(3)); g.add(d); }
    const stem = sh(new THREE.Mesh(new THREE.CylinderGeometry(w * 0.18, w * 0.22, 0.6, 12), mat({ color: '#fff3e0' }))); stem.position.y = -0.6; g.add(stem);
  } else if (b.kind === 'toaster') {
    g.position.z = -0.8; // sits toward the back of the counter so Pinky can walk past it
    const body = sh(new THREE.Mesh(new THREE.BoxGeometry(w, 0.75, 0.9), mat({ color: '#c8d3dc', metalness: 0.6, roughness: 0.25 }))); body.position.y = -0.42; g.add(body);
    for (const s of [-1, 1]) { const toast = sh(new THREE.Mesh(new THREE.BoxGeometry(w * 0.32, 0.4, 0.12), mat({ color: '#e0a860' }))); toast.position.set(s * w * 0.2, -0.08, 0); g.add(toast); }
  } else if (b.kind === 'cushion') {
    const c = sh(new THREE.Mesh(new THREE.CapsuleGeometry(0.22, w - 0.5, 6, 12), mat({ color: '#ffb3cf' }))); c.rotation.z = Math.PI / 2; c.scale.set(1, 1, 2.6); c.position.y = -0.2; g.add(c);
  } else if (b.kind === 'sponge') {
    const s = sh(new THREE.Mesh(new THREE.BoxGeometry(w, 0.4, 0.8), mat({ color: '#ffe27a' }))); s.position.y = -0.2; g.add(s);
    const sc = sh(new THREE.Mesh(new THREE.BoxGeometry(w, 0.1, 0.8), mat({ color: '#3f9a3a' }))); sc.position.y = -0.03; g.add(sc);
  } else return null;
  return g;
}

// toy bricks on the floor (ouch!) and prickly thistles in the garden
export function houseHazard(hz) {
  if (hz.kind !== 'toybricks' && hz.kind !== 'thistle') return null;
  const g = new THREE.Group();
  g.position.set(toX(hz.x + hz.w / 2), toY(hz.y + hz.h), 0);
  const w = hz.w * S;
  const r = rng(hz.x);
  if (hz.kind === 'toybricks') {
    for (let i = 0; i < 7; i++) {
      const col = ['#e0457b', '#ffd34d', '#2f7de1', '#3f9a3a'][i % 4];
      const b = sh(new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.16, 0.2), mat({ color: col, roughness: 0.3 })));
      b.position.set((r() - 0.5) * w, 0.08 + (i > 4 ? 0.16 : 0), (r() - 0.5) * DEPTH * 0.5); b.rotation.y = r() * 3; g.add(b);
      for (const sx of [-0.08, 0.08]) { const stud = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.05, 10), b.material); stud.position.set(sx, 0.1, 0); b.add(stud); }
    }
  } else {
    for (let i = 0; i < 5; i++) {
      const st = sh(new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.5, 5), mat({ color: '#4c9a43' }))); const x = (r() - 0.5) * w, z = (r() - 0.5) * 1.2; st.position.set(x, 0.25, z); g.add(st);
      const head = sh(new THREE.Mesh(new THREE.IcosahedronGeometry(0.14, 0), mat({ color: '#b48aff', flatShading: true }))); head.position.set(x, 0.55, z); g.add(head);
      for (let k = 0; k < 6; k++) { const sp = new THREE.Mesh(new THREE.ConeGeometry(0.02, 0.12, 4), mat({ color: '#6a3a8a' })); const a = k * 1.05; sp.position.set(x + Math.cos(a) * 0.14, 0.55, z + Math.sin(a) * 0.14); sp.rotation.z = -Math.cos(a) * 1.5; sp.rotation.x = Math.sin(a) * 1.5; g.add(sp); }
    }
  }
  return g;
}

// a friendly garden snail (bounce on its shell!)
export function makeSnail() {
  const g = new THREE.Group();
  const body = sh(new THREE.Mesh(new THREE.CapsuleGeometry(0.12, 0.55, 4, 10), mat({ color: '#d9c49a' })));
  body.rotation.z = Math.PI / 2; body.position.y = 0.12; g.add(body);
  const shell = sh(new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.13, 10, 20), mat({ color: '#c97a4a' })));
  shell.position.set(-0.05, 0.38, 0); g.add(shell);
  const core = sh(new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 10), mat({ color: '#e0a060' }))); core.scale.z = 0.6; core.position.set(-0.05, 0.38, 0); g.add(core);
  for (const s of [-1, 1]) {
    const st = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.22, 5), mat({ color: '#d9c49a' })); st.position.set(0.3, 0.32, s * 0.05); st.rotation.z = -0.4; g.add(st);
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), mat({ color: '#2a2030' })); eye.position.set(0.35, 0.43, s * 0.05); g.add(eye);
  }
  g.userData = { body, eyes: [] };
  return g;
}

// ---------------------------------------------------------------- backdrop
// Outdoors: hills, a picket fence, sunflowers and the house wall. Indoors: kitchen
// tiles, living-room wallpaper and Jacinta's starry bedroom wall, with windows,
// pictures and a clock — all a little further back than the play path.
export function makeHouseBackdrop(level, rand) {
  const group = new THREE.Group();
  const inX = toX(level.indoorX);
  // outdoor hills
  for (const L of [{ z: -10, color: '#8fd47a', height: 3.0, base: -1 }, { z: -22, color: '#b9e3a8', height: 6, base: -2 }, { z: -40, color: '#9fc8f0', height: 10, base: -3 }]) {
    const shape = new THREE.Shape();
    const x0 = -20, x1 = inX + 30;
    shape.moveTo(x0, L.base - 8);
    for (let x = x0; x <= x1; x += 2) shape.lineTo(x, L.base + L.height * (0.5 + 0.5 * Math.sin(x * 0.07 + L.z) * Math.cos(x * 0.029 - L.z * 0.3)));
    shape.lineTo(x1, L.base - 8);
    const m = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: 0.3, bevelEnabled: false }), mat({ map: crayonFill('hill' + L.z, L.color, '#fbf4e6'), roughness: 1 }));
    m.material.map.repeat.set(0.12, 0.12);
    m.position.z = L.z; m.receiveShadow = true;
    group.add(m);
  }
  // picket fence and big flowers along the garden
  for (let x = -2; x < inX - 2; x += 0.9) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.35, 2.2, 0.12), mat({ color: '#fff6ea' }));
    post.position.set(x, 1.1, -4.6); group.add(post);
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.25, 0.35, 4), mat({ color: '#fff6ea' })); tip.rotation.y = Math.PI / 4; tip.position.set(x, 2.35, -4.6); group.add(tip);
  }
  for (const y of [0.6, 1.6]) { const rail = new THREE.Mesh(new THREE.BoxGeometry(inX + 2, 0.14, 0.1), mat({ color: '#fff6ea' })); rail.position.set(inX / 2 - 2, y, -4.7); group.add(rail); }
  for (let x = 1; x < inX - 3; x += 3 + rand() * 4) {
    const h = 3 + rand() * 2.5, z = -3.2 - rand() * 0.8;
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, h, 6), mat({ color: '#4c9a43' })); stem.position.set(x, h / 2, z); group.add(stem);
    const head = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.12, 16), mat({ color: '#7a4a22' })); head.rotation.x = Math.PI / 2 - 0.2; head.position.set(x, h, z + 0.05); group.add(head);
    for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; const p = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), mat({ color: rand() < 0.5 ? '#ffd34d' : '#ffbf3a' })); p.scale.set(1.4, 0.5, 0.25); p.position.set(x + Math.cos(a) * 0.48, h + Math.sin(a) * 0.48, z + 0.12); p.rotation.z = a; group.add(p); }
  }
  // the house: outside wall above the window, then the inside walls
  const wallTex = (key, base, dot, kind) => tex('hwp' + key, 256, 256, (x, W, H) => {
    x.fillStyle = base; x.fillRect(0, 0, W, H); x.fillStyle = dot;
    for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) {
      const cx = c * 64 + (r % 2 ? 32 : 0) + 16, cy = r * 64 + 24;
      if (kind === 'tile') { x.fillStyle = (r + c) % 2 ? base : dot; x.fillRect(c * 64, r * 64, 62, 62); }
      else if (kind === 'stars') { x.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i * Math.PI) / 5; const rr = i % 2 ? 4 : 10; x.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); } x.fill(); }
      else if (kind === 'stripes') { x.fillRect(c * 64, 0, 14, H); }
    }
  }, true);
  const zones = level.rooms;
  for (const z of zones) {
    const w = toX(z.x1 - z.x0), h = 14;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat({ map: wallTex(z.key, z.base, z.dot, z.kind), roughness: 0.95 }));
    m.material.map = m.material.map.clone(); m.material.map.needsUpdate = true;
    m.material.map.repeat.set(w / 3, h / 3);
    m.position.set(toX((z.x0 + z.x1) / 2), h / 2 - 1.5 + (z.y0 ? toY(z.y0) : 0), -2.2);
    m.receiveShadow = true;
    group.add(m);
    // skirting board
    const sk = new THREE.Mesh(new THREE.BoxGeometry(w, 0.3, 0.1), mat({ color: '#ffffff' })); sk.position.set(m.position.x, (z.y0 ? toY(z.y0) : 0) + 0.15, -2.1); group.add(sk);
    // windows, pictures and things on the walls
    for (const d of z.decor || []) {
      const dx = toX(d.x), dy = (z.y0 ? toY(z.y0) : 0) + (d.y ?? 3);
      if (d.type === 'window') {
        const sky = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 2.0), new THREE.MeshBasicMaterial({ map: tex('hwin' + (d.view || 'day'), 128, 128, (x, W, H) => { const gr = x.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, '#8fd0ff'); gr.addColorStop(1, '#d8f2ff'); x.fillStyle = gr; x.fillRect(0, 0, W, H); x.fillStyle = '#8fd47a'; x.beginPath(); x.moveTo(0, H); x.quadraticCurveTo(W * 0.4, H * 0.6, W, H * 0.75); x.lineTo(W, H); x.fill(); if (d.view === 'park') { x.fillStyle = '#ff9ec6'; x.beginPath(); x.arc(W * 0.7, H * 0.55, 16, 0, 7); x.fill(); x.fillStyle = '#7a4a2a'; x.fillRect(W * 0.69, H * 0.6, 4, 20); x.strokeStyle = '#ff9a3c'; x.lineWidth = 3; x.beginPath(); x.moveTo(W * 0.2, H * 0.85); x.lineTo(W * 0.28, H * 0.62); x.lineTo(W * 0.36, H * 0.85); x.stroke(); } x.fillStyle = '#ffffff'; x.beginPath(); x.arc(W * 0.3, H * 0.25, 10, 0, 7); x.arc(W * 0.38, H * 0.22, 12, 0, 7); x.fill(); }) }));
        sky.position.set(dx, dy, -2.15); group.add(sky);
        for (const [w2, h2, ox, oy] of [[2.6, 0.12, 0, 1.0], [2.6, 0.12, 0, -1.0], [0.12, 2.1, -1.25, 0], [0.12, 2.1, 1.25, 0], [0.06, 2.0, 0, 0]]) { const f = new THREE.Mesh(new THREE.BoxGeometry(w2, h2, 0.1), mat({ color: '#ffffff' })); f.position.set(dx + ox, dy + oy, -2.1); group.add(f); }
        for (const s of [-1, 1]) { const c = new THREE.Mesh(new THREE.BoxGeometry(0.5, 2.6, 0.08), mat({ color: d.curtain || '#ffb3cf' })); c.position.set(dx + s * 1.5, dy + 0.1, -2.05); group.add(c); }
      } else if (d.type === 'picture') {
        const f = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.1, 0.08), mat({ color: '#d9a441' })); f.position.set(dx, dy, -2.12); group.add(f);
        const p = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 0.9), mat({ map: tex('hpic' + d.x, 128, 96, (x, W, H) => { x.fillStyle = d.bg || '#ffe9c4'; x.fillRect(0, 0, W, H); x.fillStyle = '#ff9ec4'; x.fillRect(W * 0.2, H * 0.35, W * 0.2, H * 0.5); x.fillStyle = '#3a2316'; x.beginPath(); x.arc(W * 0.6, H * 0.4, 12, 0, 7); x.fill(); x.fillStyle = '#f1cfb8'; x.beginPath(); x.arc(W * 0.6, H * 0.42, 8, 0, 7); x.fill(); x.fillStyle = '#ffd3de'; x.fillRect(W * 0.72, H * 0.45, 12, 18); }) }));
        p.position.set(dx, dy, -2.07); group.add(p);
      } else if (d.type === 'clock') {
        const c = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 0.1, 32), mat({ color: '#ffffff' })); c.rotation.x = Math.PI / 2; c.position.set(dx, dy, -2.1); group.add(c);
        const rim = new THREE.Mesh(new THREE.TorusGeometry(0.6, 0.06, 8, 32), mat({ color: '#ff8fb8' })); rim.position.set(dx, dy, -2.05); group.add(rim);
        for (const [l, a] of [[0.35, 0.5], [0.48, 2.2]]) { const hnd = new THREE.Mesh(new THREE.BoxGeometry(0.05, l, 0.02), mat({ color: '#333' })); hnd.geometry.translate(0, l / 2, 0); hnd.rotation.z = -a; hnd.position.set(dx, dy, -2.03); group.add(hnd); }
      } else if (d.type === 'drawing') {
        const p = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.9), mat({ map: tex('hdraw' + d.x, 128, 96, (x, W, H) => { x.fillStyle = '#fffaf0'; x.fillRect(0, 0, W, H); x.strokeStyle = d.color || '#2f7de1'; x.lineWidth = 3; x.beginPath(); x.arc(W * 0.3, H * 0.35, 12, 0, 7); x.moveTo(W * 0.3, H * 0.47); x.lineTo(W * 0.3, H * 0.8); x.moveTo(W * 0.15, H * 0.6); x.lineTo(W * 0.45, H * 0.6); x.stroke(); x.fillStyle = '#ffd3de'; x.fillRect(W * 0.6, H * 0.4, 18, 26); x.fillStyle = '#3366cc'; x.fillRect(W * 0.64, H * 0.47, 3, 4); x.fillRect(W * 0.7, H * 0.47, 3, 4); x.fillStyle = '#ffd34d'; x.beginPath(); x.arc(W * 0.85, H * 0.15, 9, 0, 7); x.fill(); }) }));
        p.position.set(dx, dy, -2.1); p.rotation.z = (d.x % 7) * 0.02 - 0.06; group.add(p);
      } else if (d.type === 'door') {
        const dr = new THREE.Mesh(new THREE.BoxGeometry(2.0, 4.2, 0.12), mat({ color: d.color || '#7a4a8a' })); dr.position.set(dx, (z.y0 ? toY(z.y0) : 0) + 2.1, -2.1); group.add(dr);
        const kn = new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 8), mat({ color: '#ffd34d', metalness: 0.7 })); kn.position.set(dx + 0.7, (z.y0 ? toY(z.y0) : 0) + 2.0, -2.0); group.add(kn);
        group.userData.nameDoor = { x: dx, y: (z.y0 ? toY(z.y0) : 0) + 3.3 };
      } else if (d.type === 'bookcase') {
        // a tall bookcase standing behind the shelves you can climb
        const bw = toX(d.w), base = (z.y0 ? toY(z.y0) : 0), bh = d.h || 7;
        const wood = mat({ map: woodTex() });
        const back = new THREE.Mesh(new THREE.PlaneGeometry(bw, bh), mat({ color: '#e8cfa8' })); back.position.set(dx + bw / 2, base + bh / 2, -2.0); group.add(back);
        for (const sx of [0, bw]) { const side = sh(new THREE.Mesh(new THREE.BoxGeometry(0.25, bh, 2.2), wood)); side.position.set(dx + sx, base + bh / 2, -1.0); group.add(side); }
        const topB = sh(new THREE.Mesh(new THREE.BoxGeometry(bw + 0.5, 0.3, 2.4), wood)); topB.position.set(dx + bw / 2, base + bh, -1.0); group.add(topB);
        // rows of books along the back
        const r = rng(d.x);
        for (const sy of d.rows || []) {
          let bx = dx + 0.2;
          while (bx < dx + bw - 0.3) { const t = 0.12 + r() * 0.12, hh = 0.5 + r() * 0.35; const book = new THREE.Mesh(new THREE.BoxGeometry(t, hh, 0.6), mat({ color: ['#e0457b', '#2f7de1', '#ffd34d', '#3f9a3a', '#b48aff', '#ff9a3c'][Math.floor(r() * 6)] })); book.position.set(bx + t / 2, base + sy + hh / 2, -1.7); group.add(book); bx += t + 0.02; }
        }
      } else if (d.type === 'plant') {
        const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.28, 0.6, 16), mat({ color: '#e07a5a' })); pot.position.set(dx, (z.y0 ? toY(z.y0) : 0) + 0.3, -1.85); group.add(pot);
        for (let i = 0; i < 7; i++) { const l = new THREE.Mesh(new THREE.SphereGeometry(0.3, 10, 8), mat({ color: '#5fae55' })); l.scale.set(0.45, 1.5, 0.25); const a = (i / 7) * Math.PI * 2; l.position.set(dx + Math.cos(a) * 0.2, (z.y0 ? toY(z.y0) : 0) + 1.1, -1.85 + Math.sin(a) * 0.15); l.rotation.set(Math.sin(a) * 0.5, 0, -Math.cos(a) * 0.5); group.add(l); }
      }
    }
  }
  // a big window you climb through: frame around the opening above the brick wall
  const w0 = toX(level.window.x0), w1 = toX(level.window.x1), wy = toY(level.window.y);
  for (const [w2, h2, ox, oy] of [[w1 - w0 + 0.4, 0.3, (w0 + w1) / 2, wy + 3.4], [0.3, 3.4, w0, wy + 1.7], [0.3, 3.4, w1, wy + 1.7]]) {
    const f = sh(new THREE.Mesh(new THREE.BoxGeometry(w2, h2, DEPTH + 0.6), mat({ color: '#ffffff' })));
    f.position.set(ox, oy, 0); group.add(f);
  }
  // brick wall above the window up to the sky
  const upperGeo = new THREE.BoxGeometry(w1 - w0 + 0.4, 12, DEPTH + 0.4);
  { const uv = upperGeo.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * (w1 - w0) / 1.5, uv.getY(i) * 8); }
  const upper = sh(new THREE.Mesh(upperGeo, mat({ map: brickTex() })));
  upper.position.set((w0 + w1) / 2, wy + 3.55 + 6, 0); group.add(upper);
  // a cozy glow at the end: Jacinta's window shows the park
  group.userData.house = new THREE.Object3D();
  group.userData.house.position.set(toX(level.width) + 10, 0, -30);
  return group;
}

// ---------------------------------------------------------------- parallax
// Extra layers that slide at their own speed as the camera moves, so the world
// feels deep: far paper-cutout shapes, drifting clouds, and grass and flowers
// right in front of the camera.
export function makeParallax(level, rand) {
  const layers = [];
  const width = toX(level.width);
  const theme = level.theme || 'paper';
  // far cut-out silhouettes (follow the camera most → move slowest on screen)
  const far = new THREE.Group();
  const farCol = theme === 'house' ? '#b6c8ee' : '#7f75c9';
  for (let k = 0; k < 2; k++) {
    const shape = new THREE.Shape();
    const x0 = -60, x1 = width * 0.6 + 80;
    shape.moveTo(x0, -10);
    for (let x = x0; x <= x1; x += 3) {
      const peak = Math.abs(Math.sin(x * 0.05 + k * 2)) * (9 + k * 5) + Math.sin(x * 0.13) * 1.5;
      shape.lineTo(x, 2 + peak);
    }
    shape.lineTo(x1, -10);
    const m = new THREE.Mesh(new THREE.ShapeGeometry(shape), new THREE.MeshBasicMaterial({ color: new THREE.Color(farCol).offsetHSL(0, -0.1 * k, 0.08 * k), fog: false, transparent: true, opacity: 0.85 - k * 0.2 }));
    m.position.z = -80 - k * 30;
    far.add(m);
  }
  layers.push({ group: far, follow: 0.7 });
  // drifting paper clouds
  const clouds = new THREE.Group();
  const night = theme !== 'house';
  const cmat = new THREE.MeshStandardMaterial({ color: night ? '#d9cff5' : '#ffffff', emissive: night ? '#b9a8e8' : '#ffffff', emissiveIntensity: night ? 0.12 : 0.35, roughness: 1, transparent: true, opacity: night ? 0.7 : 0.92 });
  for (let i = 0; i < (night ? 11 : 16); i++) {
    const c = new THREE.Group();
    const n = 4 + Math.floor(rand() * 3);
    for (let k = 0; k < n; k++) { const p = new THREE.Mesh(new THREE.SphereGeometry(1 + rand() * 0.8, 14, 10), cmat); p.scale.z = 0.35; p.position.set(k * 1.3 - n * 0.6, Math.sin(k * 1.7) * 0.4, 0); c.add(p); }
    c.position.set(rand() * (width * 0.6 + 40) - 20, (night ? 11 : 8) + rand() * 7, -26 - rand() * 10);
    c.scale.setScalar(0.8 + rand() * 0.8);
    c.userData.drift = 0.2 + rand() * 0.4;
    clouds.add(c);
  }
  layers.push({ group: clouds, follow: 0.45, drift: true });
  // foreground grass, flowers (outdoors) and toys / books (indoors), close to the camera
  const fg = new THREE.Group();
  const grassMat = new THREE.MeshStandardMaterial({ color: '#4fae45', roughness: 0.9, side: THREE.DoubleSide });
  const cols = ['#ff8fb8', '#ffe27a', '#b48aff', '#ff9a3c', '#7ec8ff'];
  const onGround = (gx) => level.ground.some((s) => gx > s.x0 + 20 && gx < s.x1 - 20);
  for (let x = 0; x < width; x += 0.7 + rand() * 1.6) {
    const gx = x / S;
    if (!onGround(gx)) continue;
    const indoor = level.indoorX !== undefined && gx > level.indoorX;
    const z = 2.3 + rand() * 1.0;
    if (!indoor) {
      if (rand() < 0.7) {
        const tuft = new THREE.Group();
        for (let k = 0; k < 5; k++) { const b = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.5 + rand() * 0.5, 3), grassMat); b.position.set((rand() - 0.5) * 0.4, 0.2, (rand() - 0.5) * 0.2); b.rotation.z = (rand() - 0.5) * 0.6; tuft.add(b); }
        tuft.position.set(x, -0.15, z);
        fg.add(tuft);
      } else {
        const f = new THREE.Group();
        const h = 0.4 + rand() * 0.4;
        const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, h, 4), grassMat); stem.position.y = h / 2; f.add(stem);
        const col = cols[Math.floor(rand() * cols.length)];
        for (let k = 0; k < 5; k++) { const a = (k / 5) * Math.PI * 2; const p = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 6), new THREE.MeshStandardMaterial({ color: col })); p.scale.set(1, 0.6, 0.4); p.position.set(Math.cos(a) * 0.09, h + Math.sin(a) * 0.09, 0); f.add(p); }
        f.position.set(x, -0.2, z);
        fg.add(f);
      }
    } else if (rand() < 0.35) {
      // a stray crayon, a marble or a little book on the floor in front
      const r = rand();
      let o;
      if (r < 0.4) { o = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.6, 8), new THREE.MeshStandardMaterial({ color: cols[Math.floor(rand() * 5)] })); o.rotation.z = Math.PI / 2; o.rotation.y = rand() * 2; o.position.y = 0.06; }
      else if (r < 0.7) { o = new THREE.Mesh(new THREE.SphereGeometry(0.09, 12, 10), new THREE.MeshStandardMaterial({ color: cols[Math.floor(rand() * 5)], roughness: 0.1 })); o.position.y = 0.09; }
      else { o = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.1, 0.35), new THREE.MeshStandardMaterial({ color: cols[Math.floor(rand() * 5)] })); o.position.y = 0.05; o.rotation.y = rand(); }
      o.position.x = x; o.position.z = z;
      fg.add(o);
    }
  }
  layers.push({ group: fg, follow: 0 });
  return layers;
}

// ---------------------------------------------------------------- name-tag scraps
const NAME = { JA: [0, 2], CIN: [2, 5], TA: [5, 7] };
export function drawNamePiece(g, id, W, H, withPaper = true) {
  g.save();
  g.clearRect(0, 0, W, H);
  // a torn piece of a door sign
  const r = rng(id.length * 7 + 3);
  g.beginPath();
  g.moveTo(W * 0.08, H * 0.22);
  for (let x = 0.08; x <= 0.92; x += 0.06) g.lineTo(W * x, H * (0.2 + r() * 0.06));
  for (let y = 0.2; y <= 0.8; y += 0.08) g.lineTo(W * (0.9 + r() * 0.05), H * y);
  for (let x = 0.92; x >= 0.08; x -= 0.06) g.lineTo(W * x, H * (0.78 + r() * 0.06));
  g.closePath();
  if (withPaper) { g.fillStyle = '#fff6fb'; g.fill(); g.lineWidth = 6; g.strokeStyle = '#ff9ec4'; g.stroke(); }
  g.clip();
  g.fillStyle = '#e0457b';
  g.font = `bold ${Math.round(H * (id.length > 2 ? 0.3 : 0.36))}px "Chalkboard SE", "Marker Felt", "Comic Sans MS", sans-serif`;
  g.textAlign = 'center'; g.textBaseline = 'middle';
  const letters = id.split('');
  const cols = ['#e0457b', '#2f7de1', '#ff9a3c', '#3f9a3a', '#b48aff', '#e0457b', '#2f7de1'];
  const start = NAME[id][0];
  const step = W * 0.8 / letters.length;
  letters.forEach((ch, i) => { g.fillStyle = cols[start + i]; g.save(); g.translate(W * 0.1 + step * (i + 0.5), H * 0.5); g.rotate((r() - 0.5) * 0.3); g.fillText(ch, 0, 0); g.restore(); });
  g.restore();
}

export function nameScrapTexture(id) {
  return tex('namescrap' + id, 256, 256, (g, W, H) => drawNamePiece(g, id, W, H, true));
}

// The whole door sign: J A C I N T A, with any missing pieces left blank
export function drawNameTag(g, W, H, found) {
  g.clearRect(0, 0, W, H);
  g.fillStyle = '#fff6fb';
  g.strokeStyle = '#ff9ec4'; g.lineWidth = 10;
  const x = W * 0.06, y = H * 0.3, w = W * 0.88, h = H * 0.4;
  g.beginPath(); g.roundRect ? g.roundRect(x, y, w, h, 30) : g.rect(x, y, w, h); g.fill(); g.stroke();
  const name = 'JACINTA';
  const cols = ['#e0457b', '#2f7de1', '#ff9a3c', '#3f9a3a', '#b48aff', '#e0457b', '#2f7de1'];
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = `bold ${Math.round(H * 0.2)}px "Chalkboard SE", "Marker Felt", "Comic Sans MS", sans-serif`;
  for (let i = 0; i < 7; i++) {
    const piece = Object.entries(NAME).find(([, [a, b]]) => i >= a && i < b)[0];
    const has = found.includes(piece);
    g.fillStyle = has ? cols[i] : 'rgba(200,170,190,0.45)';
    g.fillText(has ? name[i] : '?', x + (w / 7) * (i + 0.5), y + h / 2 + 4);
  }
  // little hearts and stars around the sign
  g.fillStyle = '#ff9ec4';
  for (const [hx, hy] of [[0.12, 0.2], [0.88, 0.22], [0.5, 0.82]]) { g.beginPath(); g.arc(W * hx - 8, H * hy, 9, 0, 7); g.arc(W * hx + 8, H * hy, 9, 0, 7); g.moveTo(W * hx - 17, H * hy + 3); g.lineTo(W * hx, H * hy + 22); g.lineTo(W * hx + 17, H * hy + 3); g.fill(); }
}
