// Juice: sparks, rings and floating numbers. Particles are a capped pool of plain
// objects — no allocation churn mid-fight — each with a velocity, a life and a fade.
// Floating texts rise and fade; rings expand and thin out.
import { MAX_PARTICLES } from './config.js';

export function createParticles() {
  const parts = [];
  const texts = [];
  const rings = [];

  return {
    burst(x, y, color, count, speed, life = 0.5, size = 3) {
      for (let i = 0; i < count; i += 1) {
        if (parts.length >= MAX_PARTICLES) parts.shift();
        const angle = Math.random() * Math.PI * 2;
        const v = speed * (0.3 + Math.random() * 0.7);
        parts.push({
          x, y,
          vx: Math.cos(angle) * v,
          vy: Math.sin(angle) * v,
          life: life * (0.6 + Math.random() * 0.7),
          maxLife: life,
          size: size * (0.6 + Math.random() * 0.8),
          color,
        });
      }
    },
    ring(x, y, color, maxRadius) {
      rings.push({ x, y, color, radius: 8, maxRadius, life: 0.45, maxLife: 0.45 });
    },
    text(x, y, value, color) {
      if (texts.length > 40) texts.shift();
      texts.push({ x, y, value, color, life: 0.8, maxLife: 0.8 });
    },
    update(dt) {
      for (let i = parts.length - 1; i >= 0; i -= 1) {
        const p = parts[i];
        p.life -= dt;
        if (p.life <= 0) {
          parts.splice(i, 1);
          continue;
        }
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vx *= 0.96;
        p.vy *= 0.96;
      }
      for (let i = texts.length - 1; i >= 0; i -= 1) {
        const t = texts[i];
        t.life -= dt;
        t.y -= 34 * dt;
        if (t.life <= 0) texts.splice(i, 1);
      }
      for (let i = rings.length - 1; i >= 0; i -= 1) {
        const r = rings[i];
        r.life -= dt;
        r.radius = r.maxRadius * (1 - r.life / r.maxLife);
        if (r.life <= 0) rings.splice(i, 1);
      }
    },
    draw(ctx) {
      for (const r of rings) {
        ctx.globalAlpha = Math.max(0, r.life / r.maxLife) * 0.8;
        ctx.strokeStyle = r.color;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(r.x, r.y, r.radius, 0, Math.PI * 2);
        ctx.stroke();
      }
      for (const p of parts) {
        ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      ctx.textAlign = 'center';
      for (const t of texts) {
        ctx.globalAlpha = Math.max(0, t.life / t.maxLife);
        ctx.font = 'bold 15px system-ui, sans-serif';
        ctx.fillStyle = t.color;
        ctx.fillText(t.value, t.x, t.y);
      }
      ctx.globalAlpha = 1;
    },
    clear() {
      parts.length = 0;
      texts.length = 0;
      rings.length = 0;
    },
  };
}
