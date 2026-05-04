import { type Object3D, PerspectiveCamera, Vector3 } from 'three';

import { BREAK_POINTS } from '@/constants/common';
import {
  AUTO_FRAME_CAMERA_NAMES,
  AUTO_FRAME_TARGET_NAMES,
  DEFAULT_SECTION_CAMERA_PARAMS,
  VIEWER_TOGGLE_ZOOM_CONFIG,
  WORK_WORLD_FRAME_CONFIG,
} from '@/constants/workThreeD';
import type { WorkControl } from '@/types/api';
import type {
  CanvasSection,
  ControlCameraConfig,
  GenerateControlsResult,
  ModelChildren,
  WorkWorldSectionsCameraParams,
  WorkWorldViewerToggleCameraParams,
} from '@/types/world';

import { computeAutoFrameParams, computeModelBoundingBox } from './autoFrame';

const CANVAS_SECTION_RATIOS = {
  portal: { desktop: { w: 1, h: 1 }, mobile: { w: 1, h: 0.6 } },
  introduction: { desktop: { w: 0.55, h: 1 }, mobile: { w: 1, h: 0.6 } },
  controls: { desktop: { w: 0.55, h: 1 }, mobile: { w: 1, h: 0.55 } },
} as const;

const getCanvasDims = (
  section: CanvasSection,
  width: number,
  height: number,
): { cw: number; ch: number } => {
  const isDesktop = width >= BREAK_POINTS.SM;
  const { w, h } = isDesktop
    ? CANVAS_SECTION_RATIOS[section].desktop
    : CANVAS_SECTION_RATIOS[section].mobile;

  return {
    cw: Math.max(Math.round(width * w), 1),
    ch: Math.max(Math.round(height * h), 1),
  };
};

const cloneDefaultSectionParams = (): WorkWorldSectionsCameraParams => ({
  portal: { ...DEFAULT_SECTION_CAMERA_PARAMS.portal },
  introduction: { ...DEFAULT_SECTION_CAMERA_PARAMS.introduction },
  controls: { ...DEFAULT_SECTION_CAMERA_PARAMS.controls },
});

const collectFrameObjects = (
  modelChildren: ModelChildren,
  prefix?: string,
): Object3D[] => {
  if (!prefix) return [];

  const objects: Object3D[] = [];
  modelChildren.forEach((child) => {
    child.traverse((obj) => {
      if (obj.name.startsWith(prefix)) {
        objects.push(obj);
      }
    });
  });

  return objects;
};

const getWorldCenter = (obj: Object3D): Vector3 => {
  obj.updateWorldMatrix(true, false);
  return obj.getWorldPosition(new Vector3());
};

export const getSectionsCameraParams = (
  modelChildren: ModelChildren,
  width: number,
  height: number,
  fov: number,
): WorkWorldSectionsCameraParams => {
  if (width === 0 || height === 0 || modelChildren.length === 0) {
    return cloneDefaultSectionParams();
  }

  const cameraParams = cloneDefaultSectionParams();
  const fullBox = computeModelBoundingBox(modelChildren);
  const sectionKeys: CanvasSection[] = ['portal', 'introduction', 'controls'];

  sectionKeys.forEach((sectionKey) => {
    const cameraName = AUTO_FRAME_CAMERA_NAMES[sectionKey];
    const cam = modelChildren.find(
      (child) => child instanceof PerspectiveCamera && child.name === cameraName,
    ) as PerspectiveCamera | undefined;

    if (!cam) return;

    const frameConfig = WORK_WORLD_FRAME_CONFIG[sectionKey];
    const frameObjects = collectFrameObjects(
      modelChildren,
      frameConfig.targetMeshPrefix,
    );
    const frameBox =
      frameObjects.length > 0 ? computeModelBoundingBox(frameObjects) : fullBox;
    const targetObj = modelChildren.find(
      (child) => child.name === AUTO_FRAME_TARGET_NAMES[sectionKey],
    );
    const targetCenter = targetObj
      ? getWorldCenter(targetObj)
      : frameBox.getCenter(new Vector3());
    const { cw, ch } = getCanvasDims(sectionKey, width, height);

    cameraParams[sectionKey] = computeAutoFrameParams(
      cam,
      targetCenter,
      frameBox,
      fov,
      cw,
      ch,
      frameConfig,
    );
  });

  return cameraParams;
};

export const getViwerToggleCameraParams = (
  sectionsCameraParams: WorkWorldSectionsCameraParams,
  width: number,
): WorkWorldViewerToggleCameraParams => {
  const zoomConfig = VIEWER_TOGGLE_ZOOM_CONFIG.find(
    (config) => width >= config.min && width < config.max,
  );

  return {
    cameraParams: sectionsCameraParams.introduction,
    zoom: zoomConfig?.zoom ?? 0,
    offset: width < BREAK_POINTS.XS ? 20 : 0,
  };
};

export const generateControlsCameraConfigs = (
  modelChildren: ModelChildren,
  width: number,
  height: number,
  fov: number,
  controlsItems: WorkControl[],
): GenerateControlsResult => {
  if (width === 0 || height === 0 || modelChildren.length === 0) {
    return { configs: [], sortedControls: [] };
  }

  const frameConfig = WORK_WORLD_FRAME_CONFIG.controls;
  const frameObjects = collectFrameObjects(
    modelChildren,
    frameConfig.targetMeshPrefix,
  );
  const controlsBox =
    frameObjects.length > 0
      ? computeModelBoundingBox(frameObjects)
      : computeModelBoundingBox(modelChildren);
  const configs: Record<number, ControlCameraConfig> = {};
  const regex = /^Cam_Sec3_(\d+)$/;
  const { cw, ch } = getCanvasDims('controls', width, height);

  modelChildren.forEach((obj) => {
    if (!(obj instanceof PerspectiveCamera)) return;

    const match = obj.name.match(regex);
    if (!match) return;

    const index = parseInt(match[1], 10);
    const targetObj = modelChildren.find(
      (child) => child.name === `Target_Sec3_${index}`,
    );
    const targetCenter = targetObj
      ? getWorldCenter(targetObj)
      : controlsBox.getCenter(new Vector3());
    const { position, rotation } = computeAutoFrameParams(
      obj,
      targetCenter,
      controlsBox,
      fov,
      cw,
      ch,
      frameConfig,
    );

    configs[index] = {
      name: controlsItems[index]?.animation_name ?? `control_${index}`,
      position,
      rotation,
    };
  });

  const sortedConfigs = Object.keys(configs)
    .map(Number)
    .sort((a, b) => a - b)
    .map((key) => configs[key]);
  const sortedControls = sortedConfigs
    .map((config) =>
      controlsItems.find((item) => item.animation_name === config.name),
    )
    .filter((item): item is WorkControl => Boolean(item));

  return { configs: sortedConfigs, sortedControls };
};
