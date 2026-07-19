---
status: reverse-documented
source: HITZ/js/
date: 2026-06-26
verified-by: mxz (pending review)
engine: Three.js r160 / WebGL
---

# HITZ — Game Design Document (Gameplay)

> **Note:** Reverse-engineered from the implementation in `HITZ/js/`. It captures
> current behavior and the design intent established during development. Sections
> marked **⚠ GAP** are partial or unwired in code. Values are the literal constants
> in source as of this date.

---

## 1. Vision & Pillars

**Elevator pitch:** A browser-native, arcade remake of *NHL Hitz 2003* — fast 2-on-2
hockey with exaggerated hits, turbo rushes, on-fire streaks, and a glossy broadcast
presentation. Pick-up-and-play, no simulation depth, all spectacle.

**Design pillars**
1. **Arcade over sim** — no offsides/icing/penalties; big hits, big shots, big feedback.
2. **Momentum is king** — turbo, on-fire, and big-hit knockback all reward aggression.
3. **Readable spectacle** — broadcast chase cam, glossy arena, bold HUD, instant feedback.
4. **Authenticity skin** — real 2002-03 + 2019-20 NHL teams, rosters, ripped goalie gear,
   disc-ripped trivia and fonts — wrapped around arcade rules.

---

## 2. Core Loop

```
Face-off (1.6s) → carry/pass up-ice → beat defenders (turbo / spin) →
shoot or one-time → goalie save OR goal → (goal: 3s celebration) → Face-off …
   └─ period ends (2:00) → trivia intermission → next period → 3 periods → final
```

A match is **3 periods × 120s**. Human controls one skater; the other 3 skaters and
both goalies are AI. Ties currently end as "TIE" (**⚠ GAP:** no OT/shootout).

---

## 3. Skater Mechanics

All movement is **camera-relative**: the broadcast cam looks down +X, so `W/S` drive
±X (up/down ice), `A/D` drive ±Z (strafe).

### 3.1 Skating
| Property | Value | Notes |
|---|---|---|
| Base speed | `PLAYER_SPEED = 28` u/s | ×0.88 while carrying the puck |
| Acceleration | `PLAYER_ACCEL = 12` | velocity lerp toward target |
| Units | 1 u ≈ 1 ft | rink 200×85, net 6 wide |

### 3.2 Turbo (boost) — *signature mechanic*
A 0–1 drain/recharge meter. Hold to burst.
| Property | Value |
|---|---|
| Speed multiplier | `TURBO_MULT = 1.6` |
| Drain | `0.55`/s while boosting + moving |
| Recharge | `0.30`/s otherwise |
| Floor | `TURBO_MIN = 0.06` (forces a recharge beat) |

**Intent:** the foundational arcade verb — everything keys off it (blow-bys + big hits).
AI boosts when carrying or chasing. HUD shows the human's meter (orange when <25%).

### 3.3 Spin-o-rama
Tap to spin. `SPIN_DURATION = 0.5s`, `SPIN_COOLDOWN = 1.1s`, ×`1.15` speed.
**Dodges any check** while active. AI spins (~3%/frame) when a checker is within 6.5u.
**Intent:** the only deke — a panic-button evade to slip a defender or fake a hit.

### 3.4 Shooting
Single shot type, biased toward the attacking net if not aimed.
| Property | Value |
|---|---|
| Base shot speed | `SHOOT_SPEED = 55` |
| On-fire bonus | ×`1.3` |
| One-timer bonus | ×`1.4` (`ONE_TIMER_POWER`) |
| Cooldown | `SHOOT_COOLDOWN = 0.6s` |

### 3.5 One-timers
A pass marks the puck `fromPass`; the receiver gets a `0.5s` window
(`ONE_TIMER_WINDOW`) where shooting fires a ×1.4 power shot. Works for human and AI.
**Intent:** reward quick give-and-go in the slot.

### 3.6 Passing
`PASS_SPEED = 38`. Human pass always targets teammate `players[1]`
(**⚠ GAP:** no nearest/aim-based target selection).

### 3.7 Checking & Big Hits
Body check within `CHECK_RANGE = 5u`, `CHECK_COOLDOWN = 1.5s`.
| Outcome | Stun | Knockback | Trigger |
|---|---|---|---|
| Normal hit | `1.1s` | `16` u/s slide | check while not boosting |
| **BIG hit** | `1.9s` | `44` u/s launch | check **while turbo-active** |

Victims slide along the knockback vector (decay 0.90/frame) and drop the puck.
A **spinning** target is immune. **Intent:** turbo + check = the Hitz "launch into the glass."

### 3.8 On-Fire
Score **3 goals** (team streak) → on fire: `fireMeter = 1.0`, decays `0.08`/s.
Effects: flaming puck trail + shot ×1.3 + a point-light glow (`intensity = fireMeter×2`).
Reset when the team is scored on.
**⚠ GAP:** on-fire does **not** boost skating speed or hit power (Hitz did both).

### 3.9 Roster ratings (wired)
Each skater's roster stats scale gameplay around a baseline of 80 = 1.0×:
| Stat | Drives | Mapping |
|---|---|---|
| `spd` | skating speed | `±0.5%` per point (≈0.90–1.10×) |
| `sht` | shot power | `±0.5%` per point |
| `chk` | checking force dealt | `±0.6%` per point |
| `pwr` | resistance to checks | `±0.5%` per point |

A hit's stun + knockback scale by `attacker.chk / victim.pwr` (clamped 0.7–1.4×), so
a heavy hitter laying out a light forward lands a bigger hit than the reverse.
Skaters are drawn from the roster's **non-goalie** entries (the goalie sits at
`roster[0]`). Differences are intentionally subtle — stars feel better, not broken.

---

## 4. Goalie

AI-only. Sits at its own net, tracks the puck laterally.
| Property | Value |
|---|---|
| Lateral speed | `GOALIE_SPEED = 18` |
| Tracks | `puck.z × 0.6`, clamped ±`POST_RANGE (3.5)` |
| Challenge depth | steps out `1.5u` when puck within 20u |
| Save range | `SAVE_RANGE = 5u` → clears puck out into the rink |
| React | flinch-lean when puck speed >40, `REACT_DELAY = 0.12` |
| Save anim | butterfly: drop + pad-spread for `0.35s` |

**⚠ GAP:** saves are pure **distance** checks — not angle/coverage based, so the keeper
visually covers ~⅓ of the 6-wide net while save range doesn't correspond to the body.
No rebound control, no glove/blocker logic, no human goalie control.

---

## 5. Puck Physics

Flat 2D on the ice. `FRICTION = 0.97`/frame, `MAX_SPEED = 70`. Bounces off a
**rectangular** boundary (±`HALF-1`) at ×`-0.7`. Pickup radius `3.5u`. Size `R=0.45`.
**⚠ GAP:** ignores the rounded-corner boards and the net mesh (passes through the net;
no post/crossbar); no deflections off players/sticks; no puck height or spin.

---

## 6. AI

Per-skater controller, `~0.2s` rethink. States: **defend / chase / attack**.
- Carrying → skate to the attack net; shoot when `distToGoal < 50` and `|z| < 25`.
- Loose/opponent puck on our half → collect; opponent carrier → chase.
- Open-teammate pass chance ~30%.
- Uses turbo when carrying/chasing; spins to dodge imminent checks.

**⚠ GAP:** coarse — no real defensive coverage, backchecking, or give-and-go; one
difficulty level; spin/turbo use is heuristic, not strategic.

---

## 7. Match Structure & Flow

| Element | Value |
|---|---|
| Period length | `PERIOD_DURATION = 120s` |
| Periods | `NUM_PERIODS = 3` |
| Face-off | 1.6s freeze, centers on the dot, banner, then drop |
| Goal celebration | `goalCooldown = 3.0s` + "GOAL!" flash |
| Intermission | trivia screen between periods (1,649 disc-ripped Qs, 12s timer) |
| Tie | ends as "TIE" — **⚠ GAP:** no OT/shootout |
| Pause | Esc → Resume / Settings / Quit to Menu |
| Scoreboard | score · clock · period · shots-on-goal per team |

**Goal/score convention:** Team 0 (human) attacks +X (scores in the +89 net), defends
−89; Team 1 mirrors. Goalies guard their own net; `checkGoal` credits the attacking team.

---

## 8. Teams & Content

- **31 NHL teams** + **3 special teams** (Canada/Russia/USA) — **⚠ GAP:** specials exist
  in data but aren't selectable in the picker.
- Rosters: 2002-03 Hitz-era + 2019-20 stars; per-player `pos` and ratings.
- Ripped goalie gear textures per team; disc-ripped trivia + bitmap font.

---

## 9. Presentation

- **Broadcast chase cam** tracking the puck up/down the ice (single cam — no goal-cam,
  no hit shake; FOV user-adjustable 35–95).
- **Glossy arena** (env-mapped ice/glass, ACES tone mapping, boards/glass/ads/shell/
  seating — no crowd by choice).
- **Animations:** skating stride (legs swing with speed), stick wind-up on shot,
  goalie butterfly save.
- **HUD:** scoreboard, fire meters, turbo meter, GOAL flash, bitmap-font controls hint.

---

## 10. Prioritized Follow-Up (design debt)

1. ~~Wire roster ratings into speed/shot/check~~ ✅ done (§3.9).
2. **On-fire** should boost speed + hit power (match Hitz).
3. **OT / shootout** tie-break (shootout button already stubbed).
4. **Goalie** coverage-based saves + visual/body correspondence; optional human control.
5. **Puck**: net collision (posts/crossbar), rounded-board bounce, stick deflections.
6. **AI** depth + difficulty setting.
7. **Audio** (entire layer absent) — announcer, horn, crowd, hits.
8. Selectable special teams; nearest/aim-based passing.
