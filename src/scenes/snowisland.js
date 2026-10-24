// Snowdrop Island: a snowy island north of Pinky Land, reached by the little ferry.
// The WEST side has real, cold snow: snowy pines, falling snowflakes, a frozen pond
// with penguins, a big igloo you can go inside and the Big Sled Hill (where Frost
// the snow dragon lives). The EAST side has magical WARM snow: pink sparkly snow,
// glowing crystals, rising sparkles, snow bunnies, a steamy hot spring and Cocoa's
// hot-cocoa stand. Everywhere: sled, build snowmen, snow pinkies and igloos.
import * as THREE from 'three';
import { Level } from './level.js';
import { Terrain } from '../world/terrain.js';
import { World } from '../world/world.js';
import { Water } from '../world/water.js';
import { Clouds } from '../world/clouds.js';
import { createTrees, createRocks } from '../world/vegetation.js';
import { createSign } from '../world/props.js';
import { Pillow, PINKY_LOOK } from '../characters/pinky.js';
import { NPC } from '../characters/npc.js';
import { WesternDragon, FROST_LOOK, DRAGON_INFO } from '../world/dragons.js';
import { makeIgloo, makeSnowman, makeSled, makeFerry, createSnowPines, createCrystals, SnowWeather, createSteam, addPenguins, addSnowBunnies, glowMaterial } from '../world/snowStuff.js';
import { RideMixin } from './riding.js';
import { SNOW_DAY } from '../world/sky.js';
import { DRAGON_KINDS, dragonsMet, dragonFound } from './dragonQuest.js';
import { makeNoise2D, makeRandom, smoothstep, fbm, lerp, clamp, damp, angleDamp } from '../util/noise.js';

const SR = 82; // island radius
const HILL = { x: -34, z: -26, h: 22 }; // the Big Sled Hill (cold side)
const SUGAR = { x: 36, z: -24, h: 9 }; // Sugar Hill (warm side, a gentle sledding hill)
const HOT = { x: 34, z: 16, r: 5.5 }; // the hot spring
const ICE = { x: -24, z: 14, r: 9 }; // the frozen pond
const IGLOO = { x: -52, z: 30, yaw: Math.PI / 2 }; // the big igloo (door faces the middle)
const FROST_HOME = { x: -37, z: -30 };
const COCOA = { x: 27, z: 25 };
const ARRIVE = { x: 0, z: 58 };
const BUILD_SPOTS = [{ x: -16, z: 38 }, { x: -44, z: 6 }, { x: 18, z: 2 }, { x: 46, z: 8 }];
const RACKS = [{ x: -28.5, z: -18.5, yaw: 0.75 }, { x: 32.5, z: -18.5, yaw: -0.4 }];
const MAX_BUILDS = 14;

const PINKY = { who: 'Pinky', color: '#f08aa8', pitch: 1.4 };
const J = { who: 'Jacinta', color: '#ff6fa8', pitch: 1.2 };
const COCOA_V = { who: 'Cocoa', color: '#8a5a3c', pitch: 1.15 };
const FROST_V = { who: 'Frost', color: '#3a7bd5', pitch: 0.9 };
const line = (who, text, extra = {}) => ({ ...who, text, ...extra });

export class SnowIslandLevel extends Level {
  constructor(game) {
    super(game, 'snow');
    const s = game.state;
    s.snow = s.snow || { visited: false, met: [], builds: [], sledded: false };
    this.P = s.snow;
    this.rideEdge = SR + 14;
    this.builds = [];
    this.igloos = [];
  }

  // how "warm-magic" a spot is: 0 on the cold west side, 1 on the warm east side
  warmth(x) { return smoothstep(-8, 12, x); }

  height(x, z) {
    const n = this.noise;
    const r = Math.hypot(x, z) + n(x * 0.012, z * 0.012) * 8;
    const mask = 1 - smoothstep(SR - 24, SR, r);
    let land = 1.5 + fbm(n, x * 0.015, z * 0.015, 4) * 1.4;
    const d1 = Math.hypot(x - HILL.x, z - HILL.z);
    land += Math.min(HILL.h, 27 * Math.exp(-((d1 / 21) ** 2)));
    const d2 = Math.hypot(x - SUGAR.x, z - SUGAR.z);
    land += Math.min(SUGAR.h, 11 * Math.exp(-((d2 / 14) ** 2)));
    let h = lerp(-9 + n(x * 0.05, z * 0.05), land, mask);
    // frozen pond: perfectly flat
    const dI = Math.hypot(x - ICE.x, z - ICE.z) + n(x * 0.1, z * 0.1) * 0.8;
    h = lerp(h, 1.3, 1 - smoothstep(ICE.r - 1, ICE.r + 4, dI));
    // hot spring: a flat shelf with a shallow bowl in it
    const dH = Math.hypot(x - HOT.x, z - HOT.z);
    h = lerp(h, 1.9, 1 - smoothstep(HOT.r + 1, HOT.r + 5, dH));
    h = lerp(h, 1.25, 1 - smoothstep(HOT.r - 2, HOT.r, dH));
    // flat ground for the igloo, Cocoa's stand and the arrival beach
    h = lerp(h, 1.8, 1 - smoothstep(6, 10, Math.hypot(x - IGLOO.x, z - IGLOO.z)));
    h = lerp(h, 1.9, 1 - smoothstep(3, 6, Math.hypot(x - COCOA.x, z - COCOA.z)));
    h = lerp(h, 1.6, 1 - smoothstep(5, 9, Math.hypot(x - ARRIVE.x, z - ARRIVE.z)));
    for (const b of BUILD_SPOTS) h = lerp(h, 1.8, 1 - smoothstep(4, 8, Math.hypot(x - b.x, z - b.z)));
    return h;
  }

  async build() {
    const g = this.game;
    this.noise = makeNoise2D(41);
    const noise = this.noise;
    const rand = makeRandom(5);
    this.setupSky(g.state.time ?? 0.36);
    this.dayNight.setStarShow(true); // northern lights look wonderful over the snow
    this.dayNight.dayPal = SNOW_DAY;
    this.dayNight.baseFogNear = 90; this.dayNight.baseFogFar = 640;

    const coldA = new THREE.Color('#eef4fd'), coldB = new THREE.Color('#cddcf1');
    const warmA = new THREE.Color('#fff0f6'), warmB = new THREE.Color('#ffd9ea'), lilac = new THREE.Color('#f1ddff');
    const rockC = new THREE.Color('#b4c2d6'), rockW = new THREE.Color('#e0c4dc');
    const shoreC = new THREE.Color('#dfe6ee'), shoreW = new THREE.Color('#f6e2ea'), under = new THREE.Color('#b9d6e6');
    const tmp = new THREE.Color();
    const color = (x, z, h, out) => {
      const w = this.warmth(x), n1 = noise(x * 0.04 + 3, z * 0.04) * 0.5 + 0.5;
      out.copy(coldA).lerp(coldB, n1 * 0.6);
      tmp.copy(warmA).lerp(warmB, n1 * 0.7);
      if (noise(x * 0.02 - 7, z * 0.02 + 1) > 0.3) tmp.lerp(lilac, 0.6);
      out.lerp(tmp, w);
      if (h < 1.0) out.lerp(tmp.copy(shoreC).lerp(shoreW, w), smoothstep(1.0, 0.4, h));
      if (h < 0) out.copy(under);
      const e = 1.2;
      const slope = Math.abs(this.height(x + e, z) - this.height(x - e, z)) + Math.abs(this.height(x, z + e) - this.height(x, z - e));
      if (slope > 4.6 && h > 0.5) out.lerp(tmp.copy(rockC).lerp(rockW, w), smoothstep(4.6, 7, slope) * 0.6);
      if (Math.hypot(x - ICE.x, z - ICE.z) < ICE.r + 2) out.lerp(new THREE.Color('#cfe4f7'), 0.5);
    };
    this.terrain = new Terrain({ size: 300, segments: 230, height: (x, z) => this.height(x, z), color });
    this.scene.add(this.terrain.mesh);
    this.world = new World({ terrain: this.terrain, waterLevel: 0, bounds: { x: 0, z: 0, r: SR + 14, soft: SR + 2 } });
    this.mapBounds = { x0: -100, x1: 100, z0: -100, z1: 100 };
    this.mapTitle = 'Snowdrop Island';
    this.mapFeatures = [];
    this.water = new Water({ size: 320, segments: 160, groundHeight: (x, z) => this.terrain.getHeight(x, z), skyUniforms: this.dayNight.uniforms });
    this.water.addTo(this.scene);
    this.clouds = new Clouds(this.scene, { count: 22, area: 600, height: [55, 110], seed: 9 });
    this.scene.add(this._mountains(rand));

    // ---- trees: snowy pines on the cold side, candy-floss blossom trees on the warm side
    const T = (x, z) => this.terrain.getHeight(x, z);
    const keepClear = (x, z, d = 0) => Math.hypot(x - HILL.x, z - HILL.z) < 12 + d || Math.hypot(x - ICE.x, z - ICE.z) < ICE.r + 4 + d ||
      Math.hypot(x - HOT.x, z - HOT.z) < HOT.r + 5 + d || Math.hypot(x - IGLOO.x, z - IGLOO.z) < 10 + d || Math.hypot(x - COCOA.x, z - COCOA.z) < 6 + d ||
      Math.hypot(x - ARRIVE.x, z - ARRIVE.z) < 10 + d || BUILD_SPOTS.some((b) => Math.hypot(x - b.x, z - b.z) < 8 + d) || RACKS.some((r) => Math.hypot(x - r.x, z - r.z) < 6 + d) ||
      Math.abs(x) < 4 + d; // a snowy path between the two sides
    const pineSpots = [], warmTrees = [];
    for (let i = 0; i < 420; i++) {
      const x = (rand() - 0.5) * 170, z = (rand() - 0.5) * 170, h = T(x, z);
      if (h < 1.4 || keepClear(x, z)) continue;
      // keep the sled runs open: no trees on the sunny downhill side of each hill
      const dx = x - HILL.x, dz = z - HILL.z;
      if (Math.hypot(dx, dz) < 32 && dx + dz > -4) continue;
      if (Math.hypot(x - SUGAR.x, z - SUGAR.z) < 18 && (z - SUGAR.z) > -6) continue;
      if (x < -2) { if (rand() < 0.75) pineSpots.push({ x, z }); }
      else if (rand() < 0.5) warmTrees.push({ x, z, kind: 'round', color: ['#ff9fcf', '#c9a0ff', '#ffcf7a', '#8fdcff', '#ffb0d6'][Math.floor(rand() * 5)] });
    }
    const pines = createSnowPines(this.terrain, pineSpots, { seed: 8 });
    this.scene.add(pines.mesh); this.world.addColliders(pines.colliders);
    const blossoms = createTrees(this.terrain, warmTrees, { seed: 12 });
    this.scene.add(blossoms.group); this.world.addColliders(blossoms.colliders);
    for (const t of pineSpots) this.mapFeatures.push({ type: 'tree', x: t.x, z: t.z, color: '#3f7a62', r: 1.6 });
    for (const t of warmTrees) this.mapFeatures.push({ type: 'tree', x: t.x, z: t.z, color: t.color, r: 1.8 });
    // glowing crystals all over the warm side
    const crystalSpots = [];
    for (let i = 0; i < 70; i++) {
      const x = 6 + rand() * 70, z = (rand() - 0.5) * 140;
      if (T(x, z) < 1.3 || keepClear(x, z, -2)) continue;
      crystalSpots.push({ x, z, scale: 0.7 + rand() * 0.8 });
    }
    crystalSpots.push({ x: 48, z: 30, scale: 1.6 }, { x: 52, z: 27, scale: 1.2 });
    this.scene.add(createCrystals(this.terrain, crystalSpots));
    // a few snowy boulders on the cold side
    const rockSpots = [];
    for (let i = 0; i < 40; i++) { const x = -10 - rand() * 65, z = (rand() - 0.5) * 140; if (T(x, z) > 1.2 && !keepClear(x, z)) rockSpots.push({ x, z, scale: 0.6 + rand() * 1.2 }); }
    const rocks = createRocks(this.terrain, rockSpots, { seed: 4, color: '#9aa8bb' });
    this.scene.add(rocks.group); this.world.addColliders(rocks.colliders);

    // ---- weather: snow falls on the cold side; warm sparkles float up on the warm side
    this.weather = new SnowWeather(this.scene);

    // ---- the frozen pond
    const ice = new THREE.Mesh(new THREE.CircleGeometry(ICE.r + 1.2, 48).rotateX(-Math.PI / 2), new THREE.MeshPhysicalMaterial({ color: '#d6ecff', roughness: 0.08, metalness: 0, clearcoat: 1, transparent: true, opacity: 0.88 }));
    ice.position.set(ICE.x, 1.36, ICE.z); ice.receiveShadow = true; this.scene.add(ice);
    for (let i = 0; i < 9; i++) { // little skating swirls scratched in the ice
      const a = rand() * 6.28, d = rand() * ICE.r * 0.7;
      const sw = new THREE.Mesh(new THREE.RingGeometry(0.8 + rand(), 0.86 + rand(), 32, 1, 0, 3 + rand() * 2).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.35 }));
      sw.position.set(ICE.x + Math.cos(a) * d, 1.37, ICE.z + Math.sin(a) * d); this.scene.add(sw);
    }

    // ---- the hot spring
    const spring = new THREE.Mesh(new THREE.CircleGeometry(HOT.r + 0.2, 40).rotateX(-Math.PI / 2), glowMaterial(0.25, 0.5, { transparent: true, opacity: 0.85, roughness: 0.1 }));
    spring.material.color.set('#7fe6e0'); spring.position.set(HOT.x, 1.62, HOT.z); this.scene.add(spring);
    this.springMat = spring.material;
    createSteam(this.scene, { x: HOT.x, y: 1.7, z: HOT.z, r: HOT.r });
    this.world.addColliders(createRockRing(this.scene, HOT, rand));

    // ---- the big igloo
    const big = makeIgloo(3.8, { ar: 1.35, lamp: true });
    const igY = T(IGLOO.x, IGLOO.z);
    big.group.position.set(IGLOO.x, igY, IGLOO.z); big.group.rotation.y = IGLOO.yaw;
    this.scene.add(big.group);
    this.world.addColliders(big.colliders(IGLOO.x, IGLOO.z, IGLOO.yaw, igY));
    this.igloos.push({ x: IGLOO.x, y: igY, z: IGLOO.z, r: big.r, big: true });
    // a sleepy snow pinky lives inside
    const sleepy = new Pillow({ scale: 0.55, color: '#f7fbff', variant: 2, name: 'Snowy', ink: '#5a7ab0' });
    // lying on its back for a nap
    sleepy.root.position.set(IGLOO.x - 1.7, igY + 0.08 + PINKY_LOOK.thickness * 0.55 * 0.5, IGLOO.z - 0.4);
    sleepy.root.rotation.order = 'YXZ'; sleepy.root.rotation.set(-Math.PI / 2, 1.9, 0);
    this.scene.add(sleepy.root);
    this.sleepy = sleepy;

    // ---- the ferry dock (south shore)
    let shoreZ = 60;
    for (let z = 50; z < 110; z += 0.5) if (T(0, z) < -0.3) { shoreZ = z; break; }
    this.buildDock(shoreZ);

    // ---- sled racks at the top of each hill
    for (const r of RACKS) this.buildRack(r);

    // ---- building spots (fresh, sparkly snow)
    for (const b of BUILD_SPOTS) this.buildSnowPatch(b);
    // a couple of ready-made ones to show how it's done
    this.placeBuild({ k: 'snowman', x: -19.5, z: 34.5, yaw: 0.4, pre: true });
    this.placeBuild({ k: 'pinky', x: 21.5, z: -1.5, yaw: -0.6, pre: true });
    this.placeBuild({ k: 'pinky', x: 22.5, z: 0.8, yaw: -0.9, pre: true, color: '#fff0f8' });
    for (const b of this.P.builds) this.placeBuild(b);

    // ---- Cocoa's hot-cocoa stand
    this.buildCocoaStand();

    // ---- animals
    const penguins = addPenguins(this.scene, this.terrain, { area: { x: ICE.x, z: ICE.z, r: ICE.r }, count: 7, slideOn: (x, z) => (Math.hypot(x - ICE.x, z - ICE.z) < ICE.r + 1 ? 0.06 : 0) });
    const bunnies = addSnowBunnies(this.scene, this.terrain, { area: { x: 34, z: -2, r: 20 }, count: 7, ok: (x, z) => T(x, z) > 1.3 && Math.hypot(x - HOT.x, z - HOT.z) > HOT.r + 1 });
    this.updaters.push((dt, ctx) => { penguins.update(dt, ctx); bunnies.update(dt, ctx); });
    this.creaturesList = [
      { name: 'Penguin', journalKey: 'penguin', near: (p) => penguins.list.some((q) => Math.hypot(q.x - p.x, q.z - p.z) < 7) },
      { name: 'Snow Bunny', journalKey: 'snowbunny', near: (p) => bunnies.list.some((q) => Math.hypot(q.x - p.x, q.z - p.z) < 6) },
    ];

    // ---- Frost the snow dragon
    this.buildFrost();

    // ---- magic snowflakes to find
    const flakes = [
      [HILL.x + 3, HILL.z + 3, 1.2], [IGLOO.x - 0.5, IGLOO.z + 0.5, 0.9], [ICE.x, ICE.z, 0.9], [HOT.x + 7.5, HOT.z - 4, 0.9],
      [SUGAR.x, SUGAR.z, 1.0], [50, 28.5, 1.4], [-64, -12, 1.0], [-6, -48, 1.0],
    ];
    g.state.totals.snowflake = flakes.length;
    flakes.forEach(([x, z, f], i) => this.addCollectible('snowflake', `sn-flake-${i}`, new THREE.Vector3(x, T(x, z), z), { float: f, scale: 1.3, journal: 'snowflake' }));

    // ---- signs
    const sign = (text, x, z, yaw, color) => { const s = createSign(text, { color }); s.position.set(x, T(x, z), z); s.rotation.y = yaw; this.scene.add(s); };
    sign('Welcome to\nSnowdrop Island!', ARRIVE.x + 4.5, ARRIVE.z - 1, -0.4, '#e8f6ff');
    sign('← Cold Snow', ARRIVE.x - 3.5, ARRIVE.z - 6, 0.3, '#e8f6ff');
    sign('Warm Snow →', ARRIVE.x + 3.5, ARRIVE.z - 6, -0.3, '#ffe3ee');
    sign('Big Sled Hill', RACKS[0].x + 2.5, RACKS[0].z + 1.5, 0.8, '#e8f6ff');

    // ---- map landmarks
    this.landmarks.push(
      { x: ARRIVE.x, z: shoreZ, icon: '⛵', label: 'Ferry', always: true },
      { x: HILL.x, z: HILL.z, icon: '🛷', label: 'Big Sled Hill' }, { x: SUGAR.x, z: SUGAR.z, icon: '🛷', label: 'Sugar Hill' },
      { x: IGLOO.x, z: IGLOO.z, icon: '🏠', label: 'Big Igloo' }, { x: ICE.x, z: ICE.z, icon: '🐧', label: 'Frozen Pond' },
      { x: HOT.x, z: HOT.z, icon: '♨️', label: 'Hot Spring' }, { x: COCOA.x, z: COCOA.z, icon: '☕', label: 'Cocoa’s Stand' },
      { x: FROST_HOME.x, z: FROST_HOME.z, icon: '❄️', label: 'Frost’s Nest' },
    );
    this.mapFeatures.push({ type: 'label', x: -45, z: -55, text: 'Cold Snow' }, { x: 45, z: -55, type: 'label', text: 'Warm Snow' });

    // ---- player
    const spawn = this.arriveAt || ARRIVE;
    this.setupPlayer(new THREE.Vector3(spawn.x, 0, spawn.z), Math.PI);
    if (g.state.pinky?.cape) this.player.setCape(true);
    // inside an igloo the camera must stay under the dome
    const blocked = this.rig.blocked;
    this.rig.blocked = (x, y, z) => {
      const ig = this.inIgloo;
      if (ig && Math.hypot(x - ig.x, y - ig.y, z - ig.z) > ig.r - 0.35) return true;
      return blocked(x, y, z);
    };
  }

  _mountains(rand) {
    const group = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, flatShading: true });
    const base = new THREE.Color('#9fb2d8'), snow = new THREE.Color('#ffffff');
    for (let i = 0; i < 18; i++) {
      const a = -Math.PI * 0.95 + (i / 17) * Math.PI * 0.9 + (rand() - 0.5) * 0.1;
      const dist = 260 + rand() * 90, h = 50 + rand() * 80;
      const geo = new THREE.ConeGeometry(h * (0.8 + rand() * 0.4), h, 7, 3);
      const p = geo.attributes.position, c = [];
      for (let k = 0; k < p.count; k++) { const t = (p.getY(k) + h / 2) / h; const col = base.clone().lerp(snow, smoothstep(0.35, 0.6, t)); c.push(col.r, col.g, col.b); }
      geo.setAttribute('color', new THREE.Float32BufferAttribute(c, 3));
      const m = new THREE.Mesh(geo, mat);
      m.position.set(Math.cos(a) * dist, h / 2 - 8, Math.sin(a) * dist);
      group.add(m);
    }
    return group;
  }

  buildDock(shoreZ) {
    const g = this.game, T = (x, z) => this.terrain.getHeight(x, z);
    const wood = new THREE.MeshStandardMaterial({ color: '#b8875a', roughness: 0.9 });
    const z0 = shoreZ - 6, z1 = shoreZ + 9, top = 1.15;
    const deck = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.2, z1 - z0), wood);
    deck.position.set(0, top - 0.1, (z0 + z1) / 2); deck.castShadow = deck.receiveShadow = true; this.scene.add(deck);
    for (let z = z0 + 0.5; z < z1; z += 2.4) for (const sx of [-1, 1]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 4, 8), wood); post.position.set(sx * 1.2, top - 2, z); this.scene.add(post);
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.12, 8), new THREE.MeshStandardMaterial({ color: '#ffffff' })); cap.position.set(sx * 1.2, top + 0.06, z); this.scene.add(cap);
    }
    this.world.addColliders([{ type: 'box', x: 0, z: (z0 + z1) / 2, hw: 1.3, hd: (z1 - z0) / 2, top, bottom: -3 }]);
    const boat = makeFerry();
    boat.position.set(2.6, 0.35, z1 - 2); this.scene.add(boat);
    this.ferry = boat;
    this.ferryEnd = new THREE.Vector3(0.5, top, z1 - 1.5);
    this.dockSpawn = { x: 0, z: z0 + 2 };
    this.addInteractable({ pos: () => this.ferryEnd, radius: 3.2, label: 'Sail home to Pinky Land 🌸', action: () => g.leaveSnowIsland() });
    this.mapFeatures.push({ type: 'rock', x: 0, z: (z0 + z1) / 2, r: 1.5 });
  }

  buildRack(r) {
    const T = (x, z) => this.terrain.getHeight(x, z), y = T(r.x, r.z);
    const rack = new THREE.Group();
    const wood = new THREE.MeshStandardMaterial({ color: '#8a5a3c', roughness: 0.9 });
    for (const sx of [-1.4, 1.4]) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 1.3, 8), wood); p.position.set(sx, 0.65, 0); p.castShadow = true; rack.add(p); }
    const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 3, 8), wood); bar.rotation.z = Math.PI / 2; bar.position.y = 1.2; rack.add(bar);
    ['#e8384f', '#3a7bd5', '#ff7fb0'].forEach((c, i) => { const s = makeSled(c); s.rotation.x = -1.25; s.position.set(-0.9 + i * 0.9, 0.62, -0.25); rack.add(s); });
    rack.position.set(r.x, y, r.z); rack.rotation.y = r.yaw;
    this.scene.add(rack);
    this.world.addColliders([{ type: 'box', x: r.x, z: r.z, hw: 1.5, hd: 0.3, top: y + 1.25, bottom: y - 1, rot: r.yaw, noStand: true }]);
    this.addInteractable({ pos: new THREE.Vector3(r.x + Math.sin(r.yaw) * 1.2, y, r.z + Math.cos(r.yaw) * 1.2), radius: 2.6, label: 'Take a sled 🛷', action: () => this.startSled(r) });
  }

  buildSnowPatch(b) {
    const T = (x, z) => this.terrain.getHeight(x, z), y = T(b.x, b.z);
    const warm = this.warmth(b.x) > 0.5;
    // a soft pile of fresh snow with a little wooden shovel stuck in it
    const pile = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: warm ? '#fff5fa' : '#ffffff', roughness: 1, emissive: warm ? '#ffd6ec' : '#cfe4ff', emissiveIntensity: 0.18 }));
    pile.scale.set(1.3, 0.55, 1.0); pile.position.set(b.x, y - 0.05, b.z); pile.castShadow = pile.receiveShadow = true; this.scene.add(pile);
    const shovel = new THREE.Group();
    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 1.0, 6), new THREE.MeshStandardMaterial({ color: '#b8794a' })); handle.position.y = 0.5; shovel.add(handle);
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.32, 0.04), new THREE.MeshStandardMaterial({ color: warm ? '#ff7fb0' : '#3a7bd5' })); blade.position.y = 0.05; shovel.add(blade);
    shovel.position.set(b.x + 0.6, y + 0.35, b.z + 0.2); shovel.rotation.set(0.2, 0.4, -0.35); this.scene.add(shovel);
    this.addInteractable({ pos: new THREE.Vector3(b.x, y, b.z), radius: 3.2, label: 'Build in the snow ⛄', action: () => this.buildMenu(b) });
  }

  buildCocoaStand() {
    const g = this.game, T = (x, z) => this.terrain.getHeight(x, z), y = T(COCOA.x, COCOA.z);
    const stand = new THREE.Group();
    const wood = new THREE.MeshStandardMaterial({ color: '#b8794a', roughness: 0.9 });
    const counter = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.0, 0.9), wood); counter.position.y = 0.5; counter.castShadow = true; stand.add(counter);
    for (const sx of [-1.2, 1.2]) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 2.4, 8), wood); p.position.set(sx, 1.2, -0.35); stand.add(p); }
    // striped awning
    for (let i = 0; i < 6; i++) { const s = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.06, 1.3), new THREE.MeshStandardMaterial({ color: i % 2 ? '#ffffff' : '#ff7fb0' })); s.position.set(-1.15 + i * 0.46, 2.35, -0.05); s.rotation.x = 0.25; stand.add(s); }
    for (let i = 0; i < 4; i++) {
      const mug = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.08, 0.18, 12), new THREE.MeshStandardMaterial({ color: ['#ffd1e3', '#cfe3ff', '#fff1c2', '#e3d4ff'][i] }));
      mug.position.set(-0.9 + i * 0.6, 1.1, 0.15); stand.add(mug);
      const cocoa = new THREE.Mesh(new THREE.CircleGeometry(0.075, 12).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#6b3f25' })); cocoa.position.set(-0.9 + i * 0.6, 1.19, 0.15); stand.add(cocoa);
      const marsh = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.04, 0.05), new THREE.MeshStandardMaterial({ color: '#ffffff' })); marsh.position.set(-0.88 + i * 0.6, 1.21, 0.16); stand.add(marsh);
    }
    stand.position.set(COCOA.x, y, COCOA.z); stand.rotation.y = Math.PI * 0.85;
    this.scene.add(stand);
    this.world.addColliders([{ type: 'box', x: COCOA.x, z: COCOA.z, hw: 1.3, hd: 0.45, top: y + 1.0, bottom: y - 1, rot: Math.PI * 0.85 }]);
    const sign = createSign('Hot\nCocoa ☕', { color: '#ffe3ee' }); sign.position.set(COCOA.x + 2.2, y, COCOA.z - 1.2); sign.rotation.y = Math.PI * 0.85; this.scene.add(sign);
    // Cocoa herself: a warm, toasty-brown pinky
    const ax = COCOA.x - Math.sin(Math.PI * 0.85) * 1.3, az = COCOA.z - Math.cos(Math.PI * 0.85) * 1.3;
    this.cocoa = this.addNPC(new NPC(new Pillow({ scale: 0.6, color: '#e7b99a', variant: 4, name: 'Cocoa', ink: '#6a3a2a' }), this.world, { x: ax, z: az, yaw: Math.PI * 0.85 + Math.PI, name: 'Cocoa', journalKey: 'cocoa' }));
    this.cocoa.lookAtPlayer = true;
    const met = (k) => this.P.met.includes(k);
    this.addInteractable({ pos: () => this.cocoa.root.position, radius: 2.8, label: 'Talk to Cocoa', action: async () => {
      this.journalCheck('cocoa', 'Cocoa');
      await g.ui.dialogue(met('cocoa') ? [
        line(COCOA_V, 'Another mug? Here you go — extra marshmallows! ☕'),
        line(COCOA_V, 'Try the Big Sled Hill on the cold side. Frost the snow dragon lives at the very top!'),
      ] : [
        line(COCOA_V, 'Welcome to Snowdrop Island! I’m Cocoa. Would you like some hot cocoa? It’s nice and toasty!'),
        line(J, 'Yes please! Pinky, this island is SO pretty.'),
        line(COCOA_V, 'Over on the WEST side the snow is real and cold — brrr! Pull your hood up. That’s where the Big Igloo and the penguins are.'),
        line(COCOA_V, 'Here on the EAST side the snow is magic: it’s WARM! It sparkles and never makes your fingers cold.'),
        line(PINKY, 'Warm snow?! We could build a snow pinky without mittens!'),
        line(COCOA_V, 'Exactly! Find a snow pile with a shovel and build a snowman, a snow pinky, or even an igloo you can go inside.'),
        line(COCOA_V, 'And grab a sled from the top of a hill. Wheee!'),
      ]);
      this.meet('cocoa');
    } });
  }

  buildFrost() {
    const g = this.game, S = this.scene, W = this.world, T = (x, z) => this.terrain.getHeight(x, z);
    const nest = new THREE.Mesh(new THREE.TorusGeometry(2.3, 0.6, 10, 28), new THREE.MeshStandardMaterial({ color: '#e6f1ff', roughness: 1 }));
    nest.rotation.x = Math.PI / 2; nest.scale.z = 0.6; nest.position.set(FROST_HOME.x, T(FROST_HOME.x, FROST_HOME.z) + 0.15, FROST_HOME.z); S.add(nest);
    const frost = new WesternDragon(S, W, { home: FROST_HOME, yaw: 0.8, roam: { x: 0, z: -5, r: 50 }, look: FROST_LOOK, info: DRAGON_INFO.frost });
    W.addBody({ pos: frost.pos, r: 2.0, h: 2.4, active: () => frost.state === 'rest' });
    this.frost = frost;
    this.dragons = [frost];
    this.updaters.push((dt, ctx) => frost.update(dt, ctx));
    const met = (k) => this.P.met.includes(k);
    this.addInteractable({
      pos: () => frost.talkPos(), radius: 5, enabled: () => frost.canTalk,
      label: () => (met('dragon-frost') ? 'Talk to Frost · ride 🐉' : 'Talk to Frost'),
      action: async () => {
        this.journalCheck('dragon-frost', 'Frost'); frost.puffSparkles();
        const v = await g.ui.dialogue([...(met('dragon-frost') ? [
          line(FROST_V, 'Hello again, snow friend! Did you see my snowflake puff? Every one is different!'),
        ] : [
          line(FROST_V, 'Ooh! Visitors! Hello, hello! I’m Frost. *puff* — oops, snowflakes. I sneeze snowflakes when I’m excited.'),
          line(FROST_V, 'In stories from snowy mountains, there are dragons made of ice and wind. I’m the cuddly kind.'),
          line(J, 'You’re SO fluffy! Pinky, it’s a snow dragon! That’s a new kind for my Dragon Quest!'),
          line(FROST_V, 'I love sledding down my hill on my tummy. Want to try the sleds? They’re just over there!'),
        ]), line(FROST_V, 'Shall I fly you over the island? The view of the northern lights is the best from up high!', { choices: [{ text: '🐉 Yes! Let’s go!', value: 'ride' }, { text: 'Maybe later', value: 'no' }] })]);
        this.meet('dragon-frost');
        if (v === 'ride') this.startRide(frost);
      },
    });
  }

  meet(key) {
    if (this.P.met.includes(key)) return;
    this.P.met.push(key); this.game.saveGame();
    if (DRAGON_KINDS.some((k) => k.key === key)) dragonFound(this, key);
  }

  // ---------------------------------------------------------------- building in the snow
  async buildMenu(spot) {
    const g = this.game;
    const v = await g.ui.dialogue([line(PINKY, 'What shall we build?', { choices: [
      { text: '⛄ A snowman', value: 'snowman' }, { text: '🩷 A snow pinky', value: 'pinky' }, { text: '🏠 An igloo', value: 'igloo' }, { text: 'Not now', value: null },
    ] })]);
    if (!v) return;
    const P = this.player;
    const dist = v === 'igloo' ? 5.5 : 2.4;
    let yaw = P.yaw, x = P.pos.x + Math.sin(yaw) * dist, z = P.pos.z + Math.cos(yaw) * dist;
    // don't build on top of something else, in the sea, or right on the snow pile
    const free = (x, z) => this.terrain.getHeight(x, z) > 1.0 && Math.hypot(x - spot.x, z - spot.z) > (v === 'igloo' ? 5 : 1.8) &&
      this.builds.every((b) => Math.hypot(b.x - x, b.z - z) > (b.k === 'igloo' || v === 'igloo' ? 6.5 : 1.6));
    for (let k = 0; k < 16 && !free(x, z); k++) { yaw += 0.8; x = P.pos.x + Math.sin(yaw) * (dist + k * 0.3); z = P.pos.z + Math.cos(yaw) * (dist + k * 0.3); }
    if (!free(x, z)) { g.ui.say('There’s not enough room here. Let’s find a bigger patch of snow!', 3); return; }
    // the door / face looks back toward Jacinta
    const face = Math.atan2(P.pos.x - x, P.pos.z - z);
    const b = { k: v, x: +x.toFixed(2), z: +z.toFixed(2), yaw: +face.toFixed(2) };
    this.P.builds.push(b);
    // melt the oldest one when there are lots
    while (this.P.builds.length > MAX_BUILDS) {
      const old = this.P.builds.shift();
      const i = this.builds.findIndex((o) => !o.pre && o.x === old.x && o.z === old.z);
      if (i >= 0) { const o = this.builds[i]; this.scene.remove(o.obj); this.builds.splice(i, 1); if (o.colliders) this.world.colliders = this.world.colliders.filter((c) => !o.colliders.includes(c)); }
    }
    this.placeBuild(b, true);
    g.audio.collect?.();
    this.journalCheck({ snowman: 'snowman', pinky: 'snowpinky', igloo: 'igloo' }[v], { snowman: 'Snowman', pinky: 'Snow Pinky', igloo: 'Igloo' }[v]);
    g.ui.say({ snowman: 'Roll, roll, roll… a snowman! ⛄', pinky: 'A snow pinky! It looks just like me! 🩷', igloo: 'Block by block… an igloo! Let’s go inside! 🏠' }[v], 3);
    g.saveGame();
  }

  placeBuild(b, animate = false) {
    const T = (x, z) => this.terrain.getHeight(x, z), y = T(b.x, b.z);
    const warm = this.warmth(b.x) > 0.5;
    let obj, colliders = null;
    if (b.k === 'snowman') {
      obj = makeSnowman({ warm, seed: Math.floor(Math.abs(b.x * 13 + b.z * 7)) + 1 });
      colliders = [{ type: 'cyl', x: b.x, z: b.z, r: 0.55, top: y + 1.0, bottom: y - 1 }];
    } else if (b.k === 'pinky') {
      const p = new Pillow({ scale: b.pre ? 0.85 : 0.8, color: b.color || (warm ? '#fff3fa' : '#f7fbff'), variant: Math.floor(Math.abs(b.x + b.z)) % 6, name: 'Snow Pinky', ink: warm ? '#d0508a' : '#4a6aa8' });
      p.update?.(0.016);
      obj = p.root;
      colliders = [{ type: 'cyl', x: b.x, z: b.z, r: 0.45, top: y + 0.9, bottom: y - 1 }];
    } else {
      const ig = makeIgloo(2.6, { ar: 1.25, lamp: false });
      obj = ig.group;
      colliders = ig.colliders(b.x, b.z, b.yaw, y);
      this.igloos.push({ x: b.x, y, z: b.z, r: ig.r });
    }
    obj.position.set(b.x, y, b.z); obj.rotation.y = b.yaw;
    this.scene.add(obj);
    if (colliders) this.world.addColliders(colliders);
    const rec = { ...b, obj, colliders };
    this.builds.push(rec);
    if (animate) {
      // grow out of the snow with a soft puff
      rec.grow = 0; obj.scale.setScalar(0.01);
      this.spawnBurst(new THREE.Vector3(b.x, y + 0.6, b.z), '#ffffff');
      // keep the player from getting stuck inside a fresh igloo wall
      if (b.k === 'igloo') { const P = this.player.pos; const d = Math.hypot(P.x - b.x, P.z - b.z); if (d > 1.8 && d < 4) { const a = Math.atan2(P.x - b.x, P.z - b.z); P.x = b.x + Math.sin(a) * 4.2; P.z = b.z + Math.cos(a) * 4.2; } }
    }
  }

  // ---------------------------------------------------------------- sledding
  startSled(rack) {
    const g = this.game, P = this.player;
    const sled = makeSled(['#e8384f', '#3a7bd5', '#ff7fb0'][Math.floor(Math.random() * 3)]);
    const fx = Math.sin(rack.yaw), fz = Math.cos(rack.yaw);
    const x = rack.x + fx * 2.4, z = rack.z + fz * 2.4;
    this.scene.add(sled);
    this.riding = { kind: 'sled', sled, x, z, yaw: rack.yaw, vx: fx * 1.5, vz: fz * 1.5, t: 0, still: 0, rack };
    this._rideDist = this.rig.targetDistance;
    this.rig.targetDistance = 6.5;
    P.model.anim.sit = true;
    for (const f of this.followers) f.root.visible = false;
    if (!this.P.sledded) { this.P.sledded = true; g.ui.toast('🛷', '<b>Sledding!</b> A D steer · W push · S brake · E hop off'); }
    this.journalCheck('sledding', 'Sledding');
  }

  rideUpdate(dt) { if (this.riding?.kind === 'sled') this.sledUpdate(dt); else RideMixin.rideUpdate.call(this, dt); }
  rideSeat() { if (this.riding?.kind === 'sled') this.sledSeat(); else RideMixin.rideSeat.call(this); }
  endRide() { if (this.riding?.kind === 'sled') this.endSled(); else RideMixin.endRide.call(this); }

  sledUpdate(dt) {
    const r = this.riding, inp = this.game.input, W = this.world;
    dt = Math.min(dt, 1 / 20);
    r.t += dt;
    if (inp.hit('KeyE', 'Pad_interact', 'Enter') && r.t > 0.3) { this.endSled(); return; }
    let steer = 0, push = 0;
    if (inp.down('KeyA', 'ArrowLeft')) steer += 1;
    if (inp.down('KeyD', 'ArrowRight')) steer -= 1;
    if (inp.down('KeyW', 'ArrowUp')) push += 1;
    if (inp.down('KeyS', 'ArrowDown')) push -= 1;
    if (inp.padState) { steer -= inp.padState.lx; push -= inp.padState.ly; }
    steer = clamp(steer, -1, 1); push = clamp(push, -1, 1);
    // gravity pulls the sled downhill
    const sl = W.slope(r.x, r.z);
    const g = 9.8 * 0.85;
    r.vx -= (sl.x / Math.sqrt(1 + sl.s * sl.s)) * g * dt;
    r.vz -= (sl.z / Math.sqrt(1 + sl.s * sl.s)) * g * dt;
    let sp = Math.hypot(r.vx, r.vz);
    // steering turns the sled (and the way it's sliding)
    if (sp > 0.4) r.yaw = Math.atan2(r.vx, r.vz);
    const turn = steer * 1.6 * dt * Math.min(1, sp / 3 + 0.3);
    r.yaw += turn;
    // runners grip: most of the speed follows where the sled points
    const fx = Math.sin(r.yaw), fz = Math.cos(r.yaw);
    const along = r.vx * fx + r.vz * fz;
    r.vx = lerp(r.vx, fx * along, Math.min(1, dt * 5)); r.vz = lerp(r.vz, fz * along, Math.min(1, dt * 5));
    // a little push when slow, braking, and snow friction
    if (push > 0 && sp < 5) { r.vx += fx * 3 * dt; r.vz += fz * 3 * dt; }
    const fr = push < 0 ? 2.5 : 0.14 + 0.55 * (1 - smoothstep(0.03, 0.14, sl.s));
    const k = Math.max(0, 1 - fr * dt);
    r.vx *= k; r.vz *= k;
    sp = Math.hypot(r.vx, r.vz);
    if (sp > 17) { r.vx *= 17 / sp; r.vz *= 17 / sp; sp = 17; }
    const ox = r.x, oz = r.z;
    r.x += r.vx * dt; r.z += r.vz * dt;
    // bump into trees and rocks: bounce off and lose speed
    const p = new THREE.Vector3(r.x, this.terrain.getHeight(r.x, r.z), r.z);
    W.collide(p, 0.45, 1.0);
    if (Math.hypot(p.x - r.x, p.z - r.z) > 0.01) { r.x = p.x; r.z = p.z; r.vx = (r.x - ox) / dt * 0.3; r.vz = (r.z - oz) / dt * 0.3; this.game.audio.bump?.(); }
    // stop at the sea's edge
    if (this.terrain.getHeight(r.x, r.z) < 0.3) { r.x = ox; r.z = oz; r.vx *= -0.2; r.vz *= -0.2; }
    // the little speed "wheee!"
    if (sp > 11 && (!this._wheeT || this.time - this._wheeT > 6)) { this._wheeT = this.time; this.game.ui.say('Wheeeee! 🛷', 1.5); }
    this.sledSeat();
    this.player.forwardMoving = sp > 1;
    if (!inp.mouse.dragging) this.rig.yaw = angleDamp(this.rig.yaw, r.yaw + Math.PI, 2.5, dt);
    // kick up snow behind
    if (sp > 4 && Math.random() < dt * sp) this.spawnBurst?.(new THREE.Vector3(r.x - fx * 0.7, this.terrain.getHeight(r.x, r.z) + 0.1, r.z - fz * 0.7), '#ffffff');
    this.game.ui.prompt(sp < 0.5 ? 'E: hop off · W: push' : 'E: hop off');
  }

  sledSeat() {
    const r = this.riding, P = this.player, T = this.terrain;
    const y = T.getHeight(r.x, r.z);
    // tilt the sled to match the hill
    const n = T.getNormal(r.x, r.z);
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), n);
    r.sled.position.set(r.x, y, r.z);
    r.sled.quaternion.copy(q).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), r.yaw));
    const seat = new THREE.Vector3(0, 0.27, -0.1).applyQuaternion(r.sled.quaternion).add(r.sled.position);
    P.pos.copy(seat);
    P.pos.y -= P.model.dims ? P.model.dims.shin * P.model.body.scale.y : 0;
    P.vel.set(0, 0, 0);
    P.yaw = r.yaw; P.root.rotation.set(0, r.yaw, 0);
    P.model.anim.speed = 0; P.model.anim.grounded = true; P.model.anim.sit = true;
  }

  endSled() {
    const r = this.riding; if (!r) return;
    const P = this.player;
    this.riding = null;
    P.model.anim.sit = false;
    for (const f of this.followers) { f.root.visible = true; f.place?.(P.pos.x + 1, P.pos.z + 1); }
    this.rig.targetDistance = this._rideDist || 7;
    const side = new THREE.Vector3(Math.cos(r.yaw), 0, -Math.sin(r.yaw));
    P.pos.set(r.x + side.x * 1.0, 0, r.z + side.z * 1.0);
    P.pos.y = this.world.groundHeight(P.pos.x, P.pos.z) + 0.05;
    // the sled zooms back up to its rack by magic
    this.spawnBurst(r.sled.position.clone().add(new THREE.Vector3(0, 0.4, 0)), '#ffffff');
    this.scene.remove(r.sled);
  }

  // ---------------------------------------------------------------- every frame
  update(dt) {
    const g = this.game;
    this.baseUpdate(dt);
    const P = this.player, p = P.pos;
    this.weather.update(g.engine.camera);
    // cold side: hood up and leg warmers on; warm side: toasty
    const cold = this.warmth(p.x) < 0.5 || this.dayNight.isChilly();
    for (const m of Object.values(g.avatarModels)) m.setChilly?.(cold && !this.inIgloo);
    // inside an igloo the camera comes in close
    const ig = this.igloos.find((o) => Math.hypot(p.x - o.x, p.z - o.z) < o.r - 0.3);
    if (!!ig !== !!this.inIgloo && !this.riding) {
      this.inIgloo = ig || null;
      if (ig) { this._outDist = this.rig.targetDistance; this.rig.targetDistance = Math.min(2.4, ig.r * 0.7); this.rig.pitch = Math.min(this.rig.pitch, 0.2); this.journalCheck('igloo', 'Igloo'); if (ig.big && !this._bigSaid) { this._bigSaid = true; g.ui.say('It’s so cosy in here! Shh… a little snow pinky is napping. 💤', 4); } }
      else this.rig.targetDistance = this._outDist || 7;
    }
    // the hot spring is lovely and warm
    if (Math.hypot(p.x - HOT.x, p.z - HOT.z) < HOT.r && !this._hotSaid) { this._hotSaid = true; g.ui.say('Ahhh… the hot spring is lovely and warm! ♨️', 3); this.journalCheck('hotspring', 'Hot Spring'); }
    // fresh builds grow out of the snow
    for (const b of this.builds) if (b.grow !== undefined && b.grow < 1) { b.grow = Math.min(1, b.grow + dt * 1.3); const t = b.grow; b.obj.scale.setScalar(Math.max(0.01, 1 + Math.sin(t * Math.PI) * 0.15 * (1 - t) - (1 - t) * (1 - t))); }
    // the boat bobs on the waves
    if (this.ferry) { this.ferry.position.y = 0.3 + Math.sin(this.time * 1.3) * 0.06; this.ferry.rotation.z = Math.sin(this.time * 0.9) * 0.03; }
    // animal sightings
    if (Math.floor(this.time * 2) !== this._seeTick) {
      this._seeTick = Math.floor(this.time * 2);
      for (const c of this.creaturesList) if (!g.state.journal.includes(c.journalKey) && c.near(p)) this.journalCheck(c.journalKey, c.name);
    }
    // counter: snowflakes and dragons
    const n = g.state.counts.snowflake || 0, dk = dragonsMet(g.state).length;
    const counter = `❄️ ${n} / ${g.state.totals.snowflake || 8}` + (dk ? ` · 🐉 ${dk} / ${DRAGON_KINDS.length}` : '');
    if (counter !== this._counter) { this._counter = counter; g.ui.setCounter(counter); }
    g.state.lastSnowPos = { x: p.x, z: p.z };
  }

  async arrive() {
    const g = this.game;
    if (this.P.visited) { g.ui.say('Back on Snowdrop Island! ❄️', 3); return; }
    this.P.visited = true;
    g.ui.chapter('Snowdrop Island', 'cold snow · warm snow', 4);
    await new Promise((r) => setTimeout(r, 1800));
    await g.ui.dialogue([
      line(J, 'Pinky, look! SNOW! A whole island of it!'),
      line(PINKY, 'Snowdrop Island! On one side the snow is real and cold… and on the other side it’s magic warm snow!'),
      line(J, 'We can go sledding! And build snowmen! And igloos!'),
      line(PINKY, 'Let’s find Cocoa at her hot-cocoa stand on the warm side — she knows everything about this island. ☕'),
    ]);
    g.saveGame();
  }

  availableAvatars() { return ['jacinta', 'pinky', 'jacintaPack', 'liev', 'bellybutton']; }

  getHint() {
    const met = (k) => this.P.met.includes(k);
    if (!met('cocoa')) return { text: 'Cocoa has a hot-cocoa stand on the warm side. Let’s say hello!', target: this.cocoa.root.position.clone() };
    if (!met('dragon-frost')) {
      if (this.frost.canTalk) return { text: 'Frost the snow dragon lives at the very top of the Big Sled Hill!', target: this.frost.pos.clone() };
      return { text: 'Frost is flying around the island. He always comes back to his nest on top of the Big Sled Hill.', target: new THREE.Vector3(FROST_HOME.x, HILL.h, FROST_HOME.z) };
    }
    if (!this.P.sledded) return { text: 'Grab a sled from the rack at the top of the Big Sled Hill. Wheee!', target: new THREE.Vector3(RACKS[0].x, HILL.h, RACKS[0].z) };
    if (!this.P.builds.length) { const b = BUILD_SPOTS[2]; return { text: 'Find a snow pile with a shovel and build a snowman, a snow pinky or an igloo!', target: new THREE.Vector3(b.x, 2, b.z) }; }
    if (!this.game.state.journal.includes('igloo')) return { text: 'The Big Igloo is on the cold side. You can walk right inside!', target: new THREE.Vector3(IGLOO.x, 2, IGLOO.z) };
    const left = this.collectibles.filter((c) => !c.taken);
    left.sort((a, b) => a.obj.position.distanceTo(this.player.pos) - b.obj.position.distanceTo(this.player.pos));
    if (left[0]) return { text: 'A Magic Snowflake is sparkling somewhere nearby!', target: left[0].obj.position.clone() };
    return { text: 'You found every Magic Snowflake! Snowdrop Island loves you. ❄️💗', target: null };
  }

  mapMarkers() {
    const m = [...this.landmarks];
    if (this.P.met.includes('cocoa')) m.push({ x: this.cocoa.root.position.x, z: this.cocoa.root.position.z, icon: '🩷', label: 'Cocoa' });
    for (const b of this.builds) m.push({ x: b.x, z: b.z, icon: { snowman: '⛄', pinky: '🩷', igloo: '🏠' }[b.k], label: '' });
    return m;
  }

  mapColor(x, z, h, out) {
    if (h < 0) { out.set('#9ad8f0').lerp(new THREE.Color('#4f8fd3'), smoothstep(0, 7, -h)); return; }
    const w = this.warmth(x);
    out.set('#eef5ff').lerp(new THREE.Color('#ffeaf3'), w);
    if (h > 6) out.lerp(new THREE.Color('#ffffff'), 0.5);
    if (Math.hypot(x - ICE.x, z - ICE.z) < ICE.r) out.set('#bfe0ff');
    if (Math.hypot(x - HOT.x, z - HOT.z) < HOT.r) out.set('#7fe6e0');
  }

  nearWaterAmount(p) { return Math.max(0, 1 - Math.max(0, SR - 18 - Math.hypot(p.x, p.z)) / 15); }
}

Object.assign(SnowIslandLevel.prototype, Object.fromEntries(Object.entries(RideMixin).filter(([k]) => !['rideUpdate', 'rideSeat', 'endRide'].includes(k))));

// smooth stones around the hot spring (you can sit on them)
function createRockRing(scene, c, rand) {
  const mat = new THREE.MeshStandardMaterial({ color: '#b9a6c2', roughness: 0.9, flatShading: true });
  const colliders = [];
  const n = 18;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + rand() * 0.1;
    const x = c.x + Math.cos(a) * (c.r + 0.6), z = c.z + Math.sin(a) * (c.r + 0.6);
    const s = 0.45 + rand() * 0.35;
    const m = new THREE.Mesh(new THREE.DodecahedronGeometry(s, 1), mat);
    m.scale.y = 0.6; m.position.set(x, 1.85, z); m.castShadow = true; m.rotation.y = rand() * 6;
    scene.add(m);
    // a gap on the side facing Cocoa's stand so you can wade in
    if (Math.abs(a - 2.1) < 0.4) { scene.remove(m); continue; }
    colliders.push({ type: 'cyl', x, z, r: s * 0.9, top: 1.85 + s * 0.5, bottom: 0 });
  }
  return colliders;
}
