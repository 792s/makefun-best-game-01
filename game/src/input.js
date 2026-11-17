// Keyboard and mouse, read once a frame. Movement comes from WASD or the arrow keys,
// or from holding the left mouse button to walk toward the pointer. Keys and clicks
// also raise one-shot actions the screens consume: confirm, pause, mute, restart,
// and the level-up card picks (1, 2, 3).
export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_MUTE = 4;
export const ACTION_RESTART = 8;
export const ACTION_CARD_1 = 16;
export const ACTION_CARD_2 = 32;
export const ACTION_CARD_3 = 64;
export const ACTION_TITLE = 128;

const KEY_ACTIONS = {
  Space: ACTION_CONFIRM,
  Enter: ACTION_CONFIRM,
  KeyP: ACTION_PAUSE,
  Escape: ACTION_PAUSE,
  KeyM: ACTION_MUTE,
  KeyR: ACTION_RESTART,
  KeyT: ACTION_TITLE,
  Digit1: ACTION_CARD_1,
  Digit2: ACTION_CARD_2,
  Digit3: ACTION_CARD_3,
  Numpad1: ACTION_CARD_1,
  Numpad2: ACTION_CARD_2,
  Numpad3: ACTION_CARD_3,
};

export function createInput(canvas, view) {
  const keys = new Set();
  let actions = 0;
  const mouse = { x: view.width / 2, y: view.height / 2, down: false, clicked: null };

  function toView(event) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * view.width,
      y: ((event.clientY - rect.top) / rect.height) * view.height,
    };
  }

  window.addEventListener('keydown', (event) => {
    if (event.repeat) return;
    keys.add(event.code);
    const action = KEY_ACTIONS[event.code];
    if (action) {
      actions |= action;
      if (event.code === 'Space') event.preventDefault();
    }
  });
  window.addEventListener('keyup', (event) => keys.delete(event.code));
  window.addEventListener('blur', () => keys.clear());
  canvas.addEventListener('pointermove', (event) => {
    const p = toView(event);
    mouse.x = p.x;
    mouse.y = p.y;
  });
  canvas.addEventListener('pointerdown', (event) => {
    const p = toView(event);
    mouse.x = p.x;
    mouse.y = p.y;
    mouse.down = true;
    mouse.clicked = { x: p.x, y: p.y };
    actions |= ACTION_CONFIRM;
  });
  window.addEventListener('pointerup', () => {
    mouse.down = false;
  });
  canvas.addEventListener('contextmenu', (event) => event.preventDefault());

  return {
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
    takeClick() {
      const click = mouse.clicked;
      mouse.clicked = null;
      return click;
    },
    mouse() {
      return mouse;
    },
    /** The move direction this frame, normalised, or {x:0,y:0} when still. */
    direction(player) {
      let x = 0;
      let y = 0;
      if (keys.has('KeyA') || keys.has('ArrowLeft')) x -= 1;
      if (keys.has('KeyD') || keys.has('ArrowRight')) x += 1;
      if (keys.has('KeyW') || keys.has('ArrowUp')) y -= 1;
      if (keys.has('KeyS') || keys.has('ArrowDown')) y += 1;
      if (x !== 0 || y !== 0) {
        const len = Math.hypot(x, y);
        return { x: x / len, y: y / len };
      }
      if (mouse.down && player) {
        const dx = mouse.x - player.x;
        const dy = mouse.y - player.y;
        const len = Math.hypot(dx, dy);
        if (len > 12) return { x: dx / len, y: dy / len };
      }
      return { x: 0, y: 0 };
    },
  };
}
