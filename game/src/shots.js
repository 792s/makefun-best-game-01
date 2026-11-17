// The screenshot scenes behind ?shot=start|play|levelup|end. Each one plays the
// real rules forward from a fresh world for a fixed number of steps, steered by a
// simple autopilot (flee what is close, chase the nearest shard when it is safe,
// drift back to the middle), so the frame is what a short game really looks like
// and the same seed always gives the same frame.
import { STEP, VIEW } from './config.js';
import { EVENT_LEVELUP, EVENT_OVER, EVENT_VICTORY, totalScore } from './world.js';
import { SCREEN_LEVELUP, SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE } from './render.js';

const START_SECONDS = 5;
const PLAY_SECONDS = 50;
const PLAY_FALLBACK_SECONDS = 30;
const LEVELUP_LIMIT_SECONDS = 120;
const END_PLAY_SECONDS = 40;
const END_LIMIT_SECONDS = 400;

const PILOT_PLAY = { fleeRadius: 170, gemRadius: 260 };
const PILOT_WEAK = { fleeRadius: 70, gemRadius: 0 };

/** Steer away from close shades, toward the nearest shard, back to the middle. */
function autopilot(state, skill) {
  const p = state.player;
  let x = 0;
  let y = 0;
  for (const e of state.enemies) {
    const dx = p.x - e.x;
    const dy = p.y - e.y;
    const d = Math.hypot(dx, dy) || 1;
    if (d < skill.fleeRadius) {
      const w = ((skill.fleeRadius - d) / skill.fleeRadius) * 2.4;
      x += (dx / d) * w;
      y += (dy / d) * w;
    }
  }
  let gem = null;
  let gd = Infinity;
  for (const g of state.gems) {
    const d = Math.hypot(g.x - p.x, g.y - p.y);
    if (d < gd) {
      gd = d;
      gem = g;
    }
  }
  if (gem && gd < skill.gemRadius) {
    x += ((gem.x - p.x) / (gd || 1)) * 0.9;
    y += ((gem.y - p.y) / (gd || 1)) * 0.9;
  }
  x += ((VIEW.width / 2 - p.x) / VIEW.width) * 0.6;
  y += ((VIEW.height / 2 - p.y) / VIEW.height) * 0.6;
  const len = Math.hypot(x, y);
  if (len < 0.05) return { x: 0, y: 0 };
  return { x: x / len, y: y / len };
}

/** Play forward for `seconds`, auto-picking the first card on every level-up. */
function playFor(world, seconds, skill) {
  const steps = Math.floor(seconds / STEP);
  for (let i = 0; i < steps; i += 1) {
    const events = world.step(STEP, autopilot(world.state, skill), false);
    if (world.state.pendingCards) world.applyCard(world.state.pendingCards[0]);
    if (events & (EVENT_OVER | EVENT_VICTORY)) break;
  }
}

/**
 * Set `world` to the named scene and return the screen to draw over it and the
 * best score to show. Any unknown name stages the title.
 */
export function stageShot(name, world) {
  if (name === 'play') {
    world.reset();
    playFor(world, PLAY_SECONDS, PILOT_PLAY);
    if (world.state.over || world.state.victory) {
      world.reset();
      playFor(world, PLAY_FALLBACK_SECONDS, PILOT_PLAY);
    }
    return { screen: SCREEN_PLAY, best: totalScore(world.state) };
  }
  if (name === 'levelup') {
    world.reset();
    const steps = Math.floor(LEVELUP_LIMIT_SECONDS / STEP);
    for (let i = 0; i < steps; i += 1) {
      const events = world.step(STEP, autopilot(world.state, PILOT_PLAY), false);
      if (events & EVENT_LEVELUP) break;
      if (events & (EVENT_OVER | EVENT_VICTORY)) break;
    }
    if (!world.state.pendingCards) {
      // No offer yet: fall back to a live play frame rather than an empty screen.
      return { screen: SCREEN_PLAY, best: totalScore(world.state) };
    }
    return { screen: SCREEN_LEVELUP, best: totalScore(world.state) };
  }
  if (name === 'end') {
    world.reset();
    playFor(world, END_PLAY_SECONDS, PILOT_PLAY);
    // Then stand still: the dark catches a light that stops moving.
    const steps = Math.floor(END_LIMIT_SECONDS / STEP);
    for (let i = 0; i < steps; i += 1) {
      const events = world.step(STEP, { x: 0, y: 0 }, false);
      if (world.state.pendingCards) world.applyCard(world.state.pendingCards[0]);
      if (events & (EVENT_OVER | EVENT_VICTORY)) break;
    }
    return {
      screen: SCREEN_OVER,
      best: totalScore(world.state),
      newBest: totalScore(world.state) > 0,
    };
  }
  world.reset();
  for (let i = 0; i < START_SECONDS / STEP; i += 1) world.step(STEP, { x: 0, y: 0 }, true);
  return { screen: SCREEN_TITLE, best: 0 };
}
