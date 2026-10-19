// The player: movement (walk, run, jump, double jump, swim, dive, cloud
// bounce, glide with the cape), plus switching between characters.
import * as THREE from 'three';
import { clamp, damp, angleDamp } from '../util/noise.js';

// Ground steeper than this (rise per metre, about 50°) can't be walked or swum up
const MAX_SLOPE = 1.15;

export const AVATAR_STATS = {
  jacinta: { walk: 3.6, run: 6.6, jump: 8.6, gravity: 24, radius: 0.32, height: 1.3, eye: 1.05, swimDepth: 0.95 },
  jacintaPack: { walk: 3.5, run: 6.4, jump: 8.4, gravity: 24, radius: 0.34, height: 1.3, eye: 1.05, swimDepth: 0.95 },
  liev: { walk: 3.8, run: 7.4, jump: 9.0, gravity: 24, radius: 0.32, height: 1.4, eye: 1.12, swimDepth: 1.0 },
  pinky: { walk: 3.2, run: 5.8, jump: 9.6, gravity: 17, radius: 0.36, height: 0.9, eye: 0.62, swimDepth: 0.4, floaty: true },
};

export class Player {
  constructor(scene, world, input, cameraRig, audio) {
    this.scene = scene;
    this.world = world;
    this.input = input;
    this.rig = cameraRig;
    this.audio = audio;
    this.root = new THREE.Group();
    scene.add(this.root);
    this.pos = this.root.position;
    this.vel = new THREE.Vector3();
    this.yaw = 0;
    this.grounded = true;
    this.coyote = 0;
    this.jumpBuffer = 0;
    this.jumpsUsed = 0;
    this.swimming = false;
    this.underwater = false;
    this.gliding = false;
    this.hasCape = false;
    this.lastSafe = new THREE.Vector3();
    this.frozen = false; // during dialogue / cut-scenes
    this.avatarKey = 'jacintaPack';
    this.avatars = {};
    this.model = null;
    this.stepTimer = 0;
    this.speed = 0;
    this.fallTime = 0;
    this.onLand = null; // callback(strength)
    this.events = { bounce: null, splash: null, jump: null };
  }

  registerAvatar(key, model) {
    this.avatars[key] = model;
  }

  setAvatar(key) {
    if (!this.avatars[key]) return;
    if (this.model) this.root.remove(this.model.root);
    this.avatarKey = key;
    this.model = this.avatars[key];
    this.root.add(this.model.root);
    this.model.root.position.set(0, 0, 0);
    this.model.root.rotation.set(0, 0, 0);
    this.stats = AVATAR_STATS[key];
    if (this.model.backpack) this.model.backpack.visible = key === 'jacintaPack';
    this._applyCape();
  }

  setCape(on) { this.hasCape = on; this._applyCape(); }
  _applyCape() {
    const current = this.avatars[this.avatarKey];
    for (const m of new Set(Object.values(this.avatars))) if (m.cape) m.cape.visible = this.hasCape && m === current;
  }

  teleport(x, y, z, yaw = this.yaw) {
    this.pos.set(x, y, z);
    this.vel.set(0, 0, 0);
    this.yaw = yaw;
    this.root.rotation.y = yaw;
    this.lastSafe.set(x, y, z);
  }

  get eyePos() { return new THREE.Vector3(this.pos.x, this.pos.y + this.stats.eye, this.pos.z); }

  update(dt) {
    const inp = this.input;
    const st = this.stats;
    const w = this.world;
    dt = Math.min(dt, 1 / 20);

    // ---- read movement input relative to the camera
    let ix = 0, iz = 0;
    if (!this.frozen) {
      if (inp.down('KeyW', 'ArrowUp')) iz += 1;
      if (inp.down('KeyS', 'ArrowDown')) iz -= 1;
      if (inp.down('KeyA', 'ArrowLeft')) ix -= 1;
      if (inp.down('KeyD', 'ArrowRight')) ix += 1;
      if (inp.padState) { ix += inp.padState.lx; iz -= inp.padState.ly; }
    }
    const len = Math.hypot(ix, iz);
    if (len > 1) { ix /= len; iz /= len; }
    const fwd = this.rig.forward(new THREE.Vector3());
    const right = this.rig.right(new THREE.Vector3());
    const wish = new THREE.Vector3().addScaledVector(fwd, iz).addScaledVector(right, ix);
    const wishLen = Math.min(1, wish.length());
    if (wishLen > 0.001) wish.normalize();
    const running = !this.frozen && (inp.down('ShiftLeft', 'ShiftRight') || (inp.padState && inp.padState.run));
    const jumpPressed = !this.frozen && inp.hit('Space', 'Pad_jump');
    const jumpHeld = !this.frozen && (inp.down('Space') || (inp.padState && inp.padState.jump));

    const ground = w.groundHeight(this.pos.x, this.pos.z, this.pos.y);
    const waterDepth = w.waterLevel - w.terrainHeight(this.pos.x, this.pos.z);

    // ---- swimming check
    const submerge = w.waterLevel - this.pos.y;
    if (!this.swimming && waterDepth > st.swimDepth + 0.15 && submerge > st.swimDepth * 0.75) {
      this.swimming = true;
      this.vel.y *= 0.3;
      this.events.splash?.(Math.abs(this.vel.y));
    } else if (this.swimming && (waterDepth < st.swimDepth * 0.8 || submerge < -0.25)) {
      this.swimming = false;
    }

    if (this.swimming) {
      this._swim(dt, wish, wishLen, running, jumpPressed, jumpHeld, inp);
    } else {
      this._walk(dt, wish, wishLen, running, jumpPressed, jumpHeld, ground);
    }

    // ---- horizontal collisions with trees, rocks, houses...
    w.collide(this.pos, st.radius, st.height);

    // ---- keep inside the world
    const b = w.bounds;
    const d = Math.hypot(this.pos.x - b.x, this.pos.z - b.z);
    // near the edge a gentle current (or breeze) eases you back
    const soft = b.soft ?? b.r - 12;
    if (d > soft) {
      const k = Math.min(1, (d - soft) / (b.r - soft));
      const push = 7 * k * k * dt;
      this.pos.x -= ((this.pos.x - b.x) / d) * push;
      this.pos.z -= ((this.pos.z - b.z) / d) * push;
      if (k > 0.25) this.events.edge?.(k);
    }
    if (d > b.r) {
      const k = b.r / d;
      this.pos.x = b.x + (this.pos.x - b.x) * k;
      this.pos.z = b.z + (this.pos.z - b.z) * k;
    }
    if (this.pos.y < -40) this.rescue();

    // ---- face the way we move
    const hs = Math.hypot(this.vel.x, this.vel.z);
    if (hs > 0.3 && wishLen > 0.05) this.yaw = angleDamp(this.yaw, Math.atan2(wish.x, wish.z), 12, dt);
    this.root.rotation.y = this.yaw;
    this.speed = hs;
    this.underwater = this.rig.camera.position.y < w.waterLevel - 0.05;

    // ---- animate model
    const a = this.model.anim;
    a.speed = hs;
    a.run = running && hs > st.walk + 0.3;
    a.grounded = this.grounded || this.swimming;
    a.vy = this.vel.y;
    a.swim = this.swimming && (this.pos.y < w.waterLevel - st.swimDepth * 0.4 || hs > 0.5);
    this.model.update(dt);
    if (this.model.cape) this._animateCape(dt, hs);

    // footsteps
    if (this.grounded && hs > 0.5 && !this.swimming) {
      this.stepTimer -= dt * (hs / 1.6);
      if (this.stepTimer < 0) { this.stepTimer = 0.5; this.audio?.footstep(this.avatarKey === 'pinky'); }
    }
    this.forwardMoving = wishLen > 0.2 && iz > 0.2;
  }

  _walk(dt, wish, wishLen, running, jumpPressed, jumpHeld, ground) {
    const st = this.stats;
    const target = (running ? st.run : st.walk) * wishLen;
    const accel = this.grounded ? 14 : 5;
    const vx = wish.x * target, vz = wish.z * target;
    this.vel.x = damp(this.vel.x, vx, accel, dt);
    this.vel.z = damp(this.vel.z, vz, accel, dt);

    if (jumpPressed) this.jumpBuffer = 0.14;
    else this.jumpBuffer -= dt;
    if (this.grounded) { this.coyote = 0.12; this.jumpsUsed = 0; } else this.coyote -= dt;

    if (this.jumpBuffer > 0) {
      if (this.coyote > 0) {
        this.vel.y = st.jump;
        this.grounded = false; this.coyote = 0; this.jumpBuffer = 0; this.jumpsUsed = 1;
        this.events.jump?.(1);
      } else if (this.jumpsUsed < 2) {
        // double jump!
        this.vel.y = st.jump * 0.92;
        this.jumpBuffer = 0; this.jumpsUsed = 2;
        this.events.jump?.(2);
        this.model.land?.(0.2);
      }
    }

    // gravity (Pinky is floaty)
    let g = st.gravity;
    if (this.vel.y < 0 && st.floaty) g *= 0.6;
    if (this.vel.y > 0 && !jumpHeld) g *= 1.6; // short hop when tapping
    this.vel.y -= g * dt;

    // glide with the magic cape
    this.gliding = false;
    if (this.hasCape && !this.grounded && jumpHeld && this.vel.y < 0 && this.jumpsUsed >= 1 && this.fallTime > 0.15) {
      this.vel.y = Math.max(this.vel.y, -1.6);
      const gs = st.run * 1.15;
      this.vel.x = damp(this.vel.x, wish.x * gs * Math.max(0.6, wishLen), 2, dt);
      this.vel.z = damp(this.vel.z, wish.z * gs * Math.max(0.6, wishLen), 2, dt);
      this.gliding = true;
    }
    if (this.vel.y < -28) this.vel.y = -28;

    this._moveH(dt);
    this.pos.y += this.vel.y * dt;
    if (!this.grounded) this.fallTime += dt; else this.fallTime = 0;

    // bouncy clouds & bouncy pinkies
    const bounce = this.world.bounceAt(this.pos, this.vel.y);
    if (bounce) {
      this.pos.y = bounce.top;
      this.vel.y = bounce.power ?? 16;
      this.jumpsUsed = 1;
      this.grounded = false;
      this.events.bounce?.(bounce);
      this.model.land?.(1);
      return;
    }

    const gh = this.world.groundHeight(this.pos.x, this.pos.z, this.pos.y + 0.4);
    if (this.pos.y <= gh) {
      const impact = -this.vel.y;
      this.pos.y = gh;
      if (!this.grounded && impact > 3) { this.onLand?.(impact); this.model.land?.(impact / 15); }
      this.vel.y = 0;
      this.grounded = true;
      // remember safe ground (not on water edge)
      if (this.world.waterLevel - this.world.terrainHeight(this.pos.x, this.pos.z) < 0.2) this.lastSafe.copy(this.pos);
    } else if (this.grounded && this.pos.y - gh < 0.35 && this.vel.y <= 0) {
      // stick to the ground when walking down hills
      this.pos.y = gh;
      this.vel.y = 0;
    } else {
      this.grounded = false;
    }
  }

  _swim(dt, wish, wishLen, running, jumpPressed, jumpHeld, inp) {
    const st = this.stats;
    const w = this.world;
    this.grounded = false;
    this.jumpsUsed = 0;
    const surfaceY = w.waterLevel - st.swimDepth * 0.75;
    const speed = (running ? 5.2 : 3.4) * wishLen;
    const dive = !this.frozen && (inp.down('ShiftLeft', 'ShiftRight', 'KeyX', 'ControlLeft') || (inp.padState && inp.padState.dive));
    let vy = 0;
    if (jumpHeld) vy = 3.2;
    if (dive) vy = -3.2;
    // Abzû-style: when diving and moving forward, follow the camera's tilt
    const atSurface = this.pos.y > surfaceY - 0.25;
    if (!dive && !jumpHeld) vy = atSurface ? 0 : 1.2; // gently float back up
    this.vel.x = damp(this.vel.x, wish.x * speed, 4, dt);
    this.vel.z = damp(this.vel.z, wish.z * speed, 4, dt);
    this.vel.y = damp(this.vel.y, vy, 4, dt);
    // hop out of the water at the surface
    if (jumpPressed && atSurface) {
      this.vel.y = st.jump * 0.85;
      this.swimming = false;
      this.events.splash?.(2);
      this.pos.y += 0.1;
    }
    this._moveH(dt);
    this.pos.y += this.vel.y * dt;
    if (this.swimming && this.pos.y > surfaceY) { this.pos.y = damp(this.pos.y, surfaceY, 8, dt); if (this.vel.y > 0) this.vel.y = 0; }
    // don't sink into the sea floor
    const floor = w.terrainHeight(this.pos.x, this.pos.z) + 0.25;
    if (this.pos.y < floor) { this.pos.y = floor; this.vel.y = Math.max(0, this.vel.y); }
    // bob at the surface
    if (atSurface) this.pos.y += Math.sin(performance.now() * 0.003) * 0.002;
  }

  // Move sideways in small steps so fast movement can't skip through things,
  // and slide along slopes that are too steep to climb (cliffs, pond walls).
  _moveH(dt) {
    const st = this.stats, w = this.world;
    const dx = this.vel.x * dt, dz = this.vel.z * dt;
    const n = Math.max(1, Math.ceil(Math.hypot(dx, dz) / 0.12));
    const sx = dx / n, sz = dz / n;
    for (let i = 0; i < n; i++) {
      const ox = this.pos.x, oz = this.pos.z;
      let nx = ox + sx, nz = oz + sz;
      if (this._isWall(nx, nz)) {
        const g = w.slope(nx, nz, this._sl || (this._sl = {}));
        const ux = g.x / (g.s || 1), uz = g.z / (g.s || 1);
        const up = sx * ux + sz * uz;
        // keep only the part of the step that runs along the slope
        nx = ox + sx - ux * Math.max(0, up);
        nz = oz + sz - uz * Math.max(0, up);
        if (this._isWall(nx, nz)) { nx = ox; nz = oz; }
        const vin = this.vel.x * ux + this.vel.z * uz;
        if (vin > 0) { this.vel.x -= ux * vin; this.vel.z -= uz * vin; }
        this.againstWall = 0.2;
      }
      this.pos.x = nx; this.pos.z = nz;
      w.collide(this.pos, st.radius, st.height);
    }
  }

  // Is the ground at (x, z) a wall in front of us? Gentle hills are fine;
  // steep banks and cliffs only block if they rise above our feet.
  _isWall(x, z) {
    const w = this.world;
    const h = w.terrainHeight(x, z);
    const feet = this.pos.y - (this.swimming ? 0.25 : 0);
    if (h <= feet + 0.06) return false;
    if (h > feet + 0.6) return true;
    return w.slope(x, z, this._sl || (this._sl = {})).s > MAX_SLOPE;
  }

  _animateCape(dt, hs) {
    const c = this.model.cape;
    const flutter = Math.sin(performance.now() * 0.012) * 0.08;
    const lift = this.gliding ? 1.25 : Math.min(0.9, hs * 0.12 + (this.grounded ? 0 : 0.4));
    c.rotation.x = damp(c.rotation.x, lift + flutter, 6, dt);
  }

  rescue() {
    // float softly back to the last safe place
    this.pos.copy(this.lastSafe).add(new THREE.Vector3(0, 2, 0));
    this.vel.set(0, 0, 0);
    this.swimming = false;
  }
}
