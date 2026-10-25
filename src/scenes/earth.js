// Chapter 1 — Earth: Jacinta's neighborhood and park. Five acts of kindness
// light up the hearts that open the portal to Pinky Land.
import * as THREE from 'three';
import { Level } from './level.js';
import { Terrain } from '../world/terrain.js';
import { World } from '../world/world.js';
import { Clouds } from '../world/clouds.js';
import { createGrass, createFlowers, createTrees, createBushes, createRocks } from '../world/vegetation.js';
import { createHouse, createPlayground, createBench, createTrashBin, createBike, createSign, createFence, Portal, createCollectible, animateCollectible } from '../world/props.js';
import { Creatures } from '../world/creatures.js';
import { Kid } from '../characters/kid.js';
import { KIDS } from '../characters/style.js';
import { NPC, Follower } from '../characters/npc.js';
import { Pet, PET_LOOKS, Songbirds } from '../world/pets.js';
import { makeNoise2D, makeRandom, smoothstep } from '../util/noise.js';

const ROAD_Z = -44; // the street runs BEHIND the houses, so Jacinta never has to cross it
const WALK_Z = -20.4; // the sidewalk in front of the houses, along the park
const MANGO_X = -25.5, MANGO_Z = 11; // the hurt parrot's stump, out in the open where it's easy to see
const KITTEN_SPOT = { x: 24.6, z: 24.2 }; // the lost kitten hides by the bushes in the far corner of the park
const MAMA_YARD = { x: 43.2, z: -25.2 }; // her mama lives in the front yard of the blue house
const LITTER_SPOTS = [[-4, 8], [16, 6], [-20, 22], [8, 32], [22, 22], [-26, 4], [3, -2], [-14, 30]]; // litter in the park
const PINKY = { who: 'Pinky', color: '#f08aa8', pitch: 1.4 };
const J = { who: 'Jacinta', color: '#ff6fa8', pitch: 1.2 };
const L = { who: 'Liev', color: '#2f7de1', pitch: 0.95 };
const line = (who, text, extra = {}) => ({ ...who, text, ...extra });

export class EarthLevel extends Level {
  constructor(game) {
    super(game, 'earth');
    const s = game.state;
    s.earth = s.earth || { hearts: [], liev: false, bandage: false, mayaMet: false, mango: 'hurt', litter: 0, bullyDone: false };
    this.E = s.earth;
  }

  async build() {
    const g = this.game;
    const noise = makeNoise2D(31);
    const rand = makeRandom(8);
    this.setupSky(g.state.time ?? 0.37);

    // ---- ground
    const height = (x, z) => {
      const nearRoad = smoothstep(4, 14, Math.abs(z - ROAD_Z));
      const nearHouses = z < -8 ? 0.2 : 1;
      let h = noise(x * 0.025, z * 0.025) * 0.9 + noise(x * 0.08, z * 0.08) * 0.15;
      h *= nearRoad * nearHouses;
      // a little hill behind the wishing tree
      h += Math.exp(-((x) ** 2 + (z - 46) ** 2) / 300) * 3.5;
      return h + 0.2;
    };
    const color = (x, z, h, out) => {
      const n = noise(x * 0.06 + 10, z * 0.06);
      out.setHSL(0.27 + n * 0.03, 0.45, 0.42 + n * 0.05);
      const path = this._pathAmount(x, z);
      if (path > 0) out.lerp(new THREE.Color('#d8c3a0'), path);
    };
    this.terrain = new Terrain({ size: 220, segments: 160, height, color });
    this.scene.add(this.terrain.mesh);
    this.world = new World({ terrain: this.terrain, waterLevel: -20, bounds: { x: 0, z: 8, r: 62, soft: 57 } });
    this.mapBounds = { x0: -66, x1: 66, z0: -48, z1: 70 };

    // ---- road & sidewalks
    const road = new THREE.Mesh(new THREE.PlaneGeometry(220, 7), new THREE.MeshStandardMaterial({ color: '#57545f', roughness: 0.95 }));
    road.rotation.x = -Math.PI / 2;
    road.position.set(0, 0.23, ROAD_Z);
    road.receiveShadow = true;
    this.scene.add(road);
    this.world.addColliders([{ type: 'box', x: 0, z: ROAD_Z, hw: 110, hd: 3.5, top: 0.23, bottom: -1 }]);
    const dashMat = new THREE.MeshBasicMaterial({ color: '#ffe27a' });
    for (let x = -100; x < 100; x += 6) {
      const d = new THREE.Mesh(new THREE.PlaneGeometry(2.5, 0.2), dashMat);
      d.rotation.x = -Math.PI / 2;
      d.position.set(x, 0.24, ROAD_Z);
      this.scene.add(d);
    }
    // the sidewalk in front of the houses leads straight to the park
    const sw = new THREE.Mesh(new THREE.BoxGeometry(220, 0.15, 2.2), new THREE.MeshStandardMaterial({ color: '#d9d4dc', roughness: 0.9 }));
    sw.position.set(0, 0.26, WALK_Z);
    sw.receiveShadow = true;
    this.scene.add(sw);
    this.world.addColliders([{ type: 'box', x: 0, z: WALK_Z, hw: 110, hd: 1.1, top: 0.335, bottom: -1 }]);
    // backyard fences keep everyone away from the street behind the houses
    for (let x = -60; x < 60; x += 10) {
      const f = createFence(10);
      f.position.set(x + 5, 0.2, -35.2);
      this.scene.add(f);
    }
    this.world.addColliders([{ type: 'box', x: 0, z: -35.4, hw: 110, hd: 0.4, top: 3, bottom: -1, noStand: true }]);

    // ---- houses along the street
    const houses = [
      { x: 0, color: '#ffd6e6', roof: '#e0609a', door: '#7a4a8a', label: "Jacinta's House" },
      { x: -22, color: '#d9c8ff', roof: '#7a5ab8', door: '#ffd34d', label: "Mrs. Rosa's House" },
      { x: 22, color: '#fff0c4', roof: '#d9705a', door: '#3d7ea6' },
      { x: -44, color: '#c8f0e0', roof: '#4f9d69', door: '#d9605a' },
      { x: 44, color: '#cfe6ff', roof: '#5a7ab8', door: '#ff9a3c' },
    ];
    this.houseWindows = [];
    for (const h of houses) {
      const house = createHouse({ color: h.color, roof: h.roof, door: h.door });
      house.position.set(h.x, 0.2, -30);
      this.scene.add(house);
      this.houseWindows.push(house.userData.windowMat);
      this.world.addColliders([{ type: 'box', x: h.x, z: -30, hw: 3.1, hd: 2.6, top: 5.5, bottom: -1 }]);
      // walkway to the sidewalk
      const walk = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.1, 6), new THREE.MeshStandardMaterial({ color: '#e8dcc8' }));
      walk.position.set(h.x, 0.24, -24.5);
      walk.receiveShadow = true;
      this.scene.add(walk);
      if (h.label) this.landmarks.push({ x: h.x, z: -30, icon: '🏠', label: h.label, always: true });
      this.mapFeatures = this.mapFeatures || [];
      this.mapFeatures.push({ type: 'house', x: h.x, z: -30, roof: h.roof });
      // white picket fence in front yard
      for (const s of [-1, 1]) {
        const f = createFence(4);
        f.position.set(h.x + s * 3.2, 0.2, -23.2);
        this.scene.add(f);
      }
    }

    // ---- park
    const pg = createPlayground();
    pg.position.set(-18, this.terrain.getHeight(-18, 10), 10);
    this.scene.add(pg);
    this.swingSeats = pg.children[0].userData.seats;
    this.world.addColliders([{ type: 'box', x: -18, z: 10, hw: 1.8, hd: 0.7, top: 2.6, bottom: -1 }, { type: 'box', x: -13.5, z: 9.6, hw: 0.5, hd: 1.6, top: 2.0, bottom: -1 }]);
    this.landmarks.push({ x: -16, z: 10, icon: '🛝', label: 'Playground' });
    this.mapFeatures.push({ type: 'playground', x: -16, z: 10 }, { type: 'label', x: 0, z: -40, text: 'Maple Street', color: 'rgba(80,70,90,0.8)' });
    const benchSpots = [[12, 14, -Math.PI / 2 - 0.3], [18, 26, -Math.PI / 2 - 0.8], [-6, 2, 0.3]];
    for (const [x, z, r] of benchSpots) {
      this.mapFeatures.push({ type: 'bench', x, z });
      const b = createBench();
      b.position.set(x, this.terrain.getHeight(x, z), z);
      b.rotation.y = r;
      this.scene.add(b);
      this.world.addColliders([{ type: 'box', x, z, hw: 0.95, hd: 0.35, rot: r, top: this.terrain.getHeight(x, z) + 0.5, bottom: -1 }]);
    }
    this.bin = createTrashBin();
    this.binPos = new THREE.Vector3(5, this.terrain.getHeight(5, 27), 27);
    this.bin.position.copy(this.binPos);
    this.scene.add(this.bin);
    this.world.addColliders([{ type: 'cyl', x: 5, z: 27, r: 0.35, top: this.binPos.y + 0.9, bottom: -1, noStand: true }]);
    const sign = createSign('Sunny Hill\nPark');
    sign.position.set(-3.5, this.terrain.getHeight(-3.5, -7), -7);
    sign.rotation.y = 0.3;
    this.scene.add(sign);
    // park helper kiosk
    const kiosk = createHouse({ color: '#e8f6e0', roof: '#4f9d69', door: '#d9605a', w: 3, d: 2.6, h: 2.4 });
    kiosk.position.set(24, this.terrain.getHeight(24, 2), 2);
    kiosk.rotation.y = -Math.PI / 2;
    kiosk.scale.setScalar(0.9);
    this.scene.add(kiosk);
    this.world.addColliders([{ type: 'box', x: 24, z: 2, hw: 1.3, hd: 1.5, top: 4, bottom: -1 }]);
    const kioskSign = createSign('Park Helper\n+ First Aid');
    kioskSign.position.set(21.5, this.terrain.getHeight(21.5, 4.5), 4.5);
    kioskSign.rotation.y = -1.2;
    this.scene.add(kioskSign);

    // trees
    const treeSpots = [];
    for (let i = 0; i < 70; i++) {
      const a = rand() * Math.PI * 2;
      const r = 36 + rand() * 30;
      const x = Math.cos(a) * r, z = 12 + Math.sin(a) * r;
      if (z < -8) continue;
      treeSpots.push({ x, z, kind: rand() < 0.4 ? 'tall' : 'round', color: rand() < 0.15 ? '#ffb3cf' : ['#6fbf5f', '#7cc96b', '#5fae55'][Math.floor(rand() * 3)] });
    }
    treeSpots.push({ x: -30, z: 6, kind: 'round', color: '#7cc96b', scale: 1.2 }); // Mango's tree
    treeSpots.push({ x: 26, z: 18, kind: 'round', color: '#ffc4dc' }, { x: -24, z: 28, kind: 'tall', color: '#6fbf5f' }, { x: 30, z: -6, kind: 'round', color: '#7cc96b' });
    // street trees
    for (const x of [-55, -33, -11, 11, 33, 55]) treeSpots.push({ x, z: -16.5, kind: 'round', color: '#7cc96b', scale: 0.8 });
    // pretty trees around Jacinta's house
    treeSpots.push(
      { x: -7.2, z: -24.6, kind: 'round', color: '#ffb3d1', scale: 0.9 }, { x: 7.4, z: -25, kind: 'round', color: '#ffc9e0', scale: 0.95 },
      { x: -8, z: -31.5, kind: 'tall', color: '#6fbf5f', scale: 1.0 }, { x: 8.2, z: -31.8, kind: 'round', color: '#7cc96b', scale: 1.15 },
      { x: -4.5, z: -33.5, kind: 'round', color: '#fbd3ff', scale: 0.8 }, { x: 4.6, z: -33.6, kind: 'tall', color: '#8fd47a', scale: 0.85 },
    );
    this.mapTitle = 'Sunny Hill Park';
    this.mapHasWater = false;
    this.mapFeatures = this.mapFeatures || [];
    for (const t of [...treeSpots, { x: 0, z: 46, color: '#ff9ec6', scale: 2.2 }]) this.mapFeatures.push({ type: 'tree', x: t.x, z: t.z, color: t.color, r: 2.0 * (t.scale || 1) });
    const trees = createTrees(this.terrain, treeSpots, { seed: 3 });
    this.scene.add(trees.group);
    this.world.addColliders(trees.colliders);
    // the big wishing tree on the hill behind the portal
    const wish = createTrees(this.terrain, [{ x: 0, z: 46, kind: 'round', color: '#ff9ec6', scale: 2.2 }], { seed: 99 });
    this.scene.add(wish.group);
    this.world.addColliders(wish.colliders);
    this.scene.add(createBushes(this.terrain, Array.from({ length: 30 }, (_, i) => {
      const a = (i / 30) * Math.PI * 2;
      return { x: Math.cos(a) * 30, z: 14 + Math.sin(a) * 26, color: i % 4 ? '#5fae55' : '#7fc06a' };
    }).filter((b) => b.z > -6 && Math.hypot(b.x - MANGO_X, b.z - MANGO_Z) > 3.5)));
    const rocks = createRocks(this.terrain, [{ x: -8, z: 30 }, { x: 14, z: 36, scale: 1.5 }, { x: -34, z: 20 }, { x: 32, z: 30, scale: 1.2 }]);
    this.scene.add(rocks.group);
    this.world.addColliders(rocks.colliders);

    // grass & flowers
    const q = g.engine.q;
    const grassWhere = (x, z, h) => (z < -8 ? (Math.abs(z + 24.5) < 3.5 ? 0 : 0.5) : 1) * (1 - this._pathAmount(x, z) * 1.5) * (Math.abs(z - ROAD_Z) < 6 || Math.abs(z - WALK_Z) < 1.3 || Math.hypot(x - MANGO_X, z - MANGO_Z) < 1.6 || LITTER_SPOTS.some(([lx, lz]) => Math.hypot(x - lx, z - lz) < 0.9) ? 0 : 1);
    this.scene.add(createGrass(this.terrain, { count: Math.floor(140000 * q.grass), area: 130, center: [0, 12], where: grassWhere, height: [0.18, 0.4], width: [0.4, 0.6] }));
    this.scene.add(createFlowers(this.terrain, {
      count: Math.floor(3000 * q.grass), area: 120, center: [0, 14],
      where: (x, z) => (z < -6 ? 0 : (noise(x * 0.07, z * 0.07) > 0.2 ? 0.9 : 0.05)) * (1 - this._pathAmount(x, z) * 2),
    }));

    this.clouds = new Clouds(this.scene, { count: 22, area: 600, height: [70, 120] });

    // ---- portal at the wishing tree
    const pz = 38;
    this.portal = new Portal(this.scene, new THREE.Vector3(0, this.terrain.getHeight(0, pz), pz), Math.PI);
    this.portal.setHearts(this.doorOpen() ? Math.max(5, this.E.hearts.length) : this.E.hearts.length);
    this.updaters.push((dt) => this.portal.update(dt));
    this.landmarks.push({ x: 0, z: pz, icon: '🌀', label: 'Wishing Tree Door', always: true });
    this.addInteractable({
      pos: new THREE.Vector3(0, this.terrain.getHeight(0, pz), pz), radius: 3,
      label: () => (this.doorOpen() ? 'Step through the door to Pinky Land!' : 'Look at the magic door'),
      action: () => this.portalAction(),
    });

    // ---- creatures (a few birds in the sky)
    this.creatures = new Creatures(this.scene, this.world, this.game.models);
    this.creatures.addFlyers('stork', { center: { x: 10, z: 10 }, radius: 50, height: 32, count: 2, scale: 0.01, speed: 0.08, journalKey: null, name: 'Stork' });
    this.creatures.addButterflies({ center: { x: 0, z: 18 }, radius: 25, count: 10, getHeight: (x, z) => this.terrain.getHeight(x, z) });

    // ---- player, Liev, Pinky
    // coming back through the magic door from Pinky Land: step out in front of the Wishing Tree
    if (this.arriveAt?.portal) this.setupPlayer(new THREE.Vector3(0, 0, pz - 4), Math.PI);
    else this.setupPlayer(new THREE.Vector3(0, 0, -21.5), 0);
    this.buildPeople();
    this.buildQuests();
  }

  _pathAmount(x, z) {
    // a ring path around the park and a path from the street to the wishing tree
    const ring = Math.abs(Math.hypot(x, z - 16) - 15);
    const straight = Math.abs(x) < 1.4 && z > -19.5 && z < 40 ? 1 - Math.abs(x) / 1.4 : 0;
    return Math.max(ring < 1.3 ? 1 - ring / 1.3 : 0, straight);
  }

  availableAvatars() { return this.E.liev ? ['jacintaPack', 'liev'] : ['jacintaPack']; }

  buildPeople() {
    const g = this.game;
    const W = this.world;
    // Liev (also playable once you meet him)
    this.lievNPC = null;
    if (!this.E.liev) {
      this.lievNPC = this.addNPC(new NPC(g.avatarModels.liev, W, { x: 5, z: -6.5, yaw: -2.2, name: 'Liev', journalKey: 'liev' }));
      this.ball = new THREE.Mesh(new THREE.SphereGeometry(0.11, 16, 12), new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.4 }));
      this.ball.castShadow = true;
      this.scene.add(this.ball);
      this.updaters.push(() => {
        if (!this.lievNPC) return;
        const t = this.time;
        const p = this.lievNPC.root.position;
        // keepy-uppy!
        this.ball.position.set(p.x + Math.sin(this.lievNPC.yaw) * 0.4, p.y + 0.15 + Math.abs(Math.sin(t * 4)) * 0.9, p.z + Math.cos(this.lievNPC.yaw) * 0.4);
        this.lievNPC.model.legs[1].leg.rotation.x = Math.sin(t * 8) > 0.6 ? -0.8 : 0;
      });
    }

    // Maya — fell off her bike
    this.maya = this.addNPC(new NPC(new Kid(KIDS.maya), W, { x: 9, z: -3, yaw: -0.8, name: 'Maya', journalKey: 'maya' }));
    this.bike = createBike();
    this.bike.position.set(10.5, this.terrain.getHeight(10.5, -2) + 0.25, -2);
    this.bike.rotation.set(0, 0.6, Math.PI / 2 - 0.2);
    this.scene.add(this.bike);

    // Oliver — sad on the bench
    this.oliver = this.addNPC(new NPC(new Kid(KIDS.oliver), W, { x: 12.2, z: 14.3, yaw: -Math.PI / 2 - 0.3, name: 'Oliver', journalKey: 'oliver' }));
    // Sam and Brock — at the playground
    this.sam = this.addNPC(new NPC(new Kid(KIDS.sam), W, { x: -11, z: 19, yaw: 2.5, name: 'Sam', journalKey: 'sam' }));
    this.brock = this.addNPC(new NPC(new Kid(KIDS.brock), W, { x: -12.6, z: 17.2, yaw: 0.6, name: 'Brock', journalKey: 'brock' }));
    this.samBall = new THREE.Mesh(new THREE.SphereGeometry(0.13, 16, 12), new THREE.MeshStandardMaterial({ color: '#ff9a3c', roughness: 0.5 }));
    this.samBall.castShadow = true;
    this.scene.add(this.samBall);
    // grown-ups
    this.rosa = this.addNPC(new NPC(new Kid(KIDS.rosa), W, { x: -22, z: -24.6, yaw: 0, name: 'Mrs. Rosa', journalKey: 'rosa' }));
    this.hughes = this.addNPC(new NPC(new Kid(KIDS.hughes), W, { x: 21.4, z: 1.8, yaw: -Math.PI / 2, name: 'Mr. Hughes', journalKey: 'hughes' }));

    // Mango the parrot
    const pm = this.game.models.parrot;
    this.mango = new THREE.Group();
    if (pm) {
      const bird = pm.scene.clone();
      bird.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.frustumCulled = false; } });
      bird.scale.setScalar(0.0068);
      bird.rotation.y = 0;
      this.mango.add(bird);
      this.mangoMixer = new THREE.AnimationMixer(bird);
      this.mangoAction = this.mangoMixer.clipAction(pm.animations[0]);
      this.mangoAction.play();
      this.mangoAction.time = 0.15;
      this.mangoBird = bird;
    }
    this.scene.add(this.mango);
    // a little tree stump for Mango to rest on, so he's easy to spot above the grass
    const stump = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.36, 0.44, 12), new THREE.MeshStandardMaterial({ color: '#8a5a3c', roughness: 1 }));
    stump.position.set(MANGO_X, this.terrain.getHeight(MANGO_X, MANGO_Z) + 0.22, MANGO_Z);
    stump.castShadow = stump.receiveShadow = true;
    this.scene.add(stump);
    const rings = new THREE.Mesh(new THREE.CircleGeometry(0.29, 16), new THREE.MeshStandardMaterial({ color: '#d9b38c' }));
    rings.rotation.x = -Math.PI / 2;
    rings.position.set(MANGO_X, this.terrain.getHeight(MANGO_X, MANGO_Z) + 0.445, MANGO_Z);
    this.scene.add(rings);
    this.mangoT = 0;
    this.updaters.push((dt) => this.updateMango(dt));

    this.applyQuestState();
    this.buildPets();
    this.buildKitten();
  }

  // Jacinta's furry neighbors — she can talk to all of them
  buildPets() {
    const g = this.game;
    const W = this.world;
    const homes = {
      buddy: { x: 1.8, z: -24.2, r: 2.2, follow: 26 },
      gil: { x: 1.4, z: -26.7, r: 0.6 },
      joe: { x: -6.6, z: -25.6, r: 1.1 },
      molly: { x: -1.9, z: -26.6, r: 0.7 },
      bagel: { x: -2.6, z: -26.1, r: 0.7 },
      albany: { x: 6.8, z: -23.8, r: 1.8, tree: { x: 7.4, z: -25, h: 2.4 } },
    };
    this.pets = {};
    for (const [key, home] of Object.entries(homes)) {
      const pet = new Pet(PET_LOOKS[key], W, home);
      if (key === 'buddy') pet.followPlayer = true;
      if (key === 'gil') { pet.state = 'sit'; pet.stateT = 6; }
      this.scene.add(pet.root);
      this.pets[key] = pet;
      // Buddy and the cats are big enough to bump into (not while Buddy trots after you)
      const L = PET_LOOKS[key];
      if (L.kind === 'dog' || L.kind === 'cat') W.addBody({ pos: pet.pos, r: L.len * 0.42, h: pet.hipY + L.r * 2, active: () => pet.state !== 'follow' });
    }
    // songbirds land where you can see them: the sidewalk, garden paths and fence posts
    const perches = [{ x: 0, z: WALK_Z, y: 0.34, hw: 14, hd: 0.8 }];
    for (const hx of [-22, 0, 22]) {
      perches.push({ x: hx, z: -24.5, y: 0.3, hw: 0.55, hd: 2.6 });
      for (const sd of [-1, 1]) for (let i = 0; i <= 6; i++) perches.push({ x: hx + sd * 3.2 - 2 + i * 0.6, z: -23.2, y: 1.0, hw: 0, hd: 0 });
    }
    this.songbirds = new Songbirds(this.scene, W, { center: { x: 0, z: -24 }, count: 6, perches });
    const PK = { who: 'Pinky', color: '#f08aa8', pitch: 1.4 };
    const talks = {
      buddy: { sound: 'bark', color: '#d98a3c', lines: [
        ['Woof! Woof woof! *wag wag wag*', 'Buddy says you’re his favorite person in the whole world. He wants to come to the park with you!'],
        ['*sniff sniff* Woof!', 'Buddy smelled a squirrel. He says he’s not going to chase it. Probably.'],
        ['Arf! *rolls over*', 'Buddy wants a belly rub! His legs are short, but his heart is BIG.'],
      ] },
      gil: { sound: 'meow', color: '#4a4a5a', lines: [
        ['Mrrrrow.', 'Gil says this sunny spot on the porch is HIS spot. But you can sit next to him.'],
        ['Mew. *slow blink*', 'A slow blink from a cat means “I love you.” Gil just said it to you!'],
      ] },
      joe: { sound: 'purr', color: '#4a4a5a', lines: [
        ['Prrrrrrrr…', 'Joe’s fur is SO long and fluffy. He says he loves being brushed.'],
        ['Mrrp?', 'Joe wants to know if you have any treats. He always wants treats.'],
      ] },
      molly: { sound: 'squeak', color: '#9a98a2', lines: [
        ['Squeak! Squeak!', 'Molly says thank you for the strawberry! She’s saving half of it for later.'],
        ['*whiskers wiggle*', 'Molly is gray and white, and she’s the best at climbing. She says hi to Pinky!'],
      ] },
      bagel: { sound: 'squeak', color: '#6a4a38', lines: [
        ['Squeak squeak squeak!', 'Bagel found a cracker crumb and he is VERY proud of it.'],
        ['*sniff sniff*', 'Bagel’s little white paws look like he’s wearing socks. He likes it when you notice.'],
      ] },
      albany: { sound: 'chatter', color: '#b9b3c8', lines: [
        ['Chk-chk-chk! *flicks tail*', 'Albany says she’s the only WHITE squirrel in the whole town. She’s very proud of that.'],
        ['Chk! Chk-chk!', () => (this.mangoState === 'hurt' ? 'Albany says she saw a little red parrot on a tree stump on the west side of the park. He looked hurt!' : 'Albany says the acorns are extra crunchy this year.')],
      ] },
    };
    const keyNames = { buddy: 'Buddy', gil: 'Gil', joe: 'Joe', molly: 'Molly', bagel: 'Bagel', albany: 'Albany' };
    for (const [key, pet] of Object.entries(this.pets)) {
      const tk = talks[key];
      let idx = 0;
      this.addInteractable({
        pos: () => pet.root.position, radius: 2.0, label: `Talk to ${keyNames[key]}`,
        action: async () => {
          this.journalCheck(key, keyNames[key]);
          g.audio[tk.sound]?.();
          if (key !== 'albany' || pet.state !== 'climb') { pet.state = key === 'buddy' ? 'sit' : pet.state; pet.stateT = 3; }
          const [sound, meaning] = tk.lines[idx % tk.lines.length];
          idx++;
          await g.ui.dialogue([
            { who: keyNames[key], color: tk.color, pitch: key === 'buddy' ? 0.8 : 1.8, text: sound },
            { ...PK, text: typeof meaning === 'function' ? meaning() : meaning },
          ]);
        },
      });
    }
    // songbirds go in the journal when you see them
    this.updaters.push((dt) => {
      const p = this.player.pos;
      for (const pet of Object.values(this.pets)) pet.update(dt, p);
      this.songbirds.update(dt, p);
      if (!this._sawBirds && this.songbirds.birds.some((b) => b.m.position.distanceTo(p) < 8)) { this._sawBirds = true; this.journalCheck('songbird', 'Songbirds'); }
    });
  }

  // ---- a lost kitten in the park, and her worried mama by the blue house
  buildKitten() {
    const g = this.game, W = this.world, E = this.E;
    if (E.kitten === 'carried' || !E.kitten) E.kitten = E.kitten === 'home' ? 'home' : 'lost'; // a carried kitten waits in the park again after a reload
    this.kittenState = E.kitten;
    const mom = new Pet(PET_LOOKS.clementine, W, { ...MAMA_YARD, r: 2.0 });
    const kit = new Pet(PET_LOOKS.peaches, W, this.kittenState === 'home' ? { x: MAMA_YARD.x + 0.5, z: MAMA_YARD.z, r: 0.7 } : { ...KITTEN_SPOT, r: 0.25 });
    if (this.kittenState === 'lost') { kit.state = 'sit'; kit.stateT = 99; }
    this.scene.add(mom.root, kit.root);
    this.mamaCat = mom; this.kitten = kit;
    kit.root.scale.setScalar(1.25); // a little easier to spot in the grass
    W.addBody({ pos: mom.pos, r: 0.16, h: mom.hipY + 0.18 });
    // a little ring of flowers so she's easy to spot once you get close
    this.scene.add(createFlowers(this.terrain, { count: 60, area: 3, center: [KITTEN_SPOT.x, KITTEN_SPOT.z], where: () => 1 }));
    const MAMA = { who: 'Clementine', color: '#d07a2c', pitch: 1.0 };
    const KIT = { who: 'Peaches', color: '#f0a060', pitch: 2.0 };
    this._mewT = 2;
    this.updaters.push((dt) => {
      const p = this.player.pos;
      if (this.kittenState === 'carried') {
        const m = this.player.model, hand = m.arms?.[0]?.hand;
        if (hand) {
          const a = new THREE.Vector3(), b = new THREE.Vector3();
          m.arms[0].hand.getWorldPosition(a); m.arms[1].hand.getWorldPosition(b);
          kit.root.position.copy(a).lerp(b, 0.5); kit.root.position.y -= 0.05;
          kit.root.rotation.set(0, this.player.yaw + Math.PI / 2, 0);
        }
      } else {
        if (this.kittenState === 'home') { kit.home.x = mom.pos.x + 0.45; kit.home.z = mom.pos.z + 0.2; }
        kit.update(dt, p);
      }
      mom.update(dt, p);
      // the kitten mews and her mama calls, so you can find them by listening
      this._mewT -= dt;
      if (this._mewT < 0 && this.kittenState !== 'home') {
        this._mewT = 2.6 + Math.random() * 2;
        const dk = p.distanceTo(kit.root.position), dm = p.distanceTo(mom.pos);
        if (this.kittenState === 'lost' && dk < 28) g.audio.meow(1.55, Math.max(0.15, 1 - dk / 28));
        if (dm < 24 && Math.random() < 0.6) setTimeout(() => g.audio.meow(0.85, Math.max(0.15, 1 - dm / 24) * 0.8), 700);
      }
    });
    this.addInteractable({
      pos: () => kit.root.position, radius: 1.8,
      label: () => (this.kittenState === 'lost' ? 'Gently pick up the little kitten' : 'Pet Peaches'),
      enabled: () => this.kittenState !== 'carried' && this.mangoState !== 'carried',
      action: async () => {
        if (this.kittenState === 'home') {
          g.audio.purr();
          return g.ui.dialogue([line(KIT, 'Mew! *purr purr*'), line(PINKY, 'Peaches says thank you for bringing her home. She’s going to take a nap with her mama now.')]);
        }
        g.audio.meow(1.55, 1);
        await g.ui.dialogue([
          line(KIT, 'Mew… mew…'),
          line(J, 'Oh! A teeny tiny kitten, all by herself. She’s shivering.'),
          line(PINKY, 'She’s too little to be out here alone. She must be lost! Her collar says “Peaches.”'),
          line(J, 'Don’t worry, Peaches. I’ll hold you safe and we’ll find your mommy.'),
          line(PINKY, 'Let’s listen for a grown-up cat calling for her baby. Maybe near the houses?'),
        ]);
        this.kittenState = 'carried'; E.kitten = 'carried';
        this.player.model.anim.persist = true;
        this.player.model.playAction('carry', 99999);
        this.journalCheck('peaches', 'Peaches');
        g.saveGame();
      },
    });
    this.addInteractable({
      pos: () => mom.pos, radius: 2.0, label: () => (this.kittenState === 'carried' ? 'Give Peaches back to her mama' : 'Talk to the orange cat'),
      action: async () => {
        this.journalCheck('clementine', 'Clementine');
        if (this.kittenState === 'carried') {
          await g.ui.dialogue([
            line(MAMA, 'MRROW?! Mrrrow!'),
            line(KIT, 'Mew! Mew mew!'),
            line(J, 'Is this your baby? I found her all alone by the bushes in the far corner of the park.'),
          ]);
          this.player.model.anim.persist = false;
          this.player.model.anim.action = null;
          this.player.model.anim.actionT = 0;
          this.kittenState = 'home'; E.kitten = 'home';
          kit.pos.set(mom.pos.x + 0.45, this.terrain.getHeight(mom.pos.x, mom.pos.z), mom.pos.z + 0.2);
          kit.home = { x: mom.pos.x + 0.45, z: mom.pos.z + 0.2, r: 0.7 };
          kit.state = 'idle'; kit.stateT = 2; mom.state = 'sit'; mom.stateT = 6;
          g.audio.purr();
          this.giveHeart('kitten', mom.pos.clone());
          await g.ui.dialogue([
            line(MAMA, 'Prrrrrrr… *lick lick*'),
            line(PINKY, 'Her mama is giving her kitty kisses! Clementine says thank you for keeping her baby safe.'),
            line(J, 'Bye, Peaches. Stay close to your mommy, okay?'),
          ]);
          return;
        }
        g.audio.meow(0.85, 1);
        if (this.kittenState === 'lost') return g.ui.dialogue([line(MAMA, 'Mrrrow? MRRROW?'), line(PINKY, 'She keeps calling and looking all around. Her tag says “Clementine.” I think she lost her kitten!'), line(J, 'Let’s look for a little kitten in the park. Listen for tiny mews!')]);
        return g.ui.dialogue([line(MAMA, 'Prrrr… *slow blink*'), line(PINKY, 'Clementine is so happy her baby is home. A slow blink means “I love you”!')]);
      },
    });
  }

  applyQuestState() {
    const E = this.E;
    const has = (id) => E.hearts.includes(id);
    // Maya
    if (has('maya')) { this.maya.model.setMood('happy'); this.maya.model.anim.sit = false; this.maya.root.position.set(11.5, this.terrain.getHeight(11.5, -1), -1); this.bike.rotation.set(0, 0.6, 0); this.bike.position.y = this.terrain.getHeight(10.5, -2) + 0.3; }
    else { this.maya.model.setMood('hurt'); this.maya.model.anim.sit = true; }
    // Oliver
    if (has('oliver')) { this.oliver.model.setMood('happy'); this.oliver.model.anim.sit = false; this.oliver.root.position.set(-8, this.terrain.getHeight(-8, 21), 21); this.oliver.wander = { x: -10, z: 18, r: 4 }; }
    else { this.oliver.model.setMood('sad'); this.oliver.model.anim.sit = true; this.oliver.fixedY = true; this.sitOnBench(this.oliver, 12, 14); }
    // Sam & Brock
    if (has('bully')) { this.sam.model.setMood('happy'); this.brock.model.setMood('happy'); }
    else { this.sam.model.setMood('sad'); this.sam.model.playAction('sad', 9999); this.brock.model.setMood('mean'); this.brock.model.anim.persist = true; }
    // Mango
    if (E.mango === 'home') this.mangoState = 'flying';
    else this.mangoState = 'hurt';
  }

  // place a kid so they sit ON the bench seat (feet dangling), not inside it
  sitOnBench(npc, x, z) {
    const SEAT_TOP = 0.48;
    const m = npc.model;
    const seatDrop = m.dims ? m.dims.shin * m.body.scale.y : 0;
    npc.root.position.set(x, this.terrain.getHeight(x, z) + SEAT_TOP - seatDrop, z);
  }

  updateMango(dt) {
    this.mangoMixer?.update(this.mangoState === 'hurt' ? 0 : dt);
    this.mangoT += dt;
    if (this.mangoState === 'hurt') {
      const x = MANGO_X, z = MANGO_Z;
      this.mango.position.set(x, this.terrain.getHeight(x, z) + 0.46 + Math.abs(Math.sin(this.mangoT * 1.5)) * 0.02, z);
      // chirp now and then so Jacinta can find him by listening
      this._chirpT = (this._chirpT ?? 2) - dt;
      if (this._chirpT < 0) {
        this._chirpT = 2.5 + Math.random() * 2;
        const d = this.player.pos.distanceTo(this.mango.position);
        if (d < 30) this.game.audio.bird(Math.max(0.15, 1 - d / 30));
      }
      this.mango.rotation.set(0, 2.4, 0.35); // wing drooping
      if (this.mangoAction) this.mangoAction.time = 0.15;
    } else if (this.mangoState === 'carried') {
      const m = this.player.model;
      const hand = m.arms?.[0]?.hand;
      if (hand) {
        const p = new THREE.Vector3();
        m.arms[0].hand.getWorldPosition(p);
        const p2 = new THREE.Vector3();
        m.arms[1].hand.getWorldPosition(p2);
        this.mango.position.copy(p).lerp(p2, 0.5);
        this.mango.position.y += 0.06;
        this.mango.rotation.set(0, this.player.yaw, 0);
      }
    } else {
      // happily flying loops around Mrs. Rosa's house
      const t = this.mangoT * 0.6;
      const cx = -22, cz = -27;
      this.mango.position.set(cx + Math.cos(t) * 7, 7 + Math.sin(t * 2) * 1.2, cz + Math.sin(t) * 5);
      this.mango.rotation.set(0, Math.atan2(-Math.sin(t) * 7, Math.cos(t) * 5), -0.3);
    }
  }

  // ------------------------------------------------------------
  buildQuests() {
    const g = this.game;
    const E = this.E;
    const has = (id) => E.hearts.includes(id);

    // Liev
    if (this.lievNPC) {
      this.addInteractable({
        pos: () => this.lievNPC?.root.position || new THREE.Vector3(999, 0, 999),
        enabled: () => !E.liev, label: 'Talk to Liev',
        action: () => this.talkLiev(),
      });
    }
    // Maya
    this.addInteractable({
      pos: () => this.maya.root.position, label: 'Talk to Maya',
      action: async () => {
        g.journalSeen('maya', 'Maya');
        if (has('maya')) return g.ui.dialogue([line({ who: 'Maya', color: '#7b68ee' }, 'Look, my bandage has little stars on it! Thanks again, Jacinta!')]);
        if (E.bandage) {
          this.player.model.playAction('give', 1.6);
          await g.ui.dialogue([
            line(J, 'Here, Maya. I brought you a bandage from Mr. Hughes.'),
            line({ who: 'Maya', color: '#7b68ee' }, 'Oh! It has stars on it!'),
            line(J, 'Let me help you put it on. Gently… there!'),
            line({ who: 'Maya', color: '#7b68ee' }, 'It already feels better. You’re a really good friend.', { onShow: () => { this.maya.model.setMood('happy'); this.maya.model.anim.sit = false; } }),
          ]);
          E.bandage = false;
          this.bike.rotation.set(0, 0.6, 0);
          this.bike.position.y = this.terrain.getHeight(10.5, -2) + 0.3;
          this.maya.model.playAction('cheer', 2);
          this.giveHeart('maya', this.maya.root.position);
          return;
        }
        E.mayaMet = true;
        await g.ui.dialogue([
          line({ who: 'Maya', color: '#7b68ee' }, 'Ow… ow… I fell off my bike and scraped my knee.'),
          line(J, 'Oh no! Are you okay?'),
          line({ who: 'Maya', color: '#7b68ee' }, 'It really stings. I wish I had a bandage.'),
          line(PINKY, '(whispering) Jacinta! Mr. Hughes the park helper has a first aid kit. His little green hut is just across the park!'),
          line(J, 'Stay right here, Maya. I’ll be right back with a bandage!'),
        ]);
        g.saveGame();
      },
    });
    // Mr. Hughes — bandage
    this.addInteractable({
      pos: () => this.hughes.root.position, label: 'Talk to Mr. Hughes',
      action: async () => {
        g.journalSeen('hughes', 'Mr. Hughes');
        if (E.mayaMet && !has('maya') && !E.bandage) {
          this.hughes.model.playAction('give', 1.5);
          await g.ui.dialogue([
            line(J, 'Mr. Hughes! Maya fell off her bike and hurt her knee. Do you have a bandage?'),
            line({ who: 'Mr. Hughes', color: '#4f9d69', pitch: 0.7 }, 'You did the right thing coming to find a grown-up. Here you go — my best star bandage.'),
            line({ who: 'Mr. Hughes', color: '#4f9d69', pitch: 0.7 }, 'Tell her I said she’s very brave.'),
          ]);
          E.bandage = true;
          g.ui.toast('🩹', 'Got a star bandage!');
          g.audio.collect();
          g.saveGame();
          return;
        }
        g.ui.dialogue([line({ who: 'Mr. Hughes', color: '#4f9d69', pitch: 0.7 }, ['Lovely day for the park! Did you know that big pink tree on the hill is called the Wishing Tree?', 'If you ever need help, come find me. Helping is my favorite job.', 'Kindness is like planting seeds. You never know how big it will grow!'][Math.floor(Math.random() * 3)])]);
      },
    });
    // Oliver — hug
    this.addInteractable({
      pos: () => this.oliver.root.position, label: 'Talk to Oliver',
      action: async () => {
        g.journalSeen('oliver', 'Oliver');
        if (has('oliver')) return g.ui.dialogue([line({ who: 'Oliver', color: '#4caf50' }, 'This is the best park ever! Thanks for being my friend.')]);
        const choice = await g.ui.dialogue([
          line({ who: 'Oliver', color: '#4caf50' }, '*sniff*… Oh, hi.'),
          line(J, 'Hi, I’m Jacinta. Are you okay? You look sad.'),
          line({ who: 'Oliver', color: '#4caf50' }, 'We just moved here. I miss my old house… and I don’t have any friends here.'),
          line(J, 'What should I do?', {
            choices: [
              { text: 'Ask “Do you want a hug?”', value: 'hug' },
              { text: 'Tell him about your favorite things in the park', value: 'talk', then: [line(J, 'There’s a playground, a giant pink tree, and butterflies everywhere!'), line({ who: 'Oliver', color: '#4caf50' }, 'That sounds nice… but I still feel kind of lonely.'), line(PINKY, '(whispering) I think Oliver might like a hug.')] },
            ],
          }),
        ]);
        if (choice !== 'hug') return;
        this.oliver.model.anim.sit = false;
        this.oliver.fixedY = false;
        await new Promise((r) => setTimeout(r, 350));
        this.player.model.playAction('hug', 2.6);
        this.oliver.model.playAction('hug', 2.6);
        g.ui.say('Aww! The best hugs come from the heart. 💗', 3);
        await new Promise((r) => setTimeout(r, 1700));
        await g.ui.dialogue([
          line({ who: 'Oliver', color: '#4caf50' }, 'Thanks… I feel a lot better.', { onShow: () => this.oliver.model.setMood('happy') }),
          line(J, 'You can play with me and my friends any time! We’re at the park almost every day.'),
          line({ who: 'Oliver', color: '#4caf50' }, 'Really? That would be awesome!'),
        ]);
        this.giveHeart('oliver', this.oliver.root.position);
        this.oliver.walkTo(-8, 21, 1.8).then(() => { this.oliver.wander = { x: -10, z: 18, r: 4 }; });
      },
    });
    // Sam & Brock — standing up to a bully, kindly
    const bullyTalk = async () => {
      g.journalSeen('sam', 'Sam'); g.journalSeen('brock', 'Brock');
      if (has('bully')) return g.ui.dialogue([line({ who: 'Brock', color: '#c0392b', pitch: 0.8 }, 'Sorry I was mean before. Wanna play keep-away? The nice kind, where everyone gets a turn.')]);
      const lievHere = E.liev;
      const choice = await g.ui.dialogue([
        line({ who: 'Brock', color: '#c0392b', pitch: 0.8 }, 'Ha! Too slow, shorty. It’s MY ball now.'),
        line({ who: 'Sam', color: '#ff9a3c', pitch: 1.3 }, 'Give it back! My grandpa gave me that ball…'),
        line(PINKY, '(whispering) Sam looks really upset. What should we do?', {
          choices: [
            { text: 'Say calmly: “Hey, that’s not kind. Please give it back.”', value: 'brave' },
            { text: 'Go get a grown-up to help', value: 'adult' },
            { text: 'Walk away and pretend you didn’t see', value: 'ignore', then: [line(PINKY, 'Hmm… I think Sam really needs a friend right now. Being brave can be scary, but we can do it together!')] },
          ],
        }),
      ]);
      if (choice === 'ignore' || !choice) return;
      if (choice === 'adult') {
        await g.ui.dialogue([line(J, 'Mr. Hughes! Someone is taking Sam’s ball and won’t give it back.'), line({ who: 'Mr. Hughes', color: '#4f9d69', pitch: 0.7 }, 'Thank you for telling me. Let’s go talk to them together.')]);
        this.hughes.walkTo(-10.5, 15.5, 5);
        await new Promise((r) => setTimeout(r, 400));
        this.hughes.root.position.set(-10.2, this.terrain.getHeight(-10.2, 15.4), 15.4);
        this.hughes.target = null;
        await g.ui.dialogue([
          line({ who: 'Mr. Hughes', color: '#4f9d69', pitch: 0.7 }, 'Brock, in this park we share and we take turns. How do you think Sam feels right now?'),
          line({ who: 'Brock', color: '#c0392b', pitch: 0.8 }, '…Sad, I guess.'),
        ]);
      } else {
        await g.ui.dialogue([
          line(J, 'Hey Brock. That’s not kind. Please give Sam his ball back.'),
          ...(lievHere ? [line(L, 'Yeah. We’re standing with Sam. Taking stuff isn’t cool.', { onShow: () => { const f = this.followers[0]; if (f) f.model.playAction('point', 2); } })] : []),
          line({ who: 'Brock', color: '#c0392b', pitch: 0.8 }, 'Why should I?'),
          line(J, 'Because it’s his. And it makes him sad. If you want to play, you can just ask!'),
        ]);
      }
      await g.ui.dialogue([
        line({ who: 'Brock', color: '#c0392b', pitch: 0.8 }, '…Fine. Here, Sam. Sorry.', { onShow: () => { this.ballHolder = 'sam'; this.brock.model.setMood('happy'); this.sam.model.setMood('happy'); this.sam.model.anim.action = null; this.sam.model.anim.actionT = 0; } }),
        line({ who: 'Brock', color: '#c0392b', pitch: 0.8 }, 'I just… nobody ever asks me to play.'),
        line(J, 'Then let’s ALL play! Sam, Brock — want to kick the ball around together?'),
        line({ who: 'Sam', color: '#ff9a3c', pitch: 1.3 }, 'Yeah! Thanks, Jacinta!'),
      ]);
      if (choice === 'adult') this.hughes.walkTo(21.4, 1.8, 2.2).then(() => { this.hughes.yaw = this.hughes.homeYaw; });
      this.sam.model.playAction('cheer', 2);
      this.giveHeart('bully', this.sam.root.position);
    };
    this.addInteractable({ pos: () => this.sam.root.position, label: () => (has('bully') ? 'Talk to Sam' : 'Help Sam'), action: bullyTalk });
    this.addInteractable({ pos: () => this.brock.root.position, label: 'Talk to Brock', action: bullyTalk });
    this.ballHolder = has('bully') ? 'play' : 'brock';
    this.updaters.push(() => {
      const t = this.time;
      if (this.ballHolder === 'brock') {
        const hp = new THREE.Vector3();
        this.brock.model.arms[1].hand.getWorldPosition(hp);
        this.samBall.position.copy(hp).add(new THREE.Vector3(0, 0.1, 0));
        this.brock.model.anim.action = 'point';
        this.brock.model.anim.actionT = 1;
      } else {
        // kick the ball back and forth
        const a = this.sam.root.position, b = this.brock.root.position;
        const k = (Math.sin(t * 1.4) + 1) / 2;
        this.samBall.position.lerpVectors(a, b, k);
        this.samBall.position.y += 0.13 + Math.abs(Math.sin(t * 2.8)) * 0.6;
        this.samBall.rotation.x += 0.1;
      }
    });

    // Mango the parrot
    this.addInteractable({
      pos: () => this.mango.position, enabled: () => this.mangoState === 'hurt' && this.kittenState !== 'carried',
      label: 'Gently pick up the hurt parrot',
      action: async () => {
        await g.ui.dialogue([
          line(PINKY, '(whispering) Look! A little parrot under the tree. His wing is hurt and he can’t fly.'),
          line(J, 'Poor thing… He has a tag on his leg: “Mango — I live in the purple house.” That’s Mrs. Rosa’s house!'),
          line(J, 'Shhh, it’s okay, Mango. I’ll carry you home very, very gently.'),
        ]);
        this.mangoState = 'carried';
        E.mango = 'carried';
        this.player.model.anim.persist = true;
        this.player.model.playAction('carry', 99999);
        g.journalSeen('mango', 'Mango');
        g.saveGame();
      },
    });
    this.addInteractable({
      pos: () => this.rosa.root.position, label: 'Talk to Mrs. Rosa',
      action: async () => {
        g.journalSeen('rosa', 'Mrs. Rosa');
        if (this.mangoState === 'carried') {
          await g.ui.dialogue([
            line({ who: 'Mrs. Rosa', color: '#c76b98', pitch: 0.85 }, 'MANGO! Oh, my sweet bird, I’ve been looking everywhere for you!'),
            line(J, 'I found him under a tree in the park. His wing is hurt, so I carried him really gently.'),
            line({ who: 'Mrs. Rosa', color: '#c76b98', pitch: 0.85 }, 'You were so careful with him. Let me wrap his wing… there. It was just a little sprain.'),
            line({ who: 'Mrs. Rosa', color: '#c76b98', pitch: 0.85 }, 'Look! He can flap again! Thank you, Jacinta. You have a very kind heart.'),
          ]);
          this.player.model.anim.persist = false;
          this.player.model.anim.action = null;
          this.player.model.anim.actionT = 0;
          this.mangoState = 'flying';
          E.mango = 'home';
          this.rosa.model.playAction('cheer', 2);
          this.giveHeart('mango', this.rosa.root.position);
          return;
        }
        if (this.mangoState === 'hurt') return g.ui.dialogue([line({ who: 'Mrs. Rosa', color: '#c76b98', pitch: 0.85 }, 'Oh dear, oh dear. My parrot Mango flew out the window this morning and hasn’t come back. Have you seen a little red and blue parrot?')]);
        return g.ui.dialogue([line({ who: 'Mrs. Rosa', color: '#c76b98', pitch: 0.85 }, 'Mango hasn’t stopped singing since you brought him home! Come by for cookies any time, dear.')]);
      },
    });

    // Jacinta's front door: go inside to explore the house (and sleep in her own bed)
    this.addInteractable({
      pos: new THREE.Vector3(0, 0.3, -27.0), radius: 2.0,
      label: () => (this.dayNight.nightAmount > 0.35 ? 'Go inside (bedtime!) 🏠' : 'Go inside your house 🏠'),
      action: () => g.enterHome(),
    });

    // Litter pickup
    const litterSpots = LITTER_SPOTS;
    this.litterTotal = litterSpots.length;
    g.state.totals.litter = this.litterTotal;
    litterSpots.forEach(([x, z], i) => {
      this.addCollectible('litter', `earth-litter-${i}`, new THREE.Vector3(x, this.terrain.getHeight(x, z), z), {
        float: 0.08, journal: null,
        onCollect: () => {
          E.litter = (g.state.counts.litter || 0);
          if (E.litter === 1) g.ui.say('Good job! Litter can hurt animals. Let’s find all of it and put it in the green bin.', 5);
          else g.ui.toast('🗑️', `Litter picked up: ${E.litter} / ${this.litterTotal}`);
          if (E.litter >= this.litterTotal) g.ui.say('That’s all of it! Now let’s put it in the green trash bin by the path.', 5);
        },
      });
    });
    this.addInteractable({
      pos: this.binPos, radius: 2.4,
      label: () => (has('litter') ? 'Trash bin' : `Put litter in the bin (${g.state.counts.litter || 0}/${this.litterTotal})`),
      action: async () => {
        if (has('litter')) return;
        if ((g.state.counts.litter || 0) < this.litterTotal) {
          g.ui.say(`We still need to find ${this.litterTotal - (g.state.counts.litter || 0)} more pieces of litter around the park.`, 4);
          return;
        }
        this.player.model.playAction('give', 1.2);
        await g.ui.dialogue([
          line(J, 'All clean! Now the birds and squirrels won’t get hurt by trash.'),
          line(PINKY, 'Taking care of the Earth is a kindness too!'),
        ]);
        this.giveHeart('litter', this.binPos);
      },
    });
  }

  async talkLiev() {
    const g = this.game;
    const E = this.E;
    await g.ui.dialogue([
      line(L, 'Jacinta! Check it out — I did twenty kick-ups in a row!'),
      line(J, 'Whoa, cool! Hey Liev… can I tell you a secret?'),
      line(L, 'Of course.'),
      line(J, 'Pinky told me that there’s a magic door at the Wishing Tree. It goes to Pinky Land!'),
      line(L, 'Pinky Land? The place you always draw? With the giant fluffy clouds?'),
      line(J, 'Yes! But the door only opens with kindness. We have to help five people… or animals… or anyone!'),
      line(L, 'Then let’s spread some Pinky love! I’m coming with you.'),
    ]);
    E.liev = true;
    g.journalSeen('liev', 'Liev');
    // Liev stops being an NPC and becomes a friend who follows (and is playable)
    this.npcs.splice(this.npcs.indexOf(this.lievNPC), 1);
    this.scene.remove(this.ball);
    this.lievNPC = null;
    g.applyParty();
    g.ui.toast('⚡', 'Liev joined you! Press <b>Tab</b> to play as Liev.');
    g.saveGame();
  }

  giveHeart(id, pos) {
    const g = this.game;
    const E = this.E;
    if (E.hearts.includes(id)) return;
    E.hearts.push(id);
    g.state.counts.heart = E.hearts.length;
    g.audio.heart();
    g.ui.setHearts(E.hearts.length, E.hearts.length - 1);
    g.ui.toast('💗', E.hearts.length > 5 ? 'Bonus Kindness Heart! You did ALL the kind things! 🌟' : `Kindness Heart ${E.hearts.length} of 5!`);
    this.portal.setHearts(E.hearts.length);
    this.spawnBurst(pos.clone().add(new THREE.Vector3(0, 1.4, 0)), '#ff5f8f');
    // a floating heart rises from the person you helped
    const h = createCollectible('heart');
    h.position.copy(pos).add(new THREE.Vector3(0, 1.8, 0));
    this.scene.add(h);
    let t = 0;
    const upd = (dt) => { t += dt; h.position.y += dt * 1.2; animateCollectible(h, dt); h.scale.setScalar(Math.max(0.01, 1 - t / 2.5)); if (t > 2.5) { this.scene.remove(h); this.updaters.splice(this.updaters.indexOf(upd), 1); } };
    this.updaters.push(upd);
    this.journalCheck('heart', 'Kindness Hearts');
    if (E.hearts.length > 5) {
      setTimeout(() => g.ui.say('Every single kind thing in the whole park — you did them all! 🌟', 5), 1800);
    } else if (E.hearts.length === 5) {
      setTimeout(() => {
        g.ui.say('Jacinta! Do you feel that?! All five hearts are glowing. The door at the Wishing Tree is OPEN!', 7);
        g.audio.portal();
        this.showTrail(this.portal.group.position.clone().add(new THREE.Vector3(0, 1, 0)));
      }, 2200);
    } else {
      const left = 5 - E.hearts.length;
      setTimeout(() => g.ui.say(`A heart lit up on the magic door! ${left} more to go.`, 4), 1800);
    }
    g.saveGame();
  }

  // once you've been to Pinky Land, the magic door stays open both ways for good
  doorOpen() { return this.E.hearts.length >= 5 || !!this.game.state.pinky?.arrived; }

  async portalAction() {
    const g = this.game;
    if (this.doorOpen()) {
      g.goToPinkyLand();
      return;
    }
    await g.ui.dialogue([
      line(PINKY, `This is it — the door to Pinky Land! It has five hearts. ${this.E.hearts.length ? `${this.E.hearts.length} ${this.E.hearts.length === 1 ? 'is' : 'are'} glowing already!` : 'They light up when we spread kindness.'}`),
      line(PINKY, 'Let’s go help people around the park. Press H if you need a hint!'),
    ]);
  }

  getHint() {
    const E = this.E;
    const has = (id) => E.hearts.includes(id);
    const P = (o) => o.root.position.clone();
    if (this.doorOpen() && !this.game.state.pinky?.arrived) return { text: 'All five hearts are glowing! Walk through the magic door at the Wishing Tree!', target: this.portal.group.position.clone() };
    if (this.mangoState === 'carried') return { text: 'Mango lives in the purple house. Let’s carry him to Mrs. Rosa!', target: P(this.rosa) };
    if (this.kittenState === 'carried') return { text: 'Listen for a grown-up cat calling “Mrrow?” — Peaches’s mama is in the yard of the blue house at the end of the street.', target: this.mamaCat.pos.clone() };
    if (E.bandage) return { text: 'We have the bandage! Let’s bring it to Maya.', target: P(this.maya) };
    // Kindness can be done in ANY order: point to whichever unfinished one is closest
    const options = [];
    if (!E.liev && this.lievNPC) options.push({ text: 'Liev is near the park entrance doing kick-ups. Let’s say hi — he can help!', target: P(this.lievNPC) });
    if (!has('maya') && E.mayaMet) options.push({ text: 'Mr. Hughes the park helper has a first aid kit for Maya. His green hut is on the other side of the park.', target: P(this.hughes) });
    else if (!has('maya')) options.push({ text: 'I think someone fell off their bike near the path. Let’s see if they’re okay.', target: P(this.maya) });
    if (!has('oliver')) options.push({ text: 'Someone is sitting all alone on a bench. Maybe they’re sad?', target: P(this.oliver) });
    if (!has('bully')) options.push({ text: 'I hear someone upset at the playground. Let’s go see.', target: P(this.sam) });
    if (this.kittenState === 'lost') options.push({ text: 'Do you hear tiny mews? A little kitten is hiding by the bushes in the far corner of the park.', target: this.kitten.root.position.clone() });
    if (this.mangoState === 'hurt') options.push({ text: 'Listen… a little bird is chirping! He’s on a tree stump on the west side of the park.', target: this.mango.position.clone() });
    if (!has('litter')) {
      const p = this.player.pos;
      const left = this.collectibles.filter((c) => c.kind === 'litter' && !c.taken).sort((a, b) => a.obj.position.distanceTo(p) - b.obj.position.distanceTo(p))[0];
      if (left) options.push({ text: 'There’s litter nearby. Let’s pick it up so animals don’t get hurt!', target: left.obj.position.clone() });
      else options.push({ text: 'Now put the litter in the green trash bin by the path.', target: this.binPos.clone() });
    }
    if (options.length) {
      const p = this.player.pos;
      options.sort((a, b) => Math.hypot(a.target.x - p.x, a.target.z - p.z) - Math.hypot(b.target.x - p.x, b.target.z - p.z));
      return options[0];
    }
    return null;
  }

  mapMarkers() {
    const E = this.E;
    const m = [...this.landmarks];
    m.push({ x: 24, z: 2, icon: '⛑️', label: 'Park Helper' });
    if (!E.hearts.includes('maya')) m.push({ x: this.maya.root.position.x, z: this.maya.root.position.z, icon: '🚲', label: 'Maya' });
    if (!E.hearts.includes('oliver')) m.push({ x: this.oliver.root.position.x, z: this.oliver.root.position.z, icon: '💧', label: 'Oliver' });
    if (!E.hearts.includes('bully')) m.push({ x: this.sam.root.position.x, z: this.sam.root.position.z, icon: '⚽', label: 'Sam' });
    m.push({ x: this.binPos.x, z: this.binPos.z, icon: '🗑️' });
    if (this.kittenState !== 'home' && this.mamaCat) m.push({ x: this.mamaCat.pos.x, z: this.mamaCat.pos.z, icon: '🐈', label: 'Worried mama cat' });
    return m;
  }

  mapColor(x, z, h, out) {
    if (Math.abs(z - ROAD_Z) < 3.5) return out.set('#8a8694');
    if (Math.abs(z - WALK_Z) < 1.1) return out.set('#e6e1e8');
    if (z < -27.4 && z > -32.6) for (const hx of [0, -22, 22, -44, 44]) if (Math.abs(x - hx) < 3) return out.set('#ffd6e6');
    const p = this._pathAmount(x, z);
    out.setHSL(0.28, 0.45, 0.6 + h * 0.03);
    if (p > 0.3) out.set('#e8d8b8');
  }

  update(dt) {
    this.baseUpdate(dt);
    const night = this.dayNight.nightAmount;
    for (const w of this.houseWindows) w.emissiveIntensity = night * 1.4;
    // swings sway gently
    if (this.swingSeats) this.swingSeats.forEach((s, i) => { s.rotation.x = Math.sin(this.time * 1.2 + i * 2) * 0.12; });
  }
}
