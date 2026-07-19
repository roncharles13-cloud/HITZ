import * as THREE from 'three';
import { RINK } from './rink.js';

// BREAKAWAY arena, re-authored in HITZ coordinates.
//   world X = length  (±HALF_L = 100),  nets at X = ±GOAL_LINE (89)
//   world Z = width   (±HALF_W = 42.5)
// Shape space (before a -PI/2 X rotation): shape-x → world X (length),
// shape-y → world Z (width), extrude depth → world Y (height).
const HX = RINK.HALF_L;        // 100  length half-extent
const HZ = RINK.HALF_W;        // 42.5 width half-extent
const CR = 18;                 // corner radius
const S  = 3.3;                // BREAKAWAY→HITZ size scale for the superstructure

let iceMat, glassMat;

/* ----------------------------- shapes ----------------------------- */
function roundedRinkShape(hx, hz, r) {
  const s = new THREE.Shape();
  s.moveTo(-hx + r, -hz);
  s.lineTo(hx - r, -hz);  s.quadraticCurveTo(hx, -hz, hx, -hz + r);
  s.lineTo(hx, hz - r);   s.quadraticCurveTo(hx, hz, hx - r, hz);
  s.lineTo(-hx + r, hz);  s.quadraticCurveTo(-hx, hz, -hx, hz - r);
  s.lineTo(-hx, -hz + r); s.quadraticCurveTo(-hx, -hz, -hx + r, -hz);
  return s;
}

// rounded-rink outline sampler in world XZ; inset>0 = inward
function outlineAt(t, inset) {
  const hx = HX, hz = HZ, r = CR, Lx = 2 * (hx - r), Lz = 2 * (hz - r), La = (Math.PI / 2) * r;
  const segs = [
    { len: Lx, f: u => ({ x: -hx + r + Lx * u, z: -hz, nx: 0, nz: -1 }) },
    { len: La, f: u => { const a = -Math.PI / 2 + (Math.PI / 2) * u; return { x: (hx - r) + Math.cos(a) * r, z: (-hz + r) + Math.sin(a) * r, nx: Math.cos(a), nz: Math.sin(a) }; } },
    { len: Lz, f: u => ({ x: hx, z: -hz + r + Lz * u, nx: 1, nz: 0 }) },
    { len: La, f: u => { const a = (Math.PI / 2) * u; return { x: (hx - r) + Math.cos(a) * r, z: (hz - r) + Math.sin(a) * r, nx: Math.cos(a), nz: Math.sin(a) }; } },
    { len: Lx, f: u => ({ x: hx - r - Lx * u, z: hz, nx: 0, nz: 1 }) },
    { len: La, f: u => { const a = Math.PI / 2 + (Math.PI / 2) * u; return { x: (-hx + r) + Math.cos(a) * r, z: (hz - r) + Math.sin(a) * r, nx: Math.cos(a), nz: Math.sin(a) }; } },
    { len: Lz, f: u => ({ x: -hx, z: hz - r - Lz * u, nx: -1, nz: 0 }) },
    { len: La, f: u => { const a = Math.PI + (Math.PI / 2) * u; return { x: (-hx + r) + Math.cos(a) * r, z: (-hz + r) + Math.sin(a) * r, nx: Math.cos(a), nz: Math.sin(a) }; } },
  ];
  const total = segs.reduce((a, b) => a + b.len, 0);
  let d = (((t % 1) + 1) % 1) * total;
  for (const sg of segs) { if (d <= sg.len) { const p = sg.f(d / sg.len); return { x: p.x - p.nx * inset, z: p.z - p.nz * inset, nx: p.nx, nz: p.nz }; } d -= sg.len; }
  const p = segs[0].f(0); return { x: p.x, z: p.z, nx: p.nx, nz: p.nz };
}

/* --------------------------- ice texture -------------------------- */
function hexA(hex, a) { hex = hex.replace('#', ''); const n = parseInt(hex, 16); return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`; }

// Darken/lighten a '#rrggbb' color by amt (-1..1)
function shadeHex(hex, amt) {
  const n = parseInt(hex.replace('#', ''), 16);
  const cl = v => Math.max(0, Math.min(255, v));
  const r = cl((n >> 16) + Math.round(255 * amt));
  const g = cl(((n >> 8) & 0xff) + Math.round(255 * amt));
  const b = cl((n & 0xff) + Math.round(255 * amt));
  return '#' + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
}

// Shield silhouette centered at (0,0) — same crest shape as the team-select
// badge (js/badge.js), just drawn with Canvas 2D instead of SVG.
function shieldPath(x, R) {
  const w = R * 0.86, top = -R * 0.98, corner = -R * 0.78, waist = -R * 0.15, bottom = R * 0.98;
  x.beginPath();
  x.moveTo(0, top);
  x.lineTo(w, corner);
  x.lineTo(w, waist);
  x.bezierCurveTo(w, R * 0.55, w * 0.55, R * 0.85, 0, bottom);
  x.bezierCurveTo(-w * 0.55, R * 0.85, -w, R * 0.55, -w, waist);
  x.lineTo(-w, corner);
  x.closePath();
}

// Center-ice medallion: an original team-crest shield (same design language as
// the team-select badge) ringed in the club's colors — bright + high-contrast
// so it actually reads at the broadcast-camera angle (the old dark logo disc didn't).
function drawCenterLogo(x, team, cx, cy, R) {
  const c = team ? team.colors : { primary: '#2a6cff', secondary: '#8fbaff', accent: '#2a6cff' };
  const abbr = team ? team.abbr : 'HITZ';
  x.save(); x.translate(cx, cy);

  // dark ice-well backdrop + faint team wash, clipped to the circle
  x.beginPath(); x.arc(0, 0, R, 0, Math.PI * 2);
  x.save(); x.clip();
  x.fillStyle = '#0a1420'; x.fillRect(-R, -R, 2 * R, 2 * R);
  const wash = x.createRadialGradient(0, 0, R * 0.1, 0, 0, R);
  wash.addColorStop(0, hexA(c.primary, 0.30)); wash.addColorStop(1, hexA(c.primary, 0.04));
  x.fillStyle = wash; x.fillRect(-R, -R, 2 * R, 2 * R);

  // shield crest, filled with a team-color gradient
  const sR = R * 0.72;
  shieldPath(x, sR);
  const grad = x.createLinearGradient(0, -sR, 0, sR);
  grad.addColorStop(0, shadeHex(c.primary, 0.12)); grad.addColorStop(1, shadeHex(c.primary, -0.28));
  x.fillStyle = grad; x.fill();
  x.lineWidth = sR * 0.045; x.strokeStyle = c.accent || c.secondary; x.stroke();

  // diagonal sash — clipped to the shield so it can never poke outside it
  x.save(); shieldPath(x, sR); x.clip();
  x.fillStyle = hexA(c.secondary, 0.92);
  x.beginPath();
  x.moveTo(-sR * 1.1, -sR * 0.10); x.lineTo(sR * 1.1, -sR * 0.70);
  x.lineTo(sR * 1.1, -sR * 0.40); x.lineTo(-sR * 1.1, sR * 0.20);
  x.closePath(); x.fill();
  x.restore();

  // bold abbreviation lettering, sized down a touch for longer codes
  const fontPx = sR * (abbr.length >= 4 ? 0.48 : abbr.length === 3 ? 0.58 : 0.68);
  x.font = `italic 900 ${fontPx}px Impact, 'Arial Narrow', sans-serif`;
  x.textAlign = 'center'; x.textBaseline = 'middle';
  x.lineWidth = sR * 0.09; x.strokeStyle = '#000'; x.strokeText(abbr, 0, sR * 0.08);
  x.fillStyle = '#fff'; x.fillText(abbr, 0, sR * 0.08);

  x.restore();   // drop circle clip

  // team-color rings
  x.lineWidth = R * 0.1;  x.strokeStyle = hexA(c.primary, 0.95);
  x.beginPath(); x.arc(0, 0, R, 0, Math.PI * 2); x.stroke();
  x.lineWidth = R * 0.035; x.strokeStyle = hexA(c.accent || c.secondary, 0.9);
  x.beginPath(); x.arc(0, 0, R * 0.87, 0, Math.PI * 2); x.stroke();
  x.restore();
}

function makeIceTexture(team) {
  const cw = 2048, ch = Math.round(cw * (2 * HZ) / (2 * HX));   // length × width aspect
  const cv = document.createElement('canvas'); cv.width = cw; cv.height = ch;
  const x = cv.getContext('2d');
  const U = cw / (2 * HX);                                       // px per world unit (both axes equal)
  const xToU = sx => (sx + HX) / (2 * HX) * cw;                  // shape-x (length) → canvas u
  const yToV = sy => (sy + HZ) / (2 * HZ) * ch;                  // shape-y (width)  → canvas v

  // base ice
  const g = x.createLinearGradient(0, 0, cw, 0);
  g.addColorStop(0, '#f5f9ff'); g.addColorStop(.5, '#eaf2ff'); g.addColorStop(1, '#f5f9ff');
  x.fillStyle = g; x.fillRect(0, 0, cw, ch);
  // corner snow
  [[-HX, -HZ], [HX, -HZ], [-HX, HZ], [HX, HZ]].forEach(c => {
    const px = xToU(c[0]), py = yToV(c[1]); const grd = x.createRadialGradient(px, py, 6, px, py, 300);
    grd.addColorStop(0, 'rgba(255,255,255,.5)'); grd.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = grd; x.beginPath(); x.arc(px, py, 300, 0, Math.PI * 2); x.fill();
  });
  // skate sheen
  x.globalAlpha = .05; x.strokeStyle = '#9bb8e0';
  for (let i = 0; i < 220; i++) { const uu = Math.random() * cw; x.beginPath(); x.moveTo(uu, 0); x.lineTo(uu + (Math.random() * 40 - 20), ch); x.lineWidth = Math.random() * 1.8; x.stroke(); }
  x.globalAlpha = 1;

  const RED = '#e51330', BLUE = '#1745da';
  const vline = (sx, col, w) => { x.strokeStyle = col; x.lineWidth = w; const u = xToU(sx); x.beginPath(); x.moveTo(u, 0); x.lineTo(u, ch); x.stroke(); };
  const uc = xToU(0), vc = yToV(0);

  [RINK.GOAL_LINE, -RINK.GOAL_LINE].forEach(sx => vline(sx, RED, 4));       // goal lines
  [20, -20].forEach(sx => vline(sx, BLUE, 18));                              // blue lines
  vline(0, RED, 18);                                                        // center line

  function faceoff(sx, sy, withCircle) {
    const fx = xToU(sx), fy = yToV(sy), R = 15 * U;
    if (withCircle) {
      x.strokeStyle = RED; x.lineWidth = 4; x.beginPath(); x.arc(fx, fy, R, 0, Math.PI * 2); x.stroke();
      x.lineWidth = 5; [-1, 1].forEach(a => [-1, 1].forEach(b => { x.beginPath(); x.moveTo(fx + a * 2 * U, fy + b * R); x.lineTo(fx + a * 2 * U, fy + b * (R + 3 * U)); x.stroke(); }));
    }
    x.fillStyle = RED; x.beginPath(); x.arc(fx, fy, 2.4 * U, 0, Math.PI * 2); x.fill();
    x.fillStyle = '#eaf2ff'; x.beginPath(); x.arc(fx, fy, 1.7 * U, 0, Math.PI * 2); x.fill();
    x.fillStyle = RED; x.fillRect(fx - 1.7 * U, fy - 0.5 * U, 3.4 * U, 1.0 * U);
  }
  // centre circle + dot
  x.strokeStyle = BLUE; x.lineWidth = 4; x.beginPath(); x.arc(uc, vc, 15 * U, 0, Math.PI * 2); x.stroke();
  x.fillStyle = BLUE; x.beginPath(); x.arc(uc, vc, 1.8 * U, 0, Math.PI * 2); x.fill();
  // neutral-zone dots + end-zone circles
  [16, -16].forEach(sx => [23, -23].forEach(sy => faceoff(sx, sy, false)));
  [52, -52].forEach(sx => [23, -23].forEach(sy => faceoff(sx, sy, true)));
  // creases (semicircle in front of each net)
  [RINK.GOAL_LINE, -RINK.GOAL_LINE].forEach((sx, i) => {
    const u = xToU(sx), R = RINK.CREASE_R * U;
    x.fillStyle = 'rgba(120,170,255,.40)'; x.strokeStyle = RED; x.lineWidth = 4;
    x.beginPath(); x.moveTo(u, vc - R); x.arc(u, vc, R, -Math.PI / 2 * (i ? -1 : 1), Math.PI / 2 * (i ? -1 : 1), i === 0);
    x.closePath(); x.fill(); x.stroke();
  });

  drawCenterLogo(x, team, uc, vc, 13 * U);   // sits inside the 15u center circle

  const tex = new THREE.CanvasTexture(cv); tex.anisotropy = 8; tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/* ---------------------------- ad panels --------------------------- */
function makeAdTexture(text, bg, fg) {
  const c = document.createElement('canvas'); c.width = 512; c.height = 128; const x = c.getContext('2d');
  x.fillStyle = bg; x.fillRect(0, 0, 512, 128); x.strokeStyle = fg; x.lineWidth = 8; x.strokeRect(8, 8, 496, 112);
  x.fillStyle = fg; x.font = '900 62px Impact, "Arial Black", sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(text, 256, 70);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
const AD_DATA = [['VOLTAGE', '#0a1c33', '#21c7ff'], ['FROSTBYTE', '#06223a', '#9be8ff'], ['PUCK STOP', '#2a0a06', '#ff7a1a'], ['APEX GEAR', '#101418', '#ffe11a'], ['VENOM', '#0c1f06', '#9bff2e'], ['HITZ COLA', '#2a061a', '#ff2d78'], ['SLAPSHOT', '#0a0f1c', '#cfe0ff'], ['NORTH ICE', '#04161f', '#15e0c0']];

/* -------------------------- seating bowls ------------------------- */
function buildDeck(scene, N, insetA, yA, insetB, yB, cA, cB) {
  const pos = [], col = []; const c0 = new THREE.Color(cA), c1 = new THREE.Color(cB);
  const A = [], B = []; for (let i = 0; i <= N; i++) { A.push(outlineAt(i / N, insetA)); B.push(outlineAt(i / N, insetB)); }
  const pv = (p, y, c) => { pos.push(p.x, y, p.z); col.push(c.r, c.g, c.b); };
  for (let i = 0; i < N; i++) { const a0 = A[i], a1 = A[i + 1], b0 = B[i], b1 = B[i + 1];
    pv(a0, yA, c0); pv(b0, yB, c1); pv(b1, yB, c1); pv(a0, yA, c0); pv(b1, yB, c1); pv(a1, yA, c0); }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .95, side: THREE.DoubleSide }));
  m.receiveShadow = true; scene.add(m);
}

/* -------------------------- molded seats -------------------------- */
function buildSeats(scene) {
  const yLower = inset => (1.5 + (inset + 2 * S) / (-18 * S) * 8.5 * S);
  const yUpper = inset => (10.5 * S + (inset + 21 * S) / (-19 * S) * 10.5 * S);
  const seats = [];
  function addRows(insetNear, insetFar, rows, spacing, yFn) {
    for (let r = 0; r < rows; r++) {
      const u = rows === 1 ? 0 : r / (rows - 1);
      const inset = insetNear + (insetFar - insetNear) * u;
      const y = yFn(inset) + 0.05; const SAMP = 1400; let prev = outlineAt(0, inset), acc = spacing;
      for (let i = 1; i <= SAMP; i++) {
        const p = outlineAt(i / SAMP, inset);
        acc += Math.hypot(p.x - prev.x, p.z - prev.z);
        if (acc >= spacing) { acc = 0; seats.push({ x: p.x, y, z: p.z, yaw: Math.atan2(-p.nx, -p.nz) }); }
        prev = p;
      }
    }
  }
  addRows(-3.5 * S, -18 * S, 5, 1.05 * S, yLower);
  addRows(-22.5 * S, -38 * S, 6, 1.20 * S, yUpper);
  const N = seats.length;
  if (!N) return;

  function roundedRect(w, h, r) { const s = new THREE.Shape(), x = -w / 2;
    s.moveTo(x + r, 0); s.lineTo(x + w - r, 0); s.quadraticCurveTo(x + w, 0, x + w, r);
    s.lineTo(x + w, h - r); s.quadraticCurveTo(x + w, h, x + w - r, h);
    s.lineTo(x + r, h); s.quadraticCurveTo(x, h, x, h - r);
    s.lineTo(x, r); s.quadraticCurveTo(x, 0, x + r, 0); return s; }

  const backGeo = new THREE.ExtrudeGeometry(roundedRect(0.56 * S, 0.60 * S, 0.17 * S), { depth: 0.08 * S, bevelEnabled: false, curveSegments: 3 });
  backGeo.translate(0, 0, -0.04 * S); backGeo.rotateX(-0.17); backGeo.translate(0, 0.40 * S, -0.16 * S);
  const panGeo = new THREE.BoxGeometry(0.54 * S, 0.09 * S, 0.5 * S); panGeo.translate(0, 0.40 * S, 0.12 * S);
  const pedGeo = new THREE.BoxGeometry(0.16 * S, 0.40 * S, 0.18 * S); pedGeo.translate(0, 0.20 * S, -0.06 * S);

  const seatMat = new THREE.MeshStandardMaterial({ roughness: 0.42, metalness: 0.04 });
  const pedMat = new THREE.MeshStandardMaterial({ color: '#0f141c', roughness: 0.75, metalness: 0.25 });
  const back = new THREE.InstancedMesh(backGeo, seatMat, N);
  const pan = new THREE.InstancedMesh(panGeo, seatMat, N);
  const ped = new THREE.InstancedMesh(pedGeo, pedMat, N);
  [back, pan, ped].forEach(m => { m.instanceMatrix.setUsage(THREE.StaticDrawUsage); m.frustumCulled = false; });

  const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), UP = new THREE.Vector3(0, 1, 0), P = new THREE.Vector3(), SZ = new THREE.Vector3(1, 1, 1);
  const base = new THREE.Color('#1f7fe0'), c = new THREE.Color();
  const accents = ['#21c7ff', '#ffffff', '#0b3aa0'];
  for (let i = 0; i < N; i++) { const s = seats[i];
    Q.setFromAxisAngle(UP, s.yaw); P.set(s.x, s.y, s.z); M.compose(P, Q, SZ);
    back.setMatrixAt(i, M); pan.setMatrixAt(i, M); ped.setMatrixAt(i, M);
    if (Math.random() < 0.05) c.set(accents[(Math.random() * accents.length) | 0]);
    else c.copy(base).offsetHSL(0, (Math.random() - 0.5) * 0.05, (Math.random() - 0.5) * 0.13);
    back.setColorAt(i, c); pan.setColorAt(i, c);
  }
  back.instanceColor.needsUpdate = true; pan.instanceColor.needsUpdate = true;
  scene.add(ped, pan, back);
}

/* ----------------------------- goals ------------------------------ */
// Fine white mesh-grid texture for the netting (cached).
let _netTex = null;
function netTexture() {
  if (_netTex) return _netTex;
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const x = c.getContext('2d');
  x.strokeStyle = 'rgba(255,255,255,0.6)'; x.lineWidth = 2;
  for (let i = 0; i <= 128; i += 11) {
    x.beginPath(); x.moveTo(i, 0); x.lineTo(i, 128); x.stroke();
    x.beginPath(); x.moveTo(0, i); x.lineTo(128, i); x.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(3, 2.4);
  _netTex = t; return t;
}
// A frame tube (thin cylinder) spanning points a → b.
function goalTube(scene, a, b, radius, mat) {
  const av = new THREE.Vector3(...a), bv = new THREE.Vector3(...b);
  const dir = new THREE.Vector3().subVectors(bv, av); const len = dir.length();
  const m = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, len, 8), mat);
  m.position.copy(av).addScaledVector(dir, 0.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
  m.castShadow = true; scene.add(m);
}
// A quad netting panel (two triangles) through 4 corners.
function goalPanel(scene, p0, p1, p2, p3, mat) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(
    new Float32Array([...p0, ...p1, ...p2, ...p0, ...p2, ...p3]), 3));
  g.setAttribute('uv', new THREE.BufferAttribute(
    new Float32Array([0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1]), 2));
  g.computeVertexNormals();
  scene.add(new THREE.Mesh(g, mat));
}

function buildGoals(scene) {
  const gw = RINK.GOAL_W, gd = RINK.GOAL_D, gh = 4;   // 8 wide × 4 tall × 4 deep
  const zf = gw / 2, zb = gw / 2 - 0.7;               // pocket tapers in at the back
  const R = 0.14;
  const frameMat = new THREE.MeshStandardMaterial({ color: '#e5241d', roughness: 0.35, metalness: 0.3 });
  const netMat = new THREE.MeshBasicMaterial({
    map: netTexture(), color: 0xffffff, transparent: true, opacity: 0.92,
    side: THREE.DoubleSide, depthWrite: false,
  });
  [1, -1].forEach(dir => {
    const fx = dir * RINK.GOAL_LINE;   // mouth / goal-line plane
    const bx = fx + dir * gd;          // back plane (toward the end boards)
    const tx = fx + dir * gd * 0.5;    // back-top pipe is set in
    const th = gh * 0.72;              // ...and lower than the crossbar
    // corner points: F=front B=back, T=top B=bottom, L=+z R=-z
    const FTL = [fx, gh, zf],  FTR = [fx, gh, -zf];
    const FBL = [fx, 0,  zf],  FBR = [fx, 0,  -zf];
    const BTL = [tx, th, zb],  BTR = [tx, th, -zb];
    const BBL = [bx, 0.05, zb], BBR = [bx, 0.05, -zb];
    // ── red frame: front hoop + angled back cage ──
    goalTube(scene, FBL, FTL, R, frameMat);          // left post
    goalTube(scene, FBR, FTR, R, frameMat);          // right post
    goalTube(scene, FTL, FTR, R, frameMat);          // crossbar
    goalTube(scene, FTL, BTL, R * 0.8, frameMat);    // top struts back
    goalTube(scene, FTR, BTR, R * 0.8, frameMat);
    goalTube(scene, BTL, BTR, R * 0.8, frameMat);    // back-top pipe
    goalTube(scene, BTL, BBL, R * 0.8, frameMat);    // back verticals
    goalTube(scene, BTR, BBR, R * 0.8, frameMat);
    goalTube(scene, BBL, BBR, R * 0.8, frameMat);    // back base pipe
    goalTube(scene, FBL, BBL, R * 0.8, frameMat);    // side base pipes
    goalTube(scene, FBR, BBR, R * 0.8, frameMat);
    // ── white netting draped over the cage ──
    goalPanel(scene, FTL, FTR, BTR, BTL, netMat);    // top
    goalPanel(scene, BTL, BTR, BBR, BBL, netMat);    // back
    goalPanel(scene, FTL, BTL, BBL, FBL, netMat);    // left side
    goalPanel(scene, FTR, BTR, BBR, FBR, netMat);    // right side
    goalPanel(scene, FBL, FBR, BBR, BBL, netMat);    // floor
  });
}

/* ============================== build ============================= */
export function buildArena(scene, renderer) {
  // ---- lighting rig (BREAKAWAY look) ----
  scene.add(new THREE.HemisphereLight('#eaf2ff', '#141d2e', 1.05));
  const key = new THREE.DirectionalLight('#ffffff', 1.85);
  key.position.set(40, 120, 60); key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.near = 10; key.shadow.camera.far = 420;
  key.shadow.camera.left = -120; key.shadow.camera.right = 120;
  key.shadow.camera.top = 70; key.shadow.camera.bottom = -70;
  key.shadow.bias = -0.0004;
  scene.add(key);
  const rim = new THREE.DirectionalLight('#4a8cff', 0.85); rim.position.set(-60, 70, -90); scene.add(rim);
  const accentP = new THREE.PointLight('#21c7ff', 1.2, 320, 0); accentP.position.set(-60, 30, 0); scene.add(accentP);
  const accentO = new THREE.PointLight('#ff7a1a', 1.2, 320, 0); accentO.position.set(60, 30, 0); scene.add(accentO);

  // ---- ice ----
  const iceShape = roundedRinkShape(HX, HZ, CR);
  const iceGeo = new THREE.ShapeGeometry(iceShape, 24);
  const pos = iceGeo.attributes.position, uv = iceGeo.attributes.uv;
  for (let i = 0; i < pos.count; i++) uv.setXY(i, (pos.getX(i) + HX) / (2 * HX), (pos.getY(i) + HZ) / (2 * HZ));
  uv.needsUpdate = true;
  iceMat = new THREE.MeshStandardMaterial({ map: makeIceTexture(null), roughness: 0.05, metalness: 0.12, envMapIntensity: 2.1 });
  const ice = new THREE.Mesh(iceGeo, iceMat);
  ice.rotation.x = -Math.PI / 2; ice.receiveShadow = true; scene.add(ice);

  // ---- dasher boards (wall + kickplate + cap) ----
  const boardShape = roundedRinkShape(HX, HZ, CR);
  boardShape.holes.push(roundedRinkShape(HX - 1.2, HZ - 1.2, CR - 1.0));
  const boards = new THREE.Mesh(new THREE.ExtrudeGeometry(boardShape, { depth: 2.4, bevelEnabled: false, curveSegments: 24 }),
    new THREE.MeshStandardMaterial({ color: '#eef3fb', roughness: .55 }));
  boards.rotation.x = -Math.PI / 2; boards.receiveShadow = true; scene.add(boards);
  const kick = new THREE.Mesh(new THREE.ExtrudeGeometry(boardShape, { depth: 0.7, bevelEnabled: false, curveSegments: 24 }),
    new THREE.MeshStandardMaterial({ color: '#e23a5e', roughness: .32, metalness: .15 }));
  kick.rotation.x = -Math.PI / 2; scene.add(kick);
  const capShape = roundedRinkShape(HX + 0.2, HZ + 0.2, CR);
  capShape.holes.push(roundedRinkShape(HX - 1.5, HZ - 1.5, CR - 1.0));
  const cap = new THREE.Mesh(new THREE.ExtrudeGeometry(capShape, { depth: 0.35, bevelEnabled: false, curveSegments: 24 }),
    new THREE.MeshStandardMaterial({ color: '#0b1322', roughness: .4, metalness: .5 }));
  cap.rotation.x = -Math.PI / 2; cap.position.y = 2.4; scene.add(cap);

  // ---- sponsor ad panels ----
  const adTex = AD_DATA.map(d => makeAdTexture(d[0], d[1], d[2]));
  const adCount = 72;
  for (let i = 0; i < adCount; i++) {
    const p = outlineAt(i / adCount, 1.0);
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(8.0, 1.5), new THREE.MeshBasicMaterial({ map: adTex[i % adTex.length] }));
    mesh.position.set(p.x, 1.4, p.z); mesh.rotation.y = Math.atan2(-p.nx, -p.nz); scene.add(mesh);
  }

  // ---- protective glass + top frame ----
  const glassShape = roundedRinkShape(HX, HZ, CR);
  glassShape.holes.push(roundedRinkShape(HX - 0.4, HZ - 0.4, CR - 0.3));
  glassMat = new THREE.MeshStandardMaterial({ color: '#bcd9ff', transparent: true, opacity: .13, roughness: .02, metalness: 0.0, envMapIntensity: 1.4, side: THREE.DoubleSide });
  const glass = new THREE.Mesh(new THREE.ExtrudeGeometry(glassShape, { depth: 5.5, bevelEnabled: false, curveSegments: 24 }), glassMat);
  glass.rotation.x = -Math.PI / 2; glass.position.y = 2.4; scene.add(glass);
  const frameShape = roundedRinkShape(HX + 0.15, HZ + 0.15, CR);
  frameShape.holes.push(roundedRinkShape(HX - 0.5, HZ - 0.5, CR - 0.3));
  const frame = new THREE.Mesh(new THREE.ExtrudeGeometry(frameShape, { depth: 0.35, bevelEnabled: false, curveSegments: 24 }),
    new THREE.MeshStandardMaterial({ color: '#fdd23a', roughness: .35, metalness: .5 }));
  frame.rotation.x = -Math.PI / 2; frame.position.y = 7.9; scene.add(frame);

  // ---- enclosing arena shell + ceiling + beams ----
  const shellR = 260, shellH = 240;
  const shell = new THREE.Mesh(new THREE.CylinderGeometry(shellR, shellR, shellH, 48, 1, true),
    new THREE.MeshStandardMaterial({ color: '#070b14', roughness: 1, side: THREE.BackSide }));
  shell.position.y = 66; scene.add(shell);
  const ceiling = new THREE.Mesh(new THREE.CircleGeometry(shellR, 48), new THREE.MeshStandardMaterial({ color: '#05070d', roughness: 1 }));
  ceiling.rotation.x = Math.PI / 2; ceiling.position.y = 112; scene.add(ceiling);
  const concrete = new THREE.Mesh(new THREE.CircleGeometry(shellR, 48), new THREE.MeshStandardMaterial({ color: '#0a0e16', roughness: 1 }));
  concrete.rotation.x = -Math.PI / 2; concrete.position.y = -0.2; scene.add(concrete);
  const beamMat = new THREE.MeshStandardMaterial({ color: '#10151f', roughness: .7, metalness: .5 });
  for (let i = -2; i <= 2; i++) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(360, 2, 2), beamMat); b.position.set(0, 104, i * 40); scene.add(b);
    const b2 = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 500), beamMat); b2.position.set(i * 30, 105, 0); scene.add(b2);
  }

  // ---- tiered seating bowls + framing walls ----
  buildDeck(scene, 160, -2 * S, 1.5, -20 * S, 10 * S, '#0c1628', '#1a2740');     // lower bowl
  buildDeck(scene, 160, -21 * S, 10.5 * S, -40 * S, 21 * S, '#0a1322', '#13203a'); // upper bowl
  buildDeck(scene, 160, -20.5 * S, 9.4 * S, -20.5 * S, 10.8 * S, '#0a1830', '#16294a'); // ribbon band
  buildDeck(scene, 160, -40 * S, 20.0 * S, -40 * S, 27.5 * S, '#070b14', '#0c1422');    // fascia wall
  buildSeats(scene);

  // ---- goals ----
  buildGoals(scene);

  // ---- env reflection probe (glossy ice + glass) ----
  const cubeRT = new THREE.WebGLCubeRenderTarget(256, { generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter });
  const cubeCam = new THREE.CubeCamera(1, 800, cubeRT); cubeCam.position.set(0, 12, 0); scene.add(cubeCam);
  cubeCam.update(renderer, scene);
  iceMat.envMap = cubeRT.texture; glassMat.envMap = cubeRT.texture;
  iceMat.needsUpdate = true; glassMat.needsUpdate = true;
}

// Swap center-ice logo + colors to the home team
export function setIceForTeam(team) {
  if (!iceMat) return;
  const old = iceMat.map; iceMat.map = makeIceTexture(team); iceMat.needsUpdate = true; if (old) old.dispose();
}
