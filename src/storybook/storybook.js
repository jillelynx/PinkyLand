// Pinky's Storybook Adventure — a 2.5D side-scrolling platformer.
// Gameplay happens on a flat path (left/right, up/down) but everything is drawn
// in 3D with layers of scenery, so it feels like a pop-up picture book.
import * as THREE from 'three';
import { Pillow } from '../characters/pinky.js';
import { createCollectible, animateCollectible, glowTexture } from '../world/props.js';
import { sharedUniforms } from '../world/terrain.js';
import { drawThought } from './pinkySprite.js';
import { rng } from './paint.js';
import {
  S, toX, toY, DEPTH, makeGround, makeBlock, makeOneway, makeMover, makeBouncy, makeWater, makeThorns,
  makeBunny, makeCheckpoint, makeGoal, scrapTexture, drawScrap, drawFinalPicture, makeBackdrop, makeSky,
} from './world25d.js';
import { LEVEL1 } from './level1.js';
import { LEVEL2 } from './level2.js';
import { LEVEL3 } from './level3.js';
import { PixelJungle, drawMapPicture } from './pixelJungle.js';
import { makeHouseBackdrop, makeParallax, nameScrapTexture, drawNamePiece, drawNameTag } from './world25dHouse.js';

const SAVE_KEY = 'pinky-storybook-v1';
export const LEVELS = [LEVEL1, LEVEL2, LEVEL3];

// movement tuning (game pixels per second)
const PH = {
  gravity: 2150, jump: 800, jumpCut: 0.45, walk: 230, run: 345, accel: 2600, airAccel: 1700, decel: 3000,
  maxFall: 950, coyote: 0.1, buffer: 0.13, w: 32, h: 49, bunnyBounce: 640, bunnyBounceHeld: 880,
  doubleJump: 690, stepUp: 34,
};

const SCRAP_NAMES = { hair: 'curly brown hair and two bright eyes', hoodie: 'a pink hoodie, blue shorts and white sneakers', smile: 'a gentle smile… and a little pink pillow, hugged tight' };

export class Storybook {
  constructor(game) {
    this.game = game;
    this.engine = game.engine;
    this.input = game.input;
    this.audio = game.audio;
    this.save = this.loadSave();
    this.paused = false;
    this.buildUI();
  }

  // ---------------- saving (kept separate from the 3D game) ----------------
  loadSave() {
    try { return JSON.parse(localStorage.getItem(SAVE_KEY)) || { done: {}, best: {}, cp: null, scrapsEver: [] }; } catch (e) { return { done: {}, best: {}, cp: null, scrapsEver: [] }; }
  }
  // keep what you've found so far (you'll restart from your last star checkpoint)
  saveProgress() {
    if (this.level && this.run && this.state !== 'ending') {
      this.save.cp = { level: this.level.id, idx: this.run.cp, stars: [...this.run.stars], scraps: [...this.run.scraps], seen: [...this.run.seen] };
    }
    this.writeSave();
  }

  writeSave() { if (this.game.testMode) return; try { localStorage.setItem(SAVE_KEY, JSON.stringify(this.save)); } catch (e) { /* ignore */ } }

  // ---------------- UI ----------------
  buildUI() {
    const el = document.createElement('div');
    el.className = 'sb-ui';
    el.innerHTML = `
      <div class="sb-hud">
        <div class="pill"><span class="sb-hp"></span></div>
        <div class="pill">⭐ <span class="sb-stars">0</span></div>
        <div class="pill sb-scraps" title="Drawing scraps"></div>
      </div>
      <button class="icon-btn sb-pause-btn" title="Pause (Esc)">⏸<small>Esc</small></button>
      <div class="sb-caption"></div>
      <canvas class="sb-thought" width="120" height="110"></canvas>
      <div class="sb-tip"></div>
      <div class="overlay hidden sb-overlay"><div class="panel sb-panel"></div></div>
      <div class="sb-reveal hidden"><canvas width="520" height="520"></canvas><div class="sb-reveal-text"></div></div>`;
    document.body.appendChild(el);
    this.ui = el;
    this.hpEl = el.querySelector('.sb-hp');
    this.starsEl = el.querySelector('.sb-stars');
    this.scrapsEl = el.querySelector('.sb-scraps');
    this.captionEl = el.querySelector('.sb-caption');
    this.thoughtCanvas = el.querySelector('.sb-thought');
    this.tipEl = el.querySelector('.sb-tip');
    this.overlay = el.querySelector('.sb-overlay');
    this.panel = el.querySelector('.sb-panel');
    this.revealEl = el.querySelector('.sb-reveal');
    el.querySelector('.sb-pause-btn').addEventListener('click', (e) => { e.stopPropagation(); this.togglePause(); });
    const style = document.createElement('style');
    style.textContent = `
      .sb-ui { position: fixed; inset: 0; pointer-events: none; z-index: 6; font-family: var(--round); }
      .sb-ui > * { pointer-events: auto; }
      .sb-hud { position: absolute; top: 16px; left: 16px; display: flex; gap: 10px; pointer-events: none; }
      .sb-hp { color: #ff5f8f; font-size: 22px; letter-spacing: 2px; }
      .sb-scraps { display: flex; gap: 6px; }
      .sb-scraps i { width: 26px; height: 22px; border-radius: 5px 9px 4px 8px; background: #efe3ea; display: inline-block; box-shadow: inset 0 0 0 2px #d9c6d3; transform: rotate(-6deg); }
      .sb-scraps i.on { background: #fffaf0; box-shadow: inset 0 0 0 2px #e0609a, 0 0 10px rgba(255,120,170,.7); }
      .sb-pause-btn { position: absolute; top: 16px; right: 16px; }
      .sb-caption { position: absolute; left: 50%; bottom: 6%; transform: translateX(-50%) translateY(12px); max-width: min(860px, 90vw); padding: 14px 26px; font-family: var(--kid); font-size: clamp(18px, 2.2vw, 27px); text-align: center; color: #4a2d4a; background: rgba(255, 250, 240, .9); border-radius: 20px; box-shadow: var(--shadow); opacity: 0; transition: opacity .7s, transform .7s; pointer-events: none; }
      .sb-caption.show { opacity: 1; transform: translateX(-50%); }
      .sb-thought { position: absolute; width: 120px; height: 110px; pointer-events: none; opacity: 0; transition: opacity .3s; }
      .sb-tip { position: absolute; left: 50%; top: 18%; transform: translateX(-50%); font-family: var(--kid); font-size: 22px; color: #fff; text-shadow: 0 2px 6px rgba(60,20,60,.6); opacity: 0; transition: opacity .5s; pointer-events: none; text-align: center; }
      .sb-tip.show { opacity: 1; }
      .sb-reveal { position: absolute; inset: 0; display: grid; place-items: center; background: rgba(60, 30, 70, .45); z-index: 12; pointer-events: none; }
      .sb-reveal canvas { width: min(420px, 70vmin); height: min(420px, 70vmin); filter: drop-shadow(0 12px 30px rgba(0,0,0,.35)); animation: scrapIn .8s cubic-bezier(.2,1.5,.4,1); }
      .sb-reveal-text { position: absolute; bottom: 10%; font-family: var(--kid); font-size: clamp(20px, 2.6vw, 30px); color: #fff; text-shadow: 0 2px 8px rgba(0,0,0,.5); text-align: center; padding: 0 20px; }
      @keyframes scrapIn { from { transform: scale(.3) rotate(-20deg); opacity: 0; } }
      .sb-panel { width: min(560px, 92vw); text-align: center; }
      .sb-panel .big-btn { min-width: 0; width: 100%; font-size: 19px; }
      .sb-panel .stat { font-family: var(--kid); font-size: 22px; margin: 6px 0; }
    `;
    document.head.appendChild(style);
  }

  caption(text, seconds = 5) {
    this.captionEl.textContent = text;
    this.captionEl.classList.add('show');
    clearTimeout(this._capT);
    this._capT = setTimeout(() => this.captionEl.classList.remove('show'), seconds * 1000);
  }

  tip(text, seconds = 3) {
    this.tipEl.innerHTML = text;
    this.tipEl.classList.add('show');
    clearTimeout(this._tipT);
    this._tipT = setTimeout(() => this.tipEl.classList.remove('show'), seconds * 1000);
  }

  updateHUD() {
    const r = this.run;
    this.hpEl.textContent = '♥'.repeat(r.hp) + '♡'.repeat(Math.max(0, 3 - r.hp));
    this.starsEl.textContent = `${r.stars.length} / ${this.level.stars.length}`;
    this.scrapsEl.innerHTML = this.level.scraps.map((s) => `<i class="${r.scraps.includes(s.id) ? 'on' : ''}"></i>`).join('');
  }

  // ---------------- level setup ----------------
  start(levelIndex = 0, resume = true) {
    const L = LEVELS[levelIndex] || LEVELS[0];
    this.level = L;
    this.ph = { ...PH, ...(L.physics || {}) };
    if (this.pix) { this.pix.dispose(); this.pix = null; }
    const cp = resume && this.save.cp && this.save.cp.level === L.id ? this.save.cp : null;
    this._cap1 = this._cap2 = this._birthBurst = this._end1 = this._end2 = this._end3 = this._end4 = false;
    this._secretTip = false;
    this.run = cp ? { cp: cp.idx, stars: [...cp.stars], scraps: [...cp.scraps], hp: 3, seen: cp.seen || [] } : { cp: -1, stars: [], scraps: [], hp: 3, seen: [] };
    this.buildScene();
    const spawnX = this.run.cp >= 0 ? L.checkpoints[this.run.cp].x : L.start.x;
    const spawnY = this.run.cp >= 0 ? (L.checkpoints[this.run.cp].y || 440) : L.start.y;
    this.p = { x: spawnX, y: spawnY, vx: 0, vy: 0, facing: 1, grounded: true, coyote: 0, buffer: 0, inv: 0, standing: null, lastSafe: { x: spawnX, y: spawnY }, doubled: false, spin: 0, duck: false, slideT: 0, attack: null };
    for (const r of L.breakables || []) r.broken = false;
    this.camX = spawnX; this.camY = spawnY - 120;
    this.time = 0;
    this.state = cp || L.intro !== 'birth' ? 'play' : 'birth'; // coming back to a saved game skips the opening
    this.stateT = 0;
    this.audio.state.scene = 'storybook';
    this.audio.state.night = 0.3;
    this.updateHUD();
    this.pinky.root.scale.setScalar(this.state === 'birth' ? 0.001 : 0.95);
    this.swirl.visible = this.state === 'birth';
    if (this.state === 'play') {
      if (cp) this.caption(L.resumeCaption || 'Pinky kept going. Somewhere, someone was waiting…', 4);
      else { this.caption(L.openCaption || '', 6); this.game.ui.chapter?.(L.title, L.subtitle, 3.5); this.tip('Press Space again in the air to double jump!', 4); }
    }
  }

  // Chapter 3 is drawn in pixel art on its own canvas; the 3D scene only keeps
  // simple placeholders so the shared game rules keep working.
  buildPixelScene() {
    const L = this.level;
    this.scene = new THREE.Scene();
    const dummy = (x = 0, y = 440) => {
      const o = new THREE.Object3D();
      o.position.set(toX(x), toY(y), 0);
      o.userData = { star: new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshStandardMaterial()), heart: new THREE.Object3D(), body: new THREE.Object3D(), paper: new THREE.Object3D(), inner: new THREE.Object3D(), t: 0 };
      return o;
    };
    this.backdrop = new THREE.Group(); this.backdrop.userData = {};
    this.parallax = []; this.nameSign = null;
    for (const b of L.bouncy) b.mesh = dummy(b.x, b.y);
    this.movers = L.movers.map((m) => ({ ...m, mesh: dummy(), cx: m.x, cy: m.y, px: m.x, py: m.y }));
    this.bunnies = L.bunnies.map((b) => ({ x: b.x, home: b.x, range: b.range, dir: 1, state: 'walk', t: Math.random() * 5, mesh: dummy(), y: b.y || 440, kind: b.kind }));
    this.checkpoints = L.checkpoints.map((c, i) => ({ ...c, mesh: dummy(c.x, c.y || 440), on: i <= this.run.cp }));
    this.goal = dummy(L.goal.x);
    this.starObjs = L.stars.map((s, i) => (this.run.stars.includes(i) ? null : dummy(...s)));
    this.scrapObjs = L.scraps.map((sc) => (this.run.scraps.includes(sc.id) ? null : dummy(sc.x, sc.y)));
    this.bushMat = { opacity: 1 };
    this.motes = new THREE.Object3D();
    this.pinky = new Pillow({ scale: 0.95, name: 'Pinky' }); // rides along in Jacinta's backpack
    this.swirl = new THREE.Object3D();
    this.particles = [];
    this.pix = new PixelJungle(L);
  }

  buildScene() {
    const L = this.level;
    if (L.theme === 'pixel') return this.buildPixelScene();
    const scene = new THREE.Scene();
    this.scene = scene;
    const rand = rng(7);
    this.sky = makeSky();
    scene.add(this.sky);
    scene.fog = new THREE.Fog('#6a5aa8', 25, 90);
    this.hemi = new THREE.HemisphereLight('#c9d6ff', '#7a6a8a', 1.0);
    scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight('#ffffff', 2.0);
    this.sun.castShadow = this.engine.q.shadows;
    this.sun.shadow.mapSize.set(2048, 2048);
    Object.assign(this.sun.shadow.camera, { left: -16, right: 16, top: 12, bottom: -12, near: 1, far: 60 });
    this.sun.shadow.bias = -0.0005;
    this.sun.shadow.normalBias = 0.02;
    scene.add(this.sun, this.sun.target);

    this.backdrop = L.theme === 'house' ? makeHouseBackdrop(L, rand) : makeBackdrop(L, rand);
    scene.add(this.backdrop);
    // the name sign on Jacinta's door (letters fill in at the end of Chapter 2)
    this.nameSign = null;
    if (this.backdrop.userData.nameDoor) {
      const c = document.createElement('canvas'); c.width = 512; c.height = 256;
      drawNameTag(c.getContext('2d'), 512, 256, []);
      const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
      const sign = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 0.9), new THREE.MeshStandardMaterial({ map: t, transparent: true }));
      const nd = this.backdrop.userData.nameDoor;
      sign.position.set(nd.x, nd.y, -1.98);
      scene.add(sign);
      this.nameSign = { c, t };
    }
    // parallax layers that slide at their own speed as the camera moves
    this.parallax = makeParallax(L, rand);
    for (const ly of this.parallax) scene.add(ly.group);
    for (const g of L.ground) scene.add(makeGround(g));
    for (const b of L.blocks) scene.add(makeBlock(b));
    for (const o of L.oneways) scene.add(makeOneway(o));
    for (const b of L.bouncy) { const m = makeBouncy(b); b.mesh = m; scene.add(m); }
    for (const w of L.water) scene.add(makeWater(w));
    for (const h of L.hazards) scene.add(makeThorns(h));
    this.movers = L.movers.map((m) => { const mesh = makeMover(m); scene.add(mesh); return { ...m, mesh, cx: m.x, cy: m.y, px: m.x, py: m.y }; });
    this.bunnies = L.bunnies.map((b) => { const mesh = makeBunny(b.kind); scene.add(mesh); return { x: b.x, home: b.x, range: b.range, dir: 1, state: 'walk', t: rand() * 5, mesh, y: b.y || 440, kind: b.kind }; });
    this.checkpoints = L.checkpoints.map((c, i) => {
      const mesh = makeCheckpoint();
      mesh.position.set(toX(c.x), toY(c.y || 440), -0.6);
      scene.add(mesh);
      if (i <= this.run.cp) this._lightCheckpoint(mesh, false);
      return { ...c, mesh, on: i <= this.run.cp };
    });
    this.goal = makeGoal();
    this.goal.position.set(toX(L.goal.x), toY(L.goal.y || 440), -0.4);
    scene.add(this.goal);
    // stars
    this.starObjs = L.stars.map(([x, y], i) => {
      if (this.run.stars.includes(i)) return null;
      const s = createCollectible('star');
      s.scale.setScalar(0.62);
      s.position.set(toX(x), toY(y), 0);
      scene.add(s);
      return s;
    });
    // scraps of the drawing
    this.scrapObjs = L.scraps.map((sc) => {
      if (this.run.scraps.includes(sc.id)) return null;
      const g = new THREE.Group();
      const paper = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.8), new THREE.MeshStandardMaterial({ map: L.scrapStyle === 'name' ? nameScrapTexture(sc.id) : scrapTexture(sc.id), transparent: true, side: THREE.DoubleSide, emissive: '#ffffff', emissiveIntensity: 0.25, alphaTest: 0.1 }));
      g.add(paper);
      const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: '#ffb3d9', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.8 }));
      halo.scale.setScalar(1.8);
      g.add(halo);
      g.position.set(toX(sc.x), toY(sc.y) - 0.1, sc.hidden ? -0.2 : 0);
      g.userData = { paper, t: rand() * 5 };
      scene.add(g);
      return g;
    });
    // the secret bush in front (fades when Pinky is behind it)
    const sb = L.secretBush;
    this.bush = new THREE.Group();
    const bushMat = new THREE.MeshStandardMaterial({ color: '#4f9d45', roughness: 0.9, transparent: true, opacity: 1 });
    for (let i = 0; i < 9; i++) {
      const b = new THREE.Mesh(new THREE.IcosahedronGeometry(0.75 + (i % 3) * 0.2, 2), bushMat);
      b.position.set((i / 8 - 0.5) * sb.w * S, 0.5 + (i % 2) * 0.45, 0);
      b.castShadow = true;
      this.bush.add(b);
    }
    this.bush.position.set(toX(sb.x + sb.w / 2), 0, DEPTH / 2 + 0.6);
    this.bushMat = bushMat;
    scene.add(this.bush);
    // doodled signs that teach controls
    for (const sg of L.signs) scene.add(this._sign(sg));
    // the curled edge of the paper at the end of the world
    const edgeX = toX(L.paperEdge + 30);
    const curl = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, DEPTH + 1, 24, 1, true, 0, Math.PI * 1.4), new THREE.MeshStandardMaterial({ color: '#fbf4e6', side: THREE.DoubleSide, roughness: 1 }));
    curl.rotation.x = Math.PI / 2;
    curl.position.set(edgeX, -0.6, 0);
    curl.castShadow = true;
    scene.add(curl);
    // floating dust motes for a dreamy feel
    const n = 300;
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { pos[i * 3] = rand() * toX(L.width); pos[i * 3 + 1] = rand() * 9 - 1; pos[i * 3 + 2] = (rand() - 0.5) * 14 - 3; }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.motes = new THREE.Points(geo, new THREE.PointsMaterial({ size: 0.09, color: '#fff3c4', transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false, map: glowTexture() }));
    scene.add(this.motes);

    // Pinky!
    this.pinky = new Pillow({ scale: 0.95, name: 'Pinky' });
    scene.add(this.pinky.root);
    // the "being imagined" pencil swirl
    const pts = [];
    for (let i = 0; i <= 200; i++) { const t = i / 200; const a = t * Math.PI * 8; pts.push(new THREE.Vector3(Math.cos(a) * (0.7 - t * 0.3), t * 1.1, Math.sin(a) * (0.7 - t * 0.3))); }
    this.swirl = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 400, 0.02, 5), new THREE.MeshBasicMaterial({ color: '#ff9ec6', transparent: true }));
    this.swirl.geometry.setDrawRange(0, 0);
    scene.add(this.swirl);
    this.particles = [];

    this.engine.setScene(scene);
    this.engine.camera.fov = 38;
    this.engine.camera.updateProjectionMatrix();
    this.engine.renderer.compile(scene, this.engine.camera);
  }

  _sign(sg) {
    const c = document.createElement('canvas');
    c.width = 256; c.height = 160;
    const g = c.getContext('2d');
    g.fillStyle = '#fffaf0'; g.fillRect(0, 0, 256, 160);
    g.strokeStyle = '#c7a6c0'; g.lineWidth = 6; g.strokeRect(6, 6, 244, 148);
    g.fillStyle = '#4a2d4a'; g.font = 'bold 28px "Chalkboard SE", "Marker Felt", "Comic Sans MS", sans-serif';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    const key = (x, y, w, label) => {
      g.fillStyle = '#ff8fb8'; g.fillRect(x - w / 2, y - 22, w, 44);
      g.fillStyle = '#ffffff'; g.fillText(label, x, y + 1);
    };
    if (sg.kind === 'arrows') { key(80, 70, 56, '←'); key(176, 70, 56, '→'); g.fillStyle = '#4a2d4a'; g.font = 'bold 22px "Chalkboard SE", "Comic Sans MS", sans-serif'; g.fillText('walk', 128, 128); }
    else if (sg.kind === 'jump') { key(128, 62, 150, 'Space'); g.fillStyle = '#4a2d4a'; g.font = 'bold 22px "Chalkboard SE", "Comic Sans MS", sans-serif'; g.fillText('jump! (hold = higher)', 128, 122); }
    else if (sg.kind === 'run') { key(128, 62, 130, 'Shift'); g.fillStyle = '#4a2d4a'; g.font = 'bold 22px "Chalkboard SE", "Comic Sans MS", sans-serif'; g.fillText('hold to run', 128, 122); }
    else if (sg.kind === 'stomp') { g.fillText('⬇ bounce on', 128, 60); g.fillText('dust bunnies!', 128, 104); }
    else if (sg.kind === 'bounce') { g.fillText('boing!', 128, 60); g.fillText('☁ ⬆', 128, 108); }
    else if (sg.kind === 'double') { key(128, 52, 150, 'Space ×2'); g.fillStyle = '#4a2d4a'; g.font = 'bold 22px "Chalkboard SE", "Comic Sans MS", sans-serif'; g.fillText('jump again in the air!', 128, 104); g.fillText('= double jump ✨', 128, 134); }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    const grp = new THREE.Group();
    const board = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.82, 0.05), [0, 0, 0, 0, 1, 0].map((i) => (i ? new THREE.MeshStandardMaterial({ map: t }) : new THREE.MeshStandardMaterial({ color: '#d9a066' }))));
    board.position.y = 1.35;
    board.castShadow = true;
    grp.add(board);
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 1.0, 6), new THREE.MeshStandardMaterial({ color: '#b8794a' }));
    post.position.y = 0.5;
    grp.add(post);
    grp.position.set(toX(sg.x), 0, -1.1);
    grp.rotation.y = 0.1;
    return grp;
  }

  // ---------------- physics helpers ----------------
  solids() {
    const L = this.level;
    const out = [];
    for (const g of L.ground) out.push({ x: g.x0, y: g.y, w: g.x1 - g.x0, h: 800 });
    for (const b of L.blocks) out.push(b);
    for (const r of L.breakables || []) if (!r.broken) out.push(r);
    return out;
  }

  platforms() {
    const L = this.level;
    const out = L.oneways.map((o) => ({ x: o.x, y: o.y, w: o.w }));
    for (const m of this.movers) out.push({ x: m.cx, y: m.cy, w: m.w, mover: m });
    for (const b of L.bouncy) out.push({ x: b.x, y: b.y, w: b.w, bouncy: b });
    return out;
  }

  // ---------------- main update ----------------
  update(dt) {
    dt = Math.min(dt, 1 / 30);
    const inp = this.input;
    if (inp.pressed.has('Escape') || inp.pressed.has('Pad_pause')) this.togglePause();
    if (this.paused) return;
    this.time += dt;
    this.stateT += dt;
    sharedUniforms.uTime.value += dt;
    const L = this.level;

    // movers
    for (const m of this.movers) {
      const k = (Math.sin((this.time / m.period) * Math.PI * 2 + m.phase) + 1) / 2;
      m.px = m.cx; m.py = m.cy;
      m.cx = m.x + m.dx * k;
      m.cy = m.y + m.dy * k;
      m.mesh.position.set(toX(m.cx + m.w / 2), toY(m.cy) + (m.kind === 'boat' ? Math.sin(this.time * 2.4) * 0.03 : 0), 0);
    }

    if (this.state === 'birth') this.updateBirth(dt);
    else if (this.state === 'play') this.updatePlayer(dt);
    else if (this.state === 'ending') this.updateEnding(dt);
    else if (this.state === 'respawn') this.updateRespawn(dt);

    this.updateWorld(dt);
    this.render(dt);
  }

  updateBirth(dt) {
    const t = this.stateT;
    const p = this.p;
    this.swirl.position.set(toX(p.x), toY(p.y) - 0.05, 0);
    const prog = Math.min(1, t / 2.2);
    this.swirl.geometry.setDrawRange(0, Math.floor(this.swirl.geometry.index.count * prog));
    this.swirl.material.opacity = t < 2.6 ? 1 : Math.max(0, 1 - (t - 2.6) * 2);
    const grow = Math.min(1, Math.max(0, (t - 1.6) / 0.9));
    const e = grow < 1 ? 1 - Math.pow(1 - grow, 3) + Math.sin(grow * Math.PI) * 0.18 : 1;
    this.pinky.root.scale.setScalar(0.95 * Math.max(0.001, e));
    if (t > 2.4 && !this._birthBurst) { this._birthBurst = true; this.burst(p.x, p.y - 30, '#ffb3d9', 30); this.audio.heart(); }
    if (t > 0.3 && !this._cap1) { this._cap1 = true; this.caption('Once upon a time, a little girl drew a pillow… and loved it so much that it became real.', 6.5); this.audio.page(); }
    if (t > 3.0 && t < 6.5) {
      // Pinky looks around, full of wonder
      this.pinky.root.rotation.y = Math.sin((t - 3) * 2.2) * 0.8;
      this.pinky.anim.speed = 0;
    }
    if (t > 7.0 && !this._cap2) { this._cap2 = true; this.caption('He didn’t know where he was. He didn’t even know his name. But he felt that someone, somewhere, was missing.', 6.5); }
    this.pinky.anim.grounded = true;
    this.pinky.update(dt);
    if (t > 8.5 || (t > 3.2 && this.anyKey())) {
      this.state = 'play';
      this.stateT = 0;
      this.pinky.root.scale.setScalar(0.95);
      this.swirl.visible = false;
      this.tip('← → to walk · Space to jump', 4);
    }
  }

  anyKey() {
    const inp = this.input;
    return inp.pressed.size > 0 && ![...inp.pressed].every((k) => k.startsWith('Mouse'));
  }

  updatePlayer(dt) {
    const p = this.p;
    const inp = this.input;
    const L = this.level;
    let dir = 0;
    if (inp.down('ArrowLeft', 'KeyA')) dir -= 1;
    if (inp.down('ArrowRight', 'KeyD')) dir += 1;
    if (inp.padState) dir += inp.padState.lx;
    dir = Math.max(-1, Math.min(1, dir));
    const running = inp.down('ShiftLeft', 'ShiftRight') || (inp.padState && inp.padState.run);
    const jumpHeld = inp.down('Space', 'ArrowUp', 'KeyW') || (inp.padState && inp.padState.jump);
    const jumpHit = inp.hit('Space', 'ArrowUp', 'KeyW', 'Pad_jump');
    if (inp.hit('KeyR')) { this.respawn(false); return; }

    // extra explorer moves (Chapter 3): duck, crawl, slide, punch and kick
    const MV = L.moves;
    if (MV) this.updateMoves(dt, jumpHit);
    const planted = MV && p.grounded && p.attack; // she plants her feet to punch or kick

    // horizontal movement with acceleration, braking and air control
    const speed = p.duck ? MV.crawl : (running ? this.ph.run : this.ph.walk);
    const max = speed * Math.abs(dir);
    const target = planted ? 0 : dir * speed;
    const acc = p.grounded ? (Math.sign(target) !== Math.sign(p.vx) && p.vx !== 0 ? this.ph.decel : this.ph.accel) : this.ph.airAccel;
    if (p.slideT > 0) {
      // sliding: keeps going, slowly slowing down
      const f = MV.slideFriction * dt;
      p.vx = Math.abs(p.vx) <= f ? 0 : p.vx - Math.sign(p.vx) * f;
    } else if (Math.abs(dir) > 0.05 && !planted) {
      p.vx += Math.sign(target - p.vx) * Math.min(Math.abs(target - p.vx), acc * dt);
      if (!p.attack) p.facing = dir > 0 ? 1 : -1;
    } else {
      const dec = (p.grounded ? this.ph.decel : this.ph.airAccel * 0.4) * dt;
      p.vx = Math.abs(p.vx) <= dec ? 0 : p.vx - Math.sign(p.vx) * dec;
    }
    if (Math.abs(p.vx) > this.ph.run && !(p.slideT > 0)) p.vx = Math.sign(p.vx) * this.ph.run;
    void max;

    // jumping (coyote time + jump buffer + variable height)
    if (jumpHit) p.buffer = this.ph.buffer; else p.buffer -= dt;
    if (p.grounded) p.coyote = this.ph.coyote; else p.coyote -= dt;
    if (p.buffer > 0 && p.coyote > 0) {
      p.vy = -this.ph.jump - Math.abs(p.vx) * 0.12; // a running start jumps a bit higher
      p.grounded = false; p.coyote = 0; p.buffer = 0; p.standing = null;
      this.audio.jump(1);
      this.pinky.land(0.25);
    }
    // double jump: press jump again while in the air (once, until you land)
    if (p.buffer > 0 && !p.grounded && p.coyote <= 0 && !p.doubled) {
      p.vy = -this.ph.doubleJump;
      p.doubled = true; p.buffer = 0;
      p.spin = 1; // a happy twirl
      this.audio.jump(2);
      this.burst(p.x, p.y - 10, '#ffe27a', 10);
      this.pinky.land(0.3);
    }
    if (p.grounded) p.doubled = false;
    if (!jumpHeld && p.vy < -200) p.vy *= Math.pow(this.ph.jumpCut, dt * 10); // let go early = smaller hop
    p.vy = Math.min(this.ph.maxFall, p.vy + this.ph.gravity * dt * (p.vy > 0 ? 1.15 : 1));

    // ride moving platforms
    if (p.standing && p.standing.mover) {
      const m = p.standing.mover;
      p.x += m.cx - m.px;
      p.y += m.cy - m.py;
    }

    const H = this.bodyH(); // shorter while ducking or sliding
    // move & collide horizontally
    const hw = this.ph.w / 2;
    p.x += p.vx * dt;
    for (const s of this.solids()) {
      if (p.y > s.y + 0.5 && p.y - H < s.y + s.h && p.x + hw > s.x && p.x - hw < s.x + s.w) {
        // small steps (like stairs) are climbed automatically
        if (p.grounded && p.y - s.y <= this.ph.stepUp) {
          p.y = s.y;
          // put the foot properly on the step
          if (p.vx > 0) p.x = Math.max(p.x, s.x - hw + 5); else if (p.vx < 0) p.x = Math.min(p.x, s.x + s.w + hw - 5);
          continue;
        }
        if (p.vx > 0 || p.x < s.x + s.w / 2) p.x = s.x - hw; else p.x = s.x + s.w + hw;
        p.vx = 0;
      }
    }
    // the edge of the paper and the start of the world are walls
    p.x = Math.max(40, Math.min(L.paperEdge + 10, p.x));

    // move & collide vertically
    const prevY = p.y;
    p.y += p.vy * dt;
    const wasGrounded = p.grounded;
    p.grounded = false;
    p.standing = null;
    for (const s of this.solids()) {
      if (p.x + hw > s.x + 2 && p.x - hw < s.x + s.w - 2 && p.y > s.y && p.y - H < s.y + s.h) {
        if (p.vy >= 0 && prevY <= s.y + 6) { p.y = s.y; p.vy = 0; p.grounded = true; p.standing = s; }
        else if (p.vy < 0) { p.y = s.y + s.h + H; p.vy = 0; }
      }
    }
    if (p.vy >= 0) {
      for (const pl of this.platforms()) {
        if (p.x + hw > pl.x + 2 && p.x - hw < pl.x + pl.w - 2 && prevY <= pl.y + 2 + (pl.mover ? Math.abs(pl.mover.cy - pl.mover.py) + 2 : 0) && p.y >= pl.y) {
          if (pl.bouncy) {
            p.y = pl.y;
            p.vy = -(pl.bouncy.power || 1000) * (jumpHeld ? 1 : 0.85);
            this.audio.bounce();
            this.pinky.land(1);
            pl.bouncy.squish = 1;
            this.burst(p.x, p.y, '#ffffff', 10);
            continue;
          }
          p.y = pl.y; p.vy = 0; p.grounded = true; p.standing = pl;
        }
      }
    }
    // stepping onto a marshmallow cloud from the side also bounces you up
    if (p.grounded) {
      for (const b of L.bouncy) {
        if (p.x > b.x + 4 && p.x < b.x + b.w - 4 && p.y - b.y < 30 && p.y >= b.y) {
          p.y = b.y; p.vy = -(b.power || 1000) * (jumpHeld ? 1 : 0.85); p.grounded = false; p.standing = null;
          this.audio.bounce(); this.pinky.land(1); b.squish = 1; this.burst(p.x, p.y, '#ffffff', 10);
        }
      }
    }
    if (p.grounded && !wasGrounded) {
      this.pinky.land(0.5);
      this.audio.footstep(true);
    }
    // remember a safe spot to come back to after a tumble
    if (p.grounded && p.standing && !p.standing.mover && this._safeHere(p.x)) p.lastSafe = { x: p.x, y: p.y };

    // fell into the river or a gap
    for (const w of L.water) {
      if (p.x > w.x0 && p.x < w.x1 && p.y > w.y + (w.dry ? 120 : 34)) { this.fall(!w.dry); return; }
    }
    if (p.y > 900) { this.fall(false); return; }

    // hazards
    p.inv = Math.max(0, p.inv - dt);
    for (const h of L.hazards) {
      if (p.x + hw - 4 > h.x && p.x - hw + 4 < h.x + h.w && p.y > h.y + 4 && p.y - H < h.y + h.h) this.hurt(p.x < h.x + h.w / 2 ? -1 : 1);
    }
    // dust bunnies
    for (const b of this.bunnies) {
      if (b.state !== 'walk') continue;
      const bw = 40, bh = 38;
      if (p.x + hw > b.x - bw / 2 && p.x - hw < b.x + bw / 2 && p.y > b.y - bh && p.y - H < b.y) {
        if (p.vy > 0 && prevY <= b.y - bh + 12) {
          p.vy = -(jumpHeld ? this.ph.bunnyBounceHeld : this.ph.bunnyBounce);
          b.state = 'puffed'; b.t = 0;
          this.audio.stomp();
          this.burst(b.x, b.y - 20, '#d8d0e8', 18);
          this.pinky.land(0.6);
          if (!this._stompTipShown) { this._stompTipShown = true; this.tip(L.stompTip || (b.kind === 'snail' ? 'Boing! The snail giggled and slid off to nap. 🐌' : 'Achoo! The dust bunny sneezed and rolled away. 🙂'), 3); }
        } else if (p.slideT > 0 || p.attack || p.duck) this.boop(b);
        else this.hurt(p.x < b.x ? -1 : 1);
      }
    }

    // stars
    this.starObjs.forEach((s, i) => {
      if (!s) return;
      const [sx, sy] = L.stars[i];
      if (Math.abs(sx - p.x) < 26 && sy > p.y - H - 18 && sy < p.y + 14) {
        this.scene.remove(s);
        this.starObjs[i] = null;
        this.run.stars.push(i);
        this.audio.collect();
        this.burst(sx, sy, '#ffe27a', 8);
        this.updateHUD();
      }
    });
    // scraps
    this.scrapObjs.forEach((g, i) => {
      if (!g) return;
      const sc = L.scraps[i];
      if (Math.abs(sc.x - p.x) < 30 && sc.y > p.y - H - 24 && sc.y < p.y + 20) {
        this.scene.remove(g);
        this.scrapObjs[i] = null;
        this.run.scraps.push(sc.id);
        if (!this.save.scrapsEver.includes(sc.id)) this.save.scrapsEver.push(sc.id);
        this.audio.heart();
        this.burst(sc.x, sc.y, '#ffb3d9', 20);
        this.showScrap(sc.id);
        this.updateHUD();
        this.writeSave();
      }
    });
    // checkpoints
    this.checkpoints.forEach((c, i) => {
      if (!c.on && p.x > c.x - 10) {
        c.on = true;
        this.run.cp = Math.max(this.run.cp, i);
        this._lightCheckpoint(c.mesh, true);
        this.audio.hint();
        this.save.cp = { level: L.id, idx: this.run.cp, stars: [...this.run.stars], scraps: [...this.run.scraps], seen: [...this.run.seen] };
        this.writeSave();
        this.tip('★ Checkpoint ★', 1.8);
      }
    });
    // story moments
    L.thoughts.forEach((th, i) => {
      const key = 't' + i;
      if (this.run.seen.includes(key)) return;
      if (p.x > th.x && (th.y === undefined || p.y < th.y + 60)) {
        this.run.seen.push(key);
        this.thought = { icon: th.icon, t: th.time, expr: th.expr };
        this.pinky.setMood(th.expr === 'sad' ? 'sad' : 'happy');
      }
    });
    L.captions.forEach((c, i) => {
      const key = 'c' + i;
      if (this.run.seen.includes(key)) return;
      if (p.x > c.x && (c.y === undefined || p.y < c.y + 80)) { this.run.seen.push(key); this.caption(c.text, 5.5); }
    });
    // the goal
    if (p.x > L.goal.x - 20) this.beginEnding();

    // animate Pinky
    const a = this.pinky.anim;
    a.speed = Math.abs(p.vx) / 58;
    a.grounded = p.grounded;
    a.vy = -p.vy / 58;
  }

  // ---------------- explorer moves ----------------
  bodyH() {
    const p = this.p, MV = this.level.moves;
    if (!MV) return this.ph.h;
    return p.slideT > 0 ? MV.slideH : p.duck ? MV.duckH : this.ph.h;
  }

  // is there space above her to stand up (not under a low log)?
  roomToStand() {
    const p = this.p, hw = this.ph.w / 2;
    for (const s of this.solids()) if (p.x + hw > s.x && p.x - hw < s.x + s.w && p.y > s.y + 0.5 && p.y - this.ph.h < s.y + s.h) return false;
    return true;
  }

  updateMoves(dt, jumpHit) {
    const p = this.p, inp = this.input, MV = this.level.moves;
    const down = inp.down('ArrowDown', 'KeyS') || (inp.padState && inp.padState.ly > 0.6);
    const downHit = inp.hit('ArrowDown', 'KeyS');
    // slide: press down while running along the ground
    if (p.grounded && !(p.slideT > 0) && !p.attack && downHit && Math.abs(p.vx) > MV.slideMin) {
      p.slideT = MV.slideTime;
      p.vx = Math.sign(p.vx) * Math.max(Math.abs(p.vx), MV.slideSpeed);
      p.duck = false;
      this.audio.footstep?.(true);
      this.burst(p.x - p.facing * 12, p.y - 3, '#c9a26a', 8);
      if (!this._slideTip) { this._slideTip = true; this.tip('Whoosh! A slide! 💨', 1.6); }
    }
    if (p.slideT > 0) {
      p.slideT -= dt;
      if (jumpHit || !p.grounded) p.slideT = 0; // jumping ends the slide
      if (p.slideT <= 0 || Math.abs(p.vx) < 60) {
        p.slideT = 0;
        p.duck = p.grounded && (down || !this.roomToStand()); // stay low if a log is above her
      }
    } else if (p.grounded && down && !p.attack) {
      p.duck = true;
    } else if (p.duck && (!down || !p.grounded)) {
      if (!p.grounded || this.roomToStand()) p.duck = false;
    }
    // punch (Z or J) and kick (X or K)
    if (!p.attack && !(p.slideT > 0) && !p.duck) {
      if (inp.hit('KeyZ', 'KeyJ')) p.attack = { kind: 'punch', t: 0, dur: 0.34, from: 0.06, to: 0.22, reach: 56, top: 52, bot: 22, done: new Set() };
      else if (inp.hit('KeyX', 'KeyK')) p.attack = { kind: 'kick', t: 0, dur: 0.46, from: 0.13, to: 0.32, reach: 62, top: 44, bot: 4, done: new Set() };
      if (p.attack) this.audio.jump?.(0.5);
    }
    if (p.attack) {
      const a = p.attack;
      a.t += dt;
      if (a.t >= a.from && a.t <= a.to) this.strike(p.x, p.x + p.facing * a.reach, p.y - a.top, p.y - a.bot, a);
      if (a.t >= a.dur) p.attack = null;
    }
    if (p.slideT > 0) this.strike(p.x - p.facing * 8, p.x + p.facing * 34, p.y - 28, p.y, null);
  }

  // a punch, kick or slide reaching something
  strike(x0, x1, y0, y1, a) {
    const lo = Math.min(x0, x1), hi = Math.max(x0, x1);
    for (const b of this.bunnies) {
      if (b.state !== 'walk') continue;
      if (b.x + 18 > lo && b.x - 18 < hi && b.y - 26 < y1 && b.y > y0) this.boop(b);
    }
    if (!a) return;
    for (const r of this.level.breakables || []) {
      if (r.broken || a.done.has(r)) continue;
      if (r.x + r.w > lo && r.x < hi && r.y < y1 && r.y + r.h > y0) {
        a.done.add(r);
        r.broken = true;
        this.audio.stomp();
        this.burst(r.x + r.w / 2, r.y + r.h / 2, '#9a9a90', 22);
        this.burst(r.x + r.w / 2, r.y + r.h / 3, '#c8c8bc', 12);
        if (!this._rockTip) { this._rockTip = true; this.tip(a.kind === 'kick' ? 'KICK! The cracked rock crumbled! 🪨' : 'POW! The cracked rock crumbled! 🪨', 2.2); }
      }
    }
  }

  // friendly beetles just giggle and roll away
  boop(b) {
    b.state = 'puffed'; b.t = 0;
    this.audio.stomp();
    this.burst(b.x, b.y - 20, '#9fd0ff', 14);
    if (!this._boopTip) { this._boopTip = true; this.tip('Boop! The beetle giggled and rolled out of the way. 🐞', 2.6); }
  }

  // the first thing Pinky could land on below him
  surfaceBelow(x, y) {
    let best = 900;
    for (const s of this.solids()) if (x > s.x && x < s.x + s.w && s.y >= y && s.y < best) best = s.y;
    for (const p of this.platforms()) if (x > p.x && x < p.x + p.w && p.y >= y && p.y < best) best = p.y;
    return best;
  }

  _safeHere(x) {
    // not right at the edge of a gap
    for (const g of this.level.ground) if (x > g.x0 + 30 && x < g.x1 - 30) return true;
    return false;
  }

  _lightCheckpoint(mesh, fx) {
    mesh.userData.star.material = mesh.userData.star.material.clone();
    mesh.userData.star.material.color.set('#ffcf3a');
    mesh.userData.star.material.emissive = new THREE.Color('#ffb020');
    mesh.userData.star.material.emissiveIntensity = 0.8;
    if (fx) this.burst(mesh.position.x / S, 440 - mesh.position.y / S - 90, '#ffe27a', 16);
  }

  hurt(dir) {
    const p = this.p;
    if (p.inv > 0) return;
    this.run.hp -= 1;
    p.inv = 1.5;
    p.vx = dir * 280;
    p.vy = -460;
    p.grounded = false;
    this.audio.hurt();
    this.pinky.setMood('sad');
    setTimeout(() => this.pinky.setMood('happy'), 900);
    this.updateHUD();
    if (this.run.hp <= 0) setTimeout(() => this.respawn(true), 500);
  }

  fall(splash) {
    if (splash) { this.audio.splash(2); this.burst(this.p.x, this.level.water.find((w) => this.p.x > w.x0 && this.p.x < w.x1)?.y || 450, '#9fdcff', 18); }
    this.run.hp -= 1;
    this.updateHUD();
    if (this.run.hp <= 0) { this.respawn(true); return; }
    // float softly back to the last safe spot
    this.state = 'respawn';
    this.stateT = 0;
    this._respawnTo = { ...this.p.lastSafe };
    this.game.ui.fade(true);
  }

  updateRespawn(dt) {
    if (this.stateT > 0.5 && this._respawnTo) {
      const p = this.p;
      p.x = this._respawnTo.x; p.y = this._respawnTo.y - 60; p.vx = 0; p.vy = 0;
      p.inv = 1.2;
      this._respawnTo = null;
      this.game.ui.fade(false);
    }
    if (this.stateT > 0.8) this.state = 'play';
    this.pinky.update(dt);
  }

  // back to the last checkpoint (or the start) with full hearts
  respawn(outOfHearts) {
    const L = this.level;
    this.game.ui.fade(true);
    setTimeout(() => {
      const x = this.run.cp >= 0 ? L.checkpoints[this.run.cp].x : L.start.x;
      const y = this.run.cp >= 0 ? (L.checkpoints[this.run.cp].y || 440) : L.start.y;
      Object.assign(this.p, { x, y, vx: 0, vy: 0, inv: 1.2, lastSafe: { x, y }, duck: false, slideT: 0, attack: null });
      this.run.hp = 3;
      this.updateHUD();
      this.state = 'play';
      this.game.ui.fade(false);
      if (outOfHearts) this.caption(L.retryCaption || 'Pinky took a deep breath, fluffed himself up, and tried again.', 3.5);
    }, 650);
  }

  showScrap(id) {
    const c = this.revealEl.querySelector('canvas');
    const g = c.getContext('2d');
    g.clearRect(0, 0, c.width, c.height);
    if (this.level.scrapStyle === 'name') drawNamePiece(g, id, c.width, c.height, true); else if (this.level.scrapStyle === 'map') drawMapPicture(g, c.width, c.height, [id], id); else drawScrap(g, id, c.width, c.height);
    const n = this.run.scraps.length;
    const lines = this.level.scrapLines || {
      1: `A scrap of a drawing… ${SCRAP_NAMES[id]}. Pinky held it close. It felt familiar.`,
      2: `Another piece: ${SCRAP_NAMES[id]}. Who could she be?`,
      3: `The last piece: ${SCRAP_NAMES[id]}. Pinky’s heart felt warm and fluttery.`,
    };
    this.revealEl.querySelector('.sb-reveal-text').textContent = lines[n] || '';
    this.revealEl.classList.remove('hidden');
    // re-trigger the animation
    c.style.animation = 'none'; void c.offsetWidth; c.style.animation = '';
    this.thought = { icon: n >= 2 ? 'girl' : 'heart', t: 3, expr: 'wonder' };
    void lines;
    clearTimeout(this._revealT);
    this._revealT = setTimeout(() => this.revealEl.classList.add('hidden'), 3800);
  }

  beginEnding() {
    if (this.state === 'ending') return;
    this.state = 'ending';
    this.stateT = 0;
    this.audio.portal();
    this.goalHit = true;
    this.burst(this.level.goal.x, 440 - 95, '#ff6f9c', 26);
  }

  updateEnding(dt) {
    const p = this.p;
    const L = this.level;
    const t = this.stateT;
    // Pinky walks to the edge of the paper and sits, looking at the faraway window
    const E = L.ending;
    const target = E ? E.x : L.paperEdge - 40;
    if (p.x < target - 2) { p.vx = 120; p.x += p.vx * dt; p.facing = 1; } else { p.vx = 0; }
    p.y = E ? this.surfaceBelow(p.x, (E.y || 440) - 80) : 440; p.vy = 0; p.grounded = true;
    const a = this.pinky.anim;
    a.speed = Math.abs(p.vx) / 58;
    a.grounded = true;
    a.sit = t > 3.2;
    if (t > 1.5 && !this._end1) { this._end1 = true; this.caption(E ? E.first : 'At the very edge of the paper, Pinky sat down and looked at the glowing window far away.', 5.5); this.thought = { icon: E ? 'heart' : 'house', t: 4, expr: 'wonder' }; }
    if (t > 7.5 && !this._end2) { this._end2 = true; this.showFinalDrawing(); }
    if (t > 13 && !this._end3) { this._end3 = true; this.revealEl.classList.add('hidden'); this.caption(E ? E.last : 'Somewhere out there was the girl who imagined him. Pinky didn’t know her name yet… but he knew he would find her.', 6.5); this.audio.heart(); }
    if (t > 20 && !this._end4) { this._end4 = true; this.levelComplete(); }
  }

  showFinalDrawing() {
    const c = this.revealEl.querySelector('canvas');
    const g = c.getContext('2d');
    const W = c.width, H = c.height;
    g.clearRect(0, 0, W, H);
    const n = this.run.scraps.length;
    const E = this.level.ending;
    if (this.level.scrapStyle === 'map') {
      // the torn map pieces fit back together
      drawMapPicture(g, W, H, this.run.scraps);
      this.revealEl.querySelector('.sb-reveal-text').textContent = n === 3 ? E.reveal.all : E.reveal.some(n);
      this.revealEl.classList.remove('hidden');
      return;
    }
    if (this.level.scrapStyle === 'name') {
      // the torn pieces fit back into the door sign
      drawNameTag(g, W, H, this.run.scraps);
      if (this.nameSign) { drawNameTag(this.nameSign.c.getContext('2d'), 512, 256, this.run.scraps); this.nameSign.t.needsUpdate = true; }
      this.revealEl.querySelector('.sb-reveal-text').textContent = n === 3 ? E.reveal.all : E.reveal.some(n);
      this.revealEl.classList.remove('hidden');
      return;
    }
    // the scraps fit back together into one picture of a girl hugging Pinky
    drawFinalPicture(g, W, H, this.run.scraps);
    this.revealEl.querySelector('.sb-reveal-text').textContent = n === 3 ? 'All the pieces fit together: a girl with curly hair, hugging a pink pillow. Hugging HIM.' : `The pieces he found made part of a picture… (${n} of 3 scraps). Maybe there’s more to discover.`;
    this.revealEl.classList.remove('hidden');
  }

  levelComplete() {
    const L = this.level;
    const r = this.run;
    this.save.done[L.id] = true;
    const best = this.save.best[L.id] || { stars: 0, scraps: 0 };
    this.save.best[L.id] = { stars: Math.max(best.stars, r.stars.length), scraps: Math.max(best.scraps, r.scraps.length) };
    this.save.cp = null;
    this.writeSave();
    this.showPanel(`<h2>${L.title} complete!</h2>
      <div class="stat">“${L.subtitle}”</div>
      <div class="stat">⭐ Stars: ${r.stars.length} / ${L.stars.length}</div>
      <div class="stat">📜 Drawing scraps: ${r.scraps.length} / ${L.scraps.length}</div>
      ${LEVELS[LEVELS.indexOf(L) + 1] ? `<button class="big-btn" data-act="next">Next: ${LEVELS[LEVELS.indexOf(L) + 1].title} — ${LEVELS[LEVELS.indexOf(L) + 1].subtitle} ▸</button>` : `<p style="font-family:var(--kid);font-size:18px;color:#7a5a8a">${L.ending?.next || 'More chapters coming soon!'}</p>`}
      <button class="big-btn alt" data-act="again">Play this chapter again</button>
      <button class="big-btn alt" data-act="title">🏠 Main menu (progress is saved)</button>`);
  }

  showPanel(html) {
    this.panel.innerHTML = html;
    this.overlay.classList.remove('hidden');
    this.panel.querySelectorAll('[data-act]').forEach((b) => b.addEventListener('click', () => {
      this.audio.click();
      const act = b.dataset.act;
      if (act === 'resume') this.togglePause();
      if (act === 'checkpoint') { this.togglePause(); this.respawn(false); }
      if (act === 'restart') { this.overlay.classList.add('hidden'); this.paused = false; this.save.cp = null; this.writeSave(); this.restartLevel(); }
      if (act === 'again') { this.overlay.classList.add('hidden'); this.restartLevel(); }
      if (act === 'next') { this.overlay.classList.add('hidden'); this.revealEl.classList.add('hidden'); this.start(LEVELS.indexOf(this.level) + 1, false); }
      if (act === 'title') this.game.toMainMenu();
    }));
  }

  restartLevel() {
    this._cap1 = this._cap2 = this._birthBurst = this._end1 = this._end2 = this._end3 = this._end4 = false;
    this.revealEl.classList.add('hidden');
    this.start(LEVELS.indexOf(this.level), false);
  }

  togglePause() {
    if (this.state === 'ending' && this._end4) return;
    this.paused = !this.paused;
    if (this.paused) {
      this.showPanel(`<h2>Paused</h2>
        <button class="big-btn" data-act="resume">Keep playing</button>
        <button class="big-btn alt" data-act="checkpoint">Go back to the last checkpoint</button>
        <button class="big-btn alt" data-act="restart">Restart this chapter</button>
        <button class="big-btn alt" data-act="title">🏠 Main menu (progress is saved)</button>
        <p style="font-size:14px;color:#8a6a9a">← → walk · Shift run · Space jump (hold for higher) · Space again in the air = double jump${this.level.moves ? ' · ↓ duck (↓ + arrows to crawl) · ↓ while moving = slide · Z punch · X kick' : ''} · R checkpoint</p>`);
    } else this.overlay.classList.add('hidden');
  }

  // ---------------- world animation ----------------
  updateWorld(dt) {
    const L = this.level;
    for (const s of this.starObjs) if (s) animateCollectible(s, dt);
    for (const g of this.scrapObjs) if (g) { g.userData.t += dt; g.userData.paper.rotation.y = Math.sin(g.userData.t * 1.5) * 0.5; g.position.y += Math.sin(g.userData.t * 2) * 0.002; }
    for (const b of this.bunnies) {
      b.t += dt;
      if (b.state === 'walk') {
        b.x += b.dir * 45 * dt;
        if (Math.abs(b.x - b.home) > b.range) b.dir *= -1;
        b.mesh.position.set(toX(b.x), Math.abs(Math.sin(b.t * 6)) * 0.08, 0);
        b.mesh.rotation.y = b.dir * 0.6;
        b.mesh.userData.body.scale.set(1 + Math.sin(b.t * 12) * 0.04, 1 - Math.sin(b.t * 12) * 0.04, 1);
      } else {
        // sneezes, rolls into the background and sits happily there
        const k = Math.min(1, b.t / 1.4);
        b.mesh.position.set(toX(b.x) + k * 1.2, Math.sin(k * Math.PI) * 0.8, -k * 4);
        b.mesh.rotation.z = -k * 6;
        if (k >= 1) b.mesh.rotation.z = 0;
      }
    }
    for (const b of L.bouncy) {
      b.squish = Math.max(0, (b.squish || 0) - dt * 3);
      const s = Math.sin((b.squish || 0) * Math.PI) * 0.35;
      b.mesh.scale.set(1 + s * 0.3, 1 - s, 1);
    }
    if (this.goal) this.goal.userData.heart.rotation.y += dt * 1.5;
    this.checkpoints.forEach((c) => { if (c.on) c.mesh.userData.star.rotation.y += dt * 2; });
    // particles
    for (const pt of this.particles) {
      pt.t += dt;
      pt.s.position.addScaledVector(pt.v, dt);
      pt.v.y -= 4 * dt;
      pt.s.material.opacity = Math.max(0, 1 - pt.t / pt.life);
    }
    this.particles = this.particles.filter((pt) => { if (pt.t > pt.life) { this.scene.remove(pt.s); return false; } return true; });
  }

  burst(x, y, color, n = 12) {
    if (this.pix) { this.pix.burst(x, y, color, n); return; }
    const mat = new THREE.SpriteMaterial({ map: glowTexture(), color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
    for (let i = 0; i < n; i++) {
      const s = new THREE.Sprite(mat.clone());
      s.position.set(toX(x), toY(y), 0.3);
      s.scale.setScalar(0.18 + Math.random() * 0.15);
      this.scene.add(s);
      this.particles.push({ s, v: new THREE.Vector3((Math.random() - 0.5) * 3, Math.random() * 3 + 0.5, (Math.random() - 0.5) * 2), t: 0, life: 0.9 + Math.random() * 0.4 });
    }
  }

  // ---------------- drawing ----------------
  render(dt) {
    const p = this.p;
    const L = this.level;
    // Pinky's 3D body follows the game position
    const pk = this.pinky;
    pk.root.position.set(toX(p.x), toY(p.y), 0);
    if (this.state !== 'birth') {
      const targetYaw = p.facing * 0.75;
      pk.root.rotation.y += (targetYaw - pk.root.rotation.y) * Math.min(1, dt * 10);
      // the double-jump twirl
      if (p.spin > 0) { p.spin = Math.max(0, p.spin - dt * 2.6); pk.root.rotation.y = targetYaw + (1 - p.spin) * Math.PI * 2 * p.facing; }
      pk.update(dt);
    }
    // blink while invulnerable after a bump
    pk.root.visible = !(p.inv > 0 && Math.floor(this.time * 14) % 2 === 0 && this.state === 'play');

    // camera: looks a little ahead of Pinky, follows smoothly
    const look = p.facing * 90 + p.vx * 0.25;
    this.camX += (p.x + look - this.camX) * Math.min(1, dt * 2.5);
    let wantY = Math.min(p.y - 80, 360);
    let rate = p.grounded ? 3 : 1.4;
    if (!p.grounded && p.vy > 150) {
      // falling: look down toward where Pinky will land
      const land = this.surfaceBelow(p.x, p.y);
      wantY = Math.min(Math.max(p.y - 80, land - 140), 360);
      rate = 4;
    }
    this.camY += (wantY - this.camY) * Math.min(1, dt * rate);
    // never let Pinky drop out of view at the bottom or top of the screen
    this.camY = Math.max(this.camY, p.y - 105);
    this.camY = Math.min(this.camY, p.y + 60);
    if (this.pix) { this.renderPixel(dt); return; }
    let cx = toX(this.camX), cy = toY(this.camY);
    const prog = Math.min(1, Math.max(0, p.x / L.width));
    if (this.state === 'ending' && L.ending?.pan !== false) {
      // pull back to see the faraway house
      const k = Math.min(1, this.stateT / 6);
      const house = this.backdrop.userData.house.position;
      cx += (house.x * 0.25 - cx * 0.25) * k * 0.6;
      cy += 2.5 * k;
    }
    const cam = this.engine.camera;
    const dist = 8.6 + (this.state === 'ending' ? Math.min(1, this.stateT / 6) * 6 : 0);
    cam.position.set(cx, cy + 1.2, dist);
    cam.lookAt(cx, cy + 0.5, 0);

    // colors drift from moonlit night to sunrise as Pinky travels
    let top, bottom;
    const u = this.sky.userData.uniforms;
    if (L.sky) {
      top = new THREE.Color(L.sky.top[0]).lerp(new THREE.Color(L.sky.top[1]), prog);
      bottom = new THREE.Color(L.sky.bottom[0]).lerp(new THREE.Color(L.sky.bottom[1]), prog);
      u.uStars.value = L.sky.stars || 0;
    } else {
      const night = new THREE.Color('#1b2a6b'), dusk = new THREE.Color('#7a5ab8'), dawn = new THREE.Color('#ffb3a8');
      top = night.clone().lerp(dusk, Math.min(1, prog * 1.6)).lerp(new THREE.Color('#ff9ec4'), Math.max(0, prog - 0.7) / 0.3);
      bottom = new THREE.Color('#6a5aa8').lerp(new THREE.Color('#ffc9a8'), Math.min(1, prog * 1.2)).lerp(dawn, Math.max(0, prog - 0.6) / 0.4);
      u.uStars.value = Math.max(0, 1 - prog * 1.4);
    }
    u.uTop.value.copy(top);
    u.uBottom.value.copy(bottom);
    u.uTime.value = this.time;
    this.sky.position.set(cx, 0, 0);
    this.scene.fog.color.copy(bottom);
    this.hemi.color.set('#c9d6ff').lerp(new THREE.Color('#ffe0d0'), prog);
    this.hemi.intensity = (L.sky ? 1.15 : 0.9) + prog * 0.35;
    this.sun.color.set(L.sky ? '#ffe9d0' : '#b9c6ff').lerp(new THREE.Color(L.sky ? '#ffffff' : '#ffe2c0'), prog);
    this.sun.intensity = 1.4 + prog * 1.2;
    this.sun.position.set(cx - 6 + prog * 10, cy + 14, 12);
    this.sun.target.position.set(cx, cy, 0);
    this.audio.state.night = L.sky ? 0 : 0.6 - prog * 0.6;
    this.motes.position.x = 0;
    // parallax: each layer slides at its own speed
    for (const ly of this.parallax || []) {
      ly.group.position.x = cx * ly.follow;
      if (ly.drift) for (const c of ly.group.children) c.position.x += c.userData.drift * dt;
    }

    // fade the secret bush when Pinky is behind it
    const sb = L.secretBush;
    const behind = p.x > sb.x - 10 && p.x < sb.x + sb.w + 10;
    this.bushMat.opacity += ((behind ? 0.3 : 1) - this.bushMat.opacity) * Math.min(1, dt * 6);
    if (behind && !this._secretTip) { this._secretTip = true; this.tip('A secret hiding place!', 2.5); }

    // thought bubble above Pinky's head
    if (this.thought) {
      this.thought.t -= dt;
      const v = new THREE.Vector3(toX(p.x) + 0.2, toY(p.y) + 1.0, 0).project(cam);
      const sx = (v.x * 0.5 + 0.5) * window.innerWidth, sy = (-v.y * 0.5 + 0.5) * window.innerHeight;
      const tc = this.thoughtCanvas;
      tc.style.left = sx - 20 + 'px';
      tc.style.top = sy - 90 + 'px';
      const g = tc.getContext('2d');
      g.clearRect(0, 0, tc.width, tc.height);
      g.save(); g.scale(1.6, 1.6);
      drawThought(g, 6, 66, this.thought.icon, this.time, 1);
      g.restore();
      tc.style.opacity = this.thought.t > 0 ? 1 : 0;
      if (this.thought.t < -0.5) { this.thought = null; this.pinky.setMood('happy'); }
    }

    this.engine.render();
  }

  renderPixel(dt) {
    const L = this.level;
    const sb = L.secretBush;
    const p = this.p;
    const behind = p.x > sb.x - 10 && p.x < sb.x + sb.w + 10;
    this.bushMat.opacity += ((behind ? 0.35 : 1) - this.bushMat.opacity) * Math.min(1, dt * 6);
    if (behind && !this._secretTip) { this._secretTip = true; this.tip('A secret hiding place!', 2.5); }
    this.audio.state.night = 0;
    this.pix.draw(this, dt);
    if (this.thought) {
      this.thought.t -= dt;
      const [sx, sy] = this.pix.toScreen(p.x + 10, p.y - this.ph.h - 10);
      const tc = this.thoughtCanvas;
      tc.style.left = sx - 20 + 'px';
      tc.style.top = sy - 90 + 'px';
      const g = tc.getContext('2d');
      g.clearRect(0, 0, tc.width, tc.height);
      g.save(); g.scale(1.6, 1.6);
      drawThought(g, 6, 66, this.thought.icon, this.time, 1);
      g.restore();
      tc.style.opacity = this.thought.t > 0 ? 1 : 0;
      if (this.thought.t < -0.5) this.thought = null;
    }
  }

  dispose() {
    if (this.pix) this.pix.dispose();
    this.ui.remove();
  }
}

export function storybookHasSave() {
  try { const s = JSON.parse(localStorage.getItem(SAVE_KEY)); return !!(s && (s.cp || Object.keys(s.done || {}).length)); } catch (e) { return false; }
}
