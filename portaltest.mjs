// The Dream Door works both ways: Pinky Land -> Jacinta's house -> park -> Pinky Land, keeping all progress
import { chromium } from 'playwright-core';
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1000, height: 620 } });
const errs = []; page.on('pageerror', (e) => errs.push(e.message));
await page.goto(`file://${process.cwd()}/index.html?scene=pinky&arrived=1&quality=low&avatar=jacinta&time=0.45`);
await page.waitForTimeout(10000);
for (let i = 0; i < 5; i++) { await page.keyboard.press('Escape'); await page.waitForTimeout(300); }
const status = () => page.evaluate(() => { const g = window.__game, L = g.level, p = L.player.pos; return `${L.name} at (${p.x.toFixed(1)}, ${p.z.toFixed(1)}) avatar=${g.state.avatar} hearts=${g.state.earth?.hearts?.length} stars=${g.state.counts?.star ?? 0} met=${(g.state.pinky?.met || []).length}`; });
const waitFor = async (name) => { for (let i = 0; i < 120; i++) { if (await page.evaluate((n) => window.__game.level?.name === n && window.__game.mode === n, name)) { await page.waitForTimeout(1500); return; } await page.waitForTimeout(500); } };
const door = (choice) => page.evaluate(async (choice) => { const g = window.__game, L = g.level, ui = g.ui; const it = L.interactables.find((i) => String(typeof i.label === 'function' ? i.label() : i.label).includes('Dream Door')); if (!it) return 'no door'; const o = ui.dialogue; ui.dialogue = async () => choice; await it.action(); ui.dialogue = o; return 'ok'; }, choice);
// pick up a star first so we can check it is kept
await page.evaluate(() => { const L = window.__game.level, c = L.collectibles.find((c) => c.id === 'pl-star-6'); L.player.teleport(c.obj.position.x, c.obj.position.y, c.obj.position.z); for (let i = 0; i < 20; i++) L.update(1 / 30); });
console.log('1', await status());
console.log('door ->', await door('home')); await waitFor('home');
console.log('2', await status());
await page.evaluate(() => window.__game.leaveHome()); await waitFor('earth');
console.log('3', await status());
console.log('door open?', await page.evaluate(() => window.__game.level.doorOpen())); await page.evaluate(() => window.__game.level.portalAction()); await waitFor('pinky');
console.log('4', await status(), '| star 6 still collected:', await page.evaluate(() => !window.__game.level.collectibles.some((c) => c.id === 'pl-star-6' && !c.taken)));
console.log('door ->', await door('park')); await waitFor('earth');
console.log('5', await status());
// the journal page with Albany's picture
await page.evaluate(() => { const g = window.__game; if (!g.state.journal.includes('albany')) g.state.journal.push('albany'); g.ui.openJournal(g.state); });
await page.waitForTimeout(800);
await page.evaluate(() => { const el = [...document.querySelectorAll('.entry h3')].find((h) => h.textContent === 'Albany'); el?.scrollIntoView(); });
await page.screenshot({ path: '/tmp/claude-0/shots/journal_albany.png', timeout: 30000 });
console.log('errors', errs.join(' | ') || 'none');
await browser.close();
