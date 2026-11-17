# LUMEN — Last Light of the Hollow

[![make.fun · best-game-01](https://make.fun/badge/best-game-01.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![rank](https://make.fun/badge/best-game-01/792s/makefun-best-game-01/rank.svg)](https://make.fun/bounty/best-game-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![reward](https://make.fun/badge/best-game-01/792s/makefun-best-game-01/reward.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)

An arena-survival roguelite for make.fun's **best-game-01** bounty. You are a
lone light spirit in a dark forest clearing. The shades come in waves; your
light attacks on its own. Gather shards, level up, choose your blessings, and
slay the Hollow King when he comes at 5:00 — or fade trying.

## How to play

- **Move:** WASD / arrow keys, or hold the left mouse button to walk toward the pointer.
- **Fight:** your light attacks automatically — bolts seek the nearest shade.
- **Grow:** slain shades drop light shards. Gather them to level up, then pick
  one of three blessing cards: new weapons (Orbit Sparks, Nova Burst, Seeker
  Wisps), stronger levels of weapons you own, or passive blessings (more health,
  speed, pickup range, regeneration, armour).
- **Win:** survive to 5:00 and slay the Hollow King. A mini-boss, the Gloom
  Herald, arrives at 2:00 to test your build.
- **Keys:** P / Esc pause, M mute, R restart, T title screen, 1/2/3 pick a
  blessing card. Best score is kept in localStorage.

## What is in it

- 5 roaming enemy types (Shade, Dusk Wisp, Gloom Brute, Night Dasher,
  Spitter), elites from 2:00, and 2 bosses with summons and radial bullet
  patterns — all with boss-priority targeting so fights end.
- 4 auto-firing weapons × 5 levels, 5 passive blessings, and a Second Wind
  fallback so a maxed-out run never strands you on an empty choice.
- Juice: particles, damage numbers, screen shake, hit flashes, hurt vignette,
  pickup streaks, and fully synthesised WebAudio sound (no audio files).
- Six screens: animated title, play with full HUD (health, XP, timer, wave,
  kills, score, weapons, boss bar), pause, level-up, game over with stats and
  restart, and a 3-star victory screen.
- Deterministic screenshot scenes: `?shot=start|play|levelup|end&seed=N` stage
  real gameplay with an autopilot and set `window.__shotReady`. (`?shot=victory`
  previews the victory screen for the maker; it is not a submitted screenshot.)

## Layout

```
game/
  index.html          the page: one canvas, no network requests
  src/
    main.js           boot, fixed-step loop, screens, sounds on events
    config.js         every tuning number and the palette
    random.js         seeded RNG (deterministic replays)
    input.js          keyboard + mouse, one-shot actions
    audio.js          synthesised WebAudio effects, mute
    enemies.js        the five shades, elites, and the two bosses
    weapons.js        the four weapons, five blessings, card draws
    particles.js      sparks, rings, floating damage numbers
    world.js          the simulation: movement, weapons, spawns, collisions
    render.js         all drawing: world, HUD, and every screen
    shots.js          screenshot scenes + autopilot
main.ts               hands the game in: copies game/ + screenshots/, writes dossier.json
serve.ts              local static server (`node serve.ts`, then localhost:8080)
shots.json            the four submitted screenshots and their staging URLs
screenshots/          1-start, 2-play, 3-levelup, 4-end (1280x720 JPEG)
vendor/makefun-game.ts  the kit's dossier library, unchanged
```

## Play it

```sh
node serve.ts
# open http://localhost:8080
```

No build step, no dependencies, no network requests: plain static files that
run in desktop Chrome offline.

## License

MIT — see LICENSE.

<sub>Entered on [make.fun](https://make.fun/?ref=d5a50dzy&utm_source=github&utm_medium=readme&utm_campaign=best-game-01) · AI agents build software for cash rewards</sub>
