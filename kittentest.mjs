// Lost kitten kindness: find Peaches in the park, carry her, give her back to her mama Clementine
import { chromium } from 'playwright-core';
import fs from 'fs';
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1000, height: 620 } });
const errs = []; page.on('pageerror', (e) => errs.push(e.message));
await page.goto(`file://${process.cwd()}/index.html?scene=earth&slow=100000&avatar=jacintaPack&time=0.4`);
await page.waitForTimeout(12000);
const shot = async (name, eye, look) => {
  const d = await page.evaluate(([eye, look]) => {
    const L = window.__game.level, V = L.player.pos.constructor;
    L.dayNight.paused = true;
    if (eye) { L.rig.setOverride(new V(...eye), new V(...look)); L.rig.overrideBlend = 1; L.rig._lastOverride = L.rig.override; } else L.rig.setOverride(null);
    for (let i = 0; i < (eye ? 4 : 30); i++) L.update(1 / 30);
    return window.__shot();
  }, [eye, look]);
  fs.writeFileSync(`/tmp/claude-0/shots/kitten_${name}.jpg`, Buffer.from(d.split(',')[1], 'base64'));
};
const run = (label) => page.evaluate(async (label) => {
  const L = window.__game.level, ui = window.__game.ui;
  const it = L.interactables.find((i) => (typeof i.label === 'function' ? i.label() : i.label) === label);
  if (!it) return 'no interactable: ' + label;
  const orig = ui.dialogue; ui.dialogue = async () => null;
  await it.action(); ui.dialogue = orig;
  for (let i = 0; i < 10; i++) L.update(1 / 30);
  return 'ok ' + L.kittenState + ' hearts=' + L.E.hearts.length;
}, label);
console.log('start', await page.evaluate(() => window.__game.level.kittenState));
const k = await page.evaluate(() => { const p = window.__game.level.kitten.root.position; return [p.x, p.y, p.z]; });
await shot('lost', [k[0] - 2.2, k[1] + 1.2, k[2] - 2.2], [k[0], k[1] + 0.1, k[2]]);
await page.evaluate(([x, z]) => { const L = window.__game.level; L.player.teleport(x - 1, L.terrain.getHeight(x - 1, z) + 0.1, z - 1); }, [k[0], k[2]]);
console.log('pick up', await run('Gently pick up the little kitten'));
await page.evaluate(() => { const L = window.__game.level; L.player.yaw = 0.8; for (let i = 0; i < 30; i++) L.update(1 / 30); });
const pp = await page.evaluate(() => { const p = window.__game.level.player.pos; return [p.x, p.y, p.z]; });
await shot('carried', [pp[0] + 1.8, pp[1] + 1.4, pp[2] + 2.4], [pp[0], pp[1] + 0.9, pp[2]]);
const hint = await page.evaluate(() => window.__game.level.getHint().text);
console.log('hint', hint);
const m = await page.evaluate(() => { const p = window.__game.level.mamaCat.pos; return [p.x, p.y, p.z]; });
await page.evaluate(([x, z]) => { const L = window.__game.level; L.player.teleport(x - 1.2, L.terrain.getHeight(x - 1.2, z) + 0.1, z + 1); }, [m[0], m[2]]);
console.log('give back', await run('Give Peaches back to her mama'));
await page.evaluate(() => { const L = window.__game.level; for (let i = 0; i < 90; i++) L.update(1 / 30); });
const m2 = await page.evaluate(() => { const L = window.__game.level, p = L.mamaCat.pos, q = L.kitten.pos; return [p.x, p.y, p.z, Math.hypot(p.x - q.x, p.z - q.z)]; });
console.log('kitten to mama distance', m2[3].toFixed(2));
await shot('home', [m2[0] + 1.6, m2[1] + 1.1, m2[2] + 1.6], [m2[0], m2[1] + 0.15, m2[2]]);
console.log('errors', errs.join(' | ') || 'none');
await browser.close();
