// Keyboard, mouse and game-controller input in one place.
export class Input {
  constructor(canvas) {
    this.keys = new Set();
    this.pressed = new Set(); // keys pressed this frame
    this.mouse = { dx: 0, dy: 0, dragging: false, wheel: 0, wheelX: 0 };
    this.mouseLook = false; // when true, clicking the game locks the mouse for looking around
    this.canvas = canvas;
    this.enabled = true;
    this.gamepadPrev = {};
    window.addEventListener('keydown', (e) => {
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.code)) e.preventDefault();
      if (!this.keys.has(e.code)) this.pressed.add(e.code);
      this.keys.add(e.code);
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.keys.clear());
    canvas.addEventListener('pointerdown', (e) => {
      if (this.mouseLook && document.pointerLockElement !== canvas) { try { canvas.requestPointerLock(); } catch (_) { /* ignore */ } }
      this.mouse.dragging = true;
      this.pressed.add('Mouse' + e.button);
      try { canvas.setPointerCapture(e.pointerId); } catch (_) { /* ignore */ }
    });
    window.addEventListener('pointerup', () => { this.mouse.dragging = false; });
    window.addEventListener('pointermove', (e) => {
      if (this.mouse.dragging || document.pointerLockElement === canvas) {
        this.mouse.dx += e.movementX || 0;
        this.mouse.dy += e.movementY || 0;
      }
    });
    canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      // two-finger swipe on a trackpad: sideways turns the camera, up/down (or pinch) zooms
      let dy = e.deltaY, dx = e.deltaX;
      if (e.deltaMode === 1) { dy *= 16; dx *= 16; }
      if (e.ctrlKey) dy *= 4; // pinch gesture
      this.mouse.wheel += dy;
      this.mouse.wheelX += dx;
    }, { passive: false });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  down(...codes) { return this.enabled && codes.some((c) => this.keys.has(c)); }
  hit(...codes) { return this.enabled && codes.some((c) => this.pressed.has(c)); }

  // Read the first connected game controller
  pad() {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    for (const p of pads) if (p && p.connected) return p;
    return null;
  }

  poll() {
    const p = this.pad();
    this.padState = null;
    if (!p) return;
    const dz = (v) => (Math.abs(v) < 0.15 ? 0 : v);
    const b = (i) => !!(p.buttons[i] && p.buttons[i].pressed);
    const state = {
      lx: dz(p.axes[0] || 0), ly: dz(p.axes[1] || 0), rx: dz(p.axes[2] || 0), ry: dz(p.axes[3] || 0),
      jump: b(0), interact: b(2) || b(1), run: b(10) || b(7), dive: b(6) || b(11),
      journal: b(3), map: b(8), hint: b(12), switch: b(5), switchBack: b(4), pause: b(9),
    };
    for (const k of ['jump', 'interact', 'journal', 'map', 'hint', 'switch', 'switchBack', 'pause']) {
      if (state[k] && !this.gamepadPrev[k]) this.pressed.add('Pad_' + k);
      this.gamepadPrev[k] = state[k];
    }
    this.padState = state;
  }

  endFrame() {
    this.pressed.clear();
    this.mouse.dx = 0;
    this.mouse.dy = 0;
    this.mouse.wheel = 0;
    this.mouse.wheelX = 0;
  }
}
