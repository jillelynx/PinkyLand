// The heart of the game: title screen, loading places, switching characters,
// saving progress, and the main loop.
import * as THREE from 'three';
import { Engine } from './core/engine.js';
import { Input } from './core/input.js';
import { AudioEngine } from './core/audio.js';
import { UI } from './ui/ui.js';
import { Intro } from './scenes/intro.js';
import { HomeLevel } from './scenes/home.js';
import { BellyButton } from './world/dragons.js';
import { EarthLevel } from './scenes/earth.js';
import { PinkyLandLevel } from './scenes/pinkyland.js';
import { Kid } from './characters/kid.js';
import { Pillow } from './characters/pinky.js';
import { JACINTA, LIEV } from './characters/style.js';
import { Follower } from './characters/npc.js';
import { createCape } from './world/props.js';
import { loadModels } from './world/creatures.js';
import css from './ui/ui.css';
import { Storybook, storybookHasSave, LEVELS } from './storybook/storybook.js';

const SAVE_KEY = 'pinky-land-save-v1';
const ALL_AVATARS = ['jacintaPack', 'jacinta', 'pinky', 'liev', 'bellybutton'];

function freshState() {
  return {
    version: 1, chapter: 'earth', avatar: 'jacintaPack', collected: [], counts: {}, totals: {}, journal: ['pinky'],
    earth: null, pinky: null, time: null, lastPos: null,
  };
}

export class Game {
  constructor() {
    const style = document.createElement('style');
    style.textContent = css;
    document.head.appendChild(style);
    this.params = new URLSearchParams(location.search);
    this.settings = { music: 0.55, sfx: 0.8, ambience: 0.7, quality: 'high', sensitivity: 0.006, hideControls: false, mouseLook: false };
    this.state = freshState();
    this.load();
    if (this.params.get('quality')) this.settings.quality = this.params.get('quality');

    this.container = document.getElementById('game');
    this.engine = new Engine(this.container, this.settings.quality);
    this.canvas = this.engine.renderer.domElement;
    this.input = new Input(this.canvas);
    this.input.mouseLook = !!this.settings.mouseLook;
    this.audio = new AudioEngine();
    for (const k of ['music', 'sfx', 'ambience']) this.audio.volumes[k] = this.settings[k];
    this.ui = new UI(document.getElementById('ui'), this);
    this.level = null;
    this.mode = 'title';
    this.followerCache = new Map();
    this.clock = new THREE.Clock();
    window.__game = this; // handy for testing
    window.__shot = () => { this.engine.render(); return this.canvas.toDataURL('image/jpeg', 0.85); };
    // testing aid: point the camera straight at a character's face
    window.__look = (key, dist = 1.4, up = 0.1, side = 0) => {
      const L = this.level, m = this.avatarModels[key] || key;
      const v = new THREE.Vector3();
      (m.head || m.root).getWorldPosition(v);
      if (!m.head) v.y += 0.35 * m.root.scale.y;
      const q = new THREE.Quaternion();
      m.root.getWorldQuaternion(q);
      const fwd = new THREE.Vector3(0, 0, 1).applyQuaternion(q);
      const right = new THREE.Vector3(1, 0, 0).applyQuaternion(q);
      const pos = v.clone().addScaledVector(fwd, dist).addScaledVector(right, side);
      pos.y += up;
      L.rig.setOverride(pos, v);
      L.rig.overrideBlend = 1;
      L.rig._lastOverride = L.rig.override;
    };
  }

  async start() {
    const loading = document.createElement('div');
    loading.className = 'loading';
    loading.textContent = 'Fluffing the clouds…';
    document.body.appendChild(loading);
    this.models = await loadModels();
    this.buildAvatars();
    loading.remove();
    this.loop();
    const jump = this.params.get('scene');
    if (jump) {
      this.audio.start();
      if (jump === 'intro') return this.playIntro();
      if (jump === 'storybook') return this.startStorybook(!this.params.get('fresh'), +(this.params.get('chapter') || 1) - 1);
      if (jump === 'earth') this.state.chapter = 'earth';
      if (jump === 'pinky') { this.state.chapter = 'pinky'; if (this.params.get('arrived')) { this.state.pinky = { arrived: true, met: [], cape: !!this.params.get('cape'), tent: false }; } }
      if (this.params.get('time')) this.state.time = parseFloat(this.params.get('time'));
      if (this.params.get('avatar')) this.state.avatar = this.params.get('avatar');
      if (this.params.get('hearts')) { this.state.earth = { hearts: ['maya', 'oliver', 'bully', 'mango', 'litter'].slice(0, +this.params.get('hearts')), liev: true, bandage: false, mayaMet: true, mango: 'hurt', litter: 0 }; }
      return this.loadLevel(this.state.chapter);
    }
    this.showTitle();
  }

  buildAvatars() {
    const jac = new Kid(JACINTA, { kind: 'jacinta' });
    const liev = new Kid(LIEV, { kind: 'liev' });
    const pinky = new Pillow({ scale: 1, name: 'Pinky' });
    // mini Pinky peeking out of Jacinta's backpack
    const mini = new Pillow({ scale: 0.3, name: 'Pinky (backpack)' });
    mini.root.rotation.set(-0.15, Math.PI, 0.25); // face out behind her, peeking over a shoulder
    mini.root.position.set(0.04, -0.02, 0.0);
    jac.backpackSlot.add(mini.root);
    jac.miniPinky = mini;
    const origUpdate = jac.update.bind(jac);
    jac.update = (dt) => { origUpdate(dt); if (jac.backpack.visible) mini.update(dt); };
    // capes (hidden until found)
    const addCape = (model, parent, pos, scale = 1) => {
      const cape = createCape(JACINTA.cape, scale);
      cape.position.copy(pos);
      cape.visible = false;
      parent.add(cape);
      model.cape = cape;
    };
    addCape(jac, jac.spine, new THREE.Vector3(0, jac.dims.torsoLen - 0.02, -0.14), 0.95);
    addCape(liev, liev.spine, new THREE.Vector3(0, liev.dims.torsoLen - 0.02, -0.14), 1.0);
    addCape(pinky, pinky.body, new THREE.Vector3(0, 0.84, -0.16), 1.0);
    // Belly Button the plush bear (playable in Pinky Land)
    const bb = new BellyButton({ scale: 1.05 });
    addCape(bb, bb.pose, new THREE.Vector3(0, 0.95, -0.27), 0.9);
    this.avatarModels = { jacinta: jac, jacintaPack: jac, liev, pinky, bellybutton: bb };
  }

  // ---------------- Title ----------------
  showTitle() {
    this.mode = 'title';
    const hasSave = !!this.savedRaw;
    const t = document.createElement('div');
    t.className = 'title-screen';
    t.innerHTML = `
      <div class="clouds">${Array.from({ length: 7 }, (_, i) => `<span style="top:${8 + i * 12}%;width:${120 + (i % 3) * 60}px;height:${40 + (i % 2) * 20}px;animation-duration:${40 + i * 9}s;animation-delay:-${i * 7}s"></span>`).join('')}</div>
      <div class="title-card">
        <div class="title-pinky"><i></i></div>
        <h1 class="title-logo">Pinky Land</h1>
        <div class="title-sub">A cozy adventure with Jacinta, Pinky &amp; Liev</div>
        <div class="mode-row">
          <div class="mode-card">
            <h3>🌸 Pinky Land</h3>
            <p>A cozy 3D adventure with Jacinta, Pinky &amp; Liev</p>
            ${hasSave ? '<button class="big-btn" data-go="continue">Continue</button>' : ''}
            <button class="big-btn ${hasSave ? 'alt' : ''}" data-go="new">${hasSave ? 'Start Over' : 'Start the Adventure'}</button>
          </div>
          <div class="mode-card">
            <h3>📖 Pinky’s Storybook</h3>
            <p>A 2.5D platformer: help Pinky find the girl who imagined him</p>
            ${storybookHasSave() ? '<button class="big-btn" data-go="sb-continue">Continue</button>' : ''}
            <button class="big-btn ${storybookHasSave() ? 'alt' : ''}" data-go="sb-new">${storybookHasSave() ? 'Start Chapter 1 Again' : 'Open the Storybook'}</button>
            <button class="big-btn alt" data-go="sb-ch2">Chapter 2: The Big House ✨</button>
          </div>
        </div>
        <div class="title-note">Best with headphones 🎧 · Use the mouse and keyboard (or a game controller)</div>
        <button class="grownup-link" data-grownup>🔑 Grown-ups</button>
        <div class="version-note">Version: ${typeof __BUILD__ !== 'undefined' ? __BUILD__ : 'dev'}</div>
      </div>`;
    document.body.appendChild(t);
    t.querySelector('[data-grownup]').addEventListener('click', () => { this.audio.start(); this.audio.click(); this.openGrownUp(t); });
    t.querySelectorAll('[data-go]').forEach((b) => b.addEventListener('click', () => {
      this.audio.start();
      this.audio.click();
      t.remove();
      if (b.dataset.go === 'sb-ch2') { this.startStorybook(false, 1); return; }
      if (b.dataset.go.startsWith('sb-')) { this.startStorybook(b.dataset.go === 'sb-continue'); return; }
      if (b.dataset.go === 'new') {
        this.state = freshState();
        this.clearSave();
        this.playIntro();
      } else this.loadLevel(this.state.chapter);
    }));
  }

  // ---------------- Grown-ups menu: jump to any part of the game ----------------
  // A simple password keeps little players out. (It's a kid lock, not real security.)
  grownUpPassword() {
    try { return localStorage.getItem('pinky-land-grownup-pw') || 'pinky79'; } catch (e) { return 'pinky79'; }
  }

  openGrownUp(titleEl) {
    const o = document.createElement('div');
    o.className = 'grownup-overlay';
    o.innerHTML = `<div class="grownup-panel">
      <h2>🔑 Grown-ups only</h2>
      <p>Type the password to jump to any part of the game.</p>
      <input type="password" class="gu-pw" placeholder="Password" autocomplete="off">
      <div class="gu-msg"></div>
      <div class="gu-row"><button class="big-btn gu-ok">Open</button><button class="big-btn alt gu-cancel">Cancel</button></div>
    </div>`;
    document.body.appendChild(o);
    const pw = o.querySelector('.gu-pw');
    setTimeout(() => pw.focus(), 50);
    const tryOpen = () => {
      if (pw.value.trim().toLowerCase() === this.grownUpPassword().toLowerCase()) { o.remove(); this.showGrownUpMenu(titleEl); }
      else { o.querySelector('.gu-msg').textContent = 'That’s not it. Try again.'; pw.value = ''; pw.focus(); }
    };
    pw.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter') tryOpen(); if (e.key === 'Escape') o.remove(); });
    o.querySelector('.gu-ok').addEventListener('click', tryOpen);
    o.querySelector('.gu-cancel').addEventListener('click', () => o.remove());
  }

  showGrownUpMenu(titleEl) {
    const o = document.createElement('div');
    o.className = 'grownup-overlay';
    const jumps = [
      ['earth-start', '🏘️ Earth — start of Chapter 1'],
      ['earth-hearts', '💗 Earth — all 5 kindness hearts done (magic door open)'],
      ['home', '🏠 Inside Jacinta’s house'],
      ['pinky', '🌸 Pinky Land — just arrived'],
      ['pinky-bb', '🧸 Pinky Land — playing as Belly Button'],
      ['pinky-cape', '🦸 Pinky Land — with the Sky Cape'],
      ['pinky-night', '🌙 Pinky Land — at night (campfire time)'],
      ['sb-1', '📖 Storybook — Chapter 1'],
      ['sb-2', '📖 Storybook — Chapter 2: The Big House'],
    ];
    o.innerHTML = `<div class="grownup-panel wide">
      <h2>🔑 Grown-ups menu</h2>
      <label class="gu-test"><input type="checkbox" class="gu-testmode" checked> <b>Test mode</b> — don’t change the saved game (recommended, so your child’s progress stays safe)</label>
      <div class="gu-grid">${jumps.map(([k, label]) => `<button class="big-btn alt" data-jump="${k}">${label}</button>`).join('')}</div>
      <details class="gu-pwchange"><summary>Change the password</summary>
        <input type="text" class="gu-newpw" placeholder="New password" autocomplete="off"> <button class="big-btn alt gu-savepw" style="min-width:0">Save</button> <span class="gu-pwmsg"></span>
      </details>
      <button class="big-btn gu-close">Close</button>
    </div>`;
    document.body.appendChild(o);
    o.querySelectorAll('input').forEach((i) => i.addEventListener('keydown', (e) => e.stopPropagation()));
    o.querySelector('.gu-close').addEventListener('click', () => o.remove());
    o.querySelector('.gu-savepw').addEventListener('click', () => {
      const v = o.querySelector('.gu-newpw').value.trim();
      if (v.length < 3) { o.querySelector('.gu-pwmsg').textContent = 'Use at least 3 letters.'; return; }
      try { localStorage.setItem('pinky-land-grownup-pw', v); } catch (e) { /* ignore */ }
      o.querySelector('.gu-pwmsg').textContent = '✓ Saved';
    });
    o.querySelectorAll('[data-jump]').forEach((b) => b.addEventListener('click', () => {
      this.audio.click();
      const test = o.querySelector('.gu-testmode').checked;
      o.remove();
      titleEl?.remove();
      this.adminJump(b.dataset.jump, test);
    }));
  }

  adminJump(where, test = true) {
    this.testMode = test;
    if (test) this.showTestBadge();
    if (where === 'sb-1' || where === 'sb-2') { this.startStorybook(false, where === 'sb-1' ? 0 : 1); return; }
    // start from a copy of the current game so nothing real is changed in test mode
    const st = test ? JSON.parse(JSON.stringify(this.state)) : this.state;
    this.state = st;
    const allHearts = { hearts: ['maya', 'oliver', 'bully', 'mango', 'litter'], liev: true, bandage: false, mayaMet: true, mango: 'home', litter: 8, bullyDone: true };
    if (where === 'earth-start') { Object.assign(st, freshState()); this.state = st; return this.loadLevel('earth'); }
    if (where === 'earth-hearts') { st.earth = allHearts; st.avatar = 'jacintaPack'; st.time = 0.4; return this.loadLevel('earth'); }
    if (where === 'home') { st.earth = st.earth || { hearts: [], liev: true, bandage: false, mayaMet: false, mango: 'hurt', litter: 0, bullyDone: false }; st.avatar = 'jacintaPack'; return this.loadLevel('home'); }
    // Pinky Land
    st.earth = st.earth && st.earth.hearts?.length >= 5 ? st.earth : allHearts;
    st.pinky = { arrived: true, met: (st.pinky && st.pinky.met) || [], cape: where === 'pinky-cape' || !!(st.pinky && st.pinky.cape), tent: !!(st.pinky && st.pinky.tent) };
    st.avatar = where === 'pinky-bb' ? 'bellybutton' : 'jacinta';
    this.forceTime = where === 'pinky-night' ? 0.86 : 0.33;
    st.time = this.forceTime;
    return this.loadLevel('pinky');
  }

  showTestBadge() {
    if (document.querySelector('.test-badge')) return;
    const b = document.createElement('div');
    b.className = 'test-badge';
    b.textContent = '🧪 Test mode — not saving';
    document.body.appendChild(b);
  }

  // ---------------- Pinky's Storybook (2.5D platformer) ----------------
  startStorybook(resume = true, chapter = 0) {
    this.mode = 'storybook';
    this.ui.showHUD(false);
    this.storybook = new Storybook(this);
    // continue where you left off (the chapter of your last checkpoint)
    const sv = this.storybook.save;
    let idx = chapter;
    if (resume && sv.cp) idx = Math.max(0, LEVELS.findIndex((l) => l.id === sv.cp.level));
    else if (resume && sv.done && sv.done[1] && !sv.done[2]) idx = 1;
    this.storybook.start(idx, resume);
  }

  playIntro() {
    this.mode = 'intro';
    this.audio.state.scene = 'intro';
    const intro = new Intro(document.body, this.audio);
    this.intro = intro;
    intro.onFinish = () => {
      this.intro = null;
      this.loadLevel('earth').then(() => {
        this.ui.chapter('Chapter 1', 'Spreading Pinky Love', 4);
        setTimeout(() => this.level.openingLines?.(), 300);
        setTimeout(() => this.ui.say('Psst! Jacinta, it’s me, Pinky! The door to Pinky Land opens when we spread kindness. Let’s find 5 ways to help! (Press H for a hint any time.)', 9), 4500);
      });
    };
  }

  // ---------------- Levels ----------------
  async loadLevel(name) {
    this.ui.fade(true);
    await new Promise((r) => setTimeout(r, this.level ? 1200 : 50));
    if (this.level) {
      this.state.time = this.level.dayNight.time;
      if (this.forceTime !== undefined) { this.state.time = this.forceTime; this.forceTime = undefined; }
      this.level.dispose();
      for (const f of this.followerCache.values()) f.root.parent?.remove(f.root);
      this.followerCache.clear();
    }
    this.state.chapter = name;
    const level = name === 'pinky' ? new PinkyLandLevel(this) : name === 'home' ? new HomeLevel(this) : new EarthLevel(this);
    await level.build();
    this.level = level;
    this.engine.setScene(level.scene);
    if (!level.availableAvatars().includes(this.state.avatar)) this.state.avatar = name === 'pinky' ? 'jacinta' : 'jacintaPack';
    this.applyParty(true);
    this.mode = name;
    this.ui.showHUD(true);
    this.ui.setMode(name);
    this.ui.setHearts(this.state.earth?.hearts?.length || 0);
    this.ui.showControls(!this.settings.hideControls);
    // compile shaders before showing
    this.engine.renderer.compile(level.scene, this.engine.camera);
    level.rig.snap(level.player.pos.clone().add(new THREE.Vector3(0, 1, 0)));
    this.ui.fade(false);
    this.saveGame();
    if (name === 'pinky') level.arrive();
  }

  // Jacinta's house: go in through the front door, come back out onto the walk
  async enterHome() {
    if (this.level?.mangoState === 'carried') { this.ui.say('Let’s take Mango home to Mrs. Rosa first!', 4); return; }
    this.audio.page?.();
    await this.loadLevel('home');
  }

  async leaveHome() {
    this.audio.page?.();
    await this.loadLevel('earth');
  }

  async goToPinkyLand() {
    this.audio.portal();
    this.ui.say('Hold on tight, Jacinta! Here we gooo!', 3);
    this.state.avatar = 'jacinta';
    this.forceTime = 0.33; // Pinky Land always starts on a bright morning
    await this.loadLevel('pinky');
  }

  // Who is the player, and who follows along?
  applyParty(initial = false) {
    const L = this.level;
    if (!L) return;
    const M = this.avatarModels;
    const key = this.state.avatar;
    const earth = L.name === 'earth' || L.name === 'home';
    const lievJoined = !earth || this.state.earth?.liev;
    const prevPos = L.player.pos.clone();
    L.player.setAvatar(key);
    M.jacinta.backpack.visible = key === 'jacintaPack' || (earth && key === 'liev');
    let followers = [];
    if (earth) {
      if (key === 'liev') followers = ['jacinta'];
      else if (lievJoined) followers = ['liev'];
    } else {
      followers = { jacintaPack: ['liev'], jacinta: ['pinky', 'liev'], pinky: ['jacinta', 'liev'], liev: ['jacinta', 'pinky'], bellybutton: ['jacinta', 'pinky'] }[key];
    }
    // detach the old followers
    L.followers = [];
    for (const [k, f] of this.followerCache) if (!followers.includes(k)) { if (f.root.parent === L.scene) L.scene.remove(f.root); }
    followers.forEach((k, i) => {
      let f = this.followerCache.get(k);
      const model = M[k];
      if (!f) { f = new Follower(model, L.world, { gap: 1.6 + i * 0.9, side: i % 2 ? -1 : 1, name: k }); this.followerCache.set(k, f); }
      f.gap = 1.6 + i * 0.9; f.side = i % 2 ? -1 : 1;
      model.root.rotation.set(0, 0, 0);
      model.anim.sit = false;
      if (model.root.parent !== L.scene) {
        L.scene.add(model.root);
        const a = L.player.yaw + Math.PI + (i ? 0.6 : -0.6);
        f.place(prevPos.x + Math.sin(a) * 1.6, prevPos.z + Math.cos(a) * 1.6);
      }
      L.followers.push(f);
    });
    this.ui.setAvatars(L.availableAvatars().filter((k) => k !== 'liev' || lievJoined), key);
  }

  switchAvatar(key) {
    const L = this.level;
    if (!L || this.ui.dialogueActive || L.cutscene || L.sitting) return;
    const avail = L.availableAvatars();
    const lievJoined = (L.name !== 'earth' && L.name !== 'home') || this.state.earth?.liev;
    if (!avail.includes(key) || (key === 'liev' && !lievJoined)) {
      if (key === 'pinky' && L.name !== 'pinky') this.ui.say('On Earth I’m just a regular pillow… but in Pinky Land I can walk on my own!', 5);
      else if (key === 'jacinta' && L.name !== 'pinky') this.ui.say('I’d rather stay in your backpack here on Earth. Hugs!', 4);
      else if (key === 'liev') this.ui.say('Let’s find Liev first! He’s by the park entrance.', 4);
      return;
    }
    if (L.mangoState === 'carried') { this.ui.say('Careful! We’re carrying Mango. Let’s bring him home first.', 4); return; }
    if (key === this.state.avatar) return;
    // the model you were becomes a follower standing where you are
    const old = this.avatarModels[this.state.avatar];
    const pos = L.player.pos.clone();
    this.state.avatar = key;
    L.player.root.remove(old.root);
    this.applyParty();
    // Belly Button stays right where you left him (as himself, not a follower)
    if (old === this.avatarModels.bellybutton && L.bellyButton) {
      const nx = pos.x - Math.sin(L.player.yaw) * 1.3, nz = pos.z - Math.cos(L.player.yaw) * 1.3;
      L.bellyButton.root.position.set(nx, L.world.groundHeight(nx, nz), nz);
      L.bellyButton.wander = { x: nx, z: nz, r: 2.5 };
    }
    if (key === 'bellybutton' && L.bellyButton) {
      // you become him: start from where he was standing, if he's close by
      L.journalCheck?.('bellybutton', 'Belly Button');
      L.meet?.('bellybutton');
      this.ui.say('Squish! You’re Belly Button now. Big drops make him belly-bounce, and he floats on his back in the water!', 5);
    }
    // put the previous character right beside you
    const f = this.followerCache.get(Object.entries(this.avatarModels).find(([k, m]) => m === old && this.followerCache.has(k))?.[0]);
    if (f) { L.scene.add(old.root); f.place(pos.x - Math.sin(L.player.yaw) * 1.2, pos.z - Math.cos(L.player.yaw) * 1.2); }
    L.spawnBurst(pos.clone().add(new THREE.Vector3(0, 0.8, 0)), '#ffb3d9');
    this.audio.collect();
    this.saveGame();
  }

  cycleAvatar() {
    const L = this.level;
    const lievJoined = (L.name !== 'earth' && L.name !== 'home') || this.state.earth?.liev;
    const avail = L.availableAvatars().filter((k) => k !== 'liev' || lievJoined);
    if (avail.length < 2) { this.switchAvatar('liev'); return; }
    const i = avail.indexOf(this.state.avatar);
    this.switchAvatar(avail[(i + 1) % avail.length]);
  }

  journalSeen(key, name) { this.level?.journalCheck(key, name); }

  // ---------------- UI actions ----------------
  uiAction(act) {
    const L = this.level;
    if (!L) return;
    if (this.ui.open === act || (act === 'chars' && this.ui.open === 'chars')) return this.ui.close();
    if (this.ui.dialogueActive) return;
    if (act === 'hint') return this.showHint();
    if (act === 'journal') return this.ui.openJournal(this.state);
    if (act === 'map') return this.ui.openMap((c) => L.drawMap(c), L.name === 'home' ? '🛋️ Living room · 🍳 Kitchen · 🛏️ Jacinta’s room · 🛁 Bathroom · 🚪 Front door' : L.name === 'earth' ? '🏠 Houses · 🛝 Playground · 🌀 Magic door · ⛑️ Park helper · 🗑️ Trash bin' : '🌀 Dream Door · 🔥 Camp · 💧 Pond · 🌈 Falls · ☁️ Cloud steps · 🪸 Reef · 🩷 Pinky friends');
    if (act === 'chars') {
      const lievJoined = (L.name !== 'earth' && L.name !== 'home') || this.state.earth?.liev;
      return this.ui.openCharacters(L.availableAvatars().filter((k) => k !== 'liev' || lievJoined), this.state.avatar, ALL_AVATARS);
    }
    if (act === 'settings') return this.ui.openSettings(this.settings);
    if (act === 'flashlight') return this.toggleFlashlight();
  }

  showHint() {
    const L = this.level;
    const h = L.getHint();
    this.audio.hint();
    if (!h) { this.ui.say('Let’s just explore and have fun!', 4); return; }
    this.ui.say(h.text, 7);
    if (h.target) L.showTrail(h.target);
  }

  toggleFlashlight() {
    const f = this.level?.flashlight;
    const on = f ? !f.on : true;
    this.flashlightMode = on ? 'on' : 'off';
    this.ui.toast('🔦', on ? 'Flashlight on' : 'Flashlight off');
  }

  setMouseLook(on) {
    this.settings.mouseLook = on;
    this.input.mouseLook = on;
    if (!on && document.pointerLockElement) document.exitPointerLock?.();
    this.saveGame();
  }

  setVolume(kind, v) { this.settings[kind] = v; this.audio.setVolume(kind, v); this.saveGame(); }
  setQuality(q) { this.settings.quality = q; this.engine.setQuality(q); this.saveGame(); }
  setSensitivity(s) { this.settings.sensitivity = s; if (this.level) this.level.rig.sensitivity = s; this.saveGame(); }

  // ---------------- Saving ----------------
  load() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return;
      const data = JSON.parse(raw);
      if (data.settings) Object.assign(this.settings, data.settings);
      if (this.settings.sensitivity <= 0.0045) this.settings.sensitivity = 0.006; // faster default turning
      if (data.state && data.state.version === 1) { this.state = Object.assign(freshState(), data.state); this.savedRaw = raw; }
    } catch (e) { /* storage unavailable — play without saving */ }
  }

  saveGame() {
    if (this.level) this.state.time = this.level.dayNight.time;
    if (this.testMode) return; // grown-up test mode never touches the real saved game
    try { localStorage.setItem(SAVE_KEY, JSON.stringify({ state: this.state, settings: this.settings })); } catch (e) { /* ignore */ }
  }

  clearSave() {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify({ settings: this.settings })); } catch (e) { /* ignore */ }
    this.savedRaw = null;
  }

  // Fast-forward to a sunny morning
  async skipToMorning() {
    const L = this.level;
    if (!L) return;
    this.ui.close();
    this.ui.fade(true);
    await new Promise((r) => setTimeout(r, 1300));
    L.dayNight.setTime(0.27);
    this.ui.fade(false);
    this.ui.toast('🌅', 'Good morning!');
    this.saveGame();
  }

  // Save everything and go back to the title screen (to pick the other game, for example)
  toMainMenu() {
    if (this.storybook) this.storybook.saveProgress();
    else this.saveGame();
    // reload the page without any test settings so the title screen appears
    location.href = location.pathname;
  }

  newGame() {
    this.clearSave();
    location.reload();
  }

  onPanelClosed() {}

  // ---------------- Main loop ----------------
  handleKeys() {
    const inp = this.input;
    const busy = this.ui.dialogueActive;
    if (inp.pressed.has('Escape') || inp.pressed.has('Pad_pause')) {
      if (this.ui.open) this.ui.close(); else if (!busy) this.uiAction('settings');
    }
    if (busy) return;
    const hit = (...c) => c.some((k) => inp.pressed.has(k));
    if (hit('KeyH', 'Pad_hint')) { if (!this.ui.open) this.uiAction('hint'); }
    if (hit('KeyF') && !this.ui.open) this.toggleFlashlight();
    if (hit('KeyJ', 'Pad_journal')) this.uiAction('journal');
    if (hit('KeyM', 'Pad_map')) this.uiAction('map');
    if (this.ui.open) return;
    if (hit('Tab', 'Pad_switch')) this.cycleAvatar();
    const lievJoined = (this.level.name !== 'earth' && this.level.name !== 'home') || this.state.earth?.liev;
    const avail = this.level.availableAvatars().filter((k) => k !== 'liev' || lievJoined);
    ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5'].forEach((d, i) => { if (hit(d) && avail[i]) this.switchAvatar(avail[i]); });
  }

  loop() {
    const slow = this.params.get('slow'); // testing aid: render a few frames per second
    const tick = () => {
      if (slow) setTimeout(tick, +slow); else requestAnimationFrame(tick);
      const dt = slow ? 1 / 30 : Math.min(0.05, this.clock.getDelta());
      this.input.poll();
      if (this.intro) this.intro.update(dt);
      if (this.storybook && this.mode === 'storybook') this.storybook.update(dt);
      if (this.level && (this.mode === 'earth' || this.mode === 'pinky' || this.mode === 'home')) {
        this.handleKeys();
        this.level.update(dt);
        if (!this.params.get('norender')) this.engine.render();
        this._saveT = (this._saveT || 0) + dt;
        if (this._saveT > 10) { this._saveT = 0; this.saveGame(); }
      }
      this.audio.updateAmbience(dt);
      this.ui.update(dt);
      this.input.endFrame();
    };
    tick();
  }
}
