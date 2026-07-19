import * as THREE from 'three';
import { RINK } from './rink.js';
import { GOALIE_TEX } from './goalietex.js';
import { mergeStaticBody } from './meshutil.js';

const GOALIE_SPEED  = 18;
const SAVE_RANGE    = 5;
const POST_RANGE    = 3.5;
const REACT_DELAY   = 0.07;
const SAVE_ANIM     = 0.35;   // butterfly save duration
const GOALIE_SCALE  = 1.05;   // base mesh scale (matches the skaters)
const loader        = new THREE.TextureLoader();

function loadTex(path) {
  const t = loader.load(path);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// Left-half of the 128x64 mask sheet = front face of mask
function maskTex(path) {
  const t = loadTex(path);
  t.repeat.set(0.5, 1);
  t.wrapS = THREE.ClampToEdgeWrapping;
  t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
}

export class Goalie {
  constructor(scene, teamData, side) {
    this.scene  = scene;
    this.team   = teamData;
    this.side   = side;
    this.vel    = new THREE.Vector3();
    this.reacting  = false;
    this.reactTimer = 0;
    this.saveAnim   = 0;       // >0 = playing the butterfly save
    this.saved      = false;   // set true the frame a save is made (for audio)
    this.beatCd     = 0;       // >0 = beaten on this shot, can't re-attempt the save
    // Difficulty overrides (buildGame weakens the OPPONENT goalie on easy/medium)
    this.saveScale  = 1;
    this.reactDelay = REACT_DELAY;
    this.speed      = GOALIE_SPEED;
    this._build();
  }

  _build() {
    const abbr = this.team.abbr;
    const tex  = GOALIE_TEX[abbr] || null;

    const c1 = new THREE.Color(this.team.colors.primary);
    const c3 = new THREE.Color(this.team.colors.accent || this.team.colors.secondary);
    const skin = new THREE.Color(0xc99a72);

    // PBR materials to match the realistic skaters
    const std = (col, rough = 0.72, metal = 0.0, extra = {}) =>
      new THREE.MeshStandardMaterial({ color: col, roughness: rough, metalness: metal, ...extra });

    const sweaterMat = std(c1, 0.74);
    const trimMat    = std(c3, 0.7);
    const skinMat    = std(skin, 0.6);
    const skateMat   = std(0x0d0d10, 0.3, 0.1);
    const bladeMat   = std(0xcfd6dd, 0.25, 0.95);
    const leatherMat = std(0xb8763a, 0.7);          // catch-glove leather
    const stickMat   = std(0xece3d0, 0.55);         // white goalie paddle
    const cageMat    = std(0x15181c, 0.45, 0.4);    // mask cage bars
    // Authentic ripped pad / mask textures on PBR surfaces; fall back to team color
    const padMat  = tex
      ? new THREE.MeshStandardMaterial({ map: loadTex(tex.pad), roughness: 0.55 })
      : std(new THREE.Color(c1).lerp(new THREE.Color(0xffffff), 0.18), 0.5);
    const maskMat = tex
      ? new THREE.MeshStandardMaterial({ map: maskTex(tex.mask), roughness: 0.4 })
      : std(c1, 0.4, 0.05);

    const group = new THREE.Group();   // built facing +Z (front = toward shooter)

    // ── SKATES (goalie cowling) ──
    [-0.5, 0.5].forEach(xOff => {
      const boot = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.4, 1.0), skateMat);
      boot.position.set(xOff, 0.3, 0.32);
      group.add(boot);
      const blade = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.14, 1.12), bladeMat);
      blade.position.set(xOff, 0.04, 0.32);
      group.add(blade);
    });

    // ── LEG PADS — the signature oversized rectangular pads, slight splay ──
    [-0.5, 0.5].forEach(xOff => {
      const pad = new THREE.Mesh(new THREE.BoxGeometry(0.95, 2.7, 0.55), padMat);
      pad.position.set(xOff, 1.5, 0.55);
      pad.rotation.z = xOff > 0 ? -0.06 : 0.06;
      group.add(pad);
      const knee = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.55, 0.62), padMat);
      knee.position.set(xOff, 2.55, 0.55);
      group.add(knee);
    });

    // ── CHEST / SWEATER over chest protector ──
    const chest = new THREE.Mesh(new THREE.BoxGeometry(2.0, 1.9, 1.15), sweaterMat);
    chest.position.set(0, 3.55, 0.05);
    group.add(chest);
    const chestPad = new THREE.Mesh(new THREE.BoxGeometry(1.85, 1.7, 0.4), sweaterMat);
    chestPad.position.set(0, 3.55, 0.62);
    group.add(chestPad);

    // ── SHOULDER PADS — blocky & squared to match the arcade skaters ──
    const yoke = new THREE.Mesh(new THREE.BoxGeometry(2.45, 0.72, 1.3), sweaterMat);
    yoke.position.set(0, 4.32, 0.05);
    group.add(yoke);
    [-1.05, 1.05].forEach(xOff => {                  // capped ends overhang the arms
      const cap = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.8, 1.35), sweaterMat);
      cap.position.set(xOff, 4.27, 0.05);
      cap.rotation.z = xOff > 0 ? -0.13 : 0.13;
      group.add(cap);
    });

    // ── CATCH GLOVE (trapper) — +X side, open toward shooter ──
    const gloveArm = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.22, 1.0, 10), sweaterMat);
    gloveArm.position.set(1.05, 3.7, 0.2);
    gloveArm.rotation.z = -0.25;
    group.add(gloveArm);
    const trapper = new THREE.Mesh(new THREE.BoxGeometry(0.45, 1.1, 1.0), leatherMat);
    trapper.position.set(1.4, 3.05, 0.65);
    group.add(trapper);
    const trapperCup = new THREE.Mesh(
      new THREE.SphereGeometry(0.55, 12, 10, 0, Math.PI * 2, 0, Math.PI * 0.6),
      leatherMat
    );
    trapperCup.position.set(1.4, 3.35, 0.75);
    trapperCup.rotation.x = -0.7;
    group.add(trapperCup);

    // ── BLOCKER — -X side, flat rectangular pad + blocker glove ──
    const blockArm = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.22, 1.0, 10), sweaterMat);
    blockArm.position.set(-1.05, 3.7, 0.2);
    blockArm.rotation.z = 0.25;
    group.add(blockArm);
    const blocker = new THREE.Mesh(new THREE.BoxGeometry(0.85, 1.1, 0.35), trimMat);
    blocker.position.set(-1.42, 3.05, 0.65);
    group.add(blocker);
    const blockHand = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.6), leatherMat);
    blockHand.position.set(-1.3, 2.65, 0.6);
    group.add(blockHand);

    // ── NECK + HEAD ──
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 0.3, 10), skinMat);
    neck.position.y = 4.6;
    group.add(neck);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.44, 16, 14), skinMat);
    head.position.set(0, 5.0, 0.0);
    group.add(head);

    // ── GOALIE MASK — solid dark team shell + the ripped mask art mapped FLAT
    //    on the front face (crisp, faces the shooter) + a dark bar cage. Clean
    //    and arcade instead of the old photo-wrapped sphere.
    const maskShellMat = std(new THREE.Color(c1).lerp(new THREE.Color(0x0a0a0c), 0.42), 0.3, 0.1);
    const shell = new THREE.Mesh(new THREE.SphereGeometry(0.54, 16, 14), maskShellMat);
    shell.position.set(0, 5.0, -0.02);
    shell.scale.set(1.0, 1.08, 1.02);
    group.add(shell);
    const face = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.94), maskMat);
    face.position.set(0, 5.0, 0.53);                 // proud of the shell front
    group.add(face);
    // Dark bar cage over the face (unmistakably a goalie mask)
    [-0.16, 0.16].forEach(xOff => {                  // vertical bars
      const bar = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.62, 0.05), cageMat);
      bar.position.set(xOff, 5.0, 0.56);
      group.add(bar);
    });
    [4.78, 5.24].forEach(yy => {                     // top + bottom horizontal bars (leave the eyes clear)
      const bar = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.05, 0.05), cageMat);
      bar.position.set(0, yy, 0.56);
      group.add(bar);
    });
    const chinCup = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.17, 0.22), cageMat);
    chinCup.position.set(0, 4.74, 0.46);
    group.add(chinCup);

    // ── PADDLE-DOWN STICK — wide blade on the ice + shaft to blocker hand ──
    const stickBlade = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.5, 1.8), stickMat);
    stickBlade.position.set(-0.45, 0.3, 1.5);
    stickBlade.userData.noMerge = true;
    group.add(stickBlade);
    const stickShaft = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 1.5), stickMat);
    stickShaft.position.set(-0.85, 1.25, 1.0);
    stickShaft.rotation.x = 0.95;
    stickShaft.userData.noMerge = true;
    group.add(stickShaft);

    // Collapse static body parts by material (stick stays separate)
    mergeStaticBody(group);

    // Match the skater scale (~6ft) so goalie reads correctly in the 6u-wide net
    group.scale.set(1.05, 1.05, 1.05);
    this.mesh = group;
    this.scene.add(group);

    const goalX = this.side * RINK.GOAL_LINE;
    this.mesh.position.set(goalX - this.side * 2, 0, 0);
    this.homeX = goalX - this.side * 2;
    // Square up to the shooter: front (+Z) faces center ice
    this.mesh.rotation.y = -this.side * Math.PI / 2;
  }

  update(puck, dt) {
    this.reactTimer = Math.max(0, this.reactTimer - dt);
    if (puck.getSpeed() > 30 && this.reactTimer <= 0) {
      this.reacting   = true;
      this.reactTimer = this.reactDelay;
    }

    const targetZ = THREE.MathUtils.clamp(puck.pos.z * 0.6, -POST_RANGE, POST_RANGE);
    this.mesh.position.z += (targetZ - this.mesh.position.z) * this.speed * dt;

    const distFromGoal = Math.abs(puck.pos.x - this.side * RINK.GOAL_LINE);
    const depth = distFromGoal < 20 ? -this.side * 1.5 : 0;
    this.mesh.position.x += (this.homeX + depth - this.mesh.position.x) * 5 * dt;

    if (this.reacting && puck.getSpeed() > 40) {
      this.mesh.rotation.z = THREE.MathUtils.lerp(this.mesh.rotation.z, 0.4, dt * 6);
    } else {
      this.mesh.rotation.z = THREE.MathUtils.lerp(this.mesh.rotation.z, 0, dt * 4);
    }

    // Butterfly save: drop + spread the pads briefly after a save, then recover
    if (this.saveAnim > 0) this.saveAnim -= dt;
    if (this.beatCd  > 0) this.beatCd  -= dt;
    const k = Math.max(0, this.saveAnim) / SAVE_ANIM, b = GOALIE_SCALE;
    this.mesh.scale.set(b * (1 + 0.22 * k), b * (1 - 0.20 * k), b * (1 + 0.06 * k));
  }

  trySave(puck) {
    const dist = puck.pos.distanceTo(this.mesh.position);
    if (dist >= SAVE_RANGE) return false;
    if (this.beatCd > 0) return false;   // committed the wrong way — already beaten
    // Beatable goalie: rockets, corner placement and on-fire shots get through;
    // weak dribblers get eaten. One roll per shot, not per frame.
    const speed = puck.getSpeed();
    let save = THREE.MathUtils.clamp(1.15 - speed / 110, 0.15, 0.95);
    if (Math.abs(puck.pos.z - this.mesh.position.z) > 2) save -= 0.2;   // picked a corner
    if (puck.onFire) save -= 0.25;                                       // fire melts the pads
    save *= this.saveScale;                                              // difficulty (opponent goalie only)
    if (Math.random() > save) { this.beatCd = 0.5; return false; }
    puck.owner = null;
    puck.vel.set(
      -this.side * (30 + Math.random() * 15),
      0,
      (Math.random() - 0.5) * 18
    );
    this.saveAnim = SAVE_ANIM;     // kick off the butterfly
    this.saved = true;             // audio event
    // Rebounding puck stays inside SAVE_RANGE for several frames while it clears —
    // without a cooldown here trySave re-rolls on it, restacking the save anim/sfx
    // every frame until a roll finally misses (harmless to the score, but noisy).
    this.beatCd = SAVE_ANIM;
    return true;
  }
}
