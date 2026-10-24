// Shimmering, crystal-clear water. Shallow water is see-through turquoise,
// deeper water is a richer blue. Sunlight makes sparkles on the surface.
import * as THREE from 'three';
import { sharedUniforms } from './terrain.js';

const vert = /* glsl */ `
  #include <fog_pars_vertex>
  attribute float aDepth;
  uniform float uTime;
  varying float vDepth;
  varying vec3 vWPos;
  void main(){
    vDepth = aDepth;
    vec3 p = position;
    float w = sin(p.x*0.35 + uTime*1.1)*0.05 + cos(p.z*0.42 + uTime*0.9)*0.05 + sin((p.x+p.z)*0.9+uTime*2.0)*0.015;
    p.y += w * smoothstep(0.0, 1.5, aDepth);
    vec4 wp = modelMatrix * vec4(p,1.0);
    vWPos = wp.xyz;
    vec4 mvPosition = viewMatrix * wp;
    gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
  }
`;

const frag = /* glsl */ `
  #include <fog_pars_fragment>
  uniform float uTime; uniform vec3 uSunDir; uniform vec3 uSunColor;
  uniform vec3 uSkyTop; uniform vec3 uSkyHorizon; uniform float uNight;
  uniform vec3 uShallow; uniform vec3 uDeep;
  uniform vec3 uMoonDir; uniform float uStars; uniform float uAurora;
  varying float vDepth; varying vec3 vWPos;

  float hash(vec2 p){ return fract(sin(dot(p, vec2(41.3, 289.1)))*43758.5453); }
  float vnoise(vec2 p){
    vec2 i = floor(p), f = fract(p);
    vec2 u = f*f*(3.0-2.0*f);
    return mix(mix(hash(i), hash(i+vec2(1,0)), u.x), mix(hash(i+vec2(0,1)), hash(i+vec2(1,1)), u.x), u.y);
  }
  float fbm(vec2 p){ float v = 0.0, a = 0.5; for (int i = 0; i < 3; i++){ v += a * vnoise(p); p *= 2.03; a *= 0.5; } return v; }
  // the same northern lights as in the sky, seen in the mirror of the sea
  vec3 auroraAt(vec3 d){
    float h = d.y;
    float az = atan(d.x, -d.z);
    float north = smoothstep(1.9, 0.2, abs(az));
    float wave = sin(az * 3.0 + uTime * 0.25) * 0.08 + sin(az * 7.0 - uTime * 0.4) * 0.04;
    float base = 0.10 + wave;
    float top = base + 0.28 + 0.1 * sin(az * 2.0 + uTime * 0.15);
    float band = smoothstep(base - 0.02, base + 0.04, h) * (1.0 - smoothstep(base + 0.06, top, h));
    float warp = fbm(vec2(az * 3.0 + uTime * 0.05, 1.7)) * 2.0;
    float rays = 0.35 + 0.65 * pow(0.5 + 0.5 * sin(az * 38.0 + warp * 9.0), 2.0);
    float patches = smoothstep(0.3, 0.75, fbm(vec2(az * 1.6 - uTime * 0.04, 4.2)));
    float k = band * rays * (0.4 + patches) * north;
    vec3 ac = mix(vec3(0.15, 1.0, 0.55), vec3(0.95, 0.35, 0.85), smoothstep(base + 0.05, top, h));
    return ac * k * 0.55;
  }
  vec3 waveNormal(vec2 p){
    float t = uTime;
    vec2 g = vec2(0.0);
    g += vec2(cos(p.x*0.35+t*1.1)*0.35, 0.0)*0.05;
    g += vec2(0.0, -sin(p.y*0.42+t*0.9)*0.42)*0.05;
    float e = 0.15;
    vec2 q = p*1.7 + vec2(t*0.4, t*0.3);
    float n0 = vnoise(q), nx = vnoise(q+vec2(e,0.0)), nz = vnoise(q+vec2(0.0,e));
    g += vec2(nx-n0, nz-n0)/e * 0.06;
    vec2 q2 = p*4.3 - vec2(t*0.7, t*0.5);
    float m0 = vnoise(q2), mx = vnoise(q2+vec2(e,0.0)), mz = vnoise(q2+vec2(0.0,e));
    g += vec2(mx-m0, mz-m0)/e * 0.03;
    return normalize(vec3(-g.x, 1.0, -g.y));
  }
  void main(){
    vec3 n = waveNormal(vWPos.xz);
    vec3 viewDir = normalize(cameraPosition - vWPos);
    bool below = cameraPosition.y < vWPos.y;
    if (below) n = -n;
    float fres = pow(1.0 - max(dot(n, viewDir), 0.0), 3.0);
    float depthK = smoothstep(0.0, 5.0, vDepth);
    vec3 base = mix(uShallow, uDeep, depthK);
    base *= mix(1.0, 0.35, uNight);
    vec3 refl = mix(uSkyHorizon, uSkyTop, clamp(reflect(-viewDir, n).y, 0.0, 1.0));
    vec3 col = mix(base, refl, fres * 0.8);

    // sun sparkles
    vec3 r = reflect(-normalize(uSunDir), n);
    float spec = pow(max(dot(r, viewDir), 0.0), 180.0);
    float glint = step(0.82, vnoise(vWPos.xz*6.0 + uTime*1.5)) * pow(max(dot(r, viewDir), 0.0), 25.0);
    col += uSunColor * (spec * 2.2 + glint * 1.4) * (1.0 - uNight*0.6);

    // night: the moon makes a long, glittering path on the water, the northern
    // lights are reflected as wobbly green and pink, and starlight twinkles on the waves
    if (uStars > 0.01 && !below) {
      vec3 rd = reflect(-viewDir, n);
      vec3 md = normalize(uMoonDir);
      vec3 rm = reflect(-md, n);
      float mAlign = max(dot(rm, viewDir), 0.0);
      float moonUp = smoothstep(-0.05, 0.08, md.y);
      float sparkle = step(0.7, vnoise(vWPos.xz * 3.5 + vec2(uTime * 0.9, -uTime * 0.6))) * pow(mAlign, 18.0);
      float sheen = pow(mAlign, 60.0);
      col += vec3(0.85, 0.9, 1.0) * (sparkle * 1.6 + sheen * 0.9) * moonUp * uStars;
      if (rd.y > 0.0 && uAurora > 0.01) {
        float shimmer = 0.75 + 0.25 * sin(vWPos.x * 1.7 + vWPos.z * 1.3 + uTime * 2.0);
        col += auroraAt(rd) * uAurora * uStars * 1.5 * shimmer * (0.5 + fres);
      }
      float tw = step(0.93, vnoise(vWPos.xz * 9.0 + uTime * 0.7)) * smoothstep(0.2, 0.9, rd.y);
      col += vec3(0.8, 0.85, 1.0) * tw * 0.35 * uStars;
    }

    // gentle shore foam
    float shore = 1.0 - smoothstep(0.0, 0.35, vDepth);
    float foamLines = smoothstep(0.55, 0.9, sin(vDepth*18.0 - uTime*2.2)*0.5+0.5) * (1.0 - smoothstep(0.0, 0.8, vDepth));
    col = mix(col, vec3(1.0), (shore*0.35 + foamLines*0.25) * (1.0-uNight*0.5));

    float alpha = mix(0.28, 0.86, depthK);
    alpha = max(alpha, fres*0.9);
    alpha = clamp(alpha + shore*0.2, 0.0, 0.95);
    if (below) { col = mix(uShallow*1.2, refl, 0.4); alpha = 0.55; }
    gl_FragColor = vec4(col, alpha);
    #include <fog_fragment>
  }
`;

export class Water {
  /**
   * @param {object} o
   * @param {number} o.size area covered by detailed water
   * @param {number} o.segments resolution
   * @param {(x:number,z:number)=>number} o.groundHeight ground height for depth
   * @param {object} o.skyUniforms DayNight uniforms
   */
  constructor({ size, segments, groundHeight, skyUniforms, level = 0, center = [0, 0] }) {
    this.level = level;
    this.uniforms = THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {
      uShallow: { value: new THREE.Color('#7ff2e6') },
      uDeep: { value: new THREE.Color('#1c78b8') },
      uNight: { value: 0 },
    }]);
    this.uniforms.uTime = sharedUniforms.uTime;
    this.uniforms.uSunDir = skyUniforms.uSunDir;
    this.uniforms.uSunColor = skyUniforms.uSunColor;
    this.uniforms.uSkyTop = skyUniforms.uTop;
    this.uniforms.uSkyHorizon = skyUniforms.uHorizon;
    this.uniforms.uMoonDir = skyUniforms.uMoonDir || { value: new THREE.Vector3(0, -1, 0) };
    this.uniforms.uStars = skyUniforms.uStars || { value: 0 };
    this.uniforms.uAurora = skyUniforms.uAurora || { value: 0 };

    this.material = new THREE.ShaderMaterial({
      uniforms: this.uniforms, vertexShader: vert, fragmentShader: frag,
      transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: true,
    });

    const geo = new THREE.PlaneGeometry(size, size, segments, segments);
    geo.rotateX(-Math.PI / 2);
    geo.translate(center[0], level, center[1]);
    const pos = geo.attributes.position;
    const depth = new Float32Array(pos.count);
    for (let i = 0; i < pos.count; i++) depth[i] = Math.max(0, level - groundHeight(pos.getX(i), pos.getZ(i)));
    geo.setAttribute('aDepth', new THREE.BufferAttribute(depth, 1));
    this.mesh = new THREE.Mesh(geo, this.material);
    this.mesh.renderOrder = 5;
    this.mesh.name = 'water';

    // Big far-away ocean ring so the world feels endless
    const outer = new THREE.Shape();
    const O = 2400, h = size / 2;
    outer.moveTo(-O, -O); outer.lineTo(O, -O); outer.lineTo(O, O); outer.lineTo(-O, O); outer.lineTo(-O, -O);
    const hole = new THREE.Path();
    hole.moveTo(center[0] - h, center[1] - h); hole.lineTo(center[0] - h, center[1] + h);
    hole.lineTo(center[0] + h, center[1] + h); hole.lineTo(center[0] + h, center[1] - h); hole.lineTo(center[0] - h, center[1] - h);
    outer.holes.push(hole);
    const far = new THREE.ShapeGeometry(outer);
    far.rotateX(Math.PI / 2);
    far.translate(0, level, 0);
    const fd = new Float32Array(far.attributes.position.count).fill(8);
    far.setAttribute('aDepth', new THREE.BufferAttribute(fd, 1));
    this.far = new THREE.Mesh(far, this.material);
    this.far.renderOrder = 4;
  }

  addTo(scene) { scene.add(this.mesh); scene.add(this.far); }
  update(night) { this.uniforms.uNight.value = night; }
}
