// Close-up pictures of the forest squirrels and raccoons (plus a squirrel up a tree)
import { chromium } from 'playwright-core';
import fs from 'fs';
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1000, height: 620 } });
const errs = []; page.on('pageerror', (e) => errs.push(e.message)); page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
await page.goto(`file://${process.cwd()}/index.html?scene=pinky&arrived=1&quality=high&slow=100000&avatar=jacinta&time=0.45`);
await page.waitForTimeout(12000);
const shot = async (name, which, idx, opts = {}) => {
  const d = await page.evaluate(([which, idx, opts]) => {
    const L = window.__game.level, V = L.player.pos.constructor;
    L.dayNight.paused = true; L.dayNight.time = opts.time ?? 0.45;
    const e = L.creatures.list.find((c) => c.journalKey === which);
    const arr = which === 'squirrel' ? L.__friends.squirrels : L.__friends.raccoons;
    const a = arr[idx];
    L.player.pos.set(a.m.position.x + 30, 0, a.m.position.z + 30);
    if (opts.scare) { L.player.pos.set(a.m.position.x + 1, a.m.position.y, a.m.position.z); }
    for (let i = 0; i < (opts.steps ?? 60); i++) { L.update(1 / 30); if (opts.scare && i === 2) L.player.pos.set(a.m.position.x + 30, 0, a.m.position.z + 30); }
    const p = a.m.position.clone();
    const dist = opts.dist ?? 1.6;
    const ang = a.side !== undefined && a.mode !== 'sit' && a.mode !== 'hop' ? a.side + 0.5 : a.m.rotation.y + 0.8;
    const eye = p.clone().add(new V(Math.sin(ang) * dist, (opts.up ?? 0.5), Math.cos(ang) * dist));
    L.rig.setOverride(eye, p.clone().add(new V(0, 0.2, 0))); L.rig.overrideBlend = 1; L.rig._lastOverride = L.rig.override;
    L.update(1 / 60);
    return [window.__shot(), a.mode];
  }, [which, idx, opts]);
  fs.writeFileSync(`/tmp/claude-0/shots/${name}.jpg`, Buffer.from(d[0].split(',')[1], 'base64'));
  console.log(name, d[1]);
};
await shot('squirrel1', 'squirrel', 0, { steps: 40 });
await shot('squirrel2', 'squirrel', 3, { steps: 100 });
await shot('squirrel_tree', 'squirrel', 1, { scare: true, steps: 70, dist: 2.6, up: -0.2 });
await shot('raccoon1', 'raccoon', 0, { steps: 40, dist: 2.0 });
await shot('raccoon2', 'raccoon', 1, { steps: 200, dist: 2.0 });
console.log('errors', errs.join(' | ') || 'none');
await browser.close();
