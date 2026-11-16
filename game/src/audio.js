// STARSHARD — all sound is synthesized live with WebAudio: no audio files, no
// network, nothing to load. Each effect is one small function so the game can
// call playShoot() or playExplosion() and get instant feedback. Music is a quiet
// bass pulse plus a soft pad that starts on the first user gesture.
let context = null;
let master = null;
let musicNodes = null;
let muted = false;

function ensureContext() {
  if (context) {
    if (context.state === 'suspended') void context.resume();
    return context;
  }
  const AudioContext = window.AudioContext ?? window.webkitAudioContext;
  if (!AudioContext) return null;
  context = new AudioContext();
  master = context.createGain();
  master.gain.value = muted ? 0 : 0.5;
  master.connect(context.destination);
  return context;
}

/** Call from a user gesture (start button / key) so the browser allows audio. */
export function unlockAudio() {
  ensureContext();
}

export function setMuted(value) {
  muted = value;
  if (master && context) master.gain.setTargetAtTime(value ? 0 : 0.5, context.currentTime, 0.02);
}
export function isMuted() { return muted; }

function tone({ type = 'sine', from = 440, to = null, seconds = 0.15, volume = 0.2, delay = 0 }) {
  const ctx = ensureContext();
  if (!ctx) return;
  const t0 = ctx.currentTime + delay;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(from, t0);
  if (to !== null) osc.frequency.exponentialRampToValueAtTime(Math.max(1, to), t0 + seconds);
  gain.gain.setValueAtTime(volume, t0);
  gain.gain.exponentialRampToValueAtTime(0.001, t0 + seconds);
  osc.connect(gain).connect(master);
  osc.start(t0);
  osc.stop(t0 + seconds + 0.02);
}

function noise({ seconds = 0.3, volume = 0.25, lowpass = 1200, delay = 0 }) {
  const ctx = ensureContext();
  if (!ctx) return;
  const t0 = ctx.currentTime + delay;
  const length = Math.max(1, Math.floor(ctx.sampleRate * seconds));
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = lowpass;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(volume, t0);
  gain.gain.exponentialRampToValueAtTime(0.001, t0 + seconds);
  source.connect(filter).connect(gain).connect(master);
  source.start(t0);
}

export function playShoot() { tone({ type: 'square', from: 880, to: 520, seconds: 0.07, volume: 0.08 }); }
export function playEnemyHit() { tone({ type: 'triangle', from: 320, to: 180, seconds: 0.06, volume: 0.1 }); }
export function playExplosion(big = false) {
  noise({ seconds: big ? 0.6 : 0.3, volume: big ? 0.4 : 0.22, lowpass: big ? 900 : 1600 });
  tone({ type: 'sine', from: big ? 160 : 220, to: 40, seconds: big ? 0.5 : 0.3, volume: 0.25 });
}
export function playPickup() {
  tone({ type: 'sine', from: 660, seconds: 0.08, volume: 0.14 });
  tone({ type: 'sine', from: 990, seconds: 0.1, volume: 0.14, delay: 0.07 });
}
export function playPlayerHit() {
  noise({ seconds: 0.25, volume: 0.3, lowpass: 700 });
  tone({ type: 'sawtooth', from: 140, to: 60, seconds: 0.25, volume: 0.22 });
}
export function playUpgrade() {
  [523, 659, 784, 1047].forEach((freq, i) => tone({ type: 'sine', from: freq, seconds: 0.18, volume: 0.16, delay: i * 0.07 }));
}
export function playBossAlarm() {
  tone({ type: 'sawtooth', from: 110, to: 220, seconds: 0.5, volume: 0.2 });
  tone({ type: 'sawtooth', from: 110, to: 220, seconds: 0.5, volume: 0.2, delay: 0.55 });
}
export function playVictory() {
  [523, 659, 784, 1047, 1319].forEach((freq, i) => tone({ type: 'triangle', from: freq, seconds: 0.3, volume: 0.18, delay: i * 0.11 }));
}
export function playGameOver() {
  [392, 330, 262, 196].forEach((freq, i) => tone({ type: 'triangle', from: freq, seconds: 0.35, volume: 0.18, delay: i * 0.16 }));
}
export function playWaveClear() {
  tone({ type: 'sine', from: 784, seconds: 0.12, volume: 0.15 });
  tone({ type: 'sine', from: 1047, seconds: 0.18, volume: 0.15, delay: 0.1 });
}

/** A quiet two-bar bass pulse with a soft pad. Started once, looped by timer. */
export function startMusic() {
  const ctx = ensureContext();
  if (!ctx || musicNodes) return;
  const padGain = ctx.createGain();
  padGain.gain.value = 0.05;
  padGain.connect(master);
  const pad = ctx.createOscillator();
  pad.type = 'sawtooth';
  pad.frequency.value = 55;
  const padFilter = ctx.createBiquadFilter();
  padFilter.type = 'lowpass';
  padFilter.frequency.value = 220;
  pad.connect(padFilter).connect(padGain);
  pad.start();
  const bassNotes = [55, 55, 65.41, 49];
  let step = 0;
  const timer = window.setInterval(() => {
    if (muted || !context) return;
    tone({ type: 'sine', from: bassNotes[step % bassNotes.length], seconds: 0.4, volume: 0.12 });
    step += 1;
  }, 500);
  musicNodes = { pad, timer };
}

export function stopMusic() {
  if (!musicNodes) return;
  try { musicNodes.pad.stop(); } catch { /* already stopped */ }
  window.clearInterval(musicNodes.timer);
  musicNodes = null;
}
