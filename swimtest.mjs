// Swimming checks: the plunge pool joins the pond and is swimmable; swim up, dive, stop at the floor,
// float back up, walk out; boulders are solid; friends swim along; no errors
import { chromium } from 'playwright-core';
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1000, height: 620 } });
const errs = []; page.on('pageerror', (e) => errs.push(e.message)); page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
await page.goto(`file://${process.cwd()}/index.html?scene=pinky&arrived=1&quality=low&slow=100000&avatar=jacinta&time=0.45`);
await page.waitForTimeout(10000);
for (let i = 0; i < 5; i++) { await page.keyboard.press('Escape'); await page.waitForTimeout(300); }
const run = (n, keys = [], yaw) => page.evaluate(([n, keys, yaw]) => {
  const g = window.__game, L = g.level, P = L.player;
  for (let i = 0; i < n; i++) { if (yaw !== null) { P.yaw = yaw; L.rig.yaw = yaw + Math.PI; } g.input.keys = new Set(keys); L.update(1 / 30); g.input.pressed.clear(); }
  return { x: +P.pos.x.toFixed(1), y: +P.pos.y.toFixed(2), z: +P.pos.z.toFixed(1), swim: P.swimming, floor: +L.terrain.getHeight(P.pos.x, P.pos.z).toFixed(2) };
}, [n, keys, yaw ?? null]);
const out = {};
// the plunge pool under Rainbow Falls: deep, and joined to the pond by water all the way
out.pool = await page.evaluate(() => { const L = window.__game.level, T = (x, z) => L.terrain.getHeight(x, z), p = L.fallsPool; let dry = 0; for (let t = 0; t <= 1; t += 0.05) { const z = p.z + (22 - p.z) * t; if (T(p.x, z) > -0.3) dry++; } return { depth: +(-T(p.x, p.z)).toFixed(2), dryStepsToPond: dry }; });
await page.evaluate(() => { const L = window.__game.level, p = L.fallsPool; L.player.teleport(p.x, 0, p.z - 1); });
out.inPool = await run(40);
out.dive = await run(60, ['KeyX']);
out.floorStop = out.dive.y >= out.dive.floor + 0.04;
out.floatUp = await run(120);
out.swimUp = await run(20, ['Space']);
// friends follow into the water
out.friends = await page.evaluate(() => { const L = window.__game.level; for (const f of L.followers) f.root.position.set(L.player.pos.x + 1.2, 0, L.player.pos.z + 1); for (let i = 0; i < 60; i++) L.update(1 / 30); return L.followers.map((f) => f.name + ':' + (f.model.anim.swim ? 'swimming' : 'walking')); });
// swim south across the pond to the shore and walk out
out.walkOut = await run(330, ['KeyW'], Math.PI);
// boulders are solid: walk into one of the mossy rocks by the falls
out.rock = await page.evaluate(() => {
  const L = window.__game.level, P = L.player, g = window.__game, T = (x, z) => L.terrain.getHeight(x, z);
  const res = [];
  for (const c of L.fallRockColliders) {
    const sx = c.x - c.r - 2.0;
    P.teleport(sx, T(sx, c.z) + 0.2, c.z); for (let i = 0; i < 20; i++) L.update(1 / 30);
    let minD = 99, inside = false;
    for (let i = 0; i < 45; i++) { P.yaw = Math.PI / 2; L.rig.yaw = P.yaw + Math.PI; g.input.keys = new Set(['KeyW']); L.update(1 / 30); const d = Math.hypot(P.pos.x - c.x, P.pos.z - c.z); minD = Math.min(minD, d); if (d < c.r * 0.7 && P.pos.y < c.top - 0.3) inside = true; }
    g.input.keys = new Set();
    res.push({ r: +c.r.toFixed(2), closest: +minD.toFixed(2), walkedThrough: inside });
  }
  return res;
});
console.log(JSON.stringify(out, null, 1));
console.log('errors', errs.join(' | ') || 'none');
await browser.close();
