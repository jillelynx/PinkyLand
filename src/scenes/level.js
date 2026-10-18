// Shared parts of every place you can visit (Earth and Pinky Land).
import * as THREE from 'three';
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
  }

  setupSky(startTime) {
    this.dayNight = new DayNight(this.scene, { startTime });
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
    this.player.events.bounce = () => g.audio.bounce();
    this.player.events.splash = (k) => g.audio.splash(k);
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
    const dark = night > 0.5 || (this.player.underwater && night > 0.3);
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
    const p = this.player;
    const busy = g.ui.isBusy() || this.cutscene;
    p.frozen = busy;
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
    const chilly = this.dayNight.isChilly() || p.pos.y > 30;
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
    if (!busy) {
      for (const it of this.interactables) {
        if (it.enabled && !it.enabled()) continue;
        const pos = typeof it.pos === 'function' ? it.pos() : it.pos;
        const d = Math.hypot(pos.x - p.pos.x, pos.z - p.pos.z);
        if (d < (it.radius || 2.4) && Math.abs(pos.y - p.pos.y) < 3 && d < bestD) { best = it; bestD = d; }
      }
    }
    g.ui.prompt(best ? (typeof best.label === 'function' ? best.label() : best.label) : null);
    if (best && g.input.hit('KeyE', 'Pad_interact', 'Enter')) best.action();

    // camera
    const target = p.pos.clone();
    target.y += p.stats.eye * 0.85;
    this.rig.update(dt, target, { underwater: p.swimming && p.pos.y < this.world.waterLevel - 0.6, playerYaw: p.yaw, moving: p.forwardMoving });

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
        if (x >= 0 && z >= 0 && x < 64 && z < 64) this.mapExplored[z * 64 + x] = 1;
      }
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
    g.ui.setCompass(heading, (skyBearing + 360) % 360, skyIcon);
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
  drawMap(canvas) {
    const mb = this.mapBounds;
    const g = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    if (!this._mapImage) {
      const img = g.createImageData(W, H);
      const col = new THREE.Color();
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          const wx = mb.x0 + (x / W) * (mb.x1 - mb.x0);
          const wz = mb.z0 + (y / H) * (mb.z1 - mb.z0);
          const h = this.world.terrainHeight(wx, wz);
          this.mapColor(wx, wz, h, col);
          const i = (y * W + x) * 4;
          img.data[i] = col.r * 255; img.data[i + 1] = col.g * 255; img.data[i + 2] = col.b * 255; img.data[i + 3] = 255;
        }
      }
      this._mapImage = img;
    }
    g.putImageData(this._mapImage, 0, 0);
    // fog over unexplored parts
    g.fillStyle = 'rgba(255, 248, 240, 0.88)';
    const cw = W / 64, ch = H / 64;
    for (let j = 0; j < 64; j++) for (let i = 0; i < 64; i++) if (!this.mapExplored[j * 64 + i]) g.fillRect(i * cw - 0.5, j * ch - 0.5, cw + 1, ch + 1);
    const toMap = (x, z) => [((x - mb.x0) / (mb.x1 - mb.x0)) * W, ((z - mb.z0) / (mb.z1 - mb.z0)) * H];
    g.textAlign = 'center'; g.textBaseline = 'middle';
    for (const m of this.mapMarkers()) {
      const [mx, my] = toMap(m.x, m.z);
      const gi = Math.floor((m.x - mb.x0) / (mb.x1 - mb.x0) * 64), gj = Math.floor((m.z - mb.z0) / (mb.z1 - mb.z0) * 64);
      if (!m.always && !this.mapExplored[gj * 64 + gi]) continue;
      g.font = '26px serif';
      g.fillText(m.icon, mx, my);
      if (m.label) {
        g.font = 'bold 15px "Chalkboard SE", "Comic Sans MS", sans-serif';
        g.fillStyle = 'rgba(255,255,255,0.85)';
        const w = g.measureText(m.label).width + 12;
        g.fillRect(mx - w / 2, my + 14, w, 20);
        g.fillStyle = '#4a2d4a';
        g.fillText(m.label, mx, my + 24);
      }
    }
    // player arrow
    const [px, py] = toMap(this.player.pos.x, this.player.pos.z);
    g.save();
    g.translate(px, py);
    g.rotate(-this.player.yaw + Math.PI);
    g.fillStyle = '#ff4f8f';
    g.strokeStyle = '#fff'; g.lineWidth = 3;
    g.beginPath(); g.moveTo(0, -14); g.lineTo(10, 10); g.lineTo(0, 5); g.lineTo(-10, 10); g.closePath();
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
  return { star: '⭐', shell: '🐚', feather: '🪶', seaglass: '💎', flower: '🌸', heart: '💗', cape: '🦸', bandage: '🩹', litter: '🗑️' }[kind] || '✨';
}
