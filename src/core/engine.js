// The "engine": sets up the 3D drawing surface, lighting effects (bloom glow),
// and handles window resizing and graphics quality.
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';

export const QUALITY = {
  low: { pixelRatio: 1, bloom: false, shadows: false, shadowSize: 1024, grass: 0.35, antialias: false },
  medium: { pixelRatio: 1.5, bloom: true, shadows: true, shadowSize: 1024, grass: 0.7, antialias: true },
  high: { pixelRatio: 2, bloom: true, shadows: true, shadowSize: 2048, grass: 1.0, antialias: true },
};

// Gentle color grade + vignette + underwater tint, applied after bloom.
const GradeShader = {
  uniforms: {
    tDiffuse: { value: null },
    uUnder: { value: 0 },
    uTime: { value: 0 },
    uFade: { value: 0 },
    uFadeColor: { value: new THREE.Color(1, 1, 1) },
    uWarmth: { value: 0 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse; uniform float uUnder; uniform float uTime;
    uniform float uFade; uniform vec3 uFadeColor; uniform float uWarmth;
    varying vec2 vUv;
    void main(){
      vec2 uv = vUv;
      if (uUnder > 0.0) {
        uv.x += sin(uv.y*24.0 + uTime*1.7) * 0.0025 * uUnder;
        uv.y += cos(uv.x*20.0 + uTime*1.3) * 0.0020 * uUnder;
      }
      vec4 c = texture2D(tDiffuse, uv);
      // soft dreamy lift
      c.rgb = mix(c.rgb, c.rgb * vec3(1.03, 0.99, 1.02) + vec3(0.012, 0.004, 0.018), 0.8);
      c.rgb += uWarmth * vec3(0.03, 0.012, -0.01);
      // a little more colour and depth (keeps the pastel look, loses the milky haze)
      float lum = dot(c.rgb, vec3(0.299, 0.587, 0.114));
      c.rgb = mix(vec3(lum), c.rgb, 1.12);
      vec3 sc = clamp(c.rgb, 0.0, 1.0);
      c.rgb = mix(c.rgb, sc*sc*(3.0-2.0*sc), 0.22);
      // underwater: blue-teal tint with light shafts
      if (uUnder > 0.0) {
        float rays = pow(max(0.0, sin(uv.x*18.0 + uv.y*4.0 + uTime*0.6) * sin(uv.x*7.0 - uTime*0.3)), 3.0);
        vec3 tint = mix(c.rgb, c.rgb * vec3(0.55, 0.95, 1.05) + vec3(0.0, 0.05, 0.08), 0.75);
        tint += rays * 0.08 * (1.0 - uv.y * 0.3) * vec3(0.7, 1.0, 1.0);
        c.rgb = mix(c.rgb, tint, uUnder);
      }
      // vignette
      vec2 d = vUv - 0.5;
      c.rgb *= 1.0 - dot(d, d) * 0.55;
      c.rgb = mix(c.rgb, uFadeColor, uFade);
      gl_FragColor = c;
    }
  `,
};

export class Engine {
  constructor(container, qualityName = 'high') {
    this.container = container;
    this.qualityName = qualityName;
    this.q = QUALITY[qualityName] || QUALITY.high;

    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, this.q.pixelRatio));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.94;
    this.renderer.shadowMap.enabled = this.q.shadows;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(this.renderer.domElement);

    this.camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 2500);
    this.scene = null;
    this.composer = null;
    this.grade = null;

    window.addEventListener('resize', () => this.resize());
  }

  setScene(scene) {
    this.scene = scene;
    this.buildComposer();
  }

  buildComposer() {
    if (this.composer) this.composer.dispose?.();
    const size = new THREE.Vector2(window.innerWidth, window.innerHeight);
    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloom = new UnrealBloomPass(size, 0.32, 0.55, 0.92); // only true highlights glow (less milky haze)
    this.bloom.enabled = this.q.bloom;
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());
    this.grade = new ShaderPass(GradeShader);
    this.composer.addPass(this.grade);
    this.composer.setPixelRatio(this.renderer.getPixelRatio());
    this.composer.setSize(window.innerWidth, window.innerHeight);
  }

  setQuality(name) {
    this.qualityName = name;
    this.q = QUALITY[name] || QUALITY.high;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, this.q.pixelRatio));
    this.renderer.shadowMap.enabled = this.q.shadows;
    if (this.bloom) this.bloom.enabled = this.q.bloom;
    if (this.composer) {
      this.composer.setPixelRatio(this.renderer.getPixelRatio());
      this.composer.setSize(window.innerWidth, window.innerHeight);
    }
    // shadows need materials to recompile
    this.scene?.traverse((o) => { if (o.material) o.material.needsUpdate = true; });
  }

  resize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    this.composer?.setSize(w, h);
  }

  render() {
    if (!this.scene) return;
    this.composer.render();
  }
}
