// STARSHARD — the simulation. Everything that happens in the game lives here:
// the player ship, the void swarm, bullets, shards, waves, the boss, upgrades,
// collisions, scoring and the combo chain. Rendering never touches these rules,
// and this file never touches the canvas: the same step runs in the browser,
// in the autopilot and in the screenshot scenes.
import { FIELD, PLAYER, ENEMY, WAVES, UPGRADES, COMBO, STEP } from './config.js';

export const EVENT = {
  SHOOT: 'shoot',
  ENEMY_HIT: 'enemyHit',
  EXPLODE: 'explode',
  EXPLODE_BIG: 'explodeBig',
  PICKUP: 'pickup',
  PLAYER_HIT: 'playerHit',
  WAVE_CLEAR: 'waveClear',
  BOSS: 'boss',
  VICTORY: 'victory',
  GAME_OVER: 'gameOver',
};

export function createWorld(random) {
  const world = {
    random,
    time: 0,
    wave: 0,
    score: 0,
    kills: 0,
    shardsCollected: 0,
    combo: 0,
    comboTimer: 0,
    player: null,
    enemies: [],
    bullets: [],
    enemyBullets: [],
    shards: [],
    pickups: [],
    particles: [],
    texts: [],
    spawnQueue: [],
    spawnTimer: 0,
    waveActive: false,
    boss: null,
    upgradeChoices: [],
    shake: 0,
    flash: 0,
    banner: null,
    events: [],
    over: false,
    won: false,
  };
  resetPlayer(world);
  return world;
}

export function resetPlayer(world) {
  world.player = {
    x: FIELD.width / 2,
    y: FIELD.height / 2,
    vx: 0,
    vy: 0,
    angle: -Math.PI / 2,
    radius: PLAYER.radius,
    hp: PLAYER.maxHp,
    maxHp: PLAYER.maxHp,
    shield: false,
    maxShield: false,
    damage: PLAYER.baseDamage,
    fireRate: PLAYER.baseFireRate,
    projectiles: PLAYER.baseProjectiles,
    pierce: PLAYER.basePierce,
    crit: PLAYER.baseCrit,
    magnet: PLAYER.baseMagnet,
    maxSpeed: PLAYER.maxSpeed,
    fireCooldown: 0,
    invuln: 0,
  };
}

export function resetWorld(world) {
  world.time = 0;
  world.wave = 0;
  world.score = 0;
  world.kills = 0;
  world.shardsCollected = 0;
  world.combo = 0;
  world.comboTimer = 0;
  world.enemies = [];
  world.bullets = [];
  world.enemyBullets = [];
  world.shards = [];
  world.pickups = [];
  world.particles = [];
  world.texts = [];
  world.spawnQueue = [];
  world.spawnTimer = 0;
  world.waveActive = false;
  world.boss = null;
  world.upgradeChoices = [];
  world.shake = 0;
  world.flash = 0;
  world.banner = null;
  world.events = [];
  world.over = false;
  world.won = false;
  resetPlayer(world);
}

/** Start wave `n` (1..10): fill the spawn queue and announce it. */
export function startWave(world, n) {
  world.wave = n;
  world.waveActive = true;
  const kinds = WAVES.unlocks(n);
  const count = WAVES.count(n);
  world.spawnQueue = [];
  for (let i = 0; i < count; i += 1) {
    // Later waves weight the tougher kinds more heavily.
    const roll = world.random.next();
    let kind = 'mite';
    if (n >= 4 && roll > 0.72) kind = 'dasher';
    else if (n >= 3 && roll > 0.55) kind = 'splitter';
    else if (n >= 2 && roll > 0.38) kind = 'weaver';
    if (!kinds.includes(kind)) kind = 'mite';
    world.spawnQueue.push(kind);
  }
  if (WAVES.bossWaves.includes(n)) {
    world.spawnQueue.push(n === 10 ? 'finalBoss' : 'boss');
  }
  world.spawnTimer = 0.8;
  world.banner = { text: n === 10 ? 'FINAL WAVE' : `WAVE ${n}`, sub: WAVES.bossWaves.includes(n) ? 'Something huge approaches…' : '', t: 2.2 };
}

function spawnEdgePoint(world) {
  const r = world.random;
  const side = r.int(0, 3);
  const margin = 30;
  if (side === 0) return { x: r.range(margin, FIELD.width - margin), y: margin };
  if (side === 1) return { x: r.range(margin, FIELD.width - margin), y: FIELD.height - margin };
  if (side === 2) return { x: margin, y: r.range(margin, FIELD.height - margin) };
  return { x: FIELD.width - margin, y: r.range(margin, FIELD.height - margin) };
}

function spawnEnemy(world, kind) {
  const def = ENEMY[kind];
  const at = spawnEdgePoint(world);
  const scale = 1 + (world.wave - 1) * 0.08; // later waves: tougher swarm
  const enemy = {
    kind,
    x: at.x,
    y: at.y,
    vx: 0,
    vy: 0,
    hp: def.hp * scale,
    maxHp: def.hp * scale,
    radius: def.radius,
    speed: def.speed * world.random.range(0.9, 1.1),
    score: def.score,
    color: def.color,
    contact: def.contact,
    age: 0,
    shootCooldown: world.random.range(1, 2.2),
    dashCooldown: world.random.range(1.5, 2.5),
    dashState: 'chase',
    dashTimer: 0,
    dashX: 0,
    dashY: 0,
    angle: 0,
    attackTimer: 2,
    spawnTimer: 0,
  };
  world.enemies.push(enemy);
  if (kind === 'boss' || kind === 'finalBoss') {
    world.boss = enemy;
    world.events.push(EVENT.BOSS);
    world.banner = { text: kind === 'finalBoss' ? 'VOID HEART' : 'VOID MAW', sub: 'Destroy it to win', t: 2.5 };
  }
  return enemy;
}

/** Roll three distinct upgrade cards for the between-wave draft. */
export function rollUpgradeChoices(world) {
  const pool = [...UPGRADES];
  world.upgradeChoices = [];
  for (let i = 0; i < 3; i += 1) {
    const index = Math.floor(world.random.next() * pool.length);
    world.upgradeChoices.push(pool.splice(index, 1)[0]);
  }
  return world.upgradeChoices;
}

export function applyUpgradeChoice(world, index) {
  const choice = world.upgradeChoices[index];
  if (!choice) return null;
  choice.apply(world.player);
  if (world.player.maxShield && !world.player.shield) world.player.shield = true;
  world.upgradeChoices = [];
  return choice;
}

/** The strongest build ten drafts can make: used only to stage the victory scene. */
export function applyHeroLoadout(world) {
  const byId = (id) => UPGRADES.find((u) => u.id === id);
  ['damage', 'damage', 'damage', 'firerate', 'firerate', 'split', 'split', 'pierce', 'pierce', 'crit']
    .forEach((id) => byId(id).apply(world.player));
  world.player.hp = world.player.maxHp;
}

function addText(world, x, y, text, color, size = 14) {
  // Stagger a text that would land on top of an identical one, and cap the
  // pile: overlapping damage numbers are the fastest way to look messy.
  for (const t of world.texts) {
    if (Math.abs(t.x - x) < 14 && Math.abs(t.y - y) < 14) y -= 16;
  }
  world.texts.push({ x, y, vy: -46, life: 0.9, maxLife: 0.9, text, color, size });
  if (world.texts.length > 24) world.texts.splice(0, world.texts.length - 24);
}

function burst(world, x, y, color, count, speed = 220) {
  for (let i = 0; i < count; i += 1) {
    const angle = world.random.angle();
    const v = world.random.range(speed * 0.3, speed);
    world.particles.push({
      x, y,
      vx: Math.cos(angle) * v,
      vy: Math.sin(angle) * v,
      life: world.random.range(0.3, 0.7),
      maxLife: 0.7,
      size: world.random.range(2, 5),
      color,
      drag: 0.92,
    });
  }
}

function comboMultiplier(world) {
  return Math.min(COMBO.maxMultiplier, 1 + world.combo * COMBO.perKill);
}

function damageEnemy(world, enemy, amount, isCrit) {
  enemy.hp -= amount;
  addText(world, enemy.x + world.random.range(-8, 8), enemy.y - enemy.radius, `${Math.round(amount)}`, isCrit ? '#ffd166' : '#eaf6ff', isCrit ? 18 : 13);
  if (enemy.hp > 0) {
    world.events.push(EVENT.ENEMY_HIT);
    return false;
  }
  killEnemy(world, enemy);
  return true;
}

function killEnemy(world, enemy) {
  const index = world.enemies.indexOf(enemy);
  if (index !== -1) world.enemies.splice(index, 1);
  world.kills += 1;
  world.combo += 1;
  world.comboTimer = COMBO.windowSeconds;
  const gained = Math.round(enemy.score * comboMultiplier(world));
  world.score += gained;
  addText(world, enemy.x, enemy.y, `+${gained}`, enemy.color, 16);
  burst(world, enemy.x, enemy.y, enemy.color, enemy.kind === 'boss' || enemy.kind === 'finalBoss' ? 60 : 16, enemy.kind === 'boss' ? 380 : 220);
  world.events.push(EVENT.EXPLODE);
  // Shards and pickups.
  const shardCount = enemy.kind === 'boss' || enemy.kind === 'finalBoss' ? 12 : world.random.chance(0.6) ? 1 : 0;
  for (let i = 0; i < shardCount; i += 1) {
    const angle = world.random.angle();
    world.shards.push({
      x: enemy.x, y: enemy.y,
      vx: Math.cos(angle) * world.random.range(40, 140),
      vy: Math.sin(angle) * world.random.range(40, 140),
      value: 1,
    });
  }
  if (world.random.chance(0.04)) world.pickups.push({ kind: 'heart', x: enemy.x, y: enemy.y, vx: 0, vy: 0 });
  else if (!world.player.shield && world.random.chance(0.06)) world.pickups.push({ kind: 'shield', x: enemy.x, y: enemy.y, vx: 0, vy: 0 });
  if (enemy.kind === 'splitter') {
    for (let i = 0; i < 2; i += 1) {
      const mite = spawnEnemy(world, 'mite');
      mite.x = enemy.x + world.random.range(-14, 14);
      mite.y = enemy.y + world.random.range(-14, 14);
    }
  }
  if (enemy.kind === 'boss' || enemy.kind === 'finalBoss') {
    world.boss = null;
    world.shake = Math.max(world.shake, 14);
    world.flash = 0.5;
    world.events.push(EVENT.EXPLODE_BIG);
    burst(world, enemy.x, enemy.y, '#ffffff', 40, 420);
    if (world.wave === WAVES.total) {
      world.won = true;
      world.events.push(EVENT.VICTORY);
    }
  }
}

function firePlayer(world) {
  const p = world.player;
  const spread = 0.09;
  const count = p.projectiles;
  for (let i = 0; i < count; i += 1) {
    const offset = count === 1 ? 0 : (i - (count - 1) / 2) * spread;
    const angle = p.angle + offset;
    const crit = world.random.chance(p.crit);
    world.bullets.push({
      x: p.x + Math.cos(angle) * (p.radius + 6),
      y: p.y + Math.sin(angle) * (p.radius + 6),
      vx: Math.cos(angle) * PLAYER.bulletSpeed,
      vy: Math.sin(angle) * PLAYER.bulletSpeed,
      damage: p.damage * (crit ? 2 : 1),
      pierce: p.pierce,
      crit,
      radius: PLAYER.bulletRadius,
      life: 1.1,
    });
  }
  world.events.push(EVENT.SHOOT);
  burst(world, p.x + Math.cos(p.angle) * 22, p.y + Math.sin(p.angle) * 22, '#ffe45e', 2, 90);
}

function hurtPlayer(world, amount) {
  const p = world.player;
  if (p.invuln > 0 || world.over || world.won) return;
  if (p.shield) {
    p.shield = false;
    p.invuln = PLAYER.invulnerableSeconds;
    burst(world, p.x, p.y, '#7ab8ff', 18, 260);
    world.events.push(EVENT.ENEMY_HIT);
    return;
  }
  p.hp -= amount;
  p.invuln = PLAYER.invulnerableSeconds;
  world.shake = Math.max(world.shake, 10);
  world.flash = 0.35;
  world.events.push(EVENT.PLAYER_HIT);
  if (p.hp <= 0) {
    p.hp = 0;
    world.over = true;
    burst(world, p.x, p.y, '#5ef2ff', 50, 380);
    world.events.push(EVENT.GAME_OVER);
  }
}

function stepPlayer(world, input, dt) {
  const p = world.player;
  const mx = input.moveX();
  const my = input.moveY();
  const len = Math.hypot(mx, my) || 1;
  p.vx += (mx / len) * PLAYER.accel * dt * (mx !== 0 || my !== 0 ? 1 : 0);
  p.vy += (my / len) * PLAYER.accel * dt * (mx !== 0 || my !== 0 ? 1 : 0);
  p.vx *= Math.pow(PLAYER.drag, dt * 60);
  p.vy *= Math.pow(PLAYER.drag, dt * 60);
  const speed = Math.hypot(p.vx, p.vy);
  if (speed > p.maxSpeed) {
    p.vx = (p.vx / speed) * p.maxSpeed;
    p.vy = (p.vy / speed) * p.maxSpeed;
  }
  p.x = Math.min(FIELD.width - p.radius, Math.max(p.radius, p.x + p.vx * dt));
  p.y = Math.min(FIELD.height - p.radius, Math.max(p.radius, p.y + p.vy * dt));
  p.angle = Math.atan2(input.mouse.y - p.y, input.mouse.x - p.x);
  p.fireCooldown -= dt;
  p.invuln -= dt;
  if (input.firing() && p.fireCooldown <= 0) {
    p.fireCooldown = 1 / p.fireRate;
    firePlayer(world);
  }
  // Engine trail.
  if (speed > 60 && world.random.chance(0.5)) {
    world.particles.push({
      x: p.x - Math.cos(p.angle) * 16,
      y: p.y - Math.sin(p.angle) * 16,
      vx: -p.vx * 0.1 + world.random.range(-14, 14),
      vy: -p.vy * 0.1 + world.random.range(-14, 14),
      life: 0.35, maxLife: 0.35, size: 3, color: '#5ef2ff', drag: 0.94,
    });
  }
}

function stepEnemy(world, enemy, dt) {
  const p = world.player;
  enemy.age += dt;
  const dx = p.x - enemy.x;
  const dy = p.y - enemy.y;
  const dist = Math.hypot(dx, dy) || 1;
  const nx = dx / dist;
  const ny = dy / dist;
  enemy.angle = Math.atan2(dy, dx);

  if (enemy.kind === 'mite' || enemy.kind === 'splitter') {
    enemy.vx += nx * enemy.speed * 3 * dt;
    enemy.vy += ny * enemy.speed * 3 * dt;
  } else if (enemy.kind === 'weaver') {
    // Keep a firing distance, strafe sideways.
    const want = dist > 300 ? 1 : dist < 200 ? -1 : 0;
    enemy.vx += (nx * want * enemy.speed * 2 - ny * 0.6 * enemy.speed) * dt;
    enemy.vy += (ny * want * enemy.speed * 2 + nx * 0.6 * enemy.speed) * dt;
    enemy.shootCooldown -= dt;
    if (enemy.shootCooldown <= 0 && dist < 560) {
      enemy.shootCooldown = 2.2;
      world.enemyBullets.push({
        x: enemy.x, y: enemy.y,
        vx: nx * 175, vy: ny * 175,
        radius: 6, damage: 8, life: 5,
      });
    }
  } else if (enemy.kind === 'dasher') {
    enemy.dashCooldown -= dt;
    if (enemy.dashState === 'chase') {
      enemy.vx += nx * enemy.speed * 3 * dt;
      enemy.vy += ny * enemy.speed * 3 * dt;
      if (enemy.dashCooldown <= 0 && dist < 300) {
        enemy.dashState = 'aim';
        enemy.dashTimer = 0.5;
        enemy.dashX = nx;
        enemy.dashY = ny;
      }
    } else if (enemy.dashState === 'aim') {
      enemy.dashTimer -= dt;
      enemy.vx *= 0.9;
      enemy.vy *= 0.9;
      if (enemy.dashTimer <= 0) {
        enemy.dashState = 'dash';
        enemy.dashTimer = 0.35;
        enemy.vx = enemy.dashX * 520;
        enemy.vy = enemy.dashY * 520;
      }
    } else {
      enemy.dashTimer -= dt;
      if (enemy.dashTimer <= 0) {
        enemy.dashState = 'chase';
        enemy.dashCooldown = 2.5;
      }
    }
  } else {
    // Boss: slow chase, cycling attacks.
    enemy.vx += nx * enemy.speed * 2 * dt;
    enemy.vy += ny * enemy.speed * 2 * dt;
    enemy.attackTimer -= dt;
    enemy.spawnTimer -= dt;
    if (enemy.attackTimer <= 0) {
      enemy.attackTimer = enemy.kind === 'finalBoss' ? 1.4 : 1.9;
      const shots = enemy.kind === 'finalBoss' ? 14 : 10;
      for (let i = 0; i < shots; i += 1) {
        const a = (i / shots) * Math.PI * 2 + enemy.age;
        world.enemyBullets.push({
          x: enemy.x, y: enemy.y,
          vx: Math.cos(a) * 150, vy: Math.sin(a) * 150,
          radius: 7, damage: 12, life: 6,
        });
      }
      // Aimed three-spread.
      for (let k = -1; k <= 1; k += 1) {
        const a = Math.atan2(dy, dx) + k * 0.22;
        world.enemyBullets.push({
          x: enemy.x, y: enemy.y,
          vx: Math.cos(a) * 230, vy: Math.sin(a) * 230,
          radius: 6, damage: 10, life: 5,
        });
      }
    }
    if (enemy.spawnTimer <= 0) {
      enemy.spawnTimer = 6;
      for (let i = 0; i < 3; i += 1) {
        const mite = spawnEnemy(world, 'mite');
        mite.x = enemy.x + world.random.range(-60, 60);
        mite.y = enemy.y + world.random.range(-60, 60);
      }
    }
  }

  const speed = Math.hypot(enemy.vx, enemy.vy);
  const cap = enemy.dashState === 'dash' ? 560 : enemy.speed * 1.6;
  if (speed > cap) {
    enemy.vx = (enemy.vx / speed) * cap;
    enemy.vy = (enemy.vy / speed) * cap;
  }
  enemy.x += enemy.vx * dt;
  enemy.y += enemy.vy * dt;
  enemy.x = Math.min(FIELD.width - enemy.radius, Math.max(enemy.radius, enemy.x));
  enemy.y = Math.min(FIELD.height - enemy.radius, Math.max(enemy.radius, enemy.y));

  // Contact with the player.
  if (dist < enemy.radius + PLAYER.radius && !world.over && !world.won) {
    hurtPlayer(world, enemy.contact);
    // Knock the enemy back so it does not grind the player down in one touch.
    enemy.vx = -nx * 220;
    enemy.vy = -ny * 220;
  }
}

/** Advance the world one fixed step. `input` matches the input.js interface. */
export function stepWorld(world, input, dt = STEP) {
  world.time += dt;
  world.events = [];
  if (world.over || world.won) {
    updateFx(world, dt);
    return world.events;
  }
  if (world.banner) {
    world.banner.t -= dt;
    if (world.banner.t <= 0) world.banner = null;
  }
  if (world.comboTimer > 0) {
    world.comboTimer -= dt;
    if (world.comboTimer <= 0) world.combo = 0;
  }

  // Spawning.
  if (world.waveActive && world.spawnQueue.length > 0) {
    world.spawnTimer -= dt;
    if (world.spawnTimer <= 0) {
      world.spawnTimer = 0.45;
      spawnEnemy(world, world.spawnQueue.shift());
    }
  }

  stepPlayer(world, input, dt);

  for (let i = world.enemies.length - 1; i >= 0; i -= 1) stepEnemy(world, world.enemies[i], dt);

  // Player bullets.
  for (let i = world.bullets.length - 1; i >= 0; i -= 1) {
    const b = world.bullets[i];
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.life -= dt;
    let dead = b.life <= 0 || b.x < -20 || b.x > FIELD.width + 20 || b.y < -20 || b.y > FIELD.height + 20;
    if (!dead) {
      for (let j = world.enemies.length - 1; j >= 0; j -= 1) {
        const e = world.enemies[j];
        const dx = e.x - b.x;
        const dy = e.y - b.y;
        if (dx * dx + dy * dy < (e.radius + b.radius) * (e.radius + b.radius)) {
          const killed = damageEnemy(world, e, b.damage, b.crit);
          if (!killed) burst(world, b.x, b.y, e.color, 3, 120);
          if (b.pierce > 0) {
            b.pierce -= 1;
          } else {
            dead = true;
          }
          break;
        }
      }
    }
    if (dead) world.bullets.splice(i, 1);
  }

  // Enemy bullets.
  for (let i = world.enemyBullets.length - 1; i >= 0; i -= 1) {
    const b = world.enemyBullets[i];
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.life -= dt;
    const p = world.player;
    const dx = p.x - b.x;
    const dy = p.y - b.y;
    if (!world.over && dx * dx + dy * dy < (p.radius + b.radius) * (p.radius + b.radius)) {
      hurtPlayer(world, b.damage);
      world.enemyBullets.splice(i, 1);
      continue;
    }
    if (b.life <= 0 || b.x < -20 || b.x > FIELD.width + 20 || b.y < -20 || b.y > FIELD.height + 20) {
      world.enemyBullets.splice(i, 1);
    }
  }

  // Shards: drift, magnet, collect.
  const p = world.player;
  for (let i = world.shards.length - 1; i >= 0; i -= 1) {
    const s = world.shards[i];
    const dx = p.x - s.x;
    const dy = p.y - s.y;
    const dist = Math.hypot(dx, dy) || 1;
    if (dist < p.magnet) {
      const pull = 900 * (1 - dist / (p.magnet + 60));
      s.vx += (dx / dist) * pull * dt;
      s.vy += (dy / dist) * pull * dt;
    }
    s.vx *= 0.96;
    s.vy *= 0.96;
    s.x += s.vx * dt;
    s.y += s.vy * dt;
    if (dist < p.radius + 12) {
      world.shards.splice(i, 1);
      world.shardsCollected += 1;
      world.score += Math.round(5 * comboMultiplier(world));
      world.events.push(EVENT.PICKUP);
    }
  }

  // Pickups.
  for (let i = world.pickups.length - 1; i >= 0; i -= 1) {
    const pk = world.pickups[i];
    const dx = p.x - pk.x;
    const dy = p.y - pk.y;
    const dist = Math.hypot(dx, dy) || 1;
    if (dist < p.magnet * 0.8) {
      pk.vx += (dx / dist) * 700 * dt;
      pk.vy += (dy / dist) * 700 * dt;
    }
    pk.x += pk.vx * dt;
    pk.y += pk.vy * dt;
    if (dist < p.radius + 14) {
      world.pickups.splice(i, 1);
      if (pk.kind === 'heart') {
        p.hp = Math.min(p.maxHp, p.hp + 25);
        addText(world, p.x, p.y - 24, '+25', '#ff5e7a', 15);
      } else {
        p.shield = true;
        addText(world, p.x, p.y - 24, 'SHIELD', '#7ab8ff', 15);
      }
      world.events.push(EVENT.PICKUP);
    }
  }

  updateFx(world, dt);

  // Wave clear: queue empty and nothing left alive.
  if (world.waveActive && world.spawnQueue.length === 0 && world.enemies.length === 0 && !world.won) {
    world.waveActive = false;
    if (world.wave >= WAVES.total) {
      world.won = true;
      world.events.push(EVENT.VICTORY);
    } else {
      world.events.push(EVENT.WAVE_CLEAR);
      rollUpgradeChoices(world);
    }
  }
  return world.events;
}

function updateFx(world, dt) {
  for (let i = world.particles.length - 1; i >= 0; i -= 1) {
    const pt = world.particles[i];
    pt.life -= dt;
    if (pt.life <= 0) {
      world.particles.splice(i, 1);
      continue;
    }
    pt.x += pt.vx * dt;
    pt.y += pt.vy * dt;
    pt.vx *= pt.drag;
    pt.vy *= pt.drag;
  }
  for (let i = world.texts.length - 1; i >= 0; i -= 1) {
    const t = world.texts[i];
    t.life -= dt;
    t.y += t.vy * dt;
    if (t.life <= 0) world.texts.splice(i, 1);
  }
  world.shake = Math.max(0, world.shake - dt * 26);
  world.flash = Math.max(0, world.flash - dt * 1.4);
}
