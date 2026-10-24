// Pictures of Rainbow Falls and the rocks around Sparkle Pond
import { chromium } from 'playwright-core';
import fs from 'fs';
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1000, height: 620 } });
const errs = []; page.on('pageerror', (e) => errs.push(e.message));
await page.goto(`file://${process.cwd()}/index.html?scene=pinky&arrived=1&quality=high&slow=100000&avatar=jacinta&time=0.35`);
await page.waitForTimeout(12000);
const views = JSON.parse(process.argv[2] || '[["front",[22,6,4],[22,4,36]],["side",[4,8,30],[22,4,36]],["top",[22,22,20],[22,8,40]],["rocks",[10,5,24],[22,1,34]]]');
for (const [name, pos, look] of views) {
  const d = await page.evaluate(([pos, look]) => {
    const L = window.__game.level, P = L.player, V = P.pos.constructor;
    L.dayNight.paused = true;
    P.teleport(-30, L.terrain.getHeight(-30, -30) + 0.1, -30);
    L.rig.setOverride(new V(...pos), new V(...look)); L.rig.overrideBlend = 1; L.rig._lastOverride = L.rig.override;
    for (let i = 0; i < 3; i++) L.update(1 / 30);
    return window.__shot();
  }, [pos, look]);
  fs.writeFileSync(`/tmp/claude-0/shots/falls_${name}.jpg`, Buffer.from(d.split(',')[1], 'base64'));
}
console.log('errors', errs.join(' | ') || 'none');
await browser.close();
