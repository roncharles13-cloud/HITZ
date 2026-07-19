import { discFont } from './bitmapfont.js';

let goalFlashTimer = 0;
let goalFlashEl = null;
let fireL = null, fireR = null;
let turboFill = null;
let shotWrap = null, shotFill = null;
let fontCtx = null;
let fontW = 0, fontH = 0;
let hintDirty = true;   // redraw the static hint only when needed

// Cached element handles + last-written values — updateHUD runs every frame,
// so DOM queries and unconditional writes are banned from it.
let els = null;
const last = { s0: -1, s1: -1, ab0: '', ab1: '', sog0: -1, sog1: -1,
               csec: -1, period: -1, col0: '', col1: '',
               fire0: -1, fire1: -1, turbo: -1, low: null, charging: null };

export function initHUD() {
  goalFlashEl = document.getElementById('goal-flash');
  fireL = document.getElementById('fire-fill-left');
  fireR = document.getElementById('fire-fill-right');
  turboFill = document.getElementById('turbo-fill');
  shotWrap = document.getElementById('shotpower-wrap');
  shotFill = document.getElementById('shotpower-fill');
  const blocks = document.querySelectorAll('.team-score-block');
  els = {
    scoreL: document.getElementById('score-left'),
    scoreR: document.getElementById('score-right'),
    abbrL:  document.getElementById('team-abbr-left'),
    abbrR:  document.getElementById('team-abbr-right'),
    shotsL: document.getElementById('shots-left'),
    shotsR: document.getElementById('shots-right'),
    clock:  document.getElementById('clock'),
    period: document.getElementById('period-label'),
    blockL: blocks[0],
    blockR: blocks[1],
  };
  last.s0 = -1; last.s1 = -1; last.csec = -1;   // force a full repaint

  const overlay = document.getElementById('font-overlay');
  if (overlay) {
    fontW = overlay.width  = window.innerWidth;
    fontH = overlay.height = window.innerHeight;
    fontCtx = overlay.getContext('2d');
    window.addEventListener('resize', () => {
      fontW = overlay.width  = window.innerWidth;   // resizing clears the canvas
      fontH = overlay.height = window.innerHeight;
      hintDirty = true;
    });
  }
}

export function updateHUD(state, dt) {
  // Score + team labels — write only on change (DOM writes invalidate style/layout)
  if (state.score[0] !== last.s0) { els.scoreL.textContent = state.score[0]; last.s0 = state.score[0]; }
  if (state.score[1] !== last.s1) { els.scoreR.textContent = state.score[1]; last.s1 = state.score[1]; }
  if (state.teams[0].abbr !== last.ab0) { els.abbrL.textContent = state.teams[0].abbr; last.ab0 = state.teams[0].abbr; }
  if (state.teams[1].abbr !== last.ab1) { els.abbrR.textContent = state.teams[1].abbr; last.ab1 = state.teams[1].abbr; }
  if (state.shots) {
    if (state.shots[0] !== last.sog0) { els.shotsL.textContent = 'SOG ' + state.shots[0]; last.sog0 = state.shots[0]; }
    if (state.shots[1] !== last.sog1) { els.shotsR.textContent = 'SOG ' + state.shots[1]; last.sog1 = state.shots[1]; }
  }

  // Team accent colors on score blocks (change only on new teams)
  const c0 = state.teams[0].colors.primary, c1 = state.teams[1].colors.primary;
  if (c0 !== last.col0) { els.blockL.style.borderBottom = `3px solid ${c0}`; last.col0 = c0; }
  if (c1 !== last.col1) { els.blockR.style.borderBottom = `3px solid ${c1}`; last.col1 = c1; }

  // Clock — the text changes once per second, so write once per second
  const csec = Math.max(0, Math.floor(state.clock));
  if (csec !== last.csec) {
    const mins = Math.floor(csec / 60), secs = csec % 60;
    els.clock.textContent = `${mins}:${secs.toString().padStart(2, '0')}`;
    last.csec = csec;
  }
  if (state.period !== last.period) {
    els.period.textContent = `PERIOD ${state.period}`;
    last.period = state.period;
  }

  // Fire meters (quantized to whole % so idle frames write nothing)
  const f0 = Math.round(state.fireMeter[0] * 100), f1 = Math.round(state.fireMeter[1] * 100);
  if (fireL && f0 !== last.fire0) { fireL.style.width = f0 + '%'; last.fire0 = f0; }
  if (fireR && f1 !== last.fire1) { fireR.style.width = f1 + '%'; last.fire1 = f1; }

  // Turbo meter (human player)
  if (turboFill) {
    const t = Math.round(Math.max(0, Math.min(1, state.turbo ?? 1)) * 100);
    if (t !== last.turbo) {
      turboFill.style.width = t + '%';
      const low = t < 25;
      if (low !== last.low) { turboFill.classList.toggle('low', low); last.low = low; }
      last.turbo = t;
    }
  }

  // Shot power meter — only visible while loading a shot
  if (shotWrap && shotFill) {
    const c = state.shotCharge ?? 0;
    const charging = c > 0;
    if (charging !== last.charging) { shotWrap.classList.toggle('show', charging); last.charging = charging; }
    if (charging) {
      shotFill.style.width = (c * 100) + '%';
      shotFill.classList.toggle('full', c >= 0.99);
    }
  }

  // Goal flash
  if (goalFlashTimer > 0) {
    goalFlashTimer -= dt;
    if (goalFlashEl) goalFlashEl.classList.add('show');
  } else {
    if (goalFlashEl) goalFlashEl.classList.remove('show');
  }

  // Bitmap font overlay — static hint, drawn once (not every frame)
  if (fontCtx && discFont.ready && hintDirty) {
    fontCtx.clearRect(0, 0, fontW, fontH);
    const hint = 'WASD MOVE  SHIFT TURBO  SPACE SHOOT  F PASS  Q CALL  Z CHECK  C SPIN';
    discFont.drawCentered(fontCtx, hint, fontW / 2, fontH - 22, 1, 'rgba(255,200,100,0.35)');
    hintDirty = false;
  }
}

export function flashGoal(teamName, scorer = '') {
  goalFlashTimer = 2.0;
  if (goalFlashEl) {
    document.getElementById('goal-text').textContent = 'GOAL!';
    const s = document.getElementById('goal-scorer');
    if (s) s.textContent = scorer;
  }
}
