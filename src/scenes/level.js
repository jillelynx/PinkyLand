// Shared parts of every place you can visit (Earth and Pinky Land).
import * as THREE from 'three';
import { PookPuffs } from '../world/pookPuff.js';
import { DayNight } from '../world/sky.js';
import { sharedUniforms } from '../world/terrain.js';
import { playerUniform } from '../world/vegetation.js';
import { createCollectible, animateCollectible, COLLECTIBLE_INFO, glowTexture } from '../world/props.js';
import { Player } from '../core/player.js';
import { CameraRig } from '../core/cameraRig.js';
import { clamp } from '../util/noise.js';

export class Level {
  constructor(game, name) {
    this.game = game;
    this.name = name;
    this.scene = new THREE.Scene();
    this.interactables = [];
    this.collectibles = [];
    this.npcs = [];
    this.followers = [];
    this.updaters = [];
    this.sightings = [];
    this.campfires = [];
    this.waterfalls = [];
    this.landmarks = []; // for the map
    this.trail = null;
    this.time = 0;
    this.mapExplored = new Uint8Array(64 * 64);
    // remember the explored parts of the map between visits and play sessions
    const saved = game.state.explored?.[name];
    if (saved) for (let i = 0; i < saved.length; i++) { const v = parseInt(saved[i], 16); for (let b = 0; b < 4; b++) this.mapExplored[i * 4 + b] = (v >> b) & 1; }
  }

  saveExplored() {
    let out = '';
    for (let i = 0; i < this.mapExplored.length; i += 4) { let v = 0; for (let b = 0; b < 4; b++) v |= this.mapExplored[i + b] << b; out += v.toString(16); }
    const st = this.game.state;
    st.explored = st.explored || {};
    st.explored[this.name] = out;
  }

  setupSky(startTime) {
    this.dayNight = new DayNight(this.scene, { startTime });
    this.dayNight.speed = this.game.settings.timeSpeed || 1;
    const q = this.game.engine.q;
    this.dayNight.sun.castShadow = q.shadows;
    this.dayNight.sun.shadow.mapSize.set(q.shadowSize, q.shadowSize);
  }

  setupPlayer(spawn, yaw = 0) {
    const g = this.game;
    this.rig = new CameraRig(g.engine.camera, g.input);
    this.rig.sensitivity = g.settings.sensitivity;
    this.rig.groundAt = (x, z) => this.world.terrainHeight(x, z);
    this.rig.waterLevel = this.world.waterLevel;
    this.rig.blocked = (x, y, z) => this.world.pointBlocked(x, y, z);
    this.player = new Player(this.scene, this.world, g.input, this.rig, g.audio);
    for (const [k, m] of Object.entries(g.avatarModels)) this.player.registerAvatar(k, m);
    this.player.teleport(spawn.x, this.world.groundHeight(spawn.x, spawn.z) + 0.1, spawn.z, yaw);
    this.rig.yaw = yaw + Math.PI;
    this.player.events.jump = (n) => g.audio.jump(n);
    // Pooking Power: Pinky's toot boost
    this.pookFx = this.pookFx || new PookPuffs(this.scene);
    this.player.events.pook = () => {
      g.audio.pook();
      const P = this.player;
      this.pookFx.emit(P.pos.clone().add(new THREE.Vector3(0, 0.15, 0)), 1, new THREE.Vector3(-Math.sin(P.yaw) * 0.6, -1, -Math.cos(P.yaw) * 0.6));
      P.model.setMood?.('oops');
      clearTimeout(this._pookT); this._pookT = setTimeout(() => P.model.setMood?.('happy'), 1100);
      if (!this._pookTold) { this._pookTold = true; g.ui.say('Pooking Power! 💨 Hee hee… excuse me!', 2.5); }
    };
    this.player.events.bounce = () => g.audio.bounce();
    this.player.events.splash = (k) => g.audio.splash(k);
    this._edgeT = -99;
    this.player.events.edge = () => {
      const now = performance.now() / 1000;
      if (now - this._edgeT > 10) g.ui.toast(this.name === 'pinky' ? '🌊' : '🏡', this.name === 'pinky' ? 'The waves gently carry you back toward Pinky Land.' : 'That’s far enough — let’s stay near the park.');
      this._edgeT = now;
    };
    this.buildFlashlight();
  }

  // A warm flashlight the player carries. It turns on by itself when it gets dark
  // (unless the player has switched it on or off with F or the 🔦 button).
  buildFlashlight() {
    const group = new THREE.Group();
    const light = new THREE.SpotLight('#ffe9c2', 0, 34, 0.5, 0.55, 1.2);
    light.castShadow = false;
    light.position.set(0.2, 0.72, 0.3); // held at hand height
    const target = new THREE.Object3D();
    target.position.set(0.1, -0.6, 9);
    group.add(light, target);
    light.target = target;
    // a soft glowing beam you can see in the air
    const len = 7;
    const geo = new THREE.ConeGeometry(Math.tan(0.42) * len, len, 24, 1, true);
    geo.translate(0, -len / 2, 0);
    geo.rotateX(-Math.PI / 2 + 0.17);
    const beamMat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      uniforms: { uOn: { value: 0 } },
      vertexShader: 'varying float vD; varying vec3 vN; varying vec3 vV; void main(){ vD = position.z; vec4 mv = modelViewMatrix*vec4(position,1.0); vN = normalize(normalMatrix*normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix*mv; }',
      fragmentShader: 'uniform float uOn; varying float vD; varying vec3 vN; varying vec3 vV; void main(){ float fall = 1.0 - smoothstep(0.0, 7.0, vD); float edge = pow(abs(dot(vN, vV)), 1.5); gl_FragColor = vec4(vec3(1.0,0.93,0.75) * fall * edge * 0.16 * uOn, 1.0); }',
    });
    const beam = new THREE.Mesh(geo, beamMat);
    beam.position.copy(light.position);
    beam.frustumCulled = false;
    group.add(beam);
    // a tiny glowing bulb
    const bulb = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: '#fff2c8', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 }));
    bulb.position.copy(light.position);
    bulb.scale.setScalar(0.16);
    group.add(bulb);
    this.player.root.add(group);
    this.flashlight = { group, light, beam, beamMat, bulb, level: 0, on: false };
  }

  updateFlashlight(dt, night) {
    const f = this.flashlight;
    if (!f) return;
    const g = this.game;
    const mode = g.flashlightMode || 'auto';
    const dark = !this.indoors && (night > 0.5 || (this.player.underwater && night > 0.3));
    const want = mode === 'on' || (mode === 'auto' && dark);
    if (want !== f.on) {
      f.on = want;
      g.ui.setFlashlight(want);
      if (want && mode === 'auto' && !g.settings.flashlightTipShown) {
        g.settings.flashlightTipShown = true;
        g.ui.toast('🔦', 'It’s getting dark! Your flashlight turned on. Press <b>F</b> to switch it on or off.');
        g.saveGame();
      }
    }
    f.level += ((want ? 1 : 0) - f.level) * Math.min(1, dt * 6);
    // a gentle flicker-free warm glow; lean the beam with the camera tilt a little
    f.light.intensity = f.level * 55;
    // (the light stays in the scene at zero brightness so turning it on never causes a hiccup)
    f.beamMat.uniforms.uOn.value = f.level;
    f.beam.visible = f.level > 0.01;
    f.bulb.material.opacity = f.level * 0.6;
  }

  addCollectible(kind, id, pos, { onCollect, float = 0.6, scale = 1, journal = kind, nightOnly = false } = {}) {
    if (this.game.state.collected.includes(id)) return null;
    const obj = createCollectible(kind);
    obj.position.copy(pos);
    obj.position.y += float;
    obj.scale.setScalar(scale);
    this.scene.add(obj);
    const c = { obj, kind, id, onCollect, journal, nightOnly, taken: false };
    this.collectibles.push(c);
    return c;
  }

  addInteractable(def) {
    this.interactables.push(def);
    return def;
  }

  addNPC(npc) {
    this.npcs.push(npc);
    this.scene.add(npc.root);
    // give every character a soft, solid body so you can't walk through them
    npc.root.updateMatrixWorld(true);
    const size = new THREE.Box3().setFromObject(npc.root).getSize(new THREE.Vector3());
    npc.body = this.world.addBody({
      pos: npc.root.position,
      r: THREE.MathUtils.clamp(Math.max(size.x, size.z) * 0.4, 0.22, 1.6),
      h: Math.max(0.5, size.y),
      active: () => !npc.noCollide && npc.root.visible && !!npc.root.parent && this.npcs.includes(npc),
    });
    return npc;
  }

  // A trail of sparkles from the player to where the hint points
  showTrail(target) {
    if (this.trail) { this.scene.remove(this.trail.obj); this.trail = null; }
    const from = this.player.pos.clone();
    const n = 40;
    const geo = new THREE.BufferGeometry();
    const pts = new Float32Array(n * 3);
    const seeds = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1);
      const x = from.x + (target.x - from.x) * t;
      const z = from.z + (target.z - from.z) * t;
      const y = Math.max(this.world.groundHeight(x, z), this.world.waterLevel) + 0.8 + Math.sin(t * Math.PI) * 2;
      pts[i * 3] = x; pts[i * 3 + 1] = Math.max(y, from.y + (target.y - from.y) * t + 0.8); pts[i * 3 + 2] = z;
      seeds[i] = t;
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pts, 3));
    geo.setAttribute('aT', new THREE.BufferAttribute(seeds, 1));
    const mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: { uTime: { value: 0 }, uFade: { value: 1 } },
      vertexShader: /* glsl */ `
        attribute float aT; uniform float uTime; uniform float uFade; varying float vA;
        void main(){
          vec3 p = position; p.y += sin(uTime*3.0 + aT*20.0)*0.15;
          vA = (0.4 + 0.6*pow(max(0.0, sin((aT*6.0 - uTime*1.5)*3.14159)), 2.0)) * uFade;
          vec4 mv = modelViewMatrix * vec4(p,1.0);
          gl_PointSize = 260.0 / -mv.z;
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */ `
        varying float vA;
        void main(){ float d = length(gl_PointCoord-0.5); float a = smoothstep(0.5,0.0,d); gl_FragColor = vec4(vec3(1.0,0.85,0.95)*a*1.5, a*vA); }`,
    });
    const obj = new THREE.Points(geo, mat);
    obj.frustumCulled = false;
    this.scene.add(obj);
    this.trail = { obj, mat, t: 0 };
    this.showBeacon(target);
  }

  // A tall, gently pulsing column of light (with a glowing ring on the ground) that
  // marks where the hint is pointing. It stays until you get there.
  showBeacon(target) {
    if (this.beacon) { this.scene.remove(this.beacon.group); this.beacon = null; }
    const group = new THREE.Group();
    const ground = Math.max(this.world.groundHeight(target.x, target.z, target.y + 1), this.world.waterLevel);
    group.position.set(target.x, Math.min(ground, target.y), target.z);
    const uniforms = { uTime: { value: 0 }, uFade: { value: 0 } };
    const colMat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, uniforms,
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: `uniform float uTime; uniform float uFade; varying vec2 vUv;
        void main(){
          float up = 1.0 - vUv.y;
          float a = pow(up, 1.6) * (0.55 + 0.25 * sin(uTime * 3.0)) * uFade;
          float bands = 0.75 + 0.25 * sin(vUv.y * 40.0 - uTime * 4.0);
          gl_FragColor = vec4(vec3(1.0, 0.82, 0.95) * a * bands, 1.0);
        }`,
    });
    const col = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.3, 26, 24, 1, true), colMat);
    col.position.y = 13;
    col.frustumCulled = false;
    group.add(col);
    const ringMat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms,
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: `uniform float uTime; uniform float uFade; varying vec2 vUv;
        void main(){
          float r = length(vUv - 0.5) * 2.0;
          float ringPos = fract(uTime * 0.5);
          float ring = smoothstep(0.08, 0.0, abs(r - ringPos)) * (1.0 - ringPos);
          float glow = smoothstep(1.0, 0.0, r) * 0.45;
          gl_FragColor = vec4(vec3(1.0, 0.85, 0.95) * (glow + ring) * uFade, 1.0);
        }`,
    });
    const ring = new THREE.Mesh(new THREE.PlaneGeometry(6, 6), ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.08;
    group.add(ring);
    this.scene.add(group);
    this.beacon = { group, uniforms, target: target.clone(), t: 0, leaving: false };
  }

  updateBeacon(dt) {
    const b = this.beacon;
    if (!b) return;
    b.t += dt;
    b.uniforms.uTime.value = b.t;
    const d = Math.hypot(this.player.pos.x - b.target.x, this.player.pos.z - b.target.z);
    if (d < 3.2 || b.t > 120) b.leaving = true;
    const f = b.uniforms.uFade.value;
    b.uniforms.uFade.value = b.leaving ? Math.max(0, f - dt * 1.5) : Math.min(1, f + dt * 2);
    if (b.leaving && b.uniforms.uFade.value <= 0) { this.scene.remove(b.group); this.beacon = null; }
  }

  // --- things each level fills in
  getHint() { return null; }
  mapMarkers() { return []; }
  availableAvatars() { return ['jacintaPack']; }

  journalCheck(key, name) {
    const g = this.game;
    if (!key || g.state.journal.includes(key)) return;
    g.state.journal.push(key);
    g.ui.toast('📖', `New in your journal: <b>${name}</b>`);
    g.saveGame();
  }

  baseUpdate(dt) {
    const g = this.game;
    this.time += dt;
    this.pookFx?.update(dt);
    const p = this.player;
    const busy = g.ui.isBusy() || this.cutscene;
    p.frozen = busy || !!this.riding; // riding a dragon: the dragon does the moving
    g.input.enabled = !g.ui.open;

    p.update(dt);
    const underwater = p.underwater;
    this.dayNight.update(dt, p.pos, underwater);
    const night = this.dayNight.nightAmount;
    sharedUniforms.uTime.value += dt;
    sharedUniforms.uNight.value = night;
    playerUniform.value.copy(p.pos);
    this.water?.update(night);
    this.clouds?.update(dt, this.dayNight);
    const ctx = { night, playerPos: p.pos, playerSpeed: p.speed };
    this.creatures?.update(dt, ctx);
    for (const n of this.npcs) n.update(dt, p.pos);
    for (const f of this.followers) f.update(dt, p.pos, p.yaw);
    for (const u of this.updaters) u(dt, ctx);
    for (const cf of this.campfires) cf.update(dt, night);
    for (const wf of this.waterfalls) wf.update(dt, night);

    // chilly at night: Jacinta pulls up her hood and leg warmers
    this.updateFlashlight(dt, night);
    const chilly = !this.indoors && (this.dayNight.isChilly() || p.pos.y > 30);
    for (const m of Object.values(g.avatarModels)) m.setChilly?.(chilly);

    // collectibles
    for (const c of this.collectibles) {
      if (c.taken) continue;
      const visible = !c.nightOnly || night > 0.5;
      c.obj.visible = visible;
      animateCollectible(c.obj, dt);
      if (!visible) continue;
      const d = c.obj.position.distanceTo(p.pos.clone().setY(p.pos.y + 0.6));
      if (d < 1.15) this.collect(c);
    }

    // creature sightings for the journal
    if (this.creatures && Math.floor(this.time * 2) !== this._sightTick) {
      this._sightTick = Math.floor(this.time * 2);
      for (const c of this.creatures.list) {
        if (!c.journalKey || g.state.journal.includes(c.journalKey)) continue;
        const near = c.near ? c.near(p.pos, 9, ctx) : c.object.position.distanceTo(p.pos) < 16;
        if (near) this.journalCheck(c.journalKey, c.name);
      }
    }

    // talk / interact prompt
    let best = null, bestD = Infinity;
    if (!busy && !this.riding) {
      for (const it of this.interactables) {
        if (it.enabled && !it.enabled()) continue;
        const pos = typeof it.pos === 'function' ? it.pos() : it.pos;
        const d = Math.hypot(pos.x - p.pos.x, pos.z - p.pos.z);
        if (d < (it.radius || 2.4) && Math.abs(pos.y - p.pos.y) < 3 && d < bestD) { best = it; bestD = d; }
      }
    }
    g.ui.prompt(best ? (typeof best.label === 'function' ? best.label() : best.label) : null);
    if (best && g.input.hit('KeyE', 'Pad_interact', 'Enter')) best.action();

    // riding a dragon (Pinky Land): steer the dragon and keep the rider on its back
    if (this.riding && !busy) this.rideUpdate(dt);
    else if (this.riding) this.rideSeat();

    // camera
    const target = p.pos.clone();
    target.y += p.stats.eye * 0.85;
    this.rig.update(dt, target, { underwater: p.swimming && p.pos.y < this.world.waterLevel - 0.6, playerYaw: p.yaw, moving: p.forwardMoving });

    this.updateBeacon(dt);
    // hint trail fades out
    if (this.trail) {
      this.trail.t += dt;
      this.trail.mat.uniforms.uTime.value = this.trail.t;
      this.trail.mat.uniforms.uFade.value = clamp(1 - (this.trail.t - 6) / 2, 0, 1);
      if (this.trail.t > 8) { this.scene.remove(this.trail.obj); this.trail = null; }
    }

    // explore the map
    const mb = this.mapBounds;
    if (mb) {
      const gx = Math.floor(((p.pos.x - mb.x0) / (mb.x1 - mb.x0)) * 64);
      const gz = Math.floor(((p.pos.z - mb.z0) / (mb.z1 - mb.z0)) * 64);
      for (let j = -3; j <= 3; j++) for (let i = -3; i <= 3; i++) {
        if (i * i + j * j > 10) continue;
        const x = gx + i, z = gz + j;
        if (x >= 0 && z >= 0 && x < 64 && z < 64 && !this.mapExplored[z * 64 + x]) { this.mapExplored[z * 64 + x] = 1; this._exploredDirty = true; }
      }
      if (this._exploredDirty) { this._exploredDirty = false; this.saveExplored(); }
    }

    // sound
    const a = g.audio.state;
    a.night = night;
    a.underwater = underwater;
    a.scene = this.name;
    const depthHere = this.world.waterLevel - this.world.terrainHeight(p.pos.x, p.pos.z);
    a.nearWater = this.nearWaterAmount ? this.nearWaterAmount(p.pos) : clamp(1 - Math.abs(depthHere) / 4, 0, 1);
    let fire = 0;
    for (const cf of this.campfires) if (cf.lit) fire = Math.max(fire, clamp(1 - cf.group.position.distanceTo(p.pos) / 12, 0, 1));
    a.fire = fire;
    let fall = 0;
    for (const wf of this.waterfalls) fall = Math.max(fall, clamp(1 - wf.worldPos.distanceTo(p.pos) / 40, 0, 1));
    a.waterfall = fall;

    // screen effects
    const grade = g.engine.grade;
    if (grade) {
      grade.uniforms.uUnder.value += ((underwater ? 1 : 0) - grade.uniforms.uUnder.value) * Math.min(1, dt * 6);
      grade.uniforms.uTime.value = sharedUniforms.uTime.value;
      grade.uniforms.uWarmth.value = this.dayNight.warmth();
    }
    g.ui.setClock(night, this.dayNight.hours);
    // compass: which way the camera looks (north = toward -z, the top of the map)
    const fwd = this.rig.forward(this._fwd || (this._fwd = new THREE.Vector3()));
    const heading = (THREE.MathUtils.radToDeg(Math.atan2(fwd.x, -fwd.z)) + 360) % 360;
    const sd = this.dayNight.sunDir;
    const md = this.dayNight.uniforms.uMoonDir.value;
    let skyIcon = null, skyBearing = 0;
    if (sd.y > -0.03) { skyIcon = '☀️'; skyBearing = THREE.MathUtils.radToDeg(Math.atan2(sd.x, -sd.z)); }
    else if (md.y > 0) { skyIcon = '🌙'; skyBearing = THREE.MathUtils.radToDeg(Math.atan2(md.x, -md.z)); }
    let hintBearing = null;
    if (this.beacon && !this.beacon.leaving) {
      const t = this.beacon.target;
      hintBearing = (THREE.MathUtils.radToDeg(Math.atan2(t.x - p.pos.x, -(t.z - p.pos.z))) + 360) % 360;
    }
    g.ui.setCompass(heading, (skyBearing + 360) % 360, skyIcon, hintBearing);
  }

  collect(c) {
    const g = this.game;
    c.taken = true;
    this.scene.remove(c.obj);
    g.state.collected.push(c.id);
    g.state.counts[c.kind] = (g.state.counts[c.kind] || 0) + 1;
    g.audio.collect();
    const info = COLLECTIBLE_INFO[c.kind];
    if (c.journal) this.journalCheck(c.journal, info.name);
    if (c.kind !== 'litter') g.ui.toast(iconFor(c.kind), `${info.name}${g.state.totals[c.kind] ? ` ${g.state.counts[c.kind]} / ${g.state.totals[c.kind]}` : ''}`);
    this.spawnBurst(c.obj.position, info.emissive);
    c.onCollect?.(c);
    this.onCollected?.(c);
    g.saveGame();
  }

  // little sparkle burst when picking something up
  spawnBurst(pos, color = '#ffffff') {
    const n = 24;
    const sprites = [];
    const mat = new THREE.SpriteMaterial({ map: glowTexture(), color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
    for (let i = 0; i < n; i++) {
      const s = new THREE.Sprite(mat);
      s.position.copy(pos);
      s.scale.setScalar(0.25);
      s.userData.v = new THREE.Vector3((Math.random() - 0.5) * 4, Math.random() * 4 + 1, (Math.random() - 0.5) * 4);
      this.scene.add(s);
      sprites.push(s);
    }
    let t = 0;
    const upd = (dt) => {
      t += dt;
      for (const s of sprites) { s.position.addScaledVector(s.userData.v, dt); s.userData.v.y -= 5 * dt; }
      mat.opacity = Math.max(0, 1 - t / 1.2);
      if (t > 1.2) { sprites.forEach((s) => this.scene.remove(s)); this.updaters.splice(this.updaters.indexOf(upd), 1); }
    };
    this.updaters.push(upd);
  }

  // Paint a simple top-down map
  // ---------------------------------------------------------------- map
  // An illustrated storybook map: shaded hills, water that gets deeper,
  // little drawn trees and houses, soft clouds over places you haven't been.
  mapTransform(W, H) {
    const mb = this.mapBounds;
    const pad = 34;
    const sc = Math.min((W - pad * 2) / (mb.x1 - mb.x0), (H - pad * 2) / (mb.z1 - mb.z0));
    const ox = W / 2 - ((mb.x0 + mb.x1) / 2) * sc, oz = H / 2 - ((mb.z0 + mb.z1) / 2) * sc;
    return { sc, toMap: (x, z) => [ox + x * sc, oz + z * sc], toWorld: (px, py) => [(px - ox) / sc, (py - oz) / sc] };
  }

  _buildMapBase(W, H) {
    const T = this.mapTransform(W, H);
    const cv = document.createElement('canvas');
    cv.width = W; cv.height = H;
    const g = cv.getContext('2d');
    // 1) ground and water colour with hill shading and contour lines
    const step = 2; // sample every 2 px, then smooth-scale up
    const w2 = Math.ceil(W / step), h2 = Math.ceil(H / step);
    const hts = new Float32Array(w2 * h2);
    for (let y = 0; y < h2; y++) for (let x = 0; x < w2; x++) { const [wx, wz] = T.toWorld(x * step, y * step); hts[y * w2 + x] = this.world.terrainHeight(wx, wz); }
    const small = document.createElement('canvas');
    small.width = w2; small.height = h2;
    const sg = small.getContext('2d');
    const img = sg.createImageData(w2, h2);
    const col = new THREE.Color();
    const wl = this.world.waterLevel;
    const HT = (x, y) => hts[Math.min(h2 - 1, Math.max(0, y)) * w2 + Math.min(w2 - 1, Math.max(0, x))];
    let seed = 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let y = 0; y < h2; y++) for (let x = 0; x < w2; x++) {
      const [wx, wz] = T.toWorld(x * step, y * step);
      const h = HT(x, y);
      this.mapColor(wx, wz, h, col);
      let r = col.r, gg = col.g, b = col.b;
      const water = h < wl - 0.05 && this.mapHasWater !== false;
      if (!water) {
        // light from the top-left makes hills pop out
        const dx = HT(x + 1, y) - HT(x - 1, y), dy = HT(x, y + 1) - HT(x, y - 1);
        const shade = THREE.MathUtils.clamp(1 - (dx + dy) * 0.22, 0.72, 1.18);
        r *= shade; gg *= shade; b *= shade;
        // soft contour line every 2 m of height
        const c0 = Math.floor(h / 2), c1 = Math.floor(HT(x + 1, y) / 2), c2 = Math.floor(HT(x, y + 1) / 2);
        if (h > 1 && (c0 !== c1 || c0 !== c2)) { r *= 0.88; gg *= 0.88; b *= 0.9; }
        // shoreline: a darker wet edge
        if (HT(x + 1, y) < wl || HT(x - 1, y) < wl || HT(x, y + 1) < wl || HT(x, y - 1) < wl) { r *= 0.85; gg *= 0.82; b *= 0.78; }
      } else {
        // white foam line where water meets land
        if (HT(x + 1, y) >= wl || HT(x - 1, y) >= wl || HT(x, y + 1) >= wl || HT(x, y - 1) >= wl) { r = 0.97; gg = 0.99; b = 1; }
      }
      // paper grain
      const n = (rnd() - 0.5) * 0.05;
      const i = (y * w2 + x) * 4;
      img.data[i] = Math.min(255, (r + n) * 255); img.data[i + 1] = Math.min(255, (gg + n) * 255); img.data[i + 2] = Math.min(255, (b + n) * 255); img.data[i + 3] = 255;
    }
    sg.putImageData(img, 0, 0);
    g.fillStyle = '#f7efe2'; g.fillRect(0, 0, W, H);
    g.imageSmoothingEnabled = true;
    g.drawImage(small, 0, 0, w2 * step, h2 * step);

    // 2) little wave marks out at sea
    g.strokeStyle = 'rgba(255,255,255,0.55)'; g.lineWidth = 1.6; g.lineCap = 'round';
    for (let k = 0; k < 160; k++) {
      const px = rnd() * W, py = rnd() * H;
      const [wx, wz] = T.toWorld(px, py);
      if (this.world.terrainHeight(wx, wz) > wl - 2.5 || this.mapHasWater === false) continue;
      g.beginPath(); g.arc(px - 5, py, 5, Math.PI * 1.15, Math.PI * 1.85); g.arc(px + 5, py, 5, Math.PI * 1.15, Math.PI * 1.85); g.stroke();
    }
    // 3) drawn features (trees, houses, rocks...)
    const feats = (this.mapFeatures || []).slice().sort((a, b) => a.z - b.z);
    for (const f of feats) this._drawFeature(g, f, T);
    return cv;
  }

  _pill(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }

  _compassRose(g, cx, cy, r) {
    g.save(); g.translate(cx, cy);
    g.fillStyle = 'rgba(255,255,255,0.8)'; g.beginPath(); g.arc(0, 0, r + 6, 0, Math.PI * 2); g.fill();
    g.strokeStyle = '#c9a6c4'; g.lineWidth = 1.5; g.stroke();
    for (let i = 0; i < 8; i++) {
      const long = i % 2 === 0, a = (i / 8) * Math.PI * 2, L = long ? r : r * 0.55;
      g.save(); g.rotate(a);
      g.fillStyle = i === 0 ? '#e0457b' : long ? '#6a4a7a' : '#b9a3c6';
      g.beginPath(); g.moveTo(0, -L); g.lineTo(L * 0.18, 0); g.lineTo(0, L * 0.12); g.lineTo(-L * 0.18, 0); g.closePath(); g.fill();
      g.restore();
    }
    g.fillStyle = '#4a2d4a'; g.font = 'bold 13px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('N', 0, -r - 14 + 6); g.fillText('S', 0, r + 9); g.fillText('E', r + 10, 0); g.fillText('W', -r - 10, 0);
    g.restore();
  }

  _drawFeature(g, f, T) {
    const [x, y] = T.toMap(f.x, f.z);
    const sc = T.sc;
    g.save();
    if (f.type === 'tree') {
      const r = Math.max(4, (f.r || 2.2) * sc);
      g.fillStyle = 'rgba(40,40,60,0.22)'; g.beginPath(); g.ellipse(x + r * 0.35, y + r * 0.45, r, r * 0.8, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#7a4a30'; g.fillRect(x - 1.2, y, 2.4, r * 0.7);
      const c = new THREE.Color(f.color || '#7cc96b');
      const grad = g.createRadialGradient(x - r * 0.35, y - r * 0.45, r * 0.1, x, y - r * 0.2, r * 1.1);
      grad.addColorStop(0, '#' + c.clone().offsetHSL(0, 0, 0.12).getHexString());
      grad.addColorStop(1, '#' + c.clone().offsetHSL(0, 0.05, -0.12).getHexString());
      g.fillStyle = grad;
      g.beginPath(); g.arc(x, y - r * 0.2, r, 0, Math.PI * 2); g.arc(x - r * 0.55, y + r * 0.05, r * 0.65, 0, Math.PI * 2); g.arc(x + r * 0.55, y + r * 0.05, r * 0.65, 0, Math.PI * 2); g.fill();
    } else if (f.type === 'bush') {
      const r = Math.max(2.5, 0.8 * sc);
      g.fillStyle = f.color || '#5fae55'; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.arc(x + r * 0.8, y + r * 0.2, r * 0.7, 0, Math.PI * 2); g.fill();
    } else if (f.type === 'rock') {
      const r = Math.max(3, (f.r || 1) * sc);
      g.fillStyle = '#b5aac2'; g.strokeStyle = '#7d728c'; g.lineWidth = 1;
      g.beginPath(); g.moveTo(x - r, y + r * 0.4); g.lineTo(x - r * 0.5, y - r * 0.6); g.lineTo(x + r * 0.4, y - r * 0.7); g.lineTo(x + r, y + r * 0.2); g.lineTo(x + r * 0.3, y + r * 0.7); g.closePath(); g.fill(); g.stroke();
    } else if (f.type === 'house') {
      const w = (f.w || 6.2) * sc, d = (f.d || 5.2) * sc;
      g.fillStyle = 'rgba(40,40,60,0.25)'; g.fillRect(x - w / 2 + 3, y - d / 2 + 4, w, d);
      g.fillStyle = f.roof || '#e0609a';
      g.beginPath(); g.moveTo(x - w / 2, y - d / 2); g.lineTo(x + w / 2, y - d / 2); g.lineTo(x + w / 2, y + d / 2); g.lineTo(x - w / 2, y + d / 2); g.closePath(); g.fill();
      g.strokeStyle = 'rgba(255,255,255,0.7)'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(x - w / 2, y); g.lineTo(x + w / 2, y); g.stroke();
      g.strokeStyle = 'rgba(0,0,0,0.25)'; g.lineWidth = 1; g.strokeRect(x - w / 2, y - d / 2, w, d);
      g.fillStyle = '#5a3a2a'; g.fillRect(x + w * 0.22, y - d * 0.42, w * 0.1, d * 0.18); // chimney
    } else if (f.type === 'tent') {
      g.fillStyle = '#ff9a8a'; g.strokeStyle = '#a04a4a'; g.lineWidth = 1.2;
      g.beginPath(); g.moveTo(x, y - 9); g.lineTo(x + 9, y + 6); g.lineTo(x - 9, y + 6); g.closePath(); g.fill(); g.stroke();
      g.fillStyle = '#7a3030'; g.beginPath(); g.moveTo(x, y - 2); g.lineTo(x + 3, y + 6); g.lineTo(x - 3, y + 6); g.fill();
    } else if (f.type === 'fire') {
      g.fillStyle = '#ffb33a'; g.beginPath(); g.moveTo(x, y - 7); g.quadraticCurveTo(x + 6, y, x, y + 4); g.quadraticCurveTo(x - 6, y, x, y - 7); g.fill();
      g.fillStyle = '#ffe27a'; g.beginPath(); g.arc(x, y + 1, 2, 0, Math.PI * 2); g.fill();
    } else if (f.type === 'falls') {
      g.strokeStyle = '#ffffff'; g.lineWidth = 2;
      for (let i = -2; i <= 2; i++) { g.beginPath(); g.moveTo(x + i * 3, y - 8); g.lineTo(x + i * 3, y + 6); g.stroke(); }
    } else if (f.type === 'playground') {
      g.strokeStyle = '#c0392b'; g.lineWidth = 2.5; g.strokeRect(x - 8, y - 4, 16, 8);
      g.fillStyle = '#ffd34d'; g.fillRect(x + 9, y - 6, 4, 12);
    } else if (f.type === 'bench') {
      g.fillStyle = '#9a6a40'; g.fillRect(x - 4, y - 1.5, 8, 3);
    } else if (f.type === 'pillar') {
      g.fillStyle = '#c9b9d9'; g.strokeStyle = '#7d728c'; g.beginPath(); g.arc(x, y, Math.max(4, 1.3 * sc), 0, Math.PI * 2); g.fill(); g.stroke();
    } else if (f.type === 'cloud') {
      g.fillStyle = 'rgba(255,255,255,0.9)'; g.strokeStyle = 'rgba(160,140,190,0.6)'; g.lineWidth = 1;
      g.beginPath(); g.arc(x, y, 6, 0, Math.PI * 2); g.arc(x + 6, y + 1, 5, 0, Math.PI * 2); g.arc(x - 6, y + 1, 5, 0, Math.PI * 2); g.fill(); g.stroke();
    } else if (f.type === 'label') {
      g.font = 'italic bold 14px "Chalkboard SE", "Comic Sans MS", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillStyle = f.color || 'rgba(60,90,140,0.75)'; g.fillText(f.text, x, y);
    }
    g.restore();
  }

  drawMap(canvas) {
    const g = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    const mb = this.mapBounds;
    if (!this._mapBase || this._mapBase.width !== W) this._mapBase = this._buildMapBase(W, H);
    const T = this.mapTransform(W, H);
    g.drawImage(this._mapBase, 0, 0);
    // soft clouds over the places you haven't explored yet
    if (!this._fogCv) { this._fogCv = document.createElement('canvas'); this._fogCv.width = W; this._fogCv.height = H; }
    const fc = this._fogCv, fg = fc.getContext('2d');
    fg.globalCompositeOperation = 'source-over';
    fg.clearRect(0, 0, W, H);
    fg.fillStyle = '#fbf6fb'; fg.fillRect(0, 0, W, H);
    fg.globalCompositeOperation = 'destination-out';
    const cellW = (mb.x1 - mb.x0) / 64, cellH = (mb.z1 - mb.z0) / 64;
    const rad = Math.max(cellW, cellH) * T.sc * 1.6;
    for (let j = 0; j < 64; j++) for (let i = 0; i < 64; i++) {
      if (!this.mapExplored[j * 64 + i]) continue;
      const [px, py] = T.toMap(mb.x0 + (i + 0.5) * cellW, mb.z0 + (j + 0.5) * cellH);
      const gr = fg.createRadialGradient(px, py, 0, px, py, rad);
      gr.addColorStop(0, 'rgba(0,0,0,1)'); gr.addColorStop(0.6, 'rgba(0,0,0,0.8)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
      fg.fillStyle = gr; fg.fillRect(px - rad, py - rad, rad * 2, rad * 2);
    }
    g.globalAlpha = 0.93; g.drawImage(fc, 0, 0); g.globalAlpha = 1;
    // frame, title and compass (on top of the fog)
    const title = this.mapTitle || '';
    g.lineWidth = 10; g.strokeStyle = '#fff'; g.strokeRect(5, 5, W - 10, H - 10);
    g.lineWidth = 2; g.strokeStyle = '#c9a6c4'; g.strokeRect(13, 13, W - 26, H - 26);
    if (title) {
      g.font = 'bold 26px "Chalkboard SE", "Comic Sans MS", sans-serif';
      const tw = g.measureText(title).width + 46;
      g.fillStyle = 'rgba(0,0,0,0.12)'; this._pill(g, W / 2 - tw / 2 + 3, 20 + 3, tw, 40, 20); g.fill();
      g.fillStyle = '#fff6fb'; this._pill(g, W / 2 - tw / 2, 20, tw, 40, 20); g.fill();
      g.strokeStyle = '#e48ab8'; g.lineWidth = 2.5; g.stroke();
      g.fillStyle = '#7a3a6a'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(title, W / 2, 41);
    }
    this._compassRose(g, W - 70, H - 72, 40);
    // markers
    g.textAlign = 'center'; g.textBaseline = 'middle';
    const labels = [];
    for (const m of this.mapMarkers()) {
      const gi = Math.floor((m.x - mb.x0) / (mb.x1 - mb.x0) * 64), gj = Math.floor((m.z - mb.z0) / (mb.z1 - mb.z0) * 64);
      if (!m.always && !this.mapExplored[gj * 64 + gi]) continue;
      const [mx, my] = T.toMap(m.x, m.z);
      g.fillStyle = 'rgba(60,30,60,0.25)'; g.beginPath(); g.arc(mx + 1.5, my + 2.5, 17, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#ffffff'; g.beginPath(); g.arc(mx, my, 17, 0, Math.PI * 2); g.fill();
      g.strokeStyle = '#f0a6c8'; g.lineWidth = 2.5; g.stroke();
      g.font = '20px serif'; g.fillStyle = '#000'; g.fillText(m.icon, mx, my + 1);
      if (m.label) labels.push({ m, mx, my });
    }
    // labels: try below, above, then to the sides so they don't pile up
    const placed = [];
    for (const { m, mx, my } of labels) {
      g.font = 'bold 14px "Chalkboard SE", "Comic Sans MS", sans-serif';
      const w = g.measureText(m.label).width + 16, h = 21;
      const tries = [[0, 20], [0, -41], [w / 2 + 20, -10], [-w / 2 - 20, -10], [0, 42], [0, -63]];
      let lx = mx - w / 2, ly = my + 20;
      for (const [dx, dy] of tries) {
        const x = mx - w / 2 + dx, y = my + dy;
        if (!placed.some((r) => x < r.x + r.w && x + w > r.x && y < r.y + r.h && y + h > r.y)) { lx = x; ly = y; break; }
      }
      placed.push({ x: lx, y: ly, w, h });
      g.fillStyle = 'rgba(60,30,60,0.2)'; this._pill(g, lx + 1.5, ly + 1.5, w, h, 10.5); g.fill();
      g.fillStyle = 'rgba(255,255,255,0.95)'; this._pill(g, lx, ly, w, h, 10.5); g.fill();
      g.fillStyle = '#4a2d4a'; g.fillText(m.label, lx + w / 2, ly + 11);
    }
    // where the hint points
    const hint = this.getHint?.();
    if (hint && hint.target) {
      const [hx, hy] = T.toMap(hint.target.x, hint.target.z);
      const pulse = 1 + Math.sin(performance.now() / 300) * 0.15;
      g.strokeStyle = 'rgba(255,200,60,0.95)'; g.lineWidth = 3; g.setLineDash([5, 5]);
      g.beginPath(); g.arc(hx, hy, 13 * pulse, 0, Math.PI * 2); g.stroke(); g.setLineDash([]);
      g.font = '16px serif'; g.fillText('✨', hx, hy);
    }
    // the player
    const [px, py] = T.toMap(this.player.pos.x, this.player.pos.z);
    g.fillStyle = 'rgba(255,79,143,0.18)'; g.beginPath(); g.arc(px, py, 22 + Math.sin(performance.now() / 250) * 3, 0, Math.PI * 2); g.fill();
    g.save();
    g.translate(px, py);
    g.rotate(-this.player.yaw + Math.PI);
    g.fillStyle = '#ff4f8f';
    g.strokeStyle = '#fff'; g.lineWidth = 3;
    g.beginPath(); g.moveTo(0, -15); g.lineTo(11, 11); g.lineTo(0, 5); g.lineTo(-11, 11); g.closePath();
    g.fill(); g.stroke();
    g.restore();
  }

  dispose() {
    this.scene.traverse((o) => {
      if (o.geometry) o.geometry.dispose?.();
    });
  }
}

export function iconFor(kind) {
  return { star: '⭐', shell: '🐚', feather: '🪶', seaglass: '💎', flower: '🌸', heart: '💗', cape: '🦸', bandage: '🩹', litter: '🗑️', snowflake: '❄️' }[kind] || '✨';
}
