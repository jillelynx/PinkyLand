// Snowdrop Island: load it, look around, sled down the hill, build things, go in the igloo
import { chromium } from 'playwright-core';
import fs from 'fs';
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1000, height: 620 } });
const errs = []; page.on('pageerror', (e) => errs.push(e.message)); page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
await page.goto(`file://${process.cwd()}/index.html?scene=snow&quality=high&slow=100000&avatar=jacinta&time=${process.argv[2] || 0.42}`);
await page.waitForTimeout(14000);
for (let i = 0; i < 6; i++) { await page.keyboard.press('Escape'); await page.waitForTimeout(400); }
console.log('dialogue open?', await page.evaluate(() => window.__game.ui.isBusy()));
const shot = async (name, eye, look) => {
  const d = await page.evaluate(([eye, look]) => {
    const L = window.__game.level, V = L.player.pos.constructor;
    if (window.__game.ui.dialogueActive) window.__game.ui.close?.();
    L.dayNight.paused = true;
    if (eye) { L.rig.setOverride(new V(...eye), new V(...look)); L.rig.overrideBlend = 1; L.rig._lastOverride = L.rig.override; } else L.rig.setOverride(null);
    for (let i = 0; i < (eye ? 4 : 40); i++) L.update(1 / 30);
    return window.__shot();
  }, [eye, look]);
  fs.writeFileSync(`/tmp/claude-0/shots/snow_${name}.jpg`, Buffer.from(d.split(',')[1], 'base64'));
};
const T = (x, z) => page.evaluate(([x, z]) => window.__game.level.terrain.getHeight(x, z), [x, z]);
console.log('level', await page.evaluate(() => window.__game.level.name + ' builds ' + window.__game.level.builds.length));
await shot('arrive', [0, 9, 74], [0, 3, 30]);
await shot('overview', [10, 45, 75], [-5, 0, 0]);
await shot('cold', [-12, 6, 30], [-40, 3, 20]);
await shot('warm', [14, 5, 12], [36, 2, 4]);
await shot('hill', [-8, 14, 0], [-34, 18, -26]);
await shot('igloo_out', [-40, 4, 34], [-52, 2, 30]);
await shot('hotspring', [24, 5, 10], [34, 1.5, 16]);
// go into the big igloo
const inside = await page.evaluate(() => { const L = window.__game.level; L.player.pos.set(-50.5, 2, 30); for (let i = 0; i < 40; i++) L.update(1 / 30); return [L.inIgloo ? 'inside' : 'outside', L.rig.targetDistance]; });
console.log('igloo', inside);
await shot('igloo_in', null, null);
await page.evaluate(() => { const L = window.__game.level; L.player.pos.set(-49.6, 2, 30); L.rig.yaw = Math.PI / 2; });
await shot('igloo_back', null, null);
// sled: take a sled from the Big Sled Hill rack and slide down
const sled = await page.evaluate(() => {
  const L = window.__game.level, inp = window.__game.input;
  L.startSled({ x: -28.5, z: -18.5, yaw: 0.75 });
  const log = [];
  for (let i = 0; i < 150; i++) { inp.keys = new Set(i > 60 && i < 80 ? ['KeyA'] : []); L.update(1 / 30); if (i % 30 === 29) log.push(`${L.riding.x.toFixed(1)},${L.riding.z.toFixed(1)} v=${Math.hypot(L.riding.vx, L.riding.vz).toFixed(1)} y=${L.player.pos.y.toFixed(1)}`); }
  return log;
});
console.log('sled', sled.join(' | '));
await shot('sled', null, null);
await page.evaluate(() => { const L = window.__game.level, inp = window.__game.input; inp.pressed.add('KeyE'); L.update(1 / 30); inp.pressed.clear(); });
// build one of each at the warm spot
const built = await page.evaluate(async () => {
  const L = window.__game.level, ui = window.__game.ui;
  const out = [];
  for (const k of ['snowman', 'pinky', 'igloo']) {
    L.player.pos.set(18, 2, 6); L.player.yaw = k === 'igloo' ? 0.9 : k === 'pinky' ? -0.6 : 0.2;
    const orig = ui.dialogue; ui.dialogue = async () => k;
    await L.buildMenu({ x: 18, z: 2 });
    ui.dialogue = orig;
    for (let i = 0; i < 40; i++) L.update(1 / 30);
    out.push(k + ':' + L.builds.length);
  }
  return out.join(' ');
});
console.log('built', built);
await shot('builds', [24, 5, 14], [18, 1, 4]);
console.log('errors', errs.join(' | ') || 'none');
await browser.close();
