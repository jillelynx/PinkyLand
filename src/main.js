import { Game } from './game.js';

function boot() {
  try {
    const game = new Game();
    game.start().catch(showError);
  } catch (e) {
    showError(e);
  }
}

function showError(e) {
  console.error(e);
  const d = document.createElement('div');
  d.style.cssText = 'position:fixed;inset:0;display:grid;place-items:center;background:#ffe3ee;font:20px ui-rounded,system-ui;color:#4a2d4a;z-index:99;padding:30px;text-align:center';
  d.innerHTML = `<div><h2>Oops! Pinky Land couldn’t start.</h2><p>Please try opening it in Safari or Chrome.</p><pre style="white-space:pre-wrap;font-size:13px;opacity:.7">${(e && e.message) || e}</pre></div>`;
  document.body.appendChild(d);
}

boot();
