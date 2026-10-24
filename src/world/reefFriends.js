// More friendly sea animals for Pinky Land's coral reef, plus seagrass meadows.
// Every animal follows the same simple pattern: a little bit of data, a shape made from
// simple pieces, and a small update each frame. They all stay in the water, stay above the
// sea floor, and are shy: they drift away (or hide) when you swim close.
//   sea turtle · manta ray · jellyfish · clownfish in their anemones · crabs · an octopus ·
//   dolphins that leap · seahorses in the seagrass
import * as THREE from 'three';
import { addUnderwaterLight, sharedUniforms } from './terrain.js';
import { reefMaterial } from './sealife.js';
import { makeRandom, makeNoise2D } from '../util/noise.js';

const std = (color, o = {}) => addUnderwaterLight(new THREE.MeshStandardMaterial({ color, roughness: 0.7, ...o }), 'rf-' + color + (o.key || ''));
const shady = (obj) => { obj.traverse((o) => { if (o.isMesh) o.castShadow = true; }); return obj; };

export function addReefFriends(level, { center, spots, quality = 1, seed = 57 }) {
  const scene = level.scene, terrain = level.terrain, world = level.world;
  const WL = world.waterLevel;
  const rand = makeRandom(seed), noise = makeNoise2D(seed);
  const floor = (x, z) => terrain.getHeight(x, z);
  const player = () => level.player.pos;
  const group = new THREE.Group();
  scene.add(group);
  const list = [];
  const tmp = new THREE.Vector3();
  // push a position away from the player when they come close (shy animals)
  const shy = (pos, off, radius, strength, dt) => {
    const p = player();
    const dx = pos.x + off.x - p.x, dy = pos.y + off.y - p.y, dz = pos.z + off.z - p.z;
    const d = Math.hypot(dx, dy, dz);
    if (d < radius && d > 0.001) { const k = (radius - d) * strength * dt / d; off.x += dx * k; off.y += dy * k * 0.5; off.z += dz * k; }
    off.multiplyScalar(1 - Math.min(1, dt * 0.5));
    return d;
  };
  const inWater = (v, above = 0.3, below = 0.3) => { v.y = Math.min(WL - below, Math.max(floor(v.x, v.z) + above, v.y)); return v; };
  const under = (pos) => pos.y < WL - 0.3;

  // ---------------------------------------------------------------- seagrass meadows
  {
    const blade = new THREE.PlaneGeometry(0.06, 1, 1, 4); blade.translate(0, 0.5, 0);
    const bp = blade.attributes.position;
    for (let i = 0; i < bp.count; i++) { const y = bp.getY(i); bp.setX(i, bp.getX(i) * (1 - y * 0.85)); bp.setZ(i, Math.sin(y * 2.2) * 0.05); }
    const col = []; for (let i = 0; i < bp.count; i++) { const y = bp.getY(i); const c = new THREE.Color('#2f7d3a').lerp(new THREE.Color('#9fd86a'), y); col.push(c.r, c.g, c.b); }
    blade.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    blade.computeVertexNormals();
    const mat = reefMaterial({ key: 'seagrass', sway: 0.14, swayFreq: 0.9, glow: 0.05, nightGlow: 0.1, side: THREE.DoubleSide });
    const n = Math.floor(1800 * quality);
    const im = new THREE.InstancedMesh(blade, mat, n);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), sc = new THREE.Vector3();
    let k = 0;
    for (let tries = 0; tries < n * 12 && k < n; tries++) {
      const a = Math.PI * (0.1 + rand() * 0.8), r = center.inner + rand() * (center.outer - center.inner);
      const x = Math.cos(a) * r, z = Math.sin(a) * r, h = floor(x, z);
      if (h > WL - 0.9 || h < WL - 4) continue;
      if (noise(x * 0.12, z * 0.12) < 0.15) continue; // grows in patches
      e.set((rand() - 0.5) * 0.3, rand() * 6.28, (rand() - 0.5) * 0.3); q.setFromEuler(e);
      const s = 0.35 + rand() * 0.55;
      v.set(x, h - 0.02, z); sc.set(1 + rand() * 0.6, s, 1);
      m4.compose(v, q, sc); im.setMatrixAt(k++, m4);
    }
    im.count = k;
    im.receiveShadow = true;
    group.add(im);
  }

  // ---------------------------------------------------------------- sea turtle
  const turtle = new THREE.Group();
  {
    const skin = std('#a8b87a');
    const shell = new THREE.Mesh(new THREE.IcosahedronGeometry(0.42, 1), std('#6b7a3a', { flatShading: true, key: 'shell' }));
    shell.scale.set(1, 0.38, 1.25); turtle.add(shell);
    const belly = new THREE.Mesh(new THREE.SphereGeometry(0.4, 12, 8), std('#e2d7a0'));
    belly.scale.set(0.95, 0.2, 1.2); belly.position.y = -0.06; turtle.add(belly);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 8), skin);
    head.scale.set(1, 0.85, 1.3); head.position.set(0, 0.02, 0.6); turtle.add(head);
    for (const sx of [-1, 1]) { const eye = new THREE.Mesh(new THREE.SphereGeometry(0.025, 6, 4), new THREE.MeshBasicMaterial({ color: '#1a1a1a' })); eye.position.set(sx * 0.07, 0.06, 0.7); turtle.add(eye); }
    turtle.userData.flips = [];
    for (const [sx, z, L] of [[-1, 0.28, 0.5], [1, 0.28, 0.5], [-1, -0.36, 0.25], [1, -0.36, 0.25]]) {
      const pv = new THREE.Group(); pv.position.set(sx * 0.32, -0.02, z);
      const fl = new THREE.Mesh(new THREE.SphereGeometry(1, 8, 4), skin); fl.scale.set(L, 0.03, L * 0.35); fl.position.x = sx * L * 0.85;
      pv.add(fl); turtle.add(pv); turtle.userData.flips.push({ pv, sx, front: z > 0 });
    }
    turtle.scale.setScalar(1.3);
    shady(turtle); group.add(turtle);
  }
  const tOff = new THREE.Vector3();
  list.push({ name: 'Sea Turtle', journalKey: 'seaturtle', object: turtle, near: (pos) => under(pos) && turtle.position.distanceTo(pos) < 6,
    update: (dt, t) => {
      const a = t * 0.06, cx = center.x, cz = center.z;
      const x = cx + Math.cos(a) * 11, z = cz + Math.sin(a) * 7;
      turtle.position.set(x, Math.max(floor(x, z) + 0.6, WL - 1.7 + Math.sin(t * 0.5) * 0.25), z);
      shy(turtle.position, tOff, 2.6, 1.5, dt);
      turtle.position.add(tOff); inWater(turtle.position, 0.5, 0.4);
      turtle.rotation.set(Math.sin(t * 0.5) * 0.08, Math.atan2(-Math.sin(a) * 11, Math.cos(a) * 7) + Math.PI / 2 + Math.PI, Math.sin(t * 1.1) * 0.06);
      for (const f of turtle.userData.flips) { const w = Math.sin(t * 2.2 + (f.front ? 0 : 1.5)); f.pv.rotation.z = f.sx * w * (f.front ? 0.5 : 0.3); f.pv.rotation.y = f.sx * w * 0.25; }
    } });

  // ---------------------------------------------------------------- manta ray (slow figure-eights)
  const manta = new THREE.Group();
  {
    const top = std('#3b4a6b', { side: THREE.DoubleSide, key: 'manta' }), under = std('#f1f4f8', { side: THREE.DoubleSide, key: 'mantaU' });
    const wings = [];
    for (const sx of [-1, 1]) {
      const pv = new THREE.Group();
      const shape = new THREE.Shape(); shape.moveTo(0, 0.5); shape.lineTo(sx * 1.25, -0.05); shape.lineTo(0, -0.45); shape.lineTo(0, 0.5);
      const g = new THREE.ShapeGeometry(shape, 6); g.rotateX(-Math.PI / 2);
      const w = new THREE.Mesh(g, top); const wu = new THREE.Mesh(g, under); wu.position.y = -0.015;
      pv.add(w, wu); manta.add(pv); wings.push({ pv, sx });
    }
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.3, 12, 8), top); body.scale.set(1, 0.32, 1.7); manta.add(body);
    for (const sx of [-1, 1]) { const horn = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.05, 0.3, 6), top); horn.rotation.x = Math.PI / 2; horn.position.set(sx * 0.18, 0, 0.55); manta.add(horn); }
    const tail = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.025, 1.2, 5), top); tail.rotation.x = Math.PI / 2; tail.position.z = -1.0; manta.add(tail);
    manta.userData.wings = wings;
    manta.scale.setScalar(1.4);
    shady(manta); group.add(manta);
  }
  const mOff = new THREE.Vector3(), mPrev = new THREE.Vector3();
  list.push({ name: 'Manta Ray', journalKey: 'manta', object: manta, near: (pos) => under(pos) && manta.position.distanceTo(pos) < 8,
    update: (dt, t) => {
      const a = t * 0.11, cx = center.x + 6, cz = center.z - 2;
      mPrev.copy(manta.position);
      const x = cx + Math.sin(a) * 12, z = cz + Math.sin(a * 2) * 5;
      manta.position.set(x, WL - 2.2 + Math.sin(t * 0.4) * 0.4, z);
      shy(manta.position, mOff, 3, 1.2, dt);
      manta.position.add(mOff); inWater(manta.position, 0.7, 0.6);
      const dx = Math.cos(a) * 12, dz = Math.cos(a * 2) * 10;
      manta.rotation.set(0, Math.atan2(dx, dz), -Math.cos(a * 2) * 0.25);
      for (const w of manta.userData.wings) w.pv.rotation.z = w.sx * Math.sin(t * 1.6) * 0.35;
    } });

  // ---------------------------------------------------------------- jellyfish (glowing, pulsing)
  const jellies = [];
  {
    const bellGeo = new THREE.SphereGeometry(0.28, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2);
    const ribbonGeo = new THREE.PlaneGeometry(0.04, 0.8, 1, 8); ribbonGeo.translate(0, -0.4, 0);
    const colors = ['#ff9fd6', '#b9a3ff', '#8fe9ff', '#ffd08a', '#ff8fb0', '#a6ffda'];
    for (let i = 0; i < 7; i++) {
      const c = colors[i % colors.length];
      const mat = new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 0.35, transparent: true, opacity: 0.55, roughness: 0.2, side: THREE.DoubleSide, depthWrite: false });
      const j = new THREE.Group();
      const bell = new THREE.Mesh(bellGeo, mat); j.add(bell);
      const rib = [];
      for (let k = 0; k < 6; k++) {
        const r = new THREE.Mesh(ribbonGeo, mat); const a = (k / 6) * Math.PI * 2;
        r.position.set(Math.cos(a) * 0.14, 0, Math.sin(a) * 0.14); r.rotation.y = -a; j.add(r); rib.push(r);
      }
      const a = rand() * 6.28, rr = 4 + rand() * 12;
      const home = new THREE.Vector3(center.x + Math.cos(a) * rr, 0, center.z + Math.sin(a) * rr * 0.6);
      j.renderOrder = 6;
      group.add(j);
      jellies.push({ j, mat, rib, home, ph: rand() * 6.28, off: new THREE.Vector3(), s: 0.8 + rand() * 0.6 });
    }
  }
  list.push({ name: 'Jellyfish', journalKey: 'jellyfish', object: jellies[0].j, near: (pos) => under(pos) && jellies.some((q) => q.j.position.distanceTo(pos) < 4),
    update: (dt, t) => {
      const night = sharedUniforms.uNight.value;
      for (const q of jellies) {
        const pulse = Math.sin(t * 1.6 + q.ph);
        q.home.x += Math.sin(t * 0.05 + q.ph) * dt * 0.1;
        const y = WL - 1.6 + Math.sin(t * 0.35 + q.ph) * 0.6 + Math.max(0, pulse) * 0.15;
        q.j.position.set(q.home.x, y, q.home.z);
        shy(q.j.position, q.off, 2, 1.0, dt);
        q.j.position.add(q.off); inWater(q.j.position, 0.9, 0.35);
        q.j.scale.set(q.s * (1 + pulse * 0.12), q.s * (1 - pulse * 0.1), q.s * (1 + pulse * 0.12));
        q.rib.forEach((r, k) => { r.rotation.x = Math.sin(t * 2 + k + q.ph) * 0.25; });
        q.mat.emissiveIntensity = 0.3 + night * 0.9; // they glow softly at night
      }
    } });

  // ---------------------------------------------------------------- clownfish in their anemones
  const clowns = [];
  {
    const anemoneMat = reefMaterial({ key: 'clown-anem', sway: 0.35, swayFreq: 1.3, glow: 0.2, nightGlow: 0.6 });
    const tent = new THREE.CylinderGeometry(0.018, 0.03, 0.45, 5, 4); tent.translate(0, 0.22, 0);
    const parts = [];
    const r2 = makeRandom(3);
    for (let k = 0; k < 40; k++) { const g = tent.clone(); const a = r2() * 6.28, rr = Math.sqrt(r2()) * 0.35; g.rotateZ((r2() - 0.5) * 0.6); g.rotateX((r2() - 0.5) * 0.6); g.translate(Math.cos(a) * rr, 0, Math.sin(a) * rr); parts.push(g); }
    const base = new THREE.CylinderGeometry(0.3, 0.36, 0.12, 12); base.translate(0, 0.04, 0); parts.push(base);
    const geo = mergeAll(parts, (y) => new THREE.Color('#ff7fb8').lerp(new THREE.Color('#ffe3f2'), Math.min(1, y / 0.45)));
    const bodyGeo = new THREE.SphereGeometry(1, 10, 8); bodyGeo.scale(0.035, 0.05, 0.085);
    const orange = std('#ff7a1a', { emissive: '#ff5a00', emissiveIntensity: 0.15, key: 'clown' }), white = std('#ffffff', { key: 'clownW' });
    const homes = (spots || []).filter((s) => s.h < WL - 1.2 && s.h > WL - 4).slice(0, 4);
    for (const s of homes) {
      const anem = new THREE.Mesh(geo, anemoneMat);
      anem.position.set(s.x, s.h - 0.02, s.z); anem.scale.setScalar(1.4);
      group.add(anem);
      for (let f = 0; f < 2; f++) {
        const fish = new THREE.Group();
        fish.add(new THREE.Mesh(bodyGeo, orange));
        for (const z of [0.035, -0.03]) { const band = new THREE.Mesh(new THREE.TorusGeometry(0.045, 0.012, 5, 12), white); band.scale.set(0.8, 1.1, 1); band.position.z = z; fish.add(band); }
        const tail = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.06, 4), orange); tail.rotation.x = -Math.PI / 2; tail.position.z = -0.1; fish.add(tail);
        fish.scale.setScalar(1.5);
        group.add(fish);
        clowns.push({ fish, home: anem.position.clone(), ph: rand() * 6.28, hide: 0 });
      }
    }
  }
  list.push({ name: 'Clownfish', journalKey: 'clownfish', object: group, near: (pos) => under(pos) && clowns.some((c) => c.fish.position.distanceTo(pos) < 3.5),
    update: (dt, t) => {
      const p = player();
      for (const c of clowns) {
        const d = Math.hypot(p.x - c.home.x, p.y - c.home.y, p.z - c.home.z);
        c.hide += ((d < 2.2 ? 1 : 0) - c.hide) * Math.min(1, dt * 4); // dart into the anemone when you come close
        const r = 0.55 * (1 - c.hide) + 0.05, a = t * 1.4 + c.ph;
        c.fish.position.set(c.home.x + Math.cos(a) * r, c.home.y + 0.5 * (1 - c.hide) + 0.15 + Math.sin(t * 3 + c.ph) * 0.05, c.home.z + Math.sin(a) * r);
        c.fish.rotation.y = -a + Math.sin(t * 9 + c.ph) * 0.15;
      }
    } });

  // ---------------------------------------------------------------- crabs (walk sideways, hide when you come near)
  const crabs = [];
  {
    const shellM = std('#e0503a', { key: 'crab' }), legM = std('#c23a2a', { key: 'crabL' });
    const sandy = (spots || []).filter((s) => s.h < WL - 0.6 && s.h > WL - 3.5);
    for (let i = 0; i < 5 && sandy.length; i++) {
      const s = sandy[Math.floor(rand() * sandy.length)];
      const c = new THREE.Group();
      const body = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 8), shellM); body.scale.set(1.3, 0.45, 1); body.position.y = 0.08; c.add(body);
      const legs = [];
      for (const sx of [-1, 1]) for (let k = 0; k < 3; k++) {
        // each leg: a short upper part reaching out sideways, then a lower part bending down to the sand
        const l = new THREE.Group(); l.position.set(sx * 0.12, 0.07, (k - 1) * 0.065); l.rotation.y = sx * (k - 1) * 0.35;
        const up = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.012, 0.1, 5), legM); up.rotation.z = sx * 1.25; up.position.x = sx * 0.045; up.position.y = 0.015; l.add(up);
        const lo = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.01, 0.09, 5), legM); lo.rotation.z = -sx * 0.35; lo.position.set(sx * 0.1, -0.03, 0); l.add(lo);
        c.add(l); legs.push(l);
      }
      for (const sx of [-1, 1]) { const cl = new THREE.Mesh(new THREE.SphereGeometry(0.04, 6, 4), shellM); cl.scale.set(1, 0.7, 1.4); cl.position.set(sx * 0.1, 0.08, 0.14); c.add(cl); const eye = new THREE.Mesh(new THREE.SphereGeometry(0.014, 5, 4), new THREE.MeshBasicMaterial({ color: '#111' })); eye.position.set(sx * 0.04, 0.14, 0.08); c.add(eye); }
      c.scale.setScalar(1.6);
      shady(c); group.add(c);
      crabs.push({ c, legs, home: new THREE.Vector3(s.x, 0, s.z), ph: rand() * 6.28, hide: 0, yaw: rand() * 6.28 });
    }
  }
  list.push({ name: 'Crabs', journalKey: 'crab', object: group, near: (pos) => crabs.some((c) => c.c.position.distanceTo(pos) < 3.5),
    update: (dt, t) => {
      const p = player();
      for (const c of crabs) {
        const d = Math.hypot(p.x - c.c.position.x, p.z - c.c.position.z) + Math.abs(p.y - c.c.position.y) * 0.5;
        c.hide += ((d < 2.5 ? 1 : 0) - c.hide) * Math.min(1, dt * 3);
        const side = Math.sin(t * 0.35 + c.ph) * 1.6 * (1 - c.hide);
        const x = c.home.x + Math.cos(c.yaw) * side, z = c.home.z - Math.sin(c.yaw) * side;
        c.c.position.set(x, floor(x, z) - c.hide * 0.12, z); // digs into the sand to hide
        c.c.rotation.y = c.yaw;
        const walking = Math.abs(Math.cos(t * 0.35 + c.ph)) * (1 - c.hide);
        c.legs.forEach((l, k) => { l.rotation.x = Math.sin(t * 12 + k * 1.7) * 0.35 * walking; });
      }
    } });

  // ---------------------------------------------------------------- an octopus on a rock (changes colour, puffs away in a little ink cloud)
  const octo = new THREE.Group();
  const octoMat = std('#c85a8a', { key: 'octo' });
  const inkMat = new THREE.MeshBasicMaterial({ color: '#241a2e', transparent: true, opacity: 0, depthWrite: false });
  const ink = new THREE.Mesh(new THREE.SphereGeometry(0.6, 12, 8), inkMat);
  const octoArms = [];
  let octoHome = new THREE.Vector3(center.x - 8, 0, center.z + 3);
  {
    const s = (spots || []).find((q) => q.h < WL - 1.5 && q.h > WL - 4 && Math.hypot(q.x - center.x + 8, q.z - center.z - 3) < 10);
    if (s) octoHome.set(s.x, 0, s.z);
    const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(0.6, 1), std('#8a8496', { key: 'octoRock' }));
    rock.scale.set(1.2, 0.55, 1); rock.position.set(octoHome.x, floor(octoHome.x, octoHome.z) + 0.15, octoHome.z);
    group.add(rock);
    octoHome.y = rock.position.y + 0.33;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.2, 14, 10), octoMat); head.scale.set(1, 1.25, 1); head.position.y = 0.2; octo.add(head);
    for (const sx of [-1, 1]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 6), new THREE.MeshBasicMaterial({ color: '#fff' })); e.position.set(sx * 0.09, 0.15, 0.15); octo.add(e); const pu = new THREE.Mesh(new THREE.SphereGeometry(0.02, 6, 4), new THREE.MeshBasicMaterial({ color: '#111' })); pu.position.set(sx * 0.09, 0.15, 0.185); octo.add(pu); }
    for (let k = 0; k < 8; k++) {
      const pv = new THREE.Group(); const a = (k / 8) * Math.PI * 2; pv.rotation.y = a; pv.position.y = 0.05;
      const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.045, 0.45, 6), octoMat); arm.rotation.z = Math.PI / 2 - 0.25; arm.position.x = 0.22;
      pv.add(arm); octo.add(pv); octoArms.push(pv);
    }
    octo.position.copy(octoHome);
    shady(octo); group.add(octo);
    ink.renderOrder = 6; group.add(ink);
  }
  const octoState = { away: 0, inkT: 0 };
  const octoCol = new THREE.Color();
  list.push({ name: 'Octopus', journalKey: 'octopus', object: octo, near: (pos) => under(pos) && octo.position.distanceTo(pos) < 4,
    update: (dt, t) => {
      const d = player().distanceTo(octoHome);
      if (d < 2.2 && octoState.away < 0.05 && octoState.inkT <= 0) { octoState.inkT = 2.5; ink.position.copy(octo.position); }
      octoState.away += ((d < 3.5 ? 1 : 0) - octoState.away) * Math.min(1, dt * (d < 3.5 ? 2.5 : 0.4));
      if (octoState.inkT > 0) { octoState.inkT -= dt; inkMat.opacity = Math.max(0, octoState.inkT / 2.5) * 0.45; ink.scale.setScalar(1 + (2.5 - octoState.inkT) * 0.6); } else inkMat.opacity = 0;
      const ax = Math.sin(t * 0.2) * 3 * octoState.away, az = -3.5 * octoState.away;
      octo.position.set(octoHome.x + ax, octoHome.y + octoState.away * 0.8, octoHome.z + az);
      inWater(octo.position, 0.25, 0.5);
      octoCol.setHSL(0.92 + Math.sin(t * 0.25) * 0.08, 0.55, 0.5 + Math.sin(t * 0.4) * 0.08); // slowly changes colour
      octoMat.color.copy(octoCol);
      octoArms.forEach((pv, k) => { pv.rotation.z = Math.sin(t * 1.5 + k) * 0.18 - octoState.away * 0.5; });
    } });

  // ---------------------------------------------------------------- dolphins (a pair, leaping past the reef)
  const dolphins = [];
  {
    const grey = std('#8aa4bf', { key: 'dolph' }), bellyM = std('#e8eef4', { key: 'dolphB' });
    const splashMat = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide });
    for (let i = 0; i < 2; i++) {
      const dph = new THREE.Group();
      const body = new THREE.Mesh(new THREE.SphereGeometry(0.3, 14, 10), grey); body.scale.set(0.9, 0.9, 3); dph.add(body);
      const belly = new THREE.Mesh(new THREE.SphereGeometry(0.27, 12, 8), bellyM); belly.scale.set(0.85, 0.6, 2.6); belly.position.y = -0.08; dph.add(belly);
      const nose = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.35, 8), grey); nose.rotation.x = Math.PI / 2; nose.position.z = 1.0; dph.add(nose);
      const fin = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.35, 4), grey); fin.position.set(0, 0.32, -0.1); fin.rotation.x = -0.5; dph.add(fin);
      const tail = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.04, 0.22), grey); tail.position.z = -0.95; dph.add(tail);
      for (const sx of [-1, 1]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.03, 6, 4), new THREE.MeshBasicMaterial({ color: '#111' })); e.position.set(sx * 0.2, 0.08, 0.6); dph.add(e); }
      shady(dph); group.add(dph);
      const rings = [0, 1].map(() => { const r = new THREE.Mesh(new THREE.RingGeometry(0.4, 0.6, 24), splashMat.clone()); r.rotation.x = -Math.PI / 2; r.renderOrder = 7; group.add(r); return { r, t: 9 }; });
      dolphins.push({ d: dph, ph: i * 1.4, rings, wasUp: false });
    }
  }
  list.push({ name: 'Dolphins', journalKey: 'dolphins', object: group, near: (pos) => dolphins.some((q) => q.d.position.distanceTo(pos) < 14),
    update: (dt, t) => {
      for (const q of dolphins) {
        const a = t * 0.07 + q.ph * 0.05, R0 = center.dolphinR;
        const x = Math.cos(a) * R0 + Math.sin(q.ph) * 1.5, z = Math.sin(a) * R0;
        // leap out of the water every few seconds
        const jt = (t * 0.32 + q.ph * 0.2) % 1;
        const jump = jt < 0.28 ? Math.sin((jt / 0.28) * Math.PI) : 0;
        const y = WL - 0.9 + jump * 2.4 + Math.sin(t * 2 + q.ph) * 0.1;
        q.d.position.set(x, y, z);
        const hx = -Math.sin(a), hz = Math.cos(a);
        q.d.rotation.set(jt < 0.28 ? -Math.cos((jt / 0.28) * Math.PI) * 0.7 : 0, Math.atan2(hx, hz), 0);
        const up = y > WL;
        if (up !== q.wasUp) { const r = q.rings.find((k) => k.t > 1) || q.rings[0]; r.t = 0; r.r.position.set(x, WL + 0.03, z); }
        q.wasUp = up;
        for (const k of q.rings) { k.t += dt; k.r.scale.setScalar(1 + k.t * 3); k.r.material.opacity = Math.max(0, 0.6 - k.t * 0.6); }
      }
    } });

  // ---------------------------------------------------------------- seahorses (bob gently by the seagrass)
  const horses = [];
  {
    const cols = ['#ffb347', '#ff7fb0', '#b18cff'];
    for (let i = 0; i < 3; i++) {
      const m = std(cols[i], { emissive: cols[i], emissiveIntensity: 0.12, key: 'sh' + i });
      const h = new THREE.Group();
      // body: a smooth S-shaped tube that gets thinner and curls into a tail
      const pts = [[0, 0.03, 0.01], [0.0, -0.05, 0.04], [0.0, -0.14, 0.035], [0.0, -0.22, 0.0], [0.0, -0.27, -0.04], [0.0, -0.25, -0.08], [0.0, -0.21, -0.07], [0.0, -0.22, -0.045]].map((q) => new THREE.Vector3(...q));
      const curve = new THREE.CatmullRomCurve3(pts);
      const tube = new THREE.TubeGeometry(curve, 40, 0.04, 8, false);
      const tp = tube.attributes.position, segs = 41;
      // taper: fat belly, thin tail
      for (let v = 0; v < tp.count; v++) {
        const ring = Math.floor(v / 9), t = ring / (segs - 1), c = curve.getPointAt(Math.min(1, t));
        const r = (t < 0.35 ? 0.75 + t : 1.1 - (t - 0.35) * 1.45) ;
        tp.setXYZ(v, c.x + (tp.getX(v) - c.x) * r, c.y + (tp.getY(v) - c.y) * r, c.z + (tp.getZ(v) - c.z) * r);
      }
      tube.computeVertexNormals();
      h.add(new THREE.Mesh(tube, m));
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), m); head.position.set(0, 0.06, 0.02); h.add(head);
      const snout = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.02, 0.09, 6), m); snout.rotation.x = Math.PI / 2; snout.position.set(0, 0.06, 0.09); h.add(snout);
      const fin = new THREE.Mesh(new THREE.CircleGeometry(0.04, 8), m); fin.position.set(0, -0.08, -0.05); fin.rotation.y = Math.PI / 2; h.add(fin);
      h.scale.setScalar(2.2);
      group.add(h);
      const s = (spots || [])[Math.floor(rand() * (spots?.length || 1))] || { x: center.x, z: center.z };
      horses.push({ h, home: new THREE.Vector3(s.x, 0, s.z), ph: rand() * 6.28, off: new THREE.Vector3() });
    }
  }
  list.push({ name: 'Seahorses', journalKey: 'seahorse', object: group, near: (pos) => under(pos) && horses.some((q) => q.h.position.distanceTo(pos) < 3),
    update: (dt, t) => {
      for (const q of horses) {
        q.h.position.set(q.home.x + Math.sin(t * 0.3 + q.ph) * 0.4, floor(q.home.x, q.home.z) + 0.8 + Math.sin(t * 1.2 + q.ph) * 0.12, q.home.z);
        shy(q.h.position, q.off, 1.8, 1.2, dt);
        q.h.position.add(q.off); inWater(q.h.position, 0.45, 0.35);
        q.h.rotation.y = t * 0.2 + q.ph;
        q.h.rotation.z = Math.sin(t * 1.5 + q.ph) * 0.08;
      }
    } });

  // one update for everyone (the level calls this every frame)
  let time = 0;
  const update = (dt) => { time += dt; for (const c of list) c._update(dt, time); };
  for (const c of list) { c._update = c.update; c.update = () => {}; } // the shared update above drives them
  return { group, list, update, turtle, manta, jellies, clowns, crabs, octo, dolphins, horses };
}

// merge pieces into one geometry, coloured by height
function mergeAll(geos, colorAt) {
  const pos = [], nor = [], col = [];
  for (let g of geos) {
    if (g.index) g = g.toNonIndexed();
    g.computeVertexNormals();
    const p = g.attributes.position, n = g.attributes.normal;
    for (let i = 0; i < p.count; i++) {
      pos.push(p.getX(i), p.getY(i), p.getZ(i)); nor.push(n.getX(i), n.getY(i), n.getZ(i));
      const c = colorAt(p.getY(i)); col.push(c.r, c.g, c.b);
    }
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  out.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  return out;
}
