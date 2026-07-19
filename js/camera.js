import * as THREE from 'three';
import { PoseFollowCameraRig } from './gameblocks/camera/PoseFollowCameraRig.js';
import { createWorldBasis } from './gameblocks/math/WorldBasis.js';

// Hitz broadcast chase cam: sits behind the play and tracks the puck up and
// down the ice instead of being pinned at one end. The human team attacks +X,
// so "forward / up-screen" is +X and "right-screen" is +Z.
// Rink: X = length (-100..+100), Z = width (-42.5..+42.5).
//
// Backed by the GameBlocks PoseFollowCameraRig for framerate-independent
// exponential smoothing and speed-reactive dolly. The broadcast frame is
// deliberately FIXED (forward +X) so the picture never spins with play — the
// rig follows a fixed-orientation frame and we express tracking as offsets.

// Broadcast basis: right-screen = +Z, up = +Y, forward/up-screen = +X.
const BROADCAST_BASIS = createWorldBasis({ right: '+z', up: '+y', forward: '+x' });
const BROADCAST_FRAME = Object.freeze({
  forward: { x: 1, y: 0, z: 0 },
  up:      { x: 0, y: 1, z: 0 },
  right:   { x: 0, y: 0, z: 1 },
});

const BEHIND     = 56;   // how far behind the puck (along -X) the camera sits
const HEIGHT     = 36;   // camera height above the ice
const LOOK_AHEAD = 22;   // aim this far ahead of the puck (toward +X)
const SIDE_TRACK = 0.32; // how much the camera slides sideways with the puck
const LOOK_SIDE  = 0.45; // how much the aim point slides sideways
const LAG        = 3.5;  // legacy linear factor -> converted to a time constant

// Independent clamps for the camera vs. the aim point. Decoupling these is what
// lets the camera stay off the end boards while the AIM still tracks the puck
// deep into a zone (fixes losing the puck/goal down by a net).
const CAM_X_MIN  = -74;  // never punch through the defensive end boards (rink half-length 78)
const CAM_X_MAX  =  20;  // never cross too far past center when attacking
const LOOK_X_MIN = -58;  // keep the aim near the puck deep in the defensive zone
const LOOK_X_MAX =  75;  // aim into the attacking net

// When play jams the camera against the defensive boards (right behind the net),
// lift + steepen it and pull the aim toward the goal so the net/goalie/puck stay
// framed instead of sliding off the bottom edge.
const ZONE_SPAN     = 40; // how much board-pin builds up the framing correction
const ZONE_LIFT     = 12; // extra camera height at full pin
const ZONE_AIM_DROP = 22; // pull the aim this far back toward the goal at full pin

// Convert the old `k = min(1, LAG*dt)` feel into an exponential lag (seconds).
// At 60fps the old alpha was ~3.5/60; matching exp response gives ~0.27s.
const POS_LAG    = 0.27;

// Speed-reactive dolly: as the puck flies, ease the camera back and lift it for
// a sense of speed (classic Hitz juice on breakaways / slapshots).
const SPEED_REF  = 60;   // puck speed (world units/s) at which the dolly maxes
const SPEED_BACK = 14;   // extra distance behind at full speed
const SPEED_LIFT = 6;    // extra height at full speed
const SPEED_LAG  = 0.5;  // smoothing on the speed factor itself

export class HitzCamera {
  constructor(camera) {
    this.cam = camera;
    this.speedFactor = 0;

    this.rig = new PoseFollowCameraRig({
      basis: BROADCAST_BASIS,
      cameraOffset:      { forward: -BEHIND, up: HEIGHT, right: 0 },
      lookAtOffset:      { forward: LOOK_AHEAD, up: 2, right: 0 },
      // Speed offsets scale with `targetSpeed` (0..1 here) inside the rig.
      speedCameraOffset: { forward: -SPEED_BACK, up: SPEED_LIFT, right: 0 },
      speedLookAtOffset: { forward: 0, up: 0, right: 0 },
      positionLag: POS_LAG,
      lookLag: POS_LAG,
    });

    // Snap to the opening pose so the first frame doesn't slew in from origin.
    this.rig.step({
      targetPosition: { x: 0, y: 0, z: 0 },
      targetFrame: BROADCAST_FRAME,
      targetSpeed: 0,
      snapToTarget: true,
      camera,
    });
  }

  update(puck, players, dt) {
    const clamp = THREE.MathUtils.clamp;
    const px = puck.pos.x, pz = puck.pos.z;

    // Smooth the speed factor (0..1) from the puck's planar velocity.
    const v = puck.vel || { x: 0, z: 0 };
    const speed = Math.hypot(v.x || 0, v.z || 0);
    const targetFactor = clamp(speed / SPEED_REF, 0, 1);
    this.speedFactor = THREE.MathUtils.damp
      ? THREE.MathUtils.damp(this.speedFactor, targetFactor, 1 / SPEED_LAG, dt)
      : targetFactor;
    const f = this.speedFactor;

    // Camera and aim are clamped INDEPENDENTLY: the camera stays behind the puck
    // (pulled back a touch at speed) and off the boards, while the aim tracks the
    // puck up and down the ice — including deep into a zone by either net.
    const camX  = clamp(px - BEHIND - SPEED_BACK * f, CAM_X_MIN, CAM_X_MAX);
    const camZ  = clamp(pz * SIDE_TRACK, -16, 16);
    const lookX = clamp(px + LOOK_AHEAD, LOOK_X_MIN, LOOK_X_MAX);
    const lookZ = clamp(pz * LOOK_SIDE, -22, 22);

    // How hard the camera is pinned against the defensive boards (0 mid-ice → 1
    // right behind the net). Lift + drop the aim toward the goal accordingly.
    const pinned = clamp((CAM_X_MIN - (px - BEHIND)) / ZONE_SPAN, 0, 1);
    const camY   = HEIGHT + SPEED_LIFT * f + pinned * ZONE_LIFT;
    const aimX   = lookX - pinned * ZONE_AIM_DROP;

    // Feed the rig a puck-centered focus and encode the clamped targets as
    // offsets, so the exponential smoothing still applies to the final pose.
    const rig = this.rig;
    rig.cameraOffset.forward = camX - px;
    rig.cameraOffset.right   = camZ - pz;
    rig.cameraOffset.up      = camY;
    rig.lookAtOffset.forward = aimX - px;
    rig.lookAtOffset.right   = lookZ - pz;
    rig.lookAtOffset.up      = 2;

    return rig.step({
      targetPosition: { x: px, y: 0, z: pz },
      targetFrame: BROADCAST_FRAME,
      targetSpeed: 0,            // dolly folded into the offsets above
      deltaSeconds: dt,
      camera: this.cam,
    });
  }
}
