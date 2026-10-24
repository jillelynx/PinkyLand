// Snowdrop Island: meet Frost, ride him, then take the ferry home and back
import { chromium } from 'playwright-core';
import fs from 'fs';
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1000, height: 620 } });
const errs = []; page.on('pageerror', (e) => errs.push(e.message)); page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
await page.goto(`file://${process.cwd()}/index.html?scene=snow&quality=high&slow=100000&avatar=jacinta&time=0.42`);
await page.waitForTimeout(14000);
for (let i = 0; i < 6; i++) { await page.keyboard.press('Escape'); await page.waitForTimeout(300); }
const save = (n, d) => fs.writeFileSync(`/tmp/claude-0/shots/${n}.jpg`, Buffer.from(d.split(',')[1], 'base64'));
// Frost at home
save('frost_home', await page.evaluate(() => {
  const L = window.__game.level, V = L.player.pos.constructor, f = L.frost;
  L.dayNight.paused = true;
  L.player.pos.set(f.pos.x + 5, L.terrain.getHeight(f.pos.x + 5, f.pos.z + 3), f.pos.z + 3);
  for (let i = 0; i < 10; i++) L.update(1 / 30);
  L.rig.setOverride(f.pos.clone().add(new V(5, 3, 5)), f.pos.clone().add(new V(0, 1.2, 0))); L.rig.overrideBlend = 1; L.rig._lastOverride = L.rig.override;
  L.update(1 / 30);
  return window.__shot();
}));
// meet him (pretend the dialogue answered "ride")
const r = await page.evaluate(async () => {
  const L = window.__game.level, ui = window.__game.ui, inp = window.__game.input;
  L.rig.setOverride(null);
  const it = L.interactables.find((i) => typeof i.label === 'function' && i.label().includes('Frost'));
  const orig = ui.dialogue; ui.dialogue = async () => 'ride';
  await it.action(); ui.dialogue = orig;
  const out = ['met=' + L.P.met.includes('dragon-frost'), 'riding=' + !!L.riding, 'journal=' + window.__game.state.journal.includes('dragonquest')];
  for (let i = 0; i < 120; i++) { inp.keys = new Set(i < 60 ? ['KeyW', 'Space'] : ['KeyW', 'KeyD']); L.update(1 / 30); }
  const p = L.player.pos; out.push(`pos ${p.x.toFixed(1)} ${p.y.toFixed(1)} ${p.z.toFixed(1)}`);
  return out.join(' ');
});
console.log('frost', r);
save('frost_ride', await page.evaluate(() => window.__shot()));
await page.evaluate(() => { const L = window.__game.level, inp = window.__game.input; inp.keys = new Set(); inp.pressed.add('KeyE'); L.update(1 / 30); inp.pressed.clear(); });
// ferry home
await page.evaluate(() => window.__game.leaveSnowIsland());
await page.waitForTimeout(16000);
for (let i = 0; i < 6; i++) { await page.keyboard.press('Escape'); await page.waitForTimeout(300); }
const home = await page.evaluate(() => { const L = window.__game.level; const p = L.player.pos; return `${L.name} at ${p.x.toFixed(1)},${p.y.toFixed(1)},${p.z.toFixed(1)} dock ${JSON.stringify(L.dockSpawn)} counter ${document.querySelector('.counter-pill, .counter')?.textContent || ''}`; });
console.log('home', home);
save('pinky_dock', await page.evaluate(() => {
  const L = window.__game.level, V = L.player.pos.constructor;
  L.dayNight.paused = true;
  const f = L.ferryPos; L.rig.setOverride(f.clone().add(new V(-8, 6, 10)), f.clone()); L.rig.overrideBlend = 1; L.rig._lastOverride = L.rig.override;
  for (let i = 0; i < 4; i++) L.update(1 / 30);
  return window.__shot();
}));
// and back to the snow
await page.evaluate(() => { window.__game.level.rig.setOverride(null); window.__game.goToSnowIsland(); });
await page.waitForTimeout(16000);
console.log('back', await page.evaluate(() => window.__game.level.name + ' builds ' + window.__game.level.builds.length + ' visited ' + window.__game.state.snow.visited));
console.log('errors', errs.join(' | ') || 'none');
await browser.close();
