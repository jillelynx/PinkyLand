// Ground made from a grid of heights. Supports soft vertex colors and
// shimmering "caustic" light patterns on anything under the water.
import * as THREE from 'three';

export const sharedUniforms = {
  uTime: { value: 0 },
  uWaterLevel: { value: 0 },
  uWind: { value: 1 },
  uNight: { value: 0 },
};

// Adds wobbly underwater light patterns (caustics) to a standard material.
// The dancing net of light on the sea floor (sunlight focused by the waves).
export const CAUSTIC_GLSL = `
  float causticLine(vec2 p, float t) {
    vec2 i = p; float c = 1.0, inten = 0.005;
    for (int n = 0; n < 4; n++) {
      float tt = t * (1.0 - (3.5 / float(n + 1)));
      i = p + vec2(cos(tt - i.x) + sin(tt + i.y), sin(tt - i.y) + cos(tt + i.x));
      c += 1.0 / length(vec2(p.x / (sin(i.x + tt) / inten), p.y / (cos(i.y + tt) / inten)));
    }
    c /= 4.0; c = 1.17 - pow(c, 1.4);
    return clamp(pow(abs(c), 8.0), 0.0, 1.0);
  }`;

// Add the light net (and a blue-green underwater tint) to any standard material, e.g. rocks,
// corals and sea animals. Keeps whatever onBeforeCompile the material already had.
export function addUnderwaterLight(material, key) {
  const prev = material.onBeforeCompile;
  material.onBeforeCompile = (shader, r) => {
    prev?.call(material, shader, r);
    shader.uniforms.uTime = sharedUniforms.uTime;
    shader.uniforms.uWaterLevel = sharedUniforms.uWaterLevel;
    shader.uniforms.uUwNight = sharedUniforms.uNight;
    if (!shader.vertexShader.includes('varying vec3 vUwPos')) shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vUwPos;')
      .replace('#include <worldpos_vertex>', `#include <worldpos_vertex>
        #ifdef USE_INSTANCING
          vUwPos = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz;
        #else
          vUwPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
        #endif`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
        varying vec3 vUwPos; uniform float uTime; uniform float uWaterLevel; uniform float uUwNight;
        ${CAUSTIC_GLSL}`)
      .replace('#include <opaque_fragment>', `
        float uw = smoothstep(uWaterLevel + 0.05, uWaterLevel - 0.35, vUwPos.y);
        float dpt = clamp((uWaterLevel - vUwPos.y) / 7.0, 0.0, 1.0);
        outgoingLight += causticLine(vUwPos.xz * 0.55, uTime * 0.5) * uw * (1.0 - dpt * 0.75) * (1.0 - uUwNight * 0.8)
                       * vec3(0.6, 0.9, 0.95) * 0.35 * (0.4 + 0.6 * outgoingLight);
        outgoingLight = mix(outgoingLight, outgoingLight * vec3(0.55, 0.85, 0.95), uw * (0.1 + dpt * 0.4));
        #include <opaque_fragment>`);
  };
  const prevKey = material.customProgramCacheKey?.bind(material);
  material.customProgramCacheKey = () => (prevKey ? prevKey() : '') + '|uw-' + key;
  return material;
}

export function addCaustics(material) {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = sharedUniforms.uTime;
    shader.uniforms.uWaterLevel = sharedUniforms.uWaterLevel;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWPos; varying vec3 vWNrm;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWPos = (modelMatrix * vec4(transformed,1.0)).xyz; vWNrm = normalize(mat3(modelMatrix) * objectNormal);');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
        varying vec3 vWPos; varying vec3 vWNrm; uniform float uTime; uniform float uWaterLevel;
        float cHash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
        float tNoise(vec2 p){ vec2 i = floor(p), f = fract(p); vec2 u = f*f*(3.0-2.0*f);
          return mix(mix(cHash(i), cHash(i+vec2(1,0)), u.x), mix(cHash(i+vec2(0,1)), cHash(i+vec2(1,1)), u.x), u.y); }
        ${CAUSTIC_GLSL}
        float caustic(vec2 p){ return causticLine(p, uTime * 0.5); }`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        // gentle mottling so big areas of ground don't look like flat paint
        float m1 = tNoise(vWPos.xz*0.31), m2 = tNoise(vWPos.xz*1.3 + 7.0), m3 = tNoise(vWPos.xz*5.0);
        diffuseColor.rgb *= 0.88 + 0.16*m1 + 0.08*m2 + 0.05*m3;
        // steep ground becomes layered stone (cliffs, pond walls)
        float steep = 1.0 - smoothstep(0.5, 0.78, vWNrm.y);
        if (steep > 0.001 && vWPos.y > uWaterLevel - 1.0) {
          float strata = sin(vWPos.y*3.4 + tNoise(vWPos.xz*0.5)*3.0) * 0.5 + 0.5;
          vec3 rockC = mix(vec3(0.27, 0.24, 0.32), vec3(0.47, 0.41, 0.5), strata) * (0.82 + 0.3*m2 + 0.12*m3);
          diffuseColor.rgb = mix(diffuseColor.rgb, rockC, steep * 0.9);
        }
        float depthBelow = uWaterLevel - vWPos.y;
        if (depthBelow > 0.0) {
          float k = caustic(vWPos.xz*0.55) * 1.6 + caustic(vWPos.xz*1.1+3.0)*0.6;
          float fade = smoothstep(0.0, 0.6, depthBelow) * (1.0 - smoothstep(4.0, 16.0, depthBelow));
          totalEmissiveRadiance += vec3(0.55, 0.85, 0.9) * k * fade * 0.16;
          diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb*vec3(0.58,0.84,0.92), smoothstep(0.0, 5.0, depthBelow)); // sand looks blue-green under the water
        }`);
  };
  material.customProgramCacheKey = () => 'caustics2';
  return material;
}

export class Terrain {
  /**
   * @param {object} o
   * @param {number} o.size world width/depth
   * @param {number} o.segments grid resolution
   * @param {(x:number,z:number)=>number} o.height
   * @param {(x:number,z:number,h:number,out:THREE.Color)=>void} o.color
   */
  constructor({ size, segments, height, color }) {
    this.size = size;
    this.segments = segments;
    this.half = size / 2;
    this.step = size / segments;
    const n = segments + 1;
    this.heights = new Float32Array(n * n);
    for (let j = 0; j < n; j++) {
      for (let i = 0; i < n; i++) {
        const x = -this.half + i * this.step;
        const z = -this.half + j * this.step;
        this.heights[j * n + i] = height(x, z);
      }
    }
    const geo = new THREE.PlaneGeometry(size, size, segments, segments);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position;
    const colors = new Float32Array(pos.count * 3);
    const col = new THREE.Color();
    for (let k = 0; k < pos.count; k++) {
      const x = pos.getX(k), z = pos.getZ(k);
      const i = Math.round((x + this.half) / this.step);
      const j = Math.round((z + this.half) / this.step);
      const h = this.heights[j * n + i];
      pos.setY(k, h);
      color(x, z, h, col);
      colors[k * 3] = col.r; colors[k * 3 + 1] = col.g; colors[k * 3 + 2] = col.b;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.computeVertexNormals();
    const mat = addCaustics(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0 }));
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.receiveShadow = true;
    this.mesh.name = 'terrain';
  }

  // Height at any point (smoothly blended between grid points)
  getHeight(x, z) {
    const n = this.segments + 1;
    const fx = (x + this.half) / this.step;
    const fz = (z + this.half) / this.step;
    if (fx < 0 || fz < 0 || fx >= this.segments || fz >= this.segments) return -30;
    const i = Math.floor(fx), j = Math.floor(fz);
    const tx = fx - i, tz = fz - j;
    const h00 = this.heights[j * n + i];
    const h10 = this.heights[j * n + i + 1];
    const h01 = this.heights[(j + 1) * n + i];
    const h11 = this.heights[(j + 1) * n + i + 1];
    // match the triangle split used by PlaneGeometry
    if (tx + tz <= 1) return h00 + (h10 - h00) * tx + (h01 - h00) * tz;
    return h11 + (h01 - h11) * (1 - tx) + (h10 - h11) * (1 - tz);
  }

  getNormal(x, z, out = new THREE.Vector3()) {
    const e = 0.5;
    const hl = this.getHeight(x - e, z), hr = this.getHeight(x + e, z);
    const hd = this.getHeight(x, z - e), hu = this.getHeight(x, z + e);
    return out.set(hl - hr, 2 * e, hd - hu).normalize();
  }
}
