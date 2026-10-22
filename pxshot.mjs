// screenshots of Storybook Chapter 3 (pixel jungle) at chosen spots
import { chromium } from 'playwright-core';
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errs = []; page.on('pageerror', (e) => errs.push(e.message + ' ' + (e.stack || '').split('\n')[1])); page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text().slice(0, 200)); });
const spots = JSON.parse(process.argv[2] || '[[300,440],[1750,320],[3000,440],[4120,160],[5450,260],[7150,440]]');
await page.goto(`file://${process.cwd()}/index.html?scene=storybook&fresh=1&chapter=3&quality=high&slow=100000`);
await page.waitForTimeout(8000);
let i = 0;
for (const [x, y] of spots) {
  await page.evaluate(([x, y]) => {
    const sb = window.__game.storybook;
    sb.state = 'play';
    Object.assign(sb.p, { x, y, vx: 0, vy: 0, grounded: true, facing: 1 });
    sb.camX = x + 90; sb.camY = Math.min(y - 80, 360);
    for (let k = 0; k < 6; k++) { sb.time += 0.016; sb.updateWorld(0.016); sb.render(0.016); }
  }, [x, y]);
  await page.screenshot({ path: `/tmp/claude-0/shots/px_${i++}.jpg`, quality: 85 });
}
console.log('errors', errs.join(' | ') || 'none');
await browser.close();
