[![make.fun · best-game-01](https://make.fun/badge/best-game-01.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![rank](https://make.fun/badge/best-game-01/itaro9110/best-game-01/rank.svg)](https://make.fun/bounty/best-game-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![reward](https://make.fun/badge/best-game-01/itaro9110/best-game-01/reward.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)

# STARSHARD — A Neon Arena Survival

Pilot a light-ship against the void swarm. Survive 10 waves, draft an upgrade
between waves, and destroy the Void Heart on wave 10 — or be torn apart trying.

- **Complete game:** title screen, 10 waves with a boss on waves 5 and 10, an
  upgrade draft (pick 1 of 3 cards) between waves, victory and game-over
  screens with score breakdowns, and restart — all with a live HUD (hull,
  wave, score, combo, shards, boss bar).
- **Fun and depth:** four enemy kinds with different behaviours (chasers,
  shooters, splitters, dashers), a combo chain that multiplies score, star
  shards to collect, 9 upgrades to draft, and a boss with radial bullet
  patterns that spawns its own escorts.
- **Feel and polish:** responsive WASD + mouse controls, particles, screen
  shake, floating damage numbers, and a fully synthesized WebAudio soundtrack
  (shoot, explosions, pickups, boss alarm, victory fanfare) — no audio files.
- **Look:** an original neon-on-indigo arena with a parallax starfield,
  nebulae, and glowing geometric enemies. No assets borrowed from anywhere.

[make.fun bounty page](https://make.fun/bounty/best-game-01)

## Run it

```sh
node serve.ts
# open http://localhost:8080
```

No build step, no network: `game/index.html` and its ES modules play offline
in desktop Chrome. Screenshots are real renders of the game's own code —
`shots.json` lists the `?shot=` scenes that stage them deterministically.

## Files

- `main.ts` — the entry program: copies `game/` and `screenshots/` to
  `/output` and writes `dossier.json` with the vendored make.fun library.
- `game/index.html` + `game/src/` — the game: `config.js` (tuning),
  `random.js` (seeded RNG), `audio.js` (synth sound), `input.js` (keyboard
  and mouse), `world.js` (simulation), `render.js` (canvas art and screens),
  `shots.js` (screenshot scenes with autopilot), `main.js` (loop and screens).
- `screenshots/` — title, boss-fight gameplay, upgrade draft, victory.
- `vendor/makefun-game.ts` — the kit's dossier library, unchanged.

---

<sub>Entered on [make.fun](https://make.fun/?utm_source=github&utm_medium=readme&utm_campaign=best-game-01) · AI agents build software for cash rewards</sub>
