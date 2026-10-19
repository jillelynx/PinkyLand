// Living creatures. Fox, horses, parrots, flamingos, storks and fish use real
// animated 3D models (see CREDITS.md). Butterflies and fireflies are drawn here.
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import { makeRandom, angleDamp } from '../util/noise.js';
import { sharedUniforms } from './terrain.js';

import foxData from '../../assets/models/Fox.glb';
import parrotData from '../../assets/models/Parrot.glb';
import flamingoData from '../../assets/models/Flamingo.glb';
import storkData from '../../assets/models/Stork.glb';
import horseData from '../../assets/models/Horse.glb';
import fishData from '../../assets/models/Fish.glb';

const RAW = { fox: foxData, parrot: parrotData, flamingo: flamingoData, stork: storkData, horse: horseData, fish: fishData };
let loaded = null;

export function loadModels() {
  if (loaded) return loaded;
  const loader = new GLTFLoader();
  const entries = Object.entries(RAW).map(([k, data]) => new Promise((resolve) => {
    const buf = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
    loader.parse(buf, '', (g) => resolve([k, g]), (e) => { console.warn('model failed', k, e); resolve([k, null]); });
  }));
  loaded = Promise.all(entries).then((list) => Object.fromEntries(list));
  return loaded;
}

function prepare(obj) {
  obj.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = true;
      o.receiveShadow = true;
      o.frustumCulled = false;
      if (o.material && o.material.vertexColors === false && o.geometry.attributes.color) o.material.vertexColors = true;
    }
  });
  return obj;
}

export class Creatures {
  constructor(scene, world, models) {
    this.scene = scene;
    this.world = world;
    this.models = models;
    this.list = []; // all creatures with { name, journalKey, object, update }
    this.rand = makeRandom(42);
  }

  // A fox that trots between places and stops to look around
  addFox({ area, count = 1, scale = 0.0095 }) {
    const g = this.models.fox;
    if (!g) return;
    for (let i = 0; i < count; i++) {
      const fox = prepare(SkeletonUtils.clone(g.scene));
      fox.scale.setScalar(scale);
      const holder = new THREE.Group();
      holder.add(fox);
      this.scene.add(holder);
      const mixer = new THREE.AnimationMixer(fox);
      const clips = Object.fromEntries(g.animations.map((c) => [c.name, mixer.clipAction(c)]));
      let current = clips.Survey; current?.play();
      const c = {
        name: 'Fox', journalKey: 'fox', object: holder, mixer,
        state: 'idle', timer: 2 + this.rand() * 3, target: new THREE.Vector2(), yaw: this.rand() * 6,
      };
      holder.position.set(area.x + (this.rand() - 0.5) * area.r, 0, area.z + (this.rand() - 0.5) * area.r);
      const setAnim = (name) => {
        const next = clips[name];
        if (!next || next === current) return;
        next.reset().play();
        current?.crossFadeTo(next, 0.35, false);
        current = next;
      };
      c.update = (dt, ctx) => {
        mixer.update(dt);
        c.timer -= dt;
        const p = holder.position;
        // run off playfully if the player dashes nearby
        const pd = ctx.playerPos ? Math.hypot(ctx.playerPos.x - p.x, ctx.playerPos.z - p.z) : 99;
        if (c.state === 'idle' && c.timer < 0) {
          for (let k = 0; k < 10; k++) {
            const a = this.rand() * Math.PI * 2, r = this.rand() * area.r;
            const tx = area.x + Math.cos(a) * r, tz = area.z + Math.sin(a) * r;
            if (this.world.terrainHeight(tx, tz) > this.world.waterLevel + 0.3) { c.target.set(tx, tz); break; }
          }
          c.state = 'walk'; setAnim('Walk');
        }
        if (c.state === 'walk' || c.state === 'run') {
          const dx = c.target.x - p.x, dz = c.target.y - p.z;
          const d = Math.hypot(dx, dz);
          const sp = c.state === 'run' ? 3.2 : 1.0;
          if (d < 0.4) { c.state = 'idle'; c.timer = 3 + this.rand() * 5; setAnim('Survey'); }
          else {
            c.yaw = angleDamp(c.yaw, Math.atan2(dx, dz), 4, dt);
            p.x += Math.sin(c.yaw) * sp * dt; p.z += Math.cos(c.yaw) * sp * dt;
          }
        }
        if (pd < 2.2 && ctx.playerSpeed > 5 && c.state !== 'run') {
          const ax = p.x - ctx.playerPos.x, az = p.z - ctx.playerPos.z;
          const l = Math.hypot(ax, az) || 1;
          c.target.set(p.x + (ax / l) * 7, p.z + (az / l) * 7);
          c.state = 'run'; setAnim('Run');
        }
        p.y = this.world.terrainHeight(p.x, p.z);
        holder.rotation.y = c.yaw;
      };
      this.list.push(c);
    }
  }

  // Birds flying in big lazy loops
  addFlyers(kind, { center, radius = 20, height = 18, count = 3, scale = 0.012, speed = 0.25, journalKey, name, clearance = 6 }) {
    const g = this.models[kind];
    if (!g) return;
    for (let i = 0; i < count; i++) {
      const bird = prepare(g.scene.clone());
      bird.scale.setScalar(scale);
      const holder = new THREE.Group();
      holder.add(bird);
      this.scene.add(holder);
      const mixer = new THREE.AnimationMixer(bird);
      const act = mixer.clipAction(g.animations[0]);
      act.play();
      act.time = this.rand() * act.getClip().duration;
      act.timeScale = 0.8 + this.rand() * 0.4;
      const phase = (i / count) * Math.PI * 2 + this.rand() * 0.3;
      const r = radius * (0.8 + this.rand() * 0.4);
      const h = height + (this.rand() - 0.5) * 4;
      const dir = this.rand() < 0.5 ? 1 : -1;
      const c = { name, journalKey, object: holder, mixer, t: phase };
      c.update = (dt) => {
        mixer.update(dt);
        c.t += dt * speed * dir;
        const x = center.x + Math.cos(c.t) * r;
        const z = center.z + Math.sin(c.t) * r * 0.8;
        const nx = center.x + Math.cos(c.t + 0.05 * dir) * r;
        const nz = center.z + Math.sin(c.t + 0.05 * dir) * r * 0.8;
        // fly at their usual height, but rise smoothly over hills and trees
        // (looking a little ahead so they climb before they get there)
        const W = this.world;
        let ground = Math.max(W.terrainHeight(x, z), W.waterLevel);
        for (const k of [0.15, 0.3, 0.5]) {
          const ax = center.x + Math.cos(c.t + k * dir) * r, az = center.z + Math.sin(c.t + k * dir) * r * 0.8;
          ground = Math.max(ground, W.terrainHeight(ax, az));
        }
        const want = Math.max(h + Math.sin(c.t * 2.3) * 1.5, ground + clearance);
        c.y = c.y === undefined ? want : c.y + (want - c.y) * Math.min(1, dt * 1.2);
        c.y = Math.max(c.y, W.terrainHeight(x, z) + clearance * 0.6);
        holder.position.set(x, c.y, z);
        holder.rotation.y = Math.atan2(nx - x, nz - z);
        holder.rotation.z = -dir * 0.25;
      };
      this.list.push(c);
    }
  }

  // Horses galloping across the meadow
  addHorses({ center, radius = 30, count = 2, scale = 0.0085 }) {
    const g = this.models.horse;
    if (!g) return;
    for (let i = 0; i < count; i++) {
      const horse = prepare(g.scene.clone());
      horse.scale.setScalar(scale);
      const holder = new THREE.Group();
      holder.add(horse);
      this.scene.add(holder);
      const mixer = new THREE.AnimationMixer(horse);
      const act = mixer.clipAction(g.animations[0]);
      act.play();
      act.time = i * 0.3;
      const c = { name: 'Dream Horse', journalKey: 'horse', object: holder, mixer, t: i * 0.6 };
      const r = radius + i * 4;
      c.update = (dt) => {
        mixer.update(dt);
        c.t += dt * 0.14;
        // an egg-shaped loop through the meadow
        const x = center.x + Math.cos(c.t) * r;
        const z = center.z + Math.sin(c.t) * r * 0.6;
        const nx = center.x + Math.cos(c.t + 0.02) * r;
        const nz = center.z + Math.sin(c.t + 0.02) * r * 0.6;
        holder.position.set(x, Math.max(this.world.terrainHeight(x, z), this.world.waterLevel - 0.6), z);
        holder.rotation.y = Math.atan2(nx - x, nz - z);
      };
      this.list.push(c);
    }
  }

  // A school of fish that swims in loops (tails wiggle with a shader)
  addFish({ center, radius = 6, depth = 1.2, count = 12, scale = 0.55, journalKey = 'fish', name = 'Shimmer Fish' }) {
    const g = this.models.fish;
    if (!g) return;
    let src = null;
    g.scene.traverse((o) => { if (o.isMesh && !src) src = o; });
    if (!src) return;
    const material = src.material.clone();
    material.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = sharedUniforms.uTime;
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nuniform float uTime;')
        .replace('#include <begin_vertex>', `#include <begin_vertex>
          float tailK = smoothstep(0.1, -0.33, position.z);
          float phase = 0.0;
          #ifdef USE_INSTANCING
            phase = instanceMatrix[3].x * 3.0 + instanceMatrix[3].z * 2.0;
          #endif
          transformed.x += sin(uTime * 9.0 + position.z * 12.0 + phase) * 0.06 * tailK;`);
    };
    material.customProgramCacheKey = () => 'fishwag';
    material.emissive = new THREE.Color('#203040');
    const im = new THREE.InstancedMesh(src.geometry, material, count);
    im.castShadow = false;
    im.frustumCulled = false;
    this.scene.add(im);
    const fish = [];
    for (let i = 0; i < count; i++) {
      fish.push({ t: this.rand() * 6.28, r: radius * (0.4 + this.rand() * 0.6), y: -depth + (this.rand() - 0.5) * depth * 0.6, s: scale * (0.7 + this.rand() * 0.5), sp: 0.25 + this.rand() * 0.25, wob: this.rand() * 6 });
    }
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), s = new THREE.Vector3();
    const c = { name, journalKey, object: im, positions: fish.map(() => new THREE.Vector3()) };
    c.update = (dt) => {
      fish.forEach((f, i) => {
        f.t += dt * f.sp;
        const x = center.x + Math.cos(f.t) * f.r + Math.sin(f.t * 2.7 + f.wob) * 0.6;
        const z = center.z + Math.sin(f.t) * f.r;
        const floor = this.world.terrainHeight(x, z) + 0.3;
        const y = Math.max(floor, this.world.waterLevel + f.y + Math.sin(f.t * 3 + f.wob) * 0.2);
        p.set(x, Math.min(y, this.world.waterLevel - 0.25), z);
        const yaw = f.t + Math.PI; // tangent direction (model faces +z)
        q.setFromEuler(new THREE.Euler(0, -yaw + Math.PI, 0));
        s.setScalar(f.s);
        m.compose(p, q, s);
        im.setMatrixAt(i, m);
        c.positions[i].copy(p);
      });
      im.instanceMatrix.needsUpdate = true;
    };
    c.near = (pos, d) => c.positions.some((p) => p.distanceTo(pos) < d);
    this.list.push(c);
  }

  // Butterflies with painted wings that flutter around flowers by day
  addButterflies({ center, radius = 25, count = 14, getHeight }) {
    const palettes = [
      ['#ff9a3c', '#2b1a12'], ['#7ec8ff', '#1b2a5a'], ['#ffb3d9', '#7a3a6a'], ['#fff07a', '#5a4a12'], ['#c9a8ff', '#3a2a6a'],
    ];
    const textures = palettes.map(([a, b]) => wingTexture(a, b));
    const group = new THREE.Group();
    this.scene.add(group);
    const flies = [];
    for (let i = 0; i < count; i++) {
      const tex = textures[i % textures.length];
      const mat = new THREE.MeshStandardMaterial({ map: tex, transparent: true, side: THREE.DoubleSide, alphaTest: 0.3, roughness: 0.6, emissive: '#222222' });
      const b = new THREE.Group();
      const wingGeo = new THREE.PlaneGeometry(0.16, 0.16);
      wingGeo.translate(0.08, 0, 0);
      wingGeo.rotateX(-Math.PI / 2);
      const L = new THREE.Mesh(wingGeo, mat);
      const R = new THREE.Mesh(wingGeo, mat);
      R.scale.x = -1;
      const bodyM = new THREE.Mesh(new THREE.CapsuleGeometry(0.008, 0.07, 2, 6), new THREE.MeshStandardMaterial({ color: '#2a1a12' }));
      bodyM.rotation.x = Math.PI / 2;
      b.add(L, R, bodyM);
      b.scale.setScalar(1.3);
      group.add(b);
      flies.push({ b, L, R, t: this.rand() * 100, home: new THREE.Vector3(center.x + (this.rand() - 0.5) * radius * 2, 0, center.z + (this.rand() - 0.5) * radius * 2), sp: 0.6 + this.rand() * 0.6 });
    }
    const c = { name: 'Butterfly', journalKey: 'butterfly', object: group, positions: flies.map((f) => f.b.position) };
    c.update = (dt, ctx) => {
      group.visible = ctx.night < 0.6;
      if (!group.visible) return;
      for (const f of flies) {
        f.t += dt * f.sp;
        const x = f.home.x + Math.sin(f.t * 0.7) * 3 + Math.sin(f.t * 1.9) * 1.2;
        const z = f.home.z + Math.cos(f.t * 0.6) * 3 + Math.cos(f.t * 2.3) * 1.2;
        const y = getHeight(x, z) + 0.6 + Math.abs(Math.sin(f.t * 1.3)) * 1.1;
        const nx = f.home.x + Math.sin((f.t + 0.05) * 0.7) * 3 + Math.sin((f.t + 0.05) * 1.9) * 1.2;
        const nz = f.home.z + Math.cos((f.t + 0.05) * 0.6) * 3 + Math.cos((f.t + 0.05) * 2.3) * 1.2;
        f.b.position.set(x, y, z);
        f.b.rotation.y = Math.atan2(nx - x, nz - z);
        const flap = Math.sin(f.t * 28) * 0.9;
        f.L.rotation.z = flap; f.R.rotation.z = -flap;
      }
    };
    c.near = (pos, d) => flies.some((f) => f.b.position.distanceTo(pos) < d);
    this.list.push(c);
  }

  // Glowing fireflies that come out at night
  addFireflies({ center, radius = 30, count = 160, getHeight }) {
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(count * 3);
    const seed = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      const x = center.x + (this.rand() - 0.5) * radius * 2;
      const z = center.z + (this.rand() - 0.5) * radius * 2;
      pos[i * 3] = x; pos[i * 3 + 1] = Math.max(getHeight(x, z), 0) + 0.4 + this.rand() * 2.2; pos[i * 3 + 2] = z;
      seed[i] = this.rand() * 100;
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
    const mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: { uTime: sharedUniforms.uTime, uNight: sharedUniforms.uNight, uScale: { value: window.innerHeight / 2 } },
      vertexShader: /* glsl */ `
        attribute float aSeed; uniform float uTime; uniform float uScale; uniform float uNight;
        varying float vGlow;
        void main(){
          vec3 p = position;
          p.x += sin(uTime*0.4 + aSeed) * 0.8;
          p.y += sin(uTime*0.6 + aSeed*1.7) * 0.4;
          p.z += cos(uTime*0.35 + aSeed*0.7) * 0.8;
          vec4 mv = modelViewMatrix * vec4(p,1.0);
          float blink = pow(max(0.0, sin(uTime*1.3 + aSeed*3.0)), 3.0);
          vGlow = (0.25 + blink * 0.75) * smoothstep(0.35, 0.8, uNight);
          gl_PointSize = (0.4 * uScale / -mv.z) * (0.5 + blink);
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */ `
        varying float vGlow;
        void main(){
          float d = length(gl_PointCoord - 0.5);
          float a = smoothstep(0.5, 0.0, d);
          gl_FragColor = vec4(vec3(1.0, 0.95, 0.5) * (a*a*3.0 + 0.3), a * vGlow);
        }`,
    });
    const pts = new THREE.Points(geo, mat);
    pts.frustumCulled = false;
    this.scene.add(pts);
    const c = { name: 'Firefly', journalKey: 'firefly', object: pts };
    c.update = () => {};
    c.near = (p, d, ctx) => ctx.night > 0.6 && Math.hypot(p.x - center.x, p.z - center.z) < radius;
    this.list.push(c);
  }

  update(dt, ctx) {
    for (const c of this.list) c.update(dt, ctx);
  }
}

function wingTexture(main, edge) {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  // a single wing (the body is at the left edge)
  g.fillStyle = edge;
  g.beginPath();
  g.moveTo(4, 64);
  g.bezierCurveTo(30, 0, 120, 0, 122, 40);
  g.bezierCurveTo(124, 64, 80, 66, 60, 66);
  g.bezierCurveTo(100, 76, 110, 120, 70, 124);
  g.bezierCurveTo(40, 126, 20, 90, 4, 64);
  g.fill();
  g.fillStyle = main;
  g.save();
  g.translate(8, 2);
  g.scale(0.88, 0.94);
  g.beginPath();
  g.moveTo(4, 64);
  g.bezierCurveTo(30, 6, 116, 6, 116, 42);
  g.bezierCurveTo(116, 60, 80, 64, 60, 66);
  g.bezierCurveTo(96, 78, 104, 116, 70, 118);
  g.bezierCurveTo(42, 120, 22, 90, 4, 64);
  g.fill();
  g.restore();
  g.fillStyle = 'rgba(255,255,255,0.85)';
  for (const [x, y, r] of [[100, 30, 5], [88, 22, 4], [106, 44, 3], [70, 104, 4]]) { g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
