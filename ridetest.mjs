// Ride test: talk-free mount on each dragon, fly around, take pictures, hop off
import { chromium } from 'playwright-core';
import fs from 'fs';
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1000, height: 620 } });
const errs = []; page.on('pageerror', (e) => errs.push(e.message)); page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
await page.goto(`file://${process.cwd()}/index.html?scene=pinky&arrived=1&quality=high&slow=100000&avatar=jacinta&time=0.4`);
await page.waitForTimeout(12000);
const run = (fn, arg) => page.evaluate(fn, arg);
for (const [i, name] of [[0, 'ember'], [1, 'long'], [2, 'quetzi'], [3, 'fjola']]) {
  const res = await run(([i]) => {
    const L = window.__game.level, inp = window.__game.input;
    L.dayNight.paused = true;
    const d = L.dragons[i];
    // walk the player next to the dragon and climb on
    const tp = d.talkPos(); L.player.pos.set(tp.x + 2, L.terrain.getHeight(tp.x + 2, tp.z) + 0.1, tp.z);
    L.startRide(d);
    const log = [];
    const step = (n, keys) => { for (let k = 0; k < n; k++) { inp.keys = new Set(keys); L.update(1 / 30); } };
    const where = () => { const p = L.player.pos; const s = d.seat(p.clone()); return [p.x.toFixed(1), p.y.toFixed(1), p.z.toFixed(1), 'gap', p.distanceTo(s).toFixed(2)].join(' '); };
    step(60, ['KeyW', 'Space']); log.push('climb ' + where());
    step(60, ['KeyW', 'KeyA']); log.push('turn ' + where() + ' yaw ' + L.riding.yaw.toFixed(2));
    step(30, []); log.push('cruise ' + where() + ' speed ' + L.riding.speed.toFixed(1));
    window.__rideLog = log;
    return log;
  }, [i]);
  // picture from the chase camera
  const shot = await run(() => window.__shot());
  fs.writeFileSync(`/tmp/claude-0/shots/ride_${name}.jpg`, Buffer.from(shot.split(',')[1], 'base64'));
  const off = await run(() => { const L = window.__game.level, inp = window.__game.input; inp.keys = new Set(); inp.pressed.add('KeyE'); L.update(1 / 30); inp.pressed.clear(); for (let k = 0; k < 90; k++) L.update(1 / 30); const p = L.player.pos; return `off: riding=${!!L.riding} pos ${p.x.toFixed(1)} ${p.y.toFixed(1)} ${p.z.toFixed(1)} ground ${L.world.groundHeight(p.x, p.z, p.y + 1).toFixed(1)}`; });
  console.log(name, res.join(' | '), '|', off);
}
console.log('errors', errs.join(' | ') || 'none');
await browser.close();
