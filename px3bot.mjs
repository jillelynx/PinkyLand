// Plays Storybook Chapter 3 (Jacinta the Explorer) start to finish with simulated keys.
import { chromium } from 'playwright-core';
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 400, height: 260 } });
const errs = []; page.on('pageerror', (e) => errs.push(e.message + ' ' + (e.stack || '').split('\n')[1]));
await page.goto(`file://${process.cwd()}/index.html?scene=storybook&fresh=1&chapter=3&quality=low&slow=100000`);
await page.waitForTimeout(6000);
const lib = () => {
  const g = window.__game, sb = g.storybook, inp = g.input, log = [];
  const step = (keys, press = false) => {
    inp.keys.clear(); inp.pressed.clear();
    keys.forEach((k) => inp.keys.add(k)); if (press) inp.pressed.add('Space');
    sb.time += 1 / 60;
    for (const m of sb.movers) { const k = (Math.sin((sb.time / m.period) * Math.PI * 2 + m.phase) + 1) / 2; m.px = m.cx; m.py = m.cy; m.cx = m.x + m.dx * k; m.cy = m.y + m.dy * k; }
    for (const b of sb.bunnies) { if (b.state === 'walk') { b.x += b.dir * 45 / 60; if (Math.abs(b.x - b.home) > b.range) b.dir *= -1; } }
    const hp = sb.run.hp;
    sb.updatePlayer(1 / 60);
    if (sb.run.hp < hp) log.push(`  ouch at ${Math.round(sb.p.x)},${Math.round(sb.p.y)}`);
    if (sb.state === 'respawn') { log.push(`  FELL at ${Math.round(sb.p.x)},${Math.round(sb.p.y)}`); sb.state = 'play'; g.ui.fade(false); sb.p.x = sb._respawnTo.x; sb.p.y = sb._respawnTo.y; sb.p.vy = 0; return false; }
    return true;
  };
  const dirTo = (tx) => (Math.abs(tx - sb.p.x) < 5 ? [] : [tx > sb.p.x ? 'ArrowRight' : 'ArrowLeft']);
  const walk = (tx, run = false) => { for (let i = 0; i < 900; i++) { if (Math.abs(tx - sb.p.x) < 6) break; if (!step([...dirTo(tx), ...(run ? ['ShiftLeft'] : [])])) return false; } return true; };
  const hop = (tx, ty, { dbl = false, run = true, at = -60 } = {}) => {
    let did = false;
    step(['Space', ...dirTo(tx), ...(run ? ['ShiftLeft'] : [])], true);
    for (let i = 0; i < 240; i++) {
      const press = dbl && !did && sb.p.vy > at; if (press) did = true;
      if (!step(['Space', ...dirTo(tx), ...(run ? ['ShiftLeft'] : [])], press)) return { ok: false };
      if (sb.p.grounded && i > 3) break;
    }
    for (let i = 0; i < 4; i++) step([]);
    return { ok: Math.abs(sb.p.y - ty) < 8, x: Math.round(sb.p.x), y: Math.round(sb.p.y) };
  };
  const ride = (cond, max = 900) => { for (let i = 0; i < max && !cond(); i++) step([]); };
  return { g, sb, inp, log, step, walk, hop, ride };
};

const res = await page.evaluate((libSrc) => {
  const { sb, log, step, walk, hop, ride } = eval('(' + libSrc + ')')();
  const out = [`level: ${sb.level.title} ${sb.level.subtitle}, state ${sb.state}, body ${sb.ph.w}x${sb.ph.h}`];
  sb.state = 'play';
  sb.run.hp = 99;
  const chk = (name, r) => out.push(`${r.ok ? '✓' : '✗'} ${name} (at ${r.x},${r.y})`);
  // single + double jump heights for Jacinta
  for (let i = 0; i < 10; i++) step([]);
  let top1 = 999; step(['Space'], true); for (let i = 0; i < 90; i++) { step(['Space']); top1 = Math.min(top1, sb.p.y); if (sb.p.grounded && i > 3) break; }
  for (let i = 0; i < 10; i++) step([]);
  let top2 = 999, d = false; step(['Space'], true); for (let i = 0; i < 120; i++) { const pr = !d && sb.p.vy > -60; if (pr) d = true; step(['Space'], pr); top2 = Math.min(top2, sb.p.y); if (sb.p.grounded && i > 3) break; }
  out.push(`jump height ${440 - top1}px, with double jump ${440 - top2}px`);
  walk(385); chk('over the cracked boulder onto the mossy stone', hop(575, 390, { run: false }));
  walk(620); hop(690, 440, { run: false }); walk(712);
  for (let i = 0; i < 400 && sb.p.x < 858; i++) step(['ArrowDown', 'ArrowRight']);
  for (let i = 0; i < 10; i++) step([]);
  chk('duck and crawl under the low log', { ok: sb.p.x > 855 && !sb.p.duck, x: Math.round(sb.p.x), y: Math.round(sb.p.y) });
  chk('fallen log', hop(960, 400, { run: false }));
  walk(1040); chk('over the first gap', hop(1250, 440));
  chk('stump', hop(1370, 380, { run: false })); hop(1480, 440, { run: false }); walk(1545);
  const raft = sb.movers[0];
  ride(() => raft.cx < 1584);
  chk('onto the leaf raft', hop(raft.cx + 70, 418, { run: false }));
  ride(() => raft.cx > 1690, 600);
  chk('raft to island 1', hop(1765, 320, { run: false }));
  chk('double jump to the high island', hop(1915, 190, { dbl: true, run: false }));
  out.push('  scraps: ' + sb.run.scraps.join(','));
  chk('to island 3', hop(2140, 280));
  chk('to the far bank', hop(2420, 440));
  walk(2830);
  for (let i = 0; i < 600 && sb.p.x < 3068; i++) step(['ArrowDown', 'ArrowRight']);
  for (let i = 0; i < 10; i++) step([]);
  chk('crawl through the log tunnel', { ok: sb.p.x > 3055 && !sb.p.duck, x: Math.round(sb.p.x), y: Math.round(sb.p.y) });
  chk('over the brambles', hop(3250, 440));
  walk(3290);
  { const m = sb.level.bouncy[0]; step(['Space', 'ArrowRight'], true); let bounced = false;
    for (let i = 0; i < 200; i++) { if (m.squish > 0.5) bounced = true; step(bounced ? ['Space', ...(sb.p.x < 3490 ? ['ArrowRight'] : [])] : ['Space', ...(sb.p.x < 3372 ? ['ArrowRight'] : [])]); if (bounced && sb.p.grounded) break; }
    chk('mushroom bounce up to the branch', { ok: sb.p.y === 230, x: Math.round(sb.p.x), y: Math.round(sb.p.y) }); }
  chk('higher branch', hop(3700, 180, { run: false }));
  chk('jump down past the gap', hop(3900, 440));
  walk(4000); chk('tree branch 1', hop(4090, 370, { run: false }));
  chk('tree branch 2', hop(4240, 300, { run: false }));
  chk('tree branch 3', hop(4090, 230, { run: false }));
  chk('tree branch 4', hop(4240, 160, { run: false }));
  chk('treetop island', hop(4150, 92, { run: false }));
  out.push('  scraps: ' + sb.run.scraps.join(','));
  hop(4420, 440, { run: false });
  walk(4520); chk('log 2', hop(4620, 396, { run: false })); hop(4720, 440, { run: false });
  walk(4740); chk('over the cracked boulder', hop(4870, 440));
  walk(4930); out.push('  scraps after the secret ferns: ' + sb.run.scraps.join(','));
  walk(5040); chk('cliff 1', hop(5150, 380, { run: false })); chk('cliff 2', hop(5300, 320, { run: false })); chk('cliff 3', hop(5450, 260, { run: false }));
  walk(5510);
  const lift = sb.movers[2];
  ride(() => lift.cy > 285);
  chk('onto the vine lift', hop(5650, Math.round(lift.cy), { run: false }));
  if (!(sb.p.standing && sb.p.standing.mover)) out.push('  (not on the lift: at ' + Math.round(sb.p.x) + ',' + Math.round(sb.p.y) + ')');
  ride(() => lift.cy < 165, 600);
  chk('lift to the cliff island', hop(5890, 220, { run: false }));
  chk('down to the ground', hop(6060, 440));
  walk(6190); chk('over brambles 2', hop(6380, 440));
  walk(6405); chk('lily pad', hop(6515, 400, { run: false })); chk('far bank', hop(6660, 440, { run: false }));
  walk(6740); chk('over brambles 3', hop(6930, 440));
  chk('last stone', hop(7060, 396, { run: false })); hop(7180, 440, { run: false });
  walk(7400);
  out.push(`stars ${sb.run.stars.length}/${sb.level.stars.length}, scraps ${sb.run.scraps.length}/3, state now: ${sb.state}`);
  return out.concat(log);
}, lib.toString());
console.log(res.join('\n'));
// let the ending play out
await page.evaluate(() => { const sb = window.__game.storybook; for (let i = 0; i < 60 * 22; i++) { sb.stateT += 1 / 60; sb.updateEnding(1 / 60); } });
await page.waitForTimeout(500);
console.log('end panel:', await page.evaluate(() => document.querySelector('.sb-panel')?.innerText.replace(/\n+/g, ' | ')));
console.log('errors:', errs.join(' | ') || 'none');
await browser.close();
