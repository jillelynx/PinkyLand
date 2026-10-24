// Checks Jacinta's pixel animations in Chapter 3: which frame shows in each situation,
// that landings happen once, and that frames line up. Saves in-game snapshots.
import { chromium } from 'playwright-core';
import fs from 'fs';
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
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
    sb.updatePlayer(1 / 60); sb.render(1 / 60); if (window.__rec) window.__rec(sb);
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
  sb.state = 'play'; sb.run.hp = 99;
  const rec = []; let label = '';
  const shots = [];
  window.__rec = (sb) => {
    const f = sb.pix.lastFrame, A = sb.pix.anim;
    rec.push({ label, st: A.state, face: A.face, row: f.row, col: f.col, x: sb.p.x, y: sb.p.y, g: sb.p.grounded });
    if (window.__snap) {
      const c = sb.pix.el; const [X, Y] = [Math.round(sb.p.x - sb.pix.viewL), Math.round(sb.p.y - sb.pix.viewT)];
      const o = document.createElement('canvas'); o.width = 110; o.height = 120; const g = o.getContext('2d');
      g.drawImage(c, X - 55, Y - 112, 110, 120, 0, 0, 110, 120); shots.push(o.toDataURL());
    }
  };
  const seg = (name, fn) => { label = name; const n0 = rec.length; fn(); const part = rec.slice(n0); return part; };
  const summary = (name, part) => {
    const seq = []; for (const r of part) { const k = `${r.st}:${r.row % 5}.${r.col}${r.face[0] === 'd' ? '*' : ''}`; if (seq[seq.length - 1] !== k) seq.push(k); }
    return `${name}: ${seq.slice(0, 40).join(' ')}`;
  };
  const out = [];
  // an open stretch of ground with nothing in the way
  sb.bunnies.length = 0; for (const r of sb.level.breakables || []) r.broken = true;
  Object.assign(sb.p, { x: 3860, y: 440, vx: 0, vy: 0, grounded: true, facing: 1 });
  window.__snap = true;
  out.push(summary('idle 3s', seg('idle', () => { for (let i = 0; i < 180; i++) step([]); })));
  out.push(summary('walk 1.2s', seg('walk', () => { for (let i = 0; i < 72; i++) step(['ArrowRight']); })));
  out.push(summary('stop', seg('stop', () => { for (let i = 0; i < 30; i++) step([]); })));
  out.push(summary('turn + walk left', seg('turn', () => { for (let i = 0; i < 30; i++) step(['ArrowLeft']); })));
  out.push(summary('run 1.2s', seg('run', () => { for (let i = 0; i < 72; i++) step(['ArrowRight', 'ShiftLeft']); })));
  for (let i = 0; i < 30; i++) step([]);
  const jp = seg('jump', () => { step(['Space'], true); for (let i = 0; i < 90; i++) { step(['Space']); } for (let i = 0; i < 20; i++) step([]); });
  out.push(summary('jump in place', jp));
  const dj = seg('dbl', () => { step(['Space'], true); for (let i = 0; i < 120; i++) { step(['Space'], i === 18); } for (let i = 0; i < 20; i++) step([]); });
  out.push(summary('double jump', dj));
  const lands = (part) => { let n = 0, prev = ''; for (const r of part) { if (r.st === 'land' && prev !== 'land') n++; prev = r.st; } return n; };
  out.push(`landings counted: jump=${lands(jp)} double=${lands(dj)} (should be 1 each)`);
  out.push(`landing frames shown while in the air: ${[...jp, ...dj].filter((r) => r.st === 'land' && !r.g).length} (should be 0)`);
  window.__snap = false;
  // walk into the brambles at 3120
  Object.assign(sb.p, { x: 3080, y: 440, vx: 0, vy: 0, grounded: true, facing: 1, inv: 0 });
  out.push(summary('walk toward brambles', seg('bramble', () => { for (let i = 0; i < 90; i++) step(['ArrowRight']); })));
  // foot sliding check: during the walk, how far she moves per frame change
  const w = rec.filter((r) => r.label === 'walk' && r.st === 'walk');
  let changes = 0; for (let i = 1; i < w.length; i++) if (w[i].col !== w[i - 1].col) changes++;
  out.push(`walk: moved ${Math.round(w[w.length - 1].x - w[0].x)}px with ${changes} frame changes (${((w[w.length - 1].x - w[0].x) / Math.max(1, changes)).toFixed(1)} px per frame, target 9.5)`);
  const rr = rec.filter((r) => r.label === 'run' && r.st === 'run');
  let ch2 = 0; for (let i = 1; i < rr.length; i++) if (rr[i].col !== rr[i - 1].col) ch2++;
  out.push(`run: moved ${Math.round(rr[rr.length - 1].x - rr[0].x)}px with ${ch2} frame changes (${((rr[rr.length - 1].x - rr[0].x) / Math.max(1, ch2)).toFixed(1)} px per frame, target 15.5)`);
  return { out: out.concat(log), shots };
}, lib.toString());
console.log(res.out.join('\n'));
fs.mkdirSync('/tmp/claude-0/anim', { recursive: true });
res.shots.forEach((d, i) => fs.writeFileSync(`/tmp/claude-0/anim/f${String(i).padStart(4, '0')}.png`, Buffer.from(d.split(',')[1], 'base64')));
console.log('snapshots', res.shots.length, 'errors:', errs.join(' | ') || 'none');
await browser.close();
