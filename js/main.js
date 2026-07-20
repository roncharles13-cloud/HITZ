import * as THREE from 'three';
import { TEAMS } from './teams.js';
import { teamBadgeSVG } from './badge.js';
import { RINK } from './rink.js';
import { buildArena, setIceForTeam } from './arena.js';
import { Puck } from './puck.js';
import { Player, passLaneBlocker, passLeadPoint } from './player.js';
import { Goalie } from './goalie.js';
import { AI } from './ai.js';
import { HitzCamera } from './camera.js';
import { initHUD, updateHUD, flashGoal } from './hud.js';
import { P1, ACTIONS, getBindings, setBinding, resetBindings, captureNext } from './input.js';
import { sfx, unlockAudio, getVolume, setVolume, isMuted, setMuted } from './audio.js';
import { getDifficulty, setDifficulty } from './difficulty.js';
import { TRIVIA } from './trivia.js';
import { disposeObject3D } from './meshutil.js';

// ── Constants ──────────────────────────────────────────────
const PERIOD_DURATION = 120; // 2 minutes per period
const NUM_PERIODS     = 3;

// ── State ──────────────────────────────────────────────────
const State = { MENU: 'menu', TEAM_SELECT: 'team_select', GAME: 'game', TRIVIA: 'trivia', OVER: 'over' };
let currentState = State.MENU;
let selectedTeams = [TEAMS[8], TEAMS[10]]; // COL vs DET default
let activeSide = 0; // 0 = HOME (your team, left panel), 1 = AWAY (opponent, right panel)

// ── Renderer ───────────────────────────────────────────────
const canvas = document.getElementById('game-canvas');
const W = () => Math.max(window.innerWidth,  document.documentElement.clientWidth,  800);
const H = () => Math.max(window.innerHeight, document.documentElement.clientHeight, 600);

// antialias:false — MSAA is one of the most expensive fixed GPU costs on
// integrated graphics (common on the laptops this ships to via GitHub Pages)
// and can't be toggled after construction, so the adaptive system below has
// no way to claw it back once the renderer exists. The broadcast-distance
// camera hides the jaggies well enough that this is worth it for compatibility.
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
const MAX_PR = Math.min(window.devicePixelRatio, 1.5);
let curPR = MAX_PR;
renderer.setPixelRatio(curPR);
renderer.setSize(W(), H());
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;   // BREAKAWAY filmic grade
renderer.toneMappingExposure = 1.42;                  // bright arcade arena look

// ── Adaptive resolution — hold ~60fps by scaling pixel ratio, with a hard
// floor and a shadow-disable fallback for hardware that's still too slow.
const PR_FLOOR = 0.5;
let perfMs = 0, perfFrames = 0;
function monitorPerf(rawMs) {
  // Only discard genuine one-off stalls (tab backgrounded, a GC pause) — not
  // sustained lag, which is exactly what this system exists to catch. The old
  // threshold here was 60ms: on hardware slow enough to need this system (any
  // frame past ~16fps), EVERY frame was discarded, perfFrames never reached
  // its trigger count, and resolution never adapted — the safety net was
  // disabled by the exact condition it was built to catch.
  if (rawMs > 300) return;
  perfMs += rawMs; perfFrames++;
  if (perfFrames < 12) return;          // react in ~0.2-3s, not 10-40s at low fps
  const avg = perfMs / perfFrames;
  perfMs = 0; perfFrames = 0;

  if (avg > 21 && curPR > PR_FLOOR) {                 // < ~48fps → drop resolution
    curPR = Math.max(PR_FLOOR, curPR - (avg > 60 ? 0.3 : 0.1));  // cut harder when very slow
    renderer.setPixelRatio(curPR);
  } else if (avg < 14 && curPR < MAX_PR) {            // > ~71fps → restore resolution
    curPR = Math.min(MAX_PR, curPR + 0.1);
    renderer.setPixelRatio(curPR);
  }

  // Resolution alone isn't enough — pinned at the floor and still slow means
  // the bottleneck is a fixed per-frame cost (the shadow pass), not pixel
  // count. Drop it once, for good; re-enabling on a lucky good window would
  // just flicker back off again next time play gets busy.
  if (renderer.shadowMap.enabled && curPR <= PR_FLOOR && avg > 30) {
    renderer.shadowMap.enabled = false;
  }
}

// ── Scene & Camera ─────────────────────────────────────────
const scene = new THREE.Scene();
scene.background = new THREE.Color('#03050b');         // BREAKAWAY dark arena
scene.fog = new THREE.Fog('#05080f', 220, 760);

const FOV_DEFAULT = 50;
let userFov = parseFloat(localStorage.getItem('hitz_fov')) || FOV_DEFAULT;
const camera = new THREE.PerspectiveCamera(
  userFov, W() / H(), 0.1, 1000
);
const hitzCam = new HitzCamera(camera);

window.addEventListener('resize', () => {
  camera.aspect = W() / H();
  camera.updateProjectionMatrix();
  renderer.setSize(W(), H());
});

// ── Game objects ───────────────────────────────────────────
let puck, players = [], goalies = [], aiControllers = [];
let gameState = {
  score: [0, 0],
  clock: PERIOD_DURATION,
  period: 1,
  teams: [null, null],
  fireMeter: [0, 0],
  turbo: 1,
  shots: [0, 0],
};
let goalCooldown   = 0;
let gameRunning    = false;
let paused         = false;
let faceoffTimer   = 0;
const FACEOFF_DURATION = 1.6;
let prevTime       = performance.now();

// Directed one-timer: human presses PASS then SHOOT → teammate catch-and-fires
let otReceiver = null, otArmed = false, otTimer = 0;
const OT_WINDOW = 1.6;
let shootPrev = false, passPrev = false, callPrev = false;   // for rising-edge detection
let callOneTimer = false;   // a call-for-puck made near the net → set up a one-timer on receive
let lastConceded = -1;      // teamIdx that just allowed a goal (gets the faceoff edge)
let ghostRing = null;                    // pass-landing indicator (white = clean, red = pickable)
let p1Ring = null;                       // red ring under YOUR skater — instant "who am I" read
let goalLamp = null;                     // red goal-light strobe behind the scored-on net (pooled)
const celly = { timer: 0, scorer: null };   // goal celebration (orbit cam + scorer hops)
const _ringLead = new THREE.Vector3();   // reused per frame — no loop allocation
let oppOfHuman = [];                     // [players[2], players[3]] — cached, no loop allocation

// ── Build Game ─────────────────────────────────────────────
function buildGame(team1, team2) {
  // Clear old objects — buildGame reruns every "START GAME" click within one page
  // load, so anything torn down here must free its GPU buffers or replaying leaks VRAM.
  players.forEach(p => { scene.remove(p.mesh); disposeObject3D(p.mesh); if (p.disposeFx) p.disposeFx(); });
  goalies.forEach(g => { scene.remove(g.mesh); disposeObject3D(g.mesh); });
  if (puck) { scene.remove(puck.mesh); disposeObject3D(puck.mesh); puck.disposeFx(); }
  players = []; goalies = []; aiControllers = [];
  lastConceded = -1;   // don't let a previous match's draw bias carry into this one

  // Personalize center ice to the home (player) team
  setIceForTeam(team1);

  // Puck
  puck = new Puck(scene);

  // Team 1 (side = 1 → attacks +X, scores in the +89 net, defends own net at -89)
  const sk1 = team1.roster.filter(r => r.pos !== 'G');   // skaters only (roster[0] is the goalie)
  const p1 = new Player(scene, team1, 1, false, sk1[0]);
  const p1b = new Player(scene, team1, 1, false, sk1[1]);
  p1.mesh.position.set(-18, 0, -8);   // start in own (-X) half
  p1b.mesh.position.set(-18, 0, 8);
  players.push(p1, p1b);

  // Team 1's goalie guards their OWN net at -89 → goalie side = -1
  const g1 = new Goalie(scene, team1, -1);
  goalies.push(g1);

  // Team 2 (side = -1 → attacks -X, scores in the -89 net, defends own net at +89)
  const sk2 = team2.roster.filter(r => r.pos !== 'G');   // skaters only (roster[0] is the goalie)
  const p2 = new Player(scene, team2, -1, false, sk2[0]);
  const p2b = new Player(scene, team2, -1, false, sk2[1]);
  p2.mesh.position.set(18, 0, -8);    // start in own (+X) half
  p2b.mesh.position.set(18, 0, 8);
  players.push(p2, p2b);

  // Team 2's goalie guards their OWN net at +89 → goalie side = +1
  const g2 = new Goalie(scene, team2, 1);
  goalies.push(g2);

  // Tag team index (for shots-on-goal) — players 0,1 = team 0; 2,3 = team 1
  players.forEach((p, i) => { p.teamIdx = i < 2 ? 0 : 1; });
  // Human-controlled skater plows through traffic (collision priority → fluid control)
  players[0].collMass = 8;
  oppOfHuman = [players[2], players[3]];

  // Ghost-puck pass indicator — one pooled ring, created once, reused every game
  if (!ghostRing) {
    ghostRing = new THREE.Mesh(
      new THREE.RingGeometry(0.7, 1.0, 24),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.55,
                                    side: THREE.DoubleSide, depthWrite: false })
    );
    ghostRing.rotation.x = -Math.PI / 2;
    ghostRing.position.y = 0.06;
    scene.add(ghostRing);
  }
  ghostRing.visible = false;

  // Red circle under the human-controlled skater
  if (!p1Ring) {
    p1Ring = new THREE.Mesh(
      new THREE.RingGeometry(1.2, 1.65, 28),
      new THREE.MeshBasicMaterial({ color: 0xff2222, transparent: true, opacity: 0.7,
                                    side: THREE.DoubleSide, depthWrite: false })
    );
    p1Ring.rotation.x = -Math.PI / 2;
    p1Ring.position.y = 0.05;
    scene.add(p1Ring);
  }
  p1Ring.visible = true;

  // Goal lamp — red strobe light behind whichever net just got scored on
  if (!goalLamp) {
    goalLamp = new THREE.PointLight(0xff3300, 0, 45);
    goalLamp.position.set(0, 8, 0);
    scene.add(goalLamp);
  }
  goalLamp.intensity = 0;
  celly.timer = 0; celly.scorer = null;

  // Difficulty scales the OPPONENTS only — teammate + your goalie stay full-skill
  const diff = getDifficulty();
  p2.diffMult  = diff.oppSpeed;
  p2b.diffMult = diff.oppSpeed;
  g2.saveScale  = diff.saveScale;    // g2 guards the net YOU shoot at
  g2.reactDelay = diff.reactDelay;
  g2.speed      = diff.goalieSpeed;

  // AI controllers — p1b, p2, p2b are AI (p2/p2b are difficulty-scaled NPCs)
  aiControllers = [
    new AI(p1b, 1),
    new AI(p2,  -1, true),
    new AI(p2b, -1, true),
  ];

  // Game state
  gameState = {
    score: [0, 0],
    clock: PERIOD_DURATION,
    period: 1,
    teams: [team1, team2],
    fireMeter: [0, 0],
    turbo: 1,
    shots: [0, 0],
  };
  goalCooldown = 0;
  gameRunning = true;
  startFaceoff();
}

// ── Game loop ──────────────────────────────────────────────
function scheduleLoop() {
  // RAF doesn't fire in hidden iframes/tabs; fall back to setTimeout
  if (document.visibilityState === 'hidden') {
    setTimeout(loop, 16);
  } else {
    requestAnimationFrame(loop);
  }
}

function loop() {
  scheduleLoop();
  const now   = performance.now();
  const rawMs = now - prevTime;
  const dt    = Math.min(rawMs / 1000, 0.033);
  prevTime    = now;
  monitorPerf(rawMs);

  if (currentState !== State.GAME) {
    renderer.render(scene, camera);
    return;
  }

  if (!gameRunning) { renderer.render(scene, camera); return; }

  // ── Paused — freeze everything, keep rendering ───────────
  if (paused) { renderer.render(scene, camera); return; }

  // ── Face-off — players/puck frozen at the dot until the drop ──
  if (faceoffTimer > 0) {
    faceoffTimer -= dt;
    if (faceoffTimer <= 0) {
      document.getElementById('faceoff-banner').classList.remove('show');
      // Win the draw — puck squirts toward a winger (edge to the team that just conceded)
      let pHuman = 0.55;
      if (lastConceded === 0) pHuman = 0.65; else if (lastConceded === 1) pHuman = 0.45;
      const winger = players[Math.random() < pHuman ? 1 : 3];
      const dir = winger.mesh.position.clone().sub(puck.pos).setY(0).normalize();
      puck.vel.set(dir.x * 24 + (Math.random() - 0.5) * 5, 0, dir.z * 24 + (Math.random() - 0.5) * 5);
    }
    players.forEach(p => p.move(0, 0, dt));   // idle (legs settle), no input
    if (p1Ring) p1Ring.position.set(players[0].mesh.position.x, 0.05, players[0].mesh.position.z);
    hitzCam.update(puck, players, dt);
    updateHUD(gameState, dt);
    renderer.render(scene, camera);
    return;
  }

  // ── Clock ────────────────────────────────────────────────
  if (goalCooldown <= 0) {
    gameState.clock -= dt;
    if (gameState.clock <= 0) {
      gameState.clock = 0;
      gameRunning = false;
      sfx.buzzer();
      if (gameState.period < NUM_PERIODS) {
        showTrivia();
      } else {
        showGameOver();
      }
    }
  } else {
    goalCooldown -= dt;
    if (goalCooldown <= 0) startFaceoff();   // drop a new puck after a goal
  }

  // ── Goal celebration — orbit the scorer, strobe the lamp, then faceoff ──
  if (goalCooldown > 0 && celly.timer > 0 && celly.scorer) {
    celly.timer -= dt;
    const sc = celly.scorer, t = 2.6 - celly.timer;
    sc.mesh.rotation.y += dt * 8;                                     // victory twirl
    sc.mesh.position.y = Math.abs(Math.sin(t * 6)) * 0.9;             // celly hops
    if (goalLamp) goalLamp.intensity = Math.sin(t * 22) > 0 ? 10 : 2; // red strobe
    const ang = t * 1.3, r = 15;                                      // slow orbit around the scorer
    camera.position.set(sc.mesh.position.x + Math.cos(ang) * r, 8.5,
                        sc.mesh.position.z + Math.sin(ang) * r);
    camera.lookAt(sc.mesh.position.x, 3, sc.mesh.position.z);
    if (celly.timer <= 0) {
      sc.mesh.position.y = 0;
      if (goalLamp) goalLamp.intensity = 0;
      celly.scorer = null;
    }
    updateHUD(gameState, dt);
    renderer.render(scene, camera);
    return;
  }

  // ── P1 input ─────────────────────────────────────────────
  const humanPlayer = players[0];
  if (goalCooldown <= 0) {
    // Camera looks down the ice (+X = up-screen, +Z = right-screen),
    // so W/S drive forward/back (X) and A/D drive strafe (Z).
    const dx = (P1.up()    ? 1 : 0) - (P1.down() ? 1 : 0);
    const dz = (P1.right() ? 1 : 0) - (P1.left() ? 1 : 0);
    humanPlayer.move(dx, dz, dt, P1.turbo());

    // Spin-o-rama (cooldown-gated, so holding the key is fine).
    // Carrying it near the net = between-the-legs deke: the goalie bites.
    if (P1.spin() && humanPlayer.spin() && humanPlayer.hasPuck) {
      freezeGoalie(humanPlayer, 0.5);
    }

    // (puck reception for ALL players — human included — is handled by
    //  resolvePuckReception() below, so the human and AI catch passes identically)

    // Rising edges (press, not hold) for pass + shoot + call
    const shootDown = P1.shoot(), passDown = P1.pass(), callDown = P1.call();
    const shootEdge = shootDown && !shootPrev;
    const passEdge  = passDown  && !passPrev;
    const callEdge  = callDown  && !callPrev;
    shootPrev = shootDown; passPrev = passDown; callPrev = callDown;

    // shoot()/pass() clear hasPuck themselves; clearing it here first would
    // trip their canShoot()/canPass() guards and silently cancel the action.
    if (humanPlayer.hasPuck) {
      if (shootDown) humanPlayer.chargeShot(dt);                 // hold to load power
      else if (humanPlayer.shotCharge > 0) humanPlayer.releaseShot(puck);  // release to fire
      if (passEdge) {
        if (humanPlayer.shotCharge > 0) {
          // FAKE-SHOT DEKE: pass mid-windup cancels the shot into a lateral burst
          // and the goalie bites on the fake (can't attempt a save briefly)
          if (humanPlayer.deke(dz)) freezeGoalie(humanPlayer, 0.55);
        } else {                                   // pass → set up a directed one-timer
          humanPlayer.pass(puck, players[1], oppOfHuman);
          otReceiver = players[1]; otArmed = false; otTimer = OT_WINDOW;
        }
      }
    } else {
      // CALL FOR PUCK (Q): the teammate who has it feeds you. Near the attacking
      // net it squares you up for a one-timer when the pass lands.
      if (callEdge && players[1].hasPuck) {
        players[1].pass(puck, humanPlayer, oppOfHuman);
        const gx = humanPlayer.side * RINK.GOAL_LINE;
        callOneTimer = Math.abs(gx - humanPlayer.mesh.position.x) < 55;
      }
      // SHOOT arms a pending directed one-timer (teammate fires on receive)
      if (shootEdge && otReceiver && otTimer > 0 && !otReceiver.knockedOut) {
        otArmed = true;
      }
    }

    if (P1.check()) {
      humanPlayer.check([players[2], players[3]], puck);
    }

    // Fire + turbo + shot-power display
    gameState.fireMeter[0] = humanPlayer.fireMeter;
    gameState.turbo = humanPlayer.turbo;
    gameState.shotCharge = humanPlayer.shotCharge;
  }

  // ── AI ───────────────────────────────────────────────────
  const team1Players = [players[0], players[1]];
  const team2Players = [players[2], players[3]];

  aiControllers[0].update(puck, team1Players, team2Players, dt);
  aiControllers[1].update(puck, team2Players, team1Players, dt);
  aiControllers[2].update(puck, team2Players, team1Players, dt);

  // Unified puck reception — identical for the human and every AI
  resolvePuckReception();

  // Directed one-timer: once the teammate has the puck, catch-and-fire on goal (one motion)
  if (otTimer > 0) {
    otTimer -= dt;
    if (otArmed && otReceiver && otReceiver.hasPuck && !otReceiver.knockedOut) {
      const gx = otReceiver.side * RINK.GOAL_LINE, p = otReceiver.mesh.position;
      otReceiver.facing.set(gx - p.x, 0, -p.z).normalize();   // aim at the net
      otReceiver.recvPassTimer = 0.5;                          // guarantee the one-timer bonus
      otReceiver.shootCd = 0;
      otReceiver.shoot(puck);
      otReceiver = null; otArmed = false; otTimer = 0;
    } else if (otTimer <= 0) {
      otReceiver = null; otArmed = false;
    }
  }

  // Bodies can't overlap — separate skaters + keep them out of the goalies
  resolveCollisions();

  // Red circle tracks the human skater
  if (p1Ring) p1Ring.position.set(humanPlayer.mesh.position.x, 0.05, humanPlayer.mesh.position.z);

  // Ghost-puck indicator: where your pass would land — white = clean lane, red = pickable
  if (ghostRing) {
    const show = humanPlayer.hasPuck && goalCooldown <= 0;
    ghostRing.visible = show;
    if (show) {
      passLeadPoint(humanPlayer, players[1], _ringLead);
      ghostRing.position.set(_ringLead.x, 0.06, _ringLead.z);
      const blocked = passLaneBlocker(humanPlayer.mesh.position, _ringLead, oppOfHuman);
      ghostRing.material.color.setHex(blocked ? 0xff3344 : 0xffffff);
    }
  }

  // Per-frame event audio + shots-on-goal
  players.forEach(p => {
    if (p.justShot) {
      gameState.shots[p.teamIdx]++;
      p.stats.sog++;
      sfx[p.shotOneTimer ? 'oneTimer' : 'shot']();
      p.justShot = false; p.shotOneTimer = false;
    }
    if (p.hitEvent) { sfx[p.hitEvent === 'BIG' ? 'bigHit' : 'hit'](); p.hitEvent = null; }
  });
  goalies.forEach(g => { if (g.saved) { sfx.save(); g.saved = false; } });
  if (puck.boardHit) { sfx.board(); puck.boardHit = false; }

  // Fire meter for team2
  gameState.fireMeter[1] = Math.max(players[2].fireMeter, players[3].fireMeter);

  // ── Puck physics ─────────────────────────────────────────
  puck.update(dt);

  // Drop puck if owner gets checked
  if (puck.owner && puck.owner.knockedOut) {
    puck.owner.setHasPuck(false);
    puck.drop();
  }

  // ── Goalies ──────────────────────────────────────────────
  goalies[0].update(puck, dt);
  goalies[1].update(puck, dt);

  // Goalie saves — trySave (skill/range roll) first, then bodyBlock (hard
  // physical collision, always bounces) catches anything close enough to be
  // touching the goalie regardless of how the roll went.
  if (!puck.owner) {
    goalies.forEach(g => { if (!g.trySave(puck)) g.bodyBlock(puck); });
  }

  // ── Goal detection ────────────────────────────────────────
  if (goalCooldown <= 0) {
    checkGoal();
  }

  // ── Camera ────────────────────────────────────────────────
  hitzCam.update(puck, players, dt);

  updateHUD(gameState, dt);
  renderer.render(scene, camera);
}

// Unified puck reception — the human and every AI catch the puck the SAME way.
// A protected pass snaps to its target's blade (magnetic catch); a loose puck is
// collected by the closest eligible skater (speed-gated inside canPickup).
function resolvePuckReception() {
  if (puck.owner) return;
  let best = null, bd = Infinity;
  for (const p of players) {
    if (p.hasPuck || p.knockedOut) continue;
    if (!puck.canPickup(p)) continue;
    const d = puck.pos.distanceTo(p.mesh.position);
    if (d < bd) { bd = d; best = p; }
  }
  if (!best) return;
  const wasPass = puck.fromPass;
  const feeder  = puck.lastOwner;   // read BEFORE pickup (assist chain for the stats screen)
  puck.pickup(best);           // arms one-timer + stick-flex (markPassReceived); clears protect/fromPass
  best.setHasPuck(true);
  // Assist credit: catching a teammate's pass makes them your feeder; anything else clears it
  best.lastFeeder = (wasPass && feeder && feeder !== best && feeder.teamIdx === best.teamIdx)
    ? feeder : null;
  if (wasPass) sfx.catch();    // reception "thwack"
  // Call-for-puck near the net → square the human up to goal + a generous one-timer window
  if (best === players[0] && wasPass && callOneTimer) {
    const gx = best.side * RINK.GOAL_LINE, mp = best.mesh.position;
    best.facing.set(gx - mp.x, 0, -mp.z).normalize();
    best.recvPassTimer = 0.7;
  }
  callOneTimer = false;        // consumed (or cleared if the call didn't connect to the human)
}

function checkGoal() {
  const px = puck.pos.x;
  const pz = puck.pos.z;

  // +89 net is team 1's attacking net (team 2's own net) → team 1 scores
  if (px > RINK.GOAL_LINE - 1 && Math.abs(pz) < RINK.GOAL_W / 2) {
    scoreGoal(0); // team 1 scored
    return;
  }
  // -89 net is team 2's attacking net (team 1's own net) → team 2 scores
  if (px < -(RINK.GOAL_LINE - 1) && Math.abs(pz) < RINK.GOAL_W / 2) {
    scoreGoal(1); // team 2 scored
  }
}

// 'F. LASTNAME' from the roster entry (used by the goal flash + summary screen)
function scorerName(p) {
  const fn = p.data?.fn, ln = p.data?.ln || '';
  return ((fn ? fn[0] + '. ' : '') + ln).trim().toUpperCase();
}

// A deke sells the goalie — he commits the wrong way and can't attempt a save briefly
function freezeGoalie(player, dur) {
  const g = goalies[player.side === 1 ? 1 : 0];   // the net this player attacks
  if (Math.abs(player.mesh.position.x - player.side * RINK.GOAL_LINE) < 30) {
    g.beatCd = Math.max(g.beatCd, dur);
  }
}

function scoreGoal(teamIdx) {
  // Comeback momentum: a team trailing by 2+ ignites on fire in 2 goals instead of 3
  const deficit = gameState.score[1 - teamIdx] - gameState.score[teamIdx];
  gameState.score[teamIdx]++;
  lastConceded = 1 - teamIdx;   // conceding team gets the edge on the next draw

  // Scorer + assist credit (an own goal credits nobody)
  const scoringTeamPlayers = teamIdx === 0 ? [players[0], players[1]] : [players[2], players[3]];
  const scorer = (puck.lastOwner && puck.lastOwner.teamIdx === teamIdx) ? puck.lastOwner : null;
  if (scorer) {
    scorer.stats.g++;
    if (scorer.lastFeeder && scorer.lastFeeder.teamIdx === teamIdx && scorer.lastFeeder !== scorer) {
      scorer.lastFeeder.stats.a++;
    }
  }

  flashGoal(gameState.teams[teamIdx].abbr, scorer ? scorerName(scorer) : '');
  goalCooldown = 3.0;
  sfx.goal();

  // Celebration: orbit cam on the scorer, goal lamp strobing at the beaten net
  celly.scorer = scorer || scoringTeamPlayers[0];
  celly.timer  = 2.6;
  if (goalLamp) goalLamp.position.set(teamIdx === 0 ? 86 : -86, 8, 0);

  const ignited = scoringTeamPlayers.map(p => p.onGoalScored(deficit >= 2 ? 2 : 3)).some(Boolean);
  if (ignited) sfx.onFire();
  // Reset opponent fire
  const oppPlayers = teamIdx === 0 ? [players[2], players[3]] : [players[0], players[1]];
  oppPlayers.forEach(p => p.onGoalAllowed());

  puck.drop();
  puck.vel.set(0, 0, 0);
  puck.pos.set(0, 0.2, 0);
}

// ── Collision resolution ───────────────────────────────────
const SKATER_R = 1.0;     // skater collision radius (world units)
const GOALIE_R = 1.4;     // goalie collision radius
const SOFT = 0.5;         // fraction of overlap resolved per pass (springy contact)
const PUSH_IMPULSE = 4;   // mass-weighted push-apart so contesting players don't lock

// Soft body separation — nudge POSITIONS apart only; velocity is NEVER touched,
// so momentum carries through contact. You bump and slide/muscle past instead of
// getting force-stopped. Heavier players (pwr) give less ground.
function separateSkaters(a, b) {
  const ap = a.mesh.position, bp = b.mesh.position;
  let dx = bp.x - ap.x, dz = bp.z - ap.z;
  let d = Math.hypot(dx, dz);
  const minD = SKATER_R * 2;
  if (d >= minD) return;
  if (d < 1e-4) { dx = Math.random() - 0.5; dz = Math.random() - 0.5; d = Math.hypot(dx, dz) || 1; }
  const nx = dx / d, nz = dz / d, overlap = minD - d, res = overlap * SOFT;   // n points a → b
  const ma = a.collMass || 1, mb = b.collMass || 1, tot = ma + mb;   // human = heavy → plows through
  ap.x -= nx * res * (mb / tot); ap.z -= nz * res * (mb / tot);
  bp.x += nx * res * (ma / tot); bp.z += nz * res * (ma / tot);
  // mass-weighted push-apart impulse so two contesting skaters don't lock (human's share ≈ 0)
  const push = overlap * PUSH_IMPULSE;
  a.vel.x -= nx * push * (mb / tot); a.vel.z -= nz * push * (mb / tot);
  b.vel.x += nx * push * (ma / tot); b.vel.z += nz * push * (ma / tot);
  a._clampToRink(); b._clampToRink();
}

// Soft-slide a skater out of an immovable goalie (position only)
function pushSkaterOut(p, center, minD) {
  const pp = p.mesh.position;
  let dx = pp.x - center.x, dz = pp.z - center.z;
  let d = Math.hypot(dx, dz);
  if (d >= minD) return;
  if (d < 1e-4) { dx = Math.random() - 0.5; dz = Math.random() - 0.5; d = Math.hypot(dx, dz) || 1; }
  const nx = dx / d, nz = dz / d, overlap = minD - d;
  pp.x += nx * overlap * SOFT; pp.z += nz * overlap * SOFT;
  p.vel.x += nx * overlap * PUSH_IMPULSE; p.vel.z += nz * overlap * PUSH_IMPULSE;
  p._clampToRink();
}

function resolveCollisions() {
  for (let pass = 0; pass < 2; pass++) {                     // 2 passes settle pile-ups
    for (let i = 0; i < players.length; i++)
      for (let j = i + 1; j < players.length; j++)
        separateSkaters(players[i], players[j]);
    for (const p of players)
      for (const g of goalies)
        pushSkaterOut(p, g.mesh.position, SKATER_R + GOALIE_R);
  }
}

// ── Face-off — line up at the dot, freeze, then drop the puck ──
function startFaceoff() {
  // Two centers nose-to-nose on the dot, wingers staggered back
  players[0].mesh.position.set(-5, 0, 0);
  players[2].mesh.position.set( 5, 0, 0);
  players[1].mesh.position.set(-26, 0, -12);
  players[3].mesh.position.set( 26, 0,  12);
  players.forEach(p => { p.knockedOut = false; p.setHasPuck(false); p.vel.set(0, 0, 0); });
  players[0].facing.set(1, 0, 0); players[1].facing.set(1, 0, 0);
  players[2].facing.set(-1, 0, 0); players[3].facing.set(-1, 0, 0);
  puck.owner = null; puck.vel.set(0, 0, 0); puck.pos.set(0, 0.2, 0);
  otReceiver = null; otArmed = false; otTimer = 0;   // reset any pending one-timer
  if (ghostRing) ghostRing.visible = false;
  // Kill any leftover celebration state (positions were just reset)
  celly.timer = 0; celly.scorer = null;
  if (goalLamp) goalLamp.intensity = 0;
  faceoffTimer = FACEOFF_DURATION;
  document.getElementById('faceoff-banner').classList.add('show');
  sfx.whistle();
}

// ── Trivia intermission ───────────────────────────────────
const TRIVIA_DURATION = 12; // seconds to answer before auto-reveal
let triviaTimer = 0;
let triviaRafId = null;

function showTrivia() {
  currentState = State.TRIVIA;

  const q = TRIVIA[Math.floor(Math.random() * TRIVIA.length)];
  // Shuffle answers keeping correct (a[0]) trackable by index
  const shuffled = q.a.map((text, i) => ({ text, correct: i === 0 }));
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  const s = gameState.score;
  document.getElementById('trivia-period-banner').textContent =
    `END OF PERIOD ${gameState.period}`;
  document.getElementById('trivia-score-line').textContent =
    `${gameState.teams[0].abbr}  ${s[0]} — ${s[1]}  ${gameState.teams[1].abbr}`;
  document.getElementById('trivia-question').textContent = q.q;
  document.getElementById('trivia-result').textContent = '';

  const answersEl = document.getElementById('trivia-answers');
  answersEl.innerHTML = '';
  shuffled.forEach(({ text, correct }) => {
    const btn = document.createElement('button');
    btn.className = 'trivia-btn';
    btn.textContent = text;
    btn._isCorrect = correct;
    btn.addEventListener('click', () => revealTrivia(correct, btn, answersEl));
    answersEl.appendChild(btn);
  });

  document.getElementById('trivia-screen').classList.remove('hidden');

  // Countdown timer
  triviaTimer = TRIVIA_DURATION;
  const fill = document.getElementById('trivia-timer-fill');
  let last = performance.now();

  function tick() {
    const now = performance.now();
    triviaTimer -= (now - last) / 1000;
    last = now;
    fill.style.width = `${Math.max(0, triviaTimer / TRIVIA_DURATION * 100)}%`;
    if (triviaTimer <= 0) {
      revealTrivia(false, null, answersEl);
    } else {
      triviaRafId = requestAnimationFrame(tick);
    }
  }
  triviaRafId = requestAnimationFrame(tick);
}

function revealTrivia(playerCorrect, clickedBtn, answersEl) {
  if (triviaRafId) { cancelAnimationFrame(triviaRafId); triviaRafId = null; }
  document.getElementById('trivia-timer-fill').style.width = '0%';

  Array.from(answersEl.children).forEach(btn => {
    btn.disabled = true;
  });
  Array.from(answersEl.children).forEach(btn => {
    if (btn._isCorrect) {
      btn.classList.add('correct');
    } else if (btn === clickedBtn) {
      btn.classList.add('wrong');
    }
  });

  const resultEl = document.getElementById('trivia-result');
  if (playerCorrect) {
    resultEl.textContent = '✓ CORRECT!';
    resultEl.style.color = '#00ff88';
  } else if (clickedBtn === null) {
    resultEl.textContent = 'TIME\'S UP';
    resultEl.style.color = '#ff4400';
  } else {
    resultEl.textContent = '✗ WRONG';
    resultEl.style.color = '#ff2200';
  }

  setTimeout(continueAfterTrivia, 2800);
}

function continueAfterTrivia() {
  document.getElementById('trivia-screen').classList.add('hidden');
  gameState.period++;
  gameState.clock = PERIOD_DURATION;
  gameRunning = true;
  currentState = State.GAME;
  startFaceoff();
}

function showGameOver() {
  if (p1Ring) p1Ring.visible = false;
  if (goalLamp) goalLamp.intensity = 0;
  sfx.stopCrowd();
  document.getElementById('team-select').classList.add('hidden');
  document.getElementById('hud').style.display = 'none';
  currentState = State.OVER;

  const s = gameState.score;
  const winner = s[0] > s[1]
    ? gameState.teams[0].full
    : s[1] > s[0] ? gameState.teams[1].full : 'TIE';

  document.getElementById('menu-sub').textContent =
    `FINAL: ${gameState.teams[0].abbr} ${s[0]} - ${s[1]} ${gameState.teams[1].abbr}   |   ${winner === 'TIE' ? 'TIE GAME' : winner.toUpperCase() + ' WINS'}`;

  buildSummary(winner);
  document.getElementById('summary-screen').classList.remove('hidden');
}

// Match summary: per-skater G / A / HIT / SOG + Player of the Game
function buildSummary(winner) {
  const s = gameState.score;
  document.getElementById('summary-title').textContent =
    winner === 'TIE' ? 'TIE GAME' : winner.toUpperCase() + ' WIN';
  document.getElementById('summary-score').textContent =
    `${gameState.teams[0].abbr}  ${s[0]} — ${s[1]}  ${gameState.teams[1].abbr}`;

  const wrap = document.getElementById('summary-tables');
  wrap.innerHTML = '';
  for (const ti of [0, 1]) {
    const tbl = document.createElement('div');
    tbl.className = 'sum-team';
    let rows =
      `<div class="sum-head" style="color:${gameState.teams[ti].colors.primary}">` +
      `${gameState.teams[ti].full.toUpperCase()}</div>` +
      `<div class="sum-row sum-cols"><span>PLAYER</span><span>G</span><span>A</span><span>HIT</span><span>SOG</span></div>`;
    for (const p of players.filter(pl => pl.teamIdx === ti)) {
      rows += `<div class="sum-row"><span>${scorerName(p) || 'SKATER'}</span>` +
              `<span>${p.stats.g}</span><span>${p.stats.a}</span>` +
              `<span>${p.stats.h}</span><span>${p.stats.sog}</span></div>`;
    }
    tbl.innerHTML = rows;
    wrap.appendChild(tbl);
  }

  // Player of the Game — goals weigh most, then assists, hits, shots
  let pog = players[0], best = -1;
  for (const p of players) {
    const sc = p.stats.g * 3 + p.stats.a * 2 + p.stats.h * 0.5 + p.stats.sog * 0.25;
    if (sc > best) { best = sc; pog = p; }
  }
  document.getElementById('summary-pog').textContent =
    `★ PLAYER OF THE GAME: ${scorerName(pog) || 'SKATER'} (${gameState.teams[pog.teamIdx].abbr}) ★`;
}

// ── Menu & Team Select UI ──────────────────────────────────
// Roster-average overall rating — purely presentational, no new team data needed
const teamOvr = t => Math.round(t.roster.reduce((s, r) => s + r.rating, 0) / t.roster.length);

// Paint one VS-stage panel (wordmark, city/OVR, nickname, jersey-color background)
function renderVsPanel(side) {
  const t = selectedTeams[side];
  const panel = document.getElementById('vs-panel-' + side);
  panel.style.setProperty('--pc', t.colors.primary);
  panel.style.setProperty('--sc', t.colors.secondary);
  document.getElementById('vs-badge-' + side).innerHTML = teamBadgeSVG(t, 168);
  document.getElementById('vs-city-' + side).textContent = t.city;
  document.getElementById('vs-ovr-' + side).textContent = 'OVR ' + teamOvr(t);
  document.getElementById('vs-nick-' + side).textContent = t.name;
  panel.classList.toggle('active', activeSide === side);
}

function renderVsStage() {
  renderVsPanel(0);
  renderVsPanel(1);
  document.querySelectorAll('.vs-tab').forEach(b =>
    b.classList.toggle('active', Number(b.dataset.side) === activeSide));
}

function setActiveSide(side) {
  activeSide = side;
  renderVsStage();
}

// Cycle the active side's team by ±1 through TEAMS, wrapping — skips whichever
// team the OTHER side already has so you can never scroll into a mirror match.
function cycleTeam(dir) {
  const other = selectedTeams[1 - activeSide];
  let i = TEAMS.indexOf(selectedTeams[activeSide]);
  do { i = (i + dir + TEAMS.length) % TEAMS.length; } while (TEAMS[i] === other);
  selectedTeams[activeSide] = TEAMS[i];
  renderVsStage();
}

function randomTeam() {
  const other = selectedTeams[1 - activeSide];
  let pick;
  do { pick = TEAMS[Math.floor(Math.random() * TEAMS.length)]; } while (pick === other);
  selectedTeams[activeSide] = pick;
  renderVsStage();
}

function initUI() {
  document.getElementById('play-btn').addEventListener('click', () => {
    document.getElementById('menu').classList.add('hidden');
    document.getElementById('team-select').classList.remove('hidden');
    currentState = State.TEAM_SELECT;
    activeSide = 0;
    renderVsStage();
  });

  document.querySelectorAll('.vs-tab').forEach(b =>
    b.addEventListener('click', () => setActiveSide(Number(b.dataset.side))));
  document.getElementById('vs-panel-0').addEventListener('click', () => setActiveSide(0));
  document.getElementById('vs-panel-1').addEventListener('click', () => setActiveSide(1));
  document.getElementById('vs-up').addEventListener('click', () => cycleTeam(-1));
  document.getElementById('vs-down').addEventListener('click', () => cycleTeam(1));
  document.getElementById('vs-random').addEventListener('click', randomTeam);

  // Keyboard: ↑/↓ cycles the active side while team-select is open
  window.addEventListener('keydown', e => {
    if (currentState !== State.TEAM_SELECT) return;
    if (e.code === 'ArrowUp')   { e.preventDefault(); cycleTeam(-1); }
    if (e.code === 'ArrowDown') { e.preventDefault(); cycleTeam(1); }
  });

  // Mouse wheel over the stage cycles too — throttled so one scroll gesture
  // (esp. trackpads, which fire many small deltaY events) moves one team at a time
  let wheelCd = 0;
  document.getElementById('vs-stage').addEventListener('wheel', e => {
    e.preventDefault();
    const now = performance.now();
    if (now < wheelCd) return;
    wheelCd = now + 150;
    cycleTeam(e.deltaY > 0 ? 1 : -1);
  }, { passive: false });

  // Touch swipe: swipe up = next team, swipe down = previous (whichever side you touched)
  let touchY = null, touchSide = null;
  const stage = document.getElementById('vs-stage');
  stage.addEventListener('touchstart', e => {
    touchY = e.touches[0].clientY;
    touchSide = e.target.closest('.vs-panel')?.id === 'vs-panel-1' ? 1 : 0;
  }, { passive: true });
  stage.addEventListener('touchend', e => {
    if (touchY === null) return;
    const dy = e.changedTouches[0].clientY - touchY;
    if (Math.abs(dy) > 30) {
      setActiveSide(touchSide);
      cycleTeam(dy < 0 ? 1 : -1);
    }
    touchY = null;
  });

  // Difficulty picker — highlights the saved choice, persists via localStorage
  const diffBtns = document.querySelectorAll('.diff-btn');
  const markDiff = () => diffBtns.forEach(b =>
    b.classList.toggle('selected', b.dataset.diff === getDifficulty().key));
  diffBtns.forEach(b => b.addEventListener('click', () => { setDifficulty(b.dataset.diff); markDiff(); }));
  markDiff();

  document.getElementById('start-game-btn').addEventListener('click', () => {
    if (!selectedTeams[0] || !selectedTeams[1]) return;
    startGame();
  });

  document.getElementById('back-btn').addEventListener('click', () => {
    document.getElementById('team-select').classList.add('hidden');
    document.getElementById('menu').classList.remove('hidden');
    currentState = State.MENU;
  });

  // Match summary → back to the main menu
  document.getElementById('summary-continue-btn').addEventListener('click', () => {
    document.getElementById('summary-screen').classList.add('hidden');
    document.getElementById('menu').classList.remove('hidden');
    currentState = State.MENU;
  });
}

function startGame() {
  unlockAudio();           // user gesture — start the audio context
  sfx.startCrowd();
  document.getElementById('team-select').classList.add('hidden');
  document.getElementById('hud').style.display = 'block';
  currentState = State.GAME;
  buildGame(selectedTeams[0], selectedTeams[1]);
  updateHUD(gameState, 0);
}

// ── Settings menu ──────────────────────────────────────────
function codeLabel(code) {
  if (!code) return '—';
  const map = {
    ShiftLeft: 'L-Shift', ShiftRight: 'R-Shift', ControlLeft: 'L-Ctrl', ControlRight: 'R-Ctrl',
    AltLeft: 'L-Alt', AltRight: 'R-Alt', Space: 'Space', Enter: 'Enter', Tab: 'Tab', Escape: 'Esc',
    ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→',
    Mouse0: 'L-Click', Mouse1: 'M-Click', Mouse2: 'R-Click',
  };
  if (map[code]) return map[code];
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  if (code.startsWith('Mouse')) return 'Mouse ' + code.slice(5);
  return code;
}

let captureCancel = null;
let settingsReturn = 'menu';   // where the settings BACK button returns to
function buildKeybindRows() {
  const list = document.getElementById('keybind-list');
  list.innerHTML = '';
  const binds = getBindings();
  for (const [action, label] of ACTIONS) {
    const row = document.createElement('div'); row.className = 'keybind-row';
    const name = document.createElement('span'); name.className = 'kb-name'; name.textContent = label;
    const btn = document.createElement('button'); btn.className = 'kb-btn'; btn.textContent = codeLabel(binds[action]);
    btn.addEventListener('click', () => {
      if (captureCancel) captureCancel();           // cancel any other in-progress rebind
      btn.classList.add('listening'); btn.textContent = 'PRESS…';
      captureCancel = captureNext(code => {
        captureCancel = null; btn.classList.remove('listening');
        if (code === 'Escape') { btn.textContent = codeLabel(getBindings()[action]); return; }
        setBinding(action, code);
        btn.textContent = codeLabel(code);
      });
    });
    row.append(name, btn); list.appendChild(row);
  }
}

function initSettings() {
  const slider = document.getElementById('fov-slider');
  const val = document.getElementById('fov-val');
  slider.value = userFov; val.textContent = userFov;
  slider.addEventListener('input', () => {
    userFov = parseInt(slider.value, 10);
    val.textContent = userFov;
    camera.fov = userFov; camera.updateProjectionMatrix();
    try { localStorage.setItem('hitz_fov', userFov); } catch {}
  });
  // Volume + mute
  const vol = document.getElementById('vol-slider');
  const volVal = document.getElementById('vol-val');
  const mute = document.getElementById('mute-toggle');
  vol.value = Math.round(getVolume() * 100); volVal.textContent = vol.value;
  mute.checked = isMuted();
  vol.addEventListener('input', () => {
    volVal.textContent = vol.value;
    setVolume(parseInt(vol.value, 10) / 100);
    if (mute.checked) { mute.checked = false; setMuted(false); }
  });
  mute.addEventListener('change', () => setMuted(mute.checked));

  document.getElementById('reset-binds-btn').addEventListener('click', () => { resetBindings(); buildKeybindRows(); });
  document.getElementById('settings-btn').addEventListener('click', () => {
    settingsReturn = 'menu';
    document.getElementById('menu').classList.add('hidden');
    document.getElementById('settings').classList.remove('hidden');
    buildKeybindRows();
  });
  document.getElementById('settings-back-btn').addEventListener('click', () => {
    if (captureCancel) { captureCancel(); captureCancel = null; }
    document.getElementById('settings').classList.add('hidden');
    document.getElementById(settingsReturn === 'pause' ? 'pause' : 'menu').classList.remove('hidden');
  });
}

// ── Pause ──────────────────────────────────────────────────
function setPaused(p) {
  if (currentState !== State.GAME) return;
  paused = p;
  document.getElementById('pause').classList.toggle('hidden', !p);
}
function quitToMenu() {
  if (p1Ring) p1Ring.visible = false;
  if (goalLamp) goalLamp.intensity = 0;
  celly.timer = 0; celly.scorer = null;
  sfx.stopCrowd();
  paused = false; gameRunning = false; currentState = State.MENU;
  document.getElementById('pause').classList.add('hidden');
  document.getElementById('hud').style.display = 'none';
  document.getElementById('menu').classList.remove('hidden');
}
function initPause() {
  window.addEventListener('keydown', e => {
    if (e.code !== 'Escape') return;
    const settingsOpen = !document.getElementById('settings').classList.contains('hidden');
    if (currentState === State.GAME && !settingsOpen) setPaused(!paused);
  });
  document.getElementById('resume-btn').addEventListener('click', () => setPaused(false));
  document.getElementById('quit-btn').addEventListener('click', quitToMenu);
  document.getElementById('pause-settings-btn').addEventListener('click', () => {
    settingsReturn = 'pause';
    document.getElementById('pause').classList.add('hidden');
    document.getElementById('settings').classList.remove('hidden');
    buildKeybindRows();
  });
}

// ── Agent debug harness — ONLY active with ?debug in the URL ──
// Drives the sim synchronously (headless/hidden tabs freeze RAF, so live-loop
// tests are unreliable). Usage: .claude/skills/run-hitz/SKILL.md
if (new URLSearchParams(location.search).has('debug')) {
  window.__hitz = {
    get state()   { return currentState; },
    get game()    { return gameState; },
    get players() { return players; },
    get goalies() { return goalies; },
    get puck()    { return puck; },
    get faceoff() { return faceoffTimer; },
    set faceoff(v){ faceoffTimer = v; },
    // goalCooldown only counts down in the live loop — clear it between tick() reps
    get cooldown() { return goalCooldown; },
    set cooldown(v){ goalCooldown = v; },
    // Skip menus: boot straight into a game (default COL vs DET)
    startQuick(i = 8, j = 10) {
      selectedTeams = [TEAMS[i], TEAMS[j]];
      document.getElementById('menu').classList.add('hidden');   // startGame() doesn't hide it
      startGame();
      faceoffTimer = 0; goalCooldown = 0;
      document.getElementById('faceoff-banner').classList.remove('show');
    },
    // One synchronous sim step — AI, reception, collisions, puck, goalies, goals.
    // render=false: hundreds of synchronous WebGL renders in one eval kill the tab.
    tick(dt = 1 / 60, render = false) {
      const t1 = [players[0], players[1]], t2 = [players[2], players[3]];
      aiControllers[0].update(puck, t1, t2, dt);
      aiControllers[1].update(puck, t2, t1, dt);
      aiControllers[2].update(puck, t2, t1, dt);
      resolvePuckReception();
      resolveCollisions();
      puck.update(dt);
      goalies.forEach(g => g.update(puck, dt));
      if (!puck.owner) goalies.forEach(g => { if (!g.trySave(puck)) g.bodyBlock(puck); });
      if (goalCooldown <= 0) checkGoal();
      if (render) renderer.render(scene, camera);
    },
  };
}

// ── Boot ───────────────────────────────────────────────────
buildArena(scene, renderer);
initHUD();
initUI();
initSettings();
initPause();
loop();
