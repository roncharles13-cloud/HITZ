import * as THREE from 'three';
import { RINK } from './rink.js';
import { getDifficulty } from './difficulty.js';

// Player cooldowns are 0 (human can always act) — the AI rate-limits ITSELF
// so it doesn't one-touch pass/shoot at 60Hz the frame it receives the puck.
const AI_ACT_COOLDOWN = 0.35;

// AI controller — runs one skater per call
export class AI {
  constructor(player, side, npc = false) {
    this.player  = player;
    this.side    = side;   // +1 attacks +X (+89 net), -1 attacks -X (-89 net)
    this.npc     = npc;    // opponent NPC — skill scales with difficulty (teammate never does)
    this.thinkTimer = 0;
    this.actCd   = 0;      // AI action cadence — shoot/pass at most every 0.35s
    this.target  = null;   // current movement target (reused object, see _aim)
    this._aim    = { x: 0, z: 0 };   // preallocated — _think runs ~5×/s per skater
    this.state   = 'defend';
  }

  // Point the movement target without allocating a fresh {x,z} each think
  _aimAt(x, z) { this._aim.x = x; this._aim.z = z; this.target = this._aim; }

  update(puck, teammates, opponents, dt) {
    const p    = this.player;
    const pos  = p.mesh.position;
    const diff = this.npc ? getDifficulty() : null;   // null = full skill (teammate)
    const cadence = diff ? diff.actCd : AI_ACT_COOLDOWN;
    this.thinkTimer -= dt;
    if (this.actCd > 0) this.actCd -= dt;
    // Fresh possession starts the cadence too — no same-frame one-touch relays.
    // (a hold this short still fits the 1.2s one-timer window, so AI one-timers survive)
    if (p.hasPuck && !this._hadPuck) this.actCd = cadence;
    this._hadPuck = p.hasPuck;

    // Rethink every ~0.25s
    if (this.thinkTimer <= 0) {
      this._think(puck, teammates, opponents);
      this.thinkTimer = 0.2 + Math.random() * 0.1;
    }

    // Move toward target
    let dx = 0, dz = 0;
    if (this.target) {
      const tx = this.target.x - pos.x;
      const tz = this.target.z - pos.z;
      const len = Math.sqrt(tx * tx + tz * tz);
      if (len > 1.5) {
        dx = tx / len;
        dz = tz / len;
      }
    }

    // Boost when carrying the puck on the rush or chasing a loose puck/carrier
    const useTurbo = (p.hasPuck || this.state === 'chase') && (!diff || diff.oppTurbo);
    p.move(dx, dz, dt, useTurbo);

    // Spin-o-rama to slip an imminent check
    if (p.hasPuck && !p.spinning) {
      for (const opp of opponents) {
        if (!opp.knockedOut && opp.mesh.position.distanceTo(pos) < 6.5) {
          if (Math.random() < 0.03) p.spin();
          break;
        }
      }
    }

    // Actions (cadence-gated: the AI holds the puck a beat instead of hot-potato)
    if (p.hasPuck && this.actCd <= 0) {
      const goalX = this.side * RINK.GOAL_LINE;   // net we attack
      const distToGoal = Math.abs(pos.x - goalX);

      // Shoot when in good position
      if (distToGoal < (diff ? diff.shootZone : 55) && Math.abs(pos.z) < 25 && p.canShoot()) {
        p.shoot(puck);
        this.actCd = cadence;
      }
      // Pass to open teammate (banks off the boards if the lane is blocked)
      else if (p.canPass()) {
        const open = this._findOpenTeammate(teammates, opponents);
        if (open && Math.random() < (diff ? diff.passChance : 0.38)) {
          p.pass(puck, open, opponents);
          this.actCd = cadence;
        }
      }
    } else if (!p.hasPuck) {
      // (puck reception is unified in main.js resolvePuckReception — no pickup here)
      // Only body-check the PUCK CARRIER, and only occasionally — no stun-locking
      if (p.canCheck()) {
        const carrier = opponents.find(o => o.hasPuck && !o.knockedOut);
        if (carrier && Math.random() < (diff ? diff.checkChance : 0.008) &&
            p.mesh.position.distanceTo(carrier.mesh.position) < (diff ? diff.checkRange : 4.5)) {
          p.check([carrier], puck);
        }
      }
    }
  }

  _think(puck, teammates, opponents) {
    const p = this.player;
    const pos = p.mesh.position;
    const attackX = this.side * RINK.GOAL_LINE;

    if (p.hasPuck) {
      // Carry toward the net we attack
      this._aimAt(attackX, puck.pos.z * 0.3);
      this.state = 'attack';
      return;
    }

    const owner = puck.owner;
    // A protected pass in flight is possession, not a loose puck — nobody vacuums it
    const passing = !owner && puck.passProtect > 0 && puck.passTarget;
    if (passing && puck.passTarget === p) {
      // The pass is coming to ME → go meet it
      this.state = 'chase';
      this._aimAt(puck.pos.x, puck.pos.z);
      return;
    }
    const teammateHasPuck = (owner && teammates.includes(owner)) ||
                            (passing && teammates.includes(puck.passTarget));
    const oppHasPuck = (owner && opponents.includes(owner)) ||
                       (passing && opponents.includes(puck.passTarget));

    // Exactly ONE teammate (the closest active one) goes for the puck — no swarming
    let closest = null, cd = Infinity;
    for (const tm of teammates) {
      if (tm.knockedOut) continue;
      const dd = tm.mesh.position.distanceTo(puck.pos);
      if (dd < cd) { cd = dd; closest = tm; }
    }
    const iAmClosest = closest === p;

    if (teammateHasPuck) {
      // We have possession → get OPEN ahead of the carrier on the far side (passing option)
      this.state = 'support';
      const carrier = owner || puck.passTarget;
      const zSide = carrier.mesh.position.z >= 0 ? -1 : 1;
      this._aimAt(
        THREE.MathUtils.clamp(carrier.mesh.position.x + this.side * 18, -82, 82),
        zSide * 22
      );
    } else if (oppHasPuck) {
      // Enemy possession (carried OR pass in flight): closest pressures the man, rest drop back
      const man = owner || puck.passTarget;
      if (iAmClosest) {
        this.state = 'chase';
        this._aimAt(man.mesh.position.x, man.mesh.position.z);
      } else {
        this.state = 'defend';
        this._aimAt((puck.pos.x - attackX) / 2, puck.pos.z * 0.5);
      }
    } else if (iAmClosest) {
      // Genuinely loose puck → go win it
      this.state = 'chase';
      this._aimAt(puck.pos.x, puck.pos.z);
    } else {
      // Loose puck but not closest → stage on the open side, don't pile on
      this.state = 'support';
      const zSide = puck.pos.z >= 0 ? -1 : 1;
      this._aimAt(puck.pos.x + this.side * 12, zSide * 20);
    }
  }

  _findOpenTeammate(teammates, opponents) {
    let best = null, bestDist = Infinity;
    for (const tm of teammates) {
      if (tm === this.player || tm.knockedOut) continue;   // downed teammates can't receive —
      // resolvePuckReception() skips knockedOut players, so a pass here is just a lost puck
      // Check if any opponent is close to teammate
      let defended = false;
      for (const opp of opponents) {
        if (opp.mesh.position.distanceTo(tm.mesh.position) < 8) {
          defended = true; break;
        }
      }
      if (!defended) {
        const d = tm.mesh.position.distanceTo(this.player.mesh.position);
        if (d < bestDist) { bestDist = d; best = tm; }
      }
    }
    return best;
  }
}
