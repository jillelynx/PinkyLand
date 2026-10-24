// Moonview Cliff + the Cozy Camp clearing: pictures by night and by day
import { chromium } from 'playwright-core';
import fs from 'fs';
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1000, height: 620 } });
const errs = []; page.on('pageerror', (e) => errs.push(e.message));
await page.goto(`file://${process.cwd()}/index.html?scene=pinky&arrived=1&slow=100000&avatar=jacinta&time=0.8`);
await page.waitForTimeout(12000);
const shot = async (name, time, view) => {
  const d = await page.evaluate(([time, view]) => {
    const L = window.__game.level, P = L.player, V = P.pos.constructor;
    L.dayNight.paused = true; L.dayNight.setTime(time);
    let eye, look;
    if (view === 'cliff') [eye, look] = L.cliffView();
    else { eye = new V(...view[0]); look = new V(...view[1]); }
    P.teleport(eye.x, L.terrain.getHeight(eye.x, eye.z) + 0.1, eye.z);
    L.rig.setOverride(eye, look); L.rig.overrideBlend = 1; L.rig._lastOverride = L.rig.override;
    for (let i = 0; i < 4; i++) L.update(1 / 30);
    return window.__shot();
  }, [time, view]);
  fs.writeFileSync(`/tmp/claude-0/shots/cliff_${name}.jpg`, Buffer.from(d.split(',')[1], 'base64'));
};
const info = await page.evaluate(() => { const L = window.__game.level; const [e] = L.cliffView(); return { eye: [e.x, e.y, e.z].map((v) => +v.toFixed(1)) }; });
console.log(info);
await shot('night', 0.8, 'cliff');
await shot('late', 0.9, 'cliff');
const e = info.eye;
await shot('outside', 0.42, [[e[0] + 30, 8, e[2] + 30], [e[0] + 4, 8, e[2] - 2]]);
await shot('camp_up', 0.92, [[-20, 3.6, -3], [-30, 30, -36]]);
await shot('camp_day', 0.42, [[-20, 6, 14], [-20, 2, -10]]);
console.log('errors', errs.join(' | ') || 'none');
await browser.close();
