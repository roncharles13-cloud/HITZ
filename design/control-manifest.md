---
status: reverse-documented
source: HITZ/js/input.js, main.js, player.js
date: 2026-06-26
engine: Three.js r160 / WebGL
---

# HITZ — Control Manifest

> The authoritative control scheme + input-layer rules, reverse-engineered from
> `input.js`, the `main.js` loop, and `player.js`. Covers the player-facing
> bindings AND the must-do / never-do rules for anyone touching input code.

## 1. Default bindings (Player 1 — the human skater)

| Action | Default | Type | Effect |
|---|---|---|---|
| Skate Up / Down | `W` / `S` | hold | ±X (up/down ice) — **camera-relative** |
| Skate Left / Right | `A` / `D` | hold | ±Z (strafe) — **camera-relative** |
| **Turbo** | `Left Shift` | hold | ×1.6 speed; drains the boost meter |
| **Shoot** | `Space` | tap | shot toward attack net (one-timer if armed) |
| **Pass** | `F` | tap | pass to teammate (arms their one-timer window) |
| **Check** | `Z` | tap | body check (BIG hit if boosting) |
| **Spin** | `C` | tap | spin-o-rama (dodges checks) |
| **Pause** | `Escape` | tap | toggle pause overlay (system key, not rebindable) |

All gameplay actions (not Pause) are **rebindable to any key or mouse button**
(`Mouse0` L-click, `Mouse1` M-click, `Mouse2` R-click). Right-click context menu is
suppressed so it can be bound.

## 2. Settings (persisted in `localStorage`)

| Setting | Range / form | Key |
|---|---|---|
| Field of View | slider 35–95 (default 50) | `hitz_fov` |
| Key/mouse bindings | per-action capture ("PRESS…") | `hitz_binds` |
| Reset to defaults | button | — |

Settings are reachable from the **main menu** and **mid-game via Pause**. Changes
apply **live** (read every frame) — no restart.

## 3. Per-action behavior specs

| Action | Gate / cooldown | Conditions & edge cases |
|---|---|---|
| Turbo | meter > `0.06`, must be moving | drains `0.55`/s, recharges `0.30`/s; AI auto-uses |
| Shoot | `hasPuck`, `0.6s` cd | biases to attack net if not aimed; ×1.4 if within one-timer window |
| Pass | `hasPuck`, `0.4s` cd | targets `players[1]`; sets puck `fromPass` |
| Check | `!hasPuck`, `1.5s` cd | range 5u; BIG (1.9s stun, 44 knock) if `turboActive`; whiffs vs. spinning target |
| Spin | not spinning, `1.1s` cd | 0.5s, ×1.15 speed, immune to checks |

## 4. Input architecture — RULES

### MUST
- **Read bindings live every frame.** `P1.shoot()` etc. resolve the current binding
  each call — never cache a key code. This is what makes rebinds/FOV apply instantly.
- **Map movement camera-relative.** The chase cam looks down +X, so `W/S → ±X`,
  `A/D → ±Z`. Any camera reorientation must keep this contract (see `system-map.md`).
- **Let `shoot()`/`pass()` clear `hasPuck` themselves.** They guard on
  `canShoot()`/`canPass()` (which require `hasPuck`). Clearing the puck *before*
  calling them silently cancels the action. *(This was a real bug — do not reintroduce.)*
- **Persist + reload** bindings and FOV from `localStorage` on boot; apply FOV to the
  camera at construction.
- **Clear held inputs on window blur** so keys don't stick when focus is lost.

### NEVER
- Never bind **Escape** to a gameplay action (reserved for Pause; capture skips it).
- Never let a held key re-trigger a tap action without a cooldown gate (spin/shoot/etc.
  are cooldown-gated so holding is safe — preserve that).
- Never read input or run player control while `paused` or `faceoffTimer > 0`
  (both branches freeze the sim before the input block).
- Never assume a binding is a keyboard code — it may be `Mouse0/1/2`; resolve via the
  `down()` helper (keyboard vs. mouse).

## 5. ⚠ Gaps / follow-up

- **No local 2-player** — `P2` was removed; only `P1` is wired. A second human would
  need its own binding set + a second controlled skater.
- **No mouse-aim** — mouse buttons bind to actions, but there's no aim-by-cursor for
  shot/pass direction (shot uses facing/attack-net bias).
- **No gamepad** support.
- Pause is hard-coded to `Escape` (not in the rebind list).
