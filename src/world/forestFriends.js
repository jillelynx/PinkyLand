// Forest friends: little squirrels and raccoons that live among Pinky Land's trees.
// They are built from simple round shapes (like the Pinkies) and animated by hand.
//  - Squirrels hop from tree to tree, sit up to nibble acorns, and scamper up a
//    trunk if you run at them. They come down again once you are calm.
//  - Raccoons waddle about, sit up on their back legs to "wash" their paws, and
//    are busiest at night, when they like to sneak toward the Cozy Camp.
import * as THREE from 'three';
import { makeRandom, angleDamp } from '../util/noise.js';

const mat = (color, rough = 0.85) => new THREE.MeshStandardMaterial({ color, roughness: rough });
const ball = (r, m, sx = 1, sy = 1, sz = 1) => { const b = new THREE.Mesh(new THREE.SphereGeometry(r, 12, 9), m); b.scale.set(sx, sy, sz); b.castShadow = true; return b; };
const cone = (r, h, m) => { const c = new THREE.Mesh(new THREE.ConeGeometry(r, h, 7), m); c.castShadow = true; return c; };

// a leg that swings from the hip: a group at the hip with a little leg + paw hanging down
function leg(len, r, m, paw) {
  const hip = new THREE.Group();
  const l = new THREE.Mesh(new THREE.CapsuleGeometry(r, len, 3, 6), m);
  l.position.y = -len / 2; hip.add(l);
  const p = ball(r * 1.15, paw || m, 1, 0.7, 1.3); p.position.set(0, -len - r * 0.4, r * 0.4); hip.add(p);
  return hip;
}

function eyes(head, r, x, y, z) {
  const black = mat('#141018', 0.3), white = mat('#ffffff', 0.2);
  for (const sx of [-1, 1]) {
    const e = ball(r, black); e.position.set(sx * x, y, z); head.add(e);
    const s = ball(r * 0.35, white); s.position.set(sx * x + r * 0.3, y + r * 0.35, z + r * 0.7); head.add(s);
  }
}

// ---------------------------------------------------------------- squirrel model
function makeSquirrel(color) {
  const fur = mat(color), cream = mat('#f6e3c4'), dark = mat('#5a3420');
  const root = new THREE.Group();
  const body = new THREE.Group(); root.add(body); // body pivots up when sitting
  body.position.y = 0.1;
  const torso = ball(0.09, fur, 0.85, 0.9, 1.25); torso.position.set(0, 0.03, 0); body.add(torso);
  const belly = ball(0.07, cream, 0.75, 0.8, 1.1); belly.position.set(0, 0.0, 0.045); body.add(belly);
  const head = new THREE.Group(); head.position.set(0, 0.1, 0.1); body.add(head);
  head.add(ball(0.065, fur, 1, 0.95, 1.05));
  const snout = ball(0.035, cream, 1, 0.85, 1); snout.position.set(0, -0.015, 0.05); head.add(snout);
  const nose = ball(0.011, mat('#3a2228', 0.3)); nose.position.set(0, -0.005, 0.083); head.add(nose);
  eyes(head, 0.012, 0.032, 0.018, 0.05);
  for (const sx of [-1, 1]) {
    const ear = cone(0.022, 0.05, fur); ear.position.set(sx * 0.032, 0.065, -0.005); ear.rotation.z = -sx * 0.25; head.add(ear);
  }
  // front paws (held up when nibbling) and back legs
  const front = [], back = [];
  for (const sx of [-1, 1]) {
    const f = leg(0.04, 0.014, fur, dark); f.position.set(sx * 0.04, 0.0, 0.08); body.add(f); front.push(f);
    const b = leg(0.05, 0.022, fur, dark); b.position.set(sx * 0.05, -0.01, -0.06); body.add(b); back.push(b);
  }
  // acorn (only shown while nibbling)
  const acorn = new THREE.Group();
  const nut = ball(0.016, mat('#a8743a'), 1, 1.2, 1); acorn.add(nut);
  const cap = ball(0.017, mat('#6b4423'), 1, 0.6, 1); cap.position.y = 0.012; acorn.add(cap);
  acorn.position.set(0, 0.03, 0.15); acorn.visible = false; body.add(acorn);
  // the big bushy S-shaped tail: a chain of fluffy balls
  const tail = new THREE.Group(); tail.position.set(0, 0.02, -0.11); body.add(tail);
  const tailBalls = [];
  for (let i = 0; i < 7; i++) {
    const t = i / 6;
    const b = ball(0.045 + Math.sin(t * Math.PI) * 0.03, i % 2 ? fur : mat(new THREE.Color(color).offsetHSL(0, 0, 0.06).getStyle()), 1, 1, 1);
    tail.add(b); tailBalls.push(b);
  }
  const anim = { sit: 0, hop: 0, t: Math.random() * 10, nibble: 0, climb: 0 };
  root.userData.update = (dt) => {
    anim.t += dt;
    const sit = anim.sit, hop = anim.hop, climb = anim.climb;
    body.rotation.x = -sit * 0.9 - climb * (Math.PI / 2);
    body.position.y = 0.1 + sit * 0.05;
    head.rotation.x = sit * 0.75 + climb * 1.2 + Math.sin(anim.t * 9) * 0.06 * anim.nibble;
    head.rotation.y = Math.sin(anim.t * 0.8) * 0.4 * (1 - hop);
    for (const [i, f] of front.entries()) f.rotation.x = -sit * 1.5 + Math.sin(anim.t * 18 + i) * 0.15 * anim.nibble + Math.sin(hop * Math.PI * 2) * 0.8;
    for (const b of back) b.rotation.x = sit * 0.9 - Math.sin(hop * Math.PI * 2) * 0.9;
    acorn.visible = anim.nibble > 0.5;
    acorn.position.set(0, 0.035 + Math.sin(anim.t * 9) * 0.004, 0.13);
    // tail curls up behind; it streams back while hopping
    const up = 1 - hop * 0.6;
    tailBalls.forEach((b, i) => {
      const t = i / 6, sw = Math.sin(anim.t * 2.2 - i * 0.5) * 0.02 * (1 + hop);
      b.position.set(sw, Math.sin(t * Math.PI * 0.85) * 0.2 * up + t * 0.06, -t * 0.12 * (1 + hop * 0.8) + Math.sin(t * Math.PI) * 0.05 * up);
    });
  };
  root.userData.anim = anim;
  root.scale.setScalar(1.6);
  return root;
}

// ---------------------------------------------------------------- raccoon model
function makeRaccoon() {
  const grey = mat('#8d8a93'), light = mat('#d9d6dc'), black = mat('#26232b'), darkGrey = mat('#4b4852');
  const root = new THREE.Group();
  const body = new THREE.Group(); body.position.y = 0.2; root.add(body);
  const torso = ball(0.17, grey, 0.9, 0.85, 1.25); body.add(torso);
  const belly = ball(0.13, light, 0.8, 0.7, 1.05); belly.position.set(0, -0.05, 0.05); body.add(belly);
  const head = new THREE.Group(); head.position.set(0, 0.1, 0.22); body.add(head);
  head.add(ball(0.11, grey, 1.05, 0.9, 1));
  // white cheeks + the black "bandit" mask across the eyes
  for (const sx of [-1, 1]) {
    const cheek = ball(0.06, light, 1, 0.8, 0.8); cheek.position.set(sx * 0.055, -0.02, 0.05); head.add(cheek);
    const ear = cone(0.035, 0.06, grey); ear.position.set(sx * 0.065, 0.09, -0.02); ear.rotation.z = -sx * 0.3; head.add(ear);
    const inner = cone(0.022, 0.04, light); inner.position.set(sx * 0.065, 0.088, -0.005); inner.rotation.z = -sx * 0.3; head.add(inner);
  }
  const mask = ball(0.07, black, 1.6, 0.42, 0.7); mask.position.set(0, 0.02, 0.06); head.add(mask);
  const brow = ball(0.05, light, 1.6, 0.25, 0.6); brow.position.set(0, 0.055, 0.075); head.add(brow);
  const snout = ball(0.045, light, 0.9, 0.75, 1.2); snout.position.set(0, -0.025, 0.1); head.add(snout);
  const nose = ball(0.016, black, 1.2, 0.9, 1); nose.position.set(0, -0.012, 0.152); head.add(nose);
  // shiny eyes inside the mask
  const eyeM = mat('#0b0a0e', 0.2), shine = mat('#ffffff', 0.2);
  for (const sx of [-1, 1]) {
    const e = ball(0.016, eyeM); e.position.set(sx * 0.042, 0.022, 0.1); head.add(e);
    const s = ball(0.006, shine); s.position.set(sx * 0.042 + 0.005, 0.03, 0.113); head.add(s);
  }
  const legs = [];
  for (const [sx, z] of [[-1, 0.12], [1, 0.12], [-1, -0.12], [1, -0.12]]) {
    const l = leg(0.07, 0.035, darkGrey, black); l.position.set(sx * 0.09, -0.06, z); body.add(l); legs.push(l);
  }
  // ringed tail
  const tail = new THREE.Group(); tail.position.set(0, 0.02, -0.2); body.add(tail);
  const rings = [];
  for (let i = 0; i < 8; i++) {
    const r = ball(0.055 - i * 0.003, i % 2 ? black : grey, 1, 1, 0.9);
    if (i === 7) r.material = black;
    tail.add(r); rings.push(r);
  }
  const anim = { sit: 0, walk: 0, t: Math.random() * 10, wash: 0 };
  root.userData.update = (dt) => {
    anim.t += dt;
    const sit = anim.sit, w = anim.walk, ph = anim.t * 7;
    body.rotation.x = -sit * 1.1;
    body.position.y = 0.2 + sit * 0.1 + Math.abs(Math.sin(ph)) * 0.015 * w;
    body.rotation.z = Math.sin(ph) * 0.07 * w; // the waddle
    head.rotation.x = sit * 1.0 + Math.sin(anim.t * 1.3) * 0.08;
    head.rotation.y = Math.sin(anim.t * 0.7) * 0.5 * (1 - w * 0.7);
    legs.forEach((l, i) => {
      const s = (i === 0 || i === 3) ? 1 : -1;
      l.rotation.x = Math.sin(ph) * 0.6 * w * s;
      if (i < 2) l.rotation.x += -sit * 1.6 + Math.sin(anim.t * 12 + i * Math.PI) * 0.25 * anim.wash; // rubbing paws
      else l.rotation.x += sit * 1.1;
    });
    rings.forEach((r, i) => {
      const t = i / 7;
      r.position.set(Math.sin(anim.t * 2 - i * 0.6) * 0.03 * t * (1 + w), 0.02 + t * 0.06 - t * t * 0.08 + sit * t * -0.1, -t * 0.36);
    });
  };
  root.userData.anim = anim;
  root.scale.setScalar(1.4);
  return root;
}

// ---------------------------------------------------------------- behaviour
/**
 * level: the Pinky Land level (needs scene, terrain, world, creatures)
 * trees: tree colliders [{x, z, r}] to hop between and climb
 */
export function addForestFriends(level, { trees, squirrels = 9, raccoons = 4, camp, keepOut = [] }) {
  const rand = makeRandom(77);
  const terrain = level.terrain, scene = level.scene;
  const H = (x, z) => terrain.getHeight(x, z);
  const okGround = (x, z) => H(x, z) > 1.0 && !keepOut.some((k) => Math.hypot(x - k.x, z - k.z) < k.r);
  const nearTrees = (x, z, d) => trees.filter((t) => Math.hypot(t.x - x, t.z - z) < d);
  // pick tree clusters (trees with several neighbours) as homes
  const homes = trees.filter((t) => nearTrees(t.x, t.z, 14).length >= 4 && okGround(t.x, t.z));
  const pickHome = () => homes[Math.floor(rand() * homes.length)] || trees[0];
  const list = [];
  const sq = [], rc = [];

  for (let i = 0; i < squirrels; i++) {
    const m = makeSquirrel(['#b5652e', '#a8582a', '#c07a3e', '#8f6b55'][i % 4]);
    const home = pickHome();
    const s = { m, a: m.userData.anim, x: home.x + 1.5, z: home.z, y: 0, yaw: rand() * 6, mode: 'sit', t: 1 + rand() * 3,
      from: new THREE.Vector2(), to: new THREE.Vector2(), hopT: 0, hopLen: 0, tree: home, climbY: 0, climbTo: 0, scared: false };
    scene.add(m); sq.push(s);
  }
  for (let i = 0; i < raccoons; i++) {
    const m = makeRaccoon();
    const home = pickHome();
    const r = { m, a: m.userData.anim, x: home.x + 2, z: home.z + 1, yaw: rand() * 6, mode: 'sit', t: 2 + rand() * 4, tx: 0, tz: 0, home };
    scene.add(m); rc.push(r);
  }

  const squirrelUpdate = (dt, ctx) => {
    const pp = ctx.playerPos, fast = ctx.playerSpeed > 4.5;
    for (const s of sq) {
      const a = s.a;
      const pd = pp ? Math.hypot(pp.x - s.x, pp.z - s.z) : 99;
      // startled: scamper to the closest tree and climb it
      if (pd < (fast ? 5 : 2.2) && s.mode !== 'climb' && s.mode !== 'up' && s.mode !== 'down') {
        const t = nearTrees(s.x, s.z, 12).sort((p, q) => Math.hypot(p.x - s.x, p.z - s.z) - Math.hypot(q.x - s.x, q.z - s.z))[0];
        if (t) { s.tree = t; s.mode = 'run'; s.scared = true; }
      }
      s.t -= dt;
      a.nibble = THREE.MathUtils.damp(a.nibble, s.mode === 'sit' && s.t % 4 < 2.6 ? 1 : 0, 6, dt);
      if (s.mode === 'sit') {
        a.sit = THREE.MathUtils.damp(a.sit, 1, 6, dt); a.hop = 0;
        if (s.t < 0) { s.mode = 'hop'; s.hops = 2 + Math.floor(rand() * 5); s.yaw += (rand() - 0.5) * 2.5; s.hopT = 0; }
      } else if (s.mode === 'hop' || s.mode === 'run') {
        a.sit = THREE.MathUtils.damp(a.sit, 0, 10, dt);
        const sp = s.mode === 'run' ? 4.2 : 1.6;
        if (s.mode === 'run') {
          const ang = Math.atan2(s.tree.x - s.x, s.tree.z - s.z);
          s.yaw = angleDamp(s.yaw, ang, 10, dt);
          const rr = s.tree.r * 0.7 + 0.12;
          if (Math.hypot(s.tree.x - s.x, s.tree.z - s.z) < rr + 0.15) { s.mode = 'up'; s.climbY = 0; s.climbTo = Math.max(0.8, (s.tree.top - H(s.tree.x, s.tree.z)) * (0.22 + rand() * 0.1)); s.side = Math.atan2(s.x - s.tree.x, s.z - s.tree.z); }
        }
        s.hopT += dt * (s.mode === 'run' ? 4 : 2.6);
        a.hop = s.hopT % 1;
        const nx = s.x + Math.sin(s.yaw) * sp * dt, nz = s.z + Math.cos(s.yaw) * sp * dt;
        if (s.mode === 'run' || okGround(nx, nz)) { s.x = nx; s.z = nz; } else s.yaw += Math.PI * 0.6;
        // stay near their home trees
        const hd = Math.hypot(s.x - s.tree.x, s.z - s.tree.z);
        if (s.mode === 'hop' && hd > 9) s.yaw = angleDamp(s.yaw, Math.atan2(s.tree.x - s.x, s.tree.z - s.z), 3, dt);
        s.y = Math.abs(Math.sin(a.hop * Math.PI)) * (s.mode === 'run' ? 0.12 : 0.18);
        if (s.mode === 'hop' && s.hopT >= s.hops) {
          s.mode = 'sit'; s.t = 2 + rand() * 5; s.y = 0;
          if (rand() < 0.3) { const t = nearTrees(s.x, s.z, 10)[Math.floor(rand() * 3)]; if (t) { s.tree = t; s.mode = 'run'; s.scared = false; } }
        }
      } else if (s.mode === 'up' || s.mode === 'climb' || s.mode === 'down') {
        a.sit = 0; a.nibble = 0;
        a.climb = THREE.MathUtils.damp(a.climb, s.mode === 'down' ? -1 : 1, 8, dt);
        if (s.mode === 'up') { s.climbY += dt * 2.2; a.hop = (anim(s) * 3) % 1; if (s.climbY >= s.climbTo) { s.mode = 'climb'; s.t = s.scared ? 4 + rand() * 4 : 2 + rand() * 3; } }
        else if (s.mode === 'climb') { a.hop = 0; if (s.t < 0 && !(pd < 3 && fast)) s.mode = 'down'; }
        else { s.climbY -= dt * 1.6; a.hop = (anim(s) * 3) % 1; if (s.climbY <= 0) { s.climbY = 0; s.mode = 'sit'; s.t = 1.5 + rand() * 3; a.climb = 0; s.scared = false; s.yaw = s.side; const rr = s.tree.r * 0.7 + 0.45; s.x = s.tree.x + Math.sin(s.side) * rr; s.z = s.tree.z + Math.cos(s.side) * rr; } }
      }
      const climbing = s.mode === 'up' || s.mode === 'climb' || s.mode === 'down';
      if (climbing) {
        const rr = s.tree.r * 0.62 + 0.1;
        s.x = s.tree.x + Math.sin(s.side) * rr; s.z = s.tree.z + Math.cos(s.side) * rr;
        s.m.position.set(s.x, H(s.tree.x, s.tree.z) + 0.1 + s.climbY, s.z);
        s.m.rotation.set(0, s.side + Math.PI, 0); // belly against the bark, head up (or down)
        s.m.userData.anim.climb = a.climb;
      } else {
        s.m.position.set(s.x, H(s.x, s.z) + s.y, s.z);
        s.m.rotation.set(0, s.yaw, 0);
      }
      s.m.userData.update(dt);
    }
  };
  const anim = (s) => s.a.t;

  const raccoonUpdate = (dt, ctx) => {
    const night = ctx.night || 0, pp = ctx.playerPos;
    for (const r of rc) {
      const a = r.a;
      r.t -= dt;
      const pd = pp ? Math.hypot(pp.x - r.x, pp.z - r.z) : 99;
      if (r.mode === 'sit' || r.mode === 'sniff') {
        a.walk = THREE.MathUtils.damp(a.walk, 0, 6, dt);
        a.sit = THREE.MathUtils.damp(a.sit, r.mode === 'sit' ? 1 : 0, 4, dt);
        a.wash = THREE.MathUtils.damp(a.wash, r.mode === 'sit' && r.t % 5 < 3 ? 1 : 0, 4, dt);
        // curious: turn to look at you when you come close
        if (pd < 4) r.yaw = angleDamp(r.yaw, Math.atan2(pp.x - r.x, pp.z - r.z), 3, dt);
        if (r.t < 0) {
          // pick somewhere to waddle; at night, often toward the campfire for snacks
          let tx, tz;
          for (let k = 0; k < 8; k++) {
            if (night > 0.5 && camp && rand() < 0.4) { const ang = rand() * 6.28; tx = camp.x + Math.cos(ang) * 4.5; tz = camp.z + Math.sin(ang) * 4.5; }
            else { const ang = rand() * 6.28, d = 3 + rand() * 9; tx = r.home.x + Math.cos(ang) * d; tz = r.home.z + Math.sin(ang) * d; }
            if (okGround(tx, tz) || (camp && Math.hypot(tx - camp.x, tz - camp.z) < 6)) break;
          }
          r.tx = tx; r.tz = tz; r.mode = 'walk';
        }
      } else if (r.mode === 'walk') {
        a.sit = THREE.MathUtils.damp(a.sit, 0, 8, dt); a.wash = 0;
        a.walk = THREE.MathUtils.damp(a.walk, 1, 5, dt);
        const dx = r.tx - r.x, dz = r.tz - r.z, d = Math.hypot(dx, dz);
        const sp = 0.75 + night * 0.35;
        r.yaw = angleDamp(r.yaw, Math.atan2(dx, dz), 4, dt);
        r.x += Math.sin(r.yaw) * sp * dt; r.z += Math.cos(r.yaw) * sp * dt;
        if (d < 0.4 || r.t < -25) { r.mode = rand() < 0.6 ? 'sit' : 'sniff'; r.t = (night > 0.5 ? 3 : 6) + rand() * 6; }
      }
      // shy at first: back away a little if you run straight at them
      if (pd < 1.6 && ctx.playerSpeed > 4.5) { const ax = r.x - pp.x, az = r.z - pp.z, l = Math.hypot(ax, az) || 1; r.tx = r.x + ax / l * 4; r.tz = r.z + az / l * 4; r.mode = 'walk'; r.t = 0; }
      r.m.position.set(r.x, H(r.x, r.z), r.z);
      r.m.rotation.y = r.yaw;
      r.m.userData.update(dt);
    }
  };

  const near = (arr) => (p, d) => arr.some((o) => Math.hypot(o.m.position.x - p.x, o.m.position.z - p.z) < 7 && Math.abs(o.m.position.y - p.y) < 5);
  list.push({ name: 'Squirrel', journalKey: 'squirrel', object: sq[0]?.m, update: squirrelUpdate, near: near(sq) });
  list.push({ name: 'Raccoon', journalKey: 'raccoon', object: rc[0]?.m, update: raccoonUpdate, near: near(rc) });
  return { list, squirrels: sq, raccoons: rc };
}
