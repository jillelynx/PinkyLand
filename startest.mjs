// The reef Dream Star can be reached: swim to it from the beach and pick it up
import { chromium } from 'playwright-core';
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 900, height: 560 } });
const errs = []; page.on('pageerror', (e) => errs.push(e.message));
await page.goto(`file://${process.cwd()}/index.html?scene=pinky&arrived=1&quality=low&slow=100000&avatar=jacinta&time=0.45`);
await page.waitForTimeout(10000);
for (let i = 0; i < 5; i++) { await page.keyboard.press('Escape'); await page.waitForTimeout(300); }
const r = await page.evaluate(() => {
  const g = window.__game, L = g.level, P = L.player;
  const c = L.collectibles.find((c) => c.id === 'pl-star-7');
  const s = c.obj.position.clone();
  P.teleport(s.x, 0, s.z - 14); // start in the shallows, north of the star
  let got = false, maxD = 0;
  for (let i = 0; i < 400 && !got; i++) {
    const dx = s.x - P.pos.x, dz = s.z - P.pos.z;
    P.yaw = Math.atan2(dx, dz); L.rig.yaw = P.yaw + Math.PI;
    const keys = ['KeyW']; if (P.pos.y > s.y - 0.3) keys.push('KeyX'); else if (P.pos.y < s.y - 0.9) keys.push('Space');
    g.input.keys = new Set(keys); L.update(1 / 30); g.input.pressed.clear();
    got = c.taken; maxD = Math.max(maxD, Math.hypot(P.pos.x, P.pos.z));
  }
  return { star: [s.x.toFixed(1), s.y.toFixed(1), s.z.toFixed(1)], distFromIslandCenter: Math.hypot(s.x, s.z).toFixed(1), collected: got };
});
console.log(JSON.stringify(r), '| errors', errs.join(' | ') || 'none');
await browser.close();
