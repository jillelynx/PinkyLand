import { chromium } from 'playwright-core';
import fs from 'fs';
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1000, height: 620 } });
const errs = []; page.on('pageerror', (e) => errs.push(e.message + ' ' + (e.stack || '').split('\n')[1]));
page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text().slice(0, 200)); });
await page.goto(`file://${process.cwd()}/index.html?scene=earth&quality=high&slow=100000&time=0.45`);
await page.waitForTimeout(10000);
await page.evaluate(() => window.__game.enterHome());
await page.waitForTimeout(9000);
// [name, camera pos, look at, player pos]
const views = [
  ['bed_corner', [-1.0, 1.6, -1.5], [-5.2, 1.0, -4.2], [-2.4, -2.3]],
  ['cat_wall', [-1.2, 1.5, -2.9], [-5.8, 1.3, -3.0], [-2.6, -3.6]],
  ['desk_wall', [-4.2, 1.5, -2.6], [0.9, 1.2, -2.6], [-1.6, -3.4]],
  ['window', [-3.0, 1.4, -1.6], [-4.6, 1.4, -4.9], [-3.0, -2.2]],
  ['pinky_close', null, null, [-2.6, -2.6]],
];
fs.mkdirSync('/tmp/claude-0/shots', { recursive: true });
for (const [name, pos, look, pl] of views) {
  const d = await page.evaluate(([pos, look, pl]) => {
    const g = window.__game, L = g.level, V = L.player.pos.constructor;
    L.dayNight.paused = true;
    L.player.teleport(pl[0], 0.02, pl[1], Math.PI * 0.8);
    if (pos) { L.rig.setOverride(new V(...pos), new V(...look)); L.rig.overrideBlend = 1; L.rig._lastOverride = L.rig.override; }
    else { L.rig.setOverride(null); L.rig.overrideBlend = 0; L.rig.yaw = Math.PI * 0.8 + Math.PI; L.rig.targetDistance = L.rig.distance = 1.6; L.rig.snap(L.player.pos.clone().add(new V(0, 0.8, 0))); }
    for (let i = 0; i < 8; i++) L.update(1 / 30);
    return window.__shot();
  }, [pos, look, pl]);
  fs.writeFileSync(`/tmp/claude-0/shots/room_${name}.jpg`, Buffer.from(d.split(',')[1], 'base64'));
}
console.log('errors', errs.join(' | '));
await browser.close();
