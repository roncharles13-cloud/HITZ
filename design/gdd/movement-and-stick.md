---
status: draft-spec (pre-implementation)
source: design intent — "make it feel like NHL Hitz"
date: 2026-06-26
engine: Three.js r160 / WebGL
owners: gameplay (player.js, puck.js, main.js)
---

# Stick & Motion Ruleset — "Hitz Feel"

> A cohesive ruleset for skating, the stick, the puck on the stick, shooting, and
> passing — replacing the current snap-to-input arcade with the momentum + cradle
> + wind-up feel of NHL Hitz.
>
> **Rollout: phased.**
> ✅ **Phase 1 (§A movement + §B cradle)** — implemented.
> ✅ **§D passing (lead) + §E stick state machine + directed one-timer** — implemented.
> ⏳ **§C tap/hold shots (wrist vs. slap)** — pending.
>
> **Directed one-timer (added):** with the puck, press **PASS** → you feed the
> teammate (lead pass). Press **SHOOT** → the teammate **catch-and-fires** at the
> net the instant the puck arrives (guaranteed one-timer bonus). Pass + catch +
> shot = one motion.

## Why (current vs. target)

| Today | Hitz target |
|---|---|
| Facing **snaps** instantly to input (pivot on a dime) | Facing **turns** at a capped rate → you carve |
| Release input → velocity lerps to 0 (hard stop) | Release → you **glide/coast** on the ice |
| Puck **glued** to a fixed point ahead of the player | Puck **cradles** on the blade, swings on turns |
| Shot fires **instantly** on keydown; wind-up anim is cosmetic | Puck leaves at the **swing contact**; tap vs. hold |
| Pass goes to a **fixed teammate**, at their current spot | Pass **leads** the best open teammate |

---

## A. Movement & fluidity

1. **Heading ≠ velocity.** Track facing (heading) separately from velocity. The body
   turns toward input at a **capped turn rate** (~10 rad/s at low speed, scaling
   *down* with speed so you carve wide when fast). No instant pivots.
2. **Ice glide.** When input is released, velocity coasts (×~0.94/frame) instead of
   braking to 0 — you drift to a stop.
3. **Carve.** Velocity direction eases toward the heading; momentum carries you, so
   hard direction changes drift. Turbo widens the arc.
4. **Two-stage acceleration.** Snappy to ~65% top speed, then slower to max; turbo
   (`×1.6`) raises the ceiling. Puck-carry penalty (`×0.88`) stays.
5. **Lean (visual).** Body rolls into turns and forward under acceleration.

## B. Stick & puck cradle

6. **Cradle spring.** A carried puck springs toward the blade target (lag ~12/s)
   rather than snapping — on a turn the puck swings out, then settles.
7. **Stickhandle sway.** Idle dangle: the stick (and puck) sway gently L↔R while
   carrying, faster when moving.
8. **Blade pickup.** The pickup point sits slightly ahead on the blade; loose pucks
   within reach get a small **poke** toward the stick (snappier pickups).

## C. Shooting (wind-up → release)

9. **Tap vs. hold.**
   - **Tap = wrist shot** — short wind-up (~0.12s), accurate, base speed (`55`).
   - **Hold = slap shot** — charges over ~0.5s to **×1.5 power**, releases on key-up,
     wider spread.
10. **Release on contact.** The puck leaves at the stick's forward-swing contact
    point — the animation and the shot are one motion, not decoupled.
11. **One-timer = snap.** Shooting inside the pass-received window skips the wind-up
    (instant), keeps `×1.4`. On-fire keeps `×1.3`.
12. **Accuracy spread.** Small cone for wrist, larger for slap; aimed from heading
    with a slight bias to the net (as today).

## D. Passing

13. **Lead the receiver.** Aim at `target.pos + target.vel × leadTime` so the pass
    arrives where the teammate is skating.
14. **Smart target.** Human pass auto-selects the best teammate (open + furthest
    up-ice), not always `players[1]`.
15. **Crisp speed.** Pass speed scales mildly with distance.
16. **Receive → one-timer.** The received-pass window (0.5s) is preserved.

## E. Stick motion state machine

`idle/carry (cradle-sway)` → `wind-up + swing (shot)` → `poke (check/pass)` →
`reach (loose puck)`. One driver in `player._animate`, fed by the systems above.

---

## Tuning constants (proposed)

```
TURN_RATE_LOW = 10 rad/s   TURN_RATE_HIGH = 4.5   ICE_GLIDE = 0.94
WRISTUP = 0.12s   SLAP_MAX = 0.5s   SLAP_POWER = 1.5   SPREAD_WRIST = 3°  SPREAD_SLAP = 8°
CRADLE_SPRING = 12/s   DANGLE_AMP = 0.25u   PASS_LEAD = 0.25s
```

## Implementation surface

- **player.js** — movement core (heading/turn/glide/carve), stick state machine,
  shot tap/hold + release timing, lean.
- **puck.js** — cradle spring while owned, charged-shot speed, shot spread.
- **main.js** — shoot key down/up for charge, lead-pass target selection.
- **input.js** — expose shoot key edge (down/up) for tap-vs-hold.

## Risks / notes

- This rewrites the **core feel** — highest revert risk. Recommend building behind
  the same controls (no new keys except shoot **hold**) and tuning live.
- Turn-rate + carve change how checking/defending plays — may need a balance pass.
- Lead passing + smart target slightly buff offense; watch scoring rate.
