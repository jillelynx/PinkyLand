// Time speed: the settings choice and holding T to fast-forward; the grown-ups password still opens the menu
import { chromium } from 'playwright-core';
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1000, height: 620 } });
const errs = []; page.on('pageerror', (e) => errs.push(e.message));
await page.goto(`file://${process.cwd()}/index.html?scene=pinky&arrived=1&quality=low&slow=100000&time=0.4`);
await page.waitForTimeout(9000);
const step = (n, keys = []) => page.evaluate(([n, keys]) => {
  const g = window.__game, L = g.level, t0 = L.dayNight.time;
  for (let i = 0; i < n; i++) { g.input.keys = new Set(keys); g.handleKeys(); L.update(1 / 30); g.input.pressed.clear(); }
  return ((L.dayNight.time - t0) * 24 * 60).toFixed(1) + ' game-minutes';
}, [n, keys]);
console.log('normal, 10 s:', await step(300));
await page.evaluate(() => window.__game.setTimeSpeed(10));
console.log('super fast, 10 s:', await step(300));
console.log('holding T, 10 s:', await step(300, ['KeyT']));
console.log('after letting go, speed =', await page.evaluate(() => { const g = window.__game; g.input.keys = new Set(); g.handleKeys(); return g.level.dayNight.speed; }));
await page.evaluate(() => window.__game.setTimeSpeed(1));
const ok = await page.evaluate((pw) => window.__game.scramblePw(pw) === window.__game.grownUpCode(), process.env.PL_PW || '');
console.log('password check', ok, '| wrong password rejected', await page.evaluate(() => window.__game.scramblePw('nope') !== window.__game.grownUpCode()));
console.log('errors', errs.join(' | ') || 'none');
await browser.close();
