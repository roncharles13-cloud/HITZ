import { Matrix4, Vector3 } from 'three';
import { smoothingAlpha } from '../math/ScalarUtils.js';
import { toUnitVec3, toVec3 } from '../math/Vector3Utils.js';
import { DEFAULT_WORLD_BASIS } from '../math/WorldBasis.js';

const EPS = 1e-12;

export const CAMERA_ROTATION_MODES = Object.freeze({
  lookAt: 'lookAt',
  frame: 'frame',
});

export const CAMERA_HEIGHT_SOURCES = Object.freeze({
  frameUp: 'frameUp',
  basisUp: 'basisUp',
});

export class BaseCameraRig {
  constructor({
    rotationMode = CAMERA_ROTATION_MODES.lookAt,
    basis = DEFAULT_WORLD_BASIS,
  }) {
    this.basis = basis;
    this.rotationMode = rotationMode;
    this.position = new Vector3();
    this.lookAt = this.basis.forwardVector();
    this.forward = this.basis.forwardVector();
    this.right = this.basis.rightVector();
    this.up = this.basis.upVector();
    this.initialized = false;

    // Preallocated scratch — step() runs every frame; nothing below may allocate
    this._basisF = this.basis.forwardVector();
    this._basisR = this.basis.rightVector();
    this._basisU = this.basis.upVector();
    this._frame  = { forward: new Vector3(), right: new Vector3(), up: new Vector3(), back: new Vector3() };
    this._pose   = { position: new Vector3(), lookAt: new Vector3(), forward: new Vector3(), right: new Vector3(), up: new Vector3() };
    this._tmp    = new Vector3();
    this._mtx    = new Matrix4();
  }

  // Set `out` from a maybe-partial vector-like, per-axis fallback, normalized —
  // allocation-free equivalent of toUnitVec3(value, fallback)
  _setUnit(out, value, fallback) {
    out.set(value?.x ?? fallback.x, value?.y ?? fallback.y, value?.z ?? fallback.z);
    if (out.lengthSq() <= EPS) out.copy(fallback);
    return out.normalize();
  }

  setState({
    position = null,
    lookAt = null,
    forward = null,
    right = null,
    up = null,
    rotationMode = this.rotationMode,
  }) {
    if (position) this.position.copy(toVec3(position, this.position));
    if (lookAt) this.lookAt.copy(toVec3(lookAt, this.lookAt));
    if (forward) this.forward.copy(toUnitVec3(forward, this.forward));
    if (right) this.right.copy(toUnitVec3(right, this.right));
    if (up) this.up.copy(toUnitVec3(up, this.up));
    this.rotationMode = rotationMode;
    this.initialized = true;
    return this;
  }

  // NOTE: returns a REUSED object (per-frame hot path) — copy if you keep it
  getPose() {
    const p = this._pose;
    p.position.copy(this.position);
    p.lookAt.copy(this.lookAt);
    p.forward.copy(this.forward);
    p.right.copy(this.right);
    p.up.copy(this.up);
    return p;
  }

  applyToCamera(camera, pose = this.getPose()) {
    if (!camera) return;

    camera.position.copy(pose.position);
    camera.up.copy(pose.up);

    if (this.rotationMode === CAMERA_ROTATION_MODES.frame) {
      const matrix = this._mtx.makeBasis(
        pose.right,
        pose.up,
        this._tmp.copy(pose.forward).negate()
      );
      camera.quaternion.setFromRotationMatrix(matrix);
    } else {
      camera.lookAt(pose.lookAt);
    }
  }

  // NOTE: returns a REUSED frame object (per-frame hot path) — treat as read-only
  resolveTargetFrame(targetFrame) {
    const f = this._frame;
    this._setUnit(f.forward, targetFrame && targetFrame.forward, this._basisF);
    this._setUnit(f.up,      targetFrame && targetFrame.up,      this._basisU);
    // fallback right = forward × up (basis right if degenerate), overridden by an explicit right
    this._tmp.crossVectors(f.forward, f.up);
    if (this._tmp.lengthSq() <= EPS) this._tmp.copy(this._basisR);
    this._setUnit(f.right, targetFrame && targetFrame.right, this._tmp);
    f.back.copy(f.forward).negate();
    return f;
  }

  vectorFromSource(source, frame) {
    return source === CAMERA_HEIGHT_SOURCES.basisUp ? this._basisU : frame.up;
  }

  smoothVector(current, target, lag, deltaSeconds, snapToTarget = false) {
    if (snapToTarget || !this.initialized || lag <= 0) {
      current.copy(target);
      return current;
    }
    return current.lerp(target, smoothingAlpha(lag, deltaSeconds));
  }

  setLookAtPose({ position, lookAt, up }) {
    this.position.copy(position);
    this.lookAt.copy(lookAt);
    this._setUnit(this.up, up, this._basisU);
    this.forward.subVectors(this.lookAt, this.position);
    if (this.forward.lengthSq() <= EPS) this.forward.copy(this.basis.forwardVector());
    else this.forward.normalize();
    this.right.crossVectors(this.forward, this.up);
    if (this.right.lengthSq() <= EPS) this.right.copy(this.basis.rightVector());
    else this.right.normalize();
    this.up.crossVectors(this.right, this.forward).normalize();
    this.initialized = true;
  }

  setFramePose({
    position,
    forward,
    right = null,
    up,
  }) {
    this.position.copy(position);
    this._setUnit(this.forward, forward, this._basisF);
    this._setUnit(this.up, up, this._basisU);
    if (right) this._setUnit(this.right, right, this._basisR);
    else this.right.crossVectors(this.forward, this.up);
    if (this.right.lengthSq() <= EPS) this.right.copy(this._basisR);
    else this.right.normalize();
    this.up.crossVectors(this.right, this.forward).normalize();
    this.lookAt.copy(this.position).add(this.forward);
    this.initialized = true;
  }
}
