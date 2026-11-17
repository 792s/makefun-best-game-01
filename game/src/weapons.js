// The arsenal: four auto-firing weapons, each with five levels, and five passive
// blessings. On level-up the player picks one of three cards drawn from what is
// still available — a new weapon, a stronger level of one they own, or a blessing.
// The pool is the depth: every run builds differently.
export const WEAPONS = {
  bolts: {
    name: 'Light Bolts', icon: '✦', desc: 'Bolts of light seek the nearest shades.',
    levels: [
      { damage: 15, count: 1, cooldown: 0.5, speed: 520 },
      { damage: 19, count: 1, cooldown: 0.46, speed: 560 },
      { damage: 20, count: 2, cooldown: 0.44, speed: 580 },
      { damage: 25, count: 2, cooldown: 0.38, speed: 620 },
      { damage: 32, count: 3, cooldown: 0.34, speed: 660 },
    ],
  },
  orbit: {
    name: 'Orbit Sparks', icon: '◉', desc: 'Burning sparks circle you and scorch on touch.',
    levels: [
      { damage: 10, count: 1, radius: 62, spin: 2.6 },
      { damage: 14, count: 2, radius: 66, spin: 2.8 },
      { damage: 18, count: 2, radius: 76, spin: 3.0 },
      { damage: 22, count: 3, radius: 82, spin: 3.2 },
      { damage: 28, count: 4, radius: 90, spin: 3.5 },
    ],
  },
  nova: {
    name: 'Nova Burst', icon: '☀', desc: 'A shockwave of dawn blasts everything near you.',
    levels: [
      { damage: 18, radius: 130, cooldown: 4.0 },
      { damage: 26, radius: 150, cooldown: 3.7 },
      { damage: 34, radius: 170, cooldown: 3.4 },
      { damage: 44, radius: 190, cooldown: 3.1 },
      { damage: 58, radius: 215, cooldown: 2.7 },
    ],
  },
  wisps: {
    name: 'Seeker Wisps', icon: '❋', desc: 'Loyal wisps hunt shades down on their own.',
    levels: [
      { damage: 10, count: 1, cooldown: 1.2, speed: 380 },
      { damage: 14, count: 1, cooldown: 1.1, speed: 400 },
      { damage: 17, count: 2, cooldown: 1.0, speed: 420 },
      { damage: 21, count: 2, cooldown: 0.9, speed: 450 },
      { damage: 26, count: 3, cooldown: 0.8, speed: 480 },
    ],
  },
};

export const PASSIVES = {
  vitality: { name: 'Heartwood', icon: '♥', desc: '+25 max health, and heal 25 now.', max: 5 },
  swift: { name: 'Windstep', icon: '»', desc: '+10% move speed.', max: 5 },
  magnet: { name: 'Glimmerpull', icon: '◎', desc: '+40% shard pickup range.', max: 5 },
  regen: { name: 'Dawnmend', icon: '✚', desc: 'Regenerate +0.8 health per second.', max: 5 },
  ward: { name: 'Aegis Ward', icon: '⬢', desc: 'Take 1 less damage from every hit.', max: 4 },
};

export const MAX_WEAPONS = 4;

/** The level-up offer: three distinct cards the player can still use. */
export function drawCards(state, rng) {
  const pool = [];
  for (const [id, def] of Object.entries(WEAPONS)) {
    const level = state.weapons[id] ?? 0;
    if (level === 0 && Object.keys(state.weapons).length < MAX_WEAPONS) {
      pool.push({ kind: 'weapon', id, level: 1, name: def.name, icon: def.icon, desc: def.desc, fresh: true });
    } else if (level > 0 && level < def.levels.length) {
      pool.push({ kind: 'weapon', id, level: level + 1, name: def.name, icon: def.icon, desc: `Level ${level + 1}: stronger ${def.name.toLowerCase()}.`, fresh: false });
    }
  }
  for (const [id, def] of Object.entries(PASSIVES)) {
    const level = state.passives[id] ?? 0;
    if (level < def.max) {
      pool.push({ kind: 'passive', id, level: level + 1, name: def.name, icon: def.icon, desc: def.desc, fresh: level === 0 });
    }
  }
  // Shuffle the pool (Fisher–Yates on the seeded RNG) and take three.
  for (let i = pool.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng.next() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  const cards = pool.slice(0, 3);
  if (cards.length > 0) return cards;
  // Everything is maxed: the Hollow still offers a second wind, so a long run
  // never strands the player on an empty choice.
  return [{ kind: 'heal', id: 'mend', level: 1, name: 'Second Wind', icon: '✚', desc: 'Restore 50 health and fight on.', fresh: false }];
}

/** Apply a chosen card to the run's state. */
export function applyCard(state, card) {
  if (!card) return;
  if (card.kind === 'heal') {
    state.player.hp = Math.min(state.player.maxHp, state.player.hp + 50);
    return;
  }
  if (card.kind === 'weapon') {
    state.weapons[card.id] = card.level;
    if (card.id === 'bolts') state.boltTimer = 0;
    if (card.id === 'nova') state.novaTimer = 0;
    if (card.id === 'wisps') state.wispTimer = 0;
  } else {
    state.passives[card.id] = card.level;
    if (card.id === 'vitality') {
      state.player.maxHp += 25;
      state.player.hp = Math.min(state.player.maxHp, state.player.hp + 25);
    }
  }
}
