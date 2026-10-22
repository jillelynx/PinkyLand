// Pixel-art renderer for Chapter 3 (Jacinta the Explorer).
// The game logic (running, jumping, collecting) is the same as the other
// Storybook chapters; only the drawing is different. Everything is painted onto
// a small canvas (about 330 pixels tall) that is then blown up with crisp,
// blocky pixels, to match the pixel-art picture of Jacinta in the jungle.
import { JACINTA_SHEET, JACINTA_ANIM } from './jacintaSheet.js';

export const VH = 330; // game pixels visible from top to bottom of the screen

// ---------------------------------------------------------------- helpers
function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}
function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  g.imageSmoothingEnabled = false;
  return [c, g];
}
// a filled, pixel-stepped circle / ellipse
function disc(g, cx, cy, r, col) {
  g.fillStyle = col;
  for (let y = -r; y <= r; y++) { const w = Math.floor(Math.sqrt(r * r - y * y) + 0.3); g.fillRect(Math.round(cx - w), Math.round(cy + y), w * 2 + 1, 1); }
}
function ell(g, cx, cy, rx, ry, col) {
  g.fillStyle = col;
  for (let y = -ry; y <= ry; y++) { const w = Math.floor(rx * Math.sqrt(Math.max(0, 1 - (y * y) / (ry * ry))) + 0.3); g.fillRect(Math.round(cx - w), Math.round(cy + y), w * 2 + 1, 1); }
}
function speckle(g, x, y, w, h, cols, n, r) {
  for (let i = 0; i < n; i++) { g.fillStyle = cols[Math.floor(r() * cols.length)]; g.fillRect(Math.floor(x + r() * w), Math.floor(y + r() * h), 1 + (r() < 0.3 ? 1 : 0), 1); }
}
// a leafy clump: dark base, mid, light top-left, and sunny speckles
function leafClump(g, cx, cy, size, pal, r) {
  const n = Math.max(3, Math.round(size / 6));
  const blobs = [];
  for (let i = 0; i < n; i++) blobs.push([cx + (r() - 0.5) * size * 1.4, cy + (r() - 0.5) * size * 0.7, size * (0.35 + r() * 0.3)]);
  for (const [x, y, s] of blobs) disc(g, x, y + 2, Math.round(s), pal[0]);
  for (const [x, y, s] of blobs) disc(g, x - 1, y, Math.round(s * 0.85), pal[1]);
  for (const [x, y, s] of blobs) disc(g, x - s * 0.25, y - s * 0.3, Math.round(s * 0.5), pal[2]);
  for (const [x, y, s] of blobs) speckle(g, x - s * 0.7, y - s * 0.8, s * 1.2, s * 0.9, [pal[3], pal[2]], Math.round(s * 1.5), r);
}

const PAL = {
  skyTop: '#3584ec', skyMid: '#5ea7f4', skyLow: '#a7d3f8',
  cloud: ['#ffffff', '#e3effc', '#bcd6f3'],
  mtn: ['#5373aa', '#6c8fc6', '#8eb0de', '#b2cdec'],
  far: ['#356d84', '#46879a', '#5aa0aa', '#78b9b4'],
  mid: ['#1a5444', '#2a7650', '#45995c', '#86c95c'],
  near: ['#2f6a1e', '#4e9426', '#82c234', '#c4e350'],
  bark: ['#2e1d10', '#4f3219', '#6e4626', '#91603a'],
  grass: ['#3f7a1c', '#68a82a', '#97d03a', '#cdf05c'],
  dirt: ['#3f2412', '#5c3519', '#774524', '#93592f'],
  stone: ['#4e5048', '#6e7066', '#8f9184', '#b3b4a5'],
  water: ['#1d6fb8', '#2a8fd6', '#55b8ec', '#d8f4ff'],
};

// ---------------------------------------------------------------- tiles & layers
function dirtTile() {
  const [c, g] = canvas(96, 96);
  const r = rng(11);
  g.fillStyle = PAL.dirt[1]; g.fillRect(0, 0, 96, 96);
  for (let i = 0; i < 70; i++) { const x = r() * 96, y = r() * 96; ell(g, x, y, 2 + Math.floor(r() * 4), 1 + Math.floor(r() * 2), r() < 0.5 ? PAL.dirt[2] : PAL.dirt[0]); }
  speckle(g, 0, 0, 96, 96, [PAL.dirt[3], PAL.dirt[0]], 220, r);
  // little stones
  for (let i = 0; i < 7; i++) { const x = r() * 90 + 3, y = r() * 90 + 3; ell(g, x, y, 3, 2, PAL.stone[1]); g.fillStyle = PAL.stone[2]; g.fillRect(Math.floor(x - 2), Math.floor(y - 2), 2, 1); }
  return c;
}
// the mossy grass edge on top of the ground: tufts above, moss drips below
function grassTile() {
  const [c, g] = canvas(96, 30);
  const r = rng(5);
  // solid grass band (rows 8..17)
  g.fillStyle = PAL.grass[1]; g.fillRect(0, 8, 96, 10);
  g.fillStyle = PAL.grass[2]; g.fillRect(0, 8, 96, 3);
  g.fillStyle = PAL.grass[0]; g.fillRect(0, 16, 96, 2);
  speckle(g, 0, 9, 96, 7, [PAL.grass[3], PAL.grass[2], PAL.grass[0]], 90, r);
  // tufts sticking up
  for (let x = 0; x < 96; x += 2 + Math.floor(r() * 3)) {
    const h = 2 + Math.floor(r() * 7);
    g.fillStyle = r() < 0.4 ? PAL.grass[3] : r() < 0.6 ? PAL.grass[2] : PAL.grass[1];
    g.fillRect(x, 9 - h, 1, h);
    if (r() < 0.3) g.fillRect(x + 1, 9 - h + 2, 1, h - 2);
  }
  // mossy drips hanging over the dirt
  for (let x = 0; x < 96; x += 3 + Math.floor(r() * 4)) {
    const h = 1 + Math.floor(r() * 9);
    g.fillStyle = r() < 0.5 ? PAL.grass[0] : PAL.grass[1];
    g.fillRect(x, 18, 2, h);
    g.fillStyle = PAL.grass[0]; g.fillRect(x, 18 + h, 1, 1);
  }
  return c;
}

function skyClouds() {
  const [c, g] = canvas(1400, 170);
  const r = rng(21);
  for (let i = 0; i < 7; i++) {
    const x = 60 + i * 200 + r() * 80, y = 40 + r() * 80, s = 18 + r() * 22;
    const bl = [];
    for (let k = 0; k < 6; k++) bl.push([x + (k - 2.5) * s * 0.55 + (r() - 0.5) * 10, y - Math.sin((k / 5) * Math.PI) * s * 0.6 + r() * 4, s * (0.45 + r() * 0.3)]);
    for (const [bx, by, bs] of bl) disc(g, bx, by + 4, Math.round(bs), PAL.cloud[2]);
    for (const [bx, by, bs] of bl) disc(g, bx, by + 1, Math.round(bs), PAL.cloud[1]);
    for (const [bx, by, bs] of bl) disc(g, bx - 2, by - 2, Math.round(bs * 0.85), PAL.cloud[0]);
    g.fillStyle = PAL.cloud[2]; g.fillRect(Math.round(x - s * 2), Math.round(y + s * 0.55), Math.round(s * 4), 3);
  }
  return c;
}

function mountainLayer() {
  const W = 1500, H = 330;
  const [c, g] = canvas(W, H);
  const r = rng(31);
  // tall misty cliffs far away, softly shaded, with jungle on top
  const cliff = (cx, w, top) => {
    const x0 = Math.round(cx - w / 2);
    const cracks = [];
    for (let i = 0; i < w / 18; i++) cracks.push(Math.floor(r() * w));
    for (let x = 0; x < w; x++) {
      const k = x / w;
      // rounded shoulders
      const sh = Math.pow(Math.abs(k - 0.5) * 2, 4) * 40;
      const tp = Math.round(top + sh + Math.sin(x * 0.13) * 2);
      g.fillStyle = k < 0.25 ? PAL.mtn[2] : k < 0.7 ? PAL.mtn[1] : PAL.mtn[0];
      g.fillRect(x0 + x, tp, 1, H - tp);
      if (cracks.includes(x)) { g.fillStyle = PAL.mtn[0]; g.fillRect(x0 + x, tp + 14 + Math.floor(r() * 30), 1, 40 + Math.floor(r() * 60)); }
      if (k < 0.25 && x % 9 === 0) { g.fillStyle = PAL.mtn[3]; g.fillRect(x0 + x, tp + 6, 1, 20 + Math.floor(r() * 30)); }
    }
    // jungle on top of the cliff
    for (let k = -6; k <= w + 6; k += 4) {
      const kk = Math.min(1, Math.max(0, k / w));
      const yy = top + Math.pow(Math.abs(kk - 0.5) * 2, 4) * 40;
      disc(g, x0 + k, yy + 2, 4 + Math.floor(r() * 4), PAL.far[0]);
    }
    for (let k = -4; k <= w + 4; k += 6) {
      const kk = Math.min(1, Math.max(0, k / w));
      const yy = top + Math.pow(Math.abs(kk - 0.5) * 2, 4) * 40;
      disc(g, x0 + k - 1, yy - 1, 2 + Math.floor(r() * 3), PAL.far[1]);
      if (r() < 0.5) g.fillRect(x0 + k - 2, yy - 3, 2, 1);
    }
  };
  cliff(140, 230, 120); cliff(420, 200, 95); cliff(700, 260, 135); cliff(1000, 220, 105); cliff(1300, 260, 125); cliff(1520, 200, 110);
  // two distant waterfalls
  for (const [wx, wt] of [[420, 100], [1000, 112]]) {
    for (let y = wt; y < H; y++) { for (let x = 0; x < 8; x++) { g.fillStyle = (x + Math.floor(y / 3)) % 4 === 0 ? '#c6e6fb' : PAL.water[3]; g.fillRect(wx + x, y, 1, 1); } }
    ell(g, wx + 4, 236, 18, 6, '#e8f6ff');
  }
  // misty haze and the jungle far below
  for (let y = 150; y < H; y++) { g.fillStyle = `rgba(200,225,250,${Math.min(0.35, (y - 150) / 300)})`; g.fillRect(0, y, W, 1); }
  for (let x = -10; x < W + 10; x += 9 + r() * 8) disc(g, x, 238 + r() * 16, 12 + Math.floor(r() * 10), PAL.far[0]);
  for (let x = -10; x < W + 10; x += 10 + r() * 9) disc(g, x, 250 + r() * 14, 10 + Math.floor(r() * 8), PAL.far[1]);
  g.fillStyle = PAL.far[1]; g.fillRect(0, 262, W, H - 262);
  speckle(g, 0, 230, W, 60, [PAL.far[2], PAL.far[3]], 900, r);
  return c;
}

function midLayer() {
  const W = 1300, H = 340;
  const [c, g] = canvas(W, H);
  const r = rng(41);
  // a floating cliff island, like the one in the picture
  const island = (x, y, w) => {
    const d = Math.round(w * 0.9);
    for (let i = 0; i < w; i++) {
      const k = i / w;
      const depth = Math.round(d * Math.sin(k * Math.PI) * (0.7 + 0.3 * Math.sin(i * 0.3)) + 8);
      g.fillStyle = k < 0.3 ? PAL.dirt[3] : k < 0.75 ? PAL.dirt[2] : PAL.dirt[1];
      g.fillRect(x + i, y, 1, depth);
      if (i % 5 === 0) { g.fillStyle = PAL.dirt[0]; g.fillRect(x + i, y + 6, 1, depth - 6); }
    }
    g.fillStyle = PAL.mid[2]; g.fillRect(x - 3, y - 4, w + 6, 7);
    g.fillStyle = PAL.mid[3]; g.fillRect(x - 3, y - 4, w + 6, 2);
    for (let i = 0; i < w; i += 4) { g.fillStyle = PAL.mid[1]; g.fillRect(x + i, y + 3, 2, 2 + Math.floor(r() * 10)); }
    leafClump(g, x + w * 0.3, y - 14, 14, PAL.mid, r);
    leafClump(g, x + w * 0.75, y - 10, 10, PAL.mid, r);
  };
  island(160, 110, 90);
  island(820, 70, 70);
  // tall jungle trees whose crowns make a leafy wall
  for (let x = -20; x < W + 20; x += 34 + r() * 30) {
    const top = 150 + r() * 60;
    g.fillStyle = PAL.bark[1]; g.fillRect(Math.round(x - 3), Math.round(top), 6, H);
    g.fillStyle = PAL.bark[2]; g.fillRect(Math.round(x - 3), Math.round(top), 2, H);
  }
  for (let x = -20; x < W + 20; x += 26 + r() * 22) leafClump(g, x, 175 + r() * 50, 22 + r() * 14, PAL.mid, r);
  for (let x = -20; x < W + 20; x += 30 + r() * 26) leafClump(g, x, 240 + r() * 30, 18 + r() * 10, PAL.mid, r);
  g.fillStyle = PAL.mid[0]; g.fillRect(0, 290, W, H - 290);
  for (let x = 0; x < W; x += 6) disc(g, x, 290, 6 + Math.floor(r() * 5), PAL.mid[1]);
  return c;
}

function nearLayer() {
  const W = 1700, H = 470;
  const [c, g] = canvas(W, H);
  const r = rng(51);
  for (const tx of [120, 760, 1320]) {
    const tw = 54 + Math.floor(r() * 30);
    // a giant tree trunk with vertical bark stripes
    for (let x = 0; x < tw; x++) {
      const k = x / tw;
      g.fillStyle = k < 0.2 ? PAL.bark[3] : k < 0.55 ? PAL.bark[2] : k < 0.85 ? PAL.bark[1] : PAL.bark[0];
      g.fillRect(tx + x, 0, 1, H);
    }
    for (let i = 0; i < 40; i++) { g.fillStyle = r() < 0.5 ? PAL.bark[0] : PAL.bark[3]; g.fillRect(tx + Math.floor(r() * tw), Math.floor(r() * H), 1, 6 + Math.floor(r() * 20)); }
    // roots flaring out at the bottom
    for (let k = 0; k < 18; k++) { g.fillStyle = PAL.bark[k % 3 + 1]; const w = tw + (18 - k) * 3; g.fillRect(tx + tw / 2 - w / 2, H - 18 + k, w, 1); }
    // mossy patches
    for (let i = 0; i < 6; i++) ell(g, tx + r() * tw, 80 + r() * (H - 160), 4 + Math.floor(r() * 5), 2 + Math.floor(r() * 3), PAL.grass[1]);
    // a branch with leaves
    const by = 60 + r() * 120, dir = r() < 0.5 ? -1 : 1;
    for (let i = 0; i < 90; i++) { g.fillStyle = PAL.bark[2]; g.fillRect(Math.round(tx + tw / 2 + dir * i), Math.round(by - i * 0.5), 2, 7 - Math.floor(i / 20)); }
    leafClump(g, tx + tw / 2 + dir * 90, by - 50, 26, PAL.near, r);
    leafClump(g, tx + tw / 2, 10, 40, PAL.near, r);
    // hanging vines
    for (let v = 0; v < 4; v++) {
      const vx = tx + tw / 2 + dir * (30 + v * 16), len = 60 + r() * 140;
      for (let y = 0; y < len; y++) { g.fillStyle = PAL.near[y % 9 === 0 ? 2 : 0]; g.fillRect(Math.round(vx + Math.sin(y * 0.08) * 2), Math.round(by - 40 + y), 1, 1); if (y % 9 === 0) { g.fillStyle = PAL.near[2]; g.fillRect(Math.round(vx + Math.sin(y * 0.08) * 2) - 1, Math.round(by - 40 + y), 3, 2); } }
    }
  }
  // bushes and ferns along the bottom
  for (let x = -10; x < W; x += 30 + r() * 40) leafClump(g, x, H - 14, 12 + r() * 8, PAL.near, r);
  return c;
}

function fernStrip() {
  const W = 1100, H = 90;
  const [c, g] = canvas(W, H);
  const r = rng(61);
  const frond = (x, y, len, ang, col, hi) => {
    for (let i = 0; i < len; i++) {
      const t = i / len;
      const px = x + Math.cos(ang) * i, py = y + Math.sin(ang) * i + t * t * len * 0.45;
      g.fillStyle = col; g.fillRect(Math.round(px), Math.round(py), 2, 2);
      if (i % 3 === 0) {
        const l = Math.round((1 - t) * 9) + 2;
        for (let k = 1; k < l; k++) { g.fillStyle = k === l - 1 ? hi : col; g.fillRect(Math.round(px - Math.sin(ang) * k * 0.3), Math.round(py - k), 1, 1); g.fillRect(Math.round(px + Math.sin(ang) * k * 0.2), Math.round(py + k * 0.8), 1, 1); }
      }
    }
  };
  for (let x = 20; x < W; x += 140 + r() * 160) {
    for (let k = 0; k < 7; k++) {
      const ang = -Math.PI / 2 + (k - 3) * 0.42 + (r() - 0.5) * 0.2;
      frond(x, H - 4, 40 + r() * 30, ang, k % 2 ? PAL.near[1] : PAL.near[0], PAL.near[3]);
    }
  }
  return c;
}

// ---------------------------------------------------------------- the renderer
export class PixelJungle {
  constructor(level) {
    this.L = level;
    const el = document.createElement('canvas');
    el.className = 'pixel-view';
    Object.assign(el.style, { position: 'fixed', inset: '0', width: '100vw', height: '100vh', imageRendering: 'pixelated', zIndex: '5', background: '#5ea7f4' });
    document.body.appendChild(el);
    this.el = el;
    this.g = el.getContext('2d');
    this.resize();
    this._onResize = () => this.resize();
    window.addEventListener('resize', this._onResize);
    // pre-painted pieces
    this.dirt = dirtTile();
    this.grass = grassTile();
    this.clouds = skyClouds();
    this.mtn = mountainLayer();
    this.mid = midLayer();
    this.near = nearLayer();
    this.ferns = fernStrip();
    this.cache = new Map();
    this.sheet = new Image();
    this.sheet.src = JACINTA_SHEET.url;
    this.particles = [];
    // animation state for Jacinta
    this.anim = { state: 'idle', t: 0, dist: 0, wasGrounded: true, landT: 0, landHard: false, airT: 0, maxFall: 0, face: 'friendly', detT: 0, lastInv: 0 };
  }

  resize() {
    const aspect = window.innerWidth / Math.max(1, window.innerHeight);
    this.VW = Math.round(VH * aspect);
    this.el.width = this.VW; this.el.height = VH;
    this.g = this.el.getContext('2d');
    this.g.imageSmoothingEnabled = false;
    this.dirtPat = null;
  }

  dispose() {
    window.removeEventListener('resize', this._onResize);
    this.el.remove();
  }

  burst(x, y, color, n) {
    for (let i = 0; i < n; i++) this.particles.push({ x, y, vx: (Math.random() - 0.5) * 180, vy: -Math.random() * 180 - 40, color, t: 0, life: 0.6 + Math.random() * 0.4 });
  }

  // convert a game position into a screen position (CSS pixels) for bubbles
  toScreen(x, y) {
    const k = window.innerHeight / VH;
    return [(x - this.viewL) * k, (y - this.viewT) * k];
  }

  _cached(key, w, h, paint) {
    if (!this.cache.has(key)) { const [c, g] = canvas(w, h); paint(g, w, h); this.cache.set(key, c); }
    return this.cache.get(key);
  }

  // ------------------------------------------------ main draw
  draw(sb, dt) {
    const g = this.g, L = this.L, VW = this.VW, p = sb.p, t = sb.time;
    const viewL = Math.round(sb.camX - VW / 2), viewT = Math.round(sb.camY - VH * 0.5);
    this.viewL = viewL; this.viewT = viewT;
    const sx = (x) => Math.round(x - viewL), sy = (y) => Math.round(y - viewT);
    const dy = viewT - 195; // how far the camera has moved up/down from normal

    // sky
    const sky = g.createLinearGradient(0, 0, 0, VH);
    sky.addColorStop(0, PAL.skyTop); sky.addColorStop(0.55, PAL.skyMid); sky.addColorStop(0.85, PAL.skyLow);
    g.fillStyle = sky; g.fillRect(0, 0, VW, VH);
    // stepped bands so the sky looks pixel-painted
    for (let y = 0; y < VH * 0.8; y += 26) { g.fillStyle = 'rgba(255,255,255,0.035)'; g.fillRect(0, y, VW, 13); }
    // parallax layers: clouds, mountains, mid jungle, near trees
    const layer = (img, follow, baseY, fy, drift = 0) => {
      const w = img.width;
      let x = -((viewL * follow + drift) % w); if (x > 0) x -= w;
      const y = Math.round(baseY - dy * fy);
      for (; x < VW; x += w) g.drawImage(img, Math.round(x), y);
    };
    layer(this.clouds, 0.05, 6, 0.05, t * 6);
    layer(this.mtn, 0.15, 0, 0.12);
    layer(this.mid, 0.38, 20, 0.3);
    layer(this.near, 0.7, -170, 0.6);
    // a soft jungle haze pushes the background back
    g.fillStyle = 'rgba(120,175,215,0.13)'; g.fillRect(0, 0, VW, VH);

    // the Rainbow Falls (at the end of the trail)
    this.drawFalls(g, sx, sy, t);
    // the giant climbing tree (its branches are platforms)
    if (L.bigTree) {
      const T = L.bigTree, X = sx(T.x), Y = sy(T.top);
      if (X > -120 && X < VW + 120) g.drawImage(this._bigTree(T.w, 440 - T.top + 30), X - 60, Y - 70);
    }

    // ground segments
    if (!this.dirtPat) { this.dirtPat = g.createPattern(this.dirt, 'repeat'); this.grassPat = g.createPattern(this.grass, 'repeat-x'); }
    this.dirtPat.setTransform(new DOMMatrix().translate(-viewL, -viewT));
    for (const s of L.ground) {
      const x0 = sx(s.x0), x1 = sx(s.x1), y = sy(s.y);
      if (x1 < -20 || x0 > VW + 20) continue;
      g.fillStyle = this.dirtPat; g.fillRect(x0, y, x1 - x0, VH - y + 10);
      // shaded cliff edges
      g.fillStyle = 'rgba(30,15,5,0.35)'; g.fillRect(x1 - 4, y, 4, VH); g.fillRect(x0, y, 2, VH);
      g.fillStyle = 'rgba(255,220,160,0.12)'; g.fillRect(x0 + 2, y, 2, VH);
      this.grassPat.setTransform(new DOMMatrix().translate(-viewL, y - 9));
      g.fillStyle = this.grassPat; g.fillRect(x0 - 2, y - 9, x1 - x0 + 4, 30);
    }
    // river water
    for (const w of L.water) {
      if (w.dry) continue;
      const x0 = sx(w.x0), x1 = sx(w.x1), y = sy(w.y - 6);
      if (x1 < 0 || x0 > VW) continue;
      g.fillStyle = PAL.water[1]; g.fillRect(x0, y, x1 - x0, VH - y);
      g.fillStyle = PAL.water[0]; g.fillRect(x0, y + 14, x1 - x0, VH - y);
      for (let x = x0; x < x1; x += 2) {
        const wv = Math.sin(x * 0.12 + t * 3) * 1.5;
        g.fillStyle = PAL.water[2]; g.fillRect(x, Math.round(y + wv), 2, 2);
        if ((x + Math.floor(t * 20)) % 23 < 4) { g.fillStyle = PAL.water[3]; g.fillRect(x, Math.round(y + wv), 2, 1); }
        if ((x * 7 + Math.floor(t * 8)) % 41 < 3) { g.fillStyle = PAL.water[2]; g.fillRect(x, y + 8 + ((x * 3) % 20), 3, 1); }
      }
    }
    // blocks
    for (const b of L.blocks) {
      if (sx(b.x + b.w) < -10 || sx(b.x) > VW + 10) continue;
      const overGround = L.ground.some((s) => b.x + b.w / 2 > s.x0 && b.x + b.w / 2 < s.x1);
      const h = overGround ? b.h : b.h + 500;
      const img = this._block(b.kind, b.w, h);
      g.drawImage(img, sx(b.x) - 2, sy(b.y) - 10);
    }
    // one-way platforms
    for (const o of L.oneways) {
      if (sx(o.x + o.w) < -60 || sx(o.x) > VW + 60) continue;
      const img = this._oneway(o.kind, o.w);
      g.drawImage(img, sx(o.x) - (img.width - o.w) / 2, sy(o.y) - 10);
    }
    // moving platforms
    for (const m of sb.movers) {
      const x = sx(m.cx), y = sy(m.cy);
      if (x > VW + 50 || x + m.w < -50) continue;
      if (m.kind === 'lift') {
        // vines going up out of the screen
        for (const vx of [x + 8, x + m.w - 9]) { g.fillStyle = PAL.near[0]; g.fillRect(vx, -2, 2, y + 2); for (let yy = y % 10; yy < y; yy += 10) { g.fillStyle = PAL.near[2]; g.fillRect(vx - 1, yy, 4, 2); } }
      }
      g.drawImage(this._mover(m.kind, m.w), x - 6, y - 6 + (m.kind === 'raft' ? Math.round(Math.sin(t * 2.4) * 1) : 0));
    }
    // bouncy mushrooms
    for (const b of L.bouncy) {
      const s = Math.sin((b.squish || 0) * Math.PI) * 0.35;
      const img = this._mushroom(b.w);
      const w = Math.round(img.width * (1 + s * 0.3)), h = Math.round(img.height * (1 - s * 0.5));
      g.drawImage(img, sx(b.x + b.w / 2) - w / 2, sy(b.y + 36) - h, w, h);
    }
    // brambles
    for (const hz of L.hazards) { if (sx(hz.x) > VW || sx(hz.x + hz.w) < 0) continue; g.drawImage(this._bramble(hz.w), sx(hz.x) - 4, sy(hz.y + hz.h) - 34); }
    // signs
    for (const sg of L.signs) { if (Math.abs(sx(sg.x) - VW / 2) > VW) continue; g.drawImage(this._sign(sg.kind), sx(sg.x) - 42, sy(440) - 50); }
    // checkpoints (little flag totems)
    sb.checkpoints.forEach((c) => {
      const x = sx(c.x), y = sy(c.y || 440);
      if (x < -30 || x > VW + 30) return;
      g.fillStyle = PAL.bark[1]; g.fillRect(x - 2, y - 44, 4, 44);
      g.fillStyle = PAL.bark[3]; g.fillRect(x - 2, y - 44, 1, 44);
      disc(g, x, y - 46, 3, '#e7c25a');
      const col = c.on ? ['#1fb0e6', '#7fdcff'] : ['#9a9a90', '#c8c8bc'];
      for (let i = 0; i < 18; i++) {
        const wv = c.on ? Math.round(Math.sin(t * 6 - i * 0.4) * 1.5) : 0;
        const hh = Math.round(12 - i * 0.55);
        g.fillStyle = col[0]; g.fillRect(x + 2 + i, y - 42 + wv, 1, hh);
        g.fillStyle = col[1]; g.fillRect(x + 2 + i, y - 42 + wv, 1, 2);
      }
      if (c.on && Math.floor(t * 4) % 2) { g.fillStyle = '#fff6b0'; g.fillRect(x + 10, y - 52, 2, 2); }
    });
    // stars
    L.stars.forEach(([x, y], i) => {
      if (!sb.starObjs[i]) return;
      const X = sx(x), Y = sy(y) + Math.round(Math.sin(t * 3 + i) * 2);
      if (X < -10 || X > VW + 10) return;
      g.drawImage(this._star(), X - 7, Y - 7);
      if ((Math.floor(t * 3) + i) % 7 === 0) { g.fillStyle = '#ffffff'; g.fillRect(X + 3, Y - 6, 1, 1); }
    });
    // map pieces
    L.scraps.forEach((sc, i) => {
      if (!sb.scrapObjs[i]) return;
      const X = sx(sc.x), Y = sy(sc.y) + Math.round(Math.sin(t * 2 + i) * 2);
      const glow = 8 + Math.round(Math.sin(t * 4) * 2);
      g.fillStyle = 'rgba(255,230,140,0.35)'; ell(g, X, Y, glow + 4, glow + 2, 'rgba(255,240,170,0.28)');
      g.drawImage(this._mapPiece(sc.id), X - 10, Y - 9);
    });
    // beetles
    for (const b of sb.bunnies) this.drawBeetle(g, b, sx, sy, t);
    // the goal: a glowing map stone
    {
      const X = sx(L.goal.x), Y = sy(440);
      if (X > -40 && X < VW + 40) {
        g.drawImage(this._block('stone', 40, 30), X - 22, Y - 40);
        const k = Math.round(Math.sin(t * 3) * 2);
        disc(g, X - 2, Y - 52 + k, 7, '#ff8fc0'); disc(g, X - 3, Y - 53 + k, 4, '#ffd1e6');
      }
    }

    // particles
    for (const q of this.particles) { q.t += dt; q.x += q.vx * dt; q.y += q.vy * dt; q.vy += 420 * dt; }
    this.particles = this.particles.filter((q) => q.t < q.life);
    for (const q of this.particles) { g.globalAlpha = Math.max(0, 1 - q.t / q.life); g.fillStyle = q.color; g.fillRect(sx(q.x), sy(q.y), 2, 2); }
    g.globalAlpha = 1;

    // Jacinta!
    this.drawHero(g, sb, sx, sy, dt);

    // the secret fern clump in front
    const bush = L.secretBush;
    g.globalAlpha = sb.bushMat.opacity;
    g.drawImage(this._fernClump(bush.w), sx(bush.x) - 10, sy(bush.y) - 78);
    g.globalAlpha = 1;
    // foreground ferns
    let fx = -((viewL * 1.2) % this.ferns.width); if (fx > 0) fx -= this.ferns.width;
    const fy = Math.max(VH - 62, sy(470));
    for (; fx < VW; fx += this.ferns.width) g.drawImage(this.ferns, Math.round(fx), Math.round(fy));
    // soft sunbeams
    g.fillStyle = 'rgba(255,250,200,0.05)';
    for (let i = 0; i < 3; i++) { const bx = ((i * 260 - viewL * 0.2) % (VW + 200) + VW + 200) % (VW + 200) - 100; g.beginPath(); g.moveTo(bx, 0); g.lineTo(bx + 40, 0); g.lineTo(bx + 140, VH); g.lineTo(bx + 80, VH); g.fill(); }
  }

  // Picks Jacinta's animation frame from what she is actually doing (standing,
  // walking, running, in the air, landing, bumped) and her face (friendly or
  // determined), then draws it with her feet exactly on her collision box.
  pickFrame(sb, dt) {
    const p = sb.p, A = this.anim, C = JACINTA_ANIM;
    const speed = Math.abs(p.vx);
    // --- landing: only when she really touches down after being in the air
    if (p.grounded && !A.wasGrounded && A.airT > 0.12) { A.landT = A.maxFall > 620 ? C.landFrameTime * 2 : C.landFrameTime; A.landHard = A.maxFall > 620; }
    if (!p.grounded) { A.airT += dt; A.maxFall = Math.max(A.maxFall, p.vy); } else { A.airT = 0; A.maxFall = 0; }
    A.wasGrounded = p.grounded;
    A.landT = Math.max(0, A.landT - dt);
    // --- her face: determined while running, in big jumps, near danger or after a bump
    let reason = speed > 260 || p.spin > 0 || (p.inv > 0 && sb.state === 'play');
    if (!reason) {
      for (const b of sb.bunnies) if (b.state === 'walk' && (b.x - p.x) * p.facing > -10 && Math.abs(b.x - p.x) < 150 && Math.abs(b.y - p.y) < 60) { reason = true; break; }
      if (!reason) for (const h of this.L.hazards) { const cx = h.x + h.w / 2; if ((cx - p.x) * p.facing > -10 && Math.abs(cx - p.x) < 140 && Math.abs(h.y - p.y) < 60) { reason = true; break; } }
    }
    if (reason) A.detT = C.determinedHold;
    A.detT = Math.max(0, A.detT - dt);
    A.face = A.detT > 0 ? 'determined' : 'friendly';
    // --- body
    let row, col;
    if (p.inv > 1.25 && sb.state === 'play') { row = C.crouch.row; col = 1; A.state = 'hurt'; }
    else if (!p.grounded) {
      const J = C.jump.row; row = J;
      if (p.spin > 0.45) col = 3; // tucked twirl of the double jump
      else if (A.airT < 0.09 && p.vy < 0) col = 1;
      else if (p.vy < -220) col = 2;
      else if (p.vy < 160) col = 3;
      else if (p.vy < 430) col = 4;
      else col = 5;
      A.state = 'air';
    } else if (A.landT > 0 && speed < 40) {
      row = C.jump.row; col = A.landHard && A.landT > C.landFrameTime ? 6 : 7; A.state = 'land';
    } else if (speed > 260) {
      if (A.state !== 'run') { A.state = 'run'; A.dist = 0; }
      A.dist += speed * dt;
      row = C.run.row; col = C.run.frames[Math.floor(A.dist / C.run.stepPx) % C.run.frames.length];
    } else if (speed > 15) {
      if (A.state !== 'walk') { A.state = 'walk'; A.dist = 0; }
      A.dist += speed * dt;
      row = C.walk.row; col = C.walk.frames[Math.floor(A.dist / C.walk.stepPx) % C.walk.frames.length];
    } else {
      if (A.state !== 'idle') { A.state = 'idle'; A.t = 0; }
      A.t += dt;
      row = C.idle.row; col = C.idle.frames[Math.floor(A.t * C.idle.fps) % C.idle.frames.length];
    }
    return { row: row + JACINTA_SHEET.faces[A.face], col };
  }

  drawHero(g, sb, sx, sy, dt) {
    const p = sb.p;
    const fr = this.pickFrame(sb, dt);
    if (!this.sheet.complete) return;
    if (p.inv > 0 && p.inv < 1.25 && Math.floor(sb.time * 14) % 2 === 0 && sb.state === 'play') return; // blink after a bump
    const S = JACINTA_SHEET;
    this.lastFrame = fr;
    g.save();
    g.translate(sx(p.x), sy(p.y));
    g.scale(p.facing, 1);
    g.drawImage(this.sheet, fr.col * S.cellW, fr.row * S.cellH, S.cellW, S.cellH, -S.anchorX, -S.anchorY, S.cellW, S.cellH);
    g.restore();
  }

  drawBeetle(g, b, sx, sy, t) {
    let X = sx(b.x), Y = sy(b.y);
    if (X < -40 || X > this.VW + 40) return;
    let scale = 1, alpha = 1, roll = 0;
    if (b.state !== 'walk') {
      const k = Math.min(1, b.t / 1.4);
      X += Math.round(k * 60); Y -= Math.round(Math.sin(k * Math.PI) * 40);
      scale = 1 - k * 0.45; alpha = 1 - k * 0.5; roll = k * 12;
    }
    g.save();
    g.globalAlpha = alpha;
    g.translate(X, Y);
    g.scale((b.dir || 1) * scale, scale);
    g.rotate(roll);
    // legs
    const step = Math.floor(t * 10) % 2;
    g.fillStyle = '#1b2430';
    for (const lx of [-9, 0, 9]) g.fillRect(lx + (step ? 1 : -1), -4, 2, 4);
    // shell
    ell(g, 0, -12, 15, 10, '#173a6a');
    ell(g, -1, -13, 13, 8, '#2b74c4');
    ell(g, -4, -16, 6, 3, '#6fb7f5');
    g.fillStyle = '#173a6a'; g.fillRect(-1, -21, 2, 18);
    g.fillStyle = '#ffffff'; g.fillRect(-6, -18, 2, 1);
    // head with friendly eyes
    disc(g, 14, -9, 5, '#1b2430');
    g.fillStyle = '#ffffff'; g.fillRect(15, -11, 2, 2);
    g.fillStyle = '#ff8fb8'; g.fillRect(17, -8, 1, 1);
    // antennae
    g.fillStyle = '#1b2430'; g.fillRect(16, -16, 1, 4); g.fillRect(17, -17, 2, 1);
    g.restore();
    g.globalAlpha = 1;
  }

  drawFalls(g, sx, sy, t) {
    const gx = this.L.goal.x;
    const X = sx(gx + 60), top = sy(205), bottom = sy(446);
    if (X < -420 || X > this.VW + 420) return;
    // a big mossy earth-and-rock cliff behind the falls
    const cliff = this._cached('falls-cliff', 560, 300, (c, w, h) => {
      const r = rng(77);
      for (let x = 0; x < w; x++) {
        const k = x / w;
        const tp = Math.round(16 + Math.pow(Math.abs(k - 0.5) * 2, 3) * 70 + Math.sin(x * 0.15) * 3);
        c.fillStyle = k < 0.25 ? PAL.dirt[3] : k < 0.6 ? PAL.dirt[2] : k < 0.85 ? PAL.dirt[1] : PAL.dirt[0];
        c.fillRect(x, tp, 1, h - tp);
        if (x % 5 === 0) { c.fillStyle = PAL.dirt[0]; c.fillRect(x, tp + 10 + Math.floor(r() * 20), 1, 30 + Math.floor(r() * 80)); }
        if (x % 7 === 0 && k < 0.4) { c.fillStyle = PAL.dirt[3]; c.fillRect(x + 1, tp + 8, 1, 20 + Math.floor(r() * 40)); }
        c.fillStyle = PAL.grass[1]; c.fillRect(x, tp - 2, 1, 5);
        c.fillStyle = PAL.grass[2]; c.fillRect(x, tp - 2, 1, 2);
      }
      for (let i = 0; i < 26; i++) ell(c, r() * w, 40 + r() * (h - 80), 5 + Math.floor(r() * 9), 2 + Math.floor(r() * 3), PAL.grass[r() < 0.5 ? 0 : 1]);
      for (let i = 0; i < 14; i++) { const vx = Math.floor(r() * w); const len = 20 + r() * 80; for (let y = 0; y < len; y++) { c.fillStyle = PAL.near[y % 7 === 0 ? 2 : 0]; c.fillRect(vx, 30 + y, 1, 1); } }
      leafClump(c, 50, 60, 26, PAL.near, r); leafClump(c, 510, 64, 28, PAL.near, r); leafClump(c, 140, 30, 20, PAL.near, r); leafClump(c, 420, 32, 20, PAL.near, r);
    });
    g.drawImage(cliff, X - 280, top - 16);
    // the falling water: flowing columns with bright streaks
    const fw = 76, fx = X - fw / 2;
    const ft = top + 14;
    for (let x = 0; x < fw; x += 2) {
      const shade = [PAL.water[2], '#8fd0f4', '#bfe6fb', '#8fd0f4'][(x / 2) % 4];
      g.fillStyle = shade; g.fillRect(fx + x, ft, 2, bottom - ft);
      for (let y = ft; y < bottom; y += 1) {
        const ph = (y - t * 150 + x * 13) % 34;
        if (ph < 0 ? ph + 34 < 6 : ph < 6) { g.fillStyle = PAL.water[3]; g.fillRect(fx + x, y, 2, 1); }
      }
    }
    g.fillStyle = PAL.water[3]; g.fillRect(fx - 2, ft - 2, fw + 4, 3);
    // mist and the rainbow
    for (let i = 0; i < 16; i++) disc(g, fx - 10 + (i * 11) % (fw + 20) + Math.sin(t * 2 + i) * 4, bottom - 14 + (i % 3) * 4, 8 + (i % 3) * 3, 'rgba(240,250,255,0.6)');
    const cols = ['#ff6b6b', '#ffa94d', '#ffe066', '#69db7c', '#4dabf7', '#9775fa'];
    g.globalAlpha = 0.6;
    cols.forEach((c, i) => {
      g.fillStyle = c;
      const R = 110 - i * 4;
      for (let a = 0; a < 90; a++) { const ang = Math.PI + (a / 89) * Math.PI; g.fillRect(Math.round(X - 20 + Math.cos(ang) * R), Math.round(bottom - 20 + Math.sin(ang) * R * 0.95), 4, 4); }
    });
    g.globalAlpha = 1;
  }

  // ------------------------------------------------ cached pieces
  _block(kind, w, h) {
    return this._cached(`b-${kind}-${w}-${h}`, w + 4, h + 12, (g) => {
      const r = rng(w * 7 + h);
      if (kind === 'log') {
        for (let y = 0; y < h; y++) { const k = y / h; g.fillStyle = k < 0.25 ? PAL.bark[3] : k < 0.7 ? PAL.bark[2] : PAL.bark[1]; g.fillRect(2, 10 + y, w - 8, 1); }
        for (let i = 0; i < 18; i++) { g.fillStyle = PAL.bark[0]; g.fillRect(2 + Math.floor(r() * (w - 12)), 12 + Math.floor(r() * (h - 4)), 6 + Math.floor(r() * 12), 1); }
        ell(g, w - 6, 10 + h / 2, 5, Math.floor(h / 2), '#c99a5f'); ell(g, w - 6, 10 + h / 2, 3, Math.floor(h / 3), '#e2bb7f'); ell(g, w - 6, 10 + h / 2, 1, Math.floor(h / 6), '#b07a45');
        for (let x = 4; x < w - 12; x += 5) { g.fillStyle = r() < 0.6 ? PAL.grass[1] : PAL.grass[2]; g.fillRect(x, 8 + Math.floor(r() * 3), 4, 3); }
        return;
      }
      if (kind === 'stump') {
        for (let x = 0; x < w; x++) { const k = x / w; g.fillStyle = k < 0.25 ? PAL.bark[3] : k < 0.7 ? PAL.bark[2] : PAL.bark[1]; g.fillRect(2 + x, 14, 1, h - 4); }
        for (let i = 0; i < 12; i++) { g.fillStyle = PAL.bark[0]; g.fillRect(4 + Math.floor(r() * (w - 4)), 16 + Math.floor(r() * (h - 8)), 1, 8); }
        ell(g, 2 + w / 2, 14, w / 2, 5, '#c99a5f'); ell(g, 2 + w / 2, 14, w / 3, 3, '#e2bb7f'); ell(g, 2 + w / 2, 14, w / 6, 1, '#b07a45');
        return;
      }
      // mossy stone
      for (let x = 0; x < w; x++) {
        const k = x / w;
        g.fillStyle = k < 0.2 ? PAL.stone[3] : k < 0.5 ? PAL.stone[2] : k < 0.85 ? PAL.stone[1] : PAL.stone[0];
        const inset = x < 3 || x > w - 4 ? 2 : 0;
        g.fillRect(2 + x, 10 + inset, 1, h - inset);
      }
      for (let i = 0; i < w * h / 300; i++) { g.fillStyle = PAL.stone[0]; const x = 4 + Math.floor(r() * (w - 8)), y = 16 + Math.floor(r() * (h - 10)); g.fillRect(x, y, 5 + Math.floor(r() * 10), 1); g.fillRect(x + 2, y + 1, 1, 3); }
      speckle(g, 2, 12, w, h - 4, [PAL.stone[3], PAL.stone[0]], w * h / 30, r);
      // moss cap with drips
      g.fillStyle = PAL.grass[1]; g.fillRect(0, 6, w + 4, 6);
      g.fillStyle = PAL.grass[2]; g.fillRect(0, 6, w + 4, 2);
      for (let x = 0; x < w + 4; x += 2) { if (r() < 0.5) { g.fillStyle = PAL.grass[3]; g.fillRect(x, 3 + Math.floor(r() * 3), 1, 4); } if (r() < 0.35) { g.fillStyle = PAL.grass[0]; g.fillRect(x, 12, 2, 2 + Math.floor(r() * 7)); } }
    });
  }

  _bigTree(w, h) {
    return this._cached(`bigtree-${w}-${h}`, w + 120, h + 90, (g) => {
      const r = rng(w + h);
      const x0 = 60;
      for (let x = 0; x < w; x++) { const k = x / w; g.fillStyle = k < 0.2 ? PAL.bark[3] : k < 0.55 ? PAL.bark[2] : k < 0.85 ? PAL.bark[1] : PAL.bark[0]; g.fillRect(x0 + x, 60, 1, h); }
      for (let i = 0; i < h / 6; i++) { g.fillStyle = r() < 0.5 ? PAL.bark[0] : PAL.bark[3]; g.fillRect(x0 + Math.floor(r() * w), 60 + Math.floor(r() * h), 1, 6 + Math.floor(r() * 18)); }
      for (let i = 0; i < 8; i++) ell(g, x0 + r() * w, 90 + r() * (h - 60), 3 + Math.floor(r() * 4), 2, PAL.grass[1]);
      // roots
      for (let k = 0; k < 24; k++) { g.fillStyle = PAL.bark[k % 3 + 1]; const ww = w + (24 - k) * 4; g.fillRect(x0 + w / 2 - ww / 2, 60 + h - 24 + k, ww, 1); }
      // a leafy crown at the top
      leafClump(g, x0 + w / 2, 40, 46, PAL.near, r);
      leafClump(g, x0 + w / 2 - 40, 60, 26, PAL.near, r);
      leafClump(g, x0 + w / 2 + 44, 58, 26, PAL.near, r);
    });
  }

  _oneway(kind, w) {
    if (kind === 'island') {
      const d = Math.round(w * 0.55);
      return this._cached(`o-island-${w}`, w + 12, d + 30, (g) => {
        const r = rng(w);
        for (let i = 0; i < w; i++) {
          const k = i / w;
          const depth = Math.round(d * Math.pow(Math.sin(k * Math.PI), 0.8) * (0.8 + 0.2 * Math.sin(i * 0.4)) + 6);
          g.fillStyle = k < 0.3 ? PAL.dirt[3] : k < 0.7 ? PAL.dirt[2] : PAL.dirt[1];
          g.fillRect(6 + i, 14, 1, depth);
          if (i % 4 === 0) { g.fillStyle = PAL.dirt[0]; g.fillRect(6 + i, 18, 1, depth - 6); }
        }
        speckle(g, 6, 16, w, d * 0.6, [PAL.dirt[3], PAL.stone[2]], w, r);
        // hanging roots
        for (let i = 0; i < w / 10; i++) { const x = 10 + Math.floor(r() * (w - 8)); g.fillStyle = PAL.bark[2]; g.fillRect(x, 20, 1, 6 + Math.floor(r() * d * 0.6)); }
        // grass top
        g.drawImage(this.grass, 0, 0, w + 12, 30, 0, 1, w + 12, 30);
        g.fillStyle = PAL.grass[1]; g.fillRect(0, 9, 3, 8); g.fillRect(w + 9, 9, 3, 8);
      });
    }
    if (kind === 'lily') {
      return this._cached(`o-lily-${w}`, w + 12, 24, (g) => {
        ell(g, 6 + w / 2, 14, w / 2 + 2, 5, '#2f7a3a'); ell(g, 6 + w / 2, 13, w / 2, 4, '#5bb04a');
        g.fillStyle = '#2f7a3a'; g.fillRect(6 + w / 2, 10, 1, 5);
        disc(g, 6 + w / 2 + 10, 8, 3, '#ffb3d1'); disc(g, 6 + w / 2 + 10, 8, 1, '#ffe27a');
      });
    }
    // branch
    return this._cached(`o-branch-${w}`, w + 40, 46, (g) => {
      const r = rng(w + 3);
      for (let x = 0; x < w + 12; x++) { const th = 8 - Math.floor((x / (w + 12)) * 3); g.fillStyle = PAL.bark[2]; g.fillRect(14 + x, 10, 1, th); g.fillStyle = PAL.bark[3]; g.fillRect(14 + x, 10, 1, 2); g.fillStyle = PAL.bark[0]; g.fillRect(14 + x, 9 + th, 1, 1); }
      leafClump(g, 22, 8, 10, PAL.near, r);
      leafClump(g, w + 14, 8, 12, PAL.near, r);
      for (let x = 30; x < w; x += 18) { g.fillStyle = PAL.grass[r() < 0.5 ? 1 : 2]; g.fillRect(x, 8, 6, 3); }
    });
  }

  _mover(kind, w) {
    return this._cached(`m-${kind}-${w}`, w + 12, 26, (g) => {
      if (kind === 'lift') {
        g.fillStyle = PAL.bark[1]; g.fillRect(6, 6, w, 10);
        for (let x = 6; x < w + 6; x += 12) { g.fillStyle = PAL.bark[3]; g.fillRect(x, 6, 11, 2); g.fillStyle = PAL.bark[0]; g.fillRect(x + 11, 6, 1, 10); }
        g.fillStyle = PAL.grass[1]; g.fillRect(6, 5, w, 2);
        return;
      }
      // a giant floating leaf raft
      ell(g, 6 + w / 2, 12, w / 2 + 4, 6, '#2c6e22');
      ell(g, 6 + w / 2, 11, w / 2 + 2, 5, '#5ba82c');
      ell(g, 6 + w / 2 - 8, 9, w / 3, 2, '#8fd04a');
      g.fillStyle = '#2c6e22'; g.fillRect(8, 11, w, 1);
      for (let x = 14; x < w; x += 12) { g.fillRect(x, 8, 1, 3); g.fillRect(x + 3, 12, 1, 3); }
    });
  }

  _mushroom(w) {
    return this._cached(`mush-${w}`, w + 10, 48, (g) => {
      const cx = 5 + w / 2;
      g.fillStyle = '#efe2c4'; g.fillRect(cx - 9, 22, 18, 26);
      g.fillStyle = '#d4c3a0'; g.fillRect(cx + 4, 22, 5, 26);
      ell(g, cx, 18, w / 2 + 2, 14, '#9a1f24');
      ell(g, cx, 16, w / 2, 13, '#e0383e');
      ell(g, cx - 10, 10, w / 5, 4, '#ff6b6b');
      g.fillStyle = '#9a1f24'; g.fillRect(cx - w / 2, 28, w, 3);
      for (const [dx, dy, r] of [[-22, 14, 4], [4, 8, 5], [24, 16, 3], [-6, 22, 3], [14, 22, 2]]) disc(g, cx + dx, dy, r, '#ffffff');
    });
  }

  _bramble(w) {
    return this._cached(`br-${w}`, w + 8, 36, (g) => {
      const r = rng(w + 9);
      for (let i = 0; i < 8; i++) {
        let x = 4 + r() * w, y = 34;
        for (let k = 0; k < 26; k++) {
          x += (r() - 0.5) * 4; y -= 1.1;
          g.fillStyle = k % 2 ? '#3d4a22' : '#56602a'; g.fillRect(Math.round(x), Math.round(y), 2, 2);
          if (k % 5 === 2) { g.fillStyle = '#ff7aa8'; g.fillRect(Math.round(x) + (r() < 0.5 ? -2 : 2), Math.round(y), 2, 1); }
        }
      }
      for (let i = 0; i < 4; i++) disc(g, 6 + r() * (w - 4), 20 + r() * 10, 2, '#b04a8a');
    });
  }

  _star() {
    return this._cached('star', 15, 15, (g) => {
      const pts = [];
      for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i * Math.PI) / 5, rr = i % 2 ? 3 : 7; pts.push([7 + Math.cos(a) * rr, 7.5 + Math.sin(a) * rr]); }
      const inside = (x, y) => { let c = false; for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) { const [xi, yi] = pts[i], [xj, yj] = pts[j]; if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c; } return c; };
      for (let y = 0; y < 15; y++) for (let x = 0; x < 15; x++) {
        if (!inside(x + 0.5, y + 0.5)) continue;
        const edge = !inside(x - 0.5, y + 0.5) || !inside(x + 1.5, y + 0.5) || !inside(x + 0.5, y - 0.5) || !inside(x + 0.5, y + 1.5);
        g.fillStyle = edge ? '#c27a12' : y < 7 && x < 8 ? '#fff3a0' : '#ffd23a';
        g.fillRect(x, y, 1, 1);
      }
    });
  }

  _mapPiece(id) {
    return this._cached('map-' + id, 20, 18, (g) => {
      g.fillStyle = '#b8935a'; g.fillRect(1, 1, 18, 16);
      g.fillStyle = '#f3e2b8'; g.fillRect(2, 2, 16, 14);
      g.fillStyle = '#e2c890'; g.fillRect(2, 13, 16, 3);
      // torn corner
      g.clearRect(id === 'map2' ? 16 : 1, 1, 3, 3);
      g.fillStyle = '#4a9ad8'; for (let x = 3; x < 16; x++) g.fillRect(x, 8 + Math.round(Math.sin(x * 0.7) * 2), 1, 1);
      g.fillStyle = '#3f8f3a'; g.fillRect(4, 4, 3, 2); g.fillRect(12, 11, 3, 2);
      g.fillStyle = '#d23a3a'; g.fillRect(12, 4, 1, 1); g.fillRect(14, 4, 1, 1); g.fillRect(13, 5, 1, 1); g.fillRect(12, 6, 1, 1); g.fillRect(14, 6, 1, 1);
    });
  }

  _sign(kind) {
    return this._cached('sign-' + kind, 84, 52, (g) => {
      g.fillStyle = PAL.bark[1]; g.fillRect(40, 20, 4, 32);
      g.fillStyle = PAL.bark[3]; g.fillRect(2, 2, 80, 26);
      g.fillStyle = PAL.bark[2]; g.fillRect(3, 3, 78, 24);
      g.fillStyle = PAL.bark[1]; g.fillRect(2, 27, 80, 1);
      g.fillStyle = '#ffe9b0';
      g.font = 'bold 8px monospace'; g.textAlign = 'center'; g.textBaseline = 'middle';
      const lines = { arrows: ['<- -> walk', 'Shift = run'], jump: ['Space', 'jump!'], double: ['Space x2', 'double jump'], stomp: ['hop on', 'beetles'], bounce: ['mushroom', 'boing!'] }[kind] || ['', ''];
      g.fillText(lines[0], 42, 9, 76); g.fillText(lines[1], 42, 20, 76);
    });
  }

  _fernClump(w) {
    return this._cached('fernclump-' + w, w + 20, 84, (g) => {
      const r = rng(w + 17);
      for (let k = 0; k < 14; k++) {
        const ang = -Math.PI / 2 + (k / 13 - 0.5) * 2.4;
        let x = 10 + w / 2 + (r() - 0.5) * w * 0.5, y = 84;
        const len = 50 + r() * 26;
        for (let i = 0; i < len; i++) {
          const t2 = i / len;
          x += Math.cos(ang) * 1; y += Math.sin(ang) * 1 + t2 * 0.9;
          g.fillStyle = k % 2 ? PAL.near[1] : PAL.near[0]; g.fillRect(Math.round(x), Math.round(y), 2, 2);
          if (i % 3 === 0) for (let q = 1; q < (1 - t2) * 10 + 2; q++) { g.fillStyle = q > 6 ? PAL.near[2] : PAL.near[1]; g.fillRect(Math.round(x), Math.round(y - q), 1, 1); g.fillRect(Math.round(x + q * 0.4), Math.round(y + q * 0.5), 1, 1); }
        }
      }
    });
  }
}

// ---------------------------------------------------------------- the treasure map
// draws one torn piece (or the whole map when all are found) for the big reveal
const MAP_PARTS = ['map1', 'map2', 'map3'];
export function drawMapPicture(g, W, H, found, only = null) {
  const [c, m] = canvas(120, 90);
  m.fillStyle = '#f3e2b8'; m.fillRect(0, 0, 120, 90);
  const r = rng(3);
  speckle(m, 0, 0, 120, 90, ['#e6d0a0', '#fbefcf'], 600, r);
  // river
  m.fillStyle = '#4a9ad8'; for (let x = 0; x < 120; x++) m.fillRect(x, 60 + Math.round(Math.sin(x * 0.12) * 5), 1, 3);
  // trees
  for (const [x, y] of [[12, 30], [22, 40], [50, 22], [58, 34], [92, 36]]) { disc(m, x, y, 5, '#3f8f3a'); m.fillStyle = '#6e4626'; m.fillRect(x, y + 4, 1, 4); }
  // giant tree
  m.fillStyle = '#6e4626'; m.fillRect(64, 16, 4, 30); disc(m, 66, 14, 9, '#2f7a2a');
  // dotted trail
  m.fillStyle = '#9a2a2a';
  for (let x = 6; x < 106; x += 4) m.fillRect(x, 50 + Math.round(Math.sin(x * 0.07) * 14), 2, 1);
  // waterfall with rainbow and X
  m.fillStyle = '#8a8c80'; m.fillRect(100, 10, 18, 50);
  m.fillStyle = '#d8f4ff'; m.fillRect(106, 12, 5, 50);
  ['#ff6b6b', '#ffe066', '#69db7c', '#4dabf7'].forEach((col, i) => { m.fillStyle = col; for (let a = 0; a < 20; a++) { const ang = Math.PI + (a / 19) * Math.PI; m.fillRect(Math.round(108 + Math.cos(ang) * (16 - i * 2)), Math.round(20 + Math.sin(ang) * (12 - i * 2)), 1, 1); } });
  m.fillStyle = '#d23a3a'; for (let i = -3; i <= 3; i++) { m.fillRect(108 + i, 40 + i, 2, 2); m.fillRect(108 + i, 40 - i, 2, 2); }
  disc(m, 112, 34, 2, '#ff8fc0');
  // which pieces show
  const show = only ? [only] : found;
  const thirds = { map1: [0, 40], map2: [40, 80], map3: [80, 120] };
  g.save();
  g.imageSmoothingEnabled = false;
  const s = Math.floor(Math.min(W / 130, H / 100));
  const ox = Math.round((W - 120 * s) / 2), oy = Math.round((H - 90 * s) / 2);
  for (const id of MAP_PARTS) {
    const [a, b] = thirds[id];
    const has = show.includes(id);
    if (only && !has) continue;
    g.globalAlpha = has ? 1 : 0.18;
    g.drawImage(c, a, 0, b - a, 90, ox + a * s + (only ? -((a + b) / 2 - 60) * s : 0), oy, (b - a) * s, 90 * s);
    // torn edges
    g.fillStyle = '#b8935a';
    for (let y = 0; y < 90; y += 3) g.fillRect(ox + a * s + (only ? -((a + b) / 2 - 60) * s : 0) + ((y * 7) % 3) * s, oy + y * s, s, s * 2);
  }
  g.restore();
}
