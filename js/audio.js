// WebAudio-synthesized SFX — no asset files. Every sound is generated from
// oscillators + filtered noise. The AudioContext is created lazily and resumed
// on the first user gesture (browser autoplay policy). Everything routes through
// a master gain → compressor, so volume/mute are global and instant.

let ctx = null, master = null, crowdGain = null, crowdSrc = null;
let volume = parseFloat(localStorage.getItem('hitz_vol'));
if (Number.isNaN(volume)) volume = 0.7;
let muted = localStorage.getItem('hitz_muted') === '1';

function ensure() {
  if (ctx) return ctx;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  ctx = new AC();
  master = ctx.createGain();
  master.gain.value = muted ? 0 : volume;
  const comp = ctx.createDynamicsCompressor();   // glue + limit peaks
  master.connect(comp); comp.connect(ctx.destination);
  return ctx;
}

export function unlockAudio() { const c = ensure(); if (c && c.state === 'suspended') c.resume(); }
export function getVolume() { return volume; }
export function setVolume(v) { volume = v; try { localStorage.setItem('hitz_vol', v); } catch {} if (master && !muted) master.gain.value = v; }
export function isMuted() { return muted; }
export function setMuted(m) { muted = m; try { localStorage.setItem('hitz_muted', m ? '1' : '0'); } catch {} if (master) master.gain.value = m ? 0 : volume; }

// ── synthesis helpers ──
function noiseBuffer(dur) {
  const c = ensure(); const n = Math.max(1, Math.floor(c.sampleRate * dur));
  const buf = c.createBuffer(1, n, c.sampleRate); const d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
  return buf;
}
// percussive (attack → decay) gain envelope
function pEnv(g, t0, peak, attack, dur, release) {
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(peak, t0 + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur + release);
}
// sustained (attack → hold → release) gain envelope
function sEnv(g, t0, peak, attack, hold, release) {
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(peak, t0 + attack);
  g.gain.setValueAtTime(peak, t0 + attack + hold);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + attack + hold + release);
}
function tone(freq, t0, dur, type, peak, slideTo) {
  const c = ensure(); const o = c.createOscillator(), g = c.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t0);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
  pEnv(g, t0, peak, 0.005, dur, 0.04);
  o.connect(g); g.connect(master); o.start(t0); o.stop(t0 + dur + 0.1);
}
function toneSustain(freq, t0, attack, hold, release, type, peak) {
  const c = ensure(); const o = c.createOscillator(), g = c.createGain();
  o.type = type; o.frequency.value = freq;
  sEnv(g, t0, peak, attack, hold, release);
  o.connect(g); g.connect(master); o.start(t0); o.stop(t0 + attack + hold + release + 0.1);
}
function noiseHit(t0, dur, peak, filterType, freq, q) {
  const c = ensure(); const s = c.createBufferSource(); s.buffer = noiseBuffer(dur + 0.05);
  const f = c.createBiquadFilter(); f.type = filterType; f.frequency.value = freq; if (q) f.Q.value = q;
  const g = c.createGain(); pEnv(g, t0, peak, 0.003, dur, 0.03);
  s.connect(f); f.connect(g); g.connect(master); s.start(t0); s.stop(t0 + dur + 0.1);
}

function crowdSwell(mult, dur) {
  if (!crowdGain) return; const t = ctx.currentTime;
  crowdGain.gain.cancelScheduledValues(t);
  crowdGain.gain.setValueAtTime(Math.max(0.0001, crowdGain.gain.value), t);
  crowdGain.gain.linearRampToValueAtTime(0.05 * mult, t + 0.08);
  crowdGain.gain.exponentialRampToValueAtTime(0.05, t + dur);
}

// ── public SFX ──
export const sfx = {
  shot() { const c = ensure(); if (!c) return; const t = c.currentTime;
    noiseHit(t, 0.05, 0.5, 'bandpass', 1600, 1.5); tone(420, t, 0.06, 'square', 0.18, 160); },
  oneTimer() { const c = ensure(); if (!c) return; const t = c.currentTime;
    noiseHit(t, 0.07, 0.7, 'bandpass', 1800, 1.2); tone(520, t, 0.12, 'sawtooth', 0.26, 140); },
  hit() { const c = ensure(); if (!c) return; const t = c.currentTime;
    noiseHit(t, 0.12, 0.6, 'lowpass', 350, 0.7); tone(90, t, 0.12, 'sine', 0.35, 55); },
  bigHit() { const c = ensure(); if (!c) return; const t = c.currentTime;
    noiseHit(t, 0.18, 0.95, 'lowpass', 300, 0.7); noiseHit(t, 0.10, 0.5, 'bandpass', 900, 1);
    tone(70, t, 0.22, 'sine', 0.6, 42); tone(140, t + 0.02, 0.18, 'square', 0.18, 70); crowdSwell(1.4, 0.7); },
  save() { const c = ensure(); if (!c) return; const t = c.currentTime;
    noiseHit(t, 0.09, 0.45, 'lowpass', 520, 0.8); tone(240, t, 0.1, 'triangle', 0.18, 180); },
  whistle() { const c = ensure(); if (!c) return; const t = c.currentTime;
    const chirp = tt => { tone(2300, tt, 0.16, 'sine', 0.3, 2520); noiseHit(tt, 0.16, 0.05, 'bandpass', 2400, 6); };
    chirp(t); chirp(t + 0.22); },
  board() { const c = ensure(); if (!c) return; const t = c.currentTime;
    noiseHit(t, 0.04, 0.4, 'bandpass', 1200, 2); tone(180, t, 0.05, 'square', 0.12, 120); },
  catch() { const c = ensure(); if (!c) return; const t = c.currentTime;   // puck onto the blade — soft thwack
    noiseHit(t, 0.045, 0.35, 'bandpass', 700, 1.2); tone(300, t, 0.05, 'sine', 0.12, 210); },
  goal() { const c = ensure(); if (!c) return; const t = c.currentTime;
    [110, 146.8, 220].forEach(f => toneSustain(f, t, 0.06, 0.95, 0.45, 'sawtooth', 0.3));
    toneSustain(330, t, 0.06, 0.9, 0.4, 'square', 0.1); crowdSwell(2.6, 1.8); },
  buzzer() { const c = ensure(); if (!c) return; const t = c.currentTime;
    toneSustain(170, t, 0.01, 0.9, 0.1, 'square', 0.4); toneSustain(172, t, 0.01, 0.9, 0.1, 'square', 0.4); },
  onFire() { const c = ensure(); if (!c) return; const t = c.currentTime;
    noiseHit(t, 0.5, 0.3, 'highpass', 400, 0.7); tone(70, t, 0.5, 'sine', 0.4, 180); crowdSwell(1.8, 1.0); },

  // ── crowd ambience bed ──
  startCrowd() { const c = ensure(); if (!c || crowdSrc) return;
    crowdSrc = c.createBufferSource(); crowdSrc.buffer = noiseBuffer(2); crowdSrc.loop = true;
    const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 480; f.Q.value = 0.4;
    crowdGain = c.createGain(); crowdGain.gain.value = 0.05;
    crowdSrc.connect(f); f.connect(crowdGain); crowdGain.connect(master); crowdSrc.start();
  },
  stopCrowd() { if (crowdSrc) { try { crowdSrc.stop(); } catch {} crowdSrc.disconnect(); crowdSrc = null; crowdGain = null; } },
};
