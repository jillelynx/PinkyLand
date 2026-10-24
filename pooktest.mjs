// Tests Pooking Power: Pinky's third jump in the air (Storybook Chapter 1 and Pinky Land),
// and that Jacinta (Chapter 3) does not get it. Saves screenshots of the puff.
import { chromium } from 'playwright-core';
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1100, height: 650 } });
const errs = []; page.on('pageerror', (e) => errs.push(e.message + ' ' + (e.stack || '').split('\n')[1]));
const sbTest = async (chapter, shot) => {
  await page.goto(`file://${process.cwd()}/index.html?scene=storybook&fresh=1&chapter=${chapter}&quality=high&slow=100000`);
  await page.waitForTimeout(7000);
  return page.evaluate(async (shot) => {
    const g = window.__game, sb = g.storybook, inp = g.input;
    sb.state = 'play'; sb.pinky.root.scale.setScalar(0.95); if (sb.swirl) sb.swirl.visible = false;
    const step = (keys, press) => { inp.keys.clear(); inp.pressed.clear(); keys.forEach((k) => inp.keys.add(k)); if (press) inp.pressed.add('Space'); sb.time += 1 / 60; sb.updatePlayer(1 / 60); sb.updateWorld(1 / 60); };
    const x0 = sb.level.start.x + 150; // flat ground near the start
    const jumpTest = (presses) => {
      Object.assign(sb.p, { x: x0, y: 440, vx: 0, vy: 0, grounded: true, doubled: false, pooked: false });
      for (let i = 0; i < 10; i++) step([]);
      let top = 999; step(['Space'], true);
      for (let i = 0; i < 200; i++) { step(['Space'], presses.includes(i)); top = Math.min(top, sb.p.y); if (sb.p.grounded && i > 5) break; }
      return Math.round(440 - top);
    };
    const h1 = jumpTest([]), h2 = jumpTest([20]), h3 = jumpTest([20, 45]), h4 = jumpTest([20, 45, 60, 70]);
    let pic = null;
    if (shot) {
      Object.assign(sb.p, { x: x0, y: 440, vx: 0, vy: 0, grounded: true, doubled: false, pooked: false });
      for (let i = 0; i < 5; i++) step([]);
      step(['Space'], true); for (let i = 0; i < 52; i++) step(['Space'], i === 20 || i === 45);
      sb.camX = sb.p.x + 60; sb.camY = Math.min(sb.p.y - 60, 360);
      sb.render(0.016);
      pic = document.querySelector('canvas').toDataURL('image/jpeg', 0.85);
    }
    return { h1, h2, h3, h4, pooked: !!sb._pookTip, pic };
  }, shot);
};
const fs = await import('fs');
const c1 = await sbTest(1, true);
console.log(`Chapter 1 (Pinky): jump ${c1.h1}px · double ${c1.h2}px · with Pooking Power ${c1.h3}px · mashing jump (only one pook) ${c1.h4}px · tip shown ${c1.pooked}`);
fs.writeFileSync('/tmp/claude-0/shots/pook_sb.jpg', Buffer.from(c1.pic.split(',')[1], 'base64'));
const c3 = await sbTest(3, false);
console.log(`Chapter 3 (Jacinta): double ${c3.h2}px · third press ${c3.h3}px (should equal double: no pook for Jacinta)`);
// Pinky Land as Pinky
await page.goto(`file://${process.cwd()}/index.html?scene=pinky&arrived=1&quality=high&slow=100000&avatar=pinky&time=0.4`);
await page.waitForTimeout(12000);
const r3 = await page.evaluate(() => {
  const g = window.__game, L = g.level, P = L.player, inp = g.input;
  L.dayNight.paused = true;
  const step = (press) => { inp.keys.clear(); inp.pressed.clear(); inp.keys.add('Space'); if (press) inp.pressed.add('Space'); L.update(1 / 30); };
  const test = (presses) => {
    for (let i = 0; i < 30; i++) { inp.keys.clear(); inp.pressed.clear(); L.update(1 / 30); }
    const y0 = P.pos.y; let top = y0; step(true);
    for (let i = 0; i < 120; i++) { step(presses.includes(i)); top = Math.max(top, P.pos.y); if (P.grounded && i > 4) break; }
    return Math.round((top - y0) * 100) / 100;
  };
  const a = test([]), b = test([10]), c = test([10, 22]);
  // screenshot right after a pook
  for (let i = 0; i < 30; i++) { inp.keys.clear(); inp.pressed.clear(); L.update(1 / 30); }
  step(true); for (let i = 0; i < 26; i++) step(i === 10 || i === 22);
  const V = P.pos.constructor, ang = P.yaw + Math.PI / 2;
  L.rig.setOverride(new V(P.pos.x + Math.sin(ang) * 3.2, P.pos.y + 0.8, P.pos.z + Math.cos(ang) * 3.2), P.pos.clone()); L.rig.overrideBlend = 1; L.rig._lastOverride = L.rig.override;
  for (let i = 0; i < 2; i++) L.update(1 / 60);
  return { a, b, c, pic: window.__shot() };
});
console.log(`Pinky Land (Pinky): jump ${r3.a}m · double ${r3.b}m · with Pooking Power ${r3.c}m`);
fs.writeFileSync('/tmp/claude-0/shots/pook_3d.jpg', Buffer.from(r3.pic.split(',')[1], 'base64'));
console.log('errors:', errs.join(' | ') || 'none');
await browser.close();
