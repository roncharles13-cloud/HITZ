import * as THREE from 'three';
import { RINK } from './rink.js';
import { mergeStaticBody } from './meshutil.js';

const PLAYER_SPEED   = 24;   // top skating speed (trimmed for a calmer pace)
const PLAYER_ACCEL   = 9;    // gentler ramp-up to speed (less twitchy)
// ── Fluidity (momentum skating) ──
const TURN_LOW   = 10.0;   // heading turn rate (rad/s) at low speed — tight
const TURN_HIGH  = 5.0;    // ...at top speed — carve wide
const ICE_GLIDE  = 0.95;   // coast friction/frame when no input (glide to a stop)
const CHECK_RANGE    = 7;
const CHECK_COOLDOWN = 2;
const SHOOT_COOLDOWN = 0;      // no cooldown — have the puck, can always shoot
const PASS_COOLDOWN  = 0;      // no cooldown
// ── Charged shot (BREAKAWAY-style: hold to load power, release to fire) ──
const CHARGE_RATE = 1.3;   // power/sec while holding shoot (full charge in ~0.77s)
const SHOT_MIN    = 45;    // tap shot — a quick wrister that still threatens
const SHOT_CHARGE = 35;    // extra speed at full charge (45 + 35 = 80 cap before mults)
const CHARGE_DRAG = 0.26;  // skating slows up to this fraction while winding a big one

// ── Turbo — unlimited while held (see move()) ──
const TURBO_MULT = 1.6;    // top speed multiplier while boosting
// ── Spin-o-rama ──
const SPIN_DURATION  = 0.3;    // seconds
const SPIN_COOLDOWN  = 0.8;
const SPIN_SPEED     = 1.3;    // speed bump through the spin
// ── Deke (fake shot) ──
const DEKE_COOLDOWN  = 1.2;
const DEKE_BURST     = 16;     // lateral burst speed out of the fake
// ── One-timer ──
const ONE_TIMER_WINDOW = 1.2;  // shoot within this of receiving a pass
const ONE_TIMER_POWER  = 2.1;  // shot-speed multiplier
// ── Passing / stick ──
const PASS_SPEED_REF = 74;     // pass speed (matches puck.js) — used for the lead travel time
const PASS_LEAD_MAX  = 0.9;    // cap the lead so long passes don't over-lead a turning skater
const POKE_DUR  = 0.22;        // stick poke/jab (pass + check) duration
// ── Hits ──
const HIT_STUN       = 0.3;   // quick recovery — knocked but pops right back up
const BIG_HIT_STUN   = 0.8;
const HIT_KNOCK      = 13;     // slide speed imparted to a checked player
const BIG_HIT_KNOCK  = 37;     // turbo check launches them
// ── Pass lane / bank ──
const LANE_BLOCK_R = 2.5;      // a defender this close to the lane blocks a direct pass

// Distance from point p to segment a→b on the XZ plane
function segDist(p, a, b) {
  const abx = b.x - a.x, abz = b.z - a.z;
  const len2 = abx * abx + abz * abz || 1;
  const t = THREE.MathUtils.clamp(((p.x - a.x) * abx + (p.z - a.z) * abz) / len2, 0, 1);
  return Math.hypot(p.x - (a.x + abx * t), p.z - (a.z + abz * t));
}

// First defender sitting in the passing lane, or null if it's clean.
// Defenders camped on the passer/receiver don't count — a bank can't beat those.
export function passLaneBlocker(from, to, opponents, radius = LANE_BLOCK_R) {
  for (const o of opponents) {
    if (o.knockedOut) continue;
    if (o.mesh.position.distanceTo(to) < 3.0) continue;
    if (o.mesh.position.distanceTo(from) < 2.5) continue;
    if (segDist(o.mesh.position, from, to) < radius) return o;
  }
  return null;
}

// Where a pass to `target` will arrive (perfect-line lead), written into `out`
export function passLeadPoint(passer, target, out) {
  const dist = target.mesh.position.distanceTo(passer.mesh.position);
  const t = Math.min(dist / PASS_SPEED_REF, PASS_LEAD_MAX);
  return out.copy(target.mesh.position).addScaledVector(target.vel, t);
}

// Bank point off a side board when the direct lane is blocked. Mirrors the
// receiver across each board, checks both legs of the carom for defenders,
// and returns the cleanest wall point — or null if neither bank beats direct.
function bankPoint(from, lead, opponents) {
  const wallZ = RINK.HALF_W - 1.2;   // just inside where the puck clamps/bounces
  let best = null, bestClear = LANE_BLOCK_R;
  for (const s of [1, -1]) {
    const wz = s * wallZ;
    const dz = (2 * wz - lead.z) - from.z;   // toward the mirrored receiver
    if (Math.abs(dz) < 1e-4) continue;
    const t = (wz - from.z) / dz;
    if (t <= 0.05 || t >= 0.95) continue;    // carom must land between the two skaters
    const b = new THREE.Vector3(from.x + (lead.x - from.x) * t, 0, wz);
    let clear = Infinity;
    for (const o of opponents) {
      if (o.knockedOut) continue;
      clear = Math.min(clear, segDist(o.mesh.position, from, b), segDist(o.mesh.position, b, lead));
    }
    if (clear > bestClear) { bestClear = clear; best = b; }
  }
  return best;
}

export class Player {
  constructor(scene, teamData, side, isGoalie = false, playerData = null) {
    this.scene    = scene;
    this.team     = teamData;
    this.side     = side;      // 1 = left (p1), -1 = right (p2)
    this.isGoalie = isGoalie;
    this.data     = playerData;

    this.vel        = new THREE.Vector3();
    this.facing     = new THREE.Vector3(side < 0 ? -1 : 1, 0, 0);
    this.hasPuck    = false;
    this.onFire     = false;
    this.fireGoals  = 0;    // goals scored in streak
    this.fireMeter  = 0;    // 0-1
    this.knockedOut = false;
    this.knockTimer = 0;
    this.checkCd   = 0;
    this.shootCd   = 0;
    this.passCd    = 0;

    this.turbo       = 1;       // always full — HUD bar; turbo has no meter to deplete
    this.turboActive = false;   // boosting this frame
    this.spinTimer   = 0;       // >0 = mid spin-o-rama
    this.spinCd      = 0;
    this.recvPassTimer = 0;     // >0 = a pass just landed (one-timer window)

    this.teamIdx     = 0;       // set by buildGame (for shots-on-goal)
    this.stats       = { g: 0, a: 0, h: 0, sog: 0 };   // match stats (summary screen)
    this.lastFeeder  = null;    // teammate whose pass this player last caught (assists)
    this.dekeCd      = 0;       // fake-shot deke cooldown
    this.justShot    = false;   // set true the frame a shot is taken
    this.shotOneTimer = false;  // was that shot a one-timer (for audio)
    this.hitEvent    = null;    // 'HIT' | 'BIG' the frame a check lands (for audio)
    this.stridePhase = 0;       // skating-stride animation phase
    this.danglePhase = 0;       // stickhandle dangle phase (puck cradle sway)
    this.shotAnim    = 0;       // >0 = stick wind-up playing
    this.pokeAnim    = 0;       // >0 = stick poke/jab playing (pass / check)
    this.shotCharge  = 0;       // 0..1 held shot power (hold to load, release to fire)
    this.legs        = [];      // [legL, legR] groups (kept un-merged to animate)

    // Roster rating → gameplay multipliers (baseline 80 = 1.0×)
    const d = playerData || {};
    const sm = (v, k) => 1 + (((v ?? 80) - 80) * k);
    this.spdMult = sm(d.spd, 0.005);   // skating speed
    this.shtMult = sm(d.sht, 0.005);   // shot power
    this.diffMult = 1;                 // difficulty speed scale (set on opponents by buildGame)
    this.chkMult = sm(d.chk, 0.006);   // checking force dealt
    this.pwrMult = sm(d.pwr, 0.005);   // resistance to being checked
    this.collMass = this.pwrMult;      // collision mass (human gets a high value to plow through)

    this._build();

    // On-fire body flames — pooled world-space sprites (trail off the skater)
    this.flames = [];
    const flameGeo = new THREE.SphereGeometry(0.26, 6, 6);
    for (let i = 0; i < 12; i++) {
      const m = new THREE.Mesh(
        flameGeo,
        new THREE.MeshBasicMaterial({ color: 0xff6600, transparent: true, opacity: 0 })
      );
      m.visible = false;
      scene.add(m);
      this.flames.push({ mesh: m, life: 0 });
    }
  }

  // buildGame removes the player mesh; the world-space flame pool must go with it —
  // dispose the GPU buffers too, or replaying (menu → play again) leaks VRAM.
  disposeFx() {
    for (const f of this.flames) {
      this.scene.remove(f.mesh);
      f.mesh.geometry?.dispose();
      f.mesh.material?.dispose();
    }
  }

  // Stable-ish jersey number from the player's name
  _jerseyNum() {
    if (this.data && this.data.num) return this.data.num;
    const s = (this.data?.ln || '') + (this.data?.fn || this.team.abbr);
    let h = 0;
    for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) % 98;
    return h + 1; // 1..98
  }

  // EA-style nameplate + number baked to a canvas (back of jersey)
  _backTex(name, num, fg, outline) {
    const c = document.createElement('canvas');
    c.width = 256; c.height = 256;
    const x = c.getContext('2d');
    x.textAlign = 'center';
    // Nameplate (last name, arched-ish straight, condensed)
    const nm = (name || '').toUpperCase();
    x.font = '700 44px "Arial Narrow", "Arial", sans-serif';
    x.lineWidth = 7; x.lineJoin = 'round';
    x.strokeStyle = outline; x.fillStyle = fg;
    x.strokeText(nm, 128, 54);
    x.fillText(nm, 128, 54);
    // Big number below
    x.font = '900 150px "Arial Black", Impact, sans-serif';
    x.lineWidth = 11;
    x.strokeText(String(num), 128, 192);
    x.fillText(String(num), 128, 192);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }

  // Small chest/sleeve number
  _numTex(num, fg, outline) {
    const c = document.createElement('canvas');
    c.width = c.height = 96;
    const x = c.getContext('2d');
    x.textAlign = 'center'; x.textBaseline = 'middle';
    x.font = '900 70px "Arial Black", Impact, sans-serif';
    x.lineWidth = 7; x.strokeStyle = outline; x.fillStyle = fg;
    x.strokeText(String(num), 48, 52);
    x.fillText(String(num), 48, 52);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }

  _build() {
    const c1 = new THREE.Color(this.team.colors.primary);                       // jersey
    const c2 = new THREE.Color(this.team.colors.secondary);                     // socks / trim
    const c3 = new THREE.Color(this.team.colors.accent || this.team.colors.secondary);
    const pantsCol = new THREE.Color(0x1b1b20).lerp(c1, 0.12);                  // dark breezers
    const skin = new THREE.Color(0xc99a72);

    // Legible number/name color vs jersey luminance
    const lum = c1.r * 0.299 + c1.g * 0.587 + c1.b * 0.114;
    const numFg = lum > 0.6 ? '#141414' : '#ffffff';
    const numOutline = lum > 0.6 ? 'rgba(255,255,255,0.9)' : 'rgba(0,0,0,0.85)';

    // PBR materials for a realistic sim look
    const std = (col, rough = 0.7, metal = 0.0, extra = {}) =>
      new THREE.MeshStandardMaterial({ color: col, roughness: rough, metalness: metal, ...extra });
    const jerseyMat = std(c1, 0.72);
    const sockMat   = std(c2, 0.8);
    const trimMat   = std(c3, 0.75);
    const pantMat   = std(pantsCol, 0.82);
    const skinMat   = std(skin, 0.6);
    // Helmet is a DARK glossy shell so the head never blends into the jersey.
    const helmetMat = std(new THREE.Color(c1).lerp(new THREE.Color(0x0a0a0c), 0.4), 0.3, 0.1);
    const cageMat   = std(0x15181c, 0.45, 0.4);        // face cage bars
    const gloveMat  = std(new THREE.Color(c1).lerp(new THREE.Color(0x111111), 0.4), 0.65); // beefy gloves
    const skateMat  = std(0x0d0d10, 0.3, 0.1);
    const bladeMat  = std(0xcfd6dd, 0.25, 0.95);
    const stickMat  = std(0x2a2118, 0.6);

    const group = new THREE.Group();
    const num = this._jerseyNum();

    // ══ ARCADE HITZ BUILD — huge padded shoulders, hard V-taper, two-handed
    //    grip in front, dark caged helmet. Small head over big shoulders. ══

    // ── LEGS — chunky; each a hip-pivot group (un-merged) for the stride anim.
    //    Feet staggered fore/aft for a skating stance.
    const HIP_Y = 2.45;
    this.legs = [];
    [[-0.44, 0.15], [0.44, -0.15]].forEach(([xOff, zStag]) => {
      const leg = new THREE.Group();
      leg.position.set(xOff, HIP_Y, zStag);
      const add = (mesh, y, z = 0.02) => { mesh.position.set(0, y - HIP_Y, z); leg.add(mesh); };
      add(new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.32, 0.95, 12), pantMat), 2.0);    // beefy thigh
      add(new THREE.Mesh(new THREE.CylinderGeometry(0.29, 0.37, 1.3, 12), sockMat), 1.0);    // thick sock
      [0.74, 1.16].forEach(sy => add(new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.38, 0.13, 12), trimMat), sy)); // stripes
      add(new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.46, 1.18), skateMat), 0.3, 0.2);      // chunky boot
      add(new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.18, 1.0), skateMat), 0.1, 0.22);      // holder
      add(new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.14, 1.24), bladeMat), -0.02, 0.22);   // blade
      leg.userData.noMerge = true;
      group.add(leg);
      this.legs.push(leg);
    });

    // ── HOCKEY PANTS / BREEZERS — bulky, hips flare past the waist ──
    const pants = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.12, 1.2), pantMat);
    pants.position.y = 2.62;
    group.add(pants);
    [-0.85, 0.85].forEach(xOff => {                    // flared thigh/hip pads
      const pad = new THREE.Mesh(new THREE.BoxGeometry(0.38, 1.0, 1.06), pantMat);
      pad.position.set(xOff, 2.56, 0);
      group.add(pad);
    });

    // ── TORSO — jersey, wide chest tapering hard to the waist ──
    const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.98, 0.66, 1.75, 16), jerseyMat);
    torso.position.y = 3.62;
    torso.scale.set(1, 1, 0.68);                       // flatten front-to-back
    group.add(torso);
    // upper-chest fill so the jersey meets the shoulder pads cleanly
    const chestFill = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.72, 1.02), jerseyMat);
    chestFill.position.set(0, 4.0, 0);
    chestFill.scale.set(1, 1, 0.72);
    group.add(chestFill);

    // Back nameplate + number
    const backTex = this._backTex(this.data?.ln, num, numFg, numOutline);
    const back = new THREE.Mesh(
      new THREE.PlaneGeometry(1.3, 1.3),
      new THREE.MeshBasicMaterial({ map: backTex, transparent: true })
    );
    back.position.set(0, 3.72, -0.74);
    back.rotation.y = Math.PI;
    group.add(back);

    // Small chest number (upper right)
    const chestTex = this._numTex(num, numFg, numOutline);
    const chest = new THREE.Mesh(
      new THREE.PlaneGeometry(0.44, 0.44),
      new THREE.MeshBasicMaterial({ map: chestTex, transparent: true })
    );
    chest.position.set(0.38, 4.12, 0.73);
    group.add(chest);

    // ── SHOULDER PADS — the arcade Hitz signature: big, blocky, square yoke
    //    with capped ends overhanging the arms. This defines the silhouette.
    const padY = 4.38;
    const yoke = new THREE.Mesh(new THREE.BoxGeometry(2.35, 0.74, 1.22), jerseyMat);
    yoke.position.set(0, padY, 0);
    group.add(yoke);
    [-1.05, 1.05].forEach(xOff => {                    // squared caps overhang the arms, sloped outboard
      const cap = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.8, 1.24), jerseyMat);
      cap.position.set(xOff, padY - 0.05, 0);
      cap.rotation.z = xOff > 0 ? -0.13 : 0.13;
      group.add(cap);
    });

    // ── ARMS — bent forward from under the pads toward a two-handed grip.
    [-1, 1].forEach(sgn => {
      const shX = sgn * 1.05;
      const upper = new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.23, 1.0, 10), jerseyMat);
      upper.position.set(shX, 3.85, 0.14);
      upper.rotation.set(0.5, 0, sgn * 0.2);
      group.add(upper);
      const elbow = new THREE.Mesh(new THREE.SphereGeometry(0.27, 10, 8), trimMat);
      elbow.position.set(shX * 0.92, 3.36, 0.52);
      group.add(elbow);
      const fore = new THREE.Mesh(new THREE.CylinderGeometry(0.23, 0.2, 0.98, 10), jerseyMat);
      fore.position.set(shX * 0.5, 3.0, 0.9);          // converge toward center-front
      fore.rotation.set(-0.9, 0, sgn * 0.55);
      group.add(fore);
    });

    // ── NECK + HEAD — skin, so the face reads against the dark helmet. Small
    //    head over the big pads = arcade proportion.
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.23, 0.3, 10), skinMat);
    neck.position.y = 4.78;
    group.add(neck);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.44, 16, 14), skinMat);
    head.position.set(0, 5.14, 0.02);
    head.scale.set(0.92, 1.05, 1.0);
    group.add(head);
    const nose = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.14, 0.13), skinMat);
    nose.position.set(0, 5.08, 0.46);
    group.add(nose);

    // ── HELMET — dark glossy dome (distinct from jersey) + team-color stripe ──
    const helm = new THREE.Mesh(
      new THREE.SphereGeometry(0.5, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.6),
      helmetMat
    );
    helm.position.set(0, 5.1, 0.0);
    helm.scale.set(1.08, 1.1, 1.14);
    group.add(helm);
    const helmBack = new THREE.Mesh(new THREE.SphereGeometry(0.48, 14, 10), helmetMat);
    helmBack.position.set(0, 5.08, -0.13);
    helmBack.scale.set(1.05, 0.9, 1.02);
    group.add(helmBack);
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.17, 1.05), trimMat); // team mohawk stripe
    stripe.position.set(0, 5.56, -0.02);
    group.add(stripe);
    [-0.5, 0.5].forEach(xOff => {                      // ear caps
      const ear = new THREE.Mesh(new THREE.SphereGeometry(0.17, 10, 8), helmetMat);
      ear.position.set(xOff, 5.0, 0.02);
      group.add(ear);
    });
    // ── FACE CAGE — dark bars across the face (unmistakably hockey) ──
    [-0.17, 0.17].forEach(xOff => {                    // vertical bars
      const bar = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.56, 0.05), cageMat);
      bar.position.set(xOff, 5.04, 0.48);
      group.add(bar);
    });
    [4.84, 5.06, 5.3].forEach(yy => {                  // horizontal bars
      const bar = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.05, 0.05), cageMat);
      bar.position.set(0, yy, 0.48);
      group.add(bar);
    });
    const chinCup = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.17, 0.22), cageMat);
    chinCup.position.set(0, 4.76, 0.42);
    group.add(chinCup);

    // ── STICK + GLOVES — held two-handed in front. The group pivots at the
    //    grip, so a shot swings the blade about the hands; the gloves ride the
    //    stick (so they stay on it through cradle sway and the shot windup).
    const stickGrp = new THREE.Group();
    stickGrp.position.set(0, 2.72, 1.0);               // grip point in front of the chest
    const TILT = 0.98, sT = Math.sin(TILT), cT = Math.cos(TILT);
    const shaft = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.13, 3.4), stickMat);
    shaft.rotation.x = TILT;
    shaft.position.set(0, -sT * 1.7, cT * 1.7);        // top end sits at the grip
    stickGrp.add(shaft);
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.36, 1.0), std(0x111111, 0.5));
    blade.position.set(0, -sT * 3.25, cT * 3.25 + 0.12);
    stickGrp.add(blade);
    const topGlove = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.44, 0.52), gloveMat);
    stickGrp.add(topGlove);                            // top hand at the grip
    const botGlove = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.42, 0.48), gloveMat);
    botGlove.position.set(0, -sT * 0.95, cT * 0.95);   // lower hand down the shaft
    stickGrp.add(botGlove);
    group.add(stickGrp);
    this.stickMesh = stickGrp;

    // ── Fire glow (hidden by default) ──
    const glow = new THREE.PointLight(0xff4400, 0, 9);
    glow.position.y = 3.2;
    group.add(glow);
    this.fireGlow = glow;

    // Collapse static body parts by material (stick group + decals stay separate)
    mergeStaticBody(group);

    // ~5.5u model → ~5.8u tall (≈ real 6ft skater on the 200×85 rink)
    group.scale.set(1.05, 1.05, 1.05);
    this.mesh = group;
    this.scene.add(group);

    // Start position
    const startX = this.side * (this.isGoalie ? 69 : 31);
    const startZ = this.isGoalie ? 0 : (Math.random() - 0.5) * 20;
    this.mesh.position.set(startX, 0, startZ);
  }

  getStickPos() {
    // Blade sits ahead of the skater; a lateral dangle sway makes the puck cradle.
    // Returns a REUSED vector (called every owned frame by the cradle) — copy to keep.
    const sway = Math.sin(this.danglePhase) * 0.5;
    const rx = this.facing.z, rz = -this.facing.x;   // right vector ⟂ heading
    if (!this._stickPos) this._stickPos = new THREE.Vector3();
    return this._stickPos.set(
      this.mesh.position.x + this.facing.x * 1.8 + rx * sway,
      RINK.BOARD_H / 4,
      this.mesh.position.z + this.facing.z * 1.8 + rz * sway
    );
  }

  get spinning() { return this.spinTimer > 0; }

  _clampToRink() {
    this.mesh.position.x = THREE.MathUtils.clamp(this.mesh.position.x, -(RINK.HALF_L - 2), RINK.HALF_L - 2);
    this.mesh.position.z = THREE.MathUtils.clamp(this.mesh.position.z, -(RINK.HALF_W - 2), RINK.HALF_W - 2);
  }

  // dt in seconds; (dx, dz) normalized input; turboHeld = boost requested this frame
  move(dx, dz, dt, turboHeld = false) {
    // Timers that always tick
    if (this.spinCd > 0)        this.spinCd        -= dt;
    if (this.spinTimer > 0)     this.spinTimer     -= dt;
    if (this.recvPassTimer > 0) this.recvPassTimer -= dt;
    if (this.checkCd > 0)       this.checkCd       -= dt;
    if (this.shootCd > 0)       this.shootCd       -= dt;
    if (this.passCd  > 0)       this.passCd        -= dt;
    if (this.dekeCd  > 0)       this.dekeCd        -= dt;
    this._updateFlames(dt);

    // Knocked out → no control, but slide from the hit (big checks launch you)
    if (this.knockedOut) {
      this.shotCharge = 0;          // a hit knocks the loaded shot off your stick
      this.knockTimer -= dt;
      this.mesh.position.x += this.vel.x * dt;
      this.mesh.position.z += this.vel.z * dt;
      this.vel.multiplyScalar(0.90);
      this._clampToRink();
      if (this.knockTimer <= 0) this.knockedOut = false;
      return;
    }

    const moving   = Math.abs(dx) > 0.1 || Math.abs(dz) > 0.1;
    const spinning = this.spinTimer > 0;

    // Turbo — always available while held, like a modern sports-game sprint
    // button. No meter, no drain, no recharge: hold the key, you're boosting.
    this.turboActive = turboHeld && moving && !spinning;

    let topSpeed = PLAYER_SPEED * this.spdMult * this.diffMult * (this.hasPuck ? 0.91 : 1.0);
    if (this.turboActive) topSpeed *= TURBO_MULT;
    if (spinning)         topSpeed *= SPIN_SPEED;
    if (this.shotCharge > 0) topSpeed *= 1 - CHARGE_DRAG * this.shotCharge;   // winding up plants you

    // Heading turns toward input at a capped rate (tight when slow, wide when fast)
    const curSpeed  = Math.hypot(this.vel.x, this.vel.z);
    const speedFrac = Math.min(1, curSpeed / (PLAYER_SPEED * TURBO_MULT));
    if (moving) {
      const desired = Math.atan2(dx, dz);
      let cur = Math.atan2(this.facing.x, this.facing.z);
      let diff = desired - cur;
      while (diff >  Math.PI) diff -= 2 * Math.PI;
      while (diff < -Math.PI) diff += 2 * Math.PI;
      const turnRate = TURN_LOW + (TURN_HIGH - TURN_LOW) * speedFrac;
      cur += THREE.MathUtils.clamp(diff, -turnRate * dt, turnRate * dt);
      this.facing.set(Math.sin(cur), 0, Math.cos(cur));
    }

    // Thrust along the heading; coast (glide) when there's no input → carve + momentum
    if (moving) {
      const a = Math.min(1, PLAYER_ACCEL * dt);
      this.vel.x += (this.facing.x * topSpeed - this.vel.x) * a;
      this.vel.z += (this.facing.z * topSpeed - this.vel.z) * a;
    } else {
      const g = Math.pow(ICE_GLIDE, dt * 60);
      this.vel.x *= g; this.vel.z *= g;
    }
    this.mesh.position.x += this.vel.x * dt;
    this.mesh.position.z += this.vel.z * dt;
    this.danglePhase += dt * (4 + speedFrac * 6);

    // Body faces the heading (spin-o-rama overlays a full turn)
    const baseAngle = Math.atan2(this.facing.x, this.facing.z);
    this.mesh.rotation.y = spinning
      ? baseAngle + (1 - this.spinTimer / SPIN_DURATION) * Math.PI * 2
      : baseAngle;

    this._clampToRink();
    this._animate(dt);

    // On-fire is a burst, not a state — full meter burns out in ~20s
    if (this.onFire) {
      this.fireMeter = Math.max(0, this.fireMeter - dt * 0.05);
      if (this.fireMeter <= 0) { this.onFire = false; this.fireGlow.intensity = 0; }
      else this.fireGlow.intensity = this.fireMeter * 2;
    }
  }

  // Skating stride (legs) + stick state machine (windup → poke → cradle → idle)
  _animate(dt) {
    const hspeed = Math.hypot(this.vel.x, this.vel.z);
    const amp = Math.min(0.55, hspeed * 0.02);
    this.stridePhase += hspeed * dt * 0.55;
    if (this.legs.length === 2) {
      this.legs[0].rotation.x = Math.sin(this.stridePhase) * amp;
      this.legs[1].rotation.x = Math.sin(this.stridePhase + Math.PI) * amp;
    }

    const st = this.stickMesh;
    if (!st) return;
    const ease = (cur, to) => cur + (to - cur) * Math.min(1, dt * 9);

    if (this.shotAnim > 0) {
      // WIND-UP → SWING: puck leaves at contact (see shoot)
      this.shotAnim -= dt;
      const t = 1 - Math.max(0, this.shotAnim) / 0.32;
      st.rotation.x = t < 0.4 ? -(t / 0.4) * 0.9 : -0.9 + ((t - 0.4) / 0.6) * 1.5;
      st.rotation.z = ease(st.rotation.z, 0);
    } else if (this.shotCharge > 0) {
      // LOADING: wind the stick back proportional to charge
      st.rotation.x = ease(st.rotation.x, -0.35 - this.shotCharge * 0.7);
      st.rotation.z = ease(st.rotation.z, 0);
    } else if (this.pokeAnim > 0) {
      // POKE/JAB: quick forward stab and back (pass + check)
      this.pokeAnim -= dt;
      const t = 1 - Math.max(0, this.pokeAnim) / POKE_DUR;
      st.rotation.x = Math.sin(t * Math.PI) * 0.7;
      st.rotation.z = ease(st.rotation.z, 0);
    } else if (this.hasPuck) {
      // CRADLE: stick sways with the puck dangle
      st.rotation.x = ease(st.rotation.x, 0);
      st.rotation.z = Math.sin(this.danglePhase) * 0.35;
    } else {
      // IDLE: settle neutral
      st.rotation.x = ease(st.rotation.x, 0);
      st.rotation.z = ease(st.rotation.z, 0);
    }
  }

  // Spin-o-rama: brief evade (dodges checks) + small burst
  spin() {
    if (this.spinTimer > 0 || this.spinCd > 0 || this.knockedOut) return false;
    this.spinTimer = SPIN_DURATION;
    this.spinCd    = SPIN_COOLDOWN;
    return true;
  }

  // Fake-shot deke: cancel the windup and burst laterally past the defender.
  // dirZ (strafe input) picks the side; no input alternates sides.
  deke(dirZ = 0) {
    if (this.dekeCd > 0 || !this.hasPuck || this.knockedOut) return false;
    this.dekeCd = DEKE_COOLDOWN;
    this.shotCharge = 0;
    this.pokeAnim = POKE_DUR;
    const rx = this.facing.z, rz = -this.facing.x;   // right vector ⟂ heading
    const s = dirZ !== 0 ? Math.sign(dirZ) : (this._dekeSide = -(this._dekeSide || 1));
    this.vel.x += rx * DEKE_BURST * s;
    this.vel.z += rz * DEKE_BURST * s;
    return true;
  }

  // Pooled flame particles while on fire (same zero-alloc pattern as the puck trail)
  _updateFlames(dt) {
    for (const f of this.flames) {
      if (f.life > 0) {
        f.life -= dt;
        f.mesh.position.y += dt * 2.5;                 // flames rise
        const k = Math.max(0, f.life) / 0.45;
        f.mesh.material.opacity = k * 0.85;
        f.mesh.scale.setScalar(0.6 + (1 - k) * 0.8);   // grow as they fade
        if (f.life <= 0) f.mesh.visible = false;
      }
    }
    if (!this.onFire) return;
    const free = this.flames.find(f => f.life <= 0);
    if (free) {
      free.life = 0.45;
      free.mesh.visible = true;
      free.mesh.material.color.setHSL(0.03 + Math.random() * 0.06, 1, 0.5 + Math.random() * 0.25);
      free.mesh.material.opacity = 0.85;
      free.mesh.scale.setScalar(0.6);
      free.mesh.position.set(
        this.mesh.position.x - this.facing.x * 0.6 + (Math.random() - 0.5) * 1.2,
        0.4 + Math.random() * 1.6,
        this.mesh.position.z - this.facing.z * 0.6 + (Math.random() - 0.5) * 1.2
      );
    }
  }

  // A pass just landed on this player → arm the one-timer window + stick-flex
  markPassReceived() { this.recvPassTimer = ONE_TIMER_WINDOW; this.pokeAnim = POKE_DUR * 0.6; }

  canShoot() { return this.hasPuck && this.shootCd <= 0; }
  canPass()  { return this.hasPuck && this.passCd  <= 0; }
  canCheck() { return !this.hasPuck && this.checkCd <= 0; }

  // Build shot power while the shoot button is held.
  // (briefly locked right after a deke, or the still-held shoot key re-loads instantly)
  chargeShot(dt) {
    if (this.hasPuck && this.dekeCd <= DEKE_COOLDOWN - 0.3) {
      this.shotCharge = Math.min(1, this.shotCharge + dt * CHARGE_RATE);
    }
  }
  // Fire the loaded shot on release
  releaseShot(puck) { const c = this.shotCharge; this.shotCharge = 0; this.shoot(puck, c); }

  // BREAKAWAY-style charged shot. charge 0..1 (AI defaults to a mid-power shot).
  shoot(puck, charge = 0.7) {
    if (!this.canShoot()) { this.shotCharge = 0; return; }
    this.shootCd = SHOOT_COOLDOWN;
    this.hasPuck = false;
    this.justShot = true;                 // counted as a shot-on-goal next frame
    this.shotAnim = 0.22 + charge * 0.22; // bigger load → longer wind-up/whip
    const dir = this.facing.clone();
    // Net-seeking assist (Hitz-style): facing anywhere toward the attacking net,
    // the shot snaps AT the net mouth — your facing.z picks the corner. Facing
    // away from goal shoots honest (you can still cough it up backward).
    if (dir.x * this.side > -0.2) {
      const gx = this.side * RINK.GOAL_LINE;
      // full snap on net; facing.z picks the corner, small jitter gives posts/just-wides
      const aimZ = THREE.MathUtils.clamp(this.facing.z * 4, -2.4, 2.4) + (Math.random() - 0.5) * 1.2;
      dir.set(gx - this.mesh.position.x, 0, aimZ - this.mesh.position.z);
    }
    const oneTimer = this.recvPassTimer > 0;
    this.recvPassTimer = 0;
    this.shotOneTimer = oneTimer;
    // Power: base + charge ramp, scaled by shot rating, one-timer, then on-fire
    let speed = (SHOT_MIN + charge * SHOT_CHARGE) * this.shtMult * (oneTimer ? ONE_TIMER_POWER : 1);
    if (this.onFire) speed *= 1.3;
    puck.shoot(dir.normalize(), this.onFire, speed);
  }

  pass(puck, target, opponents = null) {
    if (!this.canPass()) return;
    this.passCd = PASS_COOLDOWN;
    this.hasPuck = false;
    this.pokeAnim = POKE_DUR;     // stick poke as the pass leaves
    if (target) {
      // Perfect-line lead: aim where the receiver will be when the puck arrives
      const lead = passLeadPoint(this, target, new THREE.Vector3());
      let aim = lead, pathLen = this.mesh.position.distanceTo(lead);
      // Blocked lane → bank it off the boards (protection rides through the bounce)
      if (opponents && passLaneBlocker(this.mesh.position, lead, opponents)) {
        const bank = bankPoint(this.mesh.position, lead, opponents);
        if (bank) { pathLen = this.mesh.position.distanceTo(bank) + bank.distanceTo(lead); aim = bank; }
      }
      const d = aim.clone().sub(this.mesh.position).setY(0).normalize();
      this.facing.copy(d);         // turn to face the pass
      // Protection must outlast the actual flight or long passes go uncatchable
      // mid-ice once the window lapses (speed gate then blocks everyone, incl. target).
      const protectDur = Math.min(3.5, pathLen / PASS_SPEED_REF + 0.5);
      puck.pass(d, target, protectDur);   // protected pass — receiver catches, lane defender can pick
    } else {
      puck.pass(this.facing);
    }
  }

  // puck is optional — only BIG (turbo) hits shockwave it, so callers that
  // never throw big hits (none currently do, but keep it safe) can omit it.
  check(opponents, puck = null) {
    if (!this.canCheck()) return null;
    const big = this.turboActive;          // turbo check = BIG hit
    for (const opp of opponents) {
      if (opp.knockedOut) continue;
      if (opp.spinning) continue;          // spin-o-rama dodges the check
      const dist = this.mesh.position.distanceTo(opp.mesh.position);
      if (dist < CHECK_RANGE) {
        this.checkCd = CHECK_COOLDOWN;
        this.pokeAnim = POKE_DUR;            // stick jab on the check
        // Attacker's checking vs victim's strength scales stun + knockback
        const force = THREE.MathUtils.clamp(this.chkMult / opp.pwrMult, 0.7, 1.4);
        this.hitEvent = big ? 'BIG' : 'HIT';
        this.stats.h++;
        opp.knockedOut = true;
        opp.knockTimer = (big ? BIG_HIT_STUN : HIT_STUN) * force;
        // Launch the victim away from the checker
        const push = opp.mesh.position.clone().sub(this.mesh.position).setY(0);
        if (push.lengthSq() < 0.01) push.copy(this.facing);
        push.normalize().multiplyScalar((big ? BIG_HIT_KNOCK : HIT_KNOCK) * force);
        opp.vel.copy(push);
        const loose = opp.hasPuck;
        if (loose) opp.hasPuck = false;

        // BIG hits shockwave a nearby puck loose too, Hitz-style — either it
        // was on the checked player's stick (now jarred free) or just sitting
        // loose close to the collision. Never touches a puck someone else controls.
        if (big && puck && (!puck.owner || puck.owner === opp)) {
          const midX = (this.mesh.position.x + opp.mesh.position.x) / 2;
          const midZ = (this.mesh.position.z + opp.mesh.position.z) / 2;
          const pdx = puck.pos.x - midX, pdz = puck.pos.z - midZ;
          const pd = Math.hypot(pdx, pdz);
          if (pd < 6) {
            puck.drop();
            const nx = pd > 1e-4 ? pdx / pd : this.facing.x;
            const nz = pd > 1e-4 ? pdz / pd : this.facing.z;
            const kick = 30 + Math.random() * 16;
            // radiate outward from the impact, carrying a little of the checker's own momentum
            puck.vel.set(nx * kick + this.facing.x * 10, 0, nz * kick + this.facing.z * 10);
          }
        }

        return (big ? 'BIG_' : '') + (loose ? 'PUCK_LOOSE' : 'HIT');
      }
    }
    return null;
  }

  // threshold: goals in a streak to ignite (3 normally, 2 on a comeback)
  onGoalScored(threshold = 3) {
    this.fireGoals++;
    if (this.fireGoals >= threshold) {
      this.onFire    = true;
      this.fireMeter = 1.0;
      this.fireGoals = 0;
      return true;   // just ignited (for audio)
    }
    this.fireMeter = this.fireGoals / threshold;   // HUD shows the streak building
    return false;
  }

  onGoalAllowed() { this.fireGoals = 0; this.onFire = false; this.fireMeter = 0; }

  setHasPuck(val) {
    this.hasPuck = val;
    if (!val && this.fireGlow.intensity > 0) {
      // keep glow while on fire even without puck
    }
  }
}
