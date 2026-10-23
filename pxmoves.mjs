// Tests Jacinta's explorer moves in Chapter 3: duck + crawl under a log, slide through
// the log tunnel, punch and kick the cracked boulders, boop beetles, and jumping still works.
import { chromium } from 'playwright-core';
import fs from 'fs';
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errs = []; page.on('pageerror', (e) => errs.push(e.message + ' ' + (e.stack || '').split('\n')[1]));
await page.goto(`file://${process.cwd()}/index.html?scene=storybook&fresh=1&chapter=3&quality=low&slow=100000`);
await page.waitForTimeout(6000);
const res = await page.evaluate(() => {
  const g = window.__game, sb = g.storybook, inp = g.input, out = [], shots = [];
  sb.state = 'play'; sb.run.hp = 99;
  let snapOn = false;
  const step = (keys, press = []) => {
    inp.keys.clear(); inp.pressed.clear();
    keys.forEach((k) => inp.keys.add(k)); press.forEach((k) => { inp.pressed.add(k); inp.keys.add(k); });
    sb.time += 1 / 60;
    for (const m of sb.movers) { const k = (Math.sin((sb.time / m.period) * Math.PI * 2 + m.phase) + 1) / 2; m.px = m.cx; m.py = m.cy; m.cx = m.x + m.dx * k; m.cy = m.y + m.dy * k; }
    sb.updatePlayer(1 / 60); sb.updateWorld(1 / 60); sb.render(1 / 60);
    if (snapOn) {
      const c = sb.pix.el; const X = Math.round(sb.p.x - sb.pix.viewL), Y = Math.round(sb.p.y - sb.pix.viewT);
      const o = document.createElement('canvas'); o.width = 150; o.height = 120; o.getContext('2d').drawImage(c, X - 75, Y - 112, 150, 120, 0, 0, 150, 120); shots.push(o.toDataURL());
    }
  };
  const place = (x) => { Object.assign(sb.p, { x, y: 440, vx: 0, vy: 0, grounded: true, facing: 1, inv: 0, duck: false, slideT: 0, attack: null }); for (let i = 0; i < 10; i++) step([]); };
  const st = () => `x=${Math.round(sb.p.x)} y=${Math.round(sb.p.y)} duck=${sb.p.duck} slide=${sb.p.slideT > 0} frame=${sb.pix.anim.state}:${sb.pix.lastFrame.row % 7}.${sb.pix.lastFrame.col}`;
  snapOn = true;
  // 1) punch the first boulder
  place(405);
  const b1 = sb.level.breakables[0];
  for (let i = 0; i < 20; i++) step(i === 0 ? [] : [], i === 0 ? ['KeyZ'] : []);
  out.push(`punch boulder 1: broken=${b1.broken} (${st()})`);
  for (let i = 0; i < 20; i++) step([]);
  // 2) walk into the low log: she is stopped while standing
  place(640);
  for (let i = 0; i < 90; i++) step(['ArrowRight']);
  out.push(`walk into low log while standing: stopped at x=${Math.round(sb.p.x)} (log starts 730)`);
  // 3) duck and crawl under it
  for (let i = 0; i < 12; i++) step(['ArrowDown']);
  out.push(`ducking: ${st()}`);
  for (let i = 0; i < 160; i++) step(['ArrowDown', 'ArrowRight']);
  out.push(`crawled to: ${st()}`);
  // let go of Down while still under the log: she must stay ducked
  let under = sb.p.x > 740 && sb.p.x < 830;
  if (under) { step(['ArrowRight']); out.push(`let go under the log -> still ducking: ${sb.p.duck}`); }
  for (let i = 0; i < 160; i++) step(['ArrowDown', 'ArrowRight']);
  for (let i = 0; i < 20; i++) step([]);
  out.push(`out the other side, stood up: ${st()}`);
  snapOn = false;
  // 4) slide through the tunnel
  place(2560);
  snapOn = true;
  for (let i = 0; i < 45; i++) step(['ArrowRight', 'ShiftLeft']);
  step(['ArrowRight', 'ShiftLeft'], ['ArrowDown']);
  out.push(`slide started: ${st()}`);
  let minH = 99; const seq = [];
  for (let i = 0; i < 200; i++) { step(['ArrowRight', 'ArrowDown']); minH = Math.min(minH, sb.bodyH()); const k = `${sb.pix.anim.state}:${sb.pix.lastFrame.row % 7}.${sb.pix.lastFrame.col}`; if (seq[seq.length - 1] !== k) seq.push(k); if (sb.p.x > 3080) break; }
  out.push('slide frames: ' + seq.join(' '));
  for (let i = 0; i < 30; i++) step(['ArrowRight']);
  out.push(`through the tunnel: ${st()} (lowest body ${minH})`);
  snapOn = false;
  const beetle = sb.bunnies.find((b) => Math.abs(b.home - 2980) < 5);
  out.push(`beetle in the tunnel booped by the slide: ${beetle.state !== 'walk'}`);
  // 5) kick the second boulder
  place(4760);
  const b2 = sb.level.breakables[1];
  snapOn = true;
  for (let i = 0; i < 30; i++) step([], i === 0 ? ['KeyX'] : []);
  snapOn = false;
  out.push(`kick boulder 2: broken=${b2.broken}`);
  // 6) punch a beetle
  place(4300);
  const bt = sb.bunnies.find((b) => Math.abs(b.home - 4380) < 5); bt.x = 4340; bt.dir = -1;
  for (let i = 0; i < 25; i++) step([], i === 0 ? ['KeyJ'] : []);
  out.push(`punch a beetle: booped=${bt.state !== 'walk'}, hurt=${sb.p.inv > 0}`);
  // 7) jump + double jump still fine
  place(6650);
  let top = 999; step(['Space'], ['Space']); for (let i = 0; i < 120; i++) { step(['Space'], i === 18 ? ['Space'] : []); top = Math.min(top, sb.p.y); if (sb.p.grounded && i > 5) break; }
  out.push(`double jump height: ${Math.round(440 - top)}px`);
  return { out, shots };
});
console.log(res.out.join('\n'));
fs.rmSync('/tmp/claude-0/moves', { recursive: true, force: true }); fs.mkdirSync('/tmp/claude-0/moves', { recursive: true });
res.shots.forEach((d, i) => fs.writeFileSync(`/tmp/claude-0/moves/f${String(i).padStart(4, '0')}.png`, Buffer.from(d.split(',')[1], 'base64')));
console.log('snapshots', res.shots.length, 'errors:', errs.join(' | ') || 'none');
await browser.close();
