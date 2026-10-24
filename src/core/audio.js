// All sounds and music are made live in the browser (no sound files needed):
// a gentle piano-and-pad melody, birds, breezes, crickets, crackling fires,
// splashes, bounces and sparkly reward sounds.
const PENTA = [0, 2, 4, 7, 9]; // major pentatonic steps
const CHORDS = [
  [0, 4, 7, 11], // Imaj7
  [9, 12, 16, 19], // vi7
  [5, 9, 12, 16], // IVmaj7
  [7, 11, 14, 17], // V7-ish (sus feel)
];

function midiToHz(m) { return 440 * Math.pow(2, (m - 69) / 12); }

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.started = false;
    this.volumes = { master: 0.9, music: 0.55, sfx: 0.8, ambience: 0.7 };
    this.state = { night: 0, underwater: false, nearWater: 0, fire: 0, waterfall: 0, scene: 'title', mood: 'calm' };
    this.nextNoteTime = 0;
    this.step = 0;
    this.bar = 0;
  }

  start() {
    if (this.started) { this.ctx?.resume?.(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    const c = this.ctx;
    this.master = c.createGain();
    this.master.gain.value = this.volumes.master;
    this.master.connect(c.destination);
    // reverb for a dreamy space
    this.reverb = c.createConvolver();
    this.reverb.buffer = this._impulse(3.2, 2.5);
    this.reverbGain = c.createGain();
    this.reverbGain.gain.value = 0.55;
    this.reverb.connect(this.reverbGain).connect(this.master);

    this.musicFilter = c.createBiquadFilter();
    this.musicFilter.type = 'lowpass';
    this.musicFilter.frequency.value = 12000;
    this.musicGain = c.createGain();
    this.musicGain.gain.value = this.volumes.music;
    this.musicGain.connect(this.musicFilter).connect(this.master);
    this.musicFilter.connect(this.reverb);

    this.sfxGain = c.createGain();
    this.sfxGain.gain.value = this.volumes.sfx;
    this.sfxGain.connect(this.master);
    this.sfxGain.connect(this.reverb);

    this.ambGain = c.createGain();
    this.ambGain.gain.value = this.volumes.ambience;
    this.ambGain.connect(this.master);

    this.noiseBuf = this._noise(2);
    this._setupAmbience();
    this.nextNoteTime = c.currentTime + 0.3;
    this.started = true;
    this._timer = setInterval(() => this._schedule(), 50);
  }

  setVolume(kind, v) {
    this.volumes[kind] = v;
    if (!this.started) return;
    const node = { master: this.master, music: this.musicGain, sfx: this.sfxGain, ambience: this.ambGain }[kind];
    node?.gain.setTargetAtTime(v, this.ctx.currentTime, 0.05);
  }

  _impulse(seconds, decay) {
    const c = this.ctx, len = c.sampleRate * seconds;
    const buf = c.createBuffer(2, len, c.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
    }
    return buf;
  }

  _noise(seconds) {
    const c = this.ctx, len = c.sampleRate * seconds;
    const buf = c.createBuffer(1, len, c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }

  _noiseSource(loop = true) {
    const s = this.ctx.createBufferSource();
    s.buffer = this.noiseBuf;
    s.loop = loop;
    return s;
  }

  // ---------------- Ambience ----------------
  _setupAmbience() {
    const c = this.ctx;
    // breeze
    const breeze = this._noiseSource();
    const bf = c.createBiquadFilter(); bf.type = 'bandpass'; bf.frequency.value = 500; bf.Q.value = 0.6;
    this.breezeGain = c.createGain(); this.breezeGain.gain.value = 0.0;
    const lfo = c.createOscillator(); lfo.frequency.value = 0.08;
    const lfoG = c.createGain(); lfoG.gain.value = 250;
    lfo.connect(lfoG).connect(bf.frequency);
    breeze.connect(bf).connect(this.breezeGain).connect(this.ambGain);
    breeze.start(); lfo.start();
    // water lapping
    const water = this._noiseSource();
    const wf = c.createBiquadFilter(); wf.type = 'lowpass'; wf.frequency.value = 700;
    this.waterGain = c.createGain(); this.waterGain.gain.value = 0;
    const wl = c.createOscillator(); wl.frequency.value = 0.35;
    const wlG = c.createGain(); wlG.gain.value = 0.5;
    const wAmp = c.createGain(); wAmp.gain.value = 0.5;
    wl.connect(wlG).connect(wAmp.gain);
    water.connect(wf).connect(wAmp).connect(this.waterGain).connect(this.ambGain);
    water.start(); wl.start();
    // waterfall roar
    const fall = this._noiseSource();
    const ff = c.createBiquadFilter(); ff.type = 'lowpass'; ff.frequency.value = 1800;
    this.fallGain = c.createGain(); this.fallGain.gain.value = 0;
    fall.connect(ff).connect(this.fallGain).connect(this.ambGain);
    fall.start();
    // underwater hum
    const uw = this._noiseSource();
    const uf = c.createBiquadFilter(); uf.type = 'lowpass'; uf.frequency.value = 220;
    this.underGain = c.createGain(); this.underGain.gain.value = 0;
    uw.connect(uf).connect(this.underGain).connect(this.ambGain);
    uw.start();
    // campfire low rumble
    const fire = this._noiseSource();
    const fiF = c.createBiquadFilter(); fiF.type = 'lowpass'; fiF.frequency.value = 400;
    this.fireGain = c.createGain(); this.fireGain.gain.value = 0;
    fire.connect(fiF).connect(this.fireGain).connect(this.ambGain);
    fire.start();
    this.ambTimer = 0;
  }

  updateAmbience(dt) {
    if (!this.started) return;
    const s = this.state, t = this.ctx.currentTime;
    const outdoor = s.scene === 'earth' || s.scene === 'pinky' || s.scene === 'snow';
    const set = (g, v) => g.gain.setTargetAtTime(v, t, 0.4);
    set(this.breezeGain, outdoor && !s.underwater ? 0.05 + (1 - s.night) * 0.04 : 0);
    set(this.waterGain, outdoor && !s.underwater ? s.nearWater * 0.18 : 0);
    set(this.fallGain, outdoor ? s.waterfall * (s.underwater ? 0.05 : 0.22) : 0);
    set(this.underGain, s.underwater ? 0.35 : 0);
    set(this.fireGain, s.fire * 0.12);
    this.musicFilter.frequency.setTargetAtTime(s.underwater ? 600 : 12000, t, 0.3);

    if (!outdoor) return;
    this.ambTimer -= dt;
    if (this.ambTimer <= 0) {
      this.ambTimer = 0.15 + Math.random() * 0.5;
      if (s.underwater) {
        if (Math.random() < 0.25) this.bubble();
        if (Math.random() < 0.03) this.whaleSong();
      } else if (s.night < 0.5) {
        if (Math.random() < (s.scene === 'pinky' ? 0.35 : 0.25)) this.bird();
      } else {
        if (Math.random() < 0.7) this.cricket();
        if (Math.random() < 0.04) this.owl();
      }
      if (s.fire > 0.05 && Math.random() < s.fire * 2.2) this.crackle(s.fire);
      if (s.fire > 0.05 && Math.random() < s.fire * 1.5) setTimeout(() => this.crackle(s.fire * 0.7), 60);
    }
  }

  bird(vol = 1) {
    if (!this.started) return;
    const c = this.ctx, t = c.currentTime;
    const base = 2200 + Math.random() * 1800;
    const notes = 2 + Math.floor(Math.random() * 4);
    const pan = c.createStereoPanner ? c.createStereoPanner() : null;
    const out = c.createGain(); out.gain.value = (0.05 + Math.random() * 0.04) * (vol > 1 ? 1 : vol) * (vol < 1 ? 2.2 : 1);
    if (pan) { pan.pan.value = Math.random() * 2 - 1; out.connect(pan).connect(this.ambGain); } else out.connect(this.ambGain);
    out.connect(this.reverb);
    for (let i = 0; i < notes; i++) {
      const o = c.createOscillator(); o.type = 'sine';
      const g = c.createGain();
      const st = t + i * (0.09 + Math.random() * 0.05);
      const f = base * (0.85 + Math.random() * 0.4);
      o.frequency.setValueAtTime(f, st);
      o.frequency.exponentialRampToValueAtTime(f * (Math.random() < 0.5 ? 1.5 : 0.7), st + 0.07);
      g.gain.setValueAtTime(0, st);
      g.gain.linearRampToValueAtTime(1, st + 0.01);
      g.gain.exponentialRampToValueAtTime(0.001, st + 0.09);
      o.connect(g).connect(out);
      o.start(st); o.stop(st + 0.12);
    }
  }

  cricket() {
    const c = this.ctx, t = c.currentTime;
    const o = c.createOscillator(); o.frequency.value = 4300 + Math.random() * 600;
    const am = c.createOscillator(); am.frequency.value = 38;
    const amG = c.createGain(); amG.gain.value = 0.5;
    const g = c.createGain(); g.gain.value = 0;
    am.connect(amG).connect(g.gain);
    const env = c.createGain();
    env.gain.setValueAtTime(0, t);
    env.gain.linearRampToValueAtTime(0.018, t + 0.03);
    env.gain.linearRampToValueAtTime(0, t + 0.25);
    const pan = c.createStereoPanner ? c.createStereoPanner() : null;
    o.connect(g).connect(env);
    if (pan) { pan.pan.value = Math.random() * 2 - 1; env.connect(pan).connect(this.ambGain); } else env.connect(this.ambGain);
    o.start(t); am.start(t); o.stop(t + 0.3); am.stop(t + 0.3);
  }

  owl() {
    const c = this.ctx, t = c.currentTime;
    for (let i = 0; i < 2; i++) {
      const o = c.createOscillator(); o.type = 'sine';
      const g = c.createGain();
      const st = t + i * 0.45;
      o.frequency.setValueAtTime(420, st);
      o.frequency.linearRampToValueAtTime(380, st + 0.35);
      g.gain.setValueAtTime(0, st);
      g.gain.linearRampToValueAtTime(0.05, st + 0.08);
      g.gain.linearRampToValueAtTime(0, st + 0.38);
      o.connect(g).connect(this.ambGain); g.connect(this.reverb);
      o.start(st); o.stop(st + 0.4);
    }
  }

  crackle(k = 1) {
    const c = this.ctx, t = c.currentTime;
    const s = this._noiseSource(false);
    const f = c.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 1500 + Math.random() * 2500;
    const g = c.createGain();
    g.gain.setValueAtTime(0.25 * k * Math.random(), t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.02 + Math.random() * 0.04);
    s.connect(f).connect(g).connect(this.ambGain);
    s.start(t, Math.random()); s.stop(t + 0.08);
  }

  bubble() {
    const c = this.ctx, t = c.currentTime;
    const o = c.createOscillator(); o.type = 'sine';
    const g = c.createGain();
    const f = 300 + Math.random() * 500;
    o.frequency.setValueAtTime(f, t);
    o.frequency.exponentialRampToValueAtTime(f * 2.2, t + 0.08);
    g.gain.setValueAtTime(0.06, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
    o.connect(g).connect(this.ambGain);
    o.start(t); o.stop(t + 0.12);
  }

  whaleSong() {
    const c = this.ctx, t = c.currentTime;
    const o = c.createOscillator(); o.type = 'sine';
    const g = c.createGain();
    o.frequency.setValueAtTime(180, t);
    o.frequency.linearRampToValueAtTime(320, t + 1.2);
    o.frequency.linearRampToValueAtTime(140, t + 2.6);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.05, t + 0.6);
    g.gain.linearRampToValueAtTime(0, t + 2.8);
    o.connect(g).connect(this.reverb);
    o.start(t); o.stop(t + 3);
  }

  // ---------------- Music ----------------
  _piano(midi, time, vel = 0.5, dur = 2.5) {
    const c = this.ctx;
    const f = midiToHz(midi);
    const out = c.createGain();
    out.gain.setValueAtTime(0, time);
    out.gain.linearRampToValueAtTime(vel * 0.16, time + 0.008);
    out.gain.exponentialRampToValueAtTime(vel * 0.05, time + 0.4);
    out.gain.exponentialRampToValueAtTime(0.0008, time + dur);
    const lp = c.createBiquadFilter(); lp.type = 'lowpass';
    lp.frequency.setValueAtTime(f * 8, time);
    lp.frequency.exponentialRampToValueAtTime(f * 2, time + 1.0);
    out.connect(lp).connect(this.musicGain);
    [[1, 1], [2, 0.35], [3, 0.12], [4, 0.06]].forEach(([h, a], i) => {
      const o = c.createOscillator();
      o.type = i === 0 ? 'triangle' : 'sine';
      o.frequency.value = f * h * (1 + (Math.random() - 0.5) * 0.002);
      const g = c.createGain(); g.gain.value = a;
      o.connect(g).connect(out);
      o.start(time); o.stop(time + dur + 0.1);
    });
  }

  _pad(midis, time, dur) {
    const c = this.ctx;
    const out = c.createGain();
    out.gain.setValueAtTime(0, time);
    out.gain.linearRampToValueAtTime(0.035, time + dur * 0.35);
    out.gain.linearRampToValueAtTime(0, time + dur);
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900;
    out.connect(lp).connect(this.musicGain);
    for (const m of midis) {
      for (const det of [-6, 6]) {
        const o = c.createOscillator(); o.type = 'sawtooth';
        o.frequency.value = midiToHz(m);
        o.detune.value = det;
        o.connect(out);
        o.start(time); o.stop(time + dur + 0.1);
      }
    }
  }

  _bell(midi, time, vel = 0.3) {
    const c = this.ctx;
    const f = midiToHz(midi);
    const g = c.createGain();
    g.gain.setValueAtTime(0, time);
    g.gain.linearRampToValueAtTime(vel * 0.08, time + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0005, time + 2.5);
    g.connect(this.musicGain);
    for (const [h, a] of [[1, 1], [2.76, 0.4], [5.4, 0.15]]) {
      const o = c.createOscillator(); o.type = 'sine'; o.frequency.value = f * h;
      const og = c.createGain(); og.gain.value = a;
      o.connect(og).connect(g);
      o.start(time); o.stop(time + 2.6);
    }
  }

  _schedule() {
    if (!this.started) return;
    const c = this.ctx;
    const s = this.state;
    const night = s.night > 0.5;
    const tempo = night ? 62 : s.scene === 'intro' || s.scene === 'storybook' ? 68 : 78;
    const stepDur = 60 / tempo / 2; // eighth notes
    const key = s.scene === 'earth' ? 60 : 65; // C on Earth, F in Pinky Land
    while (this.nextNoteTime < c.currentTime + 0.25) {
      const t = this.nextNoteTime;
      const chord = CHORDS[this.bar % 4];
      const stepInBar = this.step % 8;
      if (stepInBar === 0) {
        this._pad(chord.map((n) => key - 12 + n), t, stepDur * 8.2);
        this._piano(key - 24 + chord[0], t, 0.5, 3.5);
      }
      // melody: sparse, gentle pentatonic phrases
      const density = night ? 0.28 : 0.42;
      if (Math.random() < density && stepInBar % (night ? 2 : 1) === 0) {
        const deg = PENTA[Math.floor(Math.random() * PENTA.length)];
        const oct = Math.random() < 0.3 ? 12 : 0;
        const midi = key + deg + oct + (night ? 0 : 12);
        if (night || s.scene === 'intro' || s.scene === 'storybook') this._bell(midi, t, 0.4 + Math.random() * 0.3);
        else this._piano(midi, t, 0.25 + Math.random() * 0.25, 2.2);
      }
      if (stepInBar === 4 && Math.random() < 0.5) this._piano(key - 12 + chord[1 + Math.floor(Math.random() * 3)], t, 0.22, 2.5);
      this.nextNoteTime += stepDur;
      this.step++;
      if (this.step % 8 === 0) this.bar++;
    }
  }

  // ---------------- Sound effects ----------------
  _tone(freq, time, { type = 'sine', dur = 0.3, vol = 0.2, slide = 0, attack = 0.005, dest = this.sfxGain } = {}) {
    const c = this.ctx;
    const o = c.createOscillator(); o.type = type;
    const g = c.createGain();
    o.frequency.setValueAtTime(freq, time);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq * slide), time + dur);
    g.gain.setValueAtTime(0, time);
    g.gain.linearRampToValueAtTime(vol, time + attack);
    g.gain.exponentialRampToValueAtTime(0.0005, time + dur);
    o.connect(g).connect(dest);
    o.start(time); o.stop(time + dur + 0.05);
  }

  collect() {
    if (!this.started) return;
    const t = this.ctx.currentTime;
    [0, 4, 7, 12, 16].forEach((n, i) => this._tone(midiToHz(84 + n), t + i * 0.06, { dur: 0.6, vol: 0.12 }));
  }

  heart() {
    if (!this.started) return;
    const t = this.ctx.currentTime;
    [0, 4, 7, 11, 14, 19].forEach((n, i) => {
      this._tone(midiToHz(72 + n), t + i * 0.1, { dur: 1.4, vol: 0.13, type: 'triangle' });
      this._tone(midiToHz(84 + n), t + i * 0.1 + 0.05, { dur: 1.0, vol: 0.05 });
    });
    this._tone(midiToHz(48), t, { dur: 2.5, vol: 0.12, type: 'triangle' });
  }

  jump(n = 1) {
    if (!this.started) return;
    const t = this.ctx.currentTime;
    if (n === 1) this._tone(320, t, { dur: 0.16, vol: 0.08, slide: 1.8 });
    else { this._tone(520, t, { dur: 0.2, vol: 0.08, slide: 1.9 }); this._tone(1040, t + 0.05, { dur: 0.3, vol: 0.05, slide: 1.5 }); }
  }

  bounce() {
    if (!this.started) return;
    const t = this.ctx.currentTime;
    this._tone(180, t, { dur: 0.45, vol: 0.18, slide: 3.2, type: 'sine' });
    this._tone(360, t + 0.02, { dur: 0.35, vol: 0.06, slide: 2.8, type: 'triangle' });
  }

  splash(k = 1) {
    if (!this.started) return;
    const c = this.ctx, t = c.currentTime;
    const s = this._noiseSource(false);
    const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.setValueAtTime(1200, t); f.frequency.exponentialRampToValueAtTime(300, t + 0.5);
    const g = c.createGain();
    g.gain.setValueAtTime(Math.min(0.4, 0.12 + k * 0.03), t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.6);
    s.connect(f).connect(g).connect(this.sfxGain);
    s.start(t); s.stop(t + 0.7);
    for (let i = 0; i < 4; i++) setTimeout(() => this.bubble(), 80 + i * 70);
  }

  footstep(soft) {
    if (!this.started) return;
    const c = this.ctx, t = c.currentTime;
    const s = this._noiseSource(false);
    const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = soft ? 500 : 1400 + Math.random() * 600; f.Q.value = 1.2;
    const g = c.createGain();
    g.gain.setValueAtTime(soft ? 0.05 : 0.035, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.07);
    s.connect(f).connect(g).connect(this.sfxGain);
    s.start(t, Math.random()); s.stop(t + 0.1);
  }

  blip(pitch = 1) {
    if (!this.started) return;
    const t = this.ctx.currentTime;
    this._tone(600 * pitch * (0.95 + Math.random() * 0.1), t, { dur: 0.06, vol: 0.035, type: 'triangle' });
  }

  click() {
    if (!this.started) return;
    this._tone(880, this.ctx.currentTime, { dur: 0.08, vol: 0.06, type: 'triangle' });
  }

  page() {
    if (!this.started) return;
    const c = this.ctx, t = c.currentTime;
    const s = this._noiseSource(false);
    const f = c.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 2500;
    const g = c.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.08, t + 0.05);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
    s.connect(f).connect(g).connect(this.sfxGain);
    s.start(t); s.stop(t + 0.35);
  }

  portal() {
    if (!this.started) return;
    const t = this.ctx.currentTime;
    for (let i = 0; i < 16; i++) this._tone(midiToHz(65 + PENTA[i % 5] + Math.floor(i / 5) * 12), t + i * 0.12, { dur: 1.5, vol: 0.08 });
    this._tone(110, t, { dur: 4, vol: 0.12, slide: 4, type: 'triangle', attack: 1.5 });
  }

  hint() {
    if (!this.started) return;
    const t = this.ctx.currentTime;
    [12, 7, 16].forEach((n, i) => this._tone(midiToHz(79 + n), t + i * 0.09, { dur: 0.5, vol: 0.07 }));
  }

  bark() {
    if (!this.started) return;
    const c = this.ctx, t = c.currentTime;
    for (const d of [0, 0.22]) {
      this._tone(420, t + d, { dur: 0.13, vol: 0.18, slide: 0.55, type: 'sawtooth' });
      const s = this._noiseSource(false); const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 900;
      const g = c.createGain(); g.gain.setValueAtTime(0.12, t + d); g.gain.exponentialRampToValueAtTime(0.001, t + d + 0.1);
      s.connect(f).connect(g).connect(this.sfxGain); s.start(t + d); s.stop(t + d + 0.12);
    }
  }

  // pitch > 1 is a tiny kitten mew, < 1 a grown-up cat; vol 0..1 (quieter when far away)
  meow(pitch = 1, vol = 1) {
    if (!this.started) return;
    const c = this.ctx, t = c.currentTime;
    const o = c.createOscillator(); o.type = 'sawtooth';
    const f = c.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 4;
    const g = c.createGain();
    const k = pitch, len = pitch > 1 ? 0.4 : 0.55;
    o.frequency.setValueAtTime(520 * k, t); o.frequency.linearRampToValueAtTime(760 * k, t + len * 0.33); o.frequency.linearRampToValueAtTime(480 * k, t + len);
    f.frequency.setValueAtTime(900 * k, t); f.frequency.linearRampToValueAtTime(1800 * k, t + len * 0.36); f.frequency.linearRampToValueAtTime(800 * k, t + len);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.16 * vol, t + 0.06); g.gain.linearRampToValueAtTime(0, t + len + 0.05);
    o.connect(f).connect(g).connect(this.sfxGain); o.start(t); o.stop(t + 0.65);
  }

  purr() {
    if (!this.started) return;
    const c = this.ctx, t = c.currentTime;
    const s = this._noiseSource(false); const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 180;
    const am = c.createOscillator(); am.frequency.value = 26; const amG = c.createGain(); amG.gain.value = 0.5;
    const g = c.createGain(); g.gain.value = 0;
    const env = c.createGain(); env.gain.setValueAtTime(0, t); env.gain.linearRampToValueAtTime(0.5, t + 0.3); env.gain.linearRampToValueAtTime(0, t + 1.6);
    am.connect(amG).connect(g.gain);
    s.connect(f).connect(g).connect(env).connect(this.sfxGain); s.start(t); am.start(t); s.stop(t + 1.7); am.stop(t + 1.7);
  }

  squeak() {
    if (!this.started) return;
    const t = this.ctx.currentTime;
    this._tone(2600, t, { dur: 0.08, vol: 0.08, slide: 1.3 });
    this._tone(2900, t + 0.12, { dur: 0.07, vol: 0.07, slide: 1.25 });
  }

  chatter() {
    if (!this.started) return;
    const t = this.ctx.currentTime;
    for (let i = 0; i < 6; i++) this._tone(1800 + Math.random() * 400, t + i * 0.07, { dur: 0.04, vol: 0.07, type: 'square', slide: 0.7 });
  }

  hurt() {
    if (!this.started) return;
    const t = this.ctx.currentTime;
    this._tone(420, t, { dur: 0.25, vol: 0.12, slide: 0.5, type: 'triangle' });
  }

  stomp() {
    if (!this.started) return;
    const t = this.ctx.currentTime;
    this._tone(260, t, { dur: 0.18, vol: 0.14, slide: 2.2 });
    this.crackle(0.6);
  }

  // Pooking Power: a short, silly cartoon toot (a wobbly low buzz that bends upward at the end)
  pook() {
    if (!this.started) return;
    const c = this.ctx, t = c.currentTime;
    const o = c.createOscillator(); o.type = 'sawtooth';
    o.frequency.setValueAtTime(95, t);
    o.frequency.linearRampToValueAtTime(70, t + 0.22);
    o.frequency.linearRampToValueAtTime(140, t + 0.34);
    // flutter
    const lfo = c.createOscillator(); lfo.frequency.value = 32;
    const lg = c.createGain(); lg.gain.value = 22;
    lfo.connect(lg).connect(o.frequency);
    const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 650; f.Q.value = 4;
    const g = c.createGain();
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.22, t + 0.02);
    g.gain.setValueAtTime(0.2, t + 0.25); g.gain.exponentialRampToValueAtTime(0.001, t + 0.38);
    o.connect(f).connect(g).connect(this.sfxGain);
    o.start(t); lfo.start(t); o.stop(t + 0.4); lfo.stop(t + 0.4);
    // a little airy puff on top
    const n = this._noiseSource(false);
    const nf = c.createBiquadFilter(); nf.type = 'bandpass'; nf.frequency.value = 500;
    const ng = c.createGain(); ng.gain.setValueAtTime(0.05, t); ng.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
    n.connect(nf).connect(ng).connect(this.sfxGain); n.start(t); n.stop(t + 0.32);
    // and a giggle-y 'boing' after
    this._tone(660, t + 0.36, { dur: 0.18, vol: 0.05, slide: 1.6, type: 'triangle' });
  }

  glide() {
    if (!this.started) return;
    const c = this.ctx, t = c.currentTime;
    const s = this._noiseSource(false);
    const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 900;
    const g = c.createGain();
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.06, t + 0.2); g.gain.linearRampToValueAtTime(0, t + 0.8);
    s.connect(f).connect(g).connect(this.sfxGain);
    s.start(t); s.stop(t + 0.9);
  }
}
