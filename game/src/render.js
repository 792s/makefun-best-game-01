// Everything the player sees, painted on one canvas: the dark clearing and its
// drifting embers, the glowing player and the shades, the HUD, and every screen
// (title, pause, level-up, game over, victory). All art is drawn from code —
// circles, gradients and glyphs — so the game needs no image files at all.
import { ARENA, KING_TIME, PALETTE, PLAYER, VIEW } from './config.js';
import { WEAPONS } from './weapons.js';
import { totalScore } from './world.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_LEVELUP = 'levelup';
export const SCREEN_OVER = 'over';
export const SCREEN_VICTORY = 'victory';

const CARD_W = 250;
const CARD_H = 300;
const CARD_GAP = 28;

export function cardRects() {
  const total = CARD_W * 3 + CARD_GAP * 2;
  const x0 = (VIEW.width - total) / 2;
  const y0 = 218;
  return [0, 1, 2].map((i) => ({ x: x0 + i * (CARD_W + CARD_GAP), y: y0, w: CARD_W, h: CARD_H }));
}

function fmtTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function fmtNum(n) {
  return n.toLocaleString('en-US');
}

export function createRenderer(canvas) {
  canvas.width = VIEW.width;
  canvas.height = VIEW.height;
  const ctx = canvas.getContext('2d');

  // The night sky: fixed stars and drifting embers, placed once by a tiny LCG
  // so the background is the same every visit.
  let seed = 1234567;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const stars = Array.from({ length: 110 }, () => ({
    x: rand() * VIEW.width, y: rand() * VIEW.height,
    r: 0.6 + rand() * 1.4, tw: rand() * Math.PI * 2,
  }));
  const embers = Array.from({ length: 42 }, () => ({
    x: rand() * VIEW.width, y: rand() * VIEW.height,
    r: 1 + rand() * 2.2, drift: 6 + rand() * 14, ph: rand() * Math.PI * 2,
  }));

  function drawBackground(now) {
    const g = ctx.createLinearGradient(0, 0, 0, VIEW.height);
    g.addColorStop(0, PALETTE.bgTop);
    g.addColorStop(1, PALETTE.bgBottom);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
    for (const s of stars) {
      ctx.globalAlpha = 0.25 + 0.35 * (0.5 + 0.5 * Math.sin(now * 0.7 + s.tw));
      ctx.fillStyle = '#cdd6ff';
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    for (const e of embers) {
      const y = ((e.y - now * e.drift) % (VIEW.height + 20) + VIEW.height + 20) % (VIEW.height + 20) - 10;
      const x = e.x + Math.sin(now * 0.4 + e.ph) * 12;
      ctx.globalAlpha = 0.12 + 0.12 * Math.sin(now + e.ph);
      ctx.fillStyle = PALETTE.amber;
      ctx.beginPath();
      ctx.arc(x, y, e.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    // A faint clearing ring where the fight happens.
    ctx.strokeStyle = 'rgba(255, 209, 102, 0.07)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(VIEW.width / 2, VIEW.height / 2, 560, 300, 0, 0, Math.PI * 2);
    ctx.stroke();
  }

  function drawGlow(x, y, radius, color, alpha) {
    const g = ctx.createRadialGradient(x, y, 0, x, y, radius);
    g.addColorStop(0, color);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.globalAlpha = alpha;
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  function drawGems(state) {
    for (const gem of state.gems) {
      const big = gem.value >= 5;
      ctx.save();
      ctx.translate(gem.x, gem.y);
      ctx.rotate(Math.PI / 4);
      ctx.fillStyle = big ? PALETTE.cyan : PALETTE.amber;
      const s = big ? 7 : 5;
      ctx.globalAlpha = 0.35;
      ctx.fillRect(-s * 1.8, -s * 1.8, s * 3.6, s * 3.6);
      ctx.globalAlpha = 1;
      ctx.fillRect(-s, -s, s * 2, s * 2);
      ctx.restore();
    }
  }

  function drawEnemy(e, now) {
    const wob = Math.sin(now * 4 + e.wobble) * 0.06;
    const r = e.radius * (1 + wob);
    ctx.globalAlpha = 0.25;
    ctx.fillStyle = e.color;
    ctx.beginPath();
    ctx.arc(e.x, e.y, r * 1.7, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.fillStyle = e.flash > 0 ? '#ffffff' : e.color;
    ctx.beginPath();
    if (e.behaviour === 'dasher') {
      // A darting shard.
      const a = Math.atan2(e.dashY || 1, e.dashX || 0);
      ctx.moveTo(e.x + Math.cos(a) * r * 1.5, e.y + Math.sin(a) * r * 1.5);
      ctx.lineTo(e.x + Math.cos(a + 2.4) * r, e.y + Math.sin(a + 2.4) * r);
      ctx.lineTo(e.x + Math.cos(a - 2.4) * r, e.y + Math.sin(a - 2.4) * r);
      ctx.closePath();
      ctx.fill();
    } else {
      ctx.arc(e.x, e.y, r, 0, Math.PI * 2);
      ctx.fill();
      if (e.behaviour === 'brute') {
        ctx.beginPath();
        for (let i = 0; i < 8; i += 1) {
          const a = (i / 8) * Math.PI * 2 + e.wobble;
          ctx.moveTo(e.x + Math.cos(a) * r * 0.8, e.y + Math.sin(a) * r * 0.8);
          ctx.lineTo(e.x + Math.cos(a) * r * 1.35, e.y + Math.sin(a) * r * 1.35);
          ctx.lineTo(e.x + Math.cos(a + 0.3) * r * 0.8, e.y + Math.sin(a + 0.3) * r * 0.8);
        }
        ctx.fill();
      }
    }
    // Eyes, always watching the player.
    const ex = e.x;
    const ey = e.y - r * 0.15;
    ctx.fillStyle = '#0b0e1a';
    ctx.beginPath();
    ctx.arc(ex - r * 0.32, ey, Math.max(2, r * 0.16), 0, Math.PI * 2);
    ctx.arc(ex + r * 0.32, ey, Math.max(2, r * 0.16), 0, Math.PI * 2);
    ctx.fill();
    if (e.behaviour === 'spitter') {
      ctx.fillStyle = '#0b0e1a';
      ctx.beginPath();
      ctx.arc(e.x, e.y + r * 0.35, r * 0.28, 0, Math.PI * 2);
      ctx.fill();
    }
    if (e.elite) {
      ctx.strokeStyle = PALETTE.amber;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(e.x, e.y, r + 5, 0, Math.PI * 2);
      ctx.stroke();
    }
    if (e.boss) {
      // Crown.
      ctx.fillStyle = PALETTE.amber;
      ctx.beginPath();
      const cw = r * 0.9;
      const cy = e.y - r - 6;
      ctx.moveTo(e.x - cw, cy + 12);
      ctx.lineTo(e.x - cw, cy - 8);
      ctx.lineTo(e.x - cw / 2, cy + 2);
      ctx.lineTo(e.x, cy - 14);
      ctx.lineTo(e.x + cw / 2, cy + 2);
      ctx.lineTo(e.x + cw, cy - 8);
      ctx.lineTo(e.x + cw, cy + 12);
      ctx.closePath();
      ctx.fill();
      // A thin HP arc under a boss.
      ctx.strokeStyle = 'rgba(255,255,255,0.25)';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(e.x, e.y, r + 12, Math.PI * 0.15, Math.PI * 0.85);
      ctx.stroke();
      ctx.strokeStyle = PALETTE.red;
      ctx.beginPath();
      ctx.arc(e.x, e.y, r + 12, Math.PI * 0.15, Math.PI * 0.15 + Math.PI * 0.7 * (e.hp / e.maxHp));
      ctx.stroke();
    }
  }

  function drawPlayer(state, now) {
    const p = state.player;
    const blink = p.invuln > 0 && Math.floor(now * 18) % 2 === 0;
    drawGlow(p.x, p.y, 120, 'rgba(255, 209, 102, 0.55)', blink ? 0.35 : 0.8);
    // Orbit sparks.
    if (state.weapons.orbit) {
      const def = WEAPONS.orbit.levels[state.weapons.orbit - 1];
      for (let i = 0; i < def.count; i += 1) {
        const a = state.orbitAngle + (i / def.count) * Math.PI * 2;
        const ox = p.x + Math.cos(a) * def.radius;
        const oy = p.y + Math.sin(a) * def.radius;
        drawGlow(ox, oy, 26, 'rgba(255, 159, 67, 0.8)', 0.9);
        ctx.fillStyle = PALETTE.amberHot;
        ctx.beginPath();
        ctx.arc(ox, oy, 7, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalAlpha = blink ? 0.45 : 1;
    const g = ctx.createRadialGradient(p.x - 4, p.y - 5, 2, p.x, p.y, PLAYER.radius + 4);
    g.addColorStop(0, '#fffbe8');
    g.addColorStop(0.55, PALETTE.amber);
    g.addColorStop(1, PALETTE.orange);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(p.x, p.y, PLAYER.radius, 0, Math.PI * 2);
    ctx.fill();
    // A small face, looking where it walks.
    ctx.fillStyle = '#3a2a08';
    ctx.beginPath();
    ctx.arc(p.x + p.face * 4 - 3, p.y - 3, 2.4, 0, Math.PI * 2);
    ctx.arc(p.x + p.face * 4 + 4, p.y - 3, 2.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  function drawShots(state) {
    for (const s of state.shots) {
      if (s.kind === 'bolt') {
        ctx.strokeStyle = PALETTE.amberHot;
        ctx.lineWidth = 4;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(s.x - s.vx * 0.03, s.y - s.vy * 0.03);
        ctx.lineTo(s.x, s.y);
        ctx.stroke();
      } else {
        drawGlow(s.x, s.y, 20, 'rgba(76, 201, 240, 0.8)', 0.9);
        ctx.fillStyle = '#d8f6ff';
        ctx.beginPath();
        ctx.arc(s.x, s.y, 6, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    for (const s of state.enemyShots) {
      drawGlow(s.x, s.y, 18, 'rgba(247, 37, 133, 0.7)', 0.8);
      ctx.fillStyle = '#ff8fb8';
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.radius, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawWorld(state, particles, now) {
    drawBackground(now);
    drawGems(state);
    for (const e of state.enemies) drawEnemy(e, now);
    drawPlayer(state, now);
    drawShots(state);
    particles.draw(ctx);
    // The arena's edge.
    ctx.strokeStyle = 'rgba(255, 209, 102, 0.18)';
    ctx.lineWidth = 2;
    ctx.strokeRect(ARENA.margin - 14, ARENA.margin - 14, VIEW.width - 2 * (ARENA.margin - 14), VIEW.height - 2 * (ARENA.margin - 14));
    // Hurt vignette: red at the edges, stronger when the player is low.
    const low = state.player.hp / state.player.maxHp < 0.3 ? 0.16 + 0.08 * Math.sin(now * 5) : 0;
    const alpha = Math.min(0.5, state.hitFlash * 0.8 + low);
    if (alpha > 0.01) {
      const g = ctx.createRadialGradient(VIEW.width / 2, VIEW.height / 2, VIEW.height * 0.35, VIEW.width / 2, VIEW.height / 2, VIEW.height * 0.75);
      g.addColorStop(0, 'rgba(255, 40, 60, 0)');
      g.addColorStop(1, `rgba(255, 40, 60, ${alpha})`);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, VIEW.width, VIEW.height);
    }
  }

  function bar(x, y, w, h, frac, color, bg = 'rgba(255,255,255,0.14)') {
    ctx.fillStyle = bg;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, h / 2);
    ctx.fill();
    if (frac > 0) {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.roundRect(x, y, Math.max(h, w * Math.min(1, frac)), h, h / 2);
      ctx.fill();
    }
  }

  function drawHUD(state, ui) {
    const p = state.player;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    // Health, top left.
    ctx.fillStyle = PALETTE.white;
    ctx.font = 'bold 20px system-ui, sans-serif';
    ctx.fillText('♥', 24, 30);
    bar(50, 20, 250, 20, p.hp / p.maxHp, p.hp / p.maxHp < 0.3 ? PALETTE.red : PALETTE.green);
    ctx.fillStyle = PALETTE.white;
    ctx.font = 'bold 14px system-ui, sans-serif';
    ctx.fillText(`${Math.ceil(p.hp)} / ${p.maxHp}`, 308, 30);
    ctx.fillStyle = PALETTE.amber;
    ctx.font = 'bold 17px system-ui, sans-serif';
    ctx.fillText(`LV ${p.level}`, 24, 58);
    // Timer and wave, top centre.
    ctx.textAlign = 'center';
    ctx.fillStyle = PALETTE.white;
    ctx.font = 'bold 34px system-ui, sans-serif';
    ctx.fillText(fmtTime(state.time), VIEW.width / 2, 30);
    ctx.fillStyle = PALETTE.dim;
    ctx.font = '15px system-ui, sans-serif';
    ctx.fillText(`Wave ${Math.floor(state.time / 30) + 1}  ·  ${fmtNum(state.kills)} slain`, VIEW.width / 2, 58);
    // Score, top right.
    ctx.textAlign = 'right';
    ctx.fillStyle = PALETTE.white;
    ctx.font = 'bold 24px system-ui, sans-serif';
    ctx.fillText(fmtNum(totalScore(state)), VIEW.width - 24, 28);
    ctx.fillStyle = PALETTE.dim;
    ctx.font = '13px system-ui, sans-serif';
    ctx.fillText(`BEST ${fmtNum(ui.best)}`, VIEW.width - 24, 52);
    ctx.fillText(ui.muted ? 'M · sound off' : 'M · sound on', VIEW.width - 24, 72);
    // Boss bar.
    if (state.boss) {
      const b = state.boss;
      ctx.textAlign = 'center';
      ctx.fillStyle = PALETTE.red;
      ctx.font = 'bold 16px system-ui, sans-serif';
      ctx.fillText(b.id === 'king' ? '♛ HOLLOW KING ♛' : '♛ GLOOM HERALD ♛', VIEW.width / 2, 86);
      bar(VIEW.width / 2 - 220, 100, 440, 14, b.hp / b.maxHp, PALETTE.red);
    }
    // Combo.
    if (state.combo >= 5) {
      ctx.textAlign = 'left';
      ctx.fillStyle = PALETTE.cyan;
      ctx.font = 'bold 18px system-ui, sans-serif';
      ctx.fillText(`✦ x${state.combo} streak`, 24, 86);
    }
    // Weapons, bottom left.
    let wx = 24;
    ctx.textAlign = 'center';
    for (const [id, level] of Object.entries(state.weapons)) {
      const def = WEAPONS[id];
      ctx.fillStyle = 'rgba(255,255,255,0.08)';
      ctx.beginPath();
      ctx.roundRect(wx, VIEW.height - 62, 44, 44, 9);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,209,102,0.4)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.fillStyle = PALETTE.amber;
      ctx.font = '22px system-ui, sans-serif';
      ctx.fillText(def.icon, wx + 22, VIEW.height - 44);
      ctx.fillStyle = PALETTE.white;
      ctx.font = 'bold 11px system-ui, sans-serif';
      ctx.fillText(`Lv${level}`, wx + 22, VIEW.height - 24);
      wx += 52;
    }
    // XP bar, bottom.
    bar(24, VIEW.height - 14, VIEW.width - 48, 8, p.xp / p.xpNext, PALETTE.cyan);
    // Boss banner.
    if (state.banner) {
      const a = Math.min(1, state.banner.timer / 0.6, (2.8 - state.banner.timer) / 0.3 + 1);
      ctx.globalAlpha = Math.max(0, Math.min(1, a));
      ctx.textAlign = 'center';
      ctx.fillStyle = PALETTE.red;
      ctx.font = 'bold 44px system-ui, sans-serif';
      ctx.fillText(state.banner.text, VIEW.width / 2, 180);
      ctx.fillStyle = PALETTE.white;
      ctx.font = '19px system-ui, sans-serif';
      ctx.fillText(state.banner.sub, VIEW.width / 2, 216);
      ctx.globalAlpha = 1;
    }
  }

  function dim(alpha) {
    ctx.fillStyle = `rgba(4, 5, 14, ${alpha})`;
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
  }

  function drawTitle(state, ui, now) {
    dim(0.45);
    ctx.textAlign = 'center';
    ctx.save();
    ctx.shadowColor = 'rgba(255, 209, 102, 0.8)';
    ctx.shadowBlur = 42;
    ctx.fillStyle = PALETTE.amber;
    ctx.font = 'bold 108px system-ui, sans-serif';
    ctx.fillText('LUMEN', VIEW.width / 2, 168);
    ctx.restore();
    ctx.fillStyle = PALETTE.white;
    ctx.font = '26px system-ui, sans-serif';
    ctx.fillText('Last Light of the Hollow', VIEW.width / 2, 216);
    ctx.fillStyle = PALETTE.dim;
    ctx.font = '17px system-ui, sans-serif';
    ctx.fillText('The dark is hungry. Your light is the only answer.', VIEW.width / 2, 250);
    // How to play.
    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    ctx.beginPath();
    ctx.roundRect(VIEW.width / 2 - 330, 282, 660, 150, 14);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,209,102,0.3)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.textAlign = 'left';
    ctx.fillStyle = PALETTE.white;
    ctx.font = '17px system-ui, sans-serif';
    const lines = [
      ['Move', 'WASD / arrows, or hold the mouse'],
      ['Fight', 'Your light attacks on its own — just survive'],
      ['Grow', 'Gather shards, level up, choose your blessings'],
      ['Win', `Slay the Hollow King when he comes at ${fmtTime(KING_TIME)}`],
    ];
    lines.forEach(([k, v], i) => {
      const y = 314 + i * 32;
      ctx.fillStyle = PALETTE.amber;
      ctx.font = 'bold 17px system-ui, sans-serif';
      ctx.fillText(k, VIEW.width / 2 - 300, y);
      ctx.fillStyle = PALETTE.white;
      ctx.font = '17px system-ui, sans-serif';
      ctx.fillText(v, VIEW.width / 2 - 200, y);
    });
    ctx.textAlign = 'center';
    if (ui.best > 0) {
      ctx.fillStyle = PALETTE.cyan;
      ctx.font = 'bold 18px system-ui, sans-serif';
      ctx.fillText(`Best score: ${fmtNum(ui.best)}`, VIEW.width / 2, 466);
    }
    const blink = 0.6 + 0.4 * Math.sin(now * 3.2);
    ctx.globalAlpha = blink;
    ctx.fillStyle = PALETTE.amberHot;
    ctx.font = 'bold 26px system-ui, sans-serif';
    ctx.fillText('Click or press SPACE to begin', VIEW.width / 2, 512);
    ctx.globalAlpha = 1;
    ctx.fillStyle = PALETTE.dim;
    ctx.font = '14px system-ui, sans-serif';
    ctx.fillText('P pause   ·   M sound   ·   R restart', VIEW.width / 2, 560);
  }

  function drawPaused() {
    dim(0.6);
    ctx.textAlign = 'center';
    ctx.fillStyle = PALETTE.white;
    ctx.font = 'bold 64px system-ui, sans-serif';
    ctx.fillText('PAUSED', VIEW.width / 2, 300);
    ctx.fillStyle = PALETTE.dim;
    ctx.font = '20px system-ui, sans-serif';
    ctx.fillText('P or Esc to carry on   ·   R to restart   ·   T for the title', VIEW.width / 2, 352);
  }

  function drawLevelUp(state, ui) {
    dim(0.55);
    ctx.textAlign = 'center';
    ctx.fillStyle = PALETTE.amber;
    ctx.font = 'bold 46px system-ui, sans-serif';
    ctx.fillText(`LEVEL ${state.player.level}!`, VIEW.width / 2, 120);
    ctx.fillStyle = PALETTE.white;
    ctx.font = '20px system-ui, sans-serif';
    ctx.fillText('Choose a blessing — click a card or press 1, 2 or 3', VIEW.width / 2, 160);
    const rects = cardRects();
    const cards = state.pendingCards ?? ui.cards ?? [];
    cards.forEach((card, i) => {
      const r = rects[i];
      const hover = ui.mouse && ui.mouse.x >= r.x && ui.mouse.x <= r.x + r.w && ui.mouse.y >= r.y && ui.mouse.y <= r.y + r.h;
      ctx.fillStyle = hover ? 'rgba(255, 209, 102, 0.16)' : 'rgba(255,255,255,0.07)';
      ctx.beginPath();
      ctx.roundRect(r.x, r.y, r.w, r.h, 16);
      ctx.fill();
      ctx.strokeStyle = hover ? PALETTE.amber : 'rgba(255,209,102,0.35)';
      ctx.lineWidth = hover ? 3 : 1.5;
      ctx.stroke();
      ctx.fillStyle = card.fresh ? PALETTE.green : PALETTE.cyan;
      ctx.font = 'bold 14px system-ui, sans-serif';
      ctx.fillText(card.fresh ? '★ NEW' : `LEVEL ${card.level}`, r.x + r.w / 2, r.y + 34);
      ctx.fillStyle = PALETTE.amber;
      ctx.font = '64px system-ui, sans-serif';
      ctx.fillText(card.icon, r.x + r.w / 2, r.y + 110);
      ctx.fillStyle = PALETTE.white;
      ctx.font = 'bold 24px system-ui, sans-serif';
      ctx.fillText(card.name, r.x + r.w / 2, r.y + 160);
      ctx.fillStyle = PALETTE.dim;
      ctx.font = '16px system-ui, sans-serif';
      const words = card.desc.split(' ');
      let line = '';
      let y = r.y + 196;
      for (const word of words) {
        const test = line ? `${line} ${word}` : word;
        if (ctx.measureText(test).width > r.w - 44 && line) {
          ctx.fillText(line, r.x + r.w / 2, y);
          line = word;
          y += 22;
        } else {
          line = test;
        }
      }
      ctx.fillText(line, r.x + r.w / 2, y);
      ctx.fillStyle = PALETTE.dim;
      ctx.font = 'bold 15px system-ui, sans-serif';
      ctx.fillText(`[ ${i + 1} ]`, r.x + r.w / 2, r.y + r.h - 22);
    });
  }

  function drawStats(state, ui, y0) {
    const rows = [
      ['Time survived', fmtTime(state.time)],
      ['Shades slain', fmtNum(state.kills)],
      ['Level reached', String(state.player.level)],
      ['Shards gathered', fmtNum(state.gemsCollected)],
      ['Score', fmtNum(totalScore(state))],
    ];
    ctx.textAlign = 'left';
    rows.forEach(([k, v], i) => {
      const y = y0 + i * 34;
      ctx.fillStyle = PALETTE.dim;
      ctx.font = '19px system-ui, sans-serif';
      ctx.fillText(k, VIEW.width / 2 - 170, y);
      ctx.fillStyle = PALETTE.white;
      ctx.font = 'bold 19px system-ui, sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(v, VIEW.width / 2 + 170, y);
      ctx.textAlign = 'left';
    });
    if (ui.newBest) {
      ctx.textAlign = 'center';
      ctx.fillStyle = PALETTE.amber;
      ctx.font = 'bold 22px system-ui, sans-serif';
      ctx.fillText('★ NEW BEST SCORE ★', VIEW.width / 2, y0 + rows.length * 34 + 14);
    }
  }

  function drawOver(state, ui) {
    dim(0.62);
    ctx.textAlign = 'center';
    ctx.fillStyle = PALETTE.red;
    ctx.font = 'bold 58px system-ui, sans-serif';
    ctx.fillText('THE LIGHT FADES', VIEW.width / 2, 150);
    ctx.fillStyle = PALETTE.dim;
    ctx.font = '19px system-ui, sans-serif';
    ctx.fillText('The Hollow claims another light — but dawn always comes again.', VIEW.width / 2, 192);
    drawStats(state, ui, 248);
    ctx.fillStyle = PALETTE.amberHot;
    ctx.font = 'bold 24px system-ui, sans-serif';
    ctx.fillText('Click, Space or R to try again', VIEW.width / 2, 478);
    ctx.fillStyle = PALETTE.dim;
    ctx.font = '16px system-ui, sans-serif';
    ctx.fillText('T for the title screen', VIEW.width / 2, 512);
  }

  function drawVictory(state, ui) {
    dim(0.55);
    ctx.textAlign = 'center';
    ctx.save();
    ctx.shadowColor = 'rgba(255, 209, 102, 0.8)';
    ctx.shadowBlur = 36;
    ctx.fillStyle = PALETTE.amber;
    ctx.font = 'bold 62px system-ui, sans-serif';
    ctx.fillText('DAWN BREAKS', VIEW.width / 2, 140);
    ctx.restore();
    ctx.fillStyle = PALETTE.white;
    ctx.font = '20px system-ui, sans-serif';
    ctx.fillText('The Hollow King is slain. The Hollow is yours.', VIEW.width / 2, 182);
    const stars = ui.stars ?? 1;
    ctx.font = '52px system-ui, sans-serif';
    let starLine = '';
    for (let i = 0; i < 3; i += 1) starLine += i < stars ? '★' : '☆';
    ctx.fillStyle = PALETTE.amber;
    ctx.fillText(starLine, VIEW.width / 2, 240);
    drawStats(state, ui, 288);
    ctx.fillStyle = PALETTE.amberHot;
    ctx.font = 'bold 24px system-ui, sans-serif';
    ctx.fillText('Click, Space or R to play again', VIEW.width / 2, 512);
    ctx.fillStyle = PALETTE.dim;
    ctx.font = '16px system-ui, sans-serif';
    ctx.fillText('T for the title screen', VIEW.width / 2, 546);
  }

  return {
    draw(state, particles, screen, ui, now) {
      ctx.save();
      if (state.shake > 0.2) {
        ctx.translate((Math.random() - 0.5) * state.shake, (Math.random() - 0.5) * state.shake);
      }
      drawWorld(state, particles, now);
      ctx.restore();
      if (screen === SCREEN_PLAY || screen === SCREEN_PAUSED || screen === SCREEN_LEVELUP) {
        drawHUD(state, ui);
      }
      if (screen === SCREEN_TITLE) drawTitle(state, ui, now);
      else if (screen === SCREEN_PAUSED) drawPaused();
      else if (screen === SCREEN_LEVELUP) drawLevelUp(state, ui);
      else if (screen === SCREEN_OVER) drawOver(state, ui);
      else if (screen === SCREEN_VICTORY) drawVictory(state, ui);
    },
  };
}
