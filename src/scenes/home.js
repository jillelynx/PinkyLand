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
  bedroom: { x0: -6, x1: 1, z0: -5, z1: -1, wall: '#93a161', label: 'Jacinta’s Room', icon: '🛏️' },
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
    if (kind === 'paint') {
      // plain painted wall: just a soft roller texture
      g.fillStyle = base; g.fillRect(0, 0, w, h);
      const r = makeRandom(9);
      for (let i = 0; i < 900; i++) { g.fillStyle = r() < 0.5 ? dot : '#b3bf80'; g.globalAlpha = 0.06 + r() * 0.08; g.fillRect(r() * w, r() * h, 2 + r() * 5, 1 + r() * 3); }
      g.globalAlpha = 1;
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

// ---- pictures on Jacinta's wall (all hand-drawn here, in code)
function paperCanvas(w, h, bg = '#fbfaf6') {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  g.fillStyle = bg; g.fillRect(0, 0, w, h);
  return [c, g];
}
// a big red dragon perched on dark rocks, wings spread
function dragonPosterCanvas() {
  const [c, g] = paperCanvas(400, 292);
  const bg = g.createLinearGradient(0, 0, 0, 292);
  bg.addColorStop(0, '#3a2a2a'); bg.addColorStop(0.6, '#5a3b2b'); bg.addColorStop(1, '#241a18');
  g.fillStyle = bg; g.fillRect(0, 0, 400, 292);
  // rocks
  g.fillStyle = '#2b2422';
  g.beginPath(); g.moveTo(0, 292); g.lineTo(0, 230); g.lineTo(80, 205); g.lineTo(170, 220); g.lineTo(250, 200); g.lineTo(330, 225); g.lineTo(400, 210); g.lineTo(400, 292); g.fill();
  // wings (behind)
  const wing = (sx, dir) => {
    g.fillStyle = '#9b1f1a';
    g.beginPath(); g.moveTo(sx, 120);
    g.lineTo(sx + dir * 70, 30); g.lineTo(sx + dir * 150, 20); g.lineTo(sx + dir * 175, 60);
    g.quadraticCurveTo(sx + dir * 140, 70, sx + dir * 150, 110);
    g.quadraticCurveTo(sx + dir * 110, 105, sx + dir * 105, 140);
    g.quadraticCurveTo(sx + dir * 70, 130, sx + dir * 50, 160); g.closePath(); g.fill();
    g.strokeStyle = '#5e0f0c'; g.lineWidth = 3;
    for (const [x, y] of [[70, 30], [150, 20], [175, 60]]) { g.beginPath(); g.moveTo(sx, 120); g.lineTo(sx + dir * x, y); g.stroke(); }
  };
  wing(200, 1); wing(170, -1);
  // body + tail
  g.fillStyle = '#c4362a';
  g.beginPath(); g.ellipse(190, 175, 60, 38, -0.2, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.moveTo(140, 190); g.quadraticCurveTo(70, 230, 40, 200); g.quadraticCurveTo(80, 215, 135, 175); g.fill();
  // neck and head
  g.beginPath(); g.moveTo(215, 150); g.quadraticCurveTo(250, 100, 235, 70); g.lineTo(255, 62); g.quadraticCurveTo(270, 110, 240, 165); g.fill();
  g.beginPath(); g.ellipse(250, 62, 22, 14, -0.3, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.moveTo(262, 56); g.lineTo(292, 62); g.lineTo(266, 72); g.fill(); // snout
  g.fillStyle = '#e9d39a';
  for (const [x, y, a] of [[240, 48, -0.6], [252, 46, -0.3]]) { g.save(); g.translate(x, y); g.rotate(a); g.beginPath(); g.moveTo(-3, 0); g.lineTo(0, -18); g.lineTo(3, 0); g.fill(); g.restore(); }
  g.fillStyle = '#ffd34d'; g.beginPath(); g.arc(256, 58, 3, 0, Math.PI * 2); g.fill();
  // belly scales and legs
  g.fillStyle = '#e07a4a'; g.beginPath(); g.ellipse(205, 190, 32, 16, -0.2, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#a82a20';
  for (const x of [165, 215]) { g.beginPath(); g.ellipse(x, 212, 12, 18, 0, 0, Math.PI * 2); g.fill(); }
  // a little glow
  const gl = g.createRadialGradient(330, 60, 0, 330, 60, 120); gl.addColorStop(0, 'rgba(255,170,90,0.35)'); gl.addColorStop(1, 'rgba(255,170,90,0)');
  g.fillStyle = gl; g.fillRect(0, 0, 400, 292);
  return c;
}
// Jacinta's drawing of cats saying "Meow"
function catDrawingCanvas() {
  const [c, g] = paperCanvas(160, 206);
  g.lineCap = 'round'; g.lineWidth = 3;
  const cat = (x, y, s, col) => {
    g.strokeStyle = col;
    g.beginPath(); g.arc(x, y, 14 * s, 0, Math.PI * 2); g.stroke();
    g.beginPath(); g.moveTo(x - 12 * s, y - 7 * s); g.lineTo(x - 10 * s, y - 22 * s); g.lineTo(x - 2 * s, y - 13 * s); g.moveTo(x + 12 * s, y - 7 * s); g.lineTo(x + 10 * s, y - 22 * s); g.lineTo(x + 2 * s, y - 13 * s); g.stroke();
    g.fillStyle = col; for (const sx of [-1, 1]) { g.beginPath(); g.arc(x + sx * 5 * s, y - 2 * s, 1.8 * s, 0, 7); g.fill(); }
    g.beginPath(); g.moveTo(x - 3 * s, y + 5 * s); g.quadraticCurveTo(x, y + 8 * s, x + 3 * s, y + 5 * s); g.stroke();
  };
  cat(46, 50, 1, '#ff4fa0'); cat(118, 44, 0.9, '#ff4fa0'); cat(110, 150, 1.1, '#ff4fa0'); cat(40, 160, 0.8, '#ff7ab8');
  g.fillStyle = '#ff4fa0'; g.font = 'bold 22px "Comic Sans MS", "Chalkboard SE", sans-serif';
  g.save(); g.translate(40, 105); g.rotate(-0.15); g.fillText('Meow', 0, 0); g.restore();
  g.fillStyle = '#ff9a3c'; g.font = 'bold 18px "Comic Sans MS", sans-serif'; g.fillText('MEOW', 70, 120);
  g.strokeStyle = '#ffd34d'; g.lineWidth = 2;
  for (const [x, y] of [[20, 20], [140, 100], [25, 120], [140, 190]]) { g.beginPath(); g.moveTo(x - 6, y); g.lineTo(x + 6, y); g.moveTo(x, y - 6); g.lineTo(x, y + 6); g.stroke(); }
  return c;
}
// a school flyer for Glow Dance Day
function flyerCanvas() {
  const [c, g] = paperCanvas(160, 124);
  g.fillStyle = '#222'; g.fillRect(10, 40, 140, 34);
  g.fillStyle = '#7dff9a'; g.font = 'bold 19px sans-serif'; g.textAlign = 'center'; g.fillText('Glow Dance Day!', 80, 63);
  g.fillStyle = '#ff6fae'; g.font = 'bold 14px sans-serif'; g.fillText('Friday', 80, 96);
  g.fillStyle = '#ffd34d'; g.beginPath(); g.arc(28, 20, 10, 0, 7); g.fill();
  g.fillStyle = '#66c2ff'; g.beginPath(); g.arc(132, 20, 8, 0, 7); g.fill();
  return c;
}
// a page from school with pencil writing
function pencilPageCanvas() {
  const [c, g] = paperCanvas(120, 150);
  g.strokeStyle = 'rgba(80,80,90,0.55)'; g.lineWidth = 1.4;
  g.fillStyle = '#555'; g.font = '12px sans-serif'; g.fillText('100%  ★', 60, 18);
  for (let y = 34; y < 140; y += 14) { g.beginPath(); g.moveTo(10, y); for (let x = 10; x < 100 + (y % 28); x += 6) g.lineTo(x, y + Math.sin(x * 0.7 + y) * 2); g.stroke(); }
  return c;
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
      bedroom: new THREE.MeshStandardMaterial({ map: woodTex(), color: '#e6c3a5', roughness: 0.6 }),
      bath: new THREE.MeshStandardMaterial({ map: tileTex('#ffffff', '#cfe6fb', 10), roughness: 0.35 }),
    };
    const papers = {
      living: wallpaperTex('#fff1dc', '#f6dcbc', 'stripes'),
      kitchen: wallpaperTex('#e3f5ec', '#cce9db', 'dots'),
      bedroom: wallpaperTex('#9aa866', '#7f8d4e', 'paint'), // Jacinta's real room is painted olive green
      bath: wallpaperTex('#dcefff', '#c6e2fb', 'dots'),
    };
    const ceilMat = new THREE.MeshStandardMaterial({ color: '#fffaf5', roughness: 0.9, side: THREE.DoubleSide });
    // doorways and windows on each room's walls: side: n/s/e/w, c = centre, w = width
    const gaps = {
      living: { s: [{ c: FRONT_DOOR.x, w: 1.1, door: true }, { c: -3.8, w: 1.6, sill: 0.8, top: 2.0 }], n: [{ c: -0.6, w: 1.0, door: true }], e: [{ c: 2.0, w: 3.0, top: 2.3 }], w: [{ c: 2.0, w: 1.6, sill: 0.9, top: 2.0 }] },
      kitchen: { w: [{ c: 2.0, w: 3.0, top: 2.3 }], n: [{ c: 2.2, w: 1.0, door: true }], e: [{ c: 1.0, w: 1.4, sill: 1.15, top: 2.05 }], s: [{ c: 3.6, w: 1.4, sill: 0.9, top: 2.0 }] },
      bedroom: { s: [{ c: -0.6, w: 1.0, door: true }], n: [{ c: -4.75, w: 1.2, sill: 0.95, top: 2.05, lace: true, lights: true }], w: [{ c: -1.5, w: 0.75, sill: 0.95, top: 2.05, lace: true, rod: 0.25 }] },
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
    if (gp.lace) {
      this._laceWindow(g, w, h, gp, facing, axis);
      if (axis === 'x') g.position.set(gp.c, gp.sill + h / 2, fixed);
      else { g.position.set(fixed, gp.sill + h / 2, gp.c); g.rotation.y = Math.PI / 2; }
      this.scene.add(g);
      this.windowSpots.push(g.position.clone());
      return;
    }
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

  // Jacinta's windows: white blinds, rust-coloured lace curtains with little
  // tassels, and (on the big window) a string of fairy lights.
  _laceWindow(g, w, h, gp, facing, axis) {
    const inward = facing; // local +z * inward points into the room
    if (!this._laceMat) {
      const lace = canvasTex(128, 256, (c, W, H) => {
        c.fillStyle = 'rgba(172,72,44,0.85)'; c.fillRect(0, 0, W, H);
        c.globalCompositeOperation = 'destination-out';
        for (let y = 6; y < H; y += 16) for (let x = (y / 16) % 2 ? 8 : 0; x < W; x += 16) { c.beginPath(); c.ellipse(x, y, 3.2, 5, 0, 0, Math.PI * 2); c.fill(); }
        for (let y = 14; y < H; y += 32) for (let x = 0; x < W; x += 32) { c.beginPath(); c.arc(x + 16, y, 7, 0, Math.PI * 2); c.lineWidth = 2; c.strokeStyle = '#000'; c.stroke(); }
        c.globalCompositeOperation = 'source-over';
        c.strokeStyle = 'rgba(120,40,22,0.6)'; c.lineWidth = 2;
        for (let x = 4; x < W; x += 16) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, H); c.stroke(); }
      }, [3, 4]);
      this._laceMat = new THREE.MeshStandardMaterial({ map: lace, transparent: true, side: THREE.DoubleSide, roughness: 1, depthWrite: false, alphaTest: 0.05 });
      this._blindMat = new THREE.MeshStandardMaterial({ map: canvasTex(32, 128, (c, W, H) => { c.fillStyle = '#ffffff'; c.fillRect(0, 0, W, H); c.fillStyle = 'rgba(150,140,130,0.45)'; for (let y = 0; y < H; y += 8) c.fillRect(0, y, W, 1.5); }), emissive: '#fff4e0', emissiveIntensity: 0.35, roughness: 0.8, side: THREE.DoubleSide });
    }
    // blinds pulled most of the way down, glowing with daylight
    const blind = new THREE.Mesh(new THREE.PlaneGeometry(w - 0.06, h * 0.72), this._blindMat);
    blind.position.set(0, h * 0.14, 0.03 * inward);
    g.add(blind);
    // curtain rod
    const rodLen = w + (gp.rod ?? 0.9);
    const rod = cyl(0.012, 0.012, rodLen, mat('#1a1a1a', { roughness: 0.4 }), 8);
    rod.rotation.z = Math.PI / 2; rod.position.set(0, h / 2 + 0.2, 0.16 * inward); g.add(rod);
    for (const sgn of [-1, 1]) { const fin = new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 6), mat('#1a1a1a')); fin.position.set(sgn * rodLen / 2, h / 2 + 0.2, 0.16 * inward); g.add(fin); }
    // two lace panels, gently gathered (wavy), partly drawn across the window
    const panelW = w * 0.62, panelH = h + 0.45;
    const tm = mat('#9c3f22', { roughness: 1 });
    for (const sgn of [-1, 1]) {
      const geo = new THREE.PlaneGeometry(panelW, panelH, 16, 1);
      const pos = geo.attributes.position;
      for (let i = 0; i < pos.count; i++) pos.setZ(i, Math.sin(pos.getX(i) * 26) * 0.03);
      geo.computeVertexNormals();
      const panel = new THREE.Mesh(geo, this._laceMat);
      panel.position.set(sgn * (w / 2 - panelW / 2 + 0.06), h / 2 + 0.2 - panelH / 2, 0.15 * inward);
      g.add(panel);
      // little tassels along the outer edge and the bottom
      const ox = panel.position.x + sgn * panelW / 2;
      for (let k = 0; k < 9; k++) { const t = new THREE.Mesh(new THREE.SphereGeometry(0.014, 6, 4), tm); t.position.set(ox, panel.position.y + panelH / 2 - 0.1 - k * (panelH / 9), panel.position.z); g.add(t); }
      for (let k = 0; k < 7; k++) { const t = new THREE.Mesh(new THREE.SphereGeometry(0.014, 6, 4), tm); t.position.set(panel.position.x - panelW / 2 + 0.04 + k * (panelW / 7), panel.position.y - panelH / 2, panel.position.z); g.add(t); }
    }
    if (gp.lights) {
      // fairy lights draped across the window
      this.fairyMat = this.fairyMat || mat('#fff1b0', { emissive: '#ffd77a', emissiveIntensity: 1.2 });
      for (let k = 0; k <= 22; k++) {
        const u = k / 22, x = (u - 0.5) * (w + 0.5), y = h / 2 + 0.07 - Math.sin(u * Math.PI * 3) ** 2 * 0.22;
        const b = new THREE.Mesh(new THREE.SphereGeometry(0.018, 6, 5), this.fairyMat);
        b.position.set(x, y, 0.19 * inward); g.add(b);
      }
    }
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
  // Modelled on photos of Jacinta's real room: olive-green walls, a twin bed with a
  // dark headboard and a navy star-and-moon blanket, a black nightstand with a silver
  // lamp, a whitewashed dresser, pink tie-dye cat shelves on the wall, a fluffy pink
  // rug, a white cube desk with a dragon poster, drawings and towels, and a white
  // closet with arched doors.
  buildBedroom() {
    const S = this.scene;
    const IN = { w: -5.84, e: 0.84, n: -4.84, s: -1.16 }; // inside faces of the walls

    // ---- fluffy pink shag rug
    const shag = canvasTex(256, 192, (g2, w, h) => {
      g2.fillStyle = '#f3a9c0'; g2.fillRect(0, 0, w, h);
      const r = makeRandom(21);
      for (let i = 0; i < 2600; i++) {
        const x = r() * w, y = r() * h, a = r() * Math.PI * 2, l = 3 + r() * 6;
        g2.strokeStyle = r() < 0.5 ? '#fbc7d7' : '#e48aa8'; g2.globalAlpha = 0.5; g2.lineWidth = 1.4;
        g2.beginPath(); g2.moveTo(x, y); g2.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g2.stroke();
      }
      g2.globalAlpha = 1;
    });
    const rugGeo = new RoundedBoxGeometry(2.7, 0.05, 1.75, 2, 0.02);
    const rug = new THREE.Mesh(rugGeo, new THREE.MeshStandardMaterial({ map: shag, roughness: 1 }));
    rug.position.set(-2.9, 0.03, -2.85); rug.receiveShadow = true;
    S.add(rug);
    // a soft fuzzy edge
    const fuzz = mat('#f6b6ca', { roughness: 1 });
    for (let i = 0; i < 70; i++) {
      const u = i / 70, per = 2 * (2.7 + 1.75), d = u * per;
      let x, z;
      if (d < 2.7) { x = -1.35 + d; z = -0.875; } else if (d < 2.7 + 1.75) { x = 1.35; z = -0.875 + d - 2.7; } else if (d < 5.4 + 1.75) { x = 1.35 - (d - 4.45); z = 0.875; } else { x = -1.35; z = 0.875 - (d - 7.15); }
      const f = new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 4), fuzz);
      f.scale.y = 0.45; f.position.set(-2.9 + x, 0.04, -2.85 + z); S.add(f);
    }

    // ---- twin bed: headboard against the west wall, long side under the north window
    const bed = new THREE.Group();
    const L = 1.95, Wd = 1.0;
    bed.add(at(rbox(L, 0.24, Wd, '#2a2523', 0.03), 0, 0.14, 0)); // dark frame
    // white quilted mattress
    const quiltTex = canvasTex(128, 64, (g2, w, h) => {
      g2.fillStyle = '#f7f6f2'; g2.fillRect(0, 0, w, h);
      g2.strokeStyle = 'rgba(160,160,170,0.5)'; g2.lineWidth = 1;
      for (let x = -h; x < w; x += 10) { g2.beginPath(); g2.moveTo(x, 0); g2.lineTo(x + h, h); g2.stroke(); g2.beginPath(); g2.moveTo(x + h, 0); g2.lineTo(x, h); g2.stroke(); }
    }, [3, 2]);
    bed.add(at(rbox(L - 0.05, 0.24, Wd - 0.04, new THREE.MeshStandardMaterial({ map: quiltTex, roughness: 0.95 }), 0.07), 0, 0.37, 0));
    // dark tufted headboard
    const tuft = canvasTex(128, 96, (g2, w, h) => {
      g2.fillStyle = '#2e2826'; g2.fillRect(0, 0, w, h);
      for (let y = 12; y < h; y += 22) for (let x = (y / 22) % 2 ? 22 : 11; x < w; x += 22) {
        const gr = g2.createRadialGradient(x, y, 0, x, y, 9); gr.addColorStop(0, 'rgba(0,0,0,0.6)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
        g2.fillStyle = gr; g2.fillRect(x - 9, y - 9, 18, 18);
      }
    });
    const hb = rbox(0.1, 1.12, Wd + 0.06, new THREE.MeshStandardMaterial({ map: tuft, roughness: 0.9 }), 0.04);
    bed.add(at(hb, -L / 2 - 0.02, 0.62, 0));
    // two beige pillows
    for (const z of [-0.22, 0.2]) { const pl = rbox(0.36, 0.13, 0.46, '#d9c7b4', 0.06); pl.rotation.z = 0.35; bed.add(at(pl, -L / 2 + 0.25, 0.56, z)); }
    // navy blanket with white stars and moons, rumpled at the foot
    const starTex = canvasTex(256, 256, (g2, w, h) => {
      g2.fillStyle = '#1e3a7a'; g2.fillRect(0, 0, w, h);
      const r = makeRandom(5);
      g2.fillStyle = '#ffffff';
      for (let i = 0; i < 22; i++) {
        const x = r() * w, y = r() * h, rr = 6 + r() * 6;
        if (r() < 0.45) { g2.beginPath(); g2.arc(x, y, rr, 0, Math.PI * 2); g2.fill(); g2.fillStyle = '#1e3a7a'; g2.beginPath(); g2.arc(x + rr * 0.5, y - rr * 0.2, rr, 0, Math.PI * 2); g2.fill(); g2.fillStyle = '#ffffff'; }
        else { g2.beginPath(); for (let k = 0; k < 10; k++) { const a = -Math.PI / 2 + (k * Math.PI) / 5, q = k % 2 ? rr * 0.45 : rr; g2.lineTo(x + Math.cos(a) * q, y + Math.sin(a) * q); } g2.fill(); }
      }
    }, [2, 2]);
    const blGeo = new THREE.BoxGeometry(1.25, 0.08, Wd + 0.12, 14, 1, 8);
    const bp = blGeo.attributes.position;
    for (let i = 0; i < bp.count; i++) {
      const x = bp.getX(i), z = bp.getZ(i);
      bp.setY(i, bp.getY(i) + Math.sin(x * 7 + z * 3) * 0.04 + Math.max(0, 0.3 - Math.abs(x + 0.25)) * 0.35 * Math.cos(z * 3)); // a little heap
      if (Math.abs(z) > Wd / 2) bp.setY(i, bp.getY(i) - (Math.abs(z) - Wd / 2) * 2.2); // drapes over the sides
    }
    blGeo.computeVertexNormals();
    const blanket = new THREE.Mesh(blGeo, new THREE.MeshStandardMaterial({ map: starTex, roughness: 0.95 }));
    blanket.castShadow = true;
    bed.add(at(blanket, 0.32, 0.53, 0));
    // stuffies on the bed: a white bunny, a green turtle and a teddy
    const plush = (c) => mat(c, { roughness: 1 });
    const bunny = new THREE.Group();
    bunny.add(at(new THREE.Mesh(new THREE.SphereGeometry(0.11, 12, 10), plush('#ffffff')), 0, 0.1, 0));
    bunny.add(at(new THREE.Mesh(new THREE.SphereGeometry(0.08, 12, 10), plush('#ffffff')), 0, 0.24, 0));
    for (const sg of [-1, 1]) { const e = new THREE.Mesh(new THREE.CapsuleGeometry(0.025, 0.12, 4, 8), plush('#ffffff')); e.position.set(sg * 0.035, 0.36, 0); e.rotation.z = sg * 0.2; bunny.add(e); }
    for (const sg of [-1, 1]) bunny.add(at(new THREE.Mesh(new THREE.SphereGeometry(0.01, 6, 6), mat('#222')), sg * 0.03, 0.26, 0.07));
    bed.add(at(bunny, -0.5, 0.5, 0.3, Math.PI / 2));
    const turtle = new THREE.Group();
    const shell = new THREE.Mesh(new THREE.SphereGeometry(0.11, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), plush('#5aa86a'));
    turtle.add(shell);
    turtle.add(at(new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 8), plush('#9fd6a0')), 0.12, 0.03, 0));
    bed.add(at(turtle, 0.25, 0.68, -0.05, 0.4));
    const teddy = new THREE.Group();
    const fur = plush('#d8b98f');
    teddy.add(at(new THREE.Mesh(new THREE.SphereGeometry(0.1, 14, 10), fur), 0, 0.1, 0));
    teddy.add(at(new THREE.Mesh(new THREE.SphereGeometry(0.075, 14, 10), fur), 0, 0.24, 0.01));
    for (const sg of [-1, 1]) teddy.add(at(new THREE.Mesh(new THREE.SphereGeometry(0.028, 8, 6), fur), sg * 0.05, 0.31, 0));
    for (const sg of [-1, 1]) teddy.add(at(new THREE.Mesh(new THREE.SphereGeometry(0.01, 6, 6), mat('#222')), sg * 0.028, 0.26, 0.065));
    bed.add(at(teddy, -0.62, 0.5, -0.25, Math.PI / 2));
    bed.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    const bedX = IN.w + 0.03 + L / 2, bedZ = IN.n + 0.02 + Wd / 2;
    at(bed, bedX, 0, bedZ);
    S.add(bed);
    this.shadowBlob(bedX, bedZ, 2.4, 1.4);
    this.solid(bedX, bedZ, L / 2, Wd / 2, 0.5);
    // the bed is a little bit bouncy (of course!)
    this.world.bouncers.push({ x: bedX + 0.3, z: bedZ, r: 0.5, top: 0.52, power: 8.5, onBounce: () => this.game.audio.bounce() });
    this.bedPos = new THREE.Vector3(bedX + 0.3, 0.5, bedZ + 0.2);

    // ---- black nightstand with a silver ribbed lamp and a white pleated shade
    const ns = new THREE.Group();
    ns.add(at(rbox(0.46, 0.6, 0.46, '#1d1b1c', 0.02, { roughness: 0.5 }), 0, 0.3, 0));
    ns.add(at(box(0.01, 0.15, 0.38, '#2c292a'), 0.235, 0.46, 0)); // drawer
    ns.add(at(box(0.015, 0.02, 0.1, '#9a9aa0', { metalness: 0.8 }), 0.245, 0.46, 0));
    ns.add(at(box(0.42, 0.02, 0.42, '#2c292a'), 0, 0.2, 0)); // open shelf
    ns.add(at(box(0.3, 0.06, 0.24, '#7d5f8f'), 0, 0.24, 0)); // books on the shelf
    const silver = mat('#cfd3da', { metalness: 0.9, roughness: 0.22 });
    const base = new THREE.Mesh(new THREE.LatheGeometry([...Array(14)].map((_, i) => new THREE.Vector2(0.03 + Math.sin((i / 13) * Math.PI) * 0.075 + (i % 2) * 0.006, i * 0.018)), 20), silver);
    base.position.y = 0.61; base.castShadow = true; ns.add(base);
    ns.add(at(cyl(0.008, 0.008, 0.14, silver, 6), 0, 0.92, 0));
    const pleat = canvasTex(128, 32, (g2, w, h) => { for (let x = 0; x < w; x += 4) { g2.fillStyle = (x / 4) % 2 ? '#f7f3ea' : '#e6e0d4'; g2.fillRect(x, 0, 4, h); } });
    this.bedLampShade = cyl(0.1, 0.16, 0.2, new THREE.MeshStandardMaterial({ map: pleat, emissive: '#ffd98a', emissiveIntensity: 0, roughness: 0.9 }), 24);
    ns.add(at(this.bedLampShade, 0, 1.02, 0));
    ns.add(at(new THREE.Mesh(new THREE.SphereGeometry(0.035, 10, 8), mat('#f2c2d6', { roughness: 1 })), -0.12, 0.64, 0.12)); // tiny plush
    const nsZ = bedZ + Wd / 2 + 0.28;
    at(ns, IN.w + 0.25, 0, nsZ);
    S.add(ns);
    this.solid(IN.w + 0.25, nsZ, 0.24, 0.24, 0.6, { noStand: true });
    this.bedLampPos = new THREE.Vector3(IN.w + 0.25, 1.0, nsZ);

    // ---- pink tie-dye cat shelves + a sisal cat post on the west wall
    const tie = canvasTex(128, 64, (g2, w, h) => {
      const cols = ['#f7a6c9', '#c8a2f0', '#9fd2f5', '#f9c9a0', '#f6d1e8'];
      const r = makeRandom(31);
      g2.fillStyle = '#f7b8d2'; g2.fillRect(0, 0, w, h);
      for (let i = 0; i < 40; i++) { const gr = g2.createRadialGradient(r() * w, r() * h, 0, r() * w, r() * h, 20 + r() * 25); const c = cols[Math.floor(r() * cols.length)]; gr.addColorStop(0, c); gr.addColorStop(1, c + '00'); g2.fillStyle = gr; g2.fillRect(0, 0, w, h); }
    });
    const tieMat = new THREE.MeshStandardMaterial({ map: tie, roughness: 1 });
    const blackM = mat('#151515', { roughness: 0.5 });
    const catShelf = (z, y, len = 0.42, depth = 0.3) => {
      const g2 = new THREE.Group();
      g2.add(at(rbox(depth, 0.05, len, tieMat, 0.02), 0, 0, 0));
      for (const sz of [-1, 1]) { // black L brackets
        g2.add(at(box(0.02, 0.16, 0.02, blackM), -depth / 2 + 0.01, -0.1, sz * (len / 2 - 0.06)));
        const d = box(0.02, 0.2, 0.02, blackM); d.rotation.z = 0.9; g2.add(at(d, -depth / 2 + 0.08, -0.08, sz * (len / 2 - 0.06)));
      }
      at(g2, IN.w + depth / 2, y, z); S.add(g2);
      return g2;
    };
    // box perch with a tie-dye cube and a scratching post (above the headboard)
    catShelf(bedZ + 0.05, 1.5, 0.6);
    catShelf(bedZ + 0.05, 2.05, 0.6);
    S.add(at(rbox(0.26, 0.5, 0.26, tieMat, 0.04), IN.w + 0.15, 1.78, bedZ + 0.17));
    const sisal = new THREE.MeshStandardMaterial({ map: canvasTex(32, 64, (g2, w, h) => { g2.fillStyle = '#e6d6b4'; g2.fillRect(0, 0, w, h); g2.strokeStyle = 'rgba(150,120,80,0.6)'; for (let y = 0; y < h; y += 3) { g2.beginPath(); g2.moveTo(0, y); g2.lineTo(w, y + 1.5); g2.stroke(); } }, [2, 6]), roughness: 1 });
    S.add(at(cyl(0.045, 0.045, 0.5, sisal, 10), IN.w + 0.15, 1.78, bedZ - 0.2));
    catShelf(nsZ - 0.05, 2.25, 0.36);
    // the tall cat post (floor to ceiling-ish), between the nightstand and the dresser
    const postZ = nsZ + 0.42;
    S.add(at(cyl(0.06, 0.06, 1.85, sisal, 12), IN.w + 0.17, 0.95, postZ));
    for (const y of [0.62, 1.12, 1.62, 1.9]) S.add(at(rbox(0.3, 0.04, 0.32, tieMat, 0.015), IN.w + 0.17, y, postZ));
    this.solid(IN.w + 0.17, postZ, 0.08, 0.08, 1.9, { noStand: true });
    // dangly cat toys
    for (const [y, z, c] of [[1.45, postZ + 0.12, '#ff9a3c'], [0.95, postZ - 0.12, '#ffd34d']]) {
      S.add(at(cyl(0.003, 0.003, 0.3, '#888', 4), IN.w + 0.2, y + 0.15, z));
      S.add(at(new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), mat(c, { roughness: 1 })), IN.w + 0.2, y, z));
    }
    // the wavy hanging cat bridge
    const bridgeZ0 = postZ + 0.25, bridgeZ1 = -2.15;
    catShelf(bridgeZ1 - 0.12, 2.2, 0.3);
    const bpts = [];
    for (let i = 0; i <= 20; i++) { const u = i / 20; bpts.push(new THREE.Vector3(IN.w + 0.13, 2.2 - Math.sin(u * Math.PI) * 0.2 + Math.sin(u * Math.PI * 3) * 0.04, bridgeZ0 + (bridgeZ1 - bridgeZ0) * u)); }
    const bridge = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(bpts), 30, 0.07, 8), tieMat);
    bridge.scale.set(1, 1, 1); bridge.castShadow = true;
    S.add(bridge);

    // ---- whitewashed 4-drawer dresser with silver knobs
    const wash = canvasTex(64, 128, (g2, w, h) => {
      g2.fillStyle = '#ebe5da'; g2.fillRect(0, 0, w, h);
      const r = makeRandom(8);
      for (let i = 0; i < 60; i++) { g2.strokeStyle = `rgba(170,150,120,${0.08 + r() * 0.1})`; g2.lineWidth = 1; const y = r() * h; g2.beginPath(); g2.moveTo(0, y); g2.bezierCurveTo(w / 3, y + 2, (2 * w) / 3, y - 2, w, y); g2.stroke(); }
    });
    const washM = new THREE.MeshStandardMaterial({ map: wash, roughness: 0.75 });
    const dr = new THREE.Group();
    const DW = 0.82, DH = 1.12, DD = 0.46;
    dr.add(at(rbox(DD, DH, DW, washM, 0.02), 0, DH / 2 + 0.04, 0));
    dr.add(at(rbox(DD + 0.03, 0.035, DW + 0.03, washM, 0.01), 0, DH + 0.05, 0));
    for (let k = 0; k < 4; k++) {
      const y = 0.2 + k * 0.255;
      dr.add(at(rbox(0.02, 0.22, DW - 0.08, washM, 0.01), DD / 2 + 0.005, y, 0));
      for (const sz of [-1, 1]) dr.add(at(new THREE.Mesh(new THREE.SphereGeometry(0.02, 10, 8), silver), DD / 2 + 0.03, y, sz * 0.2));
    }
    // things on top: a little glass lamp, a unicorn plush, a cup
    dr.add(at(cyl(0.05, 0.05, 0.16, mat('#e8f4ff', { transparent: true, opacity: 0.5, roughness: 0.1, emissive: '#fff1c8', emissiveIntensity: 0.3 }), 14), -0.05, DH + 0.15, -0.28));
    dr.add(at(new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 8), plush('#f7f2ff')), 0, DH + 0.12, 0.1));
    dr.add(at(new THREE.Mesh(new THREE.SphereGeometry(0.04, 10, 8), plush('#ffb3cf')), 0.05, DH + 0.1, 0.24));
    const drZ = postZ + 0.3 + DW / 2;
    at(dr, IN.w + DD / 2, 0, drZ);
    S.add(dr);
    this.shadowBlob(IN.w + DD / 2, drZ, 0.8, 1.1);
    this.solid(IN.w + DD / 2, drZ, DD / 2, DW / 2, DH + 0.06, { noStand: true });
    this.dresserPos = new THREE.Vector3(IN.w + DD + 0.35, 0, drZ);

    // ---- a toy sword hanging on the north wall, next to the window
    const sword = new THREE.Group();
    sword.add(at(box(0.06, 0.62, 0.012, mat('#2a3550', { metalness: 0.5, roughness: 0.4 })), 0, 0.12, 0));
    sword.add(at(box(0.02, 0.6, 0.016, mat('#8fa3c8', { metalness: 0.6, roughness: 0.3 })), 0, 0.12, 0.004));
    sword.add(at(box(0.2, 0.04, 0.03, '#1a1a1a'), 0, -0.2, 0));
    sword.add(at(cyl(0.018, 0.018, 0.16, '#1a1a1a', 8), 0, -0.3, 0));
    sword.add(at(new THREE.Mesh(new THREE.SphereGeometry(0.028, 8, 6), mat('#1a1a1a')), 0, -0.39, 0));
    at(sword, -3.25, 1.55, IN.n + 0.02);
    S.add(sword);
    this.swordPos = new THREE.Vector3(-3.25, 0, IN.n + 0.7);

    // ---- east wall: white closet with arched bifold doors (north end)
    const cl = new THREE.Group();
    const clW = 1.25;
    const arch = canvasTex(64, 256, (g2, w, h) => {
      g2.fillStyle = '#fbfbf8'; g2.fillRect(0, 0, w, h);
      g2.strokeStyle = 'rgba(150,150,150,0.55)'; g2.lineWidth = 2;
      const panel = (y0, y1, arched) => { g2.beginPath(); g2.moveTo(10, y1); g2.lineTo(10, y0 + (arched ? 14 : 0)); if (arched) g2.quadraticCurveTo(w / 2, y0 - 10, w - 10, y0 + 14); else g2.lineTo(w - 10, y0); g2.lineTo(w - 10, y1); g2.closePath(); g2.stroke(); };
      panel(16, 150, true); panel(166, 244, false);
    });
    const doorM = new THREE.MeshStandardMaterial({ map: arch, roughness: 0.6 });
    cl.add(at(box(0.05, 2.12, clW + 0.12, '#ffffff'), 0, 1.06, 0)); // frame
    for (let k = 0; k < 4; k++) {
      const d = box(0.04, 2.0, clW / 4 - 0.01, doorM);
      d.material = [mat('#ffffff'), doorM, mat('#ffffff'), mat('#ffffff'), mat('#ffffff'), mat('#ffffff')];
      cl.add(at(d, -0.035 - (k % 2) * 0.012, 1.02, -clW / 2 + clW / 8 + k * (clW / 4)));
    }
    for (const z of [-0.03, 0.03]) cl.add(at(new THREE.Mesh(new THREE.SphereGeometry(0.025, 8, 6), silver), -0.08, 1.0, z));
    const clZ = IN.n + 0.12 + clW / 2;
    at(cl, IN.e, 0, clZ);
    S.add(cl);
    this.closetPos = new THREE.Vector3(IN.e - 0.7, 0, clZ);
    // a mint-green ball in front of the closet
    S.add(at(new THREE.Mesh(new THREE.SphereGeometry(0.17, 18, 12), mat('#7fd0b8', { roughness: 0.5 })), IN.e - 0.25, 0.17, IN.n + 0.3));

    // ---- east wall: the white cube desk / shelf unit
    const white = mat('#f6f5f1', { roughness: 0.6 });
    const unit = new THREE.Group();
    const UD = 0.4; // depth (x)
    const cubeLen = 0.95, deskLen = 1.05; // along z
    // cube shelves (3 x 3) next to the closet
    const cH = 0.95;
    unit.add(at(box(UD, 0.03, cubeLen, white), 0, cH, -deskLen / 2));
    unit.add(at(box(UD, 0.03, cubeLen, white), 0, 0.02, -deskLen / 2));
    for (let k = 0; k <= 3; k++) unit.add(at(box(UD, cH, 0.025, white), 0, cH / 2, -deskLen / 2 - cubeLen / 2 + k * (cubeLen / 3)));
    for (let k = 1; k < 3; k++) unit.add(at(box(UD, 0.025, cubeLen, white), 0, k * (cH / 3), -deskLen / 2));
    unit.add(at(box(0.02, cH, cubeLen, white), UD / 2 - 0.01, cH / 2, -deskLen / 2)); // back
    // desk part (toward the door)
    const dH = 0.78;
    unit.add(at(box(UD, 0.03, deskLen, white), 0, dH, deskLen / 2));
    unit.add(at(box(UD, dH, 0.025, white), 0, dH / 2, deskLen - 0.01));
    unit.add(at(box(UD, 0.025, deskLen * 0.45, white), 0, dH - 0.2, deskLen * 0.75));
    unit.add(at(box(UD, dH - 0.2, 0.025, white), 0, (dH - 0.2) / 2, deskLen * 0.52));
    // things in the cubes: books, a bin, a box, little toys
    const r = makeRandom(44);
    const cubeCenter = (i, j) => [-deskLen / 2 - cubeLen / 2 + cubeLen / 6 + i * (cubeLen / 3), j * (cH / 3) + 0.03];
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) {
      const [z, y] = cubeCenter(i, j);
      const pick = (i * 3 + j) % 4;
      if (pick === 0) { let zz = z - 0.12; while (zz < z + 0.1) { const t = 0.03 + r() * 0.03, h = 0.16 + r() * 0.08; unit.add(at(box(0.22, h, t, ['#e0457b', '#2f7de1', '#ffd34d', '#3f9a3a', '#b48aff'][Math.floor(r() * 5)]), 0.02, y + h / 2, zz + t / 2)); zz += t + 0.005; } }
      else if (pick === 1) unit.add(at(rbox(0.3, 0.2, 0.26, '#c9a27a', 0.01), 0, y + 0.1, z));
      else if (pick === 2) unit.add(at(new THREE.Mesh(new THREE.DodecahedronGeometry(0.06), mat(['#7fd0a0', '#c8a2f0', '#9fd8ff'][j], { roughness: 0.6 })), -0.02, y + 0.07, z));
      else unit.add(at(rbox(0.28, 0.2, 0.26, '#ffd34d', 0.02), 0, y + 0.1, z));
    }
    // on top of the cubes: a stack of books, a little dragon figure, a bunny figure
    for (let k = 0; k < 5; k++) unit.add(at(box(0.22, 0.035, 0.28, ['#e0457b', '#2f7de1', '#3f9a3a', '#ff9a3c', '#ffd34d'][k]), 0, cH + 0.03 + k * 0.036, -deskLen / 2 - 0.2));
    unit.add(at(new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.12, 8), mat('#c47ad0')), 0, cH + 0.08, -deskLen / 2 + 0.25));
    unit.add(at(new THREE.Mesh(new THREE.CapsuleGeometry(0.035, 0.08, 4, 8), mat('#e8c49a')), 0, cH + 0.08, -deskLen / 2 + 0.05));
    // on the desk: jars, crayons, papers
    unit.add(at(cyl(0.06, 0.06, 0.16, mat('#9fd0c8', { transparent: true, opacity: 0.55, roughness: 0.1 }), 14), 0, dH + 0.09, deskLen / 2 - 0.15));
    unit.add(at(cyl(0.05, 0.05, 0.12, '#3a2a2a', 14), 0, dH + 0.07, deskLen / 2 - 0.32));
    unit.add(at(box(0.26, 0.006, 0.34, '#fffaf0'), -0.02, dH + 0.02, deskLen / 2 + 0.15));
    unit.add(at(cyl(0.045, 0.045, 0.11, '#ffffff', 12), 0.02, dH + 0.07, deskLen / 2 + 0.38));
    ['#e0457b', '#ffd34d', '#2f7de1', '#3f9a3a', '#ff9a3c'].forEach((c, i) => { const cr = cyl(0.007, 0.007, 0.15, c, 6); cr.position.set(0.02 + (i - 2) * 0.01, dH + 0.17, deskLen / 2 + 0.38); cr.rotation.z = (i - 2) * 0.12; unit.add(cr); });
    // under the desk: a white laundry basket and a yellow bin
    const basket = new THREE.Group();
    const bm = mat('#fafafa', { roughness: 0.5 });
    basket.add(at(box(0.32, 0.02, 0.44, bm), 0, 0.01, 0));
    for (const sz of [-1, 1]) basket.add(at(box(0.32, 0.26, 0.02, bm), 0, 0.13, sz * 0.22));
    for (const sx of [-1, 1]) basket.add(at(box(0.02, 0.26, 0.44, bm), sx * 0.16, 0.13, 0));
    basket.add(at(rbox(0.26, 0.14, 0.38, '#6a8fc8', 0.04), 0, 0.14, 0)); // clothes
    unit.add(at(basket, -0.02, 0, deskLen * 0.25));
    unit.add(at(rbox(0.28, 0.22, 0.24, '#ffd34d', 0.02), -0.03, 0.11, deskLen * 0.76));
    const unitZ = clZ + clW / 2 + 0.08 + deskLen / 2 + cubeLen;
    at(unit, IN.e - UD / 2, 0, unitZ - deskLen / 2);
    unit.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    S.add(unit);
    const ux = IN.e - UD / 2, G0 = unitZ - deskLen / 2, uz0 = G0 - deskLen / 2 - cubeLen / 2, uz1 = G0 + deskLen;
    this.solid(ux, (uz0 + uz1) / 2, UD / 2, (uz1 - uz0) / 2, cH, { noStand: true });
    this.shadowBlob(ux, (uz0 + uz1) / 2, 0.6, uz1 - uz0);
    this.shelfPos = new THREE.Vector3(ux - 0.7, 0, G0 - deskLen / 2);

    // ---- wall art above the desk: a red dragon poster, drawings and the framed picture
    const wallPic = (canvas, w, h, z, y, frame) => {
      const t = canvas instanceof HTMLCanvasElement ? new THREE.CanvasTexture(canvas) : canvas;
      t.colorSpace = THREE.SRGBColorSpace;
      const grp = new THREE.Group();
      if (frame) grp.add(at(box(0.03, h + 0.1, w + 0.1, '#ffffff'), 0, 0, 0));
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: t, roughness: 0.9 }));
      m.rotation.y = -Math.PI / 2; m.position.x = frame ? -0.02 : 0; grp.add(m);
      at(grp, IN.e - 0.01, y, z); S.add(grp);
      return grp;
    };
    wallPic(dragonPosterCanvas(), 0.82, 0.6, uz0 + 0.71, 1.72, false);
    wallPic(catDrawingCanvas(), 0.28, 0.36, uz1 - 0.26, 2.05, false);
    wallPic(flyerCanvas(), 0.26, 0.2, uz1 - 0.72, 2.0, false);
    wallPic(pencilPageCanvas(), 0.24, 0.3, uz0 + 0.56, 1.2, false);
    const drawing = new THREE.CanvasTexture(renderIntroDrawing());
    wallPic(drawing, 0.8, 0.5, uz1 - 0.42, 1.45, true);
    this.drawingPos = new THREE.Vector3(ux - 0.75, 0, uz1 - 0.42);
    // towels on hooks between the poster and the closet
    for (const [z, c] of [[uz0 + 0.08, '#bfe3d0'], [uz0 + 0.21, '#f49aa8']]) {
      S.add(at(cyl(0.012, 0.012, 0.06, '#d0d0d0', 6), IN.e - 0.03, 1.72, z).rotateZ(Math.PI / 2));
      const tw = rbox(0.03, 0.55, 0.13, c, 0.015); tw.rotation.x = 0.05; S.add(at(tw, IN.e - 0.04, 1.45, z));
    }

    // ---- Lego baseplates and mint balloons on the floor
    const lego = new THREE.Group();
    lego.add(at(rbox(0.6, 0.12, 0.45, '#c9a27a', 0.01), 0, 0.06, 0));
    lego.add(at(box(0.5, 0.02, 0.38, '#f2f2f2'), 0, 0.13, 0));
    const lr = makeRandom(12);
    for (let i = 0; i < 18; i++) lego.add(at(box(0.06, 0.04, 0.03, ['#e0457b', '#2f7de1', '#ffd34d', '#3f9a3a', '#ff9a3c', '#66c2ff'][i % 6]), -0.2 + lr() * 0.4, 0.16, -0.15 + lr() * 0.3));
    lego.add(at(box(0.45, 0.015, 0.3, '#3fa34d'), 0.55, 0.01, 0.1));
    at(lego, -1.95, 0, -1.6, 0.3);
    S.add(lego);
    this.solid(-1.95, -1.6, 0.3, 0.24, 0.14, { noStand: true });
    this.toyPos = new THREE.Vector3(-1.95, 0, -2.2);
    const balloon = mat('#9fe0c8', { roughness: 0.35 });
    for (const [x, z, s2] of [[-0.25, -4.55, 1], [0.05, -4.35, 0.9], [-0.45, -4.3, 0.85]]) {
      const b = new THREE.Mesh(new THREE.SphereGeometry(0.17 * s2, 18, 14), balloon);
      b.scale.y = 1.15; b.position.set(x, 0.18 * s2, z); b.castShadow = true; S.add(b);
    }

    // glow-in-the-dark stars on the ceiling
    this.ceilingStars = new THREE.MeshStandardMaterial({ color: '#fff6c0', emissive: '#fff09a', emissiveIntensity: 0, side: THREE.DoubleSide });
    const rs = makeRandom(77);
    for (let i = 0; i < 22; i++) {
      const sh = new THREE.Shape();
      for (let k = 0; k < 10; k++) { const a = (k * Math.PI) / 5, rr = k % 2 ? 0.035 : 0.08; k ? sh.lineTo(Math.cos(a) * rr, Math.sin(a) * rr) : sh.moveTo(rr, 0); }
      const st = new THREE.Mesh(new THREE.ShapeGeometry(sh), this.ceilingStars);
      st.rotation.x = Math.PI / 2; st.rotation.z = rs() * 6;
      st.position.set(-5.6 + rs() * 6.2, CEIL - 0.01, -4.6 + rs() * 3.2);
      S.add(st);
    }
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
      pos: () => this.toyPos, radius: 1.4, label: 'Build with Legos 🧱',
      action: () => g.ui.dialogue([line(J, 'Click, click, click… I’m building a tiny Pinky Land out of Legos!'), line(PINKY, 'Is that me? The pink square? I LOVE it. Add a rainbow!')]),
    });
    this.addInteractable({
      pos: () => this.swordPos, radius: 1.3, label: 'Look at the sword ⚔️',
      action: () => g.ui.dialogue([line(J, 'My brave knight sword! It’s only for pretend.'), line(PINKY, 'Sir Pinky, protector of pillows! …Real knights are kind, too, you know.')]),
    });
    this.addInteractable({
      pos: () => new THREE.Vector3(-5.2, 0, -3.1), radius: 1.0, label: 'Look at the cat shelves 🐾',
      action: () => g.ui.dialogue([line(J, 'These shelves are for the kitties. They climb all the way up and nap by the ceiling!'), line(PINKY, 'A cat bridge! I wish I could climb that high… I’m a little too floppy.')]),
    });
    this.addInteractable({
      pos: () => this.closetPos, radius: 1.3, label: 'Open the closet 👗',
      action: () => g.ui.dialogue([line(J, 'Hoodies, sneakers, my glow dance shirt… and a whole box of dress-up clothes!'), line(PINKY, 'Can I wear the sparkly cape? Pleeease?')]),
    });
    this.addInteractable({
      pos: () => this.dresserPos, radius: 1.1, label: 'Look at the dresser 🦄',
      action: () => g.ui.dialogue([line(J, 'My night light, my unicorn, and the little treasures I find.'), line(PINKY, 'Everything up here is somebody’s favorite. Like me! 💗')]),
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
        return out.set({ living: '#e8c49a', kitchen: '#d6efe2', bedroom: '#c5d098', bath: '#d6eaff' }[k]);
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
