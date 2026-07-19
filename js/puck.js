import * as THREE from 'three';
import { RINK } from './rink.js';

const PUCK_R = 0.45;   // scaled with the ~6ft players; sits on the stick blade
const PUCK_H = 0.22;
const FRICTION = 0.98;    // puck carries — long passes/dumps stay alive
const PASS_SPEED  = 74;   // every pass is a hard/power pass
const BOARD_MAX_EXIT = 90; // hot boards amplify (×1.2) but never into a runaway puck
const CRADLE_SPRING = 26;   // how stiffly a carried puck tracks the blade (swing/lag)
const PICKUP_LOCK = 0.35;   // the passer/shooter can't re-grab the puck this long
const PASS_PROTECT = 0.5;   // a pass can only be collected by its target for this long
const PICKUP_MAX_SPEED = 28; // a faster puck (shot/pass) blows past you — can't be grabbed

export class Puck {
  constructor(scene) {
    const geo = new THREE.CylinderGeometry(PUCK_R, PUCK_R, PUCK_H, 16);
    const mat = new THREE.MeshLambertMaterial({ color: 0x111111 });
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.castShadow = true;
    scene.add(this.mesh);

    this.pos    = new THREE.Vector3(0, PUCK_H / 2, 0);
    this.vel    = new THREE.Vector3(0, 0, 0);
    this.owner  = null;   // Player reference or null
    this.lastOwner  = null;   // who shot/passed it (locked out of re-pickup briefly)
    this.pickupLock = 0;      // >0 = lastOwner can't re-grab yet
    this.passTarget  = null;  // intended receiver of a protected pass
    this.passProtect = 0;     // >0 = only passTarget can collect it
    this.scene  = scene;

    this.boardHit = false;   // set the frame the puck cracks off the boards (audio)

    // Fire trail — pooled particles (no per-frame allocation)
    this.onFire = false;
    const trailGeo = new THREE.SphereGeometry(0.3, 6, 6);
    this.trail = [];
    for (let i = 0; i < 16; i++) {
      const m = new THREE.Mesh(
        trailGeo,
        // additive = overlapping particles glow hotter instead of muddying
        new THREE.MeshBasicMaterial({ color: 0xff6600, transparent: true, opacity: 0,
                                      blending: THREE.AdditiveBlending, depthWrite: false })
      );
      m.visible = false;
      scene.add(m);
      this.trail.push({ mesh: m, life: 0 });
    }
  }

  update(dt) {
    if (this.pickupLock > 0) this.pickupLock -= dt;
    if (this.passProtect > 0) { this.passProtect -= dt; if (this.passProtect <= 0) this.passTarget = null; }
    if (this.owner) {
      // Cradle: spring toward the blade so the puck swings on turns instead of snapping
      const sp = this.owner.getStickPos();
      const k = Math.min(1, CRADLE_SPRING * dt);
      this.pos.x += (sp.x - this.pos.x) * k;
      this.pos.z += (sp.z - this.pos.z) * k;
      this.pos.y = sp.y;
      this.vel.set(0, 0, 0);
    } else {
      // Physics
      this.pos.x += this.vel.x * dt;
      this.pos.z += this.vel.z * dt;
      // Frame-rate-independent friction: FRICTION is the per-1/60s decay, so a
      // pass/shot coasts the same distance at 60, 144 or any refresh rate.
      // (Applied per-frame previously, which choked the puck on high-Hz displays.)
      this.vel.multiplyScalar(Math.pow(FRICTION, dt * 60));

      // Board bounces (flag a hit when it's fast enough to be audible)
      const loud = this.getSpeed() > 14;
      let bounced = false;
      if (Math.abs(this.pos.z) > RINK.HALF_W - 1) {
        this.pos.z = Math.sign(this.pos.z) * (RINK.HALF_W - 1);
        this.vel.z *= -1.2;   // hot boards — caroms come off faster than they went in
        bounced = true;
        if (loud) this.boardHit = true;
      }
      if (Math.abs(this.pos.x) > RINK.HALF_L - 1) {
        this.pos.x = Math.sign(this.pos.x) * (RINK.HALF_L - 1);
        this.vel.x *= -1.2;
        bounced = true;
        if (loud) this.boardHit = true;
      }
      // Amplifying boards must never compound into an uncatchable rocket
      if (bounced) {
        const sp = this.getSpeed();
        if (sp > BOARD_MAX_EXIT) this.vel.multiplyScalar(BOARD_MAX_EXIT / sp);
      }
    }

    this.mesh.position.copy(this.pos);
    if (this.onFire) this._updateTrail(dt);
  }

  shoot(dir, onFire, speed) {
    this.lastOwner = this.owner; this.pickupLock = PICKUP_LOCK;
    this.owner = null;
    this.fromPass = false;
    this.vel.set(dir.x * speed, 0, dir.z * speed);
    this.onFire = onFire;
  }

  pass(dir, target = null, protectDur = PASS_PROTECT) {
    this.lastOwner = this.owner; this.pickupLock = PICKUP_LOCK;
    this.owner = null;
    this.fromPass = true;        // a pass is in flight (enables one-timers)
    this.passTarget  = target;   // only the receiver may collect it (no instant steal/re-grab)
    this.passProtect = target ? protectDur : 0;
    this.vel.set(dir.x * PASS_SPEED, 0, dir.z * PASS_SPEED);
    this.onFire = false;
  }

  canPickup(player) {
    if (this.owner) return false;
    // Protected pass: magnetic snap to the intended receiver (wide arcade cone, any speed)
    if (this.passProtect > 0 && this.passTarget) {
      if (player === this.passTarget) return this.pos.distanceTo(player.mesh.position) < 7.3;
      // Interception: a defender square in the lane (nearly touching the puck) picks it off
      return player.teamIdx !== this.passTarget.teamIdx &&
             this.pos.distanceTo(player.mesh.position) < 2.6;
    }
    // A hard shot/pass blows past — only a puck that's slowed down can be collected
    if (this.getSpeed() > PICKUP_MAX_SPEED) return false;
    if (this.pickupLock > 0 && player === this.lastOwner) return false;   // can't re-grab your own shot
    return this.pos.distanceTo(player.mesh.position) < 2.5;
  }

  pickup(player) {
    // Receiving a live pass arms the one-timer window — but not for an interceptor
    if (this.fromPass && player && player.markPassReceived &&
        (!this.passTarget || player === this.passTarget)) player.markPassReceived();
    this.fromPass = false;
    this.passProtect = 0; this.passTarget = null;
    this.owner  = player;
    this.onFire = false;
    this._clearTrail();
  }

  drop() { this.owner = null; }

  _updateTrail(dt) {
    // Age active particles
    for (const t of this.trail) {
      if (t.life > 0) {
        t.life -= dt;
        if (t.life <= 0) t.mesh.visible = false;
        else t.mesh.material.opacity = (t.life / 0.4) * 0.8;
      }
    }
    // Reuse a spent particle from the pool
    const free = this.trail.find(t => t.life <= 0);
    if (free) {
      free.life = 0.4;
      free.mesh.visible = true;
      free.mesh.material.color.setHSL(0.05, 1, 0.5 + Math.random() * 0.3);
      free.mesh.material.opacity = 0.8;
      free.mesh.position.set(
        this.pos.x + (Math.random() - 0.5) * 0.5,
        this.pos.y,
        this.pos.z + (Math.random() - 0.5) * 0.5
      );
    }
  }

  _clearTrail() {
    for (const t of this.trail) { t.life = 0; t.mesh.visible = false; }
    this.onFire = false;
  }

  // buildGame rebuilds the puck every "START GAME" click — free the trail pool's
  // GPU buffers too (scene.remove() alone doesn't), or replaying leaks VRAM.
  disposeFx() {
    for (const t of this.trail) {
      this.scene.remove(t.mesh);
      t.mesh.material?.dispose();
    }
    this.trail[0]?.mesh.geometry?.dispose();   // one shared geometry across the whole pool
  }

  getSpeed() { return this.vel.length(); }
}
