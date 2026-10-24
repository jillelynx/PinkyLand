import { chromium } from 'playwright-core';
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 400, height: 260 } });
const errs = []; page.on('pageerror', (e) => errs.push(e.message + ' ' + (e.stack || '').split('\n')[1]));
await page.goto(`file://${process.cwd()}/index.html?scene=earth&quality=low&slow=100000`);
await page.waitForTimeout(10000);
const r1 = await page.evaluate(async () => {
  const g = window.__game, L = g.level;
  const it = L.interactables.find((i) => (typeof i.label === 'function' ? i.label() : i.label).startsWith('Go inside'));
  return 'door prompt on Earth: ' + !!it;
});
await page.evaluate(() => window.__game.enterHome());
await page.waitForTimeout(9000);
const r = await page.evaluate(() => {
  const g = window.__game, L = g.level, P = L.player, inp = g.input, out = [];
  out.push('level after door: ' + L.name + ', spawn ' + P.pos.x.toFixed(1) + ',' + P.pos.z.toFixed(1));
  const walkTo = (tx, tz, maxF = 600) => {
    for (let i = 0; i < maxF; i++) {
      const dx = tx - P.pos.x, dz = tz - P.pos.z, d = Math.hypot(dx, dz); if (d < 0.25) return true;
      L.rig.yaw = Math.atan2(-dx, -dz); inp.keys.clear(); inp.keys.add('KeyW'); P.update(1 / 30); L.rig.update(1 / 30, P.pos.clone().setY(P.pos.y + 1), {});
      if (!L.rig.override) { const c = L.rig.camera.position; if (c.x < -6 || c.x > 6 || c.z < -5 || c.z > 5 || c.y > 2.7) out.push('  camera left the house at ' + c.x.toFixed(1) + ',' + c.y.toFixed(1) + ',' + c.z.toFixed(1)); }
    }
    inp.keys.clear(); return false;
  };
  const route = (name, pts) => { P.teleport(-0.6, 0.02, 4.0); let ok = true; for (const [x, z] of pts) ok = walkTo(x, z) && ok; out.push(`walk to the ${name}: ${ok ? 'made it' : 'blocked at ' + P.pos.x.toFixed(1) + ',' + P.pos.z.toFixed(1)}`); };
  route('bedroom', [[-0.6, 0.0], [-0.6, -2.0], [-2.6, -3.0]]);
  route('kitchen', [[0.5, 2.0], [3.0, 1.0], [4.4, 1.0]]);
  route('bathroom', [[0.5, 2.0], [2.2, 0.2], [2.2, -2.0], [3.6, -3.0]]);
  // walls hold: walk from the living room straight north into the wall (away from the door)
  P.teleport(-4.5, 0.02, 0.3); walkTo(-4.5, -3, 120);
  out.push('walk into the living-room wall: stopped at z=' + P.pos.z.toFixed(2) + ' (wall at -1)');
  P.teleport(-2, 0.02, 3.5); walkTo(-2, 8, 120);
  out.push('walk into the front wall: stopped at z=' + P.pos.z.toFixed(2) + ' (wall at 5)');
  // bounce on the bed
  P.teleport(-4.5, 2.0, -4.32); let maxY = 0, bounced = false;
  for (let i = 0; i < 90; i++) { P.update(1 / 30); if (P.vel.y > 3) bounced = true; maxY = Math.max(maxY, P.pos.y); }
  out.push('drop onto the bed: bounced=' + bounced);
  // interactions near each spot
  const labels = []; for (const it of L.interactables) labels.push(typeof it.label === 'function' ? it.label() : it.label);
  out.push('things to do: ' + labels.join(' | '));
  for (const it of L.interactables) { const l = typeof it.label === 'function' ? it.label() : it.label; if (!/outside/.test(l)) try { it.action(); g.ui.close?.(); g.ui.dialogueActive && g.ui.skipAll?.(); } catch (e) { out.push('  error in ' + l + ': ' + e.message); } }
  return out;
});
await page.waitForTimeout(1500);
await page.evaluate(() => { const L = window.__game.level; L.interactables.find((i) => /outside/.test(typeof i.label === 'function' ? i.label() : i.label)).action(); });
await page.waitForTimeout(9000);
const back = await page.evaluate(() => { const L = window.__game.level; return 'after Go outside: ' + L.name + ' at ' + L.player.pos.x.toFixed(1) + ',' + L.player.pos.z.toFixed(1) + ', chapter saved as ' + window.__game.state.chapter; });
console.log([r1, ...r, back].join('\n'), '\nerrors:', errs.join(' | ') || 'none');
await browser.close();
