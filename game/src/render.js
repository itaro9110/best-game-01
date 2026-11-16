// STARSHARD — everything the player sees. The world is drawn in layers:
// nebula + starfield, shards and pickups, enemies, the player, bullets,
// particles, floating text, then the HUD, then the menu screens. The starfield
// is seeded once, so every render of the same world looks identical.
import { FIELD, COLORS, UPGRADE_CARD } from './config.js';
import { createRandom } from './random.js';

export const SCREEN = {
  TITLE: 'title',
  PLAY: 'play',
  UPGRADE: 'upgrade',
  VICTORY: 'victory',
  OVER: 'over',
  PAUSED: 'paused',
};

const STARS = (() => {
  const random = createRandom(1337);
  const layers = [];
  for (let layer = 0; layer < 3; layer += 1) {
    const stars = [];
    const count = [90, 60, 36][layer];
    for (let i = 0; i < count; i += 1) {
      stars.push({
        x: random.range(0, FIELD.width),
        y: random.range(0, FIELD.height),
        size: random.range(0.6, 1.6 + layer * 0.7),
        twinkle: random.range(0, Math.PI * 2),
      });
    }
    layers.push(stars);
  }
  return layers;
})();

const NEBULAE = [
  { x: 220, y: 140, r: 300, color: 'rgba(80, 40, 160, 0.20)' },
  { x: 1080, y: 560, r: 340, color: 'rgba(20, 120, 160, 0.16)' },
  { x: 700, y: 90, r: 220, color: 'rgba(200, 60, 140, 0.12)' },
  { x: 120, y: 620, r: 240, color: 'rgba(30, 90, 200, 0.12)' },
];

function drawBackground(ctx, time) {
  const gradient = ctx.createLinearGradient(0, 0, 0, FIELD.height);
  gradient.addColorStop(0, '#0a0e28');
  gradient.addColorStop(0.55, COLORS.background);
  gradient.addColorStop(1, '#0d0620');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, FIELD.width, FIELD.height);
  for (const nebula of NEBULAE) {
    const g = ctx.createRadialGradient(nebula.x, nebula.y, 0, nebula.x, nebula.y, nebula.r);
    g.addColorStop(0, nebula.color);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(nebula.x - nebula.r, nebula.y - nebula.r, nebula.r * 2, nebula.r * 2);
  }
  STARS.forEach((stars, layer) => {
    const drift = (time * (2 + layer * 3)) % FIELD.width;
    for (const star of stars) {
      const alpha = 0.35 + 0.35 * Math.sin(time * 1.4 + star.twinkle);
      const x = (star.x - drift + FIELD.width) % FIELD.width;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = '#cfe4ff';
      ctx.fillRect(x, star.y, star.size, star.size);
    }
  });
  ctx.globalAlpha = 1;
  // A faint arena grid and a glowing border: the field is a place, not a void.
  ctx.strokeStyle = 'rgba(94, 242, 255, 0.05)';
  ctx.lineWidth = 1;
  for (let x = 80; x < FIELD.width; x += 80) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, FIELD.height);
    ctx.stroke();
  }
  for (let y = 80; y < FIELD.height; y += 80) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(FIELD.width, y);
    ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(94, 242, 255, 0.22)';
  ctx.lineWidth = 2;
  ctx.strokeRect(1, 1, FIELD.width - 2, FIELD.height - 2);
}

function glowCircle(ctx, x, y, radius, color) {
  ctx.save();
  ctx.shadowColor = color;
  ctx.shadowBlur = 18;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawPolygon(ctx, x, y, radius, sides, rotation, color, fill = true) {
  ctx.beginPath();
  for (let i = 0; i < sides; i += 1) {
    const a = rotation + (i / sides) * Math.PI * 2;
    const px = x + Math.cos(a) * radius;
    const py = y + Math.sin(a) * radius;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  if (fill) {
    ctx.fillStyle = color;
    ctx.fill();
  } else {
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.stroke();
  }
}

function drawEnemy(ctx, enemy) {
  ctx.save();
  ctx.shadowColor = enemy.color;
  ctx.shadowBlur = 14;
  const blink = enemy.kind === 'dasher' && enemy.dashState === 'aim' ? (Math.sin(enemy.age * 30) > 0 ? '#ffffff' : enemy.color) : enemy.color;
  if (enemy.kind === 'mite') {
    drawPolygon(ctx, enemy.x, enemy.y, enemy.radius, 3, enemy.angle, blink);
    // White core: the shape survives shrinking to a contact-sheet cell.
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(enemy.x, enemy.y, 3.5, 0, Math.PI * 2);
    ctx.fill();
  } else if (enemy.kind === 'weaver') {
    ctx.translate(enemy.x, enemy.y);
    ctx.rotate(enemy.angle * 0.4);
    ctx.fillStyle = blink;
    ctx.fillRect(-enemy.radius * 0.8, -enemy.radius * 0.8, enemy.radius * 1.6, enemy.radius * 1.6);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(0, 0, 4, 0, Math.PI * 2);
    ctx.fill();
  } else if (enemy.kind === 'splitter') {
    drawPolygon(ctx, enemy.x, enemy.y, enemy.radius, 6, enemy.age * 0.8, blink);
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    drawPolygon(ctx, enemy.x, enemy.y, enemy.radius * 0.45, 6, -enemy.age * 0.8, '#ffffff');
  } else if (enemy.kind === 'dasher') {
    drawPolygon(ctx, enemy.x, enemy.y, enemy.radius, 4, enemy.angle, blink);
    // White chevron: the telegraph reads even at small size.
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(enemy.x + Math.cos(enemy.angle) * 4, enemy.y + Math.sin(enemy.angle) * 4);
    ctx.lineTo(enemy.x + Math.cos(enemy.angle) * 10, enemy.y + Math.sin(enemy.angle) * 10);
    ctx.stroke();
  } else {
    // Boss: big spiked ring around a pulsing core.
    const pulse = 1 + 0.06 * Math.sin(enemy.age * 3);
    drawPolygon(ctx, enemy.x, enemy.y, enemy.radius * pulse, 10, enemy.age * 0.25, enemy.color);
    ctx.fillStyle = '#1a0b2e';
    ctx.beginPath();
    ctx.arc(enemy.x, enemy.y, enemy.radius * 0.55, 0, Math.PI * 2);
    ctx.fill();
    glowCircle(ctx, enemy.x, enemy.y, enemy.radius * 0.3 * pulse, '#ffffff');
  }
  ctx.restore();
  // Health bar for hurt enemies and the boss.
  if (enemy.hp < enemy.maxHp) {
    const w = enemy.kind === 'boss' || enemy.kind === 'finalBoss' ? 110 : 34;
    const x = enemy.x - w / 2;
    const y = enemy.y - enemy.radius - 12;
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(x, y, w, 5);
    ctx.fillStyle = enemy.color;
    ctx.fillRect(x, y, w * Math.max(0, enemy.hp / enemy.maxHp), 5);
  }
}

function drawPlayer(ctx, world) {
  const p = world.player;
  if (world.over) return;
  ctx.save();
  if (p.invuln > 0 && Math.floor(p.invuln * 12) % 2 === 0) ctx.globalAlpha = 0.45;
  ctx.translate(p.x, p.y);
  ctx.rotate(p.angle);
  ctx.shadowColor = COLORS.player;
  ctx.shadowBlur = 20;
  // Engine flame.
  const flame = 10 + Math.sin(world.time * 40) * 4;
  ctx.fillStyle = '#ff9a3d';
  ctx.beginPath();
  ctx.moveTo(-12, 5);
  ctx.lineTo(-12 - flame, 0);
  ctx.lineTo(-12, -5);
  ctx.closePath();
  ctx.fill();
  // Hull: a swept dart.
  ctx.fillStyle = COLORS.player;
  ctx.beginPath();
  ctx.moveTo(20, 0);
  ctx.lineTo(-12, 11);
  ctx.lineTo(-6, 0);
  ctx.lineTo(-12, -11);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = COLORS.playerCore;
  ctx.beginPath();
  ctx.arc(4, 0, 4.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  if (p.shield) {
    ctx.save();
    ctx.strokeStyle = 'rgba(122, 184, 255, 0.9)';
    ctx.lineWidth = 2.5;
    ctx.shadowColor = '#7ab8ff';
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 26 + Math.sin(world.time * 5) * 1.5, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }
}

function drawWorld(ctx, world) {
  // Shards.
  ctx.save();
  ctx.shadowColor = COLORS.shard;
  ctx.shadowBlur = 10;
  for (const shard of world.shards) {
    const pulse = 1 + 0.25 * Math.sin(world.time * 8 + shard.x);
    drawPolygon(ctx, shard.x, shard.y, 5 * pulse, 4, Math.PI / 4, COLORS.shard);
  }
  ctx.restore();
  // Pickups.
  for (const pk of world.pickups) {
    const color = pk.kind === 'heart' ? COLORS.heart : COLORS.shield;
    glowCircle(ctx, pk.x, pk.y, 9, color);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 11px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(pk.kind === 'heart' ? '+' : 'S', pk.x, pk.y + 0.5);
  }
  // Enemies, player, bullets, particles, texts.
  for (const enemy of world.enemies) drawEnemy(ctx, enemy);
  drawPlayer(ctx, world);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (const b of world.bullets) {
    ctx.strokeStyle = COLORS.bullet;
    ctx.lineWidth = 5;
    ctx.shadowColor = COLORS.bullet;
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.moveTo(b.x - b.vx * 0.035, b.y - b.vy * 0.035);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }
  for (const b of world.enemyBullets) {
    glowCircle(ctx, b.x, b.y, b.radius, '#ff4f6e');
  }
  for (const pt of world.particles) {
    ctx.globalAlpha = Math.max(0, pt.life / pt.maxLife);
    ctx.fillStyle = pt.color;
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (const t of world.texts) {
    ctx.globalAlpha = Math.max(0, t.life / t.maxLife);
    ctx.font = `bold ${t.size}px system-ui, sans-serif`;
    // Dark outline so numbers stay legible over bright explosions.
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(4, 6, 18, 0.85)';
    ctx.strokeText(t.text, t.x, t.y);
    ctx.fillStyle = t.color;
    ctx.fillText(t.text, t.x, t.y);
  }
  ctx.restore();
  // Damage flash and shake are applied by the caller via transform.
  if (world.flash > 0) {
    ctx.fillStyle = `rgba(255, 40, 70, ${world.flash * 0.25})`;
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
  }
}

function bar(ctx, x, y, w, h, fraction, color, back = 'rgba(0,0,0,0.55)') {
  ctx.fillStyle = back;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w * Math.max(0, Math.min(1, fraction)), h);
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
}

function drawHUD(ctx, world, muted = false) {
  const p = world.player;
  ctx.save();
  ctx.textBaseline = 'middle';
  // Top-left: hull.
  ctx.fillStyle = COLORS.text;
  ctx.font = 'bold 13px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('HULL', 18, 22);
  bar(ctx, 62, 13, 220, 16, p.hp / p.maxHp, p.hp > 30 ? '#39d98a' : '#ff4f6e');
  ctx.fillStyle = COLORS.text;
  ctx.font = 'bold 13px system-ui, sans-serif';
  ctx.fillText(`${Math.ceil(p.hp)} / ${p.maxHp}`, 290, 22);
  if (p.shield) {
    ctx.fillStyle = '#7ab8ff';
    ctx.fillText('◆ SHIELD', 360, 22);
  }
  if (muted) {
    ctx.fillStyle = COLORS.dim;
    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.fillText('♪ MUTED', 440, 22);
  }
  // Top-centre: wave.
  ctx.textAlign = 'center';
  ctx.font = 'bold 20px system-ui, sans-serif';
  ctx.fillText(`WAVE ${Math.max(1, world.wave)} / 10`, FIELD.width / 2, 22);
  ctx.font = '13px system-ui, sans-serif';
  ctx.fillStyle = COLORS.dim;
  const remaining = world.enemies.length + world.spawnQueue.length;
  ctx.fillText(world.waveActive ? `${remaining} hostiles remain` : 'Clear!', FIELD.width / 2, 44);
  // Boss bar.
  if (world.boss) {
    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.fillStyle = '#ff8ad8';
    ctx.fillText(world.boss.kind === 'finalBoss' ? 'VOID HEART' : 'VOID MAW', FIELD.width / 2, 66);
    bar(ctx, FIELD.width / 2 - 200, 76, 400, 16, world.boss.hp / world.boss.maxHp, '#c44dff');
  }
  // Top-right: score, combo, shards.
  ctx.textAlign = 'right';
  ctx.fillStyle = COLORS.text;
  ctx.font = 'bold 24px system-ui, sans-serif';
  ctx.fillText(`${world.score.toLocaleString('en-US')}`, FIELD.width - 18, 22);
  ctx.font = '13px system-ui, sans-serif';
  ctx.fillStyle = COLORS.dim;
  ctx.fillText(`◆ ${world.shardsCollected} shards`, FIELD.width - 18, 46);
  if (world.combo >= 3) {
    const mult = Math.min(3, 1 + world.combo * 0.1);
    ctx.fillStyle = COLORS.gold;
    ctx.font = 'bold 18px system-ui, sans-serif';
    ctx.fillText(`COMBO ×${mult.toFixed(1)}  (${world.combo})`, FIELD.width - 18, 68);
  }
  // Wave banner.
  if (world.banner) {
    const a = Math.min(1, world.banner.t);
    ctx.globalAlpha = a;
    ctx.textAlign = 'center';
    ctx.fillStyle = COLORS.text;
    ctx.font = 'bold 54px system-ui, sans-serif';
    ctx.shadowColor = '#5ef2ff';
    ctx.shadowBlur = 24;
    ctx.fillText(world.banner.text, FIELD.width / 2, FIELD.height / 2 - 90);
    ctx.shadowBlur = 0;
    if (world.banner.sub) {
      ctx.font = '18px system-ui, sans-serif';
      ctx.fillStyle = COLORS.dim;
      ctx.fillText(world.banner.sub, FIELD.width / 2, FIELD.height / 2 - 52);
    }
    ctx.globalAlpha = 1;
  }
  ctx.restore();
}

function panel(ctx, x, y, w, h) {
  ctx.fillStyle = 'rgba(6, 10, 30, 0.82)';
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = 'rgba(94, 242, 255, 0.4)';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(x + 0.75, y + 0.75, w - 1.5, h - 1.5);
}

export function drawTitle(ctx, world, best) {
  drawWorld(ctx, world);
  ctx.fillStyle = 'rgba(4, 6, 18, 0.45)';
  ctx.fillRect(0, 0, FIELD.width, FIELD.height);
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const glow = 26 + 8 * Math.sin(world.time * 2.2);
  ctx.shadowColor = '#5ef2ff';
  ctx.shadowBlur = glow;
  const titleGradient = ctx.createLinearGradient(0, 150, 0, 250);
  titleGradient.addColorStop(0, '#e8fbff');
  titleGradient.addColorStop(0.5, '#5ef2ff');
  titleGradient.addColorStop(1, '#c44dff');
  ctx.fillStyle = titleGradient;
  ctx.font = 'bold 108px system-ui, sans-serif';
  ctx.fillText('STARSHARD', FIELD.width / 2, 200);
  ctx.shadowBlur = 0;
  ctx.fillStyle = COLORS.gold;
  ctx.font = 'bold 24px system-ui, sans-serif';
  ctx.fillText('A  N E O N  A R E N A  S U R V I V A L', FIELD.width / 2, 268);
  ctx.fillStyle = COLORS.dim;
  ctx.font = '17px system-ui, sans-serif';
  ctx.fillText('10 waves  •  upgrade draft between waves  •  boss fights  •  victory or defeat', FIELD.width / 2, 306);
  ctx.fillStyle = '#5ef2ff';
  ctx.font = '16px system-ui, sans-serif';
  ctx.fillText('♪ fully synthesized sound — M to mute', FIELD.width / 2, 334);
  const pulse = 0.65 + 0.35 * Math.sin(world.time * 3.2);
  ctx.globalAlpha = pulse;
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 26px system-ui, sans-serif';
  ctx.fillText('CLICK OR PRESS ENTER TO PLAY', FIELD.width / 2, 392);
  ctx.globalAlpha = 1;
  panel(ctx, FIELD.width / 2 - 330, 440, 660, 128);
  ctx.fillStyle = COLORS.text;
  ctx.font = 'bold 15px system-ui, sans-serif';
  ctx.fillText('WASD / ARROWS — fly      MOUSE — aim      HOLD CLICK / SPACE — fire', FIELD.width / 2, 470);
  ctx.fillText('1 / 2 / 3 — pick an upgrade      P — pause      M — mute', FIELD.width / 2, 500);
  ctx.fillStyle = COLORS.dim;
  ctx.font = '15px system-ui, sans-serif';
  ctx.fillText('Collect star shards. Chain kills for combos. Beat the Void Heart on wave 10.', FIELD.width / 2, 534);
  if (best > 0) {
    ctx.fillStyle = COLORS.gold;
    ctx.font = 'bold 18px system-ui, sans-serif';
    ctx.fillText(`BEST SCORE  ${best.toLocaleString('en-US')}`, FIELD.width / 2, 612);
  }
  ctx.restore();
}

/** A small glyph per upgrade, so the cards read by shape as well as by name. */
function drawUpgradeGlyph(ctx, id, x, y) {
  ctx.save();
  ctx.translate(x, y);
  ctx.strokeStyle = '#5ef2ff';
  ctx.fillStyle = '#5ef2ff';
  ctx.lineWidth = 2.5;
  if (id === 'damage') {
    drawPolygon(ctx, 0, 0, 13, 3, -Math.PI / 2, '#ffd166');
  } else if (id === 'firerate') {
    for (let i = -1; i <= 1; i += 1) {
      ctx.beginPath();
      ctx.moveTo(i * 9 - 4, -8);
      ctx.lineTo(i * 9 + 4, -8);
      ctx.moveTo(i * 9, -8);
      ctx.lineTo(i * 9, 10);
      ctx.stroke();
    }
  } else if (id === 'split') {
    for (const [dx, dy] of [[-10, 6], [0, -8], [10, 6]]) {
      ctx.beginPath();
      ctx.arc(dx, dy, 5, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (id === 'speed') {
    ctx.beginPath();
    ctx.moveTo(-10, 8);
    ctx.lineTo(2, -2);
    ctx.lineTo(-2, -2);
    ctx.lineTo(10, -10);
    ctx.lineTo(4, 2);
    ctx.lineTo(8, 2);
    ctx.lineTo(-4, 10);
    ctx.closePath();
    ctx.fill();
  } else if (id === 'hull') {
    ctx.beginPath();
    ctx.moveTo(0, -12);
    ctx.lineTo(10, -7);
    ctx.lineTo(10, 2);
    ctx.quadraticCurveTo(10, 10, 0, 13);
    ctx.quadraticCurveTo(-10, 10, -10, 2);
    ctx.lineTo(-10, -7);
    ctx.closePath();
    ctx.stroke();
  } else if (id === 'magnet') {
    ctx.beginPath();
    ctx.arc(0, -2, 9, Math.PI, 0);
    ctx.lineTo(9, 8);
    ctx.lineTo(4, 8);
    ctx.lineTo(4, -2);
    ctx.arc(0, -2, 4, 0, Math.PI, true);
    ctx.lineTo(-4, 8);
    ctx.lineTo(-9, 8);
    ctx.closePath();
    ctx.stroke();
  } else if (id === 'pierce') {
    ctx.beginPath();
    ctx.moveTo(-12, 0);
    ctx.lineTo(12, 0);
    ctx.moveTo(5, -6);
    ctx.lineTo(13, 0);
    ctx.lineTo(5, 6);
    ctx.stroke();
  } else if (id === 'crit') {
    drawPolygon(ctx, 0, 0, 13, 5, -Math.PI / 2, '#ffd166');
    ctx.fillStyle = '#070a1a';
    ctx.beginPath();
    ctx.arc(0, 0, 4, 0, Math.PI * 2);
    ctx.fill();
  } else {
    // aegis: a ring.
    ctx.beginPath();
    ctx.arc(0, 0, 11, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 0, 4, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

export function drawUpgrade(ctx, world, muted = false) {
  drawWorld(ctx, world);
  drawHUD(ctx, world, muted);
  ctx.fillStyle = 'rgba(4, 6, 18, 0.62)';
  ctx.fillRect(0, 0, FIELD.width, FIELD.height);
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = COLORS.text;
  ctx.font = 'bold 40px system-ui, sans-serif';
  ctx.shadowColor = '#5ef2ff';
  ctx.shadowBlur = 18;
  ctx.fillText(`WAVE ${world.wave} CLEARED`, FIELD.width / 2, 108);
  ctx.shadowBlur = 0;
  ctx.fillStyle = COLORS.gold;
  ctx.font = 'bold 22px system-ui, sans-serif';
  ctx.fillText('CHOOSE AN UPGRADE  —  click a card or press 1 / 2 / 3', FIELD.width / 2, 152);
  const cardW = UPGRADE_CARD.w;
  const cardH = UPGRADE_CARD.h;
  const gap = UPGRADE_CARD.gap;
  const totalW = cardW * 3 + gap * 2;
  const x0 = (FIELD.width - totalW) / 2;
  const y0 = UPGRADE_CARD.y;
  world.upgradeChoices.forEach((choice, i) => {
    const x = x0 + i * (cardW + gap);
    const selected = world.upgradeHover === i;
    ctx.fillStyle = selected ? 'rgba(94, 242, 255, 0.16)' : 'rgba(10, 16, 44, 0.92)';
    ctx.fillRect(x, y0, cardW, cardH);
    ctx.strokeStyle = selected ? '#5ef2ff' : 'rgba(94, 242, 255, 0.45)';
    ctx.lineWidth = selected ? 3 : 1.5;
    ctx.strokeRect(x + 1, y0 + 1, cardW - 2, cardH - 2);
    ctx.fillStyle = COLORS.gold;
    ctx.font = 'bold 22px system-ui, sans-serif';
    ctx.fillText(`[${i + 1}]`, x + cardW / 2, y0 + 36);
    drawUpgradeGlyph(ctx, choice.id, x + cardW / 2, y0 + 78);
    ctx.fillStyle = COLORS.text;
    ctx.font = 'bold 24px system-ui, sans-serif';
    ctx.fillText(choice.name, x + cardW / 2, y0 + 122);
    ctx.fillStyle = COLORS.dim;
    ctx.font = '17px system-ui, sans-serif';
    ctx.fillText(choice.blurb, x + cardW / 2, y0 + 156);
  });
  ctx.fillStyle = COLORS.dim;
  ctx.font = '16px system-ui, sans-serif';
  ctx.fillText(`Score ${world.score.toLocaleString('en-US')}  •  ${world.kills} kills  •  ${world.shardsCollected} shards`, FIELD.width / 2, 486);
  ctx.restore();
}

function scoreLines(world) {
  return [
    ['Final score', world.score.toLocaleString('en-US')],
    ['Waves cleared', `${Math.min(world.wave, 10)} / 10`],
    ['Kills', `${world.kills}`],
    ['Star shards', `${world.shardsCollected}`],
    ['Best combo', `×${Math.min(3, 1 + world.combo * 0.1).toFixed(1)}`],
  ];
}

export function drawVictory(ctx, world, best) {
  // Background only: live combat debris behind the panel reads as clutter.
  drawBackground(ctx, world.time);
  ctx.fillStyle = 'rgba(4, 6, 18, 0.55)';
  ctx.fillRect(0, 0, FIELD.width, FIELD.height);
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = '#ffd166';
  ctx.shadowBlur = 30;
  ctx.fillStyle = COLORS.gold;
  ctx.font = 'bold 84px system-ui, sans-serif';
  ctx.fillText('VICTORY', FIELD.width / 2, 150);
  ctx.shadowBlur = 0;
  ctx.fillStyle = COLORS.text;
  ctx.font = '22px system-ui, sans-serif';
  ctx.fillText('The Void Heart is shattered. The arena is yours, pilot.', FIELD.width / 2, 216);
  panel(ctx, FIELD.width / 2 - 260, 258, 520, 210);
  scoreLines(world).forEach(([label, value], i) => {
    const y = 288 + i * 34;
    ctx.textAlign = 'left';
    ctx.fillStyle = COLORS.dim;
    ctx.font = '19px system-ui, sans-serif';
    ctx.fillText(label, FIELD.width / 2 - 230, y);
    ctx.textAlign = 'right';
    ctx.fillStyle = i === 0 ? COLORS.gold : COLORS.text;
    ctx.font = i === 0 ? 'bold 22px system-ui, sans-serif' : '19px system-ui, sans-serif';
    ctx.fillText(value, FIELD.width / 2 + 230, y);
  });
  if (world.score >= best && best > 0) {
    ctx.textAlign = 'center';
    ctx.fillStyle = COLORS.gold;
    ctx.font = 'bold 20px system-ui, sans-serif';
    ctx.fillText('★ NEW BEST SCORE ★', FIELD.width / 2, 500);
  }
  const pulse = 0.65 + 0.35 * Math.sin(world.time * 3.2);
  ctx.globalAlpha = pulse;
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 26px system-ui, sans-serif';
  ctx.fillText('PRESS R TO PLAY AGAIN', FIELD.width / 2, 556);
  ctx.globalAlpha = 1;
  ctx.restore();
}

export function drawGameOver(ctx, world, best) {
  drawWorld(ctx, world);
  ctx.fillStyle = 'rgba(10, 4, 12, 0.6)';
  ctx.fillRect(0, 0, FIELD.width, FIELD.height);
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = '#ff4f6e';
  ctx.shadowBlur = 28;
  ctx.fillStyle = '#ff5e7a';
  ctx.font = 'bold 76px system-ui, sans-serif';
  ctx.fillText('GAME OVER', FIELD.width / 2, 150);
  ctx.shadowBlur = 0;
  ctx.fillStyle = COLORS.text;
  ctx.font = '22px system-ui, sans-serif';
  ctx.fillText(`The swarm took you on wave ${Math.max(1, world.wave)}.`, FIELD.width / 2, 216);
  panel(ctx, FIELD.width / 2 - 260, 258, 520, 210);
  scoreLines(world).forEach(([label, value], i) => {
    const y = 288 + i * 34;
    ctx.textAlign = 'left';
    ctx.fillStyle = COLORS.dim;
    ctx.font = '19px system-ui, sans-serif';
    ctx.fillText(label, FIELD.width / 2 - 230, y);
    ctx.textAlign = 'right';
    ctx.fillStyle = i === 0 ? COLORS.gold : COLORS.text;
    ctx.font = i === 0 ? 'bold 22px system-ui, sans-serif' : '19px system-ui, sans-serif';
    ctx.fillText(value, FIELD.width / 2 + 230, y);
  });
  if (best > 0) {
    ctx.textAlign = 'center';
    ctx.fillStyle = COLORS.dim;
    ctx.font = '17px system-ui, sans-serif';
    ctx.fillText(`Best score  ${best.toLocaleString('en-US')}`, FIELD.width / 2, 500);
  }
  const pulse = 0.65 + 0.35 * Math.sin(world.time * 3.2);
  ctx.globalAlpha = pulse;
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 26px system-ui, sans-serif';
  ctx.fillText('PRESS R TO RETRY', FIELD.width / 2, 556);
  ctx.globalAlpha = 1;
  ctx.restore();
}

export function drawPaused(ctx) {
  ctx.fillStyle = 'rgba(4, 6, 18, 0.6)';
  ctx.fillRect(0, 0, FIELD.width, FIELD.height);
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = COLORS.text;
  ctx.font = 'bold 56px system-ui, sans-serif';
  ctx.fillText('PAUSED', FIELD.width / 2, FIELD.height / 2 - 20);
  ctx.fillStyle = COLORS.dim;
  ctx.font = '19px system-ui, sans-serif';
  ctx.fillText('Press P to resume', FIELD.width / 2, FIELD.height / 2 + 30);
  ctx.restore();
}

/** Draw one frame for `screen`, with the world behind menus where it fits. */
export function drawGame(ctx, world, screen, best, muted = false) {
  ctx.save();
  if (world.shake > 0.2) {
    ctx.translate((Math.random() - 0.5) * world.shake, (Math.random() - 0.5) * world.shake);
  }
  drawBackground(ctx, world.time);
  if (screen === SCREEN.TITLE) drawTitle(ctx, world, best);
  else if (screen === SCREEN.UPGRADE) drawUpgrade(ctx, world, muted);
  else if (screen === SCREEN.VICTORY) drawVictory(ctx, world, best);
  else if (screen === SCREEN.OVER) drawGameOver(ctx, world, best);
  else {
    drawWorld(ctx, world);
    drawHUD(ctx, world, muted);
    if (screen === SCREEN.PAUSED) drawPaused(ctx);
  }
  ctx.restore();
}
