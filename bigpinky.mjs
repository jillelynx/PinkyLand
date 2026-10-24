// Big Pinky: wanders a little, lies down belly-up, and you can bounce on his tummy
import { chromium } from 'playwright-core';
import fs from 'fs';
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1000, height: 620 } });
const errs = []; page.on('pageerror', (e) => errs.push(e.message + ' ' + (e.stack || '').split('\n')[1]));
await page.goto(`file://${process.cwd()}/index.html?scene=pinky&arrived=1&quality=high&slow=100000&avatar=jacinta&time=0.35`);
await page.waitForTimeout(12000);
const r = await page.evaluate(() => {
  const L = window.__game.level, P = L.player, gp = L.grandpa, S = L.gpState, V = P.pos.constructor, out = [];
  L.dayNight.paused = true;
  const home = gp.root.position.clone();
  P.teleport(home.x + 8, L.terrain.getHeight(home.x + 8, home.z) + 0.1, home.z);
  // 1) let him wander for 40 seconds
  let maxD = 0, moved = 0, last = home.clone(), modes = new Set();
  for (let i = 0; i < 1200; i++) { L.update(1 / 30); maxD = Math.max(maxD, gp.root.position.distanceTo(home)); moved += gp.root.position.distanceTo(last); last.copy(gp.root.position); modes.add(S.mode); }
  out.push(`wandered: moved ${moved.toFixed(1)}m in total, never more than ${maxD.toFixed(1)}m from his spot, did: ${[...modes].join(', ')}`);
  // 2) make him lie down
  S.mode = 'lie'; S.t = 30;
  for (let i = 0; i < 90; i++) L.update(1 / 30);
  out.push(`lying down: lie=${S.lie.toFixed(2)}, tummy height ${(L.gpBounce.top - L.terrain.getHeight(gp.root.position.x, gp.root.position.z)).toFixed(2)}m (standing it is ${(0.9 * 4.2).toFixed(2)}m)`);
  // 3) drop onto his tummy
  P.teleport(L.gpBounce.x, L.gpBounce.top + 3, L.gpBounce.z);
  let maxVy = 0, peak = 0;
  for (let i = 0; i < 90; i++) { L.update(1 / 30); maxVy = Math.max(maxVy, P.vel.y); peak = Math.max(peak, P.pos.y); }
  out.push(`bounced on his tummy: launched up at ${maxVy.toFixed(1)} m/s, flew to ${(peak - L.gpBounce.top).toFixed(1)}m above it`);
  // picture of him napping
  const c = new V(L.gpBounce.x, 0, L.gpBounce.z);
  P.teleport(c.x + 6, L.terrain.getHeight(c.x + 6, c.z + 4) + 0.1, c.z + 4);
  L.rig.setOverride(new V(c.x + 7, L.gpBounce.top + 3.5, c.z + 6), new V(c.x, L.gpBounce.top - 0.5, c.z)); L.rig.overrideBlend = 1; L.rig._lastOverride = L.rig.override;
  for (let i = 0; i < 3; i++) L.update(1 / 30);
  return { out, pic: window.__shot() };
});
console.log(r.out.join('\n'));
fs.writeFileSync('/tmp/claude-0/shots/bigpinky_nap.jpg', Buffer.from(r.pic.split(',')[1], 'base64'));
console.log('errors:', errs.join(' | ') || 'none');
await browser.close();
