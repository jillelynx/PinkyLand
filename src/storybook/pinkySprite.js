// Draws Pinky in the storybook: a pale-pink pillow standing tall, with a small
// blue marker face in the top third. Corners act like little feet when he walks.
import { rng } from './paint.js';

export const PINKY_W = 36;
export const PINKY_H = 52;

/**
 * o: { x, y (bottom center), facing, t, sx, sy (squash), lean, step (walk phase), moving,
 *      expr: 'normal'|'wonder'|'sad'|'happy'|'hurt'|'sleepy', blink, lookX, lookY, sketch (0..1), alpha }
 */
export function drawPinky(g, o) {
  const W = PINKY_W, H = PINKY_H;
  const sx = o.sx ?? 1, sy = o.sy ?? 1;
  g.save();
  g.globalAlpha = o.alpha ?? 1;
  g.translate(o.x, o.y);
  g.rotate(o.lean || 0);
  g.scale(sx, sy);
  // little corner "feet" lift while walking
  const step = o.moving ? Math.sin(o.step || 0) : 0;
  const liftL = Math.max(0, step) * 6, liftR = Math.max(0, -step) * 6;
  const hw = W / 2;
  const top = -H;
  // outline points (pillow with pointy corners and puffy pinched sides)
  const P = [
    [-hw - 3, top - 2], // top-left corner
    [0, top + 3],
    [hw + 3, top - 2], // top-right corner
    [hw - 1.5, top + H * 0.5],
    [hw + 3, -liftR], // bottom-right foot
    [0, -3],
    [-hw - 3, -liftL], // bottom-left foot
    [-hw + 1.5, top + H * 0.5],
  ];
  const path = () => {
    g.beginPath();
    g.moveTo(P[0][0], P[0][1]);
    g.quadraticCurveTo(P[1][0], P[1][1] + 1, P[2][0], P[2][1]);
    g.quadraticCurveTo(P[3][0] + 4, P[3][1], P[4][0], P[4][1]);
    g.quadraticCurveTo(P[5][0], P[5][1] + 1, P[6][0], P[6][1]);
    g.quadraticCurveTo(P[7][0] - 4, P[7][1], P[0][0], P[0][1]);
    g.closePath();
  };
  const sketch = o.sketch ?? 1;
  // soft shadow on the ground
  if (sketch >= 1) {
    g.save();
    g.scale(1 / sx, 1 / sy);
    g.fillStyle = 'rgba(80,40,70,0.18)';
    g.beginPath();
    g.ellipse(0, 1, hw * 1.1 * sx, 4, 0, 0, Math.PI * 2);
    g.fill();
    g.restore();
  }
  // body fill with silky gradient
  const fillA = Math.min(1, Math.max(0, (sketch - 0.55) / 0.35));
  if (fillA > 0) {
    g.save();
    g.globalAlpha *= fillA;
    path();
    const grd = g.createLinearGradient(-hw, top, hw, 0);
    grd.addColorStop(0, '#fde8ee');
    grd.addColorStop(0.5, '#f8cfd9');
    grd.addColorStop(1, '#eeb3c2');
    g.fillStyle = grd;
    g.fill();
    // silky sheen
    g.globalAlpha *= 0.55;
    g.fillStyle = '#ffffff';
    g.beginPath();
    g.ellipse(-hw * 0.35, top + H * 0.3, 5, H * 0.22, -0.2, 0, Math.PI * 2);
    g.fill();
    g.restore();
  }
  // crayon outline (drawn progressively during the "being imagined" moment)
  g.save();
  g.lineCap = 'round'; g.lineJoin = 'round';
  g.strokeStyle = '#d98aa3';
  g.lineWidth = 2.6;
  if (sketch < 1) {
    path();
    g.setLineDash([400 * Math.min(1, sketch / 0.55), 999]);
    g.stroke();
    g.setLineDash([]);
  } else {
    path();
    g.stroke();
  }
  g.restore();

  // face (top third)
  const faceA = Math.min(1, Math.max(0, (sketch - 0.8) / 0.2));
  if (faceA > 0) {
    g.save();
    g.globalAlpha *= faceA;
    const fx = (o.lookX || 0) * 2.5 + (o.facing || 1) * 1.5;
    const fy = top + H * 0.3 + (o.lookY || 0) * 2;
    const ink = '#3366cc';
    g.fillStyle = ink; g.strokeStyle = ink;
    g.lineCap = 'round';
    const ex = 6.5;
    const expr = o.expr || 'normal';
    const blink = o.blink;
    for (const s of [-1, 1]) {
      const x = fx + s * ex, y = fy - 3;
      if (blink || expr === 'sleepy') {
        g.lineWidth = 2.2;
        g.beginPath(); g.moveTo(x - 2.6, y); g.quadraticCurveTo(x, y + 2, x + 2.6, y); g.stroke();
      } else if (expr === 'happy') {
        g.lineWidth = 2.2;
        g.beginPath(); g.moveTo(x - 2.6, y + 1); g.quadraticCurveTo(x, y - 3, x + 2.6, y + 1); g.stroke();
      } else if (expr === 'hurt') {
        g.lineWidth = 1.8;
        g.beginPath(); g.moveTo(x - 2, y - 2); g.lineTo(x + 2, y + 2); g.moveTo(x + 2, y - 2); g.lineTo(x - 2, y + 2); g.stroke();
      } else {
        const big = expr === 'wonder' ? 1.3 : 1;
        const low = expr === 'sad' ? 1 : 0;
        g.beginPath(); g.ellipse(x, y + low, 2.3 * big, 3.0 * big, 0, 0, Math.PI * 2); g.fill();
        if (expr === 'wonder') { g.fillStyle = '#ffffff'; g.beginPath(); g.arc(x - 0.8, y - 1.2, 0.9, 0, 7); g.fill(); g.fillStyle = ink; }
        if (expr === 'sad') { g.lineWidth = 1.2; g.beginPath(); g.moveTo(x - s * 3, y - 5); g.lineTo(x + s * 1, y - 6); g.stroke(); }
      }
    }
    // U-shaped smile
    g.lineWidth = 2.6;
    g.beginPath();
    if (expr === 'sad' || expr === 'hurt') {
      g.moveTo(fx - 3, fy + 7); g.quadraticCurveTo(fx, fy + 4, fx + 3, fy + 7);
    } else if (expr === 'wonder') {
      g.ellipse(fx, fy + 5, 1.8, 2.2, 0, 0, Math.PI * 2);
    } else {
      g.moveTo(fx - 3.2, fy + 2.5); g.lineTo(fx - 3.2, fy + 4.5);
      g.quadraticCurveTo(fx - 3.2, fy + 8, fx, fy + 8);
      g.quadraticCurveTo(fx + 3.2, fy + 8, fx + 3.2, fy + 4.5);
      g.lineTo(fx + 3.2, fy + 2.5);
    }
    g.stroke();
    // rosy cheeks when happy
    if (expr === 'happy' || expr === 'wonder') {
      g.fillStyle = 'rgba(255,110,150,0.35)';
      g.beginPath(); g.arc(fx - 10, fy + 4, 2.4, 0, 7); g.arc(fx + 10, fy + 4, 2.4, 0, 7); g.fill();
    }
    g.restore();
  }
  g.restore();
}

// A thought bubble above Pinky with a tiny drawing inside
export function drawThought(g, x, y, kind, t, alpha = 1) {
  g.save();
  g.globalAlpha = alpha;
  const bob = Math.sin(t * 3) * 2;
  g.fillStyle = '#ffffff';
  g.strokeStyle = '#c7a6c0';
  g.lineWidth = 2;
  for (const [dx, dy, r] of [[6, -6, 3], [12, -15, 5]]) { g.beginPath(); g.arc(x + dx, y + dy + bob, r, 0, 7); g.fill(); g.stroke(); }
  const cx = x + 26, cy = y - 38 + bob;
  g.beginPath(); g.ellipse(cx, cy, 22, 17, 0, 0, Math.PI * 2); g.fill(); g.stroke();
  g.lineCap = 'round';
  if (kind === '?') {
    g.fillStyle = '#7a5aa8'; g.font = 'bold 22px "Chalkboard SE", "Marker Felt", "Comic Sans MS", sans-serif';
    g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('?', cx, cy + 1);
  } else if (kind === '!') {
    g.fillStyle = '#e0609a'; g.font = 'bold 22px "Chalkboard SE", "Comic Sans MS", sans-serif';
    g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('!', cx, cy + 1);
  } else if (kind === 'heart') {
    g.fillStyle = '#ff6f9c';
    g.beginPath();
    g.moveTo(cx, cy + 7);
    g.bezierCurveTo(cx - 13, cy - 2, cx - 6, cy - 13, cx, cy - 5);
    g.bezierCurveTo(cx + 6, cy - 13, cx + 13, cy - 2, cx, cy + 7);
    g.fill();
  } else if (kind === 'girl') {
    // a tiny scribble of a curly-haired girl
    const r = rng(4);
    g.fillStyle = '#f1cfb8'; g.beginPath(); g.arc(cx, cy - 2, 6, 0, 7); g.fill();
    g.strokeStyle = '#4a2a1a'; g.lineWidth = 1.6;
    for (let i = 0; i < 9; i++) { const a = Math.PI * (0.9 + i * 0.15); g.beginPath(); g.arc(cx + Math.cos(a) * 7, cy - 2 + Math.sin(a) * 7, 2 + r(), 0, 7); g.stroke(); }
    g.fillStyle = '#ff9ec4'; g.fillRect(cx - 5, cy + 4, 10, 7);
  } else if (kind === 'crayon') {
    g.save(); g.translate(cx, cy); g.rotate(-0.4);
    g.fillStyle = '#e04a4a'; g.fillRect(-12, -3, 18, 6);
    g.beginPath(); g.moveTo(6, -3); g.lineTo(13, 0); g.lineTo(6, 3); g.fill();
    g.restore();
  } else if (kind === 'house') {
    g.fillStyle = '#ffd98a'; g.fillRect(cx - 7, cy - 2, 14, 10);
    g.fillStyle = '#e0609a'; g.beginPath(); g.moveTo(cx - 10, cy - 2); g.lineTo(cx, cy - 11); g.lineTo(cx + 10, cy - 2); g.fill();
  }
  g.restore();
}
