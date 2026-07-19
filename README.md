# NHL HITZ — Arcade Hockey (2003 Prototype Remake)

A browser-based 2v2 arcade hockey game inspired by NHL Hitz 2003, built with
HTML5 + Three.js. No build step, no dependencies to install — the whole game
is static files.

## Play

The game uses ES modules, so it must be served over HTTP (double-clicking
`index.html` won't work). From this folder, run any static server:

```
npx serve -p 5200 .
```

then open http://localhost:5200

Or host it on **GitHub Pages** (Settings → Pages → deploy from branch) and it
runs directly from the repo.

## Controls

| Key | Action |
|---|---|
| W A S D | Skate |
| Shift | Turbo |
| Space (hold) | Charge shot — release to fire |
| F | Pass |
| Space + F | Fake-shot deke |
| Q | Call for the puck |
| Z | Body check |
| C | Spin-o-rama (deke near the net) |
| Esc | Pause |

All keys are rebindable in Settings.

## Features

- 31 NHL-era teams with rosters, ratings, and procedural jerseys/crests
- 3 difficulty levels (opponents only — your teammate always plays full-skill)
- Charged shots, one-timers, dekes, big hits, spin-o-rama
- ON FIRE streak mode with comeback momentum
- Goal celebrations, per-player stats, Player of the Game
- Hockey trivia between periods (1,600+ questions)

## Tech

- Three.js r160 via CDN import map — no bundler
- Everything procedural: player/goalie models, jersey textures, team crests,
  ice markings, arena, and all sound (Web Audio synthesis)
- 60fps with adaptive resolution scaling and zero per-frame allocations in
  the hot loop
