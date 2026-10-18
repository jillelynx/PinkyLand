// Third-person camera: drag the mouse (or use Q/E, or the right stick) to look
// around, scroll to zoom in and out.
import * as THREE from 'three';
import { clamp, damp, angleDamp } from '../util/noise.js';

export class CameraRig {
  constructor(camera, input) {
    this.camera = camera;
    this.input = input;
    this.yaw = Math.PI; // looking toward -z from behind
    this.pitch = 0.32;
    this.distance = 7;
    this.targetDistance = 7;
    this.minDist = 2.2;
    this.maxDist = 22;
    this.target = new THREE.Vector3();
    this.smoothTarget = new THREE.Vector3();
    this.override = null; // { pos, look } for cozy cut-scenes
    this.overrideBlend = 0;
    this.sensitivity = 0.0045;
    this.groundAt = null;
    this.waterLevel = 0;
    this._pos = new THREE.Vector3();
    this._look = new THREE.Vector3();
  }

  snap(target) {
    this.target.copy(target);
    this.smoothTarget.copy(target);
    this.distance = this.targetDistance;
  }

  setOverride(pos, look) { this.override = pos ? { pos: pos.clone(), look: look.clone() } : null; }

  update(dt, target, { underwater = false, playerYaw = null, moving = false } = {}) {
    const inp = this.input;
    if (inp.enabled) {
      this.yaw -= inp.mouse.dx * this.sensitivity;
      this.pitch += inp.mouse.dy * this.sensitivity;
      if (inp.down('KeyQ')) this.yaw += dt * 2.0;
      this.yaw += inp.mouse.wheelX * this.sensitivity * 0.9; // two-finger sideways swipe
      if (inp.down('KeyR')) this.pitch -= dt * 1.4;
      if (inp.down('KeyV')) this.pitch += dt * 1.4;
      if (inp.down('KeyZ')) this.yaw += dt * 2.0;
      if (inp.down('KeyC')) this.yaw -= dt * 2.0;
      if (inp.down('BracketLeft')) this.yaw += dt * 2.0;
      if (inp.down('BracketRight')) this.yaw -= dt * 2.0;
      if (inp.padState) {
        this.yaw -= inp.padState.rx * dt * 2.6;
        this.pitch += inp.padState.ry * dt * 1.8;
      }
      this.targetDistance = clamp(this.targetDistance + inp.mouse.wheel * 0.01, this.minDist, this.maxDist);
      if (inp.down('Equal', 'NumpadAdd')) this.targetDistance = clamp(this.targetDistance - dt * 8, this.minDist, this.maxDist);
      if (inp.down('Minus', 'NumpadSubtract')) this.targetDistance = clamp(this.targetDistance + dt * 8, this.minDist, this.maxDist);
    }
    // gently swing behind the player while they walk (only if not dragging)
    this._lookIdle = (inp.mouse.dragging || Math.abs(inp.mouse.dx) > 0.5 || Math.abs(inp.mouse.wheelX) > 0.5 || inp.down('KeyQ', 'KeyC', 'KeyZ')) ? 0 : (this._lookIdle || 0) + dt;
    if (moving && playerYaw !== null && this._lookIdle > 1.2) {
      const behind = playerYaw + Math.PI;
      this.yaw = angleDamp(this.yaw, behind, 0.35, dt);
    }
    this.pitch = clamp(this.pitch, -0.6, 1.25);
    this.distance = damp(this.distance, this.targetDistance, 6, dt);
    this.target.copy(target);
    this.smoothTarget.x = damp(this.smoothTarget.x, target.x, 12, dt);
    this.smoothTarget.z = damp(this.smoothTarget.z, target.z, 12, dt);
    this.smoothTarget.y = damp(this.smoothTarget.y, target.y, 7, dt);

    const cp = Math.cos(this.pitch);
    const off = new THREE.Vector3(Math.sin(this.yaw) * cp, Math.sin(this.pitch), Math.cos(this.yaw) * cp).multiplyScalar(this.distance);
    const pos = this._pos.copy(this.smoothTarget).add(off);
    // don't dip under the ground
    if (this.groundAt) {
      const g = this.groundAt(pos.x, pos.z) + 0.45;
      if (pos.y < g) pos.y = g;
    }
    // stay above the surface unless the player is swimming underwater
    // pull the camera in if a house is in the way
    if (this.blocked) {
      const steps = 16;
      for (let i = 1; i <= steps; i++) {
        const t = i / steps;
        const x = this.smoothTarget.x + (pos.x - this.smoothTarget.x) * t;
        const y = this.smoothTarget.y + (pos.y - this.smoothTarget.y) * t;
        const z = this.smoothTarget.z + (pos.z - this.smoothTarget.z) * t;
        if (this.blocked(x, y, z)) {
          const k = Math.max(0.15, (i - 1) / steps);
          pos.set(this.smoothTarget.x + (pos.x - this.smoothTarget.x) * k, this.smoothTarget.y + (pos.y - this.smoothTarget.y) * k + (1 - k) * 0.8, this.smoothTarget.z + (pos.z - this.smoothTarget.z) * k);
          break;
        }
      }
    }
    if (!underwater && pos.y < this.waterLevel + 0.35 && this.smoothTarget.y > this.waterLevel) pos.y = this.waterLevel + 0.35;
    if (underwater && pos.y > this.waterLevel - 0.3) pos.y = this.waterLevel - 0.3;
    const look = this._look.copy(this.smoothTarget);

    this.overrideBlend = damp(this.overrideBlend, this.override ? 1 : 0, 3, dt);
    if (this.override || this.overrideBlend > 0.001) {
      const o = this.override || this._lastOverride;
      if (o) {
        pos.lerp(o.pos, this.overrideBlend);
        look.lerp(o.look, this.overrideBlend);
        this._lastOverride = o;
      }
    }
    this.camera.position.copy(pos);
    this.camera.lookAt(look);
  }

  // Direction the camera faces on the ground (for "forward" movement)
  forward(out = new THREE.Vector3()) {
    return out.set(-Math.sin(this.yaw), 0, -Math.cos(this.yaw)).normalize();
  }
  right(out = new THREE.Vector3()) {
    return out.set(Math.cos(this.yaw), 0, -Math.sin(this.yaw)).normalize();
  }
}
