import {
  Box3,
  Euler,
  type Object3D,
  type PerspectiveCamera,
  Quaternion,
  Vector3,
} from 'three';

import { BREAK_POINTS } from '@/constants/common';
import { WORK_WORLD_CAMERA_FOV } from '@/constants/workThreeD';
import type { SectionFrameConfig } from '@/types/world';

export const getWorkWorldFov = (width: number): number => {
  if (width < BREAK_POINTS.XS) return WORK_WORLD_CAMERA_FOV.XS;
  if (width < BREAK_POINTS.SM) return WORK_WORLD_CAMERA_FOV.SM;
  return WORK_WORLD_CAMERA_FOV.DEFAULT;
};

export const computeModelBoundingBox = (modelChildren: Object3D[]): Box3 => {
  const box = new Box3();
  let hasGeometry = false;

  modelChildren.forEach((child) => {
    child.updateWorldMatrix(true, true);
    const childBox = new Box3().setFromObject(child);
    if (!childBox.isEmpty()) {
      box.union(childBox);
      hasGeometry = true;
    }
  });

  if (!hasGeometry) {
    return new Box3(new Vector3(-1, -1, -1), new Vector3(1, 1, 1));
  }

  return box;
};

export const computeAutoFrameParams = (
  cam: PerspectiveCamera,
  targetCenter: Vector3,
  box: Box3,
  fovDeg: number,
  canvasWidth: number,
  canvasHeight: number,
  config: SectionFrameConfig,
): {
  position: { x: number; y: number; z: number };
  rotation: { x: number; y: number; z: number };
} => {
  const safeCanvasWidth = Math.max(canvasWidth, 1);
  const safeCanvasHeight = Math.max(canvasHeight, 1);
  const fovRad = (fovDeg * Math.PI) / 180;
  const aspect = safeCanvasWidth / safeCanvasHeight;
  const tanHalfFovV = Math.tan(fovRad / 2);
  const tanHalfFovH = tanHalfFovV * aspect;

  cam.updateWorldMatrix(true, false);
  const worldQuat = new Quaternion();
  cam.getWorldQuaternion(worldQuat);

  const lookDir = new Vector3(0, 0, -1).applyQuaternion(worldQuat).normalize();
  const rightDir = new Vector3(1, 0, 0).applyQuaternion(worldQuat).normalize();
  const upDir = new Vector3(0, 1, 0).applyQuaternion(worldQuat).normalize();
  const worldRotation = new Euler().setFromQuaternion(worldQuat, 'XYZ');

  const { min, max } = box;
  const corners = [
    new Vector3(min.x, min.y, min.z),
    new Vector3(max.x, min.y, min.z),
    new Vector3(min.x, max.y, min.z),
    new Vector3(max.x, max.y, min.z),
    new Vector3(min.x, min.y, max.z),
    new Vector3(max.x, min.y, max.z),
    new Vector3(min.x, max.y, max.z),
    new Vector3(max.x, max.y, max.z),
  ];

  const targetPercent = Math.max(config.targetPercent, 0.01);
  const minDepthMargin = 0.5;
  let distance = minDepthMargin;

  corners.forEach((corner) => {
    const point = corner.clone().sub(targetCenter);
    const px = point.dot(rightDir);
    const py = point.dot(upDir);
    const pz = point.dot(lookDir);

    const dH = Math.abs(px) / (targetPercent * tanHalfFovH) - pz;
    const dV = Math.abs(py) / (targetPercent * tanHalfFovV) - pz;
    const dDepth = -pz + minDepthMargin;

    distance = Math.max(distance, dH, dV, dDepth);
  });

  const pos = targetCenter.clone().addScaledVector(lookDir, -distance);

  return {
    position: { x: pos.x, y: pos.y, z: pos.z },
    rotation: { x: worldRotation.x, y: worldRotation.y, z: worldRotation.z },
  };
};
