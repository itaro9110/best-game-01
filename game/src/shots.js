// STARSHARD — the screenshot scenes behind ?shot=title|play|upgrade|victory.
// Each scene plays the real rules forward from a fresh world for a fixed number
// of steps, steered by an autopilot that kites the swarm, chases shards and
// aims at the nearest threat, so the frame is what a real game looks like and
// the same seed always gives the same frame. The victory scene runs a hero
// loadout — the strongest build ten upgrade drafts can make — through all ten
// waves until the Void Heart dies.
import { FIELD, STEP } from './config.js';
import { createWorld, resetWorld, startWave, stepWorld, applyUpgradeChoice, applyHeroLoadout } from './world.js';
import { createRandom } from './random.js';
import { SCREEN } from './render.js';

const SAMPLE = STEP;

/** Steer the ship: avoid close threats, chase nearby shards, keep range. */
export function autopilotInput(world) {
  const p = world.player;
  let mx = 0;
  let my = 0;
  // Repulsion from close enemies.
  for (const e of world.enemies) {
    const dx = p.x - e.x;
    const dy = p.y - e.y;
    const dist = Math.hypot(dx, dy) || 1;
    if (dist < 170) {
      const w = (170 - dist) / 170;
      mx += (dx / dist) * w * 1.6;
      my += (dy / dist) * w * 1.6;
    }
  }
  // Attraction to the nearest shard, when it is safe-ish.
  let shard = null;
  let shardDist = Infinity;
  for (const s of world.shards) {
    const d = Math.hypot(s.x - p.x, s.y - p.y);
    if (d < shardDist) {
      shardDist = d;
      shard = s;
    }
  }
  if (shard && shardDist < 280) {
    mx += ((shard.x - p.x) / shardDist) * 0.7;
    my += ((shard.y - p.y) / shardDist) * 0.7;
  }
  // Stay inside the field, with a gentle pull back toward the centre so the
  // pilot never gets pinned in a corner by the swarm.
  const margin = 90;
  if (p.x < margin) mx += 1;
  if (p.x > FIELD.width - margin) mx -= 1;
  if (p.y < margin) my += 1;
  if (p.y > FIELD.height - margin) my -= 1;
  mx += ((FIELD.width / 2 - p.x) / FIELD.width) * 0.5;
  my += ((FIELD.height / 2 - p.y) / FIELD.height) * 0.5;
  // Aim at the most dangerous enemy: boss first, then weavers, then nearest.
  let target = null;
  let targetRank = -1;
  for (const e of world.enemies) {
    const rank = e.kind === 'boss' || e.kind === 'finalBoss' ? 3 : e.kind === 'weaver' ? 2 : 1;
    const d = Math.hypot(e.x - p.x, e.y - p.y);
    const score = rank * 1000 - d;
    if (score > targetRank) {
      targetRank = score;
      target = e;
    }
  }
  const aim = target
    ? { x: target.x + target.vx * 0.12, y: target.y + target.vy * 0.12 }
    : { x: p.x, y: p.y - 100 };
  const threshold = (v) => (v > 0.25 ? 1 : v < -0.25 ? -1 : 0);
  return {
    moveX: () => threshold(mx),
    moveY: () => threshold(my),
    firing: () => target !== null,
    mouse: aim,
  };
}

export function stepFor(world, seconds) {
  const steps = Math.round(seconds / SAMPLE);
  for (let i = 0; i < steps; i += 1) {
    stepWorld(world, autopilotInput(world), SAMPLE);
    if (world.over || world.won) break;
    // Nothing left to fight: the wave is cleared, stop early.
    if (!world.waveActive && world.enemies.length === 0 && world.spawnQueue.length === 0) break;
  }
}

/**
 * Set `world` to the named scene and return the screen to draw and the best
 * score to show. `seed` picks the deterministic run for the scene.
 */
export function stageShot(name, world, seed = 1) {
  resetWorld(world);
  // A fresh stream per scene: the same seed always stages the same frame.
  world.random = createRandom(seed * 2654435761);
  if (name === 'title') {
    // Attract mode: the pilot parks in the bottom-left corner and watches the
    // swarm drift, so the ship never smudges the title or the CTA.
    const parked = {
      moveX: () => 0,
      moveY: () => 0,
      firing: () => false,
      mouse: { x: world.player.x, y: world.player.y - 100 },
    };
    world.player.invuln = 999;
    world.player.x = 180;
    world.player.y = 620;
    world.player.vx = 0;
    world.player.vy = 0;
    startWave(world, 1);
    for (let i = 0; i < Math.round(5 / SAMPLE); i += 1) stepWorld(world, parked, SAMPLE);
    world.player.invuln = 0;
    // Floating combat text would smudge the title: keep the particles, drop it.
    world.texts = [];
    return { screen: SCREEN.TITLE, best: 0 };
  }
  if (name === 'play') {
    // The boss fight, wave 5: the Void Maw, its radial bullet rings, escorts
    // closing in and the HUD mid-battle — the densest, most varied frame.
    // Clear waves 1-4 first, then catch wave 5 once the boss is on screen.
    for (let wave = 1; wave <= 4; wave += 1) {
      startWave(world, wave);
      stepFor(world, 40);
      if (world.over || world.upgradeChoices.length === 0) break;
      applyUpgradeChoice(world, 0);
    }
    if (!world.over) {
      startWave(world, 5);
      // Step in quarter-second chunks and stop at a busy frame with the boss
      // banner already gone, so the banner never covers the fight. The boss
      // spawns late (the spawn queue trickles first) and the autopilot kites
      // to the left edge, so there is no "central" requirement: the boss, its
      // escorts and its bullet rings are the visual anchor, wherever the ship
      // happens to be. With the canonical seed the frame lands ~2s after the
      // banner expires: boss ~80% HP, ~7 escorts alive.
      for (let i = 0; i < 100; i += 1) {
        stepFor(world, 0.25);
        if (world.over || world.won) break;
        if (world.boss && world.enemies.length >= 5 && !world.banner) break;
        if (!world.waveActive && world.enemies.length === 0) break;
      }
    }
    return { screen: world.over ? SCREEN.OVER : SCREEN.PLAY, best: 0 };
  }
  if (name === 'upgrade') {
    // A mid-game draft, not the wave-1 one: clear waves 1-3 first so the cards
    // can include the build-defining picks (Split Barrel, Piercing Rounds…).
    // Apply the draft after waves 1-2 only: the wave-3 draft is the one the
    // screenshot shows, and applying it would consume the cards.
    for (let wave = 1; wave <= 3; wave += 1) {
      startWave(world, wave);
      stepFor(world, 40);
      if (world.over || world.upgradeChoices.length === 0) break;
      if (wave < 3) applyUpgradeChoice(world, 0);
    }
    // No leftover combat text or particles smudging the cards.
    world.texts = [];
    world.particles = [];
    return { screen: world.over ? SCREEN.OVER : SCREEN.UPGRADE, best: 0 };
  }
  if (name === 'victory') {
    // A hero build through all ten waves until the Void Heart dies.
    applyHeroLoadout(world);
    for (let wave = 1; wave <= 10; wave += 1) {
      startWave(world, wave);
      stepFor(world, 75);
      if (world.over || world.won) break;
      if (world.upgradeChoices.length > 0) {
        applyUpgradeChoice(world, 0);
      } else if (!world.won) {
        break; // stuck: the pilot could not clear the wave in time
      }
    }
    if (world.won) {
      // A clean end screen: no live bullets, particles or combat text behind it.
      world.bullets = [];
      world.enemyBullets = [];
      world.particles = [];
      world.texts = [];
    }
    return { screen: world.won ? SCREEN.VICTORY : SCREEN.OVER, best: world.won ? world.score : 0, won: world.won };
  }
  return { screen: SCREEN.TITLE, best: 0 };
}

/** A fresh world wired for a scene: same seed, same frame, every time. */
export function createSceneWorld(random) {
  return createWorld(random);
}
