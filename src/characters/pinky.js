// ---------------------------------------------------------------
// PINKY — a silky, pale-pink toddler pillow with a blue marker smiley face.
// Face is traced from the family's drawing (see faces.js → pinkyRealFace).
// To fine-tune his look, change PINKY_LOOK below.
// ---------------------------------------------------------------
import * as THREE from 'three';
import { pillowFaceTexture, pinkyWrinkleTexture } from './faces.js';
import { damp } from '../util/noise.js';

export const PINKY_LOOK = {
  color: '#f1c9bf', // worn, pale pinky-beige satin (from the photo of the real Pinky)
  sheen: '#fff2ea',
  width: 0.62, // Pinky stands tall, like a portrait
  height: 0.9,
  thickness: 0.36,
};

const geoCache = new Map();

// A soft, puffy pillow shape with gently pointed corners
export function pillowGeometry(w = PINKY_LOOK.width, h = PINKY_LOOK.height, t = PINKY_LOOK.thickness) {
  const key = [w, h, t].join(',');
  if (geoCache.has(key)) return geoCache.get(key);
  const g = new THREE.BoxGeometry(1, 1, 1, 20, 28, 8);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    let x = p.getX(i) * 2, y = p.getY(i) * 2, z = p.getZ(i) * 2; // -1..1
    const puff = Math.sqrt(Math.max(0, (1 - Math.pow(Math.abs(x), 3)) * (1 - Math.pow(Math.abs(y), 3))));
    const zz = z * (0.06 + 0.94 * Math.pow(puff, 0.7));
    // pointy corners & slightly pinched edge seams
    const cornerX = Math.sign(x) * 0.04 * Math.pow(Math.abs(y), 6);
    const cornerY = Math.sign(y) * 0.05 * Math.pow(Math.abs(x), 6);
    const pinch = 1 - 0.035 * (1 - Math.abs(z));
    p.setXYZ(i, (x * pinch + cornerX) * w / 2, (y * pinch + cornerY) * h / 2, zz * t / 2);
  }
  g.computeVertexNormals();
  geoCache.set(key, g);
  return g;
}

export class Pillow {
  /**
   * @param {object} o
   * @param {number} o.scale overall size (1 = Pinky in Pinky Land)
   * @param {string} o.color tint for Pinky's friends
   * @param {number} o.variant face variation (0 = Pinky's real face)
   */
  constructor({ scale = 1, color = PINKY_LOOK.color, variant = 0, name = 'Pinky', ink, plain = false } = {}) {
    this.plain = plain;
    this.name = name;
    this.variant = variant;
    this.ink = ink;
    this.root = new THREE.Group();
    this.root.name = name;
    this.body = new THREE.Group();
    this.root.add(this.body);
    const geo = pillowGeometry();
    const side = new THREE.MeshPhysicalMaterial({
      color, roughness: 0.38, sheen: 1, sheenColor: new THREE.Color(PINKY_LOOK.sheen), sheenRoughness: 0.25,
      clearcoat: 0.25, clearcoatRoughness: 0.5,
    });
    // the real Pinky is wrinkly all over
    if (variant === 0 && !plain) { side.map = pinkyWrinkleTexture(); side.bumpMap = pinkyWrinkleTexture(true); side.bumpScale = 0.6; }
    this.faceMat = side.clone();
    if (variant === 0 && !plain) { this.faceMat.bumpMap = pinkyWrinkleTexture(true); this.faceMat.bumpScale = 0.6; }
    this.faceMat.map = pillowFaceTexture({ variant, ink, plain });
    // BoxGeometry material order: +x, -x, +y, -y, +z (front/face), -z (back)
    this.mesh = new THREE.Mesh(geo, [side, side, side, side, this.faceMat, side]);
    this.mesh.castShadow = true;
    this.mesh.receiveShadow = true;
    this.mesh.position.y = PINKY_LOOK.height / 2;
    this.body.add(this.mesh);
    // soft seam piping around the edge
    const seamCurve = new THREE.CatmullRomCurve3(
      [[-1, -1], [1, -1], [1, 1], [-1, 1]].flatMap(([sx, sy], i, arr) => {
        const [nx, ny] = arr[(i + 1) % 4];
        const pts = [];
        for (let k = 0; k < 6; k++) {
          const t = k / 6;
          pts.push(new THREE.Vector3((sx + (nx - sx) * t) * PINKY_LOOK.width * 0.485, (sy + (ny - sy) * t) * PINKY_LOOK.height * 0.485, 0));
        }
        return pts;
      }), true);
    const seam = new THREE.Mesh(new THREE.TubeGeometry(seamCurve, 80, 0.012, 6, true), side);
    seam.position.y = PINKY_LOOK.height / 2;
    this.body.add(seam);

    this.root.scale.setScalar(scale);
    this.baseScale = scale;
    this.time = Math.random() * 10;
    this.hop = 0;
    this.squash = 0;
    this.blinkTimer = 2 + Math.random() * 3;
    this.blink = 0;
    this.anim = { speed: 0, grounded: true, vy: 0, swim: false, sit: false, action: null, actionT: 0 };
    this._sw = 0;
  }

  setMood(mood) {
    this.mood = mood;
    this.faceMat.map = pillowFaceTexture({ variant: this.variant, mood, ink: this.ink, plain: this.plain });
  }

  land(strength = 1) { this.squash = Math.min(1, 0.5 + strength * 0.5); }

  playAction(name, duration = 1.5) { this.anim.action = name; this.anim.actionT = duration; }

  update(dt) {
    const a = this.anim;
    this.time += dt;
    this.blinkTimer -= dt;
    if (this.blinkTimer < 0) {
      this.blink = 0.14;
      this.blinkTimer = 2.5 + Math.random() * 4;
      this.faceMat.map = pillowFaceTexture({ variant: this.variant, blink: true, mood: this.mood, ink: this.ink, plain: this.plain });
    }
    if (this.blink > 0) {
      this.blink -= dt;
      if (this.blink <= 0) this.faceMat.map = pillowFaceTexture({ variant: this.variant, mood: this.mood, ink: this.ink, plain: this.plain });
    }
    if (a.actionT > 0) { a.actionT -= dt; if (a.actionT <= 0) a.action = null; }

    const moving = Math.min(1, a.speed / 2);
    this._sw = damp(this._sw, a.swim ? 1 : 0, 5, dt);
    this.squash = Math.max(0, this.squash - dt * 4);

    let sy = 1, sx = 1, y = 0, tilt = 0, roll = 0;
    if (a.grounded && !a.swim) {
      // happy little hops while moving
      this.hop += dt * (5 + a.speed * 2.2) * (moving > 0.05 ? 1 : 0);
      const h = Math.abs(Math.sin(this.hop));
      y = h * 0.18 * moving;
      sy = 1 + (h - 0.5) * 0.18 * moving;
      sx = 1 - (h - 0.5) * 0.12 * moving;
      tilt = 0.18 * moving;
      roll = Math.sin(this.hop) * 0.08 * moving;
      // breathing when still
      const br = Math.sin(this.time * 2.2) * 0.025 * (1 - moving);
      sy += br; sx -= br * 0.6;
    } else if (!a.swim) {
      const stretch = Math.max(-1, Math.min(1, a.vy / 12));
      sy = 1 + stretch * 0.15;
      sx = 1 - stretch * 0.08;
      tilt = -0.1 * stretch;
    }
    if (this._sw > 0.01) {
      // glides flat through the water like a little ray
      tilt = tilt * (1 - this._sw) + 1.35 * this._sw;
      roll += Math.sin(this.time * 2.5) * 0.15 * this._sw;
      sx *= 1 + Math.sin(this.time * 5) * 0.04 * this._sw;
    }
    // landing squash
    const sq = Math.sin(this.squash * Math.PI) * 0.25;
    sy *= 1 - sq; sx *= 1 + sq * 0.7;

    if (a.action === 'cheer') { y += Math.abs(Math.sin(this.time * 9)) * 0.25; roll += Math.sin(this.time * 9) * 0.15; }
    if (a.action === 'hug') { sx *= 1.08; sy *= 0.94; tilt = 0.25; }
    if (a.action === 'wave') roll += Math.sin(this.time * 10) * 0.2;
    if (a.sit) { tilt = -0.25; sy *= 0.92; sx *= 1.05; }

    this.body.position.y = y + (this._sw > 0.01 ? 0.25 * this._sw : 0);
    this.body.scale.set(sx, sy, sx);
    this.body.rotation.x = tilt;
    this.body.rotation.z = roll;
  }
}
