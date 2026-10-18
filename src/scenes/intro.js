// The opening: a child's crayon drawing of Jacinta and Pinky in Pinky Land
// draws itself stroke by stroke while the story is told.
import { makeRandom } from '../util/noise.js';

const W = 1600, H = 1000;

const STORY = [
  'When Jacinta was very little, she drew a smiley face on her favorite pillow.',
  'She named him Pinky. He went everywhere with her.',
  'Every night, Jacinta dreamed up a whole world for him — fluffy clouds, sparkly water, and friends of every size.',
  'She called it Pinky Land.',
  'Now Pinky has a secret wish: to take Jacinta there… for real.',
  'But the door to Pinky Land only opens with one thing… kindness.',
];

function zigzagFill(rand, x0, y0, x1, y1, step, shapeTest, color, width = 14) {
  // kid-style back-and-forth coloring inside a shape
  const pts = [];
  let dir = 1;
  for (let y = y0; y <= y1; y += step) {
    const row = [];
    for (let x = x0; x <= x1; x += 10) if (shapeTest(x, y)) row.push(x);
    if (!row.length) continue;
    const a = row[0], b = row[row.length - 1];
    if (dir > 0) { pts.push([a + rand() * 6, y + rand() * 6]); pts.push([b - rand() * 6, y + step * 0.5 + rand() * 4]); }
    else { pts.push([b - rand() * 6, y + rand() * 6]); pts.push([a + rand() * 6, y + step * 0.5 + rand() * 4]); }
    dir = -dir;
  }
  return { color, width, pts, alpha: 0.55 };
}

function circlePts(cx, cy, rx, ry, rand, n = 40, turns = 1.08) {
  const pts = [];
  for (let i = 0; i <= n * turns; i++) {
    const a = (i / n) * Math.PI * 2;
    const k = 1 + (rand() - 0.5) * 0.06;
    pts.push([cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k]);
  }
  return pts;
}

function buildStrokes() {
  const r = makeRandom(2024);
  const S = [];
  const add = (color, width, pts, alpha = 0.9) => S.push({ color, width, pts, alpha });
  // sky
  S.push(zigzagFill(r, 0, 10, W, 360, 26, () => true, '#8fd0ff', 22));
  // sun
  S.push(zigzagFill(r, 1260, 60, 1500, 300, 16, (x, y) => (x - 1380) ** 2 + (y - 180) ** 2 < 100 ** 2, '#ffd84a', 16));
  add('#ffb020', 8, circlePts(1380, 180, 102, 102, r));
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    add('#ffb020', 8, [[1380 + Math.cos(a) * 125, 180 + Math.sin(a) * 125], [1380 + Math.cos(a) * 175, 180 + Math.sin(a) * 175]]);
  }
  // clouds
  for (const [cx, cy, s] of [[300, 150, 1], [760, 110, 0.8], [1050, 230, 0.7]]) {
    const pts = [];
    for (let k = 0; k < 5; k++) {
      const bx = cx - 120 * s + k * 60 * s, by = cy - (k % 2 ? 30 : 10) * s;
      for (let i = 0; i <= 12; i++) { const a = Math.PI + (i / 12) * Math.PI; pts.push([bx + Math.cos(a) * 45 * s, by + Math.sin(a) * 45 * s]); }
    }
    pts.push([cx + 140 * s, cy + 30 * s], [cx - 160 * s, cy + 30 * s], pts[0]);
    S.push(zigzagFill(r, cx - 170 * s, cy - 80 * s, cx + 160 * s, cy + 30 * s, 14, (x, y) => ((x - cx) / (160 * s)) ** 2 + ((y - cy + 10 * s) / (60 * s)) ** 2 < 1, '#ffffff', 16));
    add('#6fa8e0', 6, pts);
  }
  // mountains far away
  add('#9a8ad8', 8, [[0, 420], [180, 280], [330, 400], [520, 250], [700, 410]]);
  // hills
  const hill = (x, y) => y > 430 + Math.sin(x * 0.006) * 60 - Math.cos(x * 0.011) * 30;
  S.push(zigzagFill(r, 0, 360, W, 760, 22, (x, y) => hill(x, y) && y < 760, '#7fd36a', 22));
  const hp = []; for (let x = 0; x <= W; x += 40) hp.push([x, 430 + Math.sin(x * 0.006) * 60 - Math.cos(x * 0.011) * 30]);
  add('#3f9a3a', 9, hp);
  // flowers on the hill
  for (let i = 0; i < 16; i++) {
    const x = 80 + r() * 1440, y = 560 + r() * 160;
    const c = ['#ff6fae', '#ffe24a', '#b48aff', '#ff9a3c'][i % 4];
    add('#3f9a3a', 5, [[x, y], [x + 4, y + 36]]);
    add(c, 10, circlePts(x, y, 14, 14, r, 12));
  }
  // water
  S.push(zigzagFill(r, 0, 760, W, H, 18, () => true, '#4cc3ff', 22));
  for (let k = 0; k < 4; k++) {
    const pts = []; const y = 800 + k * 50;
    for (let x = 0; x <= W; x += 30) pts.push([x, y + Math.sin(x * 0.03 + k) * 10]);
    add('#ffffff', 5, pts, 0.8);
  }
  // waterfall on the left
  S.push(zigzagFill(r, 30, 330, 120, 770, 16, (x) => x > 40 && x < 115, '#bdeeff', 14));
  const charStart = S.length;
  // --- Jacinta (left of center)
  const jx = 640, jy = 600;
  // legs + shoes
  add('#f1cfb8', 12, [[jx - 25, jy + 110], [jx - 30, jy + 200]]);
  add('#f1cfb8', 12, [[jx + 25, jy + 110], [jx + 32, jy + 200]]);
  add('#ffffff', 16, [[jx - 50, jy + 205], [jx - 20, jy + 205]]);
  add('#ffffff', 16, [[jx + 20, jy + 205], [jx + 52, jy + 205]]);
  // dolphin shorts
  S.push(zigzagFill(r, jx - 55, jy + 70, jx + 55, jy + 125, 10, () => true, '#6fc3e8', 12));
  // pink hoodie (triangle-ish dress shape like kids draw)
  S.push(zigzagFill(r, jx - 85, jy - 70, jx + 85, jy + 85, 12, (x, y) => Math.abs(x - jx) < 45 + (y - (jy - 70)) * 0.25, '#ff9ec4', 14));
  add('#e0609a', 7, [[jx - 45, jy - 70], [jx - 85, jy + 85], [jx + 85, jy + 85], [jx + 45, jy - 70], [jx - 45, jy - 70]]);
  // arms (one holding Pinky's hand-corner)
  add('#ff9ec4', 14, [[jx - 50, jy - 50], [jx - 120, jy + 30]]);
  add('#ff9ec4', 14, [[jx + 50, jy - 50], [jx + 135, jy + 10]]);
  // head
  S.push(zigzagFill(r, jx - 70, jy - 210, jx + 70, jy - 70, 10, (x, y) => (x - jx) ** 2 + (y - (jy - 140)) ** 2 < 66 ** 2, '#f6d6c0', 12));
  add('#c98a6a', 6, circlePts(jx, jy - 140, 68, 70, r));
  // curly hair: lots of loops
  for (let i = 0; i < 26; i++) {
    const a = Math.PI * (0.95 + (i / 25) * 1.1);
    const rr = 78 + r() * 14;
    const cx = jx + Math.cos(a) * rr, cy = jy - 140 + Math.sin(a) * rr * 1.05;
    add('#4a2a1a', 8, circlePts(cx, cy, 16, 16, r, 10, 1.3));
  }
  for (let i = 0; i < 14; i++) {
    const side = i % 2 ? 1 : -1;
    const cx = jx + side * (78 + r() * 18), cy = jy - 110 + (i >> 1) * 22;
    add('#4a2a1a', 8, circlePts(cx, cy, 15, 15, r, 10, 1.3));
  }
  // bear ears on hood
  add('#ff9ec4', 12, circlePts(jx - 55, jy - 70, 16, 14, r, 12));
  add('#ff9ec4', 12, circlePts(jx + 55, jy - 70, 16, 14, r, 12));
  // face
  add('#3a2316', 10, circlePts(jx - 24, jy - 148, 6, 8, r, 10));
  add('#3a2316', 10, circlePts(jx + 24, jy - 148, 6, 8, r, 10));
  add('#d4506a', 6, Array.from({ length: 10 }, (_, i) => [jx - 24 + i * 5.3, jy - 112 + Math.sin((i / 9) * Math.PI) * 14]));
  add('#ff8fa8', 8, circlePts(jx - 44, jy - 122, 9, 6, r, 10), 0.5);
  add('#ff8fa8', 8, circlePts(jx + 44, jy - 122, 9, 6, r, 10), 0.5);
  // --- Pinky (pale pink pillow, standing tall) to her right
  const px = 880, py = 610;
  S.push(zigzagFill(r, px - 85, py - 125, px + 85, py + 125, 12, (x, y) => Math.abs(x - px) < 80 && Math.abs(y - py) < 122, '#ffd3de', 16));
  add('#f08aa8', 7, [[px - 90, py - 130], [px, py - 118], [px + 90, py - 130], [px + 80, py], [px + 90, py + 130], [px, py + 120], [px - 90, py + 130], [px - 80, py], [px - 90, py - 130]]);
  // Pinky's face (small, in the top third): chunky blue eyes and a U smile
  add('#3366cc', 16, circlePts(px - 30, py - 72, 6, 9, r, 12, 1.5));
  add('#3366cc', 16, circlePts(px + 30, py - 74, 6, 9, r, 12, 1.5));
  add('#3366cc', 11, [[px - 15, py - 52], [px - 14, py - 38], [px - 6, py - 30], [px + 6, py - 30], [px + 14, py - 38], [px + 15, py - 52]]);
  // hearts floating up
  for (const [hx, hy, s] of [[770, 330, 1], [820, 270, 0.7], [720, 280, 0.6], [1150, 420, 0.8]]) {
    const pts = [];
    for (let i = 0; i <= 30; i++) {
      const t = (i / 30) * Math.PI * 2;
      pts.push([hx + 16 * Math.pow(Math.sin(t), 3) * 2 * s, hy - (13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)) * 2 * s]);
    }
    S.push(zigzagFill(r, hx - 34 * s, hy - 30 * s, hx + 34 * s, hy + 36 * s, 8, (x, y) => {
      const X = (x - hx) / (32 * s), Y = -(y - hy) / (32 * s);
      return (X * X + Y * Y - 1) ** 3 - X * X * Y * Y * Y < 0;
    }, '#ff5f8f', 10));
    add('#e0306a', 6, pts);
  }
  // a little pinky friend in the meadow
  add('#ffc4e0', 12, [[1210, 650], [1290, 650], [1290, 700], [1210, 700], [1210, 650]]);
  add('#3366cc', 8, circlePts(1235, 668, 4, 5, r, 8));
  add('#3366cc', 8, circlePts(1265, 668, 4, 5, r, 8));
  // kids draw the people first, then color the world in behind them
  const chars = S.slice(charStart);
  const bg = S.slice(0, charStart).map((k) => ({ ...k, bg: true }));
  return [...chars, ...bg];
}

export class Intro {
  constructor(root, audio) {
    this.audio = audio;
    this.el = document.createElement('div');
    this.el.className = 'intro';
    this.el.innerHTML = `
      <canvas class="intro-canvas"></canvas>
      <div class="intro-caption"></div>
      <div class="intro-title">Pinky Land</div>
      <button class="intro-skip">Skip ▸</button>
      <div class="intro-continue">Click or press any key to begin</div>`;
    root.appendChild(this.el);
    this.canvas = this.el.querySelector('canvas');
    this.ctx = this.canvas.getContext('2d');
    this.caption = this.el.querySelector('.intro-caption');
    this.titleEl = this.el.querySelector('.intro-title');
    this.continueEl = this.el.querySelector('.intro-continue');
    this.strokes = buildStrokes();
    this.totalPts = this.strokes.reduce((s, k) => s + k.pts.length, 0);
    this.drawn = 0;
    this.paper = this._makePaper();
    this.off = document.createElement('canvas');
    this.off.width = W; this.off.height = H;
    this.offCtx = this.off.getContext('2d');
    this.time = 0;
    this.storyIndex = -1;
    this.done = false;
    this.finished = false;
    this.zoom = 0;
    this.onFinish = null;
    this.rand = makeRandom(9);
    this.el.querySelector('.intro-skip').addEventListener('click', (e) => { e.stopPropagation(); this.finish(); });
    this._keyHandler = () => { if (this.done) this.finish(); else this.time = Math.max(this.time, this._storyTime(this.storyIndex + 1)); };
    window.addEventListener('keydown', this._keyHandler);
    this.el.addEventListener('click', this._keyHandler);
    this._resize = () => this.resize();
    window.addEventListener('resize', this._resize);
    this.resize();
  }

  _storyTime(i) { return 1.0 + i * 5.2; }

  _makePaper() {
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    const g = c.getContext('2d');
    g.fillStyle = '#fffaf0';
    g.fillRect(0, 0, W, H);
    const r = makeRandom(5);
    for (let i = 0; i < 9000; i++) {
      g.fillStyle = `rgba(${150 + r() * 60},${130 + r() * 50},${100 + r() * 40},${r() * 0.06})`;
      g.fillRect(r() * W, r() * H, 2, 2);
    }
    return c;
  }

  resize() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    this.canvas.width = window.innerWidth * dpr;
    this.canvas.height = window.innerHeight * dpr;
    this.canvas.style.width = window.innerWidth + 'px';
    this.canvas.style.height = window.innerHeight + 'px';
  }

  _drawStrokesUpTo(n) {
    const g = this.offCtx;
    let count = 0;
    g.lineCap = 'round'; g.lineJoin = 'round';
    for (const s of this.strokes) {
      const len = s.pts.length;
      if (count + len <= this.drawn) { count += len; continue; }
      const start = Math.max(1, this.drawn - count);
      const end = Math.min(len, n - count);
      for (let i = start; i < end; i++) {
        const [x0, y0] = s.pts[i - 1], [x1, y1] = s.pts[i];
        // crayon: several thin jittered passes
        g.globalCompositeOperation = s.bg ? 'destination-over' : 'source-over';
        for (let k = 0; k < 3; k++) {
          g.strokeStyle = s.color;
          g.globalAlpha = (s.alpha ?? 0.9) * (0.35 + this.rand() * 0.35);
          g.lineWidth = s.width * (0.55 + this.rand() * 0.5);
          g.beginPath();
          g.moveTo(x0 + (this.rand() - 0.5) * 3, y0 + (this.rand() - 0.5) * 3);
          g.lineTo(x1 + (this.rand() - 0.5) * 3, y1 + (this.rand() - 0.5) * 3);
          g.stroke();
        }
      }
      count += len;
      if (count >= n) break;
    }
    g.globalAlpha = 1;
    g.globalCompositeOperation = 'source-over';
    this.drawn = Math.max(this.drawn, n);
  }

  update(dt) {
    if (this.finished) return;
    this.time += dt;
    // the drawing completes over ~22 seconds
    const target = Math.min(this.totalPts, Math.floor((this.time / 22) * this.totalPts));
    if (target > this.drawn) this._drawStrokesUpTo(target);
    const si = Math.min(STORY.length - 1, Math.floor((this.time - 1.0) / 5.2));
    if (si !== this.storyIndex && this.time > 1.0) {
      this.storyIndex = si;
      this.caption.classList.remove('show');
      setTimeout(() => { this.caption.textContent = STORY[si]; this.caption.classList.add('show'); }, 250);
    }
    if (si === 3) this.titleEl.classList.add('show');
    if (this.time > this._storyTime(STORY.length) && !this.done) {
      this._drawStrokesUpTo(this.totalPts);
      this.done = true;
      this.continueEl.classList.add('show');
    }
    if (this.leaving) {
      this.zoom += dt * 0.6;
      this.el.style.opacity = String(Math.max(0, 1 - this.zoom * 1.4));
      if (this.zoom > 0.75) this._end();
    }
    this.render();
  }

  render() {
    const g = this.ctx;
    const cw = this.canvas.width, ch = this.canvas.height;
    const scale = Math.max(cw / W, ch / H) * (1 + this.zoom * 0.8);
    g.fillStyle = '#fffaf0';
    g.fillRect(0, 0, cw, ch);
    g.save();
    // focus the zoom on Jacinta & Pinky
    const fx = 770, fy = 560;
    g.translate(cw / 2, ch / 2);
    g.scale(scale, scale);
    g.translate(-W / 2 - (fx - W / 2) * this.zoom, -H / 2 - (fy - H / 2) * this.zoom);
    // gentle paper sway
    g.rotate(Math.sin(this.time * 0.3) * 0.004);
    g.drawImage(this.paper, 0, 0);
    g.drawImage(this.off, 0, 0);
    g.restore();
  }

  finish() {
    if (this.leaving) return;
    this._drawStrokesUpTo(this.totalPts);
    this.leaving = true;
    this.caption.classList.remove('show');
    this.continueEl.classList.remove('show');
    this.audio?.portal();
  }

  _end() {
    if (this.finished) return;
    this.finished = true;
    window.removeEventListener('keydown', this._keyHandler);
    window.removeEventListener('resize', this._resize);
    this.el.remove();
    this.onFinish?.();
  }
}
