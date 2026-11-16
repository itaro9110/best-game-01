// STARSHARD — keyboard and mouse, read fresh every frame. The game never trusts
// a key event's timing: it polls this state inside the fixed-step loop, so a
// held key and a held mouse button feel instant and identical at any frame rate.
export function createInput(canvas) {
  const keys = new Set();
  const justPressed = new Set();
  const mouse = { x: 0, y: 0, down: false, clicked: false };
  let scale = 1;
  let offsetX = 0;
  let offsetY = 0;

  function toGame(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: (clientX - rect.left - offsetX) / scale,
      y: (clientY - rect.top - offsetY) / scale,
    };
  }

  window.addEventListener('keydown', (event) => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(event.key)) event.preventDefault();
    const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
    if (!event.repeat) justPressed.add(key);
    keys.add(key);
  });
  window.addEventListener('keyup', (event) => {
    keys.delete(event.key.length === 1 ? event.key.toLowerCase() : event.key);
  });
  window.addEventListener('blur', () => keys.clear());
  canvas.addEventListener('mousemove', (event) => {
    const p = toGame(event.clientX, event.clientY);
    mouse.x = p.x;
    mouse.y = p.y;
  });
  canvas.addEventListener('mousedown', (event) => {
    const p = toGame(event.clientX, event.clientY);
    mouse.x = p.x;
    mouse.y = p.y;
    mouse.down = true;
    mouse.clicked = true;
  });
  window.addEventListener('mouseup', () => { mouse.down = false; });
  canvas.addEventListener('contextmenu', (event) => event.preventDefault());

  return {
    mouse,
    /** True while a movement key is held. */
    moveX() {
      let x = 0;
      if (keys.has('a') || keys.has('ArrowLeft')) x -= 1;
      if (keys.has('d') || keys.has('ArrowRight')) x += 1;
      return x;
    },
    moveY() {
      let y = 0;
      if (keys.has('w') || keys.has('ArrowUp')) y -= 1;
      if (keys.has('s') || keys.has('ArrowDown')) y += 1;
      return y;
    },
    firing() { return mouse.down || keys.has(' '); },
    pressed(key) { return keys.has(key); },
    /**
     * One-shot key press: true once per physical keydown, even if the key was
     * released before the next frame polled it. A fast tap never slips through.
     */
    takePressed(key) {
      if (!justPressed.has(key)) return false;
      justPressed.delete(key);
      return true;
    },
    /** One-shot click flag: true once per mousedown, cleared by the game each step. */
    takeClick() {
      const was = mouse.clicked;
      mouse.clicked = false;
      return was;
    },
    /** The canvas is letterboxed; tell input the current transform. */
    setTransform(nextScale, nextOffsetX, nextOffsetY) {
      scale = nextScale;
      offsetX = nextOffsetX;
      offsetY = nextOffsetY;
    },
  };
}
