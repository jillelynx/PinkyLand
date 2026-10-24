// Look around the sky with the arrow keys at Moonview Cliff, and watch a sunset from the Cozy Camp
import { chromium } from 'playwright-core';
import fs from 'fs';
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1000, height: 620 } });
const errs = []; page.on('pageerror', (e) => errs.push(e.message));
await page.goto(`file://${process.cwd()}/index.html?scene=pinky&arrived=1&slow=100000&avatar=jacinta&time=0.85`);
await page.waitForTimeout(12000);
for (let i = 0; i < 5; i++) { await page.keyboard.press('Escape'); await page.waitForTimeout(300); }
const step = (n, keys = []) => page.evaluate(([n, keys]) => { const g = window.__game, L = g.level; for (let i = 0; i < n; i++) { g.input.keys = new Set(keys); g.handleKeys(); L.update(1 / 30); g.input.pressed.clear(); } const S = L.skyMode; return S ? { yaw: +S.yaw.toFixed(2), pitch: +S.pitch.toFixed(2), time: +L.dayNight.time.toFixed(3) } : null; }, [n, keys]);
const shot = async (name) => { const d = await page.evaluate(() => window.__shot()); fs.writeFileSync(`/tmp/claude-0/shots/sky_${name}.jpg`, Buffer.from(d.split(',')[1], 'base64')); };
// cliff: choose "look around", then turn with the arrows
await page.evaluate(() => { const L = window.__game.level, ui = window.__game.ui; L.dayNight.setTime(0.85); L.player.teleport(80, 13, -29); const seq = ['look', 'up']; ui.dialogue = async () => seq.shift() || 'up'; L.sitAtCliff(); });
console.log('start', JSON.stringify(await step(10)));
console.log('turn left 2s', JSON.stringify(await step(60, ['ArrowLeft'])));
console.log('look up 1s', JSON.stringify(await step(30, ['ArrowUp'])));
await shot('cliff_look');
console.log('hold T 1s (time moves)', JSON.stringify(await step(30, ['KeyT'])));
await page.evaluate(() => { const g = window.__game; g.input.pressed.add('Escape'); g.handleKeys(); g.level.update(1 / 30); g.input.pressed.clear(); });
await page.waitForTimeout(300);
console.log('after Esc: sky mode', await page.evaluate(() => !!window.__game.level.skyMode), '| settings open', await page.evaluate(() => window.__game.ui.open || 'no'));
await step(20);
// camp: watch the sunset
await page.evaluate(() => { const L = window.__game.level, ui = window.__game.ui; L.dayNight.setTime(0.5); L.player.teleport(-20, 2.2, -3); L.sitting = false; const seq = ['watchset', 'up']; ui.dialogue = async () => seq.shift() || 'up'; L.sitByFire(); });
await page.waitForTimeout(1500);
console.log('sunset start', JSON.stringify(await step(30)));
for (let k = 0; k < 4; k++) { console.log('sunset', JSON.stringify(await step(150))); await shot('sunset' + k); }
console.log('errors', errs.join(' | ') || 'none');
await browser.close();
