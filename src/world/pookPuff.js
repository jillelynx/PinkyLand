// Pooking Power! Pinky's silly little toot that gives him an extra boost in the air.
// Makes a soft cartoon puff cloud and a floating "POOK!" word in any 3D scene.
import * as THREE from 'three';

let puffTex = null, wordTex = null;
function puffTexture() {
  if (puffTex) return puffTex;
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d');
  // a fluffy cartoon cloud blob with a soft outline
  const blob = (x, y, r, col) => { g.fillStyle = col; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill(); };
  for (const [x, y, r] of [[32, 36, 18], [20, 38, 12], [44, 38, 12], [26, 26, 12], [40, 26, 11]]) blob(x, y, r + 2, 'rgba(150,170,110,0.55)');
  for (const [x, y, r] of [[32, 36, 18], [20, 38, 12], [44, 38, 12], [26, 26, 12], [40, 26, 11]]) blob(x, y, r, '#eef7d2');
  blob(27, 27, 7, '#ffffff');
  puffTex = new THREE.CanvasTexture(c); puffTex.colorSpace = THREE.SRGBColorSpace;
  return puffTex;
}
function wordTexture() {
  if (wordTex) return wordTex;
  const c = document.createElement('canvas'); c.width = 256; c.height = 128;
  const g = c.getContext('2d');
  g.font = 'bold 72px "Chalkboard SE", "Marker Felt", "Comic Sans MS", sans-serif';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.lineWidth = 12; g.strokeStyle = '#ffffff'; g.strokeText('POOK!', 128, 66);
  g.fillStyle = '#9b6bd6'; g.fillText('POOK!', 128, 66);
  wordTex = new THREE.CanvasTexture(c); wordTex.colorSpace = THREE.SRGBColorSpace;
  return wordTex;
}

export class PookPuffs {
  constructor(scene) {
    this.scene = scene;
    this.items = [];
  }

  /** pos: where the puff starts (just below/behind Pinky); size: 1 = Pinky Land size */
  emit(pos, size = 1, dir = new THREE.Vector3(0, -1, 0)) {
    for (let i = 0; i < 7; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: puffTexture(), transparent: true, depthWrite: false }));
      s.position.copy(pos).add(new THREE.Vector3((Math.random() - 0.5) * 0.3 * size, (Math.random() - 0.5) * 0.2 * size, (Math.random() - 0.5) * 0.3 * size));
      const v = dir.clone().multiplyScalar(0.9 + Math.random() * 0.6).add(new THREE.Vector3((Math.random() - 0.5) * 1.4, (Math.random() - 0.3) * 0.6, (Math.random() - 0.5) * 1.4)).multiplyScalar(size);
      s.scale.setScalar(0.25 * size);
      this.scene.add(s);
      this.items.push({ s, v, t: 0, life: 0.9 + Math.random() * 0.5, grow: (0.7 + Math.random() * 0.5) * size, base: 0.25 * size });
    }
    const w = new THREE.Sprite(new THREE.SpriteMaterial({ map: wordTexture(), transparent: true, depthWrite: false }));
    w.position.copy(pos).add(new THREE.Vector3(0.5 * size, 0.2 * size, 0));
    w.scale.set(1.1 * size, 0.55 * size, 1);
    this.scene.add(w);
    this.items.push({ s: w, v: new THREE.Vector3(0.25, 1.1, 0).multiplyScalar(size), t: 0, life: 1.1, word: true, base: 1.1 * size });
  }

  update(dt) {
    for (const it of this.items) {
      it.t += dt;
      const k = it.t / it.life;
      it.s.position.addScaledVector(it.v, dt);
      it.v.multiplyScalar(Math.pow(0.15, dt)); // puffs slow down and hang in the air
      if (it.word) {
        const pop = Math.min(1, it.t * 8);
        it.s.scale.set(it.base * pop, it.base * 0.5 * pop, 1);
        it.s.material.rotation = Math.sin(it.t * 10) * 0.08;
      } else {
        it.s.scale.setScalar(it.base + it.grow * Math.sqrt(k));
      }
      it.s.material.opacity = Math.max(0, 1 - k * k);
    }
    this.items = this.items.filter((it) => {
      if (it.t < it.life) return true;
      this.scene.remove(it.s); it.s.material.dispose();
      return false;
    });
  }
}
