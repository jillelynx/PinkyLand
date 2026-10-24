// Night-sky pictures in Pinky Land (Milky Way, shooting stars, northern lights)
import { chromium } from 'playwright-core';
import fs from 'fs';
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1100, height: 650 } });
const errs = []; page.on('pageerror', (e) => errs.push(e.message));
await page.goto(`file://${process.cwd()}/index.html?scene=pinky&arrived=1&quality=high&slow=100000&avatar=jacinta&time=0.0`);
await page.waitForTimeout(12000);
const views = JSON.parse(process.argv[2] || '[["north",0,0.35],["milky",2.4,0.75],["east",1.4,0.45]]');
for (const [name, yaw, pitch] of views) {
  const d = await page.evaluate(([yaw, pitch]) => {
    const L = window.__game.level, P = L.player, V = P.pos.constructor;
    L.dayNight.paused = true; L.dayNight.time = 0.0;
    const eye = P.pos.clone().add(new V(0, 1.6, 0));
    const look = eye.clone().add(new V(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch)).multiplyScalar(50));
    L.rig.setOverride(eye, look); L.rig.overrideBlend = 1; L.rig._lastOverride = L.rig.override;
    for (let i = 0; i < 3; i++) L.update(1 / 60);
    L.dayNight.uniforms.uTime.value = 10.45; // a shooting star is mid-flight
    return window.__shot();
  }, [yaw, pitch]);
  fs.writeFileSync(`/tmp/claude-0/shots/sky_${name}.jpg`, Buffer.from(d.split(',')[1], 'base64'));
}
console.log('errors', errs.join(' | ') || 'none');
await browser.close();
