// The simulation: one fixed-step world holding the player, the shades, the shots,
// the shards and the clock. `step` advances everything — movement, weapons, spawns,
// collisions, level-ups, bosses — and returns which events the frame should answer
// with (a hit, a level-up offer, a boss arrival, the end of the run). Nothing here
// draws or plays sound; it only changes state.
import { ARENA, HERALD_TIME, KING_TIME, MAX_ENEMIES, PLAYER, STEP, VIEW, spawnPace, xpNeeded } from './config.js';
import { BOSSES, spawnBoss, spawnEnemy, unlockedTypes } from './enemies.js';
import { WEAPONS, applyCard as applyCardToState, drawCards } from './weapons.js';
import { createParticles } from './particles.js';

export const EVENT_HIT = 1;
export const EVENT_PICKUP = 2;
export const EVENT_LEVELUP = 4;
export const EVENT_OVER = 8;
export const EVENT_VICTORY = 16;
export const EVENT_BOSS = 32;
export const EVENT_ENEMY_DOWN = 64;
export const EVENT_NOVA = 128;

function dist2(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
}

export function totalScore(state) {
  return state.killScore + Math.floor(state.time) * 5;
}

export function createWorld(rng) {
  const particles = createParticles();
  let state;

  function reset() {
    particles.clear();
    state = {
      time: 0,
      player: {
        x: VIEW.width / 2, y: VIEW.height / 2,
        hp: PLAYER.maxHp, maxHp: PLAYER.maxHp,
        level: 1, xp: 0, xpNext: xpNeeded(1),
        invuln: 0, face: 1,
      },
      weapons: { bolts: 1 },
      passives: {},
      enemies: [],
      shots: [],
      enemyShots: [],
      gems: [],
      kills: 0,
      killScore: 0,
      gemsCollected: 0,
      damageDealt: 0,
      spawnTimer: 0.5,
      boltTimer: 0.3,
      novaTimer: 0,
      wispTimer: 0,
      orbitAngle: 0,
      orbitHits: new Map(),
      boss: null,
      heraldSpawned: false,
      kingSpawned: false,
      shake: 0,
      hitFlash: 0,
      combo: 0,
      comboTimer: 0,
      banner: null,
      pendingCards: null,
      over: false,
      victory: false,
      attract: false,
    };
  }

  function speedMul() {
    return 1 + (state.passives.swift ?? 0) * 0.1;
  }
  function pickupMul() {
    return 1 + (state.passives.magnet ?? 0) * 0.4;
  }
  function armor() {
    return state.passives.ward ?? 0;
  }
  function regenRate() {
    return (state.passives.regen ?? 0) * 0.8;
  }

  function spawnPoint() {
    const side = rng.int(0, 3);
    const m = ARENA.margin;
    if (side === 0) return { x: rng.range(m, VIEW.width - m), y: m };
    if (side === 1) return { x: rng.range(m, VIEW.width - m), y: VIEW.height - m };
    if (side === 2) return { x: m, y: rng.range(m, VIEW.height - m) };
    return { x: VIEW.width - m, y: rng.range(m, VIEW.height - m) };
  }

  function spawnWave() {
    const pace = spawnPace(state.time);
    const types = unlockedTypes(state.time);
    const totalWeight = types.reduce((sum, t) => sum + t.weight, 0);
    for (let i = 0; i < pace.batch; i += 1) {
      if (state.enemies.length >= MAX_ENEMIES) return;
      let roll = rng.next() * totalWeight;
      let id = types[0].id;
      for (const t of types) {
        roll -= t.weight;
        if (roll <= 0) {
          id = t.id;
          break;
        }
      }
      const p = spawnPoint();
      state.enemies.push(spawnEnemy(rng, id, p.x, p.y, state.time));
    }
  }

  function spawnBossNow(id) {
    const boss = spawnBoss(id, VIEW.width / 2, 90);
    state.enemies.push(boss);
    state.boss = boss;
    state.banner = {
      text: BOSSES[id].name,
      sub: id === 'king' ? 'Slay him and the Hollow is yours.' : 'A herald of the dark has come.',
      timer: 2.8,
    };
  }

  function hurtPlayer(amount) {
    if (state.player.invuln > 0 || state.over || state.victory) return 0;
    const dealt = Math.max(1, Math.round(amount - armor()));
    state.player.hp -= dealt;
    state.player.invuln = PLAYER.invulnSeconds;
    state.hitFlash = 0.5;
    state.shake = Math.max(state.shake, 9);
    state.combo = 0;
    if (state.player.hp <= 0) {
      state.player.hp = 0;
      state.over = true;
    }
    return EVENT_HIT | (state.over ? EVENT_OVER : 0);
  }

  function damageEnemy(enemy, amount, kx, ky) {
    enemy.hp -= amount;
    enemy.flash = 0.09;
    state.damageDealt += amount;
    const resist = enemy.behaviour === 'brute' || enemy.boss ? 0.15 : 1;
    enemy.knockX += kx * resist;
    enemy.knockY += ky * resist;
    particles.text(enemy.x, enemy.y - enemy.radius - 6, String(Math.round(amount)), '#ffe9a8');
    if (enemy.hp <= 0) killEnemy(enemy);
  }

  function killEnemy(enemy) {
    enemy.dead = true;
    state.kills += 1;
    state.killScore += enemy.score;
    particles.burst(enemy.x, enemy.y, enemy.color, enemy.boss ? 60 : enemy.elite ? 26 : 12, enemy.boss ? 260 : 160, 0.6, enemy.boss ? 5 : 3);
    let remaining = enemy.xp;
    while (remaining > 0) {
      const value = Math.min(remaining, 5);
      remaining -= value;
      state.gems.push({
        x: enemy.x + rng.range(-14, 14),
        y: enemy.y + rng.range(-14, 14),
        value,
        vx: rng.range(-40, 40),
        vy: rng.range(-40, 40),
      });
    }
    if (enemy.boss) {
      state.shake = Math.max(state.shake, 12);
      particles.ring(enemy.x, enemy.y, '#ffd166', 260);
      state.boss = null;
      if (enemy.id === 'king') {
        state.victory = true;
      } else {
        state.banner = { text: 'Herald slain', sub: 'The dark recoils — for now.', timer: 2.2 };
      }
    }
  }

  function nearestEnemies(from, count) {
    return state.enemies
      .filter((e) => !e.dead)
      .map((e) => ({ e, d: dist2(from, e) }))
      .sort((a, b) => a.d - b.d)
      .slice(0, count)
      .map((entry) => entry.e);
  }

  function fireWeapons(dt) {
    const p = state.player;
    const bolts = WEAPONS.bolts.levels[(state.weapons.bolts ?? 1) - 1];
    state.boltTimer -= dt;
    if (state.boltTimer <= 0) {
      const targets = nearestEnemies(p, bolts.count);
      if (targets.length > 0) {
        for (const target of targets) {
          const dx = target.x - p.x;
          const dy = target.y - p.y;
          const len = Math.hypot(dx, dy) || 1;
          state.shots.push({
            kind: 'bolt', x: p.x, y: p.y,
            vx: (dx / len) * bolts.speed, vy: (dy / len) * bolts.speed,
            damage: bolts.damage, life: 1.4, target: null,
          });
        }
        state.boltTimer = bolts.cooldown;
      } else {
        state.boltTimer = 0.1;
      }
    }
    if (state.weapons.wisps) {
      const def = WEAPONS.wisps.levels[state.weapons.wisps - 1];
      state.wispTimer -= dt;
      if (state.wispTimer <= 0) {
        const targets = nearestEnemies(p, def.count);
        if (targets.length > 0) {
          for (const target of targets) {
            const angle = rng.range(0, Math.PI * 2);
            state.shots.push({
              kind: 'wisp', x: p.x + Math.cos(angle) * 18, y: p.y + Math.sin(angle) * 18,
              vx: 0, vy: 0, damage: def.damage, life: 4, target,
              speed: def.speed,
            });
          }
          state.wispTimer = def.cooldown;
        } else {
          state.wispTimer = 0.1;
        }
      }
    }
    if (state.weapons.orbit) {
      const def = WEAPONS.orbit.levels[state.weapons.orbit - 1];
      state.orbitAngle += def.spin * dt;
    }
  }

  function fireNova() {
    const def = WEAPONS.nova.levels[state.weapons.nova - 1];
    const p = state.player;
    particles.ring(p.x, p.y, '#ffd166', def.radius);
    particles.burst(p.x, p.y, '#ffe9a8', 24, 300, 0.4, 3);
    for (const enemy of state.enemies) {
      if (enemy.dead) continue;
      const dx = enemy.x - p.x;
      const dy = enemy.y - p.y;
      const d = Math.hypot(dx, dy);
      if (d < def.radius + enemy.radius) {
        damageEnemy(enemy, def.damage, (dx / (d || 1)) * 260, (dy / (d || 1)) * 260);
      }
    }
    return EVENT_NOVA;
  }

  function moveEnemy(enemy, dt) {
    const p = state.player;
    const dx = p.x - enemy.x;
    const dy = p.y - enemy.y;
    const d = Math.hypot(dx, dy) || 1;
    let mx = dx / d;
    let my = dy / d;
    const speed = enemy.speed;
    if (enemy.behaviour === 'swarm') {
      const w = Math.sin(state.time * 3 + enemy.wobble) * 0.7;
      const px = -my * w;
      const py = mx * w;
      mx += px;
      my += py;
      const len = Math.hypot(mx, my) || 1;
      mx /= len;
      my /= len;
    } else if (enemy.behaviour === 'dasher') {
      if (enemy.dashing > 0) {
        enemy.dashing -= dt;
        enemy.x += enemy.dashX * speed * 3.4 * dt;
        enemy.y += enemy.dashY * speed * 3.4 * dt;
        return;
      }
      enemy.dashTimer -= dt;
      if (enemy.dashTimer <= 0 && d < 300) {
        enemy.dashing = 0.42;
        enemy.dashX = mx;
        enemy.dashY = my;
        enemy.dashTimer = 2.4;
      }
    } else if (enemy.behaviour === 'spitter') {
      if (d < 210) {
        mx = -mx;
        my = -my;
      } else if (d < 330) {
        // Strafe sideways at mid range, keeping its distance.
        const px = -my;
        const py = mx;
        mx = px;
        my = py;
      }
      enemy.shotTimer -= dt;
      if (enemy.shotTimer <= 0 && d < 420) {
        enemy.shotTimer = 2.2;
        state.enemyShots.push({
          x: enemy.x, y: enemy.y,
          vx: (dx / d) * 210, vy: (dy / d) * 210,
          damage: 10, radius: 7, life: 3.5,
        });
      }
    } else if (enemy.behaviour === 'boss') {
      enemy.summonTimer -= dt;
      if (enemy.summonTimer <= 0 && state.enemies.length < MAX_ENEMIES - 4) {
        enemy.summonTimer = enemy.hp < enemy.maxHp / 2 ? 7 : 10;
        for (let i = 0; i < 4; i += 1) {
          const a = rng.range(0, Math.PI * 2);
          const minion = spawnEnemy(rng, BOSSES[enemy.id].minions, enemy.x + Math.cos(a) * 50, enemy.y + Math.sin(a) * 50, state.time);
          state.enemies.push(minion);
        }
        particles.burst(enemy.x, enemy.y, enemy.color, 20, 200, 0.5, 4);
      }
      enemy.burstTimer -= dt;
      if (enemy.burstTimer <= 0) {
        enemy.burstTimer = enemy.hp < enemy.maxHp / 2 ? 3.2 : 4.5;
        const n = enemy.id === 'king' ? 12 : 8;
        for (let i = 0; i < n; i += 1) {
          const a = (i / n) * Math.PI * 2 + rng.range(0, 0.4);
          state.enemyShots.push({
            x: enemy.x, y: enemy.y,
            vx: Math.cos(a) * 170, vy: Math.sin(a) * 170,
            damage: 12, radius: 8, life: 4,
          });
        }
      }
    }
    enemy.x += mx * speed * dt;
    enemy.y += my * speed * dt;
  }

  function step(dt, move, attract) {
    let events = 0;
    const p = state.player;
    state.attract = attract;
    state.shake = Math.max(0, state.shake - dt * 26);
    state.hitFlash = Math.max(0, state.hitFlash - dt);
    state.comboTimer -= dt;
    if (state.comboTimer <= 0) state.combo = 0;
    if (state.banner) {
      state.banner.timer -= dt;
      if (state.banner.timer <= 0) state.banner = null;
    }
    particles.update(dt);

    if (attract) {
      state.spawnTimer -= dt;
      if (state.spawnTimer <= 0 && state.enemies.length < 9) {
        state.spawnTimer = 1.6;
        const pt = spawnPoint();
        state.enemies.push(spawnEnemy(rng, rng.pick(['shade', 'wisp', 'shade']), pt.x, pt.y, 30));
      }
      for (const enemy of state.enemies) {
        const dx = VIEW.width / 2 - enemy.x;
        const dy = VIEW.height / 2 - enemy.y;
        const d = Math.hypot(dx, dy) || 1;
        if (d > 130) {
          enemy.x += (dx / d) * enemy.speed * 0.5 * dt;
          enemy.y += (dy / d) * enemy.speed * 0.5 * dt;
        }
        enemy.wobble += dt;
      }
      state.orbitAngle += dt * 1.2;
      return 0;
    }

    if (state.over || state.victory || state.pendingCards) {
      for (const enemy of state.enemies) enemy.flash = Math.max(0, enemy.flash - dt);
      return 0;
    }

    state.time += dt;
    p.invuln = Math.max(0, p.invuln - dt);
    if (regenRate() > 0) p.hp = Math.min(p.maxHp, p.hp + regenRate() * dt);

    // Move the player, kept inside the arena.
    p.x = Math.min(VIEW.width - ARENA.margin, Math.max(ARENA.margin, p.x + move.x * PLAYER.speed * speedMul() * dt));
    p.y = Math.min(VIEW.height - ARENA.margin, Math.max(ARENA.margin, p.y + move.y * PLAYER.speed * speedMul() * dt));
    if (move.x !== 0) p.face = move.x > 0 ? 1 : -1;

    // Boss arrivals.
    if (!state.heraldSpawned && state.time >= HERALD_TIME) {
      state.heraldSpawned = true;
      spawnBossNow('herald');
      events |= EVENT_BOSS;
    }
    if (!state.kingSpawned && state.time >= KING_TIME) {
      state.kingSpawned = true;
      spawnBossNow('king');
      events |= EVENT_BOSS;
    }

    // Roaming spawns.
    state.spawnTimer -= dt;
    if (state.spawnTimer <= 0) {
      spawnWave();
      state.spawnTimer = spawnPace(state.time).interval;
    }

    fireWeapons(dt);
    if (state.weapons.nova) {
      state.novaTimer -= dt;
      if (state.novaTimer <= 0) {
        events |= fireNova();
        state.novaTimer = WEAPONS.nova.levels[state.weapons.nova - 1].cooldown;
      }
    }

    // Orbit sparks scorch what they touch.
    if (state.weapons.orbit) {
      const def = WEAPONS.orbit.levels[state.weapons.orbit - 1];
      for (let i = 0; i < def.count; i += 1) {
        const a = state.orbitAngle + (i / def.count) * Math.PI * 2;
        const ox = p.x + Math.cos(a) * def.radius;
        const oy = p.y + Math.sin(a) * def.radius;
        for (const enemy of state.enemies) {
          if (enemy.dead) continue;
          const hitAt = state.orbitHits.get(enemy) ?? -1;
          if (state.time - hitAt < 0.45) continue;
          const dx = enemy.x - ox;
          const dy = enemy.y - oy;
          if (dx * dx + dy * dy < (enemy.radius + 13) * (enemy.radius + 13)) {
            state.orbitHits.set(enemy, state.time);
            const d = Math.hypot(dx, dy) || 1;
            damageEnemy(enemy, def.damage, (dx / d) * 160, (dy / d) * 160);
          }
        }
      }
    }

    // Player projectiles: bolts fly straight, wisps home in.
    for (const shot of state.shots) {
      shot.life -= dt;
      if (shot.kind === 'wisp') {
        if (!shot.target || shot.target.dead) shot.target = nearestEnemies(shot, 1)[0] ?? null;
        if (shot.target) {
          const dx = shot.target.x - shot.x;
          const dy = shot.target.y - shot.y;
          const d = Math.hypot(dx, dy) || 1;
          const turn = 6.5 * dt;
          shot.vx += ((dx / d) * shot.speed - shot.vx) * turn;
          shot.vy += ((dy / d) * shot.speed - shot.vy) * turn;
        }
      }
      shot.x += shot.vx * dt;
      shot.y += shot.vy * dt;
      for (const enemy of state.enemies) {
        if (enemy.dead || shot.life <= 0) continue;
        const dx = enemy.x - shot.x;
        const dy = enemy.y - shot.y;
        const r = enemy.radius + (shot.kind === 'wisp' ? 9 : 6);
        if (dx * dx + dy * dy < r * r) {
          const d = Math.hypot(dx, dy) || 1;
          damageEnemy(enemy, shot.damage, (dx / d) * 120, (dy / d) * 120);
          particles.burst(shot.x, shot.y, '#ffe9a8', 3, 90, 0.25, 2);
          shot.life = 0;
          break;
        }
      }
    }
    state.shots = state.shots.filter((s) => s.life > 0 && s.x > -20 && s.x < VIEW.width + 20 && s.y > -20 && s.y < VIEW.height + 20);

    // Enemies move, drift apart, and bite.
    for (const enemy of state.enemies) {
      if (enemy.dead) continue;
      enemy.flash = Math.max(0, enemy.flash - dt);
      moveEnemy(enemy, dt);
      enemy.x += enemy.knockX * dt;
      enemy.y += enemy.knockY * dt;
      enemy.knockX *= 0.86;
      enemy.knockY *= 0.86;
      enemy.x = Math.min(VIEW.width - 8, Math.max(8, enemy.x));
      enemy.y = Math.min(VIEW.height - 8, Math.max(8, enemy.y));
    }
    for (let i = 0; i < state.enemies.length; i += 1) {
      const a = state.enemies[i];
      if (a.dead || a.boss) continue;
      for (let j = i + 1; j < state.enemies.length; j += 1) {
        const b = state.enemies[j];
        if (b.dead || b.boss) continue;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const min = (a.radius + b.radius) * 0.85;
        const d2 = dx * dx + dy * dy;
        if (d2 > 0.01 && d2 < min * min) {
          const d = Math.sqrt(d2);
          const push = ((min - d) / d) * 0.5;
          a.x -= dx * push * 0.5;
          a.y -= dy * push * 0.5;
          b.x += dx * push * 0.5;
          b.y += dy * push * 0.5;
        }
      }
    }
    for (const enemy of state.enemies) {
      if (enemy.dead) continue;
      const dx = enemy.x - p.x;
      const dy = enemy.y - p.y;
      const r = enemy.radius + PLAYER.radius - 2;
      if (dx * dx + dy * dy < r * r) {
        events |= hurtPlayer(enemy.damage);
        if (state.over) break;
      }
    }

    // Enemy shots.
    for (const shot of state.enemyShots) {
      shot.life -= dt;
      shot.x += shot.vx * dt;
      shot.y += shot.vy * dt;
      const dx = shot.x - p.x;
      const dy = shot.y - p.y;
      const r = shot.radius + PLAYER.radius;
      if (dx * dx + dy * dy < r * r && shot.life > 0) {
        shot.life = 0;
        events |= hurtPlayer(shot.damage);
      }
    }
    state.enemyShots = state.enemyShots.filter((s) => s.life > 0);

    // Shards drift, then fly to the player when near.
    const pickupR = PLAYER.pickupRadius * pickupMul();
    for (const gem of state.gems) {
      gem.x += gem.vx * dt;
      gem.y += gem.vy * dt;
      gem.vx *= 0.92;
      gem.vy *= 0.92;
      const dx = p.x - gem.x;
      const dy = p.y - gem.y;
      const d = Math.hypot(dx, dy);
      if (d < pickupR) {
        const pull = 620 * (1 - d / (pickupR + 1)) + 240;
        gem.x += (dx / (d || 1)) * pull * dt;
        gem.y += (dy / (d || 1)) * pull * dt;
      }
      if (d < PLAYER.radius + 10) {
        gem.taken = true;
        p.xp += gem.value;
        state.gemsCollected += 1;
        state.combo += 1;
        state.comboTimer = 1.5;
        events |= EVENT_PICKUP;
      }
    }
    state.gems = state.gems.filter((g) => !g.taken);

    // Level up: offer three cards and pause the sim until one is picked.
    if (p.xp >= p.xpNext) {
      p.xp -= p.xpNext;
      p.level += 1;
      p.xpNext = xpNeeded(p.level);
      state.pendingCards = drawCards(state, rng);
      particles.ring(p.x, p.y, '#ffd166', 120);
      events |= EVENT_LEVELUP;
    }

    const before = state.enemies.length;
    state.enemies = state.enemies.filter((e) => {
      if (e.dead) state.orbitHits.delete(e);
      return !e.dead;
    });
    if (state.enemies.length < before) events |= EVENT_ENEMY_DOWN;
    if (state.victory) events |= EVENT_VICTORY;
    if (state.over) events |= EVENT_OVER;
    return events;
  }

  function applyCard(card) {
    applyCardToState(state, card);
    state.pendingCards = null;
  }

  reset();
  return { state, particles, reset, step, applyCard };
}
