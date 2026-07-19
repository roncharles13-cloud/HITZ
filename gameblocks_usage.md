# GameBlocks Usage — HITZ

Record of GameBlocks modules pulled into the HITZ (NHL Hitz 2003 remake) codebase.

## Selected modules

Copied into `js/gameblocks/` with directory structure preserved so the modules'
relative imports (`./`, `../math/`) resolve unchanged.

| Module | Location in HITZ | Status | Purpose |
|---|---|---|---|
| `camera/PoseFollowCameraRig.js` | `js/gameblocks/camera/PoseFollowCameraRig.js` | Reused as-is | Pose-relative follow camera with speed-scaled offsets and framerate-independent smoothing. |
| `camera/BaseCameraRig.js` | `js/gameblocks/camera/BaseCameraRig.js` | Reused as-is | Base smoothing + basis-aware pose/lookAt math the rig extends. |
| `math/WorldBasis.js` | `js/gameblocks/math/WorldBasis.js` | Reused as-is | Coordinate basis source of truth; used to define the fixed broadcast frame. |
| `math/Vector3Utils.js` | `js/gameblocks/math/Vector3Utils.js` | Reused as-is | Safe Vector3 coercion (rig dependency). |
| `math/ScalarUtils.js` | `js/gameblocks/math/ScalarUtils.js` | Reused as-is | `smoothingAlpha` exponential smoothing (rig dependency). |

Dependency note: the modules `import ... from 'three'` (bare specifier). HITZ's
`index.html` importmap already maps `three` → three@0.160.0 (unpkg), so no
importmap change was needed. GameBlocks targets 0.161; the APIs used
(`Vector3`, `Matrix4`, `Quaternion`, `MathUtils`) are stable across 0.160–0.161.

## Integration — broadcast camera (`js/camera.js`)

`js/camera.js` was rewritten to back the existing `HitzCamera` class with
`PoseFollowCameraRig`. **Public API is unchanged** — `new HitzCamera(camera)` and
`hitzCam.update(puck, players, dt)` — so `js/main.js` was not touched.

**Adaptation approach.** HITZ's broadcast cam is deliberately fixed-orientation
(the human team always attacks +X; the picture never spins with play, for
readability). So the rig is driven with a **constant broadcast frame**
(`forward +X`, `up +Y`, `right +Z`, via a custom `WorldBasis({ right:'+z', up:'+y', forward:'+x' })`)
and HITZ's puck tracking is expressed as the rig's focus point + offsets:

- Camera offset: `{ forward: -56, up: 36 }` (behind + above the puck).
- LookAt offset: `{ forward: +22, up: 2 }`, with lateral aim slide applied per
  frame via `rig.lookAtOffset.right`.
- Original clamps (camera X floor at −96, sideways tracking fraction `SIDE_TRACK`
  0.32 / `LOOK_SIDE` 0.45) preserved.

**New capabilities gained from the rig:**

1. **Framerate-independent smoothing** — the old `k = min(1, LAG*dt)` linear lerp
   is replaced by the rig's exponential `smoothingAlpha(lag, dt)` (lag ≈ 0.27s,
   tuned to match the previous 60fps feel). Smoother at any/variable FPS.
2. **Speed-reactive dolly** — `speedCameraOffset { forward: -14, up: 6 }` scales
   with a 0..1 factor derived from the puck's planar velocity (`puck.vel`,
   ref 60 u/s), so the camera eases back and lifts on breakaways / hard shots and
   settles when play slows. The speed factor is itself damped (`MathUtils.damp`).

## Verification

Loaded via the `.claude/launch.json` preview server (`npx serve`, port 5200) in a
real browser through Playwright: menu → team select (BOS vs BUF) → live faceoff.
Broadcast framing renders correctly (behind the play, looking down-ice), arena /
rink / HUD intact, **0 console errors** at every stage.
