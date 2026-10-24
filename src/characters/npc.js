// Characters that live in the world: they turn to look at you, can walk to
// places, and friends can follow you around.
import * as THREE from 'three';
import { angleDamp, damp } from '../util/noise.js';

export class NPC {
  constructor(model, world, { x, z, yaw = 0, name, journalKey, talkRadius = 2.4 }) {
    this.model = model;
    this.world = world;
    this.name = name || model.name;
    this.journalKey = journalKey;
    this.talkRadius = talkRadius;
    this.root = model.root;
    this.root.position.set(x, world.groundHeight(x, z), z);
    this.yaw = yaw;
    this.homeYaw = yaw;
    this.root.rotation.y = yaw;
    this.target = null;
    this.speed = 2.2;
    this.lookAtPlayer = true;
    this.onArrive = null;
    this.hopper = !!model.land; // pillows hop
    this.wander = null; // { x, z, r }
    this._wanderT = 2 + Math.random() * 4;
  }

  walkTo(x, z, speed = 2.2) {
    return new Promise((res) => { this.target = new THREE.Vector2(x, z); this.speed = speed; this.onArrive = res; });
  }

  update(dt, playerPos) {
    const p = this.root.position;
    let moving = 0;
    if (!this.target && this.wander) {
      this._wanderT -= dt;
      if (this._wanderT < 0) {
        const a = Math.random() * Math.PI * 2, r = Math.random() * this.wander.r;
        const tx = this.wander.x + Math.cos(a) * r, tz = this.wander.z + Math.sin(a) * r;
        if (this.world.terrainHeight(tx, tz) > this.world.waterLevel) this.target = new THREE.Vector2(tx, tz);
        this.speed = 1.2;
        this._wanderT = 4 + Math.random() * 5;
      }
    }
    if (this.target) {
      const dx = this.target.x - p.x, dz = this.target.y - p.z;
      const d = Math.hypot(dx, dz);
      if (d < 0.15) {
        this.target = null;
        const cb = this.onArrive; this.onArrive = null; cb?.();
      } else {
        const step = Math.min(d, this.speed * dt);
        p.x += (dx / d) * step; p.z += (dz / d) * step;
        this.yaw = angleDamp(this.yaw, Math.atan2(dx, dz), 8, dt);
        moving = this.speed;
      }
    } else if (playerPos && this.lookAtPlayer) {
      const dx = playerPos.x - p.x, dz = playerPos.z - p.z;
      const d = Math.hypot(dx, dz);
      if (d < 6) this.yaw = angleDamp(this.yaw, Math.atan2(dx, dz), 4, dt);
      else this.yaw = angleDamp(this.yaw, this.homeYaw, 1.5, dt);
    }
    if (!this.fixedY) p.y = this.world.groundHeight(p.x, p.z, p.y + 0.5);
    this.root.rotation.y = this.yaw;
    this.model.anim.speed = moving;
    this.model.anim.grounded = true;
    this.model.update(dt);
  }

  distanceTo(pos) { return Math.hypot(pos.x - this.root.position.x, pos.z - this.root.position.z); }
}

// A friend who walks (or swims) along behind the player
export class Follower {
  constructor(model, world, { gap = 1.8, side = 1, name } = {}) {
    this.model = model;
    this.world = world;
    this.root = model.root;
    this.gap = gap;
    this.side = side;
    this.name = name;
    this.vel = new THREE.Vector3();
    this.yaw = 0;
    this.vy = 0;
    this.grounded = true;
    this.swimDepth = model.land ? 0.35 : 0.95;
  }

  place(x, z) {
    this.root.position.set(x, this.world.groundHeight(x, z), z);
  }

  update(dt, leader, leaderYaw) {
    if (this.frozen) { this.model.anim.speed = 0; this.model.update(dt); return; }
    const p = this.root.position;
    const w = this.world;
    // aim for a spot behind and to the side of the leader
    const bx = leader.x - Math.sin(leaderYaw) * this.gap + Math.cos(leaderYaw) * this.side * 0.9;
    const bz = leader.z - Math.cos(leaderYaw) * this.gap - Math.sin(leaderYaw) * this.side * 0.9;
    let dx = bx - p.x, dz = bz - p.z;
    const d = Math.hypot(dx, dz);
    if (d > 28 || Math.abs(leader.y - p.y) > 14) { p.set(bx, leader.y + 0.5, bz); this.vel.set(0, 0, 0); return; }
    const want = d > 0.6 ? Math.min(7.5, d * 2.2) : 0;
    const vx = d > 0.01 ? (dx / d) * want : 0, vz = d > 0.01 ? (dz / d) * want : 0;
    this.vel.x = damp(this.vel.x, vx, 6, dt);
    this.vel.z = damp(this.vel.z, vz, 6, dt);
    p.x += this.vel.x * dt;
    p.z += this.vel.z * dt;
    w.collide(p, 0.3, 1.2);
    const depth = w.waterLevel - w.terrainHeight(p.x, p.z);
    const swimming = depth > this.swimDepth + 0.2;
    if (swimming) {
      const targetY = Math.min(w.waterLevel - this.swimDepth * 0.75, Math.max(leader.y, w.terrainHeight(p.x, p.z) + 0.3));
      p.y = damp(p.y, targetY, 3, dt);
      this.vy = 0;
      this.grounded = true;
    } else {
      const g = w.groundHeight(p.x, p.z, p.y + 0.5);
      // hop up if the leader is above us (keeps up with jumps)
      if (this.grounded && leader.y > g + 1.0 && d < 4) { this.vy = 8; this.grounded = false; }
      this.vy -= 24 * dt;
      p.y += this.vy * dt;
      if (p.y <= g) { if (!this.grounded) this.model.land?.(0.4); p.y = g; this.vy = 0; this.grounded = true; }
      else if (this.grounded && p.y - g < 0.4) p.y = g;
      else this.grounded = false;
    }
    const hs = Math.hypot(this.vel.x, this.vel.z);
    if (hs > 0.3) this.yaw = angleDamp(this.yaw, Math.atan2(this.vel.x, this.vel.z), 8, dt);
    else this.yaw = angleDamp(this.yaw, Math.atan2(leader.x - p.x, leader.z - p.z), 3, dt);
    this.root.rotation.y = this.yaw;
    const a = this.model.anim;
    a.speed = hs; a.run = hs > 4; a.grounded = this.grounded; a.vy = this.vy;
    a.swim = swimming; // (also while treading water, so the snorkel stays on)
    this.model.update(dt);
  }
}
