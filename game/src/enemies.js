// Everything the Hollow sends at the player: the five roaming shades, their elites,
// and the two bosses. Each type names its body (hit points, speed, size, damage),
// its reward (XP and score), its colour, and how it moves. Spawn mix and elites
// are time-gated here, so the night gets steadily worse.
import { HERALD_TIME, KING_TIME } from './config.js';

export const ENEMY_TYPES = {
  shade: {
    name: 'Shade', hp: 20, speed: 62, damage: 8, radius: 15, xp: 1, score: 10,
    color: '#9d4edd', behaviour: 'chase', unlockAt: 0, weight: 10,
  },
  wisp: {
    name: 'Dusk Wisp', hp: 10, speed: 118, damage: 6, radius: 10, xp: 1, score: 15,
    color: '#4cc9f0', behaviour: 'swarm', unlockAt: 25, weight: 8,
  },
  brute: {
    name: 'Gloom Brute', hp: 90, speed: 42, damage: 18, radius: 26, xp: 4, score: 40,
    color: '#f72585', behaviour: 'brute', unlockAt: 45, weight: 4,
  },
  dasher: {
    name: 'Night Dasher', hp: 26, speed: 70, damage: 12, radius: 13, xp: 2, score: 25,
    color: '#ff9f43', behaviour: 'dasher', unlockAt: 70, weight: 5,
  },
  spitter: {
    name: 'Spitter', hp: 34, speed: 55, damage: 8, radius: 15, xp: 3, score: 30,
    color: '#80ed99', behaviour: 'spitter', unlockAt: 95, weight: 4,
  },
};

export const BOSSES = {
  herald: {
    name: 'Gloom Herald', hp: 850, speed: 46, damage: 16, radius: 40, xp: 40, score: 500,
    color: '#f72585', behaviour: 'boss', at: HERALD_TIME, minions: 'shade',
  },
  king: {
    name: 'Hollow King', hp: 2800, speed: 40, damage: 26, radius: 52, xp: 120, score: 2000,
    color: '#9d4edd', behaviour: 'boss', at: KING_TIME, minions: 'wisp',
  },
};

/** Elites appear from two minutes in: bigger, tougher, worth far more. */
export const ELITE_AT = 120;
export const ELITE_CHANCE = 0.06;

/** Which roaming types are unlocked at `time`, with their spawn weights. */
export function unlockedTypes(time) {
  return Object.entries(ENEMY_TYPES)
    .filter(([, def]) => time >= def.unlockAt)
    .map(([id, def]) => ({ id, weight: def.weight }));
}

/** One enemy instance, fresh from the dark. */
export function spawnEnemy(rng, id, x, y, time) {
  const def = ENEMY_TYPES[id];
  const elite = time >= ELITE_AT && rng.chance(ELITE_CHANCE);
  const hpMul = 1 + time / 360;
  return {
    id, x, y,
    hp: def.hp * hpMul * (elite ? 6 : 1),
    maxHp: def.hp * hpMul * (elite ? 6 : 1),
    speed: def.speed * (1 + Math.min(time / 600, 0.35)) * (elite ? 0.9 : 1),
    damage: def.damage * (elite ? 1.6 : 1),
    radius: def.radius * (elite ? 1.5 : 1),
    xp: def.xp * (elite ? 10 : 1),
    score: def.score * (elite ? 8 : 1),
    color: def.color,
    behaviour: def.behaviour,
    elite,
    flash: 0,
    wobble: rng.range(0, Math.PI * 2),
    dashTimer: rng.range(1, 2.5),
    dashing: 0,
    dashX: 0,
    dashY: 0,
    shotTimer: rng.range(0.5, 1.5),
    knockX: 0,
    knockY: 0,
    touchTimer: 0,
  };
}

export function spawnBoss(id, x, y) {
  const def = BOSSES[id];
  return {
    id, x, y,
    hp: def.hp, maxHp: def.hp,
    speed: def.speed, damage: def.damage, radius: def.radius,
    xp: def.xp, score: def.score, color: def.color,
    behaviour: 'boss', elite: false, boss: true,
    flash: 0, wobble: 0, dashTimer: 0, dashing: 0, dashX: 0, dashY: 0,
    shotTimer: 2, knockX: 0, knockY: 0, touchTimer: 0,
    summonTimer: 6, burstTimer: 4, phase: 1,
  };
}
