// STARSHARD — the wiring: canvas sizing, the fixed-step loop, the screen state
// machine (title → play → upgrade → victory / game over), sounds on events,
// the best score in localStorage, and the ?shot= scenes the screenshots use.
import { FIELD, STEP, UPGRADE_CARD } from './config.js';
import { createRandom } from './random.js';
import { createInput } from './input.js';
import { createWorld, resetWorld, startWave, stepWorld, applyUpgradeChoice, EVENT } from './world.js';
import { drawGame, SCREEN } from './render.js';
import { stageShot } from './shots.js';
import {
  unlockAudio, startMusic, setMuted, isMuted,
  playShoot, playEnemyHit, playExplosion, playPickup, playPlayerHit,
  playUpgrade, playBossAlarm, playVictory, playGameOver, playWaveClear,
} from './audio.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const statusEl = document.getElementById('status');
const params = new URLSearchParams(window.location.search);
const shotName = params.get('shot');
const shotSeed = Number(params.get('seed') ?? 1) || 1;

const input = createInput(canvas);
const world = createWorld(createRandom(20261116));
let screen = SCREEN.TITLE;
let best = 0;
try { best = Number(window.localStorage.getItem('starshard-best') ?? 0) || 0; } catch { best = 0; }

function saveBest() {
  if (world.score > best) {
    best = world.score;
    try { window.localStorage.setItem('starshard-best', String(best)); } catch { /* private mode */ }
  }
}

function setStatus(text) {
  if (statusEl) statusEl.textContent = text;
}

// Canvas fills the window; the 1280×720 field is letterboxed inside it.
function resize() {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const w = window.innerWidth;
  const h = window.innerHeight;
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  canvas.style.width = `${w}px`;
  canvas.style.height = `${h}px`;
  const scale = Math.min(w / FIELD.width, h / FIELD.height);
  const offsetX = (w - FIELD.width * scale) / 2;
  const offsetY = (h - FIELD.height * scale) / 2;
  input.setTransform(scale, offsetX, offsetY);
  ctx.setTransform(dpr * scale, 0, 0, dpr * scale, dpr * offsetX, dpr * offsetY);
}
window.addEventListener('resize', resize);
resize();

// Upgrade cards live at the geometry config.js defines (UPGRADE_CARD), shared
// with render.js: the hit-test always matches where the cards are drawn.
const CARD = UPGRADE_CARD;
function cardAt(x, y) {
  const totalW = CARD.w * 3 + CARD.gap * 2;
  const x0 = (FIELD.width - totalW) / 2;
  if (y < CARD.y || y > CARD.y + CARD.h) return -1;
  for (let i = 0; i < 3; i += 1) {
    const cx = x0 + i * (CARD.w + CARD.gap);
    if (x >= cx && x <= cx + CARD.w) return i;
  }
  return -1;
}

function startGame() {
  unlockAudio();
  startMusic();
  resetWorld(world);
  startWave(world, 1);
  screen = SCREEN.PLAY;
  setStatus('Playing Starshard. Survive ten waves and destroy the Void Heart.');
}

function handleEvents(events) {
  for (const event of events) {
    if (event === EVENT.SHOOT) playShoot();
    else if (event === EVENT.ENEMY_HIT) playEnemyHit();
    else if (event === EVENT.EXPLODE) playExplosion(false);
    else if (event === EVENT.EXPLODE_BIG) playExplosion(true);
    else if (event === EVENT.PICKUP) playPickup();
    else if (event === EVENT.PLAYER_HIT) playPlayerHit();
    else if (event === EVENT.BOSS) playBossAlarm();
    else if (event === EVENT.WAVE_CLEAR) {
      playWaveClear();
      screen = SCREEN.UPGRADE;
      setStatus('Wave cleared. Choose an upgrade.');
    } else if (event === EVENT.VICTORY) {
      saveBest();
      playVictory();
      screen = SCREEN.VICTORY;
      setStatus(`Victory! Final score ${world.score}. Press R to play again.`);
    } else if (event === EVENT.GAME_OVER) {
      saveBest();
      playGameOver();
      screen = SCREEN.OVER;
      setStatus(`Game over on wave ${world.wave}. Score ${world.score}. Press R to retry.`);
    }
  }
}

// Screenshot mode: stage the named scene once, draw it, and signal readiness.
// No loop, no audio, no input — the frame is the deterministic scene itself.
// Read-only introspection for play-testing (used by the screenshot driver and
// by automated play-tests): the live world and the current screen, nothing more.
window.__starshard = {
  get world() { return world; },
  get screen() { return screen; },
  get best() { return best; },
};

if (shotName) {
  const staged = stageShot(shotName, world, shotSeed);
  screen = staged.screen;
  best = staged.best;
  resize();
  drawGame(ctx, world, screen, best);
  window.__shotReady = true;
  window.__shotScreen = screen;
} else {
  let last = performance.now();
  let accumulator = 0;

  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;

    // One-shot keys (takePressed fires once per physical keydown).
    if (input.takePressed('p') || input.takePressed('Escape')) {
      if (screen === SCREEN.PLAY) {
        screen = SCREEN.PAUSED;
        setStatus('Paused. Press P to resume.');
      } else if (screen === SCREEN.PAUSED) {
        screen = SCREEN.PLAY;
      }
    }
    if (input.takePressed('m')) setMuted(!isMuted());
    if (input.takePressed('r') && (screen === SCREEN.VICTORY || screen === SCREEN.OVER)) startGame();

    if (screen === SCREEN.TITLE) {
      // Ambient drift behind the title.
      world.time += dt;
      if (input.takeClick() || input.takePressed('Enter')) startGame();
    } else if (screen === SCREEN.UPGRADE) {
      world.upgradeHover = cardAt(input.mouse.x, input.mouse.y);
      let picked = -1;
      if (input.takeClick()) picked = cardAt(input.mouse.x, input.mouse.y);
      if (input.takePressed('1')) picked = 0;
      if (input.takePressed('2')) picked = 1;
      if (input.takePressed('3')) picked = 2;
      if (picked >= 0 && world.upgradeChoices[picked]) {
        const choice = applyUpgradeChoice(world, picked);
        if (choice) {
          playUpgrade();
          startWave(world, world.wave + 1);
          screen = SCREEN.PLAY;
          setStatus(`Wave ${world.wave}. Upgrade taken: ${choice.name}.`);
        }
      }
    } else if (screen === SCREEN.PLAY) {
      accumulator += dt;
      while (accumulator >= STEP) {
        accumulator -= STEP;
        const events = stepWorld(world, input, STEP);
        handleEvents(events);
        if (screen !== SCREEN.PLAY) break;
      }
      input.takeClick();
    } else if (screen === SCREEN.PAUSED) {
      input.takeClick();
    }
    // Victory / game-over screens idle: the world keeps its particles still.
    drawGame(ctx, world, screen, best, isMuted());
  }
  requestAnimationFrame(frame);
}
