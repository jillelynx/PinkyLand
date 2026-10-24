// Pictures of the coral reef sea life (day + night) and the glowing pond at night
import { chromium } from 'playwright-core';
import fs from 'fs';
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1100, height: 650 } });
const errs = []; page.on('pageerror', (e) => errs.push(e.message)); page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
await page.goto(`file://${process.cwd()}/index.html?scene=pinky&arrived=1&quality=high&slow=100000&avatar=jacinta&time=0.5`);
await page.waitForTimeout(12000);
const shots = [
  ['reef_day', 0.5, [4, -1.0, 117], [0, -2.6, 132]],
  ['reef_wide', 0.5, [-10, -0.9, 121], [6, -3.2, 138]],
  ['reef_night', 0.0, [4, -1.0, 117], [0, -2.6, 132]],
  ['pond_night', 0.0, [22, 4.5, 2], [22, 0, 22]],
];
for (const [name, time, eye, look] of shots) {
  const d = await page.evaluate(([time, eye, look]) => {
    const L = window.__game.level, V = L.player.pos.constructor;
    L.dayNight.paused = true; L.dayNight.time = time;
    if (time === 0) L.player.pos.set(22, L.terrain.getHeight(22, 5), 5);
    L.rig.setOverride(new V(...eye), new V(...look)); L.rig.overrideBlend = 1; L.rig._lastOverride = L.rig.override;
    for (let i = 0; i < 30; i++) L.update(1 / 30);
    return window.__shot();
  }, [time, eye, look]);
  fs.writeFileSync(`/tmp/claude-0/shots/${name}.jpg`, Buffer.from(d.split(',')[1], 'base64'));
}
for (const [name, time] of [['fish_day', 0.5], ['fish_night', 0.0]]) {
  const d = await page.evaluate((time) => {
    const L = window.__game.level, V = L.player.pos.constructor;
    L.dayNight.paused = true; L.dayNight.time = time;
    const im = L.creatures.list.find((c) => c.journalKey === 'neonfish').object;
    for (let i = 0; i < 20; i++) L.update(1 / 30);
    const m = new im.matrix.constructor(); im.getMatrixAt(3, m); const f = new V().setFromMatrixPosition(m);
    L.rig.setOverride(f.clone().add(new V(2.6, 0.5, -2.4)), f); L.rig.overrideBlend = 1; L.rig._lastOverride = L.rig.override;
    for (let i = 0; i < 3; i++) L.update(1 / 60);
    im.getMatrixAt(3, m); f.setFromMatrixPosition(m);
    L.rig.setOverride(f.clone().add(new V(2.6, 0.5, -2.4)), f); L.update(1 / 60);
    return window.__shot();
  }, time);
  fs.writeFileSync(`/tmp/claude-0/shots/${name}.jpg`, Buffer.from(d.split(',')[1], 'base64'));
}
const info = await page.evaluate(() => window.__game.level.creatures.list.map((c) => c.name).join(','));
console.log(info);
console.log('errors', errs.join(' | ') || 'none');
await browser.close();
