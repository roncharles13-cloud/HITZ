// Configurable input: every action maps to a binding code that is either a
// KeyboardEvent.code ('KeyW', 'ShiftLeft', 'Space', 'ArrowUp'...) or a mouse
// button ('Mouse0' left, 'Mouse1' middle, 'Mouse2' right). Bindings + FOV-style
// prefs persist in localStorage and are read live, so rebinds apply instantly.

const DEFAULTS = {
  up: 'KeyW', down: 'KeyS', left: 'KeyA', right: 'KeyD',
  turbo: 'ShiftLeft', shoot: 'Space', pass: 'KeyF', check: 'KeyZ', spin: 'KeyC', call: 'KeyQ',
};

// Display order + friendly labels for the settings menu
export const ACTIONS = [
  ['up', 'Skate Up'], ['down', 'Skate Down'], ['left', 'Skate Left'], ['right', 'Skate Right'],
  ['turbo', 'Turbo'], ['shoot', 'Shoot'], ['pass', 'Pass'], ['check', 'Check'], ['spin', 'Spin'],
  ['call', 'Call for Puck'],
];

const STORE_KEY = 'hitz_binds';
function load() {
  try {
    const s = JSON.parse(localStorage.getItem(STORE_KEY));
    return (s && typeof s === 'object') ? { ...DEFAULTS, ...s } : { ...DEFAULTS };
  } catch { return { ...DEFAULTS }; }
}
function save() { try { localStorage.setItem(STORE_KEY, JSON.stringify(binds)); } catch {} }

let binds = load();
const keys = {};    // keyboard codes currently down
const mouse = {};   // 'Mouse0'/'Mouse1'/'Mouse2' currently down

window.addEventListener('keydown', e => { keys[e.code] = true; });
window.addEventListener('keyup',   e => { keys[e.code] = false; });
window.addEventListener('mousedown', e => { mouse['Mouse' + e.button] = true; });
window.addEventListener('mouseup',   e => { mouse['Mouse' + e.button] = false; });
window.addEventListener('blur', () => { for (const k in keys) keys[k] = false; for (const m in mouse) mouse[m] = false; });
// allow right/middle mouse to be used as controls
window.addEventListener('contextmenu', e => e.preventDefault());

function down(code) { return code ? (code.startsWith('Mouse') ? !!mouse[code] : !!keys[code]) : false; }
const act = a => down(binds[a]);

// P1 control surface (read live every frame)
export const P1 = {
  up:    () => act('up'),
  down:  () => act('down'),
  left:  () => act('left'),
  right: () => act('right'),
  turbo: () => act('turbo'),
  shoot: () => act('shoot'),
  pass:  () => act('pass'),
  check: () => act('check'),
  spin:  () => act('spin'),
  call:  () => act('call'),
};

// ── Settings API ──
export function getBindings() { return { ...binds }; }
export function setBinding(action, code) { binds[action] = code; save(); }
export function resetBindings() { binds = { ...DEFAULTS }; save(); }

// Capture the next key/mouse press once (for rebinding). Returns a cancel fn.
export function captureNext(cb) {
  const onKey = e => { e.preventDefault(); e.stopPropagation(); cleanup(); cb(e.code); };
  const onMouse = e => { e.preventDefault(); e.stopPropagation(); cleanup(); cb('Mouse' + e.button); };
  function cleanup() {
    window.removeEventListener('keydown', onKey, true);
    window.removeEventListener('mousedown', onMouse, true);
  }
  window.addEventListener('keydown', onKey, true);
  window.addEventListener('mousedown', onMouse, true);
  return cleanup;
}
