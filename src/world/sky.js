// Sky dome with sunrise/sunset colors, sun, moon, and twinkling stars,
// plus the day & night cycle that moves the sun and changes the light.
import * as THREE from 'three';
import { clamp, lerp, smoothstep } from '../util/noise.js';

const skyVert = /* glsl */ `
  varying vec3 vDir;
  void main(){
    vDir = normalize(position);
    vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    gl_Position = p.xyww; // always at the far plane
  }
`;

const skyFrag = /* glsl */ `
  uniform vec3 uTop; uniform vec3 uHorizon; uniform vec3 uBottom;
  uniform vec3 uSunDir; uniform vec3 uSunColor; uniform vec3 uMoonDir;
  uniform float uStars; uniform float uTime; uniform float uSunGlow;
  varying vec3 vDir;

  uniform float uMilky; uniform float uAurora; uniform float uMeteor;
  float hash(vec3 p){ p = fract(p*0.3183099+0.1); p *= 17.0; return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }
  float h2(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float vnoise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
    return mix(mix(h2(i), h2(i+vec2(1,0)), f.x), mix(h2(i+vec2(0,1)), h2(i+vec2(1,1)), f.x), f.y); }
  float fbm(vec2 p){ float v = 0.0, a = 0.5; for (int i = 0; i < 4; i++){ v += a * vnoise(p); p *= 2.03; a *= 0.5; } return v; }

  void main(){
    vec3 d = normalize(vDir);
    float h = d.y;
    vec3 col = mix(uHorizon, uTop, pow(smoothstep(0.0, 0.85, h), 0.7));
    col = mix(col, uBottom, smoothstep(0.0, -0.25, h));

    // sun glow + disc
    float sd = max(dot(d, normalize(uSunDir)), 0.0);
    col += uSunColor * pow(sd, 6.0) * 0.35 * uSunGlow;
    col += uSunColor * pow(sd, 64.0) * 0.6 * uSunGlow;
    col += uSunColor * smoothstep(0.9993, 0.9997, sd) * 2.5;

    // moon
    float md = max(dot(d, normalize(uMoonDir)), 0.0);
    float moonDisc = smoothstep(0.9990, 0.9994, md);
    col += vec3(0.95, 0.93, 1.0) * moonDisc * 1.4 * uStars;
    col += vec3(0.5, 0.55, 0.9) * pow(md, 80.0) * 0.4 * uStars;

    // stars
    if (uStars > 0.01 && h > -0.05) {
      float hor = smoothstep(-0.05, 0.25, h);
      // the Milky Way: a glowing band across the sky with clumps of star clouds and dark dust lanes
      vec3 galN = normalize(vec3(0.42, 0.35, -0.84));
      float gd = dot(d, galN);                       // distance from the band's centre line
      vec3 gx = normalize(cross(galN, vec3(0.0, 1.0, 0.0)));
      vec3 gy = cross(galN, gx);
      vec2 gp = vec2(atan(dot(d, gy), dot(d, gx)) * 3.0, gd * 9.0);  // coordinates along / across the band
      float core = exp(-pow(gd * 5.5, 2.0));
      float wide = exp(-pow(gd * 2.6, 2.0));
      float clouds = fbm(gp * 1.3 + 3.0);
      float dust = smoothstep(0.45, 0.75, fbm(gp * 2.6 - 7.0)) * exp(-pow(gd * 12.0, 2.0));
      float bulge = 0.6 + 0.8 * pow(max(0.0, cos(atan(dot(d, gy), dot(d, gx)) - 0.6)), 6.0);  // brighter toward the galaxy's centre
      float mw = (core * (0.55 + 0.9 * clouds) + wide * 0.25 * clouds) * bulge * (1.0 - dust * 0.85);
      vec3 mwCol = mix(vec3(0.45, 0.5, 0.85), vec3(1.0, 0.86, 0.72), core * bulge * 0.6);
      col += mwCol * mw * 0.32 * uMilky * uStars * hor;

      // twinkling stars: many more of them inside the Milky Way
      float dens = 0.985 - 0.02 * (core * clouds + wide * 0.5) * uMilky;
      for (int layer = 0; layer < 2; layer++) {
        float scale = layer == 0 ? 220.0 : 520.0;
        vec3 p = d * scale;
        vec3 cell = floor(p);
        float r = hash(cell + float(layer) * 17.0);
        float th = layer == 0 ? dens : (0.94 - 0.08 * core * uMilky);
        if (r > th) {
          vec3 center = cell + 0.5 + (vec3(hash(cell+1.3), hash(cell+2.7), hash(cell+5.1)) - 0.5) * 0.6;
          float dist = length(p - center);
          float twinkle = 0.6 + 0.4 * sin(uTime * (1.5 + r * 6.0) + r * 40.0);
          float star = smoothstep(layer == 0 ? 0.35 : 0.3, 0.0, dist) * twinkle;
          vec3 sc = mix(vec3(1.0,0.85,0.8), vec3(0.75,0.88,1.0), hash(cell+9.0));
          col += sc * star * uStars * hor * (layer == 0 ? 1.6 : 0.55);
        }
      }

      // shooting stars: every few seconds a bright streak zips across part of the sky
      for (int i = 0; i < 3; i++) {
        float fi = float(i);
        float period = 5.0 + fi * 2.3;
        float tt = uTime + fi * 3.7;
        float id = floor(tt / period);
        float ph = fract(tt / period) * period;      // seconds since this one started
        float dur = 0.9;
        if (ph < dur) {
          float a1 = hash(vec3(id, fi, 1.0)) * 6.2831;
          float el = 0.35 + hash(vec3(id, fi, 2.0)) * 0.5;
          vec3 S = normalize(vec3(cos(a1) * (1.0 - el), el, sin(a1) * (1.0 - el)));
          vec3 T = normalize(cross(S, vec3(hash(vec3(id, fi, 3.0)) - 0.5, -1.0, hash(vec3(id, fi, 4.0)) - 0.5)));
          float prog = ph / dur;
          float headS = prog * 0.7;
          vec3 rel = d - S;
          float along = dot(rel, T);
          float across = length(rel - T * along - S * dot(rel, S));
          float inTail = smoothstep(headS - 0.32, headS, along) * step(along, headS);
          float m = inTail * smoothstep(0.007, 0.0, across) * sin(prog * 3.1416);
          float head = smoothstep(0.012, 0.0, length(d - normalize(S + T * headS))) * sin(prog * 3.1416);
          col += vec3(1.0, 0.95, 0.85) * (m * 2.4 + head * 2.6) * uMeteor * uStars * hor;
        }
      }

      // northern lights: green curtains with pink tops, rippling over the northern sky
      if (uAurora > 0.01 && h > 0.0) {
        float az = atan(d.x, -d.z);                   // 0 = north
        float north = smoothstep(1.9, 0.2, abs(az));
        float wave = sin(az * 3.0 + uTime * 0.25) * 0.08 + sin(az * 7.0 - uTime * 0.4) * 0.04;
        float base = 0.10 + wave;
        float top = base + 0.28 + 0.1 * sin(az * 2.0 + uTime * 0.15);
        float band = smoothstep(base - 0.02, base + 0.04, h) * (1.0 - smoothstep(base + 0.06, top, h));
        float warp = fbm(vec2(az * 3.0 + uTime * 0.05, 1.7)) * 2.0;
        float rays = 0.35 + 0.65 * pow(0.5 + 0.5 * sin(az * 38.0 + warp * 9.0), 2.0) * (0.4 + 0.6 * fbm(vec2(az * 22.0, uTime * 0.2)));
        float patches = smoothstep(0.3, 0.75, fbm(vec2(az * 1.6 - uTime * 0.04, 4.2)));
        float flick = (0.55 + 0.45 * fbm(vec2(az * 4.0 + uTime * 0.2, h * 3.0))) * (0.25 + patches);
        float k = band * rays * flick * north;
        vec3 ac = mix(vec3(0.15, 1.0, 0.55), vec3(0.95, 0.35, 0.85), smoothstep(base + 0.05, top, h));
        col += ac * k * 0.55 * uAurora * uStars;
      }
    }
    gl_FragColor = vec4(col, 1.0);
  }
`;

// Color keyframes: night, dawn, day, dusk
const C = (h) => new THREE.Color(h);
// a very dark blue-black night (used in Pinky Land, where the stars put on a show)
const DEEP_NIGHT = { top: C('#02040c'), horizon: C('#0a1129'), bottom: C('#040710'), sun: C('#8f9cff'), fog: C('#060b1c'), amb: C('#3c4a92'), ground: C('#141a33') };
const PALETTE = {
  night: { top: C('#0b1240'), horizon: C('#2b2d6e'), bottom: C('#14183f'), sun: C('#8f9cff'), fog: C('#1d2156'), amb: C('#4a55a8'), ground: C('#1a1f3a') },
  dawn: { top: C('#6f8fd8'), horizon: C('#ffb08a'), bottom: C('#f7c7c0'), sun: C('#ffb27a'), fog: C('#f2b9a6'), amb: C('#c49ad0'), ground: C('#8a6f7a') },
  day: { top: C('#5fa8f0'), horizon: C('#cfe9ff'), bottom: C('#e9f4ff'), sun: C('#fff4e0'), fog: C('#cfe6fb'), amb: C('#bcd8ff'), ground: C('#9fb98a') },
  dusk: { top: C('#5a4ba8'), horizon: C('#ff8fa3'), bottom: C('#ffc29a'), sun: C('#ff9a6a'), fog: C('#e7a2b4'), amb: C('#b58ac9'), ground: C('#7d5f78') },
};

function mixPal(a, b, t, out) {
  for (const k of Object.keys(a)) out[k].copy(a[k]).lerp(b[k], t);
}

export class DayNight {
  constructor(scene, opts = {}) {
    this.scene = scene;
    this.dayLength = opts.dayLength ?? 20 * 60; // seconds for a full day (like Minecraft)
    this.time = opts.startTime ?? 0.3; // 0 = midnight, 0.25 = sunrise, 0.5 = noon, 0.75 = sunset
    this.paused = false;
    this.current = {};
    for (const k of Object.keys(PALETTE.day)) this.current[k] = new THREE.Color();

    this.uniforms = {
      uTop: { value: new THREE.Color() },
      uHorizon: { value: new THREE.Color() },
      uBottom: { value: new THREE.Color() },
      uSunDir: { value: new THREE.Vector3(0, 1, 0) },
      uMoonDir: { value: new THREE.Vector3(0, -1, 0) },
      uSunColor: { value: new THREE.Color() },
      uStars: { value: 0 },
      uTime: { value: 0 },
      uSunGlow: { value: 1 },
      uMilky: { value: 0 }, uAurora: { value: 0 }, uMeteor: { value: 0 },
    };
    const geo = new THREE.SphereGeometry(1000, 48, 24);
    const mat = new THREE.ShaderMaterial({
      uniforms: this.uniforms, vertexShader: skyVert, fragmentShader: skyFrag,
      side: THREE.BackSide, depthWrite: false, fog: false,
    });
    this.dome = new THREE.Mesh(geo, mat);
    this.dome.frustumCulled = false;
    this.dome.renderOrder = -10;
    scene.add(this.dome);

    // Lights
    this.sun = new THREE.DirectionalLight(0xffffff, 2.2);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    const sc = this.sun.shadow.camera;
    sc.left = -45; sc.right = 45; sc.top = 45; sc.bottom = -45; sc.near = 1; sc.far = 260;
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 0.03;
    scene.add(this.sun);
    scene.add(this.sun.target);

    this.hemi = new THREE.HemisphereLight(0xbcd8ff, 0x9fb98a, 0.9);
    scene.add(this.hemi);

    scene.fog = new THREE.Fog(0xcfe6fb, 60, 520);
    this.baseFogNear = 60;
    this.baseFogFar = 520;

    this.sunDir = new THREE.Vector3();
    this.nightAmount = 0; // 0 day .. 1 full night
    this.update(0, new THREE.Vector3());
  }

  _clonePal() {
    const o = {};
    for (const k of Object.keys(PALETTE.day)) o[k] = new THREE.Color();
    return o;
  }

  get hours() { return (this.time * 24) % 24; }
  // Pinky Land's starry show: Milky Way, shooting stars, northern lights and a deep blue-black sky
  setStarShow(on = true) {
    this.uniforms.uMilky.value = on ? 1 : 0;
    this.uniforms.uAurora.value = on ? 1 : 0;
    this.uniforms.uMeteor.value = on ? 1 : 0;
    this.nightPal = on ? DEEP_NIGHT : null;
  }

  isNight() { return this.nightAmount > 0.55; }
  isChilly() { return this.nightAmount > 0.35; }

  setTime(t) { this.time = ((t % 1) + 1) % 1; }

  update(dt, focus, underwater = false) {
    // nights pass more than twice as fast as days, so it's mostly daytime
    if (!this.paused) this.time = (this.time + (dt / this.dayLength) * (this.nightAmount > 0.5 ? 2.4 : 1)) % 1;
    this.uniforms.uTime.value += dt;

    // Directions: north = -z (top of the map), east = +x, south = +z, west = -x.
    // The sun rises due east, arcs across the southern sky, and sets due west.
    const ang = (this.time - 0.25) * Math.PI * 2; // 0 at sunrise, PI/2 at noon, PI at sunset
    const tilt = 0.5; // how far south the sun's path leans
    this.sunDir.set(Math.cos(ang), Math.sin(ang) * Math.cos(tilt), Math.sin(ang) * Math.sin(tilt)).normalize();
    const elev = this.sunDir.y / Math.cos(tilt); // keeps the old 0..1 elevation scale for colors
    this.uniforms.uSunDir.value.copy(this.sunDir);
    // the moon is opposite the sun: it rises in the east at sunset
    this.uniforms.uMoonDir.value.copy(this.sunDir).multiplyScalar(-1);

    // pick palette by elevation and morning/evening
    const morning = this.time < 0.5;
    const edge = morning ? PALETTE.dawn : PALETTE.dusk;
    mixPal(this.nightPal || PALETTE.night, edge, smoothstep(-0.22, 0.08, elev), this.current);
    if (!this._tmp) this._tmp = this._clonePal();
    for (const k of Object.keys(this.current)) this._tmp[k].copy(this.current[k]);
    mixPal(this._tmp, PALETTE.day, smoothstep(0.18, 0.55, elev), this.current);

    const c = this.current;
    this.uniforms.uTop.value.copy(c.top);
    this.uniforms.uHorizon.value.copy(c.horizon);
    this.uniforms.uBottom.value.copy(c.bottom);
    this.uniforms.uSunColor.value.copy(c.sun);
    this.nightAmount = 1 - smoothstep(-0.18, 0.08, elev);
    this.uniforms.uStars.value = smoothstep(0.3, 0.9, this.nightAmount);
    this.uniforms.uSunGlow.value = smoothstep(-0.1, 0.05, elev);

    // light: sun by day, moon by night (always from above)
    const lightDir = elev > -0.02 ? this.sunDir : this.uniforms.uMoonDir.value;
    const ld = lightDir.clone();
    if (ld.y < 0.15) ld.y = 0.15;
    ld.normalize();
    this.sun.position.copy(focus).addScaledVector(ld, 120);
    this.sun.target.position.copy(focus);
    const dayI = smoothstep(-0.02, 0.3, elev);
    this.sun.intensity = lerp(0.35, 2.05, dayI); // not so strong that sunny grass turns pale
    this.sun.color.copy(c.sun);
    if (elev < -0.02) this.sun.color.set('#9fb0ff');
    this.hemi.color.copy(c.amb);
    this.hemi.groundColor.copy(c.ground);
    this.hemi.intensity = lerp(0.55, 0.9, dayI);

    if (underwater) {
      this.scene.fog.color.set('#1b86a8').lerp(new THREE.Color('#0d2a55'), this.nightAmount * 0.8);
      this.scene.fog.near = 1;
      this.scene.fog.far = 42;
    } else {
      this.scene.fog.color.copy(c.fog);
      this.scene.fog.near = this.baseFogNear;
      this.scene.fog.far = this.baseFogFar;
    }
  }

  // Warm golden-hour amount (used for grading)
  warmth() {
    const elev = this.sunDir.y;
    return clamp(1 - Math.abs(elev - 0.08) / 0.25, 0, 1);
  }
}
