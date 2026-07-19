import * as THREE from 'three';

// NHL rink: 200 x 85 units. Origin = center ice.
export const RINK = {
  W: 85,   // width  (left-right)
  L: 156,  // length (behind both nets) — shortened from 200 so the rink reads less long
  HALF_W: 42.5,
  HALF_L: 78,
  BLUE_LINE: 58,   // distance from center to blue line
  GOAL_LINE: 70,   // distance from center to goal line
  GOAL_W: 8,   // net mouth width — wider than a real net so the goalie can't cover it all
  GOAL_D: 4,
  CREASE_R: 6,
  BOARD_H: 1.2,
  BOARD_T: 0.8,
  CORNER_R: 15,    // corner radius (approx)
};

export function buildRink(scene) {
  // Ice surface
  const iceGeo = new THREE.PlaneGeometry(RINK.W, RINK.L);
  const iceMat = new THREE.MeshLambertMaterial({
    color: 0xd8eeff,
    emissive: 0x112233,
    emissiveIntensity: 0.1,
  });
  const ice = new THREE.Mesh(iceGeo, iceMat);
  ice.rotation.x = -Math.PI / 2;
  ice.receiveShadow = true;
  scene.add(ice);

  // Boards (4 sides)
  const boardMat = new THREE.MeshLambertMaterial({ color: 0xffffff });
  const boards = [
    // long sides
    { w: RINK.L, h: RINK.BOARD_H, d: RINK.BOARD_T, x: 0, z: RINK.HALF_W },
    { w: RINK.L, h: RINK.BOARD_H, d: RINK.BOARD_T, x: 0, z: -RINK.HALF_W },
    // end boards
    { w: RINK.BOARD_T, h: RINK.BOARD_H, d: RINK.W, x: RINK.HALF_L, z: 0 },
    { w: RINK.BOARD_T, h: RINK.BOARD_H, d: RINK.W, x: -RINK.HALF_L, z: 0 },
  ];
  boards.forEach(b => {
    const g = new THREE.BoxGeometry(b.w, b.h, b.d);
    const m = new THREE.Mesh(g, boardMat);
    m.position.set(b.x, RINK.BOARD_H / 2, b.z);
    scene.add(m);
  });

  // Red center line
  addLine(scene, 0, 0.02, 0, RINK.W, 0.08, 0xff2222, true);

  // Blue lines
  addLine(scene, RINK.BLUE_LINE,  0.02, 0, RINK.W, 0.3, 0x4466ff, true);
  addLine(scene, -RINK.BLUE_LINE, 0.02, 0, RINK.W, 0.3, 0x4466ff, true);

  // Goal lines (red)
  addLine(scene, RINK.GOAL_LINE,  0.02, 0, RINK.W, 0.08, 0xff2222, true);
  addLine(scene, -RINK.GOAL_LINE, 0.02, 0, RINK.W, 0.08, 0xff2222, true);

  // Center circle
  addCircle(scene, 0, 0.02, 0, 15, 0.1, 0xff2222);
  addCircleFill(scene, 0, 0.015, 0, 2, 0xff2222);  // center dot

  // Face-off circles (4)
  const foR = 15, foY = 0.02;
  [
    [RINK.BLUE_LINE - 20,  22], [RINK.BLUE_LINE - 20, -22],
    [-RINK.BLUE_LINE + 20, 22], [-RINK.BLUE_LINE + 20, -22],
  ].forEach(([x, z]) => addCircle(scene, x, foY, z, foR, 0.1, 0xff2222));

  // Goal creases
  addCrease(scene,  RINK.GOAL_LINE, 1);
  addCrease(scene, -RINK.GOAL_LINE, -1);

  // Goals
  addGoal(scene,  RINK.GOAL_LINE + RINK.GOAL_D / 2, 0,  1);
  addGoal(scene, -RINK.GOAL_LINE - RINK.GOAL_D / 2, 0, -1);

  // Arena lighting — one shadow-casting key light + cheap fills.
  // (Was 5 lights / 4 shadow passes per frame; now 3 lights / 1 shadow pass.)
  scene.add(new THREE.HemisphereLight(0xffffff, 0x3a3a44, 0.9));

  const key = new THREE.DirectionalLight(0xffffff, 0.85);
  key.position.set(40, 90, 40);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  const sc = key.shadow.camera;
  sc.left = -110; sc.right = 110; sc.top = 60; sc.bottom = -60;
  sc.near = 10;   sc.far = 230;
  key.shadow.bias = -0.0005;
  scene.add(key);

  // Opposite-side fill, no shadow — softens contrast cheaply
  const fill = new THREE.DirectionalLight(0xffffff, 0.35);
  fill.position.set(-50, 60, -30);
  scene.add(fill);

  // Stands (simple dark box around rink)
  addStands(scene);

  // Center ice logo
  addCenterLogo(scene);
}

function addLine(scene, x, y, z, width, depth, color, acrossZ) {
  const geo = acrossZ
    ? new THREE.BoxGeometry(depth, 0.01, width)
    : new THREE.BoxGeometry(width, 0.01, depth);
  const mat = new THREE.MeshBasicMaterial({ color });
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  scene.add(m);
}

function addCircle(scene, x, y, z, radius, lineW, color) {
  const segs = 64;
  const pts = [];
  for (let i = 0; i <= segs; i++) {
    const a = (i / segs) * Math.PI * 2;
    pts.push(new THREE.Vector3(
      x + Math.cos(a) * radius,
      y,
      z + Math.sin(a) * radius
    ));
  }
  const geo = new THREE.BufferGeometry().setFromPoints(pts);
  const mat = new THREE.LineBasicMaterial({ color, linewidth: 2 });
  scene.add(new THREE.Line(geo, mat));
}

function addCircleFill(scene, x, y, z, r, color) {
  const geo = new THREE.CircleGeometry(r, 32);
  const mat = new THREE.MeshBasicMaterial({ color });
  const m = new THREE.Mesh(geo, mat);
  m.rotation.x = -Math.PI / 2;
  m.position.set(x, y, z);
  scene.add(m);
}

function addCrease(scene, goalX, dir) {
  // Semi-circle in front of goal
  const r = RINK.CREASE_R;
  const geo = new THREE.CircleGeometry(r, 32, 0, Math.PI);
  const mat = new THREE.MeshBasicMaterial({ color: 0xaaccff, transparent: true, opacity: 0.35, side: THREE.DoubleSide });
  const m = new THREE.Mesh(geo, mat);
  m.rotation.x = -Math.PI / 2;
  m.rotation.z = dir > 0 ? 0 : Math.PI;
  m.position.set(goalX - dir * r * 0.5, 0.02, 0);
  scene.add(m);
}

function addGoal(scene, x, z, dir) {
  const gw = RINK.GOAL_W;
  const gd = RINK.GOAL_D;
  const gh = 3;
  const mat = new THREE.MeshLambertMaterial({ color: 0xcccccc });
  const frameMat = new THREE.MeshLambertMaterial({ color: 0xffffff });
  const netMat  = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.18, wireframe: true });

  // Back bar
  const back = new THREE.Mesh(new THREE.BoxGeometry(0.2, gh, gw), frameMat);
  back.position.set(x + dir * gd / 2, gh / 2, z);
  scene.add(back);

  // Posts
  [-gw / 2, gw / 2].forEach(zOff => {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, gh, 8), frameMat);
    post.position.set(x, gh / 2, z + zOff);
    scene.add(post);

    // Crossbar side pieces
    const cb = new THREE.Mesh(new THREE.BoxGeometry(gd + 0.2, 0.2, 0.2), frameMat);
    cb.position.set(x + dir * gd / 2, gh - 0.1, z + zOff);
    scene.add(cb);
  });

  // Crossbar top
  const top = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, gw), frameMat);
  top.position.set(x, gh, z);
  scene.add(top);

  // Net mesh
  const net = new THREE.Mesh(new THREE.BoxGeometry(gd, gh, gw), netMat);
  net.position.set(x + dir * gd / 2, gh / 2, z);
  scene.add(net);
}

function addStands(scene) {
  const mat = new THREE.MeshLambertMaterial({ color: 0x1a1a2e });
  const standH = 20;

  // Long sides
  [[0, RINK.HALF_W + 8], [0, -(RINK.HALF_W + 8)]].forEach(([x, z]) => {
    const g = new THREE.BoxGeometry(RINK.L + 20, standH, 16);
    const m = new THREE.Mesh(g, mat);
    m.position.set(x, standH / 2 - 2, z);
    scene.add(m);
  });

  // Ends
  [[RINK.HALF_L + 8, 0], [-(RINK.HALF_L + 8), 0]].forEach(([x, z]) => {
    const g = new THREE.BoxGeometry(16, standH, RINK.W + 32);
    const m = new THREE.Mesh(g, mat);
    m.position.set(x, standH / 2 - 2, z);
    scene.add(m);
  });
}

function addCenterLogo(scene) {
  // Simple NHL "center circle" decoration — just a bright dot
  const geo = new THREE.CircleGeometry(8, 32);
  const mat = new THREE.MeshBasicMaterial({ color: 0xcc0000, transparent: true, opacity: 0.25 });
  const m = new THREE.Mesh(geo, mat);
  m.rotation.x = -Math.PI / 2;
  m.position.set(0, 0.012, 0);
  scene.add(m);
}
