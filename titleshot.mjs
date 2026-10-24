import { chromium } from 'playwright-core';
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1000, height: 900 } });
await page.goto(`file://${process.cwd()}/index.html`);
await page.waitForTimeout(5000);
await page.addStyleTag({ content: '.title-pinky{animation:none!important}' });
const b = await (await page.$('.title-pinky')).boundingBox();
await page.screenshot({ path: '/tmp/claude-0/shots/title_pinky.png', clip: { x: b.x - 30, y: b.y - 20, width: b.width + 60, height: b.height + 40 } });
await browser.close();
