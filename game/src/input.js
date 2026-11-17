// Keyboard and mouse input. Held keys give a move vector; one-shot presses
// (interact, punch, pause, confirm) are queued as flags and taken once by the
// loop, so a press between two frames is never lost or counted twice.

export const ACT_INTERACT = 1;
export const ACT_PUNCH = 2;
export const ACT_PAUSE = 4;
export const ACT_CONFIRM = 8;
export const ACT_MUTE = 16;

const UP = new Set(['KeyW', 'ArrowUp']);
const DOWN = new Set(['KeyS', 'ArrowDown']);
const LEFT = new Set(['KeyA', 'ArrowLeft']);
const RIGHT = new Set(['KeyD', 'ArrowRight']);

export function createInput(canvas) {
  const keys = new Set();
  let actions = 0;
  let mouse = { x: 0, y: 0, down: false, clicked: false };
  let clicked = false;

  window.addEventListener('keydown', (event) => {
    if (event.repeat) return;
    keys.add(event.code);
    if (event.code === 'KeyE') actions |= ACT_INTERACT;
    else if (event.code === 'KeyF') actions |= ACT_PUNCH;
    else if (event.code === 'Escape' || event.code === 'KeyP') actions |= ACT_PAUSE;
    else if (event.code === 'Enter' || event.code === 'Space') actions |= ACT_CONFIRM;
    else if (event.code === 'KeyM') actions |= ACT_MUTE;
    if (UP.has(event.code) || DOWN.has(event.code) || LEFT.has(event.code) || RIGHT.has(event.code) || event.code === 'Space') {
      event.preventDefault();
    }
  });
  window.addEventListener('keyup', (event) => keys.delete(event.code));
  window.addEventListener('blur', () => keys.clear());

  canvas.addEventListener('mousemove', (event) => {
    const rect = canvas.getBoundingClientRect();
    mouse.x = (event.clientX - rect.left) * (canvas.width / rect.width);
    mouse.y = (event.clientY - rect.top) * (canvas.height / rect.height);
  });
  canvas.addEventListener('mousedown', (event) => {
    if (event.button === 0) {
      mouse.down = true;
      clicked = true;
      actions |= ACT_CONFIRM;
    }
  });
  window.addEventListener('mouseup', () => { mouse.down = false; });

  return {
    /** Move vector from held keys, normalised: {x, y} each in -1..1. */
    move() {
      const x = (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0) - (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0);
      const y = (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0) - (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0);
      const len = Math.hypot(x, y) || 1;
      return { x: x / len, y: y / len, any: x !== 0 || y !== 0 };
    },
    up() { return keys.has('KeyW') || keys.has('ArrowUp'); },
    down() { return keys.has('KeyS') || keys.has('ArrowDown'); },
    left() { return keys.has('KeyA') || keys.has('ArrowLeft'); },
    right() { return keys.has('KeyD') || keys.has('ArrowRight'); },
    mouse() { return mouse; },
    /** True once when the left button was pressed since the last call. */
    takeClick() {
      const c = clicked;
      clicked = false;
      return c;
    },
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
  };
}
