// Grown-ups menu: change the time of day while playing, and pick a time before jumping
import { chromium } from 'playwright-core';
import fs from 'fs';
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1000, height: 620 } });
const errs = []; page.on('pageerror', (e) => errs.push(e.message));
await page.goto(`file://${process.cwd()}/index.html?scene=pinky&arrived=1&quality=low&time=0.35`);
await page.waitForTimeout(9000);
await page.evaluate(() => window.__game.uiAction('settings'));
await page.waitForTimeout(300);
await page.click('[data-grownup]');
await page.fill('.gu-pw', 'pinky79'); await page.click('.gu-ok');
await page.waitForTimeout(300);
await page.click('[data-time="0.9"]');
await page.waitForTimeout(500);
console.log('time now', await page.evaluate(() => window.__game.level.dayNight.time.toFixed(3)));
// from the title-style flow: pick sunset then jump to snow island
await page.evaluate(() => window.__game.showGrownUpMenu(document.createElement('div')));
await page.click('[data-time="0.72"]'); await page.click('[data-jump="snow"]');
await page.waitForTimeout(9000);
console.log('snow island time', await page.evaluate(() => window.__game.level.name + ' ' + window.__game.level.dayNight.time.toFixed(3)));
console.log('errors', errs.join(' | ') || 'none');
await browser.close();
