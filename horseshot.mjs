// Side and top views of the dragon-winged horses (checks the wings point the right way)
import { chromium } from 'playwright-core';
import fs from 'fs';
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 900, height: 560 } });
const errs = []; page.on('pageerror', (e) => errs.push(e.message));
await page.goto(`file://${process.cwd()}/index.html?scene=pinky&arrived=1&quality=high&slow=100000&avatar=jacinta&time=0.45`);
await page.waitForTimeout(12000);
for (const [name, key, idx, off] of [['horse_side', 'dragonhorse', 0, [5, 0.5, 0]], ['horse_top', 'dragonhorse', 0, [0.01, 6, 0]], ['horse_front', 'dragonhorse', 0, [0, 1, 6]], ['horse_ground', 'horse', 0, [4, 1, 2]]]) {
  const d = await page.evaluate(([key, idx, off]) => {
    const L = window.__game.level, V = L.player.pos.constructor;
    L.dayNight.paused = true;
    const c = L.creatures.list.filter((c) => c.journalKey === key)[idx];
    for (let i = 0; i < 5; i++) L.update(1 / 30);
    const h = c.object; const p = h.position.clone().add(new V(0, 1.2, 0));
    const o = new V(...off).applyAxisAngle(new V(0, 1, 0), h.rotation.y);
    L.rig.setOverride(p.clone().add(o), p); L.rig.overrideBlend = 1; L.rig._lastOverride = L.rig.override;
    for (let i = 0; i < 2; i++) { L.update(1 / 60); }
    const p2 = h.position.clone().add(new V(0, 1.2, 0)); L.rig.setOverride(p2.clone().add(new V(...off).applyAxisAngle(new V(0, 1, 0), h.rotation.y)), p2); L.update(0.001);
    return window.__shot();
  }, [key, idx, off]);
  fs.writeFileSync(`/tmp/claude-0/shots/${name}.jpg`, Buffer.from(d.split(',')[1], 'base64'));
}
console.log('errors', errs.join(' | ') || 'none');
await browser.close();
