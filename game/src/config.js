// LUMEN — Last Light of the Hollow. One place for every number that tunes the game:
// the arena, the player, the clock, the level curve and the palette. Balance lives here
// so a tuning pass never has to touch the simulation or the renderer.
export const STEP = 1 / 60;
export const VIEW = { width: 1280, height: 720 };
export const BEST_KEY = 'lumen-best-score';
export const MUTE_KEY = 'lumen-muted';

export const PLAYER = {
  radius: 14,
  speed: 235,
  maxHp: 100,
  pickupRadius: 95,
  invulnSeconds: 0.9,
  contactCooldown: 0.45,
};

export const ARENA = { margin: 26 };

/** The run ends in victory when the Hollow King falls; he arrives at this time. */
export const KING_TIME = 300;
/** The Gloom Herald, a mini-boss, arrives at this time. */
export const HERALD_TIME = 120;

/** XP to go from `level` to `level + 1`. */
export function xpNeeded(level) {
  return 8 + (level - 1) * 6 + Math.floor((level - 1) * (level - 1) * 0.6);
}

/** Enemies per spawn tick and the seconds between ticks, by elapsed time. */
export function spawnPace(time) {
  const t = Math.min(time, 320);
  return {
    batch: 1 + Math.floor(t / 45),
    interval: Math.max(0.32, 1.15 - t * 0.0026),
  };
}

export const MAX_ENEMIES = 110;
export const MAX_PARTICLES = 320;

/** One coherent palette: deep indigo dark, warm amber light, cold enemy accents. */
export const PALETTE = {
  bgTop: '#0d1024',
  bgBottom: '#070812',
  amber: '#ffd166',
  amberHot: '#ffe9a8',
  orange: '#ff9f43',
  cyan: '#4cc9f0',
  magenta: '#f72585',
  violet: '#9d4edd',
  green: '#80ed99',
  red: '#ff5964',
  white: '#f4f1e8',
  dim: '#8b93b8',
};
