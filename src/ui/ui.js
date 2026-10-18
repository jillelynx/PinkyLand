// On-screen interface: hearts, buttons, talking, journal, map, settings.
import { JOURNAL, JOURNAL_TABS } from './journalData.js';

const AVATAR_INFO = {
  jacintaPack: { face: '🎒', name: 'Jacinta + Pinky', desc: 'Pinky rides in Jacinta’s backpack and cheers her on.' },
  jacinta: { face: '👧', name: 'Jacinta', desc: 'Curly hair, bear-ear hoodie, kind heart. Great at climbing and talking with friends.' },
  pinky: { face: '🩷', name: 'Pinky', desc: 'Bouncy and floaty! Pinky jumps higher and falls slower.' },
  liev: { face: '⚡', name: 'Liev', desc: 'Fastest runner and highest jumper. Lightning bolt hair!' },
};

export class UI {
  constructor(root, game) {
    this.root = root;
    this.game = game;
    this.open = null;
    this.dialogueActive = false;
    root.innerHTML = `
      <div class="hud hidden">
        <div class="hud-top-left">
          <div class="pill hearts-pill"><span>Kindness</span><div class="hearts"></div></div>
          <div class="pill counter-pill hidden"><span class="counter"></span></div>
        </div>
        <div class="hud-top-right">
          <div class="clock" title="Time of day">☀️</div>
          <button class="icon-btn flashlight" data-act="flashlight" title="Flashlight (F)">🔦<small>F</small></button>
          <button class="icon-btn hint" data-act="hint" title="Hint (H)">💡<small>H</small></button>
          <button class="icon-btn" data-act="journal" title="Journal (J)">📖<small>J</small></button>
          <button class="icon-btn" data-act="map" title="Map (M)">🗺️<small>M</small></button>
          <button class="icon-btn" data-act="chars" title="Characters (Tab)">👥<small>Tab</small></button>
          <button class="icon-btn" data-act="settings" title="Settings (Esc)">⚙️<small>Esc</small></button>
        </div>
        <div class="compass" title="Compass">
          <svg viewBox="-60 -60 120 120" class="rose">
            <circle r="56" class="rim"/>
            <circle r="44" class="inner"/>
            <g class="dial">
              <g class="ticks"></g>
              <polygon points="0,-40 6,-6 0,0 -6,-6" class="pt-n"/>
              <polygon points="0,40 6,6 0,0 -6,6" class="pt"/>
              <polygon points="40,0 6,6 0,0 6,-6" class="pt"/>
              <polygon points="-40,0 -6,6 0,0 -6,-6" class="pt"/>
              <polygon points="0,-40 -6,-6 0,0" class="pt-n2"/>
              <polygon points="0,40 -6,6 0,0" class="pt2"/>
              <polygon points="40,0 6,-6 0,0" class="pt2"/>
              <polygon points="-40,0 -6,6 0,0" class="pt2"/>
              <polygon points="20,-20 4,-1 0,0 1,-4" class="pt-s"/>
              <polygon points="20,20 4,1 0,0 1,4" class="pt-s"/>
              <polygon points="-20,20 -4,1 0,0 -1,4" class="pt-s"/>
              <polygon points="-20,-20 -4,-1 0,0 -1,-4" class="pt-s"/>
              <text x="0" y="-46" class="lbl n">N</text>
              <text x="46" y="0" class="lbl">E</text>
              <text x="0" y="46" class="lbl">S</text>
              <text x="-46" y="0" class="lbl">W</text>
            </g>
            <circle r="3" class="hub"/>
            <polygon points="0,-60 -6,-50 6,-50" class="facing"/>
          </svg>
          <span class="csky"></span>
          <span class="chint">✨</span>
        </div>
        <div class="prompt hidden"></div>
        <div class="toasts"></div>
        <div class="avatar-chip"></div>
        <div class="controls-mini hidden"></div>
        <div class="pinky-bubble"><div class="face"><i></i></div><div class="text"></div></div>
      </div>
      <div class="dialogue hidden"><div class="name"></div><div class="text"></div><div class="choices"></div><div class="next">▸ Space / E / click</div></div>
      <div class="overlay hidden"><div class="panel"></div></div>
      <div class="fade"></div>
      <div class="chapter-card"><div></div></div>`;
    this.hud = root.querySelector('.hud');
    this.heartsEl = root.querySelector('.hearts');
    this.heartsPill = root.querySelector('.hearts-pill');
    this.counterPill = root.querySelector('.counter-pill');
    this.counterEl = root.querySelector('.counter');
    this.clockEl = root.querySelector('.clock');
    this.promptEl = root.querySelector('.prompt');
    this.toastsEl = root.querySelector('.toasts');
    this.bubble = root.querySelector('.pinky-bubble');
    this.bubbleText = this.bubble.querySelector('.text');
    this.avatarEl = root.querySelector('.avatar-chip');
    this.controlsEl = root.querySelector('.controls-mini');
    this.dlg = root.querySelector('.dialogue');
    this.overlay = root.querySelector('.overlay');
    this.panel = root.querySelector('.panel');
    this.fadeEl = root.querySelector('.fade');
    this.chapterEl = root.querySelector('.chapter-card');
    this.flashBtn = root.querySelector('.icon-btn.flashlight');
    // compass rose: the dial turns so its N always points to real north
    this.compassDial = root.querySelector('.compass .dial');
    this.compassSky = root.querySelector('.compass .csky');
    this.compassHint = root.querySelector('.compass .chint');
    this.compassLabels = [...root.querySelectorAll('.compass .lbl')];
    const ticks = root.querySelector('.compass .ticks');
    for (let b = 0; b < 360; b += 15) {
      const a = (b * Math.PI) / 180, r1 = b % 45 === 0 ? 50 : 52;
      const l = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      l.setAttribute('x1', Math.sin(a) * r1); l.setAttribute('y1', -Math.cos(a) * r1);
      l.setAttribute('x2', Math.sin(a) * 55); l.setAttribute('y2', -Math.cos(a) * 55);
      l.setAttribute('class', 'tick');
      ticks.appendChild(l);
    }
    for (let i = 0; i < 5; i++) this.heartsEl.appendChild(Object.assign(document.createElement('div'), { className: 'heart' }));
    root.querySelectorAll('[data-act]').forEach((b) => b.addEventListener('click', (e) => {
      e.stopPropagation();
      game.audio.click();
      game.uiAction(b.dataset.act);
    }));
    this.overlay.addEventListener('pointerdown', (e) => { if (e.target === this.overlay) this.close(); });
    this.bubbleTimer = 0;
  }

  showHUD(on) { this.hud.classList.toggle('hidden', !on); }

  setMode(mode) {
    this.heartsPill.classList.toggle('hidden', mode !== 'earth');
    this.counterPill.classList.toggle('hidden', mode !== 'pinky');
  }

  setHearts(n, pop = -1) {
    [...this.heartsEl.children].forEach((h, i) => {
      h.classList.toggle('on', i < n);
      if (i === pop) { h.classList.remove('pop'); void h.offsetWidth; h.classList.add('pop'); }
    });
  }

  setCounter(html) { this.counterEl.innerHTML = html; }

  setClock(night, hours) {
    const icon = night > 0.55 ? '🌙' : hours < 7.5 ? '🌅' : hours > 17 ? '🌇' : '☀️';
    if (this.clockEl.textContent !== icon) this.clockEl.textContent = icon;
  }

  // heading: which way the camera faces, in degrees clockwise from north
  setCompass(heading, skyBearing, skyIcon, hintBearing = null) {
    if (hintBearing !== null) {
      const rel = ((hintBearing - heading) * Math.PI) / 180;
      this.compassHint.style.left = 50 + Math.sin(rel) * 30 + '%';
      this.compassHint.style.top = 50 - Math.cos(rel) * 30 + '%';
      this.compassHint.style.opacity = 1;
    } else this.compassHint.style.opacity = 0;
    this.compassDial.setAttribute('transform', `rotate(${-heading})`);
    // keep the letters upright while the dial turns
    for (const t of this.compassLabels) t.setAttribute('transform', `rotate(${heading} ${t.getAttribute('x')} ${t.getAttribute('y')})`);
    if (skyIcon) {
      const rel = ((skyBearing - heading) * Math.PI) / 180;
      const R = 47; // percent of the compass size from the center
      this.compassSky.style.left = 50 + Math.sin(rel) * R + '%';
      this.compassSky.style.top = 50 - Math.cos(rel) * R + '%';
      if (this.compassSky.textContent !== skyIcon) this.compassSky.textContent = skyIcon;
      this.compassSky.style.opacity = 1;
    } else this.compassSky.style.opacity = 0;
  }

  setFlashlight(on) { this.flashBtn.classList.toggle('on', !!on); }

  setAvatars(list, current) {
    const key = list.join(',') + '|' + current;
    if (this._avKey === key) return;
    this._avKey = key;
    this.avatarEl.innerHTML = '';
    list.forEach((k, i) => {
      const b = document.createElement('button');
      b.className = k === current ? 'active' : '';
      b.innerHTML = `<span class="face">${AVATAR_INFO[k].face}</span>${AVATAR_INFO[k].name.replace(' + Pinky', '+🩷')}<kbd>${i + 1}</kbd>`;
      b.addEventListener('click', (e) => { e.stopPropagation(); this.game.switchAvatar(k); });
      this.avatarEl.appendChild(b);
    });
    this.avatarEl.classList.toggle('hidden', list.length < 2);
  }

  prompt(text) {
    if (!text) { this.promptEl.classList.add('hidden'); this._prompt = null; return; }
    if (this._prompt === text) return;
    this._prompt = text;
    this.promptEl.innerHTML = `<span class="key">E</span>${text}`;
    this.promptEl.classList.remove('hidden');
  }

  toast(icon, text) {
    const t = document.createElement('div');
    t.className = 'toast';
    t.innerHTML = `<span style="font-size:22px">${icon}</span>${text}`;
    this.toastsEl.appendChild(t);
    setTimeout(() => t.remove(), 3800);
  }

  // Pinky's little speech bubble (used for hints and comments)
  say(text, seconds = 5) {
    this.bubbleText.textContent = text;
    this.bubble.classList.add('show');
    this.bubbleTimer = seconds;
  }

  update(dt) {
    if (this.bubbleTimer > 0) {
      this.bubbleTimer -= dt;
      if (this.bubbleTimer <= 0) this.bubble.classList.remove('show');
    }
  }

  showControls(on, avatarCount = 1) {
    this.controlsEl.classList.toggle('hidden', !on);
    this.controlsEl.innerHTML = `<button class="close" title="Hide">✕</button>
      <div><b>Move</b> <span class="key small">W</span><span class="key small">A</span><span class="key small">S</span><span class="key small">D</span> or arrow keys</div>
      <div><b>Run</b> hold <span class="key small">Shift</span></div>
      <div><b>Jump</b> <span class="key small">Space</span> (press twice to double jump)</div>
      <div><b>Look</b> drag on the game, or two-finger swipe ↔ · <span class="key small">Q</span><span class="key small">C</span> turn</div>
      <div><b>Zoom</b> two-finger swipe ↕ or scroll · <b>Light</b> <span class="key small">F</span></div>
      <div><b>Talk</b> <span class="key small">E</span> · <b>Hint</b> <span class="key small">H</span></div>
      <div><b>Swim</b> <span class="key small">Space</span> up, <span class="key small">Shift</span> dive</div>`;
    this.controlsEl.querySelector('.close').addEventListener('click', (e) => { e.stopPropagation(); this.showControls(false); this.game.settings.hideControls = true; this.game.saveGame(); });
    this.avatarEl.style.bottom = on ? '240px' : '16px';
  }

  // ---------- Dialogue ----------
  /**
   * lines: [{ who, text, choices?: [{ text, value }], mood? }]
   * Resolves with the last choice value (or undefined).
   */
  dialogue(lines) {
    return new Promise((resolve) => {
      this.dialogueActive = true;
      this.hud.classList.add('talking');
      this.dlg.classList.remove('hidden');
      this.prompt(null);
      let i = 0;
      let lastChoice;
      let typing = false, full = '', shown = 0, typeTimer = null;
      const nameEl = this.dlg.querySelector('.name');
      const textEl = this.dlg.querySelector('.text');
      const choicesEl = this.dlg.querySelector('.choices');
      const nextEl = this.dlg.querySelector('.next');
      let sel = 0;
      const show = () => {
        const L = lines[i];
        if (L.onShow) L.onShow();
        nameEl.textContent = L.who;
        nameEl.style.background = L.color || '';
        full = L.text; shown = 0; typing = true;
        textEl.textContent = '';
        choicesEl.innerHTML = '';
        nextEl.classList.toggle('hidden', !!L.choices);
        clearInterval(typeTimer);
        typeTimer = setInterval(() => {
          shown += 2;
          textEl.textContent = full.slice(0, shown);
          if (shown % 4 === 0) this.game.audio.blip(L.pitch || 1);
          if (shown >= full.length) { clearInterval(typeTimer); typing = false; showChoices(); }
        }, 22);
      };
      const showChoices = () => {
        const L = lines[i];
        if (!L.choices) return;
        sel = 0;
        L.choices.forEach((c, k) => {
          const b = document.createElement('button');
          b.innerHTML = `<span class="key small">${k + 1}</span> ${c.text}`;
          b.addEventListener('click', (e) => { e.stopPropagation(); pick(k); });
          choicesEl.appendChild(b);
        });
        highlight();
      };
      const highlight = () => [...choicesEl.children].forEach((b, k) => b.classList.toggle('sel', k === sel));
      const pick = (k) => {
        const L = lines[i];
        lastChoice = L.choices[k].value;
        this.game.audio.click();
        if (L.choices[k].then) {
          // branch: splice in follow-up lines
          lines.splice(i + 1, 0, ...L.choices[k].then);
        }
        advance(true);
      };
      const advance = (fromChoice = false) => {
        if (typing) { clearInterval(typeTimer); typing = false; textEl.textContent = full; showChoices(); return; }
        if (lines[i].choices && !fromChoice) return;
        i++;
        if (i >= lines.length) return finish();
        show();
      };
      const onKey = (e) => {
        if (['Space', 'KeyE', 'Enter'].includes(e.code)) {
          e.preventDefault();
          if (lines[i].choices && !typing) pick(sel); else advance();
        } else if (lines[i].choices && !typing) {
          const n = parseInt(e.key, 10);
          if (n >= 1 && n <= lines[i].choices.length) pick(n - 1);
          if (e.code === 'ArrowDown' || e.code === 'KeyS') { sel = (sel + 1) % lines[i].choices.length; highlight(); }
          if (e.code === 'ArrowUp' || e.code === 'KeyW') { sel = (sel + lines[i].choices.length - 1) % lines[i].choices.length; highlight(); }
        }
      };
      const onClick = (e) => { if (!lines[i].choices) advance(); };
      const finish = () => {
        clearInterval(typeTimer);
        window.removeEventListener('keydown', onKey, true);
        this.dlg.removeEventListener('pointerdown', onClick);
        this.game.canvas.removeEventListener('pointerdown', onClick);
        this.dlg.classList.add('hidden');
        this.hud.classList.remove('talking');
        // let the key that closed the box not also trigger a jump
        setTimeout(() => { this.dialogueActive = false; }, 120);
        resolve(lastChoice);
      };
      window.addEventListener('keydown', onKey, true);
      this.dlg.addEventListener('pointerdown', onClick);
      this.game.canvas.addEventListener('pointerdown', onClick);
      show();
    });
  }

  // ---------- Panels ----------
  isBusy() { return !!this.open || this.dialogueActive; }

  close() {
    if (!this.open) return;
    this.overlay.classList.add('hidden');
    this.open = null;
    this.game.onPanelClosed?.();
  }

  _openPanel(name, html, cls = '') {
    this.open = name;
    this.panel.className = 'panel ' + cls;
    this.panel.innerHTML = `<button class="close">✕</button>` + html;
    this.panel.querySelector('.close').addEventListener('click', () => this.close());
    this.overlay.classList.remove('hidden');
  }

  openJournal(state, tab = 'friends') {
    this.game.audio.page();
    const tabs = JOURNAL_TABS.map(([k, label]) => `<button data-tab="${k}" class="${k === tab ? 'active' : ''}">${label}</button>`).join('');
    const items = Object.entries(JOURNAL).filter(([, e]) => e.cat === tab);
    const cards = items.map(([k, e], idx) => {
      const found = state.journal.includes(k);
      const count = e.counter ? state.counts[k] || 0 : null;
      const tilt = ((idx * 37) % 5) - 2;
      if (!found) return `<div class="entry locked" style="--tilt:${tilt}deg"><div class="ic">${e.icon}</div><h3>???</h3><p>Not found yet. Keep exploring!</p></div>`;
      return `<div class="entry" style="--tilt:${tilt}deg"><div class="ic">${e.icon}</div>${count !== null ? `<span class="count">× ${count}${state.totals[k] ? ' / ' + state.totals[k] : ''}</span>` : ''}<h3>${e.title}</h3><p>${e.text}</p></div>`;
    }).join('');
    const found = Object.keys(JOURNAL).filter((k) => state.journal.includes(k)).length;
    this._openPanel('journal', `<h2>Jacinta’s Journal</h2><div style="font-family:var(--kid)">${found} of ${Object.keys(JOURNAL).length} things discovered</div><div class="tabs">${tabs}</div><div class="entries">${cards}</div>`, 'journal');
    this.panel.querySelectorAll('[data-tab]').forEach((b) => b.addEventListener('click', () => this.openJournal(state, b.dataset.tab)));
  }

  openMap(drawMap, legend) {
    this.game.audio.page();
    this._openPanel('map', `<h2>Map</h2><div class="map-wrap"><canvas class="map-canvas" width="900" height="600"></canvas></div><div class="legend">${legend}</div>`);
    const c = this.panel.querySelector('canvas');
    drawMap(c);
  }

  openCharacters(available, current, all) {
    const cards = all.map((k) => {
      const info = AVATAR_INFO[k];
      const ok = available.includes(k);
      return `<div class="char-card ${k === current ? 'active' : ''} ${ok ? '' : 'locked'}" data-k="${k}"><div class="big">${info.face}</div><h3>${info.name}</h3><div>${ok ? info.desc : 'Unlocks later in the story.'}</div>
        ${ok ? `<button class="big-btn ${k === current ? 'alt' : ''}" style="min-width:0;font-size:16px;padding:10px 16px;margin-top:10px">${k === current ? 'Playing now' : 'Play as ' + info.name.split(' ')[0]}</button>` : ''}</div>`;
    }).join('');
    this._openPanel('chars', `<h2>Who do you want to be?</h2><div>Press <span class="key small">1</span>–<span class="key small">4</span> or <span class="key small">Tab</span> any time to switch.</div><div class="char-cards">${cards}</div>`);
    this.panel.querySelectorAll('.char-card button').forEach((b) => b.addEventListener('click', () => {
      const k = b.closest('.char-card').dataset.k;
      this.game.switchAvatar(k);
      this.close();
    }));
  }

  openSettings(s) {
    this._openPanel('settings', `<h2>Settings</h2>
      <div class="settings">
        <label>Music <input type="range" min="0" max="1" step="0.05" data-vol="music" value="${s.music}"></label>
        <label>Sound effects <input type="range" min="0" max="1" step="0.05" data-vol="sfx" value="${s.sfx}"></label>
        <label>Nature sounds <input type="range" min="0" max="1" step="0.05" data-vol="ambience" value="${s.ambience}"></label>
        <label>Graphics quality <select data-q><option value="high">High (best for Mac M4)</option><option value="medium">Medium</option><option value="low">Low (fastest)</option></select></label>
        <label>Camera turning speed <input type="range" min="0.002" max="0.012" step="0.0005" data-sens value="${s.sensitivity}"></label>
        <label>Look around by just moving the mouse<br><small style="font-weight:400;color:#8a6a9a">Click the game to start; press Esc to get the mouse back</small> <input type="checkbox" data-ml ${s.mouseLook ? 'checked' : ''}></label>
        <label>Show controls help <input type="checkbox" data-ctl ${s.hideControls ? '' : 'checked'}></label>
      </div>
      <h2 style="font-size:26px;margin-top:18px">Controls</h2>
      <div class="controls-table">
        <b>Move</b><span>W A S D or arrow keys (game controller: left stick)</span>
        <b>Run</b><span>Hold Shift</span>
        <b>Jump / double jump</b><span>Space, press again in the air</span>
        <b>Glide (with cape)</b><span>Hold Space while falling</span>
        <b>Swim up / dive</b><span>Space / Shift (or X)</span>
        <b>Look around</b><span>Click and drag on the game, two-finger swipe left/right on a trackpad, or Q / C keys (R / V tilt up / down)</span>
        <b>Zoom in / out</b><span>Two-finger swipe up/down, pinch, mouse scroll, or + / − keys</span>
        <b>Flashlight</b><span>F (turns on by itself when it gets dark)</span>
        <b>Talk / pick up</b><span>E</span>
        <b>Switch character</b><span>Tab, or 1 2 3 4</span>
        <b>Hint · Journal · Map</b><span>H · J · M</span>
      </div>
      <div style="display:flex;gap:10px;margin-top:20px;flex-wrap:wrap">
        <button class="big-btn alt" data-restart style="min-width:0;font-size:16px">Start a new game</button>
        <button class="big-btn" data-resume style="min-width:0;font-size:16px">Back to playing</button>
      </div>`, 'settings');
    this.panel.querySelector('[data-q]').value = s.quality;
    this.panel.querySelectorAll('[data-vol]').forEach((r) => r.addEventListener('input', () => this.game.setVolume(r.dataset.vol, parseFloat(r.value))));
    this.panel.querySelector('[data-q]').addEventListener('change', (e) => this.game.setQuality(e.target.value));
    this.panel.querySelector('[data-sens]').addEventListener('input', (e) => this.game.setSensitivity(parseFloat(e.target.value)));
    this.panel.querySelector('[data-ml]').addEventListener('change', (e) => this.game.setMouseLook(e.target.checked));
    this.panel.querySelector('[data-ctl]').addEventListener('change', (e) => { this.game.settings.hideControls = !e.target.checked; this.showControls(e.target.checked); this.game.saveGame(); });
    this.panel.querySelector('[data-resume]').addEventListener('click', () => this.close());
    this.panel.querySelector('[data-restart]').addEventListener('click', () => {
      if (this.panel.querySelector('[data-restart]').dataset.sure) { this.game.newGame(); return; }
      const b = this.panel.querySelector('[data-restart]');
      b.dataset.sure = '1';
      b.textContent = 'Click again to erase progress';
    });
  }

  fade(on) { this.fadeEl.classList.toggle('on', on); }

  chapter(title, sub, seconds = 3.5) {
    const d = this.chapterEl.querySelector('div');
    d.innerHTML = `${title}<small>${sub || ''}</small>`;
    this.chapterEl.classList.add('show');
    setTimeout(() => this.chapterEl.classList.remove('show'), seconds * 1000);
  }
}
