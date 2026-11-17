// Boot and the one loop: input is read every frame, the world advances in fixed
// 1/60 s steps (several in a slow frame, none in a fast one), and the renderer
// paints what is there. The game moves between six screens: title, play, paused,
// level-up, game over and victory. Sounds answer the world's events; the best
// score survives visits in localStorage.
//
// ?seed=N fixes the run. ?shot=start|play|levelup|end (with &seed=N) stages that
// scene instead of running the loop, paints it twice and sets window.__shotReady
// for a screenshot.
import { BEST_KEY, KING_TIME, STEP, VIEW } from './config.js';
import { createRandom } from './random.js';
import {
  EVENT_BOSS, EVENT_ENEMY_DOWN, EVENT_HIT, EVENT_LEVELUP, EVENT_NOVA, EVENT_OVER,
  EVENT_PICKUP, EVENT_VICTORY, createWorld, totalScore,
} from './world.js';
import {
  ACTION_CARD_1, ACTION_CARD_2, ACTION_CARD_3, ACTION_CONFIRM, ACTION_MUTE,
  ACTION_PAUSE, ACTION_RESTART, ACTION_TITLE, createInput,
} from './input.js';
import { createAudio } from './audio.js';
import {
  SCREEN_LEVELUP, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE,
  SCREEN_VICTORY, cardRects, createRenderer,
} from './render.js';
import { stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall (a hidden tab) is dropped, not replayed. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(createRandom(seed));
const renderer = createRenderer(canvas);
const audio = createAudio();

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage can be off (private windows): the best score then lasts this visit only.
  }
}

function runShot(name) {
  const scene = stageShot(name, world);
  let painted = 0;
  function paint() {
    renderer.draw(world.state, world.particles, scene.screen, {
      best: scene.best,
      muted: audio.isMuted(),
      mouse: null,
      newBest: scene.newBest ?? false,
      stars: 3,
    }, performance.now() / 1000);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas, VIEW);
  let screen = SCREEN_TITLE;
  let best = readBest();
  let newBest = false;
  let stars = 1;
  let accumulator = 0;
  let last = performance.now();
  let lastDownSound = 0;

  // Screen readers (and anyone watching the page's text) hear the screen changes and each hit.
  function announce(message) {
    status.textContent = message;
  }

  function startGame() {
    world.reset();
    accumulator = 0;
    newBest = false;
    screen = SCREEN_PLAY;
    announce('Playing. Survive the night.');
  }

  function finishRun(victorious) {
    const score = totalScore(world.state);
    if (score > best) {
      best = score;
      newBest = true;
      saveBest(best);
    }
    if (victorious) {
      stars = 1
        + (world.state.player.hp > world.state.player.maxHp * 0.5 ? 1 : 0)
        + (world.state.time - KING_TIME < 60 ? 1 : 0);
      screen = SCREEN_VICTORY;
      audio.victory();
      announce(`Victory! Score ${score}. Best ${best}.`);
    } else {
      screen = SCREEN_OVER;
      audio.gameover();
      announce(`Game over. Score ${score}. Best ${best}.`);
    }
  }

  function goTitle() {
    world.reset();
    screen = SCREEN_TITLE;
    announce('Lumen. Press Space or click to start.');
  }

  function handleEvents(events) {
    if (events & EVENT_HIT) {
      audio.hit();
      announce(world.state.player.hp <= 0 ? 'The light fades.' : `Hit. ${Math.ceil(world.state.player.hp)} health left.`);
    }
    if (events & EVENT_PICKUP) audio.pickup(world.state.combo);
    if (events & EVENT_LEVELUP) {
      audio.levelup();
      screen = SCREEN_LEVELUP;
      announce(`Level ${world.state.player.level}. Choose a blessing.`);
    }
    if (events & EVENT_BOSS) {
      audio.boss();
      if (world.state.boss) announce(`${world.state.boss.id === 'king' ? 'The Hollow King' : 'The Gloom Herald'} has come.`);
    }
    if (events & EVENT_NOVA) audio.nova();
    if (events & EVENT_ENEMY_DOWN) {
      const now = performance.now();
      if (now - lastDownSound > 140) {
        lastDownSound = now;
        audio.enemyDown();
      }
    }
    if (events & EVENT_VICTORY) finishRun(true);
    else if (events & EVENT_OVER) finishRun(false);
  }

  function pickCard(index) {
    const cards = world.state.pendingCards;
    if (!cards || !cards[index]) return;
    audio.click();
    world.applyCard(cards[index]);
    screen = SCREEN_PLAY;
    announce('Blessing chosen. Playing.');
  }

  function handleActions() {
    const actions = input.takeActions();
    if (actions & ACTION_MUTE) audio.toggleMute();
    if (screen === SCREEN_TITLE) {
      if (actions & ACTION_CONFIRM) {
        audio.unlock();
        audio.click();
        startGame();
      }
      return;
    }
    if (screen === SCREEN_PLAY) {
      if (actions & ACTION_PAUSE) {
        screen = SCREEN_PAUSED;
        announce('Paused.');
      } else if (actions & ACTION_RESTART) {
        startGame();
      }
      return;
    }
    if (screen === SCREEN_PAUSED) {
      if (actions & (ACTION_PAUSE | ACTION_CONFIRM)) {
        screen = SCREEN_PLAY;
        announce('Playing.');
      } else if (actions & ACTION_RESTART) {
        startGame();
      } else if (actions & ACTION_TITLE) {
        goTitle();
      }
      return;
    }
    if (screen === SCREEN_LEVELUP) {
      if (actions & ACTION_CARD_1) pickCard(0);
      else if (actions & ACTION_CARD_2) pickCard(1);
      else if (actions & ACTION_CARD_3) pickCard(2);
      const click = input.takeClick();
      if (click) {
        const rects = cardRects((world.state.pendingCards ?? []).length);
        rects.forEach((r, i) => {
          if (click.x >= r.x && click.x <= r.x + r.w && click.y >= r.y && click.y <= r.y + r.h) pickCard(i);
        });
      }
      return;
    }
    // Game over and victory.
    if (actions & ACTION_TITLE) {
      goTitle();
    } else if (actions & (ACTION_CONFIRM | ACTION_RESTART)) {
      audio.click();
      startGame();
    }
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    handleActions();
    input.takeClick();
    if (screen === SCREEN_TITLE) {
      while (accumulator >= STEP) {
        world.step(STEP, { x: 0, y: 0 }, true);
        accumulator -= STEP;
      }
    } else if (screen === SCREEN_PLAY) {
      while (accumulator >= STEP && screen === SCREEN_PLAY) {
        const events = world.step(STEP, input.direction(world.state.player), false);
        accumulator -= STEP;
        handleEvents(events);
      }
    } else {
      accumulator = 0;
    }
    renderer.draw(world.state, world.particles, screen, {
      best,
      muted: audio.isMuted(),
      mouse: input.mouse(),
      newBest,
      stars,
    }, now / 1000);
  }

  // The first gesture unlocks sound; leaving the tab pauses a running game.
  window.addEventListener('pointerdown', () => audio.unlock(), { once: true });
  window.addEventListener('keydown', () => audio.unlock(), { once: true });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  announce('Lumen. Last Light of the Hollow. Press Space or click to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
