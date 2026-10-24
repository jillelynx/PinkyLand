// Jacinta and Liev wear snorkels when they swim
import { chromium } from 'playwright-core';
import fs from 'fs';
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1000, height: 620 } });
const errs = []; page.on('pageerror', (e) => errs.push(e.message));
await page.goto(`file://${process.cwd()}/index.html?scene=pinky&arrived=1&slow=100000&avatar=jacinta&time=0.45`);
await page.waitForTimeout(12000);
for (let i = 0; i < 5; i++) { await page.keyboard.press('Escape'); await page.waitForTimeout(300); }
const r = await page.evaluate(() => {
  const L = window.__game.level, P = L.player;
  P.teleport(20, -0.5, 18); P.yaw = 0;
  for (const f of L.followers) f.root.position.set(21.5, -0.5, 17.5);
  for (let i = 0; i < 90; i++) L.update(1 / 30);
  return { swimming: P.swimming, snorkel: P.model.snorkel?.visible, friends: L.followers.map((f) => (f.model.anim.swim ? 'swim' : 'walk') + ':' + !!f.model.snorkel?.visible) };
});
console.log(JSON.stringify(r));
const d = await page.evaluate(() => { const L = window.__game.level, P = L.player, V = P.pos.constructor; const p = P.root.position; L.rig.setOverride(new V(p.x + 0.5, p.y + 0.9, p.z + 2.0), new V(p.x, p.y + 0.4, p.z)); L.rig.overrideBlend = 1; L.rig._lastOverride = L.rig.override; for (let i = 0; i < 4; i++) L.update(1 / 30); return window.__shot(); });
fs.writeFileSync('/tmp/claude-0/shots/snorkel.jpg', Buffer.from(d.split(',')[1], 'base64'));
const back = await page.evaluate(() => { const L = window.__game.level, P = L.player; P.teleport(-30, L.terrain.getHeight(-30, -30) + 0.1, -30); for (let i = 0; i < 60; i++) L.update(1 / 30); return P.model.snorkel?.visible; });
console.log('snorkel on land:', back, '| errors', errs.join(' | ') || 'none');
await browser.close();
