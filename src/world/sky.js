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

  float hash(vec3 p){ p = fract(p*0.3183099+0.1); p *= 17.0; return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }

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
      vec3 p = d * 220.0;
      vec3 cell = floor(p);
      float r = hash(cell);
      if (r > 0.985) {
        vec3 center = cell + 0.5 + (vec3(hash(cell+1.3), hash(cell+2.7), hash(cell+5.1)) - 0.5) * 0.6;
        float dist = length(p - center);
        float twinkle = 0.6 + 0.4 * sin(uTime * (1.5 + r * 6.0) + r * 40.0);
        float star = smoothstep(0.35, 0.0, dist) * twinkle;
        vec3 sc = mix(vec3(1.0,0.85,0.9), vec3(0.8,0.9,1.0), hash(cell+9.0));
        col += sc * star * uStars * smoothstep(-0.05, 0.25, h) * 1.6;
      }
      // soft milky band
      float band = exp(-pow(dot(d, normalize(vec3(0.3, 0.5, 0.8))) * 3.0, 2.0));
      col += vec3(0.25, 0.2, 0.4) * band * 0.18 * uStars * smoothstep(0.0, 0.4, h);
    }
    gl_FragColor = vec4(col, 1.0);
  }
`;

// Color keyframes: night, dawn, day, dusk
const C = (h) => new THREE.Color(h);
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
  isNight() { return this.nightAmount > 0.55; }
  isChilly() { return this.nightAmount > 0.35; }

  setTime(t) { this.time = ((t % 1) + 1) % 1; }

  update(dt, focus, underwater = false) {
    if (!this.paused) this.time = (this.time + dt / this.dayLength) % 1;
    this.uniforms.uTime.value += dt;

    // Sun travels in a tilted circle. elevation = sin(angle)
    const ang = (this.time - 0.25) * Math.PI * 2; // 0 at sunrise
    const elev = Math.sin(ang);
    this.sunDir.set(Math.cos(ang) * 0.85, elev, 0.45).normalize();
    this.uniforms.uSunDir.value.copy(this.sunDir);
    this.uniforms.uMoonDir.value.set(-this.sunDir.x, -this.sunDir.y, -0.35).normalize();

    // pick palette by elevation and morning/evening
    const morning = this.time < 0.5;
    const edge = morning ? PALETTE.dawn : PALETTE.dusk;
    mixPal(PALETTE.night, edge, smoothstep(-0.22, 0.08, elev), this.current);
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
    this.sun.intensity = lerp(0.35, 2.4, dayI);
    this.sun.color.copy(c.sun);
    if (elev < -0.02) this.sun.color.set('#9fb0ff');
    this.hemi.color.copy(c.amb);
    this.hemi.groundColor.copy(c.ground);
    this.hemi.intensity = lerp(0.55, 1.0, dayI);

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
