// STARSHARD — tuning constants. One place for every number the game balances on,
// so a tweak here retunes the whole game without touching the simulation or the art.
export const FIELD = { width: 1280, height: 720 };

export const PLAYER = {
  radius: 16,
  accel: 2400,
  maxSpeed: 340,
  drag: 0.86,
  maxHp: 100,
  baseDamage: 12,
  baseFireRate: 6, // shots per second
  baseProjectiles: 1,
  basePierce: 0,
  baseCrit: 0.1,
  baseMagnet: 90,
  bulletSpeed: 760,
  bulletRadius: 5,
  invulnerableSeconds: 0.8,
};

// Enemy kinds: chaser, shooter, splitter, dasher, boss. hp scales with the wave.
export const ENEMY = {
  mite:     { radius: 12, hp: 18,  speed: 105, score: 50,  color: '#ffb020', contact: 10 },
  weaver:   { radius: 16, hp: 34,  speed: 62,  score: 100, color: '#ff4fd8', contact: 12 },
  splitter: { radius: 20, hp: 46,  speed: 72,  score: 150, color: '#35e0ff', contact: 14 },
  dasher:   { radius: 14, hp: 28,  speed: 84,  score: 120, color: '#ff7a1a', contact: 12 },
  boss:     { radius: 64, hp: 1400, speed: 42, score: 2000, color: '#c44dff', contact: 22 },
  finalBoss:{ radius: 84, hp: 2600, speed: 36, score: 5000, color: '#ff2e63', contact: 26 },
};

export const WAVES = {
  total: 10,
  bossWaves: [5, 10],
  // Spawn budget per wave and which kinds are unlocked by wave number.
  count: (wave) => 6 + 3 * wave,
  unlocks: (wave) => {
    const kinds = ['mite'];
    if (wave >= 2) kinds.push('weaver');
    if (wave >= 3) kinds.push('splitter');
    if (wave >= 4) kinds.push('dasher');
    return kinds;
  },
};

// Upgrade draft: pick 1 of 3 between waves. Each has a name, a blurb and an effect id.
export const UPGRADES = [
  { id: 'damage',   name: 'Overcharge Rounds', blurb: '+25% bullet damage',        apply: (p) => { p.damage *= 1.25; } },
  { id: 'firerate', name: 'Rapid Cycler',      blurb: '+20% fire rate',            apply: (p) => { p.fireRate *= 1.2; } },
  { id: 'split',    name: 'Split Barrel',      blurb: '+1 projectile per shot',    apply: (p) => { p.projectiles += 1; } },
  { id: 'speed',    name: 'Ion Thrusters',     blurb: '+15% move speed',           apply: (p) => { p.maxSpeed *= 1.15; } },
  { id: 'hull',     name: 'Hull Plating',      blurb: '+25 max hull, repair 25',   apply: (p) => { p.maxHp += 25; p.hp = Math.min(p.maxHp, p.hp + 25); } },
  { id: 'magnet',   name: 'Tractor Coil',      blurb: '+60% shard magnet radius',  apply: (p) => { p.magnet *= 1.6; } },
  { id: 'pierce',   name: 'Piercing Rounds',   blurb: 'Bullets pierce +1 enemy',   apply: (p) => { p.pierce += 1; } },
  { id: 'crit',     name: 'Lucky Core',        blurb: '+12% critical chance',      apply: (p) => { p.crit = Math.min(0.6, p.crit + 0.12); } },
  { id: 'aegis',    name: 'Aegis Shield',      blurb: 'Gain a shield (recharges each wave)', apply: (p) => { p.shield = true; p.maxShield = true; } },
];

export const COMBO = {
  windowSeconds: 2.5,   // kills inside this window keep the chain alive
  perKill: 0.1,         // +10% score per chain step
  maxMultiplier: 3,
};

export const COLORS = {
  background: '#070a1a',
  player: '#5ef2ff',
  playerCore: '#e8fbff',
  bullet: '#ffe45e',
  shard: '#8dff6e',
  heart: '#ff5e7a',
  shield: '#7ab8ff',
  text: '#eaf6ff',
  dim: '#8fa3c8',
  gold: '#ffd166',
};

export const STEP = 1 / 60; // fixed simulation step, seconds

// Upgrade-card geometry, shared by the renderer (drawUpgrade) and the input
// hit-test in main.js: one definition, so the cards are always clickable
// exactly where they are drawn.
export const UPGRADE_CARD = { w: 300, h: 210, gap: 36, y: 210 };
