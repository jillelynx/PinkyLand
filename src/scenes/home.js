// Jacinta's house — walk in through the front door to explore her bedroom,
// the living room, the kitchen and the bathroom.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { Level } from './level.js';
import { Terrain } from '../world/terrain.js';
import { World } from '../world/world.js';
import { createTrees } from '../world/vegetation.js';
import { renderIntroDrawing } from './intro.js';
import { makeRandom } from '../util/noise.js';

const J = { who: 'Jacinta', color: '#ff6fa8', pitch: 1.2 };
const PINKY = { who: 'Pinky', color: '#f08aa8', pitch: 1.4 };
const line = (who, text, extra = {}) => ({ ...who, text, ...extra });

const CEIL = 2.7; // ceiling height
const WT = 0.16; // wall thickness
const HOUSE = { x0: -6, x1: 6, z0: -5, z1: 5 };
// rooms: x0, x1, z0, z1 (north is -z)
const ROOMS = {
  living: { x0: -6, x1: 1, z0: -1, z1: 5, wall: '#fff1dc', label: 'Living Room', icon: '🛋️' },
  kitchen: { x0: 1, x1: 6, z0: -1, z1: 5, wall: '#e3f5ec', label: 'Kitchen', icon: '🍳' },
  bedroom: { x0: -6, x1: 1, z0: -5, z1: -1, wall: '#ffe1ee', label: 'Jacinta’s Room', icon: '🛏️' },
  bath: { x0: 1, x1: 6, z0: -5, z1: -1, wall: '#dcefff', label: 'Bathroom', icon: '🛁' },
};
const FRONT_DOOR = { x: -0.6, z: 5 };

// ---------------------------------------------------------------- helpers
const matCache = new Map();
function mat(color, o = {}) {
  const key = color + JSON.stringify(o);
  if (!matCache.has(key)) matCache.set(key, new THREE.MeshStandardMaterial({ color, roughness: 0.75, ...o }));
  return matCache.get(key);
}
function rbox(w, h, d, color, r = 0.04, o = {}) {
  const m = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 3, Math.min(r, w / 2.1, h / 2.1, d / 2.1)), typeof color === 'string' ? mat(color, o) : color);
  m.castShadow = true; m.receiveShadow = true;
  return m;
}
function box(w, h, d, color, o = {}) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), typeof color === 'string' ? mat(color, o) : color);
  m.castShadow = true; m.receiveShadow = true;
  return m;
}
function cyl(rt, rb, h, color, seg = 16, o = {}) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), typeof color === 'string' ? mat(color, o) : color);
  m.castShadow = true; m.receiveShadow = true;
  return m;
}
function at(obj, x, y, z, ry = 0) { obj.position.set(x, y, z); obj.rotation.y = ry; return obj; }

function canvasTex(w, h, draw, repeat = null) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
  return t;
}

// warm wooden planks
function woodTex() {
  return canvasTex(512, 512, (g, w, h) => {
    const r = makeRandom(3);
    const rows = 8;
    for (let i = 0; i < rows; i++) {
      let x = -r() * 200;
      while (x < w) {
        const len = 160 + r() * 200;
        const l = 58 + r() * 10;
        g.fillStyle = `hsl(${28 + r() * 6}, ${45 + r() * 10}%, ${l}%)`;
        g.fillRect(x, i * (h / rows), len, h / rows);
        // grain
        g.strokeStyle = `rgba(90,50,20,${0.06 + r() * 0.06})`;
        g.lineWidth = 1;
        for (let k = 0; k < 6; k++) { const y = i * (h / rows) + 4 + r() * (h / rows - 8); g.beginPath(); g.moveTo(x, y); g.bezierCurveTo(x + len * 0.3, y + 3, x + len * 0.6, y - 3, x + len, y); g.stroke(); }
        g.fillStyle = 'rgba(70,40,20,0.35)';
        g.fillRect(x, i * (h / rows), 2, h / rows);
        x += len;
      }
      g.fillStyle = 'rgba(70,40,20,0.3)';
      g.fillRect(0, i * (h / rows), w, 2);
    }
  }, [3, 3]);
}
function tileTex(a, b, n = 8) {
  return canvasTex(512, 512, (g, w, h) => {
    const s = w / n;
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) { g.fillStyle = (i + j) % 2 ? a : b; g.fillRect(i * s, j * s, s, s); }
    g.strokeStyle = 'rgba(255,255,255,0.7)'; g.lineWidth = 3;
    for (let i = 0; i <= n; i++) { g.beginPath(); g.moveTo(i * s, 0); g.lineTo(i * s, h); g.stroke(); g.beginPath(); g.moveTo(0, i * s); g.lineTo(w, i * s); g.stroke(); }
  }, [3, 3]);
}
function wallpaperTex(base, dot, kind) {
  return canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = base; g.fillRect(0, 0, w, h);
    g.fillStyle = dot;
    const star = (cx, cy, r) => { g.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i * Math.PI) / 5; const rr = i % 2 ? r * 0.45 : r; g.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); } g.closePath(); g.fill(); };
    for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) {
      const cx = x * 64 + (y % 2 ? 32 : 0) + 16, cy = y * 64 + 24;
      if (kind === 'stars') star(cx, cy, 9);
      else if (kind === 'dots') { g.beginPath(); g.arc(cx, cy, 4, 0, Math.PI * 2); g.fill(); }
      else if (kind === 'stripes') { g.fillRect(x * 64, 0, 10, h); }
    }
  }, [6, 3]);
}
function rugTex(c1, c2, c3) {
  return canvasTex(256, 256, (g, w, h) => {
    const rings = [c1, c2, c3, c2, c1, c3];
    rings.forEach((c, i) => { g.fillStyle = c; g.beginPath(); g.arc(w / 2, h / 2, w / 2 - i * 20, 0, Math.PI * 2); g.fill(); });
  });
}
function blobShadowTex() {
  return canvasTex(64, 64, (g, w, h) => {
    const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(40,20,30,0.45)'); gr.addColorStop(0.6, 'rgba(40,20,30,0.18)'); gr.addColorStop(1, 'rgba(40,20,30,0)');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
  });
}

export class HomeLevel extends Level {
  constructor(game) {
    super(game, 'home');
    this.indoors = true;
    const s = game.state;
    s.earth = s.earth || { hearts: [], liev: false, bandage: false, mayaMet: false, mango: 'hurt', litter: 0, bullyDone: false };
    this.E = s.earth;
  }

  availableAvatars() { return this.E.liev ? ['jacintaPack', 'liev'] : ['jacintaPack']; }

  async build() {
    const g = this.game;
    this.setupSky(g.state.time ?? 0.4);
    this.dayNight.sun.castShadow = false;
    // flat lawn around the house (seen through the windows)
    this.terrain = new Terrain({ size: 80, segments: 40, height: () => 0, color: (x, z, h, out) => out.setHSL(0.27, 0.45, 0.42) });
    this.scene.add(this.terrain.mesh);
    this.world = new World({ terrain: this.terrain, waterLevel: -20, bounds: { x: 0, z: 0, r: 30 } });
    this.mapBounds = { x0: HOUSE.x0 - 1, x1: HOUSE.x1 + 1, z0: HOUSE.z0 - 1, z1: HOUSE.z1 + 1 };
    this.mapTitle = 'Home Sweet Home';
    this.mapHasWater = false;
    this.mapFeatures = [];
    this.mapExplored.fill(1);
    this.walls = []; // for keeping the camera inside the rooms
    this.blobTex = blobShadowTex();

    // trees and a hedge outside the windows
    const outside = [];
    for (let i = 0; i < 18; i++) {
      const a = (i / 18) * Math.PI * 2;
      outside.push({ x: Math.cos(a) * 15, z: Math.sin(a) * 13, kind: i % 3 ? 'round' : 'tall', color: ['#7cc96b', '#ffb3d1', '#8fd47a', '#ffc9e0'][i % 4] });
    }
    this.scene.add(createTrees(this.terrain, outside, { seed: 4 }).group);

    this.buildRooms();
    this.buildLiving();
    this.buildKitchen();
    this.buildBedroom();
    this.buildBath();
    this.buildLights();

    for (const [, r] of Object.entries(ROOMS)) this.landmarks.push({ x: (r.x0 + r.x1) / 2, z: (r.z0 + r.z1) / 2, icon: r.icon, label: r.label, always: true });
    this.landmarks.push({ x: FRONT_DOOR.x, z: FRONT_DOOR.z, icon: '🚪', label: 'Front door', always: true });

    // ---- player
    const p = g.state.homeSpawn || { x: FRONT_DOOR.x, z: 4.0 };
    this.setupPlayer(new THREE.Vector3(p.x, 0, p.z), Math.PI);
    g.state.homeSpawn = null;
    const rig = this.rig;
    rig.maxDist = 4.2; rig.minDist = 1.0;
    rig.targetDistance = rig.distance = 3.4;
    rig.pitch = 0.42;
    // keep the camera inside the house and out of the walls
    rig.blocked = (x, y, z) => {
      if (y > CEIL - 0.2 || x < HOUSE.x0 + 0.25 || x > HOUSE.x1 - 0.25 || z < HOUSE.z0 + 0.25 || z > HOUSE.z1 - 0.25) return true;
      for (const w of this.walls) if (Math.abs(x - w.x) < w.hw + 0.18 && Math.abs(z - w.z) < w.hd + 0.18 && y < w.top + 0.1 && y > w.bottom - 0.1) return true;
      return false;
    };
    this.buildInteractions();
  }

  // ---------------------------------------------------------------- walls, floors
  buildRooms() {
    const floors = {
      living: new THREE.MeshStandardMaterial({ map: woodTex(), roughness: 0.6 }),
      kitchen: new THREE.MeshStandardMaterial({ map: tileTex('#f7f3ea', '#cde9dc', 8), roughness: 0.45 }),
      bedroom: new THREE.MeshStandardMaterial({ map: woodTex(), color: '#fff0e6', roughness: 0.65 }),
      bath: new THREE.MeshStandardMaterial({ map: tileTex('#ffffff', '#cfe6fb', 10), roughness: 0.35 }),
    };
    const papers = {
      living: wallpaperTex('#fff1dc', '#f6dcbc', 'stripes'),
      kitchen: wallpaperTex('#e3f5ec', '#cce9db', 'dots'),
      bedroom: wallpaperTex('#ffe1ee', '#ffc2db', 'stars'),
      bath: wallpaperTex('#dcefff', '#c6e2fb', 'dots'),
    };
    const ceilMat = new THREE.MeshStandardMaterial({ color: '#fffaf5', roughness: 0.9, side: THREE.DoubleSide });
    // doorways and windows on each room's walls: side: n/s/e/w, c = centre, w = width
    const gaps = {
      living: { s: [{ c: FRONT_DOOR.x, w: 1.1, door: true }, { c: -3.8, w: 1.6, sill: 0.8, top: 2.0 }], n: [{ c: -0.6, w: 1.0, door: true }], e: [{ c: 2.0, w: 3.0, top: 2.3 }], w: [{ c: 2.0, w: 1.6, sill: 0.9, top: 2.0 }] },
      kitchen: { w: [{ c: 2.0, w: 3.0, top: 2.3 }], n: [{ c: 2.2, w: 1.0, door: true }], e: [{ c: 1.0, w: 1.4, sill: 1.15, top: 2.05 }], s: [{ c: 3.6, w: 1.4, sill: 0.9, top: 2.0 }] },
      bedroom: { s: [{ c: -0.6, w: 1.0, door: true }], n: [{ c: -3.4, w: 1.5, sill: 0.85, top: 2.0 }], w: [{ c: -2.6, w: 1.1, sill: 0.9, top: 2.0 }] },
      bath: { s: [{ c: 2.2, w: 1.0, door: true }], n: [{ c: 4.7, w: 1.0, sill: 1.4, top: 2.1 }] },
    };
    this.windowSpots = [];
    for (const [key, r] of Object.entries(ROOMS)) {
      const w = r.x1 - r.x0, d = r.z1 - r.z0, cx = (r.x0 + r.x1) / 2, cz = (r.z0 + r.z1) / 2;
      // floor + ceiling
      const fl = new THREE.Mesh(new THREE.PlaneGeometry(w, d), floors[key]);
      fl.rotation.x = -Math.PI / 2; fl.position.set(cx, 0.01, cz); fl.receiveShadow = true;
      floors[key].map.repeat.set(w / 3, d / 3);
      this.scene.add(fl);
      const ce = new THREE.Mesh(new THREE.PlaneGeometry(w, d), ceilMat);
      ce.rotation.x = Math.PI / 2; ce.position.set(cx, CEIL, cz);
      this.scene.add(ce);
      const wallMat = new THREE.MeshStandardMaterial({ map: papers[key], roughness: 0.9 });
      const G = gaps[key];
      const i = WT / 2;
      this._wallLine('x', r.z0 + i, r.x0, r.x1, G.n || [], wallMat, 1);
      this._wallLine('x', r.z1 - i, r.x0, r.x1, G.s || [], wallMat, -1);
      this._wallLine('z', r.x0 + i, r.z0, r.z1, G.w || [], wallMat, 1);
      this._wallLine('z', r.x1 - i, r.z0, r.z1, G.e || [], wallMat, -1);
      this.mapFeatures.push({ type: 'label', x: cx, z: cz + 1.2, text: '' });
    }
    // the front door (open, so you can see the porch light outside)
    const door = box(1.0, 2.05, 0.06, '#7a4a8a');
    door.position.set(FRONT_DOOR.x - 0.55, 1.03, FRONT_DOOR.z - 0.2);
    door.rotation.y = Math.PI - 0.35; // swung open against the wall
    door.geometry.translate(0.5, 0, 0);
    door.position.x -= 0.0;
    this.scene.add(door);
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.04, 10, 8), mat('#ffd34d', { metalness: 0.8, roughness: 0.3 }));
    knob.position.set(0.85, 0, 0.06);
    door.add(knob);
    // door mat
    const dm = box(1.1, 0.02, 0.6, '#c97a5a');
    at(dm, FRONT_DOOR.x, 0.02, 4.45);
    this.scene.add(dm);
  }

  // Build one wall along x (fixed z) or along z (fixed x) with door/window gaps.
  _wallLine(axis, fixed, a0, a1, gaps, wallMat, facing) {
    const parts = [];
    const sorted = gaps.slice().sort((p, q) => p.c - q.c);
    let cur = a0;
    const seg = (s0, s1, y0, y1) => { if (s1 - s0 > 0.01 && y1 - y0 > 0.01) parts.push([s0, s1, y0, y1]); };
    for (const gp of sorted) {
      const s0 = gp.c - gp.w / 2, s1 = gp.c + gp.w / 2;
      seg(cur, s0, 0, CEIL);
      const top = gp.door ? 2.1 : gp.top ?? 2.2;
      seg(s0, s1, top, CEIL); // above the opening
      if (gp.sill) {
        seg(s0, s1, 0, gp.sill); // below a window
        this._window(axis, fixed, gp, facing);
      } else if (gp.door || gp.top) this._doorFrame(axis, fixed, gp, top);
      cur = s1;
    }
    seg(cur, a1, 0, CEIL);
    for (const [s0, s1, y0, y1] of parts) {
      const len = s1 - s0, mid = (s0 + s1) / 2, hgt = y1 - y0;
      const geo = axis === 'x' ? new THREE.BoxGeometry(len, hgt, WT) : new THREE.BoxGeometry(WT, hgt, len);
      // scale the wallpaper so its pattern stays the same size everywhere
      const uv = geo.attributes.uv;
      for (let k = 0; k < uv.count; k++) uv.setXY(k, uv.getX(k) * len / 2 + mid / 2, uv.getY(k) * hgt / 2 + y0 / 2);
      const m = new THREE.Mesh(geo, wallMat);
      m.receiveShadow = true;
      if (axis === 'x') m.position.set(mid, y0 + hgt / 2, fixed); else m.position.set(fixed, y0 + hgt / 2, mid);
      this.scene.add(m);
      const c = axis === 'x' ? { type: 'box', x: mid, z: fixed, hw: len / 2, hd: WT / 2 + 0.02, top: y1, bottom: y0 - 0.5 } : { type: 'box', x: fixed, z: mid, hw: WT / 2 + 0.02, hd: len / 2, top: y1, bottom: y0 - 0.5 };
      if (y0 < 1.5) { this.world.addColliders([{ ...c, top: y1 + 0.6, noStand: true }]); }
      this.walls.push(c);
      // white skirting board along the bottom
      if (y0 === 0) {
        const sk = new THREE.Mesh(axis === 'x' ? new THREE.BoxGeometry(len, 0.12, WT + 0.03) : new THREE.BoxGeometry(WT + 0.03, 0.12, len), mat('#ffffff'));
        sk.position.set(m.position.x, 0.06, m.position.z);
        this.scene.add(sk);
      }
    }
  }

  _doorFrame(axis, fixed, gp, top) {
    const f = mat('#ffffff');
    const post = (s) => { const b = new THREE.Mesh(new THREE.BoxGeometry(axis === 'x' ? 0.08 : WT + 0.06, top, axis === 'x' ? WT + 0.06 : 0.08), f); if (axis === 'x') b.position.set(s, top / 2, fixed); else b.position.set(fixed, top / 2, s); this.scene.add(b); };
    post(gp.c - gp.w / 2); post(gp.c + gp.w / 2);
    const lintel = new THREE.Mesh(axis === 'x' ? new THREE.BoxGeometry(gp.w + 0.16, 0.08, WT + 0.06) : new THREE.BoxGeometry(WT + 0.06, 0.08, gp.w + 0.16), f);
    if (axis === 'x') lintel.position.set(gp.c, top, fixed); else lintel.position.set(fixed, top, gp.c);
    this.scene.add(lintel);
  }

  _window(axis, fixed, gp, facing) {
    const f = mat('#ffffff');
    const g = new THREE.Group();
    const w = gp.w, h = gp.top - gp.sill;
    const glass = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ color: '#cfeaff', transparent: true, opacity: 0.18, roughness: 0.05, side: THREE.DoubleSide, depthWrite: false }));
    g.add(glass);
    for (const [bw, bh, x, y] of [[w + 0.1, 0.07, 0, h / 2], [w + 0.1, 0.07, 0, -h / 2], [0.07, h, -w / 2, 0], [0.07, h, w / 2, 0], [0.04, h, 0, 0], [w, 0.04, 0, 0]]) {
      const b = new THREE.Mesh(new THREE.BoxGeometry(bw, bh, WT + 0.05), f);
      b.position.set(x, y, 0); g.add(b);
    }
    const sill = new THREE.Mesh(new THREE.BoxGeometry(w + 0.2, 0.05, WT + 0.2), f);
    sill.position.set(0, -h / 2 - 0.02, 0); g.add(sill);
    // curtains
    const curtainMat = mat(['#ffb3cf', '#bfe6ff', '#ffe08a'][Math.floor(Math.abs(fixed * 7 + gp.c) % 3)], { roughness: 0.95 });
    for (const s of [-1, 1]) {
      const c = new THREE.Mesh(new THREE.BoxGeometry(0.28, h + 0.35, 0.05), curtainMat);
      c.position.set(s * (w / 2 + 0.12), 0.05, 0.12 * facing * (axis === 'x' ? 1 : 1));
      g.add(c);
    }
    if (axis === 'x') g.position.set(gp.c, gp.sill + h / 2, fixed);
    else { g.position.set(fixed, gp.sill + h / 2, gp.c); g.rotation.y = Math.PI / 2; }
    // curtains on the inside of the room
    g.children.slice(-2).forEach((c) => { c.position.z = axis === 'x' ? 0.12 * facing : -0.12 * facing; });
    this.scene.add(g);
    this.windowSpots.push(g.position.clone());
  }

  // a soft dark spot under furniture so it sits on the floor
  shadowBlob(x, z, sx, sz) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(sx, sz), new THREE.MeshBasicMaterial({ map: this.blobTex, transparent: true, depthWrite: false }));
    m.rotation.x = -Math.PI / 2; m.position.set(x, 0.025, z);
    this.scene.add(m);
  }

  solid(x, z, hw, hd, top, opts = {}) { this.world.addColliders([{ type: 'box', x, z, hw, hd, top, bottom: -1, ...opts }]); }

  // ---------------------------------------------------------------- living room
  buildLiving() {
    const S = this.scene;
    // rug
    const rug = new THREE.Mesh(new THREE.CircleGeometry(1.6, 40), new THREE.MeshStandardMaterial({ map: rugTex('#f7b9a6', '#fde3c8', '#c9e3f7'), roughness: 1 }));
    rug.rotation.x = -Math.PI / 2; rug.position.set(-3.9, 0.02, 2.0); rug.receiveShadow = true; S.add(rug);
    // sofa facing west toward the TV
    const sofa = new THREE.Group();
    const fabric = mat('#7fb6e6', { roughness: 0.95 });
    sofa.add(at(rbox(0.9, 0.42, 2.2, fabric, 0.1), 0, 0.25, 0));
    sofa.add(at(rbox(0.25, 0.75, 2.2, fabric, 0.1), 0.36, 0.55, 0));
    for (const s of [-1, 1]) sofa.add(at(rbox(0.9, 0.6, 0.22, fabric, 0.09), 0, 0.35, s * 1.1));
    for (const s of [-0.5, 0.5]) sofa.add(at(rbox(0.7, 0.16, 0.98, '#a9d0f2', 0.07), -0.04, 0.52, s));
    sofa.add(at(rbox(0.16, 0.38, 0.38, '#ffb3cf', 0.08), 0.18, 0.75, 0.6));
    sofa.children.at(-1).rotation.z = 0.25;
    sofa.add(at(rbox(0.16, 0.36, 0.36, '#ffe08a', 0.08), 0.18, 0.75, -0.65));
    at(sofa, -2.4, 0, 2.0);
    S.add(sofa);
    this.shadowBlob(-2.4, 2.0, 1.5, 2.8);
    this.solid(-2.4, 2.0, 0.48, 1.2, 0.5);
    this.sofaPos = new THREE.Vector3(-2.5, 0.5, 2.0);
    // coffee table with a book and a cup
    const ct = new THREE.Group();
    ct.add(at(rbox(0.8, 0.06, 1.1, '#c8955f', 0.02), 0, 0.42, 0));
    for (const [x, z] of [[-0.32, -0.46], [0.32, -0.46], [-0.32, 0.46], [0.32, 0.46]]) ct.add(at(cyl(0.03, 0.03, 0.4, '#8a5a3c', 8), x, 0.2, z));
    ct.add(at(box(0.22, 0.04, 0.3, '#e0457b'), 0.1, 0.47, -0.2));
    ct.add(at(cyl(0.05, 0.04, 0.09, '#ffffff', 12), -0.15, 0.5, 0.25));
    at(ct, -3.9, 0, 2.0);
    S.add(ct);
    this.solid(-3.9, 2.0, 0.42, 0.56, 0.46);
    // TV stand + TV on the west wall
    const tv = new THREE.Group();
    tv.add(at(rbox(0.45, 0.5, 1.8, '#f2e6d6', 0.03), 0, 0.25, 0));
    for (const z of [-0.45, 0.45]) tv.add(at(box(0.02, 0.36, 0.8, '#e2d2bf'), 0.23, 0.25, z));
    tv.add(at(rbox(0.06, 0.72, 1.25, '#222228', 0.03), 0.02, 0.98, 0));
    this.tvCanvas = document.createElement('canvas'); this.tvCanvas.width = 256; this.tvCanvas.height = 144;
    this.tvTex = new THREE.CanvasTexture(this.tvCanvas); this.tvTex.colorSpace = THREE.SRGBColorSpace;
    this.tvScreen = new THREE.Mesh(new THREE.PlaneGeometry(1.15, 0.63), new THREE.MeshBasicMaterial({ map: this.tvTex, toneMapped: false }));
    this.tvScreen.rotation.y = Math.PI / 2; this.tvScreen.position.set(0.06, 0.98, 0);
    tv.add(this.tvScreen);
    at(tv, -5.65, 0, 2.0);
    S.add(tv);
    this.solid(-5.65, 2.0, 0.25, 0.9, 0.5);
    this.tvOn = false;
    this._drawTV(0);
    // armchair
    const chair = new THREE.Group();
    const cf = mat('#f4a3b8', { roughness: 0.95 });
    chair.add(at(rbox(0.8, 0.42, 0.8, cf, 0.1), 0, 0.25, 0));
    chair.add(at(rbox(0.8, 0.7, 0.2, cf, 0.09), 0, 0.55, 0.32));
    for (const s of [-1, 1]) chair.add(at(rbox(0.18, 0.55, 0.8, cf, 0.08), s * 0.4, 0.38, 0));
    at(chair, -3.9, 0, 4.25, Math.PI);
    S.add(chair);
    this.shadowBlob(-3.9, 4.25, 1.2, 1.2);
    this.solid(-3.9, 4.25, 0.45, 0.42, 0.5);
    // sideboard with family photos on the north wall
    const sb = new THREE.Group();
    sb.add(at(rbox(1.6, 0.75, 0.42, '#c8955f', 0.03), 0, 0.38, 0));
    for (const x of [-0.4, 0.4]) sb.add(at(box(0.7, 0.6, 0.02, '#b3824f'), x, 0.38, 0.215));
    for (const [x, c, h] of [[-0.55, '#ffd34d', 0.22], [-0.1, '#9fd8ff', 0.28], [0.4, '#ffb3cf', 0.2]]) {
      const fr = new THREE.Group();
      fr.add(at(box(0.2, h, 0.03, '#ffffff'), 0, 0, 0));
      fr.add(at(box(0.15, h - 0.05, 0.01, c), 0, 0, 0.02));
      fr.rotation.x = -0.15;
      sb.add(at(fr, x, 0.75 + h / 2, -0.05));
    }
    at(sb, -3.4, 0, -0.75);
    S.add(sb);
    this.solid(-3.4, -0.75, 0.82, 0.25, 0.76);
    // a big painting above the sideboard
    const art = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 0.8), new THREE.MeshStandardMaterial({ map: canvasTex(256, 160, (g2, w, h) => {
      const gr = g2.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#ffd1e3'); gr.addColorStop(1, '#bfe6ff'); g2.fillStyle = gr; g2.fillRect(0, 0, w, h);
      g2.fillStyle = '#ffe27a'; g2.beginPath(); g2.arc(190, 50, 22, 0, Math.PI * 2); g2.fill();
      g2.fillStyle = '#8fd47a'; g2.beginPath(); g2.moveTo(0, h); g2.quadraticCurveTo(80, 70, 160, 120); g2.quadraticCurveTo(210, 90, w, 110); g2.lineTo(w, h); g2.fill();
      g2.fillStyle = '#6fbf5f'; g2.beginPath(); g2.moveTo(0, h); g2.quadraticCurveTo(120, 110, w, h); g2.fill();
      g2.lineWidth = 12; g2.strokeStyle = '#d9a441'; g2.strokeRect(0, 0, w, h);
    }) }));
    art.position.set(-3.4, 1.75, -0.825);
    S.add(art);
    // floor lamp + plants
    const lamp = new THREE.Group();
    lamp.add(at(cyl(0.18, 0.2, 0.04, '#5a4a5a'), 0, 0.02, 0));
    lamp.add(at(cyl(0.02, 0.02, 1.5, '#5a4a5a', 8), 0, 0.77, 0));
    lamp.add(at(cyl(0.16, 0.26, 0.3, mat('#fff3d6', { emissive: '#ffd98a', emissiveIntensity: 0.6 }), 20), 0, 1.6, 0));
    at(lamp, -5.55, 0, 4.5);
    S.add(lamp);
    this.solid(-5.55, 4.5, 0.2, 0.2, 1.7, { noStand: true });
    this.addPlant(-5.55, -0.5, 1.1);
    this.addPlant(0.55, 4.55, 0.9);
    // coat hooks by the door
    for (let i = 0; i < 3; i++) S.add(at(cyl(0.02, 0.02, 0.12, '#8a5a3c', 6), 0.2 + i * 0.25, 1.6, 4.78));
    S.add(at(rbox(0.32, 0.55, 0.12, '#ffb3cf', 0.05), 0.45, 1.3, 4.76)); // Jacinta's jacket
    this.mapFeatures.push({ type: 'label', x: -3.4, z: 2.2, text: '' });
  }

  addPlant(x, z, s = 1) {
    const g = new THREE.Group();
    g.add(at(cyl(0.18 * s, 0.13 * s, 0.32 * s, '#e07a5a'), 0, 0.16 * s, 0));
    const leaf = mat('#5fae55', { roughness: 0.8 });
    for (let i = 0; i < 7; i++) {
      const l = new THREE.Mesh(new THREE.SphereGeometry(0.16 * s, 10, 8), leaf);
      l.scale.set(0.5, 1.4, 0.25);
      const a = (i / 7) * Math.PI * 2;
      l.position.set(Math.cos(a) * 0.1 * s, 0.55 * s, Math.sin(a) * 0.1 * s);
      l.rotation.set(Math.sin(a) * 0.5, 0, -Math.cos(a) * 0.5);
      l.castShadow = true;
      g.add(l);
    }
    at(g, x, 0, z);
    this.scene.add(g);
    this.solid(x, z, 0.18 * s, 0.18 * s, 0.4 * s, { noStand: true });
  }

  _drawTV(t) {
    const g = this.tvCanvas.getContext('2d'), W = 256, H = 144;
    if (!this.tvOn) {
      const gr = g.createLinearGradient(0, 0, W, H); gr.addColorStop(0, '#2b2b33'); gr.addColorStop(1, '#14141a');
      g.fillStyle = gr; g.fillRect(0, 0, W, H);
      g.fillStyle = 'rgba(255,255,255,0.06)'; g.beginPath(); g.moveTo(30, 0); g.lineTo(90, 0); g.lineTo(40, H); g.lineTo(-20, H); g.fill();
    } else {
      // a little cartoon: a pink pillow bouncing across rolling hills
      g.fillStyle = '#8fd0ff'; g.fillRect(0, 0, W, H);
      g.fillStyle = '#ffe27a'; g.beginPath(); g.arc(220, 28, 16, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#7fd36a';
      g.beginPath(); g.moveTo(0, H);
      for (let x = 0; x <= W; x += 8) g.lineTo(x, 100 + Math.sin(x * 0.04 + t * 2) * 10);
      g.lineTo(W, H); g.fill();
      const px = ((t * 50) % (W + 60)) - 30, py = 70 - Math.abs(Math.sin(t * 4)) * 34;
      g.fillStyle = '#ffd3de'; g.fillRect(px - 14, py - 20, 28, 40);
      g.fillStyle = '#3366cc'; g.fillRect(px - 7, py - 12, 4, 6); g.fillRect(px + 3, py - 12, 4, 6);
      g.strokeStyle = '#3366cc'; g.lineWidth = 2; g.beginPath(); g.arc(px, py - 4, 5, 0.2, Math.PI - 0.2); g.stroke();
      for (let i = 0; i < 3; i++) { g.fillStyle = '#ff6fae'; g.font = '14px serif'; g.fillText('♥', (i * 90 + t * 30) % W, 30 + i * 10); }
    }
    this.tvTex.needsUpdate = true;
  }

  // ---------------------------------------------------------------- kitchen
  buildKitchen() {
    const S = this.scene;
    const cab = '#ffffff', top = '#e9d8c4', handle = mat('#b8b8c0', { metalness: 0.8, roughness: 0.3 });
    // counters along the east wall (z from -0.9 to 2.6) and the north wall (x from 3.1 to 5.9)
    const counter = (x, z, len, alongZ) => {
      const g = new THREE.Group();
      g.add(at(rbox(0.62, 0.86, len, cab, 0.02), 0, 0.43, 0));
      g.add(at(box(0.68, 0.05, len + 0.02, top, { roughness: 0.4 }), -0.02, 0.885, 0));
      const doors = Math.max(1, Math.round(len / 0.6));
      for (let i = 0; i < doors; i++) {
        const zz = -len / 2 + (i + 0.5) * (len / doors);
        g.add(at(box(0.02, 0.7, len / doors - 0.05, '#f4f0fa'), -0.315, 0.43, zz));
        g.add(at(new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.14, 6), handle), -0.33, 0.7, zz + (len / doors) * 0.3));
      }
      at(g, x, 0, z, alongZ ? 0 : Math.PI / 2);
      S.add(g);
      if (alongZ) this.solid(x, z, 0.33, len / 2, 0.9); else this.solid(x, z, len / 2, 0.33, 0.9);
      return g;
    };
    counter(5.6, 0.85, 3.5, true);
    counter(4.5, -0.6, 2.2, false);
    // sink under the window
    const sink = new THREE.Group();
    sink.add(at(box(0.45, 0.04, 0.6, '#d8dde3', { metalness: 0.6, roughness: 0.25 }), 0, 0.9, 0));
    sink.add(at(box(0.36, 0.02, 0.5, '#9aa3ad', { metalness: 0.7, roughness: 0.2 }), 0, 0.915, 0));
    const tap = new THREE.Group();
    tap.add(at(cyl(0.02, 0.02, 0.3, handle, 8), 0, 0.15, 0));
    tap.add(at(cyl(0.015, 0.015, 0.18, handle, 8), -0.08, 0.3, 0));
    tap.children[1].rotation.z = Math.PI / 2;
    sink.add(at(tap, 0.22, 0.9, 0));
    at(sink, 5.55, 0, 1.0);
    S.add(sink);
    this.sinkPos = new THREE.Vector3(5.2, 0, 1.0);
    // stove with 4 burners and an oven door
    const stove = new THREE.Group();
    stove.add(at(box(0.66, 0.03, 0.66, '#2b2b33', { roughness: 0.3 }), 0, 0.915, 0));
    for (const [x, z] of [[-0.15, -0.15], [0.15, -0.15], [-0.15, 0.15], [0.15, 0.15]]) {
      const b = new THREE.Mesh(new THREE.TorusGeometry(0.08, 0.012, 6, 20), mat('#555560'));
      b.rotation.x = Math.PI / 2; b.position.set(x, 0.935, z); stove.add(b);
    }
    stove.add(at(box(0.02, 0.45, 0.55, '#3a3a44', { roughness: 0.2 }), -0.32, 0.45, 0));
    stove.add(at(box(0.02, 0.3, 0.4, '#6a6a7a', { roughness: 0.1, metalness: 0.3 }), -0.335, 0.45, 0));
    // a pot
    stove.add(at(cyl(0.12, 0.11, 0.14, '#e0457b', 16, { roughness: 0.4 }), 0.15, 1.0, -0.15));
    at(stove, 5.58, 0, 2.15);
    S.add(stove);
    // fridge with drawings on it
    const fr = new THREE.Group();
    fr.add(at(rbox(0.72, 1.85, 0.7, '#f7fbff', 0.06, { roughness: 0.3 }), 0, 0.93, 0));
    fr.add(at(box(0.01, 0.01, 0.66, '#c9d3dc'), -0.36, 1.2, 0));
    fr.add(at(cyl(0.015, 0.015, 0.4, handle, 6), -0.38, 1.45, -0.25));
    fr.add(at(cyl(0.015, 0.015, 0.3, handle, 6), -0.38, 0.85, -0.25));
    const pics = ['#ffd1e3', '#fff3b0', '#cfeaff'];
    pics.forEach((c, i) => {
      const p = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.17), new THREE.MeshStandardMaterial({ map: canvasTex(64, 48, (g2) => {
        g2.fillStyle = c; g2.fillRect(0, 0, 64, 48);
        g2.strokeStyle = ['#e0457b', '#2f7de1', '#3f9a3a'][i]; g2.lineWidth = 3;
        g2.beginPath(); g2.arc(32, 20, 9, 0, Math.PI * 2); g2.moveTo(32, 29); g2.lineTo(32, 44); g2.moveTo(20, 36); g2.lineTo(44, 36); g2.stroke();
      }) }));
      p.rotation.y = -Math.PI / 2; p.rotation.z = (i - 1) * 0.12;
      p.position.set(-0.36, 1.5 - i * 0.24, 0.1 + (i % 2) * 0.05);
      fr.add(p);
    });
    at(fr, 5.6, 0, 3.15);
    S.add(fr);
    this.solid(5.6, 3.15, 0.38, 0.37, 1.85, { noStand: true });
    this.fridgePos = new THREE.Vector3(5.0, 0, 3.15);
    // upper cabinets on the north wall
    const up = new THREE.Group();
    up.add(at(rbox(2.2, 0.7, 0.36, cab, 0.02), 0, 0, 0));
    for (let i = 0; i < 4; i++) up.add(at(box(0.5, 0.6, 0.02, '#f4f0fa'), -0.825 + i * 0.55, 0, 0.18));
    at(up, 4.5, 1.85, -0.64);
    S.add(up);
    // kitchen table with 4 chairs, fruit and cookies
    const tb = new THREE.Group();
    tb.add(at(cyl(0.62, 0.62, 0.05, '#e9c79a', 32), 0, 0.72, 0));
    tb.add(at(cyl(0.06, 0.08, 0.7, '#b3824f', 10), 0, 0.36, 0));
    tb.add(at(cyl(0.3, 0.32, 0.03, '#b3824f', 16), 0, 0.02, 0));
    // fruit bowl
    tb.add(at(cyl(0.16, 0.1, 0.08, '#ffffff', 16), 0.15, 0.78, -0.1));
    for (const [x, z, c] of [[0.1, -0.12, '#ff5a3c'], [0.2, -0.06, '#ffd34d'], [0.15, -0.16, '#7cc96b']]) tb.add(at(new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 8), mat(c, { roughness: 0.4 })), x, 0.84, z));
    // plate of cookies
    tb.add(at(cyl(0.14, 0.12, 0.015, '#ffffff', 20), -0.22, 0.755, 0.15));
    this.cookies = [];
    for (let i = 0; i < 4; i++) { const ck = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.015, 14), mat('#d9a05a')); ck.position.set(-0.22 + Math.cos(i * 1.6) * 0.06, 0.775 + (i > 2 ? 0.015 : 0), 0.15 + Math.sin(i * 1.6) * 0.06); tb.add(ck); this.cookies.push(ck); }
    at(tb, 3.0, 0, 2.6);
    S.add(tb);
    this.shadowBlob(3.0, 2.6, 1.8, 1.8);
    this.solid(3.0, 2.6, 0.5, 0.5, 0.75, { noStand: true });
    this.tablePos = new THREE.Vector3(3.0, 0, 2.6);
    const chairMat = ['#ff9ec4', '#9fd8ff', '#ffe08a', '#b6e3a8'];
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
      const ch = new THREE.Group();
      ch.add(at(rbox(0.42, 0.05, 0.42, chairMat[i], 0.02), 0, 0.45, 0));
      ch.add(at(rbox(0.42, 0.45, 0.05, chairMat[i], 0.02), 0, 0.7, -0.19));
      for (const [x, z] of [[-0.17, -0.17], [0.17, -0.17], [-0.17, 0.17], [0.17, 0.17]]) ch.add(at(cyl(0.02, 0.02, 0.45, '#ffffff', 6), x, 0.22, z));
      const cx = 3.0 + Math.sin(a) * 0.95, cz = 2.6 + Math.cos(a) * 0.95;
      at(ch, cx, 0, cz, a + Math.PI);
      S.add(ch);
      this.solid(cx, cz, 0.22, 0.22, 0.47);
    }
    // hanging lamp over the table
    const hl = new THREE.Group();
    hl.add(at(cyl(0.006, 0.006, 0.9, '#333', 4), 0, 0.45, 0));
    hl.add(at(new THREE.Mesh(new THREE.SphereGeometry(0.22, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), mat('#ffb3cf', { side: THREE.DoubleSide, emissive: '#ffd0a0', emissiveIntensity: 0.3 })), 0, 0, 0));
    at(hl, 3.0, CEIL - 0.9, 2.6);
    S.add(hl);
  }

  // ---------------------------------------------------------------- bedroom
  buildBedroom() {
    const S = this.scene;
    const rug = new THREE.Mesh(new THREE.CircleGeometry(1.3, 40), new THREE.MeshStandardMaterial({ map: rugTex('#ffb3cf', '#ffffff', '#ffd6e8'), roughness: 1 }));
    rug.rotation.x = -Math.PI / 2; rug.position.set(-2.6, 0.02, -3.0); S.add(rug);
    // bed with a pink comforter, headboard against the west wall
    const bed = new THREE.Group();
    bed.add(at(rbox(2.1, 0.32, 1.3, '#f4e7da', 0.04), 0, 0.2, 0));
    bed.add(at(rbox(2.0, 0.2, 1.24, '#ffffff', 0.08), 0, 0.46, 0)); // mattress
    const quilt = new THREE.Mesh(new RoundedBoxGeometry(1.45, 0.12, 1.32, 3, 0.05), new THREE.MeshStandardMaterial({ map: canvasTex(128, 128, (g2) => {
      g2.fillStyle = '#ff9ec4'; g2.fillRect(0, 0, 128, 128);
      g2.fillStyle = '#ffd1e3';
      for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) if ((i + j) % 2) g2.fillRect(i * 32, j * 32, 32, 32);
      g2.fillStyle = '#ffffff';
      for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { g2.beginPath(); g2.arc(i * 32 + 16, j * 32 + 16, 4, 0, Math.PI * 2); g2.fill(); }
    }), roughness: 0.95 }));
    quilt.castShadow = true;
    bed.add(at(quilt, 0.3, 0.58, 0));
    bed.add(at(rbox(0.4, 0.14, 0.9, '#ffffff', 0.07), -0.75, 0.62, 0)); // pillow
    bed.add(at(rbox(0.12, 1.0, 1.36, '#f4e7da', 0.05), -1.04, 0.5, 0)); // headboard
    bed.add(at(rbox(0.1, 0.55, 1.36, '#f4e7da', 0.05), 1.04, 0.3, 0)); // footboard
    // a teddy bear sitting on the pillow
    const teddy = new THREE.Group();
    const fur = mat('#c8955f', { roughness: 1 });
    teddy.add(at(new THREE.Mesh(new THREE.SphereGeometry(0.11, 14, 10), fur), 0, 0.1, 0));
    teddy.add(at(new THREE.Mesh(new THREE.SphereGeometry(0.08, 14, 10), fur), 0, 0.25, 0.01));
    for (const s of [-1, 1]) teddy.add(at(new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 6), fur), s * 0.055, 0.32, 0));
    teddy.add(at(new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 6), mat('#f0d2b0')), 0, 0.24, 0.07));
    for (const s of [-1, 1]) teddy.add(at(new THREE.Mesh(new THREE.SphereGeometry(0.011, 6, 6), mat('#222')), s * 0.03, 0.27, 0.07));
    teddy.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    at(teddy, -0.72, 0.66, 0.3, Math.PI / 2);
    bed.add(teddy);
    at(bed, -4.85, 0, -3.8);
    S.add(bed);
    this.shadowBlob(-4.85, -3.8, 2.6, 1.8);
    this.solid(-4.85, -3.8, 1.05, 0.65, 0.56);
    // the bed is a little bit bouncy (of course!)
    this.world.bouncers.push({ x: -4.6, z: -3.8, r: 0.6, top: 0.62, power: 8.5, onBounce: () => this.game.audio.bounce() });
    this.bedPos = new THREE.Vector3(-4.6, 0.6, -3.8);
    // nightstand + lamp
    const ns = new THREE.Group();
    ns.add(at(rbox(0.45, 0.5, 0.45, '#ffffff', 0.03), 0, 0.25, 0));
    ns.add(at(box(0.02, 0.18, 0.36, '#ffd1e3'), 0.23, 0.33, 0));
    ns.add(at(cyl(0.06, 0.08, 0.06, '#ff9ec4'), 0, 0.53, 0));
    ns.add(at(cyl(0.012, 0.012, 0.22, '#ffffff', 6), 0, 0.65, 0));
    this.bedLampShade = cyl(0.09, 0.14, 0.16, mat('#fff3d6', { emissive: '#ffd98a', emissiveIntensity: 0.0 }), 18);
    ns.add(at(this.bedLampShade, 0, 0.8, 0));
    at(ns, -5.6, 0, -2.75);
    S.add(ns);
    this.solid(-5.6, -2.75, 0.24, 0.24, 0.52);
    this.bedLampPos = new THREE.Vector3(-5.6, 0.8, -2.75);
    // desk with crayons and paper under the framed drawing
    const desk = new THREE.Group();
    desk.add(at(rbox(1.2, 0.05, 0.55, '#ffffff', 0.02), 0, 0.62, 0));
    for (const [x, z] of [[-0.55, -0.22], [0.55, -0.22], [-0.55, 0.22], [0.55, 0.22]]) desk.add(at(cyl(0.025, 0.025, 0.6, '#ffb3cf', 8), x, 0.3, z));
    desk.add(at(box(0.32, 0.005, 0.24, '#fffaf0'), -0.1, 0.65, 0.05));
    desk.add(at(cyl(0.05, 0.05, 0.12, '#9fd8ff', 12), 0.4, 0.71, -0.1));
    ['#e0457b', '#ffd34d', '#2f7de1', '#3f9a3a', '#ff9a3c'].forEach((c, i) => { const cr = cyl(0.008, 0.008, 0.16, c, 6); cr.position.set(0.4 + (i - 2) * 0.012, 0.8, -0.1 + Math.sin(i) * 0.01); cr.rotation.z = (i - 2) * 0.12; desk.add(cr); });
    at(desk, -1.9, 0, -4.55);
    S.add(desk);
    this.solid(-1.9, -4.55, 0.6, 0.28, 0.65, { noStand: true });
    const stool = new THREE.Group();
    stool.add(at(cyl(0.2, 0.2, 0.06, '#9fd8ff', 20), 0, 0.42, 0));
    for (let i = 0; i < 3; i++) { const a = (i / 3) * Math.PI * 2; stool.add(at(cyl(0.02, 0.02, 0.42, '#ffffff', 6), Math.cos(a) * 0.13, 0.21, Math.sin(a) * 0.13)); }
    at(stool, -1.9, 0, -3.95);
    S.add(stool);
    // Jacinta's drawing of Pinky Land, framed on the wall
    const drawing = new THREE.CanvasTexture(renderIntroDrawing());
    drawing.colorSpace = THREE.SRGBColorSpace;
    const frame = new THREE.Group();
    frame.add(at(box(1.4, 0.9, 0.04, '#ffffff'), 0, 0, 0));
    const pic = new THREE.Mesh(new THREE.PlaneGeometry(1.28, 0.8), new THREE.MeshStandardMaterial({ map: drawing, roughness: 0.9 }));
    pic.position.z = 0.025; frame.add(pic);
    at(frame, -1.9, 1.55, -4.81);
    S.add(frame);
    this.drawingPos = new THREE.Vector3(-1.9, 0, -4.2);
    // bookshelf on the east wall
    const bs = new THREE.Group();
    bs.add(at(rbox(0.36, 1.6, 1.1, '#ffffff', 0.02), 0, 0.8, 0));
    for (let s = 0; s < 4; s++) {
      bs.add(at(box(0.32, 0.03, 1.02, '#f0e6f5'), -0.01, 0.12 + s * 0.4, 0));
      let z = -0.46;
      const r = makeRandom(s + 11);
      while (z < 0.42) {
        const t = 0.05 + r() * 0.05, h = 0.22 + r() * 0.1;
        const b = box(0.24, h, t, ['#e0457b', '#2f7de1', '#ffd34d', '#3f9a3a', '#b48aff', '#ff9a3c'][Math.floor(r() * 6)]);
        b.position.set(-0.04, 0.14 + s * 0.4 + h / 2, z + t / 2);
        if (r() < 0.12) b.rotation.x = 0.2;
        bs.add(b);
        z += t + 0.01;
      }
    }
    at(bs, 0.7, 0, -3.5);
    S.add(bs);
    this.solid(0.7, -3.5, 0.2, 0.56, 1.6, { noStand: true });
    this.shelfPos = new THREE.Vector3(0.1, 0, -3.5);
    // toy chest with blocks and a ball
    const tc = new THREE.Group();
    tc.add(at(rbox(0.9, 0.5, 0.5, '#9fd8ff', 0.05), 0, 0.25, 0));
    tc.add(at(rbox(0.94, 0.08, 0.54, '#ffd34d', 0.03), 0, 0.52, 0));
    tc.add(at(box(0.2, 0.2, 0.02, '#ff9ec4'), 0, 0.3, 0.26));
    S.add(at(tc, -3.7, 0, -1.5));
    this.solid(-3.7, -1.5, 0.47, 0.27, 0.56);
    this.toyPos = new THREE.Vector3(-3.7, 0, -1.9);
    [['#e0457b', 'A'], ['#2f7de1', 'B'], ['#3f9a3a', 'C']].forEach(([c, letter], i) => {
      const b = box(0.16, 0.16, 0.16, new THREE.MeshStandardMaterial({ map: canvasTex(64, 64, (g2) => { g2.fillStyle = '#ffffff'; g2.fillRect(0, 0, 64, 64); g2.fillStyle = c; g2.font = 'bold 44px sans-serif'; g2.textAlign = 'center'; g2.textBaseline = 'middle'; g2.fillText(letter, 32, 34); }) }));
      b.position.set(-2.4 + i * 0.22, 0.08 + (i === 2 ? 0.16 : 0), -2.2 + (i === 2 ? 0 : 0));
      if (i === 2) b.position.x = -2.29;
      b.rotation.y = i * 0.4;
      S.add(b);
    });
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.14, 20, 14), new THREE.MeshStandardMaterial({ map: canvasTex(64, 32, (g2) => { ['#e0457b', '#ffd34d', '#2f7de1', '#3f9a3a'].forEach((c, i) => { g2.fillStyle = c; g2.fillRect(i * 16, 0, 16, 32); }); }), roughness: 0.4 }));
    ball.position.set(-1.3, 0.14, -2.4); ball.castShadow = true;
    S.add(ball);
    // glow-in-the-dark stars on the ceiling
    this.ceilingStars = new THREE.MeshStandardMaterial({ color: '#fff6c0', emissive: '#fff09a', emissiveIntensity: 0, side: THREE.DoubleSide });
    const r = makeRandom(77);
    for (let i = 0; i < 22; i++) {
      const sh = new THREE.Shape();
      for (let k = 0; k < 10; k++) { const a = (k * Math.PI) / 5, rr = k % 2 ? 0.035 : 0.08; k ? sh.lineTo(Math.cos(a) * rr, Math.sin(a) * rr) : sh.moveTo(rr, 0); }
      const st = new THREE.Mesh(new THREE.ShapeGeometry(sh), this.ceilingStars);
      st.rotation.x = Math.PI / 2; st.rotation.z = r() * 6;
      st.position.set(-5.6 + r() * 6.2, CEIL - 0.01, -4.6 + r() * 3.2);
      S.add(st);
    }
    // a little closet
    const cl = new THREE.Group();
    cl.add(at(rbox(1.1, 2.0, 0.55, '#ffffff', 0.03), 0, 1.0, 0));
    for (const x of [-0.27, 0.27]) { cl.add(at(box(0.52, 1.9, 0.02, '#ffe1ee'), x, 1.0, 0.28)); cl.add(at(cyl(0.015, 0.015, 0.2, '#d9a441', 6), x * 0.2, 1.05, 0.3)); }
    at(cl, -5.6, 0, -1.6, Math.PI / 2);
    S.add(cl);
    this.solid(-5.6, -1.6, 0.3, 0.56, 2.0, { noStand: true });
  }

  // ---------------------------------------------------------------- bathroom
  buildBath() {
    const S = this.scene;
    // bathtub along the north wall
    const tub = new THREE.Group();
    tub.add(at(rbox(1.7, 0.55, 0.75, '#ffffff', 0.12, { roughness: 0.25 }), 0, 0.28, 0));
    const water = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.58), new THREE.MeshStandardMaterial({ color: '#9fe3ff', roughness: 0.1, transparent: true, opacity: 0.8 }));
    water.rotation.x = -Math.PI / 2; water.position.y = 0.5; tub.add(water);
    // bubbles!
    for (let i = 0; i < 14; i++) { const b = new THREE.Mesh(new THREE.SphereGeometry(0.05 + Math.random() * 0.05, 10, 8), mat('#ffffff', { transparent: true, opacity: 0.85, roughness: 0.1 })); b.position.set(-0.6 + Math.random() * 1.2, 0.52, -0.22 + Math.random() * 0.44); tub.add(b); }
    // rubber duck
    const duck = new THREE.Group();
    duck.add(at(new THREE.Mesh(new THREE.SphereGeometry(0.07, 12, 10), mat('#ffd34d', { roughness: 0.4 })), 0, 0, 0));
    duck.add(at(new THREE.Mesh(new THREE.SphereGeometry(0.045, 12, 10), mat('#ffd34d', { roughness: 0.4 })), 0.04, 0.07, 0));
    duck.add(at(new THREE.Mesh(new THREE.ConeGeometry(0.02, 0.04, 8), mat('#ff8a3c')), 0.09, 0.065, 0));
    duck.children[2].rotation.z = -Math.PI / 2;
    tub.add(at(duck, 0.4, 0.55, 0.1));
    this.duck = duck;
    at(tub, 4.95, 0, -4.4);
    S.add(tub);
    this.solid(4.95, -4.4, 0.86, 0.38, 0.56, { noStand: true });
    // toilet
    const wc = new THREE.Group();
    wc.add(at(cyl(0.18, 0.15, 0.4, '#ffffff', 18, { roughness: 0.25 }), 0, 0.2, 0));
    wc.add(at(rbox(0.42, 0.04, 0.48, '#ffffff', 0.02), 0, 0.42, 0.02));
    wc.add(at(rbox(0.4, 0.45, 0.18, '#ffffff', 0.04, { roughness: 0.25 }), 0, 0.62, -0.24));
    at(wc, 1.6, 0, -4.55);
    S.add(wc);
    this.solid(1.6, -4.5, 0.22, 0.3, 0.45, { noStand: true });
    // sink and mirror on the east wall
    const sk = new THREE.Group();
    sk.add(at(rbox(0.5, 0.15, 0.6, '#ffffff', 0.06, { roughness: 0.25 }), 0, 0.82, 0));
    sk.add(at(cyl(0.05, 0.07, 0.75, '#ffffff', 12), 0, 0.38, 0));
    sk.add(at(cyl(0.015, 0.015, 0.16, mat('#b8b8c0', { metalness: 0.8, roughness: 0.3 }), 6), 0.18, 0.96, 0));
    const mirror = new THREE.Mesh(new THREE.PlaneGeometry(0.55, 0.7), new THREE.MeshBasicMaterial({ map: canvasTex(64, 80, (g2, w, h) => { const gr = g2.createLinearGradient(0, 0, w, h); gr.addColorStop(0, '#f4fbff'); gr.addColorStop(0.5, '#cfe6f7'); gr.addColorStop(1, '#eaf5ff'); g2.fillStyle = gr; g2.fillRect(0, 0, w, h); g2.fillStyle = 'rgba(255,255,255,0.8)'; g2.beginPath(); g2.moveTo(10, 0); g2.lineTo(26, 0); g2.lineTo(6, 40); g2.lineTo(0, 40); g2.fill(); }) }));
    mirror.rotation.y = -Math.PI / 2; mirror.position.set(0.255, 1.55, 0); sk.add(mirror);
    sk.add(at(box(0.02, 0.76, 0.61, '#ffb3cf'), 0.27, 1.55, 0));
    // toothbrush cup
    sk.add(at(cyl(0.035, 0.03, 0.09, '#9fd8ff', 10), 0.14, 0.94, 0.2));
    sk.add(at(cyl(0.006, 0.006, 0.14, '#ff6fae', 6), 0.14, 1.0, 0.2));
    at(sk, 5.55, 0, -2.3);
    S.add(sk);
    this.solid(5.65, -2.3, 0.28, 0.3, 0.9, { noStand: true });
    this.bathSinkPos = new THREE.Vector3(5.1, 0, -2.3);
    // towel and bath mat
    S.add(at(rbox(0.06, 0.6, 0.4, '#ffd34d', 0.03), 1.1, 1.0, -2.2));
    const bm = box(0.9, 0.02, 0.5, '#9fd8ff');
    S.add(at(bm, 4.6, 0.02, -3.65));
    this.addPlant(1.4, -1.5, 0.7);
  }

  // ---------------------------------------------------------------- lights
  buildLights() {
    this.lamps = [];
    const add = (x, z, color, power, dist = 7) => {
      const l = new THREE.PointLight(color, power, dist, 1.6);
      l.position.set(x, CEIL - 0.35, z);
      this.scene.add(l);
      // ceiling light fixture
      const f = new THREE.Mesh(new THREE.SphereGeometry(0.2, 16, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), mat('#ffffff', { emissive: '#fff0d0', emissiveIntensity: 0.4 }));
      f.position.set(x, CEIL - 0.01, z);
      this.scene.add(f);
      this.lamps.push({ l, base: power });
      return l;
    };
    add(-3.2, 2.0, '#ffe2b8', 7, 8);
    add(3.6, 2.0, '#fff2dc', 6, 7);
    add(-2.8, -3.0, '#ffd8e8', 5, 7);
    add(3.6, -3.0, '#e8f4ff', 4.5, 6);
    this.bedLamp = new THREE.PointLight('#ffcf8a', 0, 3.5, 1.8);
    this.bedLamp.position.copy(this.bedLampPos).add(new THREE.Vector3(0, 0.1, 0));
    this.scene.add(this.bedLamp);
    this.bedLampOn = false;
    // soft daylight coming in through the windows
    this.windowLight = new THREE.HemisphereLight('#fff7ea', '#d9c9b5', 0.6);
    this.scene.add(this.windowLight);
  }

  // ---------------------------------------------------------------- things to do
  buildInteractions() {
    const g = this.game;
    const say = (t, s = 3.5) => g.ui.say(t, s);
    this.addInteractable({
      pos: new THREE.Vector3(FRONT_DOOR.x, 0, FRONT_DOOR.z - 0.4), radius: 1.3, label: 'Go outside 🌳',
      action: () => g.leaveHome(),
    });
    this.addInteractable({
      pos: () => this.bedPos, radius: 1.8,
      label: () => (this.dayNight.nightAmount > 0.35 ? 'Get into bed and sleep 🌙' : 'Snuggle in bed 💤'),
      action: async () => {
        if (this.dayNight.nightAmount > 0.35) {
          await g.ui.dialogue([line(J, 'Time for bed, Pinky. Tomorrow we’ll spread more kindness!'), line(PINKY, 'Goodnight, Jacinta. Sweet dreams! 💗')]);
          g.skipToMorning();
        } else {
          g.ui.dialogue([line(J, 'It’s too sunny to sleep! But my bed is SO bouncy…'), line(PINKY, 'Jump on it! Just a little. I won’t tell. 🤭')]);
        }
      },
    });
    this.addInteractable({
      pos: () => this.drawingPos, radius: 1.5, label: 'Look at your drawing 🖍️',
      action: () => g.ui.dialogue([
        line(J, 'I drew this when I was little. That’s me… and that’s you, Pinky!'),
        line(PINKY, 'And that’s Pinky Land! The sun, the hearts, the little pinky friend… you drew it all.'),
        line(PINKY, 'It’s my favorite picture in the whole wide world. 💗'),
      ]),
    });
    const books = [
      ['The Cloud Who Was Afraid of Rain', 'A little cloud learns that rain helps flowers grow.'],
      ['Ten Tiny Turtles', 'One, two, three… all the way to ten tiny turtles going to the sea!'],
      ['Moon Socks', 'Someone keeps stealing socks. It’s the moon! She has cold feet.'],
      ['How to Be a Good Friend', 'Listen. Share. Say sorry. Give hugs. The end!'],
    ];
    this.addInteractable({
      pos: () => this.shelfPos, radius: 1.4, label: 'Read a book 📚',
      action: () => { const [t, b] = books[Math.floor(Math.random() * books.length)]; g.ui.dialogue([line(J, `“${t}.” ${b}`), line(PINKY, 'Read it again! Pleeease?')]); },
    });
    this.addInteractable({
      pos: () => this.toyPos, radius: 1.4, label: 'Play with your toys 🧸',
      action: () => g.ui.dialogue([line(J, 'Blocks, a bouncy ball, a jump rope… and my old wind-up dinosaur!'), line(PINKY, 'Rawr! Wait — that’s the friendliest dinosaur roar I’ve ever heard.')]),
    });
    this.addInteractable({
      pos: () => this.bedLampPos, radius: 1.3, label: () => (this.bedLampOn ? 'Turn off the lamp' : 'Turn on the lamp 💡'),
      action: () => { this.bedLampOn = !this.bedLampOn; g.audio.click?.(); },
    });
    this.addInteractable({
      pos: () => this.sofaPos, radius: 1.6, label: () => (this.tvOn ? 'Turn off the TV' : 'Watch cartoons 📺'),
      action: () => { this.tvOn = !this.tvOn; if (this.tvOn) say('It’s “The Bouncy Pillow Show”! Pinky’s favorite.'); },
    });
    this.addInteractable({
      pos: () => this.fridgePos, radius: 1.3, label: 'Open the fridge 🥛',
      action: () => g.ui.dialogue([line(J, 'Milk, strawberries, yogurt, and… a whole cake?!'), line(PINKY, 'Hmm, that cake must be for something special. Better not touch it!')]),
    });
    this.cookiesLeft = 4;
    this.addInteractable({
      pos: () => this.tablePos, radius: 1.5, label: () => (this.cookiesLeft > 0 ? 'Have a cookie 🍪' : 'The cookie plate is empty'),
      action: () => {
        if (this.cookiesLeft <= 0) return say('All gone! Mmm. Maybe Mrs. Rosa will bake more.');
        this.cookiesLeft--;
        this.cookies[this.cookiesLeft].visible = false;
        say(['Crunch crunch! Chocolate chip!', 'Yum! Pinky gets the crumbs.', 'Mmm, still warm!', 'Last one — saving half for Liev.'][3 - this.cookiesLeft]);
      },
    });
    this.addInteractable({
      pos: () => this.sinkPos, radius: 1.3, label: 'Get a glass of water 💧',
      action: () => say('Glug glug glug. Ahh! Water is the best drink for growing kids.'),
    });
    this.addInteractable({
      pos: () => this.bathSinkPos, radius: 1.3, label: 'Wash your hands 🧼',
      action: async () => { say('Scrub, scrub, scrub… sing “Happy Birthday” twice…', 3); await new Promise((r) => setTimeout(r, 3000)); say('All clean! Germs, be gone! ✨', 2.5); },
    });
    this.addInteractable({
      pos: () => this.duck.getWorldPosition(new THREE.Vector3()), radius: 1.4, label: 'Squeeze the rubber duck 🦆',
      action: () => { g.audio.squeak?.(); this._duckT = 0.6; },
    });
  }

  getHint() {
    return { text: 'Explore your house! When you’re ready, your friends are waiting outside. The front door is in the living room.', target: new THREE.Vector3(FRONT_DOOR.x, 0, FRONT_DOOR.z - 0.4) };
  }

  mapMarkers() { return [...this.landmarks]; }

  mapColor(x, z, h, out) {
    for (const [k, r] of Object.entries(ROOMS)) {
      if (x >= r.x0 && x <= r.x1 && z >= r.z0 && z <= r.z1) {
        const edge = Math.min(x - r.x0, r.x1 - x, z - r.z0, r.z1 - z);
        if (edge < 0.12) return out.set('#6a5a6a');
        return out.set({ living: '#e8c49a', kitchen: '#d6efe2', bedroom: '#ffd6e6', bath: '#d6eaff' }[k]);
      }
    }
    return out.set('#9fcf86');
  }

  update(dt) {
    this.baseUpdate(dt);
    const night = this.dayNight.nightAmount;
    // indoors: no harsh sun, soft window daylight by day, cosy lamps at night
    const day = 1 - night;
    this.dayNight.sun.intensity = 0.25 + day * 0.5;
    this.dayNight.hemi.intensity = 0.25 + day * 0.35;
    this.windowLight.intensity = 0.25 + day * 0.55;
    const lampK = 0.55 + night * 0.7;
    for (const lp of this.lamps) lp.l.intensity = lp.base * lampK;
    this.bedLamp.intensity = this.bedLampOn ? 2.2 : 0;
    this.bedLampShade.material.emissiveIntensity = this.bedLampOn ? 1.2 : 0;
    this.ceilingStars.emissiveIntensity = 0.15 + night * 1.6;
    this.scene.fog.near = 200; this.scene.fog.far = 900;
    if (this.tvOn || this._tvWasOn) { this._drawTV(this.time); this._tvWasOn = this.tvOn; }
    if (this._duckT > 0) { this._duckT -= dt; this.duck.scale.set(1 + this._duckT * 0.4, 1 - this._duckT * 0.5, 1 + this._duckT * 0.4); }
  }
}
