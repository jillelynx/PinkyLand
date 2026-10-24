// Pictures of each reef animal (from underwater), the reef from the surface, and a check that animals stay in the water
import { chromium } from 'playwright-core';
import fs from 'fs';
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1000, height: 620 } });
const errs = []; page.on('pageerror', (e) => errs.push(e.message)); page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
await page.goto(`file://${process.cwd()}/index.html?scene=pinky&arrived=1&slow=100000&avatar=jacinta&time=0.5`);
await page.waitForTimeout(12000);
for (let i = 0; i < 5; i++) { await page.keyboard.press('Escape'); await page.waitForTimeout(300); }
// run the reef for a while and check nobody leaves the water or sinks into the floor
const check = await page.evaluate(() => {
  const L = window.__game.level, F = L.reefFriends, T = (x, z) => L.terrain.getHeight(x, z);
  L.player.teleport(-30, T(-30, -30) + 0.1, -30);
  let bad = [];
  const objs = () => [['turtle', F.turtle], ['manta', F.manta], ['octopus', F.octo], ...F.jellies.map((j) => ['jelly', j.j]), ...F.horses.map((h) => ['seahorse', h.h]), ...F.clowns.map((c) => ['clownfish', c.fish])];
  for (let i = 0; i < 900; i++) {
    L.update(1 / 30);
    if (i % 30) continue;
    for (const [n, o] of objs()) { const p = o.position; if (p.y > -0.2) bad.push(n + ' above water ' + p.y.toFixed(2)); if (p.y < T(p.x, p.z) - 0.05) bad.push(n + ' in the floor'); }
  }
  return { bad: [...new Set(bad)].slice(0, 8), counts: { jellies: F.jellies.length, clownfish: F.clowns.length, crabs: F.crabs.length, seahorses: F.horses.length } };
});
console.log('in-water check', JSON.stringify(check));
const shoot = async (name, pick, offset, time = 0.5) => {
  const d = await page.evaluate(([pick, offset, time]) => {
    const L = window.__game.level, F = L.reefFriends, V = L.player.pos.constructor;
    L.dayNight.paused = true; L.dayNight.time = time;
    const o = { turtle: F.turtle, manta: F.manta, octo: F.octo, jelly: F.jellies[0].j, clown: F.clowns[0]?.fish, crab: F.crabs[0]?.c, dolphin: F.dolphins[0].d, horse: F.horses[0].h }[pick];
    const at = o.position.clone();
    L.rig.setOverride(at.clone().add(new V(...offset)), at); L.rig.overrideBlend = 1; L.rig._lastOverride = L.rig.override;
    for (let i = 0; i < 3; i++) { L.update(1 / 60); const a = o.position.clone(); L.rig.setOverride(a.clone().add(new V(...offset)), a); }
    return window.__shot();
  }, [pick, offset, time]);
  fs.writeFileSync(`/tmp/claude-0/shots/reef_${name}.jpg`, Buffer.from(d.split(',')[1], 'base64'));
};
await shoot('turtle', 'turtle', [2.2, 0.5, 2.2]);
await shoot('manta', 'manta', [3.5, 1.0, 3.0]);
await shoot('jelly', 'jelly', [1.6, 0.2, 1.6], 0.0);
await shoot('clown', 'clown', [1.2, 0.5, 1.2]);
await shoot('crab', 'crab', [0.9, 0.6, 0.9]);
await shoot('octo', 'octo', [1.4, 0.5, 1.4]);
await shoot('horse', 'horse', [0.9, 0.2, 0.9]);
await shoot('dolphin', 'dolphin', [6, 1.5, 6]);
// reef from the surface (looking down through the water)
const d = await page.evaluate(() => { const L = window.__game.level, V = L.player.pos.constructor; L.dayNight.time = 0.5; L.rig.setOverride(new V(0, 4, 112), new V(0, -2, 122)); L.rig.overrideBlend = 1; L.rig._lastOverride = L.rig.override; for (let i = 0; i < 4; i++) L.update(1 / 30); return window.__shot(); });
fs.writeFileSync('/tmp/claude-0/shots/reef_surface.jpg', Buffer.from(d.split(',')[1], 'base64'));
console.log('errors', errs.join(' | ') || 'none');
await browser.close();
