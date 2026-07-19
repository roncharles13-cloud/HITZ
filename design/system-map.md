---
status: reverse-documented
source: HITZ/js/
date: 2026-06-26
engine: Three.js r160 / WebGL
---

# HITZ — System Map

> Reverse-engineered decomposition of the implemented systems, their owning
> modules, dependencies, and maturity. Use this as the systems index for design
> and architecture work.

## Layered dependency graph

```
                        ┌────────────────────────────────────────────┐
ORCHESTRATION           │  main.js                                    │
                        │  loop · state machine · scoring · faceoff · │
                        │  pause · trivia · settings/FOV wiring       │
                        └───┬───────┬───────┬───────┬───────┬─────────┘
                            │       │       │       │       │
SYSTEMS         ┌───────────▼─┐ ┌───▼────┐ ┌▼─────┐ ┌▼────┐ ┌▼───────┐
                │ camera.js   │ │ ai.js  │ │hud.js│ │input│ │arena.js│
                │ chase cam   │ │ skater │ │ DOM +│ │ .js │ │ rink   │
                │             │ │  brain │ │bitmap│ │binds│ │ visuals│
                └─────────────┘ └───┬────┘ └──┬───┘ └─────┘ └───┬────┘
                                    │ drives  │ uses            │ uses
ENTITIES            ┌───────────────▼──┐ ┌────▼──────┐ ┌────────▼─┐
                    │ player.js        │ │ goalie.js │ │ puck.js  │
                    │ model+mechanics+ │ │ model+AI+ │ │ physics+ │
                    │ animation        │ │ save anim │ │ trail    │
                    └───────┬──────────┘ └────┬──────┘ └────┬─────┘
                            │ uses            │ uses        │ uses
UTIL / CONST   ┌────────────▼───┐ ┌───────────▼──┐ ┌────────▼────────────┐
               │ meshutil.js    │ │ rink.js      │ │ bitmapfont.js       │
               │ static merge   │ │ RINK consts  │ │ + hitzfont_data.js  │
               └────────────────┘ └──────────────┘ └─────────────────────┘
DATA           teams.js · trivia.js · goalietex.js   (pure data, no deps)
```

`rink.js` (`RINK` constants) is the shared spatial contract consumed by
player, goalie, puck, camera, arena, and main. Nothing imports `main`.

## Systems index

| # | System | Module(s) | Responsibility | Depends on | Maturity |
|---|---|---|---|---|---|
| 1 | **Game loop & state** | main.js | RAF loop, MENU/GAME/TRIVIA states, adaptive resolution | all | Solid |
| 2 | **Match flow** | main.js | periods, clock, faceoffs, goal cooldown, tie end | RINK | Solid (no OT) |
| 3 | **Scoring** | main.js | goal detection (box on goal line), credit team, fire streak, SOG | RINK, player | Skeleton (no net physics) |
| 4 | **Skater mechanics** | player.js | move, turbo, spin, shoot, pass, check/big-hit, one-timer | RINK, meshutil | Solid |
| 5 | **Skater model + anim** | player.js | PBR model, jersey nameplate, leg stride, stick wind-up | meshutil | Solid |
| 6 | **Goalie** | goalie.js | net-relative positioning, save (range), butterfly anim | RINK, goalietex, meshutil | Skeleton (range-based) |
| 7 | **Puck** | puck.js | friction physics, board bounce, pickup, pooled fire trail | RINK | Skeleton (rect bounds, no net) |
| 8 | **Skater AI** | ai.js | defend/chase/attack FSM, shoot/pass, turbo/spin use | RINK, player(instances) | Skeleton |
| 9 | **Camera** | camera.js | broadcast chase cam, FOV (user) | THREE | Solid (single cam) |
| 10 | **Input** | input.js | configurable key+mouse bindings, persistence, capture | localStorage | Solid |
| 11 | **HUD / scoreboard** | hud.js | score, clock, period, SOG, fire+turbo meters, GOAL flash, hint | bitmapfont | Solid |
| 12 | **Arena / rink** | arena.js | ice (env-mapped), boards/glass/ads/shell/seating, lights, goals | RINK | Solid (no crowd) |
| 13 | **Teams & rosters** | teams.js | 31 NHL + 3 specials, rosters, ratings | — | Data (specials unwired, ratings unwired) |
| 14 | **Trivia** | trivia.js, main.js | 1,649 Q intermission, 12s timer | — | Solid (no consequence) |
| 15 | **Settings** | main.js, input.js | FOV slider, rebind UI, persistence | input | Solid |
| 16 | **Pause** | main.js | Esc overlay, resume/settings/quit | — | Solid |
| 17 | **Perf** | main.js, meshutil, arena, puck | adaptive res, mesh merge, 1 shadow light, pooling | — | Solid |

## Cross-cutting contracts

- **Coordinate convention** (RINK): world X = length (±100, nets ±89), Z = width
  (±42.5). `side = +1` attacks +X. Every entity + camera + scoring obeys this.
- **Visual vs. world scale**: mesh `scale` is cosmetic; all ranges/collision use
  world units. Changing model scale never affects balance.
- **Mesh merge invariant** (meshutil): static body parts merge by material; anything
  tagged `userData.noMerge` (sticks) or in a sub-group (legs) stays animatable.

## Highest-leverage gaps (see GDD §10)

Roster ratings unwired (4,13) · goalie coverage (6) · puck net/board physics (3,7) ·
AI depth (8) · OT/shootout (2) · audio (absent, no module) · on-fire depth (4).
