// Riding a dragon: shared by Pinky Land and Snowdrop Island.
// The level steers the dragon (W/S speed, A/D turn, Space/Shift up and down) and
// keeps the rider sitting on its back. Press E to hop off.
import * as THREE from 'three';
import { WesternDragon, NordicSerpent } from '../world/dragons.js';
import { lerp, clamp, damp, angleDamp } from '../util/noise.js';

export const RideMixin = {
  startRide(d) {
    const g = this.game, P = this.player;
    const kind = d instanceof WesternDragon ? 'wings' : d instanceof NordicSerpent ? 'swim' : 'serpent';
    d.startRide();
    const yaw = kind === 'wings' ? d.yaw : d.rideYaw();
    this.riding = { d, kind, yaw, speed: 0, vy: kind === 'wings' ? 5 : 0, bank: 0, t: 0, lift: kind === 'wings' ? 1.6 : 0 };
    this._rideDist = this.rig.targetDistance;
    this.rig.targetDistance = kind === 'wings' ? 11 : 9;
    P.model.anim.sit = true;
    for (const f of this.followers) f.root.visible = false; // friends wait at home while you fly
    g.audio.portal?.();
    g.ui.toast('🐉', kind === 'swim'
      ? `<b>Riding ${d.name}!</b> W faster · S slower · A D turn · E hop off`
      : `<b>Riding ${d.name}!</b> W faster · S slower · A D turn · Space up · Shift down · E hop off`);
    if (this.P.rides === undefined) this.P.rides = 0;
    this.P.rides++;
  },

  endRide() {
    const r = this.riding; if (!r) return;
    const P = this.player, W = this.world;
    this.riding = null;
    r.d.endRide();
    P.model.anim.sit = false;
    for (const f of this.followers) { f.root.visible = true; }
    this.rig.targetDistance = this._rideDist || 7;
    // hop off to the side (and fall or glide down if you were up high)
    const side = new THREE.Vector3(Math.cos(r.yaw), 0, -Math.sin(r.yaw));
    const at = r.d.seat(new THREE.Vector3()).addScaledVector(side, r.kind === 'wings' ? 2.2 : 1.6);
    P.pos.copy(at);
    P.pos.y = Math.max(at.y, W.groundHeight(at.x, at.z, at.y + 2) + 0.05);
    P.vel.set(0, 2, 0);
    for (const f of this.followers) f.place?.(P.pos.x + 1, P.pos.z + 1);
  },

  rideSeat() {
    const r = this.riding, P = this.player;
    r.d.seat(P.pos);
    // a sitting kid's bottom is about one shin-length above their feet; pillows sit flat
    P.pos.y -= P.model.dims ? P.model.dims.shin * P.model.body.scale.y : 0;
    P.vel.set(0, 0, 0);
    P.yaw = r.yaw; P.root.rotation.set(0, r.yaw, 0);
    P.model.anim.speed = 0; P.model.anim.grounded = true; P.model.anim.sit = true;
  },

  rideUpdate(dt) {
    const r = this.riding, inp = this.game.input, W = this.world, d = r.d;
    dt = Math.min(dt, 1 / 20);
    r.t += dt;
    let turn = 0, thr = 0, up = 0;
    if (inp.down('KeyA', 'ArrowLeft')) turn += 1;
    if (inp.down('KeyD', 'ArrowRight')) turn -= 1;
    if (inp.down('KeyW', 'ArrowUp')) thr += 1;
    if (inp.down('KeyS', 'ArrowDown')) thr -= 1;
    if (inp.down('Space')) up += 1;
    if (inp.down('ShiftLeft', 'ShiftRight', 'KeyX')) up -= 1;
    const pad = inp.padState;
    if (pad) { turn -= pad.lx; thr -= pad.ly; if (pad.jump) up += 1; if (pad.dive || pad.run) up -= 1; }
    turn = clamp(turn, -1, 1); thr = clamp(thr, -1, 1); up = clamp(up, -1, 1);
    if (inp.hit('KeyE', 'Pad_interact', 'Enter')) { this.endRide(); return; }
    const pos = r.kind === 'wings' ? d.pos : d.headPos;
    const wl = W.waterLevel;
    const floor = (x, z) => r.kind === 'wings' ? Math.max(W.terrainHeight(x, z), wl - 0.3) : Math.max(W.terrainHeight(x, z), wl) + 1.4;
    const grounded = r.kind === 'wings' && pos.y - floor(pos.x, pos.z) < 0.25 && r.lift <= 0;
    // speeds: cruising, fast and slow
    const [cruise, fast, slow] = r.kind === 'wings' ? [10, 19, 2.5] : r.kind === 'serpent' ? [8, 15, 2] : [6, 11, 0];
    let want = thr > 0 ? lerp(cruise, fast, thr) : lerp(cruise, slow, -thr);
    if (grounded) want = Math.max(0, thr) * 3; // walking along the ground
    r.speed = damp(r.speed, want, 1.6, dt);
    r.yaw += turn * (grounded ? 1.8 : 1.3) * dt;
    r.bank = damp(r.bank, -turn * 0.35 * Math.min(1, r.speed / 8), 3, dt);
    // keep inside the sky above Pinky Land: gently turn back near the edge
    const dist = Math.hypot(pos.x - (this.rideCenter?.x || 0), pos.z - (this.rideCenter?.z || 0)), edge = this.rideEdge;
    if (dist > edge - 15) {
      const home = Math.atan2((this.rideCenter?.x || 0) - pos.x, (this.rideCenter?.z || 0) - pos.z);
      r.yaw = angleDamp(r.yaw, home, clamp((dist - edge + 15) / 15, 0, 1) * 1.5, dt);
      if (!this._edgeSaid || this.time - this._edgeSaid > 12) { this._edgeSaid = this.time; this.game.ui.say(`${d.name}: “Let’s stay close to the island!”`, 3); }
    }
    const fx = Math.sin(r.yaw), fz = Math.cos(r.yaw);
    let nx = pos.x + fx * r.speed * dt, nz = pos.z + fz * r.speed * dt;
    if (r.kind === 'swim') {
      // Fjola only swims where the water is deep
      if (W.terrainHeight(nx, nz) > wl - 1.2) { nx = pos.x; nz = pos.z; r.speed = 0; if (!this._shallowSaid || this.time - this._shallowSaid > 8) { this._shallowSaid = this.time; this.game.ui.say('Fjola: “Too shallow for me! Let’s turn around.”', 3); } }
      pos.x = nx; pos.z = nz;
    } else {
      // up and down
      if (r.lift > 0) { r.lift -= dt; up = Math.max(up, 1); }
      r.vy = damp(r.vy, up * 7 + (r.kind === 'wings' && !grounded && thr > 0.5 ? 0.3 : 0), 3, dt);
      pos.x = nx; pos.z = nz;
      pos.y = Math.min(70, pos.y + r.vy * dt);
      const fl = floor(pos.x, pos.z);
      if (pos.y < fl) { pos.y = fl; r.vy = Math.max(0, r.vy); }
    }
    if (r.kind === 'wings') {
      d.yaw = r.yaw; d.rideBank = r.bank;
      d.rideFly = grounded ? 0.35 : 1;
    }
    this.rideSeat();
    this.player.forwardMoving = r.speed > 1;
    // the camera swings round behind the dragon (unless you're dragging to look around)
    if (!inp.mouse.dragging && Math.abs(inp.mouse.dx) < 1) this.rig.yaw = angleDamp(this.rig.yaw, r.yaw + Math.PI, 2.2, dt);
    this.game.ui.prompt('E: hop off');
  },
};
