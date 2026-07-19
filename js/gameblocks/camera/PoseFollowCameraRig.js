import { Vector3 } from 'three';
import { BaseCameraRig, CAMERA_HEIGHT_SOURCES, CAMERA_ROTATION_MODES } from './BaseCameraRig.js';
import { DEFAULT_WORLD_BASIS } from '../math/WorldBasis.js';

export class PoseFollowCameraRig extends BaseCameraRig {
  constructor({
    cameraOffset,
    lookAtOffset = { forward: 1, up: 0, right: 0 },
    speedCameraOffset = { forward: 0, up: 0, right: 0 },
    speedLookAtOffset = { forward: 0, up: 0, right: 0 },
    heightVectorSource = CAMERA_HEIGHT_SOURCES.frameUp,
    lookHeightVectorSource = CAMERA_HEIGHT_SOURCES.frameUp,
    positionLag = 0,
    lookLag = 0,
    frameLag = 0,
    rotationMode = CAMERA_ROTATION_MODES.lookAt,
    basis = DEFAULT_WORLD_BASIS,
  }) {
    super({ basis, rotationMode });
    Object.assign(this, {
      cameraOffset,
      lookAtOffset,
      speedCameraOffset,
      speedLookAtOffset,
      heightVectorSource,
      lookHeightVectorSource,
      positionLag,
      lookLag,
      frameLag,
    });
    // Preallocated scratch — step() runs every frame; no allocations allowed
    this._focus   = new Vector3();
    this._desPos  = new Vector3();
    this._desLook = new Vector3();
    this._camOff  = { forward: 0, up: 0, right: 0 };
    this._lookOff = { forward: 0, up: 0, right: 0 };
  }

  step({
    targetPosition,
    targetFrame,
    targetSpeed = 0,
    snapToTarget = false,
    deltaSeconds = 1 / 60,
    camera = null,
  }) {
    const frame = this.resolveTargetFrame(targetFrame);
    const focusPosition = this._focus.set(
      targetPosition?.x ?? 0, targetPosition?.y ?? 0, targetPosition?.z ?? 0);
    const speed = Math.max(0, targetSpeed ?? 0);
    const heightVector = this.vectorFromSource(this.heightVectorSource, frame);
    const lookHeightVector = this.vectorFromSource(this.lookHeightVectorSource, frame);

    const cameraOffset = this.offsetForSpeed(this.cameraOffset, this.speedCameraOffset, speed, this._camOff);
    const lookAtOffset = this.offsetForSpeed(this.lookAtOffset, this.speedLookAtOffset, speed, this._lookOff);

    const desiredPosition = this._desPos.copy(focusPosition)
      .addScaledVector(frame.forward, cameraOffset.forward)
      .addScaledVector(frame.right, cameraOffset.right)
      .addScaledVector(heightVector, cameraOffset.up);
    const desiredLookAt = this._desLook.copy(focusPosition)
      .addScaledVector(frame.forward, lookAtOffset.forward)
      .addScaledVector(frame.right, lookAtOffset.right)
      .addScaledVector(lookHeightVector, lookAtOffset.up);

    this.smoothVector(this.position, desiredPosition, this.positionLag, deltaSeconds, snapToTarget);
    this.smoothVector(this.lookAt, desiredLookAt, this.lookLag, deltaSeconds, snapToTarget);

    // smoothVector reads its target without mutating — the scratch frame is safe to pass
    this.smoothVector(this.forward, frame.forward, this.frameLag, deltaSeconds, snapToTarget).normalize();
    this.smoothVector(this.up, frame.up, this.frameLag, deltaSeconds, snapToTarget).normalize();

    if (this.rotationMode === CAMERA_ROTATION_MODES.frame) {
      this.setFramePose({
        position: this.position,
        forward: this.forward,
        up: this.up,
      });
    } else if(this.rotationMode == CAMERA_ROTATION_MODES.lookAt) {
      this.setLookAtPose({
        position: this.position,
        lookAt: this.lookAt,
        up: frame.up,
      });
    }

    const pose = this.getPose();
    this.applyToCamera(camera, pose);
    return pose;
  }

  offsetForSpeed(offset, speedOffset, speed, out = {}) {
    out.forward = offset.forward + speedOffset.forward * speed;
    out.up      = offset.up      + speedOffset.up      * speed;
    out.right   = offset.right   + speedOffset.right   * speed;
    return out;
  }
}
