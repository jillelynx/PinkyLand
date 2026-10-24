// Snowdrop Island at night: northern lights over the snow, glowing crystals, igloo light
import { chromium } from 'playwright-core';
import fs from 'fs';
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1000, height: 620 } });
const errs = []; page.on('pageerror', (e) => errs.push(e.message));
await page.goto(`file://${process.cwd()}/index.html?scene=snow&quality=high&slow=100000&avatar=jacinta&time=0.0`);
await page.waitForTimeout(14000);
for (const [n, eye, look] of [['snow_night_warm', [14, 5, 14], [40, 4, -4]], ['snow_night_igloo', [-38, 4, 36], [-52, 4, 22]], ['snow_night_sky', [0, 4, 50], [-20, 30, -40]]]) {
  const d = await page.evaluate(([eye, look]) => {
    const L = window.__game.level, V = L.player.pos.constructor;
    L.dayNight.paused = true; L.dayNight.time = 0.0;
    L.rig.setOverride(new V(...eye), new V(...look)); L.rig.overrideBlend = 1; L.rig._lastOverride = L.rig.override;
    for (let i = 0; i < 4; i++) L.update(1 / 30);
    return window.__shot();
  }, [eye, look]);
  fs.writeFileSync(`/tmp/claude-0/shots/${n}.jpg`, Buffer.from(d.split(',')[1], 'base64'));
}
console.log('errors', errs.join(' | ') || 'none');
await browser.close();
