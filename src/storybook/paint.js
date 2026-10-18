// Little drawing helpers that make everything look hand-drawn:
// wobbly crayon lines, paper grain and crayon "coloring-in" fills.

export function rng(seed = 1) {
  let s = (seed * 9301 + 49297) % 233280 || 1;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

// a crayon line: a few slightly offset passes
export function crayonLine(g, pts, color, width = 4, seed = 1, alpha = 0.9) {
  const r = rng(seed);
  g.save();
  g.lineCap = 'round';
  g.lineJoin = 'round';
  g.strokeStyle = color;
  for (let pass = 0; pass < 2; pass++) {
    g.globalAlpha = alpha * (pass ? 0.55 : 0.9);
    g.lineWidth = width * (pass ? 0.6 : 1);
    g.beginPath();
    pts.forEach(([x, y], i) => {
      const jx = x + (r() - 0.5) * width * 0.5;
      const jy = y + (r() - 0.5) * width * 0.5;
      if (i === 0) g.moveTo(jx, jy); else g.lineTo(jx, jy);
    });
    g.stroke();
  }
  g.restore();
}

// points around a rectangle with soft wobbly edges (for outlines)
export function wobblyRectPts(x, y, w, h, seed = 1, amp = 2, step = 26) {
  const r = rng(seed);
  const pts = [];
  const edge = (x0, y0, x1, y1) => {
    const len = Math.hypot(x1 - x0, y1 - y0);
    const n = Math.max(2, Math.round(len / step));
    for (let i = 0; i < n; i++) {
      const t = i / n;
      pts.push([x0 + (x1 - x0) * t + (r() - 0.5) * amp, y0 + (y1 - y0) * t + (r() - 0.5) * amp]);
    }
  };
  edge(x, y, x + w, y); edge(x + w, y, x + w, y + h); edge(x + w, y + h, x, y + h); edge(x, y + h, x, y);
  pts.push(pts[0]);
  return pts;
}

export function fillPts(g, pts, fill) {
  g.beginPath();
  pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
  g.closePath();
  g.fillStyle = fill;
  g.fill();
}

const patternCache = new Map();

// paper grain texture
export function paperCanvas(size = 256, base = '#fbf4e6', seed = 3) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  g.fillStyle = base;
  g.fillRect(0, 0, size, size);
  const r = rng(seed);
  for (let i = 0; i < size * size * 0.08; i++) {
    const v = r();
    g.fillStyle = v < 0.5 ? `rgba(120,90,60,${r() * 0.05})` : `rgba(255,255,255,${r() * 0.15})`;
    g.fillRect(r() * size, r() * size, 1 + r() * 2, 1);
  }
  // a few long paper fibers
  g.strokeStyle = 'rgba(150,120,90,0.05)';
  for (let i = 0; i < 30; i++) {
    g.beginPath();
    const x = r() * size, y = r() * size;
    g.moveTo(x, y);
    g.quadraticCurveTo(x + (r() - 0.5) * 40, y + (r() - 0.5) * 40, x + (r() - 0.5) * 60, y + (r() - 0.5) * 60);
    g.stroke();
  }
  return c;
}

// crayon coloring-in: diagonal back-and-forth strokes
export function crayonPattern(g, color, { density = 7, alpha = 0.55, base = null, angle = -0.5, seed = 5, size = 128 } = {}) {
  const key = [color, density, alpha, base, angle, seed, size].join('|');
  if (patternCache.has(key)) return patternCache.get(key);
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const x = c.getContext('2d');
  if (base) { x.fillStyle = base; x.fillRect(0, 0, size, size); }
  const r = rng(seed);
  x.strokeStyle = color;
  x.lineCap = 'round';
  x.save();
  x.translate(size / 2, size / 2);
  x.rotate(angle);
  for (let i = -size; i < size; i += density) {
    x.globalAlpha = alpha * (0.6 + r() * 0.4);
    x.lineWidth = 2 + r() * 3;
    x.beginPath();
    x.moveTo(-size, i + (r() - 0.5) * 3);
    x.lineTo(size, i + (r() - 0.5) * 3);
    x.stroke();
  }
  x.restore();
  // waxy speckle
  for (let i = 0; i < 300; i++) {
    x.fillStyle = `rgba(255,255,255,${r() * 0.25})`;
    x.fillRect(r() * size, r() * size, 1, 1);
  }
  const p = g.createPattern(c, 'repeat');
  patternCache.set(key, p);
  return p;
}

export function lerpColor(a, b, t) {
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
  const ar = pa >> 16, ag = (pa >> 8) & 255, ab = pa & 255;
  const br = pb >> 16, bg = (pb >> 8) & 255, bb = pb & 255;
  const r = Math.round(ar + (br - ar) * t), gg = Math.round(ag + (bg - ag) * t), bl = Math.round(ab + (bb - ab) * t);
  return '#' + ((1 << 24) | (r << 16) | (gg << 8) | bl).toString(16).slice(1);
}

export function heartPath(g, x, y, s) {
  g.beginPath();
  g.moveTo(x, y + s * 0.35);
  g.bezierCurveTo(x - s * 0.9, y - s * 0.25, x - s * 0.45, y - s * 0.95, x, y - s * 0.45);
  g.bezierCurveTo(x + s * 0.45, y - s * 0.95, x + s * 0.9, y - s * 0.25, x, y + s * 0.35);
  g.closePath();
}

export function starPath(g, x, y, r, inner = 0.45) {
  g.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 ? r * inner : r;
    const px = x + Math.cos(a) * rr, py = y + Math.sin(a) * rr;
    if (i === 0) g.moveTo(px, py); else g.lineTo(px, py);
  }
  g.closePath();
}
