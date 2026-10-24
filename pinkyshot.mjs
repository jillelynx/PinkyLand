import { chromium } from 'playwright-core';
import fs from 'fs';
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 900, height: 620 } });
const errs = []; page.on('pageerror', (e) => errs.push(e.message));
await page.goto(`file://${process.cwd()}/index.html?scene=pinky&arrived=1&quality=high&slow=100000&avatar=${process.argv[2]||'pinky'}&time=0.4`);
await page.waitForTimeout(12000);
for (const [name, yaw, dist, ht] of [['front', Math.PI, 1.5, 0.4], ['angle', Math.PI + 0.7, 2.0, 0.7], ['back', 0, 1.7, 0.5]]) {
  const d = await page.evaluate(([yaw, dist, ht]) => {
    const L = window.__game.level, P = L.player, V = P.pos.constructor;
    L.dayNight.paused = true; L.player.setCape(true);
    const p = P.pos.clone(); const f = P.yaw ?? 0;
    for (let i = 0; i < 4; i++) L.update(1 / 30);
    const m = P.model.root || P.model;
    const ang = (m.rotation?.y ?? 0) + yaw;
    const cam = new V(p.x + Math.sin(ang) * dist, p.y + ht + 0.4, p.z + Math.cos(ang) * dist);
    L.rig.setOverride(cam, p.clone().add(new V(0, 0.45, 0))); L.rig.overrideBlend = 1; L.rig._lastOverride = L.rig.override;
    for (let i = 0; i < 6; i++) L.update(1 / 30);
    return window.__shot();
  }, [yaw, dist, ht]);
  fs.writeFileSync(`/tmp/claude-0/shots/${process.argv[2]||'pinky'}_${name}.jpg`, Buffer.from(d.split(',')[1], 'base64'));
}
console.log('avatar', await page.evaluate(() => window.__game.level.player.avatarKey), errs.join(' | '));
await browser.close();
