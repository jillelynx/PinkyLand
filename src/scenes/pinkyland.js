// Chapter 2 — Pinky Land: a dreamy island with a flower meadow, a clear pond
// with a waterfall, bouncy clouds, a coral reef, a campfire and pinky friends.
import * as THREE from 'three';
import { Level } from './level.js';
import { Terrain, sharedUniforms } from '../world/terrain.js';
import { World } from '../world/world.js';
import { Water } from '../world/water.js';
import { Clouds } from '../world/clouds.js';
import { createGrass, createFlowers, createTrees, createBushes, createRocks } from '../world/vegetation.js';
import { Campfire, createTent, Waterfall, createLilyPads, createCoral, createSign } from '../world/props.js';
import { Creatures } from '../world/creatures.js';
import { Pillow, PINKY_LOOK } from '../characters/pinky.js';
import { addSeaLife, addBioluminescence } from '../world/sealife.js';
import { addForestFriends } from '../world/forestFriends.js';
import { RideMixin } from './riding.js';
import { makeFerry } from '../world/snowStuff.js';
import { DRAGON_KINDS, dragonsMet, dragonFound } from './dragonQuest.js';
import { NPC } from '../characters/npc.js';
import { WesternDragon, ChineseDragon, FeatheredSerpent, NordicSerpent, BellyButton, addDragonWings } from '../world/dragons.js';
import { makeNoise2D, makeRandom, smoothstep, fbm, lerp, clamp, damp, angleDamp } from '../util/noise.js';

const R = 118;
const POND = { x: 22, z: 22, r: 15 };
// Rainbow Falls: where the cliff face is (z) and where its stream starts
const FALLS = { face: POND.z + 15, spring: POND.z + 31, lip: 10.18 };
const CAMP = { x: -20, z: -6 };
const ARRIVE = { x: -4, z: -36 };
// Moonview Cliff: a high headland on the east coast that looks out over the sea, where the
// moon rises and the northern lights shimmer (and both are reflected in the water)
const CLIFF_DIR = { x: Math.sin(1.22), z: -Math.cos(1.22) }; // pointing out to sea, a little north of east
const CLIFF_TOP = 12;
const CLIFF = { x: CLIFF_DIR.x * 84, z: CLIFF_DIR.z * 84 }; // the camp on top
const cliffS = (x, z) => x * CLIFF_DIR.x + z * CLIFF_DIR.z; // distance out toward the sea
const cliffT = (x, z) => -x * CLIFF_DIR.z + z * CLIFF_DIR.x; // distance sideways
// homes of the friendly dragons (kept clear of trees)
const EMBER_HOME = { x: 50, z: -46 };
const LANTERN_HILL = { x: -62, z: -50 };
const SUN_STEPS = { x: 60, z: 16 };
const DRAGON_SPOTS = [EMBER_HOME, LANTERN_HILL, SUN_STEPS];
const PINKY = { who: 'Pinky', color: '#f08aa8', pitch: 1.4 };
const J = { who: 'Jacinta', color: '#ff6fa8', pitch: 1.2 };
const L = { who: 'Liev', color: '#2f7de1', pitch: 0.95 };
const line = (who, text, extra = {}) => ({ ...who, text, ...extra });

export class PinkyLandLevel extends Level {
  constructor(game) {
    super(game, 'pinky');
    const s = game.state;
    s.pinky = s.pinky || { arrived: false, met: [], cape: false, tent: false };
    this.P = s.pinky;
    this.rideEdge = R + 10; // dragons turn back near the edge of the sea
  }

  height(x, z) {
    const n = this.noise;
    const r = Math.hypot(x, z) + n(x * 0.01, z * 0.01) * 14;
    const mask = 1 - smoothstep(R - 28, R, r);
    const inland = smoothstep(25, 75, Math.hypot(x, z));
    let land = 2.7 + fbm(n, x * 0.012, z * 0.012, 4) * 3.2 * (0.5 + inland) + Math.max(0, n(x * 0.006 + 5, z * 0.006 - 3)) * 16 * inland;
    // reef shelf on the south side
    const south = smoothstep(-10, 40, z);
    const seaFloor = lerp(-10, -2.4 + n(x * 0.05, z * 0.05) * 0.6, south * (1 - smoothstep(R + 10, R + 40, r)));
    let h = lerp(seaFloor, land, mask);
    // the pond
    const pd = Math.hypot(x - POND.x, z - POND.z) + n(x * 0.08, z * 0.08) * 1.5;
    h = lerp(h, -3.8 + pd * 0.05, 1 - smoothstep(POND.r - 6, POND.r + 1, pd));
    // a deep plunge pool where Rainbow Falls lands, joined to the pond
    const poolD = Math.hypot((x - POND.x) * 0.8, z - (POND.z + 13));
    h = lerp(h, Math.min(h, -2.2), 1 - smoothstep(3.0, 7.0, poolD));
    // waterfall cliff north of the pond: a steep rock face right behind the pool
    const cliff = smoothstep(FALLS.face - 0.6, FALLS.face + 0.6, z) * (1 - smoothstep(14, 26, Math.abs(x - POND.x))) * (1 - smoothstep(66, 80, z));
    h = Math.max(h, lerp(h, 10.5 + n(x * 0.1, z * 0.1) * 0.4, cliff));
    // the stream's channel across the top of the cliff, starting at a little spring
    const along = smoothstep(FALLS.face + 0.4, FALLS.face + 1.2, z) * (1 - smoothstep(FALLS.spring - 0.5, FALLS.spring + 2.5, z));
    const chan = (1 - smoothstep(1.6, 2.7, Math.abs(x - POND.x))) * along;
    const spring = 1 - smoothstep(2.0, 3.4, Math.hypot(x - POND.x, z - FALLS.spring));
    h = lerp(h, Math.min(h, 9.7), Math.max(chan, spring * cliff));
    // Moonview Cliff headland: a gentle ramp up from inland, a flat top, then a sheer drop to the sea
    {
      const cs = cliffS(x, z), ct = Math.abs(cliffT(x, z)) + n(x * 0.07, z * 0.07) * 1.5;
      const wide = 1 - smoothstep(8.5, 13, ct + Math.max(0, cs - 86) * 1.2);
      if (cs > 46 && wide > 0) {
        const edge = 91 + n(x * 0.15, z * 0.15) * 0.8;
        if (cs <= edge) h = lerp(h, Math.max(h, CLIFF_TOP * smoothstep(50, 79, cs) + n(x * 0.2, z * 0.2) * 0.25 * smoothstep(70, 80, cs)), wide);
        else h = lerp(h, lerp(CLIFF_TOP, Math.min(h, -6), smoothstep(edge, edge + 2.2, cs)), wide);
      }
    }
    // flat cozy spots
    const camp = 1 - smoothstep(5, 10, Math.hypot(x - CAMP.x, z - CAMP.z));
    h = lerp(h, 2.1, camp);
    const arr = 1 - smoothstep(5, 9, Math.hypot(x - ARRIVE.x, z - ARRIVE.z));
    h = lerp(h, 2.0, arr);
    return h;
  }

  async build() {
    const g = this.game;
    this.noise = makeNoise2D(17);
    const noise = this.noise;
    const rand = makeRandom(21);
    this.setupSky(g.state.time ?? 0.34);
    this.dayNight.setStarShow(true); // Milky Way, shooting stars, northern lights

    const sand = new THREE.Color('#f6e1c3'), wetSand = new THREE.Color('#d9c09a');
    const grassA = new THREE.Color('#68b955'), grassB = new THREE.Color('#8cc962'), meadowPink = new THREE.Color('#e9b8d8');
    const rock = new THREE.Color('#b9a9c9'), under = new THREE.Color('#e8d7b0'), mossy = new THREE.Color('#5f9a52');
    const pondEarth = new THREE.Color('#8a9a6a'), pondFloor = new THREE.Color('#9fb7a0');
    const color = (x, z, h, out) => {
      const n1 = noise(x * 0.03 + 9, z * 0.03), n2 = noise(x * 0.11, z * 0.11);
      out.copy(grassA).lerp(grassB, n1 * 0.5 + 0.5);
      // dreamy pink flower meadows
      const pondD = Math.hypot(x - POND.x, z - POND.z);
      if (noise(x * 0.015 - 4, z * 0.015 + 2) > 0.35 && pondD > POND.r + 5) out.lerp(meadowPink, 0.16 + n2 * 0.06);
      // a damp, mossy band around the pond instead of bright colour stripes
      if (pondD < POND.r + 4 && h > 0.1) out.lerp(mossy, (1 - smoothstep(POND.r - 2, POND.r + 4, pondD)) * 0.6);
      const pondBank = pondD < POND.r + 7;
      if (pondBank) {
        // the pond has damp earth and pebbles at the water line, not beach sand
        if (h < 0.9) out.lerp(pondEarth, smoothstep(0.9, 0.2, h));
        if (h < 0.15) out.copy(pondEarth).lerp(pondFloor, smoothstep(0.1, -1.5, h));
      } else {
        if (h < 1.1) out.lerp(sand, smoothstep(1.1, 0.5, h));
        if (h < 0.15) out.copy(wetSand).lerp(under, smoothstep(0, -2, h));
      }
      if (h < -2) out.copy(under).lerp(new THREE.Color('#bfe0d0'), smoothstep(-2, -8, h));
      // rocky cliff faces
      const e = 1.2;
      const slope = Math.abs(this.height(x + e, z) - this.height(x - e, z)) + Math.abs(this.height(x, z + e) - this.height(x, z - e));
      if (slope > 2.2 && h > 0.5 && !(pondBank && z < POND.z + 11)) out.lerp(rock, smoothstep(2.2, 4, slope));
      if (h > 12) out.lerp(new THREE.Color('#d8f0b0'), 0.2);
      // pebbly stream bed on top of the falls
      if (h > 9 && ((Math.abs(x - POND.x) < 2.7 && z > FALLS.face && z < FALLS.spring + 1) || Math.hypot(x - POND.x, z - FALLS.spring) < 3.8)) out.lerp(new THREE.Color('#7d8a8f'), 0.75);
    };
    this.terrain = new Terrain({ size: 400, segments: 260, height: (x, z) => this.height(x, z), color });
    this.scene.add(this.terrain.mesh);
    this.world = new World({ terrain: this.terrain, waterLevel: 0, bounds: { x: 0, z: 0, r: R + 16, soft: R + 3 } });
    this.mapBounds = { x0: -150, x1: 150, z0: -150, z1: 150 };

    this.water = new Water({ size: 400, segments: 200, groundHeight: (x, z) => this.terrain.getHeight(x, z), skyUniforms: this.dayNight.uniforms });
    this.water.addTo(this.scene);

    // distant mountains
    this.scene.add(this._mountains(rand));

    // ---- vegetation
    const q = g.engine.q;
    const slopeAt = (x, z) => { const nn = this.terrain.getNormal(x, z); return 1 - nn.y; };
    const nearCamp = (x, z) => Math.hypot(x - CAMP.x, z - CAMP.z) < 4.5;
    // no grass growing up through the stream on top of Rainbow Falls
    const inStream = (x, z) => (Math.abs(x - POND.x) < 2.7 && z > FALLS.face - 0.8 && z < FALLS.spring + 1) || Math.hypot(x - POND.x, z - FALLS.spring) < 3.8;
    this.inStream = inStream;
    this.scene.add(createGrass(this.terrain, {
      count: Math.floor(230000 * q.grass), area: 250, center: [0, 0], height: [0.22, 0.6], width: [0.4, 0.62],
      where: (x, z, h) => (h > 0.9 && slopeAt(x, z) < 0.35 && !nearCamp(x, z) && !inStream(x, z) ? 1 : 0),
      tint: (x, z, c, r) => { if (noise(x * 0.015 - 4, z * 0.015 + 2) > 0.35) c.offsetHSL(-0.12 + r() * 0.02, -0.1, 0.05); },
    }));
    this.scene.add(createFlowers(this.terrain, {
      count: Math.floor(9000 * q.grass), area: 240, center: [0, 0],
      where: (x, z, h) => (h > 1.0 && slopeAt(x, z) < 0.3 && !inStream(x, z) ? (noise(x * 0.015 - 4, z * 0.015 + 2) > 0.3 ? 1 : 0.18) : 0),
    }));
    const treeSpots = [];
    for (let i = 0; i < 260; i++) {
      const x = (rand() - 0.5) * 230, z = (rand() - 0.5) * 230;
      const h = this.terrain.getHeight(x, z);
      if (h < 1.5 || slopeAt(x, z) > 0.3) continue;
      if (Math.hypot(x, z + 10) < 28) continue; // keep the central meadow open
      if (Math.hypot(x - POND.x, z - POND.z) < POND.r + 4) continue;
      if (Math.hypot(x - CAMP.x, z - CAMP.z) < (z < CAMP.z + 4 ? 30 : 16) || Math.hypot(x - ARRIVE.x, z - ARRIVE.z) < 9) continue; // a big open clearing for stargazing
      if (Math.hypot(x - CLIFF.x, z - CLIFF.z) < 18) continue;
      if (DRAGON_SPOTS.some((d) => Math.hypot(x - d.x, z - d.z) < 10)) continue;
      const blossom = rand() < 0.45;
      treeSpots.push({ x, z, kind: rand() < 0.3 ? 'tall' : 'round', color: blossom ? ['#ffb3d1', '#ffc9e0', '#f7a8c8', '#fbd3ff'][Math.floor(rand() * 4)] : ['#7cc96b', '#8fd47a', '#6fbf5f'][Math.floor(rand() * 3)] });
    }
    // a few hand-placed blossom trees framing the pond and camp
    treeSpots.push({ x: POND.x - 15, z: POND.z - 6, kind: 'round', color: '#ffb3d1', scale: 1.3 }, { x: POND.x + 16, z: POND.z - 2, kind: 'round', color: '#fbd3ff', scale: 1.2 }, { x: CAMP.x - 11, z: CAMP.z + 14, kind: 'round', color: '#ffc9e0' }, { x: CAMP.x + 12, z: CAMP.z + 15, kind: 'tall', color: '#7cc96b' });
    this.mapTitle = 'Pinky Land';
    this.mapFeatures = treeSpots.map((t) => ({ type: 'tree', x: t.x, z: t.z, color: t.color, r: 2.0 * (t.scale || 1) }));
    this.mapFeatures.push({ type: 'label', x: 0, z: R + 6, text: 'Coral Reef' }, { type: 'label', x: -95, z: 100, text: 'Dreamy Sea' }, { type: 'falls', x: POND.x, z: POND.z + 14.5 }, { type: 'tent', x: CAMP.x - 2.5, z: CAMP.z - 2 }, { type: 'fire', x: CAMP.x, z: CAMP.z });
    const trees = createTrees(this.terrain, treeSpots, { seed: 7 });
    this.scene.add(trees.group);
    this.world.addColliders(trees.colliders);
    this.treeColliders = trees.colliders;
    const bushSpots = [];
    for (let i = 0; i < 90; i++) {
      const x = (rand() - 0.5) * 220, z = (rand() - 0.5) * 220;
      if (this.terrain.getHeight(x, z) < 1.2 || Math.hypot(x, z + 10) < 18) continue;
      if (DRAGON_SPOTS.some((d) => Math.hypot(x - d.x, z - d.z) < 8)) continue;
      if (Math.hypot(x - CLIFF.x, z - CLIFF.z) < 14) continue;
      bushSpots.push({ x, z, color: rand() < 0.3 ? '#e9a8d0' : '#6fbf5f' });
    }
    this.scene.add(createBushes(this.terrain, bushSpots));
    for (const b of bushSpots) this.mapFeatures.push({ type: 'bush', x: b.x, z: b.z, color: b.color });
    const rockSpots = [];
    for (let i = 0; i < 40; i++) {
      const a = rand() * 6.28, r = R - 20 + rand() * 12;
      const x = Math.cos(a) * r, z = Math.sin(a) * r;
      if (Math.hypot(x - CLIFF.x, z - CLIFF.z) < 16) continue;
      rockSpots.push({ x, z, scale: 0.6 + rand() * 1.4 });
    }
    rockSpots.push({ x: POND.x - 8, z: POND.z + 12, scale: 1.8 }, { x: POND.x + 9, z: POND.z + 13, scale: 2.2 }, { x: POND.x + 13, z: POND.z + 5, scale: 1.2, flat: true });
    for (const r of rockSpots) this.mapFeatures.push({ type: 'rock', x: r.x, z: r.z, r: r.scale || 1 });
    const rocks = createRocks(this.terrain, rockSpots, { color: '#b9a9c9' });
    this.scene.add(rocks.group);
    this.world.addColliders(rocks.colliders);
    // a tall stone pillar to double-jump onto
    const pillarX = -46, pillarZ = -22;
    this.mapFeatures.push({ type: 'pillar', x: pillarX, z: pillarZ });
    const pillarH = this.terrain.getHeight(pillarX, pillarZ);
    const pillar = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.4, 3.6, 9), new THREE.MeshStandardMaterial({ color: '#c9b9d9', flatShading: true, roughness: 0.9 }));
    pillar.position.set(pillarX, pillarH + 1.6, pillarZ);
    pillar.castShadow = pillar.receiveShadow = true;
    this.scene.add(pillar);
    this.world.addColliders([{ type: 'cyl', x: pillarX, z: pillarZ, r: 1.15, top: pillarH + 3.4, bottom: pillarH - 2 }]);
    this.pillarTop = new THREE.Vector3(pillarX, pillarH + 3.4, pillarZ);

    // ---- pond details
    const pads = [];
    for (let i = 0; i < 26; i++) {
      const a = rand() * 6.28, r = 4 + rand() * (POND.r - 7);
      const x = POND.x + Math.cos(a) * r, z = POND.z + Math.sin(a) * r;
      if (this.terrain.getHeight(x, z) < -0.4) pads.push({ x, z, flower: rand() < 0.35 });
    }
    this.scene.add(createLilyPads(pads, 0));
    // waterfall
    const wf = new Waterfall(this.scene, { x: POND.x, z: FALLS.face + 0.7, top: FALLS.lip, bottom: -0.3, width: 4.0, yaw: Math.PI, bulge: 3.4, lipBack: 1.1 });
    this.waterfalls.push(wf);
    this.landmarks.push({ x: POND.x, z: POND.z, icon: '💧', label: 'Sparkle Pond' }, { x: POND.x, z: POND.z + 16, icon: '🌈', label: 'Rainbow Falls' });
    // a stream on top of the cliff: clear blue water that flows from the spring to the lip
    const sLen = FALLS.spring - (FALLS.face + 0.2);
    const streamMat = makeStreamMaterial();
    this.streamMat = streamMat;
    const stream = new THREE.Mesh(new THREE.PlaneGeometry(4.4, sLen, 6, 24), streamMat);
    stream.rotation.x = -Math.PI / 2;
    stream.position.set(POND.x, FALLS.lip + 0.02, FALLS.face + 0.2 + sLen / 2);
    stream.renderOrder = 5;
    this.scene.add(stream);
    // the little spring pool the stream bubbles out of
    const springPool = new THREE.Mesh(new THREE.CircleGeometry(3.0, 32), streamMat.clone());
    springPool.material.uniforms = { ...streamMat.uniforms, uPool: { value: 1 } };
    springPool.rotation.x = -Math.PI / 2;
    springPool.position.set(POND.x, FALLS.lip + 0.03, FALLS.spring);
    springPool.renderOrder = 5;
    this.scene.add(springPool);
    rockSpots.length = 0;
    for (const [dx, dz, sc] of [[-3.4, 1.2, 1.1], [3.1, 0.6, 0.9], [-1.5, 3.4, 0.8], [2.0, 3.1, 1.0], [-3.4, -1.8, 0.7], [3.4, -1.6, 0.75]]) rockSpots.push({ x: POND.x + dx, z: FALLS.spring + dz, scale: sc });
    const springRocks = createRocks(this.terrain, rockSpots, { color: '#b9a9c9', seed: 21 });
    this.scene.add(springRocks.group);
    this.world.addColliders(springRocks.colliders);

    // reef
    const coralSpots = [];
    for (let i = 0; i < 160; i++) {
      const a = Math.PI * (0.15 + rand() * 0.7), r = R - 4 + rand() * 40;
      const x = Math.cos(a) * r, z = Math.sin(a) * r;
      const h = this.terrain.getHeight(x, z);
      if (h < -1.2 && h > -5) coralSpots.push({ x, z });
    }
    this.scene.add(createCoral(coralSpots, this.terrain));
    this.reefCenter = new THREE.Vector3(0, -2, R + 14);
    this.landmarks.push({ x: 0, z: R + 12, icon: '🪸', label: 'Coral Reef' });

    // ---- clouds (high ones + bouncy steps up to a sky cloud)
    const bouncy = [
      { x: -18, y: 3.5, z: 20, size: 2.4 }, { x: -22, y: 7.5, z: 25, size: 2.3 }, { x: -27, y: 11.5, z: 29, size: 2.3 },
      { x: -31, y: 15.5, z: 34, size: 2.3 }, { x: -34, y: 19.5, z: 40, size: 3.6 },
      { x: 4, y: 4, z: -6, size: 2.6 }, { x: 40, y: 6, z: -30, size: 2.4 }, { x: 46, y: 10, z: -34, size: 2.4 },
    ];
    this.clouds = new Clouds(this.scene, { count: 30, area: 700, height: [55, 120], bouncy });
    this.world.clouds = this.clouds;
    for (const b of bouncy) b.y = this.terrain.getHeight(b.x, b.z) + b.y;
    this.clouds.bouncy.forEach((m, i) => { m.userData.base.y = bouncy[i].y; m.position.y = bouncy[i].y; });
    this.skyCloud = new THREE.Vector3(bouncy[4].x, bouncy[4].y + 2.2, bouncy[4].z);
    this.landmarks.push({ x: -26, z: 29, icon: '☁️', label: 'Cloud Steps' });

    // ---- camp
    const campH = this.terrain.getHeight(CAMP.x, CAMP.z);
    this.campfire = new Campfire(this.scene, new THREE.Vector3(CAMP.x, campH, CAMP.z));
    this.campfires.push(this.campfire);
    this.world.addColliders([this.campfire.collider]);
    this.tent = createTent();
    this.tent.position.set(CAMP.x - 0.5, campH, CAMP.z - 4.2);
    this.tent.rotation.y = 0.1;
    this.tent.visible = !!this.P.tent;
    this.scene.add(this.tent);
    if (this.P.tent) this.world.addColliders([{ type: 'box', x: CAMP.x - 0.5, z: CAMP.z - 4.2, hw: 1.1, hd: 1.1, top: campH + 1.4, bottom: campH - 1, noStand: true }]);
    // log seats
    for (let i = 0; i < 3; i++) {
      const a = Math.PI * 0.3 + i * 0.9;
      const log = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.24, 1.6, 10), new THREE.MeshStandardMaterial({ color: '#8a5a3c', roughness: 1 }));
      log.rotation.z = Math.PI / 2;
      log.rotation.y = -a + Math.PI / 2;
      log.position.set(CAMP.x + Math.cos(a) * 2.2, campH + 0.2, CAMP.z + Math.sin(a) * 2.2);
      log.castShadow = log.receiveShadow = true;
      this.scene.add(log);
    }
    this.landmarks.push({ x: CAMP.x, z: CAMP.z, icon: '🔥', label: 'Cozy Camp', always: true });
    this.addInteractable({ pos: new THREE.Vector3(CAMP.x, campH, CAMP.z), radius: 3.2, label: () => (this.sitting ? '' : 'Sit by the campfire'), enabled: () => !this.sitting, action: () => this.sitByFire() });

    this.buildMoonviewCliff();

    // arrival stone circle (the Dream Door)
    const arrH = this.terrain.getHeight(ARRIVE.x, ARRIVE.z);
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      const st = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.32, 0.9 + (i % 3) * 0.3, 6), new THREE.MeshStandardMaterial({ color: '#e0d0f0', emissive: '#ffb3d9', emissiveIntensity: 0.25, flatShading: true }));
      st.position.set(ARRIVE.x + Math.cos(a) * 4.2, arrH + 0.4, ARRIVE.z + Math.sin(a) * 4.2);
      st.castShadow = true;
      this.scene.add(st);
    }
    this.landmarks.push({ x: ARRIVE.x, z: ARRIVE.z, icon: '🌀', label: 'Dream Door', always: true });
    const welcome = createSign('Welcome to\nPinky Land!', { color: '#ffe3ee' });
    welcome.position.set(ARRIVE.x + 5.5, this.terrain.getHeight(ARRIVE.x + 5.5, ARRIVE.z + 3), ARRIVE.z + 3);
    welcome.rotation.y = -0.6;
    this.scene.add(welcome);

    // ---- creatures
    this.creatures = new Creatures(this.scene, this.world, g.models);
    const C = this.creatures;
    C.addFox({ area: { x: -10, z: 4, r: 26 }, count: 1 }); // Pax the fox
    C.addHorses({ center: { x: -6, z: -4 }, radius: 34, count: 2, wings: true });
    C.addWingedHorses({ center: { x: 10, z: 0 }, radius: 55, height: 20, count: 3 });
    C.addFlyers('flamingo', { center: { x: POND.x, z: POND.z }, radius: 26, height: 14, count: 5, scale: 0.013, speed: 0.22, journalKey: 'flamingo', name: 'Flamingo' });
    C.addFlyers('stork', { center: { x: 0, z: 0 }, radius: 70, height: 38, count: 3, scale: 0.012, speed: 0.07, journalKey: 'stork', name: 'Stork' });
    C.addFlyers('parrot', { center: { x: -40, z: -30 }, radius: 14, height: 9, count: 4, scale: 0.008, speed: 0.4, journalKey: 'parrot', name: 'Parrot' });
    C.addFish({ center: { x: POND.x, z: POND.z }, radius: 7, depth: 1.8, count: 14, scale: 0.55 });
    C.addFish({ center: { x: 0, z: R + 14 }, radius: 18, depth: 1.4, count: 26, scale: 0.7 });
    C.addButterflies({ center: { x: 0, z: -6 }, radius: 40, count: 22, getHeight: (x, z) => Math.max(0, this.terrain.getHeight(x, z)) });
    C.addFireflies({ center: { x: 0, z: 0 }, radius: 50, count: 260, getHeight: (x, z) => this.terrain.getHeight(x, z) });
    C.addFireflies({ center: { x: POND.x, z: POND.z }, radius: 18, count: 120, getHeight: (x, z) => this.terrain.getHeight(x, z) });
    // the coral reef's sea life, and the pond that glows at night
    const sea = addSeaLife(this, { center: { x: 0, z: R + 14 }, inner: R - 6, outer: R + 36 });
    for (const c of sea.list) C.list.push(c);
    // squirrels and raccoons living among the trees
    const friends = addForestFriends(this, { trees: this.treeColliders, camp: CAMP, keepOut: [{ x: POND.x, z: POND.z, r: POND.r + 1.5 }, { x: CAMP.x, z: CAMP.z, r: 2.5 }, ...DRAGON_SPOTS.map((d) => ({ x: d.x, z: d.z, r: 7 }))] });
    for (const c of friends.list) C.list.push(c);
    this.__friends = friends;
    this.biolum = addBioluminescence(this.scene, { center: POND, radius: POND.r + 1, terrain: this.terrain });

    // ---- pinky friends
    this.buildPinkies();
    this.buildDragons();
    this.buildCollectibles();

    this.buildFerryDock();

    // ---- player
    let spawn = this.P.arrived && g.state.lastPos ? g.state.lastPos : { x: ARRIVE.x, z: ARRIVE.z };
    if (this.arriveAt?.ferry) spawn = this.dockSpawn;
    this.setupPlayer(new THREE.Vector3(spawn.x, 0, spawn.z), Math.PI * 0.9);
    if (this.P.cape) this.player.setCape(true);
  }

  // ---- Moonview Cliff: a second camp high on a cliff over the sea, for watching the
  // moon rise and the northern lights dance (and shimmer in the water below)
  buildMoonviewCliff() {
    const T = (x, z) => this.terrain.getHeight(x, z);
    const D = CLIFF_DIR, side = { x: -D.z, z: D.x };
    const at = (s, t) => ({ x: D.x * s + side.x * t, z: D.z * s + side.z * t });
    const fireH = T(CLIFF.x, CLIFF.z);
    const fire = new Campfire(this.scene, new THREE.Vector3(CLIFF.x, fireH, CLIFF.z));
    this.campfires.push(fire);
    this.world.addColliders([fire.collider]);
    this.cliffFire = fire;
    const wood = new THREE.MeshStandardMaterial({ color: '#8a5a3c', roughness: 1 });
    // two log benches on the inland side of the fire, facing out to sea
    this.cliffSeats = [];
    for (const t of [-1.3, 1.3]) {
      const p = at(84 - 2.1, t);
      const log = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.24, 1.7, 10), wood);
      log.rotation.z = Math.PI / 2;
      log.rotation.y = Math.atan2(D.x, D.z) + Math.PI / 2;
      log.position.set(p.x, T(p.x, p.z) + 0.2, p.z);
      log.castShadow = log.receiveShadow = true;
      this.scene.add(log);
      this.cliffSeats.push(p);
    }
    // a cozy little tent behind the benches
    const tent = createTent();
    const tp = at(84 - 6, -3.2);
    tent.position.set(tp.x, T(tp.x, tp.z), tp.z);
    tent.rotation.y = Math.atan2(D.x, D.z);
    this.scene.add(tent);
    this.world.addColliders([{ type: 'box', x: tp.x, z: tp.z, hw: 1.1, hd: 1.1, top: T(tp.x, tp.z) + 1.4, bottom: T(tp.x, tp.z) - 1, noStand: true }]);
    // a wooden fence along the cliff edge so nobody tumbles off by accident
    const fenceS = 89.6, postGeo = new THREE.CylinderGeometry(0.07, 0.08, 1.0, 6), railGeo = new THREE.BoxGeometry(0.08, 0.08, 1.62);
    for (let t = -8; t <= 8.01; t += 1.6) {
      const p = at(fenceS, t), h = T(p.x, p.z);
      const post = new THREE.Mesh(postGeo, wood); post.position.set(p.x, h + 0.45, p.z); post.castShadow = true; this.scene.add(post);
      if (t < 8) for (const y of [0.45, 0.85]) {
        const q = at(fenceS, t + 0.8), hq = T(q.x, q.z);
        const rail = new THREE.Mesh(railGeo, wood);
        rail.position.set(q.x, Math.max(h, hq) + y, q.z);
        rail.rotation.y = Math.atan2(side.x, side.z);
        this.scene.add(rail);
      }
    }
    const fm = at(fenceS, 0);
    this.world.addColliders([{ type: 'box', x: fm.x, z: fm.z, hw: 0.2, hd: 8.2, top: fireH + 1.0, bottom: fireH - 3, rot: Math.atan2(side.x, side.z), noStand: true }]);
    // twinkly lanterns on the fence
    const lampMat = new THREE.MeshBasicMaterial({ color: '#ffd27a' });
    for (const t of [-6.4, 0, 6.4]) {
      const p = at(fenceS, t), lamp = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 8), lampMat);
      lamp.position.set(p.x, T(p.x, p.z) + 1.08, p.z); this.scene.add(lamp);
    }
    const sign = createSign('Moonview Cliff\n🌙 night sea views', { color: '#e8ecff' });
    const sp = at(78, 4.2); sign.position.set(sp.x, T(sp.x, sp.z), sp.z); sign.rotation.y = Math.atan2(-D.x, -D.z); this.scene.add(sign);
    this.landmarks.push({ x: CLIFF.x, z: CLIFF.z, icon: '🌙', label: 'Moonview Cliff', always: true });
    this.mapFeatures.push({ type: 'fire', x: CLIFF.x, z: CLIFF.z }, { type: 'label', x: CLIFF.x - 6, z: CLIFF.z + 9, text: 'Moonview Cliff' });
    this.addInteractable({ pos: new THREE.Vector3(CLIFF.x, fireH, CLIFF.z), radius: 3.4, label: () => (this.sitting ? '' : 'Sit and watch the night sea 🌙'), enabled: () => !this.sitting, action: () => this.sitAtCliff() });
  }

  // the view from Moonview Cliff: out over the sea toward the rising moon, with the
  // northern lights off to the left
  cliffView() {
    const D = CLIFF_DIR, h = this.terrain.getHeight(CLIFF.x, CLIFF.z);
    const eye = new THREE.Vector3(CLIFF.x + D.x * 3.2, h + 3.4, CLIFF.z + D.z * 3.2); // in front of the fire, everyone sitting behind the camera
    // look a little to the right of straight out (toward the moon), down at the sea and up at the sky
    const a = Math.atan2(D.x, -D.z) + 0.1;
    const look = new THREE.Vector3(eye.x + Math.sin(a) * 60, h + 4.5, eye.z - Math.cos(a) * 60);
    return [eye, look];
  }

  async sitAtCliff() {
    const g = this.game;
    this.sitting = true;
    this.cutscene = true;
    const h = this.terrain.getHeight(CLIFF.x, CLIFF.z);
    const D = CLIFF_DIR;
    const seat = (root, model, p) => {
      const seatDrop = model.dims ? model.dims.shin * model.body.scale.y : 0;
      root.position.set(p.x, this.terrain.getHeight(p.x, p.z) + 0.44 - seatDrop, p.z);
      root.rotation.y = Math.atan2(D.x, D.z);
      model.anim.sit = true; model.anim.speed = 0; model.anim.swim = false; model.anim.grounded = true;
    };
    this.player.frozen = true;
    seat(this.player.root, this.player.model, this.cliffSeats[0]);
    this.player.yaw = this.player.root.rotation.y;
    const extra = [this.cliffSeats[1], { x: this.cliffSeats[1].x - D.x * 0.9 + D.z * 0.9, z: this.cliffSeats[1].z - D.z * 0.9 - D.x * 0.9 }];
    this.followers.forEach((f, i) => { if (!extra[i]) return; f.frozen = true; seat(f.root, f.model, extra[i]); f.yaw = f.root.rotation.y; });
    const [eye, look] = this.cliffView();
    this.rig.setOverride(eye, look);
    let done = false;
    while (!done) {
      const night = this.dayNight.nightAmount > 0.6;
      g.ui.setStargaze(night);
      const choices = night
        ? [{ text: 'Watch the moon and the northern lights 🌙', value: 'watch' }, { text: 'Sleep until morning 🌅', value: 'sleep' }, { text: 'Get up and keep exploring', value: 'up' }]
        : [{ text: 'Wait here until night falls 🌌', value: 'night' }, { text: 'Get up and keep exploring', value: 'up' }];
      const c = await g.ui.dialogue([line(PINKY, night ? 'Look how the moon and the northern lights shimmer on the sea… it’s like there are two skies!' : 'This is the best spot on the whole island to watch the night sky over the sea.', { choices })]);
      if (c === 'night' || c === 'sleep') {
        g.ui.fade(true);
        await new Promise((r) => setTimeout(r, 1400));
        this.dayNight.setTime(c === 'sleep' ? 0.255 : 0.8);
        await new Promise((r) => setTimeout(r, 600));
        g.ui.fade(false);
        await new Promise((r) => setTimeout(r, 900));
        g.ui.setStargaze(c !== 'sleep');
        if (c === 'sleep') { await g.ui.dialogue([line(PINKY, 'Good morning! The sea is all sparkly with sunshine now. ☀️')]); done = true; }
        else await g.ui.dialogue([line(J, 'Whoa… the moon is coming up out of the sea!'), line(L, 'And look over there — green and pink lights, dancing! Those are the northern lights.'), line(PINKY, 'And they’re reflected in the water, all wobbly and shimmery. 🩷')]);
        this.journalCheck('moonview', 'Moonview Cliff');
      } else if (c === 'watch') {
        this.journalCheck('moonview', 'Moonview Cliff');
        await g.ui.dialogue([
          line(J, 'The moon made a glittery path on the water, all the way to us.'),
          line(L, 'It’s like a road you could walk on to get to the moon.'),
          line(PINKY, 'The northern lights happen when tiny bits from the sun hit the air way up high and make it glow. Isn’t that magical?'),
        ]);
      } else done = true;
    }
    this.rig.setOverride(null);
    this.cutscene = false;
    this.player.model.anim.sit = false;
    this.followers.forEach((f) => { f.model.anim.sit = false; f.frozen = false; });
    this.player.frozen = false;
    this.player.pos.x -= D.x * 1.2; this.player.pos.z -= D.z * 1.2;
    g.ui.setStargaze(false);
    this.sitting = false;
  }

  // ---- the little ferry to Snowdrop Island, at a wooden dock on the north shore
  buildFerryDock() {
    const g = this.game, T = (x, z) => this.terrain.getHeight(x, z);
    const dir = new THREE.Vector2(-0.33, -1).normalize();
    let shore = 90;
    for (let r = 60; r < 140; r += 0.5) if (T(dir.x * r, dir.y * r) < -0.4) { shore = r; break; }
    const yaw = Math.atan2(dir.x, dir.y); // the dock points out to sea
    const r0 = shore - 7, r1 = shore + 9, top = 1.15, len = r1 - r0, mid = (r0 + r1) / 2;
    const at = (r, side = 0) => new THREE.Vector3(dir.x * r + Math.cos(yaw) * side, 0, dir.y * r - Math.sin(yaw) * side);
    const wood = new THREE.MeshStandardMaterial({ color: '#b8875a', roughness: 0.9 });
    const deck = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.2, len), wood);
    const m = at(mid); deck.position.set(m.x, top - 0.1, m.z); deck.rotation.y = yaw; deck.castShadow = deck.receiveShadow = true; this.scene.add(deck);
    for (let r = r0 + 0.5; r < r1; r += 2.4) for (const sd of [-1.2, 1.2]) {
      const p = at(r, sd); const post = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 4, 8), wood); post.position.set(p.x, top - 2, p.z); this.scene.add(post);
    }
    this.world.addColliders([{ type: 'box', x: m.x, z: m.z, hw: 1.3, hd: len / 2, top, bottom: -3, rot: yaw }]);
    const boat = makeFerry(); const bp = at(r1 - 2, 2.6);
    boat.position.set(bp.x, 0.35, bp.z); boat.rotation.y = yaw; this.scene.add(boat);
    this.ferry = boat;
    this.updaters.push(() => { boat.position.y = 0.3 + Math.sin(this.time * 1.3) * 0.06; boat.rotation.z = Math.sin(this.time * 0.9) * 0.03; });
    const end = at(r1 - 1.5, 0.5); end.y = top;
    const sp = at(r0 - 3); this.dockSpawn = { x: sp.x, z: sp.z };
    const sign = createSign('Snow Ferry\n❄️ Snowdrop Island', { color: '#e8f6ff' });
    const sgn = at(r0 - 1.5, 2.4); sign.position.set(sgn.x, T(sgn.x, sgn.z), sgn.z); sign.rotation.y = yaw + Math.PI; this.scene.add(sign);
    this.addInteractable({ pos: end, radius: 3.2, label: 'Sail to Snowdrop Island ❄️', action: () => g.goToSnowIsland() });
    this.landmarks.push({ x: m.x, z: m.z, icon: '⛵', label: 'Snow Ferry', always: true });
    this.ferryPos = end;
  }

  _mountains(rand) {
    const group = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, flatShading: true });
    const base = new THREE.Color('#9c8fd0'), snow = new THREE.Color('#fff0f6');
    for (let i = 0; i < 12; i++) {
      const a = -Math.PI * 0.95 + (i / 11) * Math.PI * 0.5 + (rand() - 0.5) * 0.1; // north-west side, behind the island (the east stays open sea for Moonview Cliff)
      const dist = 330 + rand() * 120;
      const h = 70 + rand() * 90;
      const g = new THREE.ConeGeometry(h * 0.9, h, 9, 6);
      const p = g.attributes.position;
      const cols = [];
      for (let k = 0; k < p.count; k++) {
        const y = p.getY(k);
        const t = (y + h / 2) / h;
        p.setX(k, p.getX(k) * (1 + (rand() - 0.5) * 0.25));
        p.setZ(k, p.getZ(k) * (1 + (rand() - 0.5) * 0.25));
        const c = base.clone().lerp(snow, smoothstep(0.62, 0.8, t));
        cols.push(c.r, c.g, c.b);
      }
      g.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
      g.computeVertexNormals();
      const m = new THREE.Mesh(g, mat);
      m.position.set(Math.cos(a) * dist, h / 2 - 12, Math.sin(a) * dist);
      group.add(m);
    }
    return group;
  }

  buildPinkies() {
    const W = this.world;
    const g = this.game;
    const mk = (opts) => new Pillow(opts);
    // Big Pinky — giant and bouncy
    const gpX = -26, gpZ = 12;
    this.grandpa = this.addNPC(new NPC(mk({ scale: 4.2, color: '#ffc9dc', variant: 3, name: 'Big Pinky', ink: '#5a3a8a' }), W, { x: gpX, z: gpZ, yaw: 0.6, name: 'Big Pinky', journalKey: 'grandpuff', talkRadius: 4.5 }));
    this.grandpa.lookAtPlayer = true;
    const gpTop = this.terrain.getHeight(gpX, gpZ) + PINKY_LOOK.height * 4.2;
    this.gpBounce = { x: gpX, z: gpZ, r: 1.8, top: gpTop, power: 21, onBounce: () => { this.grandpa.model.land(1); this.journalCheck('grandpuff', 'Big Pinky'); } };
    W.bouncers.push(this.gpBounce);
    this.gpCollider = { type: 'cyl', x: gpX, z: gpZ, r: 1.6, top: gpTop, bottom: gpTop - 4, noStand: true };
    W.addColliders([this.gpCollider]);
    // he waddles around his spot a little, and sometimes lies down for a belly-up nap
    this.gpHome = { x: gpX, z: gpZ };
    this.gpState = { mode: 'stand', t: 3, lie: 0 };
    this.grandpaTop = new THREE.Vector3(gpX, gpTop, gpZ);
    this.landmarks.push({ x: gpX, z: gpZ, icon: '🩷', label: 'Big Pinky' });
    // Baby Pinky — the littlest pinky, white with a pink smile, keeps the campfire cozy

    this.pip = this.addNPC(new NPC(mk({ scale: 0.38, color: '#fff0a8', variant: 1, name: 'Pip', ink: '#d0602a' }), W, { x: 6, z: -14, name: 'Pip', journalKey: 'pip' }));
    this.pip.wander = { x: 6, z: -14, r: 3 };
    this.dot = this.addNPC(new NPC(mk({ scale: 0.5, color: '#bfe6ff', variant: 2, name: 'Dot', ink: '#2a5aa8' }), W, { x: POND.x - 15, z: POND.z - 1, name: 'Dot', journalKey: 'dot' }));
    this.dot.wander = { x: POND.x - 15, z: POND.z - 2, r: 2.5 };
    this.baby = this.addNPC(new NPC(mk({ scale: 0.5, color: '#fffafc', variant: 0, name: 'Baby Pinky', ink: '#ff5fa2', plain: true }), W, { x: CAMP.x + 2.4, z: CAMP.z + 1.8, yaw: -2.4, name: 'Baby Pinky', journalKey: 'babypinky' }));
    this.marsh = this.addNPC(new NPC(mk({ scale: 0.7, color: '#e3d4ff', variant: 5, name: 'Marshmallow', ink: '#4a3a8a' }), W, { x: -44, z: 32, name: 'Marshmallow', journalKey: 'marshmallow' }));
    // a few more tiny pinkies just hopping around for joy
    const extra = [['#ffd6f0', 6, 2, -36], ['#d6ffe9', 7, 30, -12], ['#fff3d6', 8, -48, -4], ['#ffe0e0', 9, 40, 30]];
    for (const [col, v, x, z] of extra) {
      const n = this.addNPC(new NPC(mk({ scale: 0.3 + (v % 3) * 0.12, color: col, variant: v, ink: '#3366cc' }), W, { x, z, name: 'Little Pinky' }));
      n.wander = { x, z, r: 5 };
    }

    const talk = (npc, linesFn) => this.addInteractable({ pos: () => npc.root.position, radius: npc.talkRadius, label: `Talk to ${npc.name}`, action: async () => { this.journalCheck(npc.journalKey, npc.name); npc.model.playAction('wave', 1.5); await g.ui.dialogue(linesFn()); this.meet(npc.journalKey); } });
    const NPCW = (name, color) => ({ who: name, color, pitch: 1.6 });
    talk(this.grandpa, () => [
      line(NPCW('Big Pinky', '#c76b98'), 'Ho ho ho! Well hello, little ones! Welcome to Pinky Land! I’m Big Pinky.'),
      line(NPCW('Big Pinky', '#c76b98'), 'I’m the biggest, fluffiest pinky around. Go on — jump on my tummy. Everybody does!'),
      line(NPCW('Big Pinky', '#c76b98'), 'If you bounce high enough, you might find a Dream Star floating right above me. Ho ho!'),
      line(NPCW('Big Pinky', '#c76b98'), 'Have you met Baby Pinky? The little white one by the campfire at the Cozy Camp. Say hi — Baby Pinky LOVES new friends.'),
    ]);
    talk(this.baby, () => [
      line(NPCW('Baby Pinky', '#ff5fa2'), 'Hi! Hi! Hi! I’m Baby Pinky!'),
      line(NPCW('Baby Pinky', '#ff5fa2'), 'I’m the littlest pinky. Welcome to the Cozy Camp! I keep the fire warm and crackly.'),
      line(NPCW('Baby Pinky', '#ff5fa2'), 'When it gets dark, come sit by the fire. You can set up a tent and sleep under the stars.'),
      line(NPCW('Baby Pinky', '#ff5fa2'), 'Did you know every star in the sky is a happy dream someone had? That’s why they twinkle. Look for shooting stars!'),
    ]);
    talk(this.pip, () => (this.P.cape ? [
      line(NPCW('Pip', '#d0902a'), 'You found the Sky Cape! Hold jump in the air to glide. Wheee!'),
      line(NPCW('Pip', '#d0902a'), 'Try gliding down from the cloud steps. You can see the whole island from up there!'),
    ] : [
      line(NPCW('Pip', '#d0902a'), 'Hi hi hi! I’m Pip! I love flowers. And secrets! Do you want to hear a secret?'),
      line(NPCW('Pip', '#d0902a'), 'There’s something shiny and BLUE on top of Rainbow Falls, up on the cliff. I think it’s a cape!'),
      line(NPCW('Pip', '#d0902a'), 'You can walk up the gentle slope on the side of the cliff. Go see!'),
    ]));
    talk(this.dot, () => [
      line(NPCW('Dot', '#2a5aa8'), 'Splish splash! I’m Dot. Sparkle Pond is the clearest water in the whole world.'),
      line(NPCW('Dot', '#2a5aa8'), 'Hold Shift to dive under the water. There are glowing pieces of sea glass at the bottom!'),
      line(NPCW('Dot', '#2a5aa8'), 'And if you swim behind the waterfall… shhh. You’ll see.'),
    ]);
    talk(this.marsh, () => (this.dayNight.isNight() ? [
      line(NPCW('Marshmallow', '#4a3a8a'), '*yawn*… Oh! It’s night time. My favorite.'),
      line(NPCW('Marshmallow', '#4a3a8a'), 'At night, Moon Flowers glow in the meadows nearby. They only come out when the stars do.'),
      line(NPCW('Marshmallow', '#4a3a8a'), 'Follow the fireflies… they like the flowers too.'),
    ] : [
      line(NPCW('Marshmallow', '#4a3a8a'), 'Zzzz… zzz… (Marshmallow is fast asleep. Maybe come back at night?)'),
    ]));
    this.updaters.push(() => {
      // Marshmallow naps during the day
      const asleep = !this.dayNight.isNight();
      this.marsh.model.anim.sit = asleep;
      if (asleep !== this._marshAsleep) { this._marshAsleep = asleep; this.marsh.model.setMood(asleep ? 'sad' : 'happy'); }
      this.marsh.lookAtPlayer = !asleep;
    });
  }

  // ---- friendly dragons from many stories, and Belly Button the plush bear
  buildDragons() {
    const g = this.game, W = this.world, S = this.scene;
    const T = (x, z) => this.terrain.getHeight(x, z);
    const NPCW = (name, color, pitch = 1.0) => ({ who: name, color, pitch });
    this.dragons = [];
    // Sir Ember's cosy nest
    const nest = new THREE.Mesh(new THREE.TorusGeometry(2.3, 0.55, 10, 28), new THREE.MeshStandardMaterial({ color: '#c99a5a', roughness: 1 }));
    nest.rotation.x = Math.PI / 2; nest.scale.z = 0.6; nest.position.set(EMBER_HOME.x, T(EMBER_HOME.x, EMBER_HOME.z) + 0.15, EMBER_HOME.z);
    nest.receiveShadow = true; S.add(nest);
    for (let i = 0; i < 5; i++) { const m = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.2, 12), new THREE.MeshStandardMaterial({ color: '#fff6ee' })); const a = 0.6 + i * 0.25; m.position.set(EMBER_HOME.x + Math.cos(a) * 3.4, T(EMBER_HOME.x + Math.cos(a) * 3.4, EMBER_HOME.z + Math.sin(a) * 3.4) + 0.1 + (i === 4 ? 0.2 : 0), EMBER_HOME.z + Math.sin(a) * 3.4); m.castShadow = true; S.add(m); }
    const ember = new WesternDragon(S, W, { home: EMBER_HOME, yaw: -2.4, roam: { x: 0, z: 0, r: 62 } });
    W.addBody({ pos: ember.pos, r: 2.0, h: 2.4, active: () => ember.state === 'rest' });
    // Lantern Hill
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2, x = LANTERN_HILL.x + Math.cos(a) * 8.5, z = LANTERN_HILL.z + Math.sin(a) * 8.5, y = T(x, z);
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 2.6, 8), new THREE.MeshStandardMaterial({ color: '#7a3a2a' }));
      pole.position.set(x, y + 1.3, z); pole.castShadow = true; S.add(pole);
      const lantern = new THREE.Mesh(new THREE.SphereGeometry(0.32, 16, 12), new THREE.MeshStandardMaterial({ color: '#ff4a4a', emissive: '#ff6a3a', emissiveIntensity: 0.9, roughness: 0.6 }));
      lantern.scale.y = 1.25; lantern.position.set(x, y + 2.75, z); S.add(lantern);
      for (const dy of [0.42, -0.42]) { const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.08, 12), new THREE.MeshStandardMaterial({ color: '#ffd54a', metalness: 0.3 })); cap.position.set(x, y + 2.75 + dy, z); S.add(cap); }
      const tassel = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.3, 6), new THREE.MeshStandardMaterial({ color: '#ffd54a' })); tassel.position.set(x, y + 2.15, z); tassel.rotation.x = Math.PI; S.add(tassel);
      W.addColliders([{ type: 'cyl', x, z, r: 0.12, top: y + 2.6, bottom: y - 1, noStand: true }]);
    }
    const long = new ChineseDragon(S, W, { home: LANTERN_HILL, roam: { x: 0, z: -5, r: 75 } });
    // the Sun Steps: a little stepped platform where Quetzi warms her feathers
    const sy = T(SUN_STEPS.x, SUN_STEPS.z) - 0.2;
    const stone = new THREE.MeshStandardMaterial({ color: '#e3c99a', roughness: 0.95 });
    let top = sy;
    [[7, 0.6], [5.2, 0.6], [3.4, 0.6]].forEach(([w, h], i) => {
      const b = new THREE.Mesh(new THREE.BoxGeometry(w, h + (i === 0 ? 1 : 0), w), stone);
      b.position.set(SUN_STEPS.x, top + (h + (i === 0 ? 1 : 0)) / 2 - (i === 0 ? 1 : 0), SUN_STEPS.z);
      b.castShadow = b.receiveShadow = true; S.add(b);
      top += h;
      W.addColliders([{ type: 'box', x: SUN_STEPS.x, z: SUN_STEPS.z, hw: w / 2, hd: w / 2, top, bottom: sy - 2 }]);
      // carved zig-zag band
      const band = new THREE.Mesh(new THREE.BoxGeometry(w + 0.02, 0.12, w + 0.02), new THREE.MeshStandardMaterial({ color: ['#2fae6a', '#ff9a3c', '#3ec1ff'][i] }));
      band.position.set(SUN_STEPS.x, top - h / 2, SUN_STEPS.z); S.add(band);
    });
    const sun = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 0.1, 24), new THREE.MeshStandardMaterial({ color: '#ffd34d', emissive: '#ffb020', emissiveIntensity: 0.4 }));
    sun.position.set(SUN_STEPS.x, top + 0.05, SUN_STEPS.z); S.add(sun);
    const quetzi = new FeatheredSerpent(S, W, { home: { ...SUN_STEPS, top }, roam: { x: 30, z: 5, r: 45 } });
    // Serpent Cove: find open water off the north-east shore
    const ang = -0.75;
    let coveR = 80;
    for (let r = 60; r < 140; r += 1) { if (T(Math.cos(ang) * r, Math.sin(ang) * r) < -1.8) { coveR = r; break; } }
    const cove = { x: Math.cos(ang) * (coveR - 1), z: Math.sin(ang) * (coveR - 1) };
    const loop = { x: Math.cos(ang) * (coveR + 16), z: Math.sin(ang) * (coveR + 16), r: 11 };
    this.cove = cove;
    const fjola = new NordicSerpent(S, W, { cove, loop });
    this.dragons.push(ember, long, quetzi, fjola);
    this.updaters.push((dt, ctx) => { for (const d of this.dragons) d.update(dt, ctx); });
    this.landmarks.push({ x: EMBER_HOME.x, z: EMBER_HOME.z, icon: '🐉', label: 'Ember’s Nest' }, { x: LANTERN_HILL.x, z: LANTERN_HILL.z, icon: '🏮', label: 'Lantern Hill' }, { x: SUN_STEPS.x, z: SUN_STEPS.z, icon: '☀️', label: 'Sun Steps' }, { x: cove.x, z: cove.z, icon: '🌊', label: 'Serpent Cove' });
    this.mapFeatures.push({ type: 'rock', x: SUN_STEPS.x, z: SUN_STEPS.z, r: 3 });

    // talking to a dragon ends with an offer of a ride on their back
    const rideOffer = {
      'dragon-ember': ['Sir Ember', '#d0402a', 0.7, 'Fancy a flight, little explorer? Climb up on my back — hold on to my spikes!'],
      'dragon-long': ['Lóng Mei', '#c0202a', 1.1, 'Would you like to fly with me? Sit just behind my head — the magic will hold you.'],
      'dragon-quetzi': ['Quetzi', '#1f8a50', 1.2, '¿Quieres volar? Want to fly? My feathers are very soft to sit on!'],
      'dragon-fjola': ['Fjola', '#1d6f8f', 1.0, 'Want to go for a swim on my back? I promise not to dive… much! *splash*'],
    };
    const talkTo = (d, radius, linesFn) => this.addInteractable({
      pos: () => d.talkPos(), radius, enabled: () => d.canTalk,
      label: () => (met(d.info.key) ? `Talk to ${d.name} · ride 🐉` : `Talk to ${d.name}`),
      action: async () => {
        this.journalCheck(d.info.key, d.name); if (d.puffSparkles) d.puffSparkles();
        const o = rideOffer[d.info.key];
        const v = await g.ui.dialogue([...linesFn(), line(NPCW(o[0], o[1], o[2]), o[3], { choices: [{ text: '🐉 Yes! Let’s go!', value: 'ride' }, { text: 'Maybe later', value: 'no' }] })]);
        this.meet(d.info.key);
        if (v === 'ride') this.startRide(d);
      },
    });
    const met = (k) => this.P.met.includes(k);
    talkTo(ember, 5, () => (met('dragon-ember') ? [
      line(NPCW('Sir Ember', '#d0402a', 0.7), 'Back again, small friends? Splendid! Shall I puff you some sparkles? Hrrrm… PFFT! ✨'),
      line(NPCW('Sir Ember', '#d0402a', 0.7), 'Sometimes I fly all the way around the island. Watch the sky — you might see me!'),
    ] : [
      line(NPCW('Sir Ember', '#d0402a', 0.7), 'Oh! Hello there, little ones! I’m Sir Ember. Don’t worry — I only breathe sparkles!'),
      line(NPCW('Sir Ember', '#d0402a', 0.7), 'In the old castle stories, knights and dragons were always fighting. How silly! I’d much rather have a picnic.'),
      line(NPCW('Sir Ember', '#d0402a', 0.7), 'My favourite job is warming marshmallows for Baby Pinky at the Cozy Camp. One tiny puff — perfectly golden!'),
      line(PINKY, 'Sir Ember gives the warmest hugs. Like a big, cosy blanket!'),
    ]));
    talkTo(long, 6, () => [
      line(NPCW('Lóng Mei', '#c0202a', 1.1), 'Nǐ hǎo! Hello! I am Lóng Mei. I don’t need wings — dragons like me fly with magic!'),
      line(NPCW('Lóng Mei', '#c0202a', 1.1), 'In Chinese stories, dragons bring the rain that helps the rice and flowers grow. We’re a sign of good luck!'),
      line(NPCW('Lóng Mei', '#c0202a', 1.1), 'See my pearl? It glows brighter whenever friends are kind to each other. It’s VERY bright today.'),
    ]);
    talkTo(quetzi, 6, () => [
      line(NPCW('Quetzi', '#1f8a50', 1.2), '¡Hola, amigos! I’m Quetzi — a feathered serpent!'),
      line(NPCW('Quetzi', '#1f8a50', 1.2), 'In very old stories from Mexico, a feathered serpent brought the wind and helped people learn to make wonderful things.'),
      line(NPCW('Quetzi', '#1f8a50', 1.2), 'These are the Sun Steps. I warm my feathers here every day. Do you like my rainbow colours?'),
    ]);
    talkTo(fjola, 7, () => [
      line(NPCW('Fjola', '#1d6f8f', 1.0), 'Hei hei! I’m Fjola! *splash*'),
      line(NPCW('Fjola', '#1d6f8f', 1.0), 'In old Norse stories from the far north, a sea serpent grew so long it could wrap around the whole world!'),
      line(NPCW('Fjola', '#1d6f8f', 1.0), 'I’m not THAT long… yet. For now I swim around Pinky Land and say good morning to every single fish.'),
    ]);
    // Belly Button the plush bear lives in the meadow near the Dream Door
    const bb = this.addNPC(new NPC(new BellyButton({ scale: 1.05 }), W, { x: 9, z: -27, yaw: -2.6, name: 'Belly Button', journalKey: 'bellybutton', talkRadius: 2.6 }));
    bb.wander = { x: 9, z: -27, r: 3 };
    bb.speed = 0.8;
    this.bellyButton = bb;
    this.addInteractable({ pos: () => bb.root.position, radius: 2.6, label: 'Talk to Belly Button', enabled: () => g.state.avatar !== 'bellybutton', action: async () => {
      this.journalCheck('bellybutton', 'Belly Button'); bb.model.playAction('wave', 1.8);
      await g.ui.dialogue(met('bellybutton') ? [
        line(NPCW('Belly Button', '#5a5862', 0.9), 'Hug time? Hug time! Squish. ♥'),
        line(NPCW('Belly Button', '#5a5862', 0.9), 'Have you seen the dragons? Sir Ember lets me nap on his tail. It’s toasty.'),
      ] : [
        line(NPCW('Belly Button', '#5a5862', 0.9), 'Oh hi! I’m Belly Button. Do you want to know why?'),
        line(NPCW('Belly Button', '#5a5862', 0.9), 'Because I have the softest, roundest belly in all of Pinky Land! Go ahead — it’s very huggable.'),
        line(NPCW('Belly Button', '#5a5862', 0.9), 'I came from Earth too, a long time ago. Someone loved me SO much that I became a little bit magic.'),
        line(J, 'That’s just like Pinky!'),
      ]);
      this.meet('bellybutton');
    } });
  }

  meet(key) {
    if (this.P.met.includes(key)) return;
    this.P.met.push(key); this.game.saveGame();
    if (DRAGON_KINDS.some((k) => k.key === key)) dragonFound(this, key);
  }

  dragonCount() { return dragonsMet(this.game.state).length; }


  buildCollectibles() {
    const g = this.game;
    const T = (x, z) => this.terrain.getHeight(x, z);
    const V = (x, y, z) => new THREE.Vector3(x, y, z);
    const stars = [
      V(POND.x - 4, T(POND.x - 4, POND.z + 26) + 0.2, POND.z + 26), // top of the cliff
      V(POND.x + 0.6, 0.45, FALLS.face - 1.6), // behind the waterfall
      V(POND.x + 2, T(POND.x + 2, POND.z - 1) + 0.1, POND.z - 1), // bottom of the pond
      this.skyCloud.clone().add(V(0, 0.4, 0)), // on the sky cloud
      this.grandpaTop.clone().add(V(0, 6.5, 0)), // above Big Pinky
      V(CAMP.x - 1.5, T(CAMP.x - 1.5, CAMP.z - 8) + 0.1, CAMP.z - 8), // behind the camp
      V(0, T(0, R - 12) + 0.1, R - 12), // on the south beach
      V(10, T(10, R + 16) + 0.2, R + 16), // in the coral reef
      this.pillarTop.clone(), // on the stone pillar
      V(58, 0, -40), // far east hills (set below)
    ];
    stars[9].y = T(58, -40) + 0.1;
    g.state.totals.star = stars.length;
    stars.forEach((p, i) => this.addCollectible('star', `pl-star-${i}`, p, { float: 0.7 }));

    // shells along the beach
    const shells = [];
    for (let a = 0.15; a < Math.PI * 0.95 && shells.length < 6; a += 0.42) {
      for (let r = R - 30; r < R + 10; r += 0.5) {
        const x = Math.cos(a) * r, z = Math.sin(a) * r;
        const h = T(x, z);
        if (h < 0.8 && h > 0.15) { shells.push(V(x, h, z)); break; }
      }
    }
    g.state.totals.shell = shells.length;
    shells.forEach((p, i) => this.addCollectible('shell', `pl-shell-${i}`, p, { float: 0.15 }));

    const feathers = [
      V(POND.x + 10, T(POND.x + 10, POND.z + 30) + 0.2, POND.z + 30),
      this.skyCloud.clone().add(V(1.5, 0.3, 1.5)),
      V(-60, 0, 30), V(30, 0, -60),
    ];
    feathers[2].y = T(-60, 30) + 0.1; feathers[3].y = T(30, -60) + 0.1;
    g.state.totals.feather = feathers.length;
    feathers.forEach((p, i) => this.addCollectible('feather', `pl-feather-${i}`, p, { float: 0.8 }));

    const glass = [
      V(POND.x - 5, T(POND.x - 5, POND.z + 3) + 0.15, POND.z + 3),
      V(POND.x + 6, T(POND.x + 6, POND.z + 5) + 0.15, POND.z + 5),
      V(POND.x - 1, T(POND.x - 1, POND.z - 6) + 0.15, POND.z - 6),
      V(-14, T(-14, R + 20) + 0.15, R + 20),
      V(22, T(22, R + 6) + 0.15, R + 6),
    ];
    g.state.totals.seaglass = glass.length;
    glass.forEach((p, i) => this.addCollectible('seaglass', `pl-glass-${i}`, p, { float: 0.1 }));

    const flowers = [V(-36, 0, 22), V(-50, 0, 40), V(-38, 0, 44), V(-56, 0, 24)];
    flowers.forEach((p) => { p.y = T(p.x, p.z) + 0.05; });
    g.state.totals.flower = flowers.length;
    flowers.forEach((p, i) => this.addCollectible('flower', `pl-flower-${i}`, p, { float: 0.25, nightOnly: true }));

    // the Sky Cape on the clifftop
    if (!this.P.cape) {
      this.addCollectible('cape', 'pl-cape', V(POND.x + 5, T(POND.x + 5, POND.z + 22) + 0.1, POND.z + 22), {
        float: 0.6, scale: 1.4,
        onCollect: () => {
          this.P.cape = true;
          this.player.setCape(true);
          g.audio.heart();
          setTimeout(() => g.ui.dialogue([
            line(J, 'A cape! It’s shiny and blue, just like my real one!'),
            line(PINKY, 'It’s the Sky Cape! Jump, then hold Space while you’re falling to glide through the air!'),
          ]), 600);
        },
      });
    }
  }

  availableAvatars() { return ['jacinta', 'pinky', 'jacintaPack', 'liev', 'bellybutton']; }

  // When you first arrive, Pinky comes alive!
  async arrive() {
    const g = this.game;
    if (this.P.arrived) return;
    this.cutscene = true;
    const p = this.player.pos;
    this.rig.setOverride(new THREE.Vector3(p.x + 4, p.y + 2.6, p.z - 5), new THREE.Vector3(p.x, p.y + 1, p.z));
    await new Promise((r) => setTimeout(r, 1400));
    this.cutscene = false;
    await g.ui.dialogue([
      line(PINKY, 'Jacinta… we did it. WE’RE HERE! Welcome to Pinky Land!'),
      line(J, 'Pinky?! You’re walking! And talking out loud!'),
      line(PINKY, 'In Pinky Land I can hop and bounce and swim all by myself! Look — *boing!*', { onShow: () => { const f = this.followers.find((x) => x.model === g.avatarModels.pinky); f?.model.playAction('cheer', 2); } }),
      line(L, 'Whoa… the clouds are low enough to touch. And the water is so clear!'),
      line(J, 'It’s exactly like my drawings… only even more beautiful.'),
      line(PINKY, 'My friends can’t wait to meet you. And there are Dream Stars hidden all over the island!'),
      line(PINKY, 'You can play as me, too — press Tab or 1 2 3 4 to switch. Let’s go explore!'),
    ]);
    this.rig.setOverride(null);
    this.P.arrived = true;
    g.ui.chapter('Chapter 2', 'Pinky Land', 4);
    g.saveGame();
  }

  async sitByFire() {
    const g = this.game;
    this.sitting = true;
    const campH = this.terrain.getHeight(CAMP.x, CAMP.z);
    // sit ON the three logs around the fire (same spots the logs were placed at)
    const spots = [0, 1, 2].map((i) => { const a = Math.PI * 0.3 + i * 0.9; return [CAMP.x + Math.cos(a) * 2.2, CAMP.z + Math.sin(a) * 2.2]; });
    const LOG_TOP = 0.44;
    const placeSitter = (root, model, [x, z]) => {
      // a sitting kid's bottom is about one shin-length above their feet; pillows sit flat
      const seatDrop = model.dims ? model.dims.shin * model.body.scale.y : 0;
      root.position.set(x, campH + LOG_TOP - seatDrop, z);
      root.rotation.y = Math.atan2(CAMP.x - x, CAMP.z - z);
      model.anim.sit = true;
      model.anim.speed = 0;
      model.anim.swim = false; // (a friend who just swam over must not stay in a swimming pose)
      model.anim.grounded = true;
    };
    this.player.frozen = true;
    placeSitter(this.player.root, this.player.model, spots[0]);
    this.player.yaw = this.player.root.rotation.y;
    this.followers.forEach((f, i) => { f.frozen = true; placeSitter(f.root, f.model, spots[i + 1]); f.yaw = f.root.rotation.y; });
    this.rig.setOverride(new THREE.Vector3(CAMP.x + 0.5, campH + 2.2, CAMP.z + 6.5), new THREE.Vector3(CAMP.x, campH + 0.8, CAMP.z));
    this.cutscene = true;
    const night = this.dayNight.isNight() || this.dayNight.nightAmount > 0.35;
    const choices = [];
    if (!this.P.tent) choices.push({ text: 'Set up the tent and sleeping bags ⛺', value: 'tent' });
    if (night) choices.push({ text: 'Sleep until morning 🌅', value: 'sleep' });
    else choices.push({ text: 'Rest until sunset 🌇', value: 'sunset' });
    choices.push({ text: 'Look at the stars together ✨', value: 'stars' });
    choices.push({ text: 'Get up and keep exploring', value: 'up' });
    let done = false;
    while (!done) {
      const c = await g.ui.dialogue([line(PINKY, night ? 'The fire is so warm and crackly. The stars are coming out…' : 'It’s nice to rest by the fire for a bit.', { choices })]);
      if (c === 'tent') {
        this.tent.visible = true;
        this.P.tent = true;
        this.world.addColliders([{ type: 'box', x: CAMP.x - 0.5, z: CAMP.z - 4.2, hw: 1.1, hd: 1.1, top: campH + 1.4, bottom: campH - 1, noStand: true }]);
        this.spawnBurst(this.tent.position.clone().add(new THREE.Vector3(0, 1, 0)), '#ffb3d9');
        g.audio.collect();
        this.journalCheck('tent', 'Cozy Tent');
        choices.splice(choices.findIndex((x) => x.value === 'tent'), 1);
        await g.ui.dialogue([line(L, 'Tent’s up! And I put your sleeping bag right next to Pinky’s.'), line(J, 'This is the coziest camp ever.')]);
      } else if (c === 'sleep' || c === 'sunset') {
        g.ui.fade(true);
        await new Promise((r) => setTimeout(r, 1400));
        this.dayNight.setTime(c === 'sleep' ? 0.255 : 0.71);
        await new Promise((r) => setTimeout(r, 600));
        g.ui.fade(false);
        await new Promise((r) => setTimeout(r, 900));
        await g.ui.dialogue([c === 'sleep' ? line(PINKY, 'Good morning, sleepyheads! Look at that sunrise! 🌅') : line(PINKY, 'Ooh, the sky is turning pink and orange. My favorite colors!')]);
        done = true;
      } else if (c === 'stars') {
        this.rig.setOverride(new THREE.Vector3(CAMP.x, campH + 1.5, CAMP.z + 3), new THREE.Vector3(CAMP.x - 10, campH + 30, CAMP.z - 30));
        g.ui.setStargaze(true);
        await g.ui.dialogue([
          line(J, 'Look! That group of stars looks like a pillow with a smiley face!'),
          line(PINKY, 'That’s the Pinky constellation! I think you put it there when you were little.'),
          line(L, 'And that one looks like a soccer ball. Totally.'),
        ]);
        g.ui.setStargaze(false);
        this.rig.setOverride(new THREE.Vector3(CAMP.x + 0.5, campH + 2.2, CAMP.z + 6.5), new THREE.Vector3(CAMP.x, campH + 0.8, CAMP.z));
      } else done = true;
    }
    this.rig.setOverride(null);
    this.cutscene = false;
    this.player.model.anim.sit = false;
    this.followers.forEach((f) => { f.model.anim.sit = false; f.frozen = false; });
    this.player.frozen = false;
    this.player.pos.z += 1;
    this.sitting = false;
  }

  getHint() {
    const g = this.game;
    const met = (k) => this.P.met.includes(k);
    if (!met('pip')) return { text: 'My tiny friend Pip lives in the flower meadow. Pip knows ALL the secrets!', target: this.pip.root.position.clone() };
    if (!this.P.cape) {
      const c = this.collectibles.find((x) => x.kind === 'cape' && !x.taken);
      if (c) return { text: 'Pip said something shiny and blue is on top of Rainbow Falls. Walk up the side of the cliff!', target: c.obj.position.clone() };
    }
    if (this.dayNight.isNight() && !this.P.tent) return { text: 'It’s getting dark and chilly. Let’s go to the Cozy Camp and set up our tent!', target: new THREE.Vector3(CAMP.x, 2, CAMP.z) };
    if (!met('grandpuff')) return { text: 'Have you met Big Pinky? He’s the BIGGEST pinky. You can bounce on him!', target: this.grandpa.root.position.clone() };
    if (!met('dot')) return { text: 'Dot lives by Sparkle Pond and knows all about swimming.', target: this.dot.root.position.clone() };
    if (!met('bellybutton') && g.state.avatar !== 'bellybutton') return { text: 'Belly Button the plush bear is in the meadow near the Dream Door. Go say hi — he gives the best hugs!', target: this.bellyButton.root.position.clone() };
    if (!met('babypinky')) return { text: 'Baby Pinky — the littlest pinky — is sitting by the campfire at the Cozy Camp.', target: this.baby.root.position.clone() };
    if (!met('dragon-ember')) return { text: 'A friendly dragon named Sir Ember naps in a cosy nest to the north-east. Go visit!', target: this.dragons[0].pos.clone() };
    {
      const d = this.dragons.slice(1).find((x) => !met(x.info.key) && x.canTalk);
      if (d) return { text: `${d.name} the dragon is visiting right now! Hurry and say hello.`, target: d.talkPos().clone() };
    }
    if (!g.state.snow?.visited && met('dragon-ember')) return { text: 'A little ferry boat on the north shore sails to Snowdrop Island — a snowy island! I heard a snow dragon lives there. ❄️', target: this.ferryPos.clone() };
    // nearest star (or anything) not yet found
    const p = this.player.pos;
    const left = this.collectibles.filter((c) => !c.taken && (!c.nightOnly || this.dayNight.isNight()));
    left.sort((a, b) => (a.kind === 'star' ? 0 : 1) - (b.kind === 'star' ? 0 : 1) || a.obj.position.distanceTo(p) - b.obj.position.distanceTo(p));
    const c = left[0];
    if (!c) return { text: 'You found everything! You’re a true Pinky Land explorer. 💗', target: null };
    const tips = {
      star: 'I can feel a Dream Star nearby! Follow the sparkles.',
      shell: 'There are pretty shells on the beach!',
      feather: 'A Rainbow Feather is somewhere up high.',
      seaglass: 'Sea glass glows under the water. Hold Shift to dive!',
      flower: 'Moon Flowers are glowing in the meadow tonight!',
    };
    let text = tips[c.kind] || 'Something sparkly is this way!';
    if (c.id === 'pl-star-3') text = 'There’s a Dream Star on the very top cloud! Bounce up the Cloud Steps.';
    if (c.id === 'pl-star-4') text = 'Bounce on Big Pinky’s tummy to reach the star floating above him!';
    if (c.id === 'pl-star-1') text = 'Dot said to swim behind the waterfall…';
    if (c.id === 'pl-star-8') text = 'A star is on top of the tall stone pillar. Try a double jump!';
    if (c.id === 'pl-star-2') text = 'Something is sparkling at the bottom of Sparkle Pond. Dive down with Shift!';
    return { text, target: c.obj.position.clone() };
  }

  mapMarkers() {
    const m = [...this.landmarks];
    for (const n of [this.pip, this.dot, this.baby, this.marsh]) if (this.P.met.includes(n.journalKey)) m.push({ x: n.root.position.x, z: n.root.position.z, icon: '🩷', label: n.name });
    return m;
  }

  mapColor(x, z, h, out) {
    if (h < 0) {
      out.set('#8af0e4').lerp(new THREE.Color('#4fa9e3'), smoothstep(0, 7, -h));
      return;
    }
    if (h < 0.9) return out.set('#f6e1c3');
    out.setHSL(0.28 - Math.min(h, 20) * 0.004, 0.5, 0.62 + Math.min(h, 14) * 0.012);
    if (this.noise(x * 0.015 - 4, z * 0.015 + 2) > 0.35) out.lerp(new THREE.Color('#f2c4e0'), 0.45);
  }

  nearWaterAmount(p) {
    const d = Math.hypot(p.x - POND.x, p.z - POND.z);
    const pond = Math.max(0, 1 - Math.max(0, d - POND.r) / 10);
    const sea = Math.max(0, 1 - Math.max(0, R - 20 - Math.hypot(p.x, p.z)) / 15);
    return Math.max(pond, sea);
  }

  // Big Pinky: stands, waddles a few steps, or lies down belly-up so you can bounce on his tummy
  updateBigPinky(dt) {
    const gp = this.grandpa, S = this.gpState, H = this.gpHome;
    if (!gp) return;
    S.t -= dt;
    const near = this.player.pos.distanceTo(gp.root.position) < 6;
    if (S.mode === 'stand' && S.t < 0) {
      if (Math.random() < 0.5) {
        S.mode = 'walk'; S.t = 5 + Math.random() * 3;
        const a = Math.random() * Math.PI * 2, r = 0.8 + Math.random() * 2.2;
        gp.walkTo(H.x + Math.cos(a) * r, H.z + Math.sin(a) * r, 0.7).then(() => { if (S.mode === 'walk') S.t = Math.min(S.t, 0.5); });
      } else { S.mode = 'lie'; S.t = 9 + Math.random() * 6; }
    } else if (S.mode === 'walk' && S.t < 0) { gp.target = null; S.mode = 'stand'; S.t = 3 + Math.random() * 3; }
    else if (S.mode === 'lie' && S.t < 0 && !(near && this.player.pos.y > gp.root.position.y + 0.8)) { S.mode = 'stand'; S.t = 4 + Math.random() * 3; }
    gp.lookAtPlayer = S.mode !== 'lie';
    S.lie += ((S.mode === 'lie' ? 1 : 0) - S.lie) * Math.min(1, dt * 1.6);
    gp.model.anim.lie = S.lie;
    // keep his bouncy tummy, his solid body and the Dream Star spot with him
    const p = gp.root.position, scale = 4.2;
    const ground = this.terrain.getHeight(p.x, p.z);
    const back = PINKY_LOOK.height * 0.5 * scale * S.lie; // lying down, his middle is behind his feet
    const cx = p.x - Math.sin(gp.yaw) * back, cz = p.z - Math.cos(gp.yaw) * back;
    const topStand = ground + PINKY_LOOK.height * scale, topLie = ground + PINKY_LOOK.thickness * scale * 0.95;
    this.gpBounce.x = cx; this.gpBounce.z = cz;
    this.gpBounce.top = topStand + (topLie - topStand) * S.lie;
    this.gpBounce.r = 1.8 + 0.6 * S.lie;
    this.gpCollider.x = cx; this.gpCollider.z = cz;
    this.gpCollider.top = this.gpBounce.top; this.gpCollider.bottom = this.gpBounce.top - 4;
    this.gpCollider.r = 1.6 + 0.5 * S.lie;
    if (gp.body) { gp.body.h = (this.gpBounce.top - ground); gp.body.r = 1.5 + 0.4 * S.lie; }
    if (S.lie > 0.9 && !this._gpLieTip && near) { this._gpLieTip = true; this.game.ui.say('Big Pinky is napping belly-up. Bounce on his tummy! 🩷', 3); }
  }

  update(dt) {
    if (this.bellyButton) this.bellyButton.root.visible = this.game.state.avatar !== 'bellybutton';
    this.updateBigPinky(dt);
    if (this.streamMat) this.streamMat.uniforms.uNight.value = this.dayNight.nightAmount;
    this.biolum?.update(this.player.pos);
    this.baseUpdate(dt);
    const p = this.player.pos;
    this.game.state.lastPos = { x: p.x, z: p.z };
    const n = this.game.state.counts.star || 0;
    const dk = this.dragonCount();
    const counter = `⭐ ${n} / ${this.game.state.totals.star || 10}` + (dk ? ` · 🐉 ${dk} / ${DRAGON_KINDS.length}` : '');
    if (counter !== this._counter) { this._counter = counter; this.game.ui.setCounter(counter); }
    if (this.player.gliding && !this._glideSnd) { this._glideSnd = true; this.game.audio.glide(); }
    if (!this.player.gliding) this._glideSnd = false;
  }
}

Object.assign(PinkyLandLevel.prototype, RideMixin);

// clear, flowing stream water (blue with ripples and a bit of foam where it tips over the falls)
function makeStreamMaterial() {
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, fog: true,
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uNight: { value: 0 }, uPool: { value: 0 } }]),
    vertexShader: /* glsl */ `
      #include <fog_pars_vertex>
      varying vec2 vUv;
      void main(){ vUv = uv; vec4 mvPosition = modelViewMatrix * vec4(position,1.0); gl_Position = projectionMatrix * mvPosition;
      #include <fog_vertex>
      }`,
    fragmentShader: /* glsl */ `
      #include <fog_pars_fragment>
      uniform float uTime; uniform float uNight; uniform float uPool; varying vec2 vUv;
      float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233)))*43758.5453); }
      float n(vec2 p){ vec2 i=floor(p), f=fract(p); vec2 u=f*f*(3.0-2.0*f);
        return mix(mix(hash(i),hash(i+vec2(1,0)),u.x), mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),u.x), u.y); }
      void main(){
        vec2 uv = vUv;
        float edge, foam, rip;
        if (uPool > 0.5) {
          float r = length(uv - 0.5) * 2.0;
          edge = smoothstep(1.0, 0.8, r);
          rip = n(vec2(r * 9.0 - uTime * 1.6, atan(uv.y - 0.5, uv.x - 0.5) * 3.0));
          foam = smoothstep(0.25, 0.0, r) * (0.5 + 0.5 * n(uv * 30.0 + uTime * 2.0)); // bubbling spring
        } else {
          edge = smoothstep(0.0, 0.16, uv.x) * smoothstep(1.0, 0.84, uv.x);
          // ripples travel toward the lip (uv.y = 1)
          rip = n(vec2(uv.x * 7.0, uv.y * 22.0 - uTime * 3.2)) * 0.6 + n(vec2(uv.x * 15.0 + 3.0, uv.y * 45.0 - uTime * 5.0)) * 0.4;
          foam = smoothstep(0.9, 1.0, uv.y) * (0.6 + 0.4 * n(vec2(uv.x * 20.0, uv.y * 30.0 - uTime * 6.0)));
          foam += (1.0 - smoothstep(0.0, 0.2, min(uv.x, 1.0 - uv.x))) * 0.35 * n(vec2(uv.x * 30.0, uv.y * 60.0 - uTime * 4.0));
        }
        vec3 deep = vec3(0.12, 0.45, 0.66), shallow = vec3(0.36, 0.74, 0.86);
        vec3 col = mix(deep, shallow, rip * 0.7 + (1.0 - edge) * 0.4);
        col += vec3(1.0) * smoothstep(0.72, 0.95, rip) * 0.35;
        col = mix(col, vec3(0.95, 0.99, 1.0), clamp(foam, 0.0, 1.0));
        col *= mix(1.0, 0.4, uNight);
        float a = mix(0.78, 0.95, foam) * edge;
        gl_FragColor = vec4(col, a);
        #include <fog_fragment>
      }`,
  });
  mat.uniforms.uTime = sharedUniforms.uTime;
  return mat;
}
