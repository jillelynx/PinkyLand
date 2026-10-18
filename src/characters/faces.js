// Faces are painted on small canvases and wrapped onto heads.
import * as THREE from 'three';

const cache = new Map();

function tex(canvas) {
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

/**
 * Face texture for a sphere head. The face is centered at u=0.25 (front).
 * mood: 'happy' | 'sad' | 'hurt' | 'worried' | 'mean'
 */
export function humanFaceTexture({ skin, eyes = '#2a1a10', mood = 'happy', blink = false, freckles = false, glasses = false, brows = null, smile = 'open' }) {
  const key = [skin, eyes, mood, blink, freckles, glasses, brows, smile].join('|');
  if (cache.has(key)) return cache.get(key);
  const W = 1024, H = 512;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d');
  g.fillStyle = skin;
  g.fillRect(0, 0, W, H);
  // subtle shading toward the back of the head
  const grd = g.createLinearGradient(0, 0, W, 0);
  grd.addColorStop(0, 'rgba(0,0,0,0.0)');
  grd.addColorStop(0.75, 'rgba(0,0,0,0.06)');
  grd.addColorStop(1, 'rgba(0,0,0,0.0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, W, H);

  const cx = W * 0.25, cy = H * 0.56; // equator is H*0.5
  const ex = 62, ey = cy - 6;
  // cheeks
  g.fillStyle = 'rgba(255,120,140,0.35)';
  for (const s of [-1, 1]) {
    g.beginPath(); g.ellipse(cx + s * 96, cy + 52, 34, 20, 0, 0, Math.PI * 2); g.fill();
  }
  if (freckles) {
    g.fillStyle = 'rgba(120,70,40,0.5)';
    for (let i = 0; i < 10; i++) {
      const s = i < 5 ? -1 : 1;
      g.beginPath(); g.arc(cx + s * (70 + (i % 5) * 9), cy + 30 + ((i * 7) % 13), 3, 0, Math.PI * 2); g.fill();
    }
  }
  // eyes
  for (const s of [-1, 1]) {
    const x = cx + s * ex;
    if (blink) {
      g.strokeStyle = eyes; g.lineWidth = 7; g.lineCap = 'round';
      g.beginPath(); g.arc(x, ey - 4, 20, 0.2 * Math.PI, 0.8 * Math.PI); g.stroke();
      continue;
    }
    g.fillStyle = '#ffffff';
    g.beginPath(); g.ellipse(x, ey, 25, 32, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = eyes;
    g.beginPath(); g.ellipse(x + s * 1, ey + 4, 20, 26, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#000000';
    g.beginPath(); g.ellipse(x + s * 1, ey + 6, 11, 14, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#ffffff';
    g.beginPath(); g.arc(x - 7, ey - 6, 7, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.arc(x + 7, ey + 12, 3.5, 0, Math.PI * 2); g.fill();
    // lashes / lid line
    g.strokeStyle = 'rgba(40,20,10,0.8)'; g.lineWidth = 5; g.lineCap = 'round';
    g.beginPath(); g.ellipse(x, ey, 26, 33, 0, 1.15 * Math.PI, 1.85 * Math.PI); g.stroke();
    if (mood === 'sad' || mood === 'hurt' || mood === 'worried') {
      // tears / sad brows
      g.strokeStyle = 'rgba(60,35,20,0.9)'; g.lineWidth = 7;
      g.beginPath(); g.moveTo(x - 24 * s * -1, ey - 52); g.lineTo(x + 20 * s * -1, ey - 42 - 10); g.stroke();
      if (mood !== 'worried') {
        g.fillStyle = 'rgba(120,200,255,0.9)';
        g.beginPath(); g.ellipse(x + s * 8, ey + 44, 7, 11, 0, 0, Math.PI * 2); g.fill();
      }
    } else if (mood === 'mean') {
      g.strokeStyle = 'rgba(50,30,20,0.95)'; g.lineWidth = 8;
      g.beginPath(); g.moveTo(x - s * 26, ey - 50); g.lineTo(x + s * 22, ey - 36); g.stroke();
    } else if (brows) {
      // defined, gently arched brows
      g.strokeStyle = brows; g.lineCap = 'round';
      g.lineWidth = 12;
      g.beginPath(); g.moveTo(x - s * 30, ey - 46); g.quadraticCurveTo(x + s * 4, ey - 68, x + s * 38, ey - 50); g.stroke();
      g.lineWidth = 7;
      g.beginPath(); g.moveTo(x - s * 26, ey - 42); g.quadraticCurveTo(x + s * 4, ey - 62, x + s * 40, ey - 46); g.stroke();
    } else {
      g.strokeStyle = 'rgba(70,40,25,0.55)'; g.lineWidth = 6;
      g.beginPath(); g.arc(x, ey - 18, 34, 1.3 * Math.PI, 1.7 * Math.PI); g.stroke();
    }
  }
  // nose
  g.strokeStyle = 'rgba(150,80,60,0.35)'; g.lineWidth = 5;
  g.beginPath(); g.arc(cx, cy + 22, 8, 0.1 * Math.PI, 0.9 * Math.PI); g.stroke();
  // mouth
  g.lineCap = 'round';
  if (mood === 'happy' && smile === 'closed') {
    // soft closed-mouth smile with rosy lips
    g.strokeStyle = '#b8606a'; g.lineWidth = 8;
    g.beginPath(); g.moveTo(cx - 36, cy + 60); g.quadraticCurveTo(cx, cy + 80, cx + 36, cy + 60); g.stroke();
    g.fillStyle = 'rgba(214,120,130,0.55)';
    g.beginPath(); g.ellipse(cx, cy + 76, 18, 6, 0, 0, Math.PI * 2); g.fill();
    g.strokeStyle = 'rgba(150,80,70,0.35)'; g.lineWidth = 4;
    for (const s of [-1, 1]) { g.beginPath(); g.arc(cx + s * 40, cy + 56, 6, s > 0 ? 0.6 * Math.PI : -0.4 * Math.PI, s > 0 ? 1.1 * Math.PI : 0.4 * Math.PI); g.stroke(); }
  } else if (mood === 'happy') {
    g.fillStyle = '#b84a5a';
    g.beginPath(); g.moveTo(cx - 30, cy + 54); g.quadraticCurveTo(cx, cy + 92, cx + 30, cy + 54); g.quadraticCurveTo(cx, cy + 64, cx - 30, cy + 54); g.fill();
    g.fillStyle = '#ff9aa8';
    g.beginPath(); g.ellipse(cx, cy + 72, 12, 6, 0, 0, Math.PI * 2); g.fill();
  } else if (mood === 'mean') {
    g.strokeStyle = '#7a3a3a'; g.lineWidth = 7;
    g.beginPath(); g.moveTo(cx - 24, cy + 66); g.quadraticCurveTo(cx + 4, cy + 58, cx + 26, cy + 62); g.stroke();
  } else {
    g.strokeStyle = '#8a3a4a'; g.lineWidth = 7;
    g.beginPath(); g.moveTo(cx - 22, cy + 74); g.quadraticCurveTo(cx, cy + 58, cx + 22, cy + 74); g.stroke();
  }
  if (glasses) {
    g.strokeStyle = '#333'; g.lineWidth = 6;
    for (const s of [-1, 1]) { g.beginPath(); g.arc(cx + s * ex, ey, 40, 0, Math.PI * 2); g.stroke(); }
    g.beginPath(); g.moveTo(cx - 22, ey - 4); g.lineTo(cx + 22, ey - 4); g.stroke();
    g.beginPath(); g.moveTo(cx - ex - 40, ey); g.lineTo(cx - 200, ey - 8); g.stroke();
    g.beginPath(); g.moveTo(cx + ex + 40, ey); g.lineTo(cx + 200, ey - 8); g.stroke();
  }
  const t = tex(c);
  cache.set(key, t);
  return t;
}

/**
 * Pinky (formerly a placeholder) — Pinky's face, drawn to look like a young child's marker drawing.
 * When the real photo of Pinky arrives, replace this with the real face.
 * `variant` makes slightly different faces for Pinky's friends.
 */
export function pillowFaceTexture({ variant = 0, mood = 'happy', blink = false, ink = '#3366cc' } = {}) {
  if (variant === 0) return pinkyRealFace({ mood, blink, ink });
  return pillowFaceVariant({ variant, mood, blink, ink });
}

// Pinky's real face, traced from the drawing Jacinta's family shared:
// two chunky blue marker eyes and a U-shaped smile.
function pinkyRealFace({ mood, blink, ink }) {
  const key = ['pinky-real', mood, blink, ink].join('|');
  if (cache.has(key)) return cache.get(key);
  // portrait canvas matching Pinky's shape (0.62 wide x 0.9 tall)
  const W = 512, H = 744;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d');
  g.fillStyle = '#ffffff';
  g.fillRect(0, 0, W, H);
  // the face is small and sits in the top third of the pillow
  g.translate(256, 250);
  g.scale(0.66, 0.66);
  g.translate(-256, -238);
  g.fillStyle = ink; g.strokeStyle = ink;
  g.lineCap = 'round'; g.lineJoin = 'round';
  // marker blob: slightly lumpy filled shape
  function blob(cx, cy, rx, ry, seed) {
    g.beginPath();
    for (let i = 0; i <= 40; i++) {
      const a = (i / 40) * Math.PI * 2;
      const k = 1 + Math.sin(a * 3 + seed) * 0.05 + Math.sin(a * 5 + seed * 2) * 0.03;
      const x = cx + Math.cos(a) * rx * k, y = cy + Math.sin(a) * ry * k;
      if (i === 0) g.moveTo(x, y); else g.lineTo(x, y);
    }
    g.fill();
  }
  // positions follow the drawing (scaled into a 512 square, centered)
  const lx = 145, rx = 367, ey = 185;
  if (blink) {
    g.lineWidth = 34;
    for (const x of [lx, rx]) { g.beginPath(); g.moveTo(x - 36, ey + 6); g.quadraticCurveTo(x, ey + 30, x + 36, ey + 6); g.stroke(); }
  } else {
    blob(lx, ey, 40, 48, 1.3);
    blob(rx, ey - 4, 38, 46, 4.1);
    // the right eye in the drawing has a second overlapping stroke
    blob(rx + 2, ey + 12, 34, 38, 2.2);
  }
  // U-shaped smile: two short sides and a rounded bottom
  g.lineWidth = 50;
  g.beginPath();
  if (mood === 'sad') {
    g.moveTo(196, 345); g.lineTo(200, 305); g.quadraticCurveTo(258, 268, 300, 300); g.lineTo(306, 345);
  } else {
    g.moveTo(198, 258);
    g.lineTo(200, 284);
    g.quadraticCurveTo(204, 316, 250, 314);
    g.quadraticCurveTo(298, 314, 300, 284);
    g.lineTo(302, 258);
  }
  g.stroke();
  const t = tex(c);
  cache.set(key, t);
  return t;
}

function pillowFaceVariant({ variant, mood, blink, ink }) {
  const key = ['pillow', variant, mood, blink, ink].join('|');
  if (cache.has(key)) return cache.get(key);
  const W = 512, H = 744;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d');
  g.fillStyle = '#ffffff';
  g.fillRect(0, 0, W, H);
  // friends' faces sit a little lower and bigger than Pinky's
  g.translate(256, 300);
  g.scale(0.75, 0.75);
  g.translate(-256, -256);
  // seeded wobble so each face is a little different but stable
  let s = 12345 + variant * 999;
  const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  g.strokeStyle = ink; g.fillStyle = ink;
  g.lineCap = 'round'; g.lineJoin = 'round';

  function wobblyPath(points, width) {
    // draw twice with tiny offsets to look like a marker
    for (let pass = 0; pass < 2; pass++) {
      g.lineWidth = width * (pass ? 0.75 : 1);
      g.globalAlpha = pass ? 0.6 : 0.95;
      g.beginPath();
      points.forEach(([x, y], i) => {
        const jx = x + (r() - 0.5) * 5, jy = y + (r() - 0.5) * 5;
        if (i === 0) g.moveTo(jx, jy); else g.lineTo(jx, jy);
      });
      g.stroke();
    }
    g.globalAlpha = 1;
  }
  const ex = 120 + variant * 6, ey = 210 + (variant % 3) * 6;
  for (const side of [-1, 1]) {
    const x = 256 + side * ex;
    if (blink) {
      wobblyPath([[x - 28, ey], [x - 10, ey + 8], [x + 10, ey + 8], [x + 28, ey]], 13);
      continue;
    }
    // filled wobbly oval eyes
    g.beginPath();
    const rx = 22 + r() * 6, ry = 30 + r() * 8;
    for (let i = 0; i <= 20; i++) {
      const a = (i / 20) * Math.PI * 2;
      const k = 1 + (r() - 0.5) * 0.12;
      const px = x + Math.cos(a) * rx * k, py = ey + Math.sin(a) * ry * k;
      if (i === 0) g.moveTo(px, py); else g.lineTo(px, py);
    }
    g.fill();
    // a little shine dot (kids often do this)
    g.fillStyle = '#ffffff';
    g.beginPath(); g.arc(x - 7, ey - 10, 6, 0, Math.PI * 2); g.fill();
    g.fillStyle = ink;
  }
  // big smile
  const pts = [];
  const mw = 150 + variant * 8, my = 300;
  if (mood === 'sad') {
    for (let i = 0; i <= 16; i++) { const t = i / 16; pts.push([256 - mw * 0.6 + t * mw * 1.2, my + 70 - Math.sin(t * Math.PI) * 40]); }
  } else {
    for (let i = 0; i <= 16; i++) { const t = i / 16; pts.push([256 - mw + t * mw * 2, my + Math.sin(t * Math.PI) * 85]); }
  }
  wobblyPath(pts, 16);
  // little smile-corner dimples
  if (mood !== 'sad') {
    wobblyPath([[256 - mw - 12, my - 14], [256 - mw + 4, my + 6]], 11);
    wobblyPath([[256 + mw + 12, my - 14], [256 + mw - 4, my + 6]], 11);
  }
  // pink cheeks (crayon)
  g.fillStyle = 'rgba(255,90,140,0.28)';
  for (const side of [-1, 1]) {
    for (let k = 0; k < 40; k++) {
      g.beginPath();
      g.arc(256 + side * 175 + (r() - 0.5) * 50, 290 + (r() - 0.5) * 30, 5 + r() * 6, 0, Math.PI * 2);
      g.fill();
    }
  }
  const t = tex(c);
  cache.set(key, t);
  return t;
}
