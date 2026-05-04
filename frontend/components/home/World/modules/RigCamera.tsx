'use client';

import React, {
  type JSX,
  type RefObject,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
} from 'react';

import { CameraShake } from '@react-three/drei';
import { useThree } from '@react-three/fiber';
import { buttonGroup, useControls, type useCreateStore } from 'leva';
import {
  Box3,
  Group,
  MathUtils,
  Mesh,
  PerspectiveCamera,
  Vector3,
} from 'three';

import { rigCameraAnimation } from '@/animations/home';
import { BREAK_POINTS, IS_DEV } from '@/constants/common';
import {
  HOME_WORLD_DEBUG_RIG_CAMERA_CONTROLS,
  HOME_WORLD_RIG_CAMERA_POSITIONS,
  HOME_WORLD_SCENE_NAME_CAMERA_CONTAINER,
  HOME_WORLD_SCENE_NAME_DOOR_CONTAINER,
  HOME_WORLD_SCENE_NAME_MODELS,
  HOME_WORLD_SCENE_NAME_ROOM,
  HOME_WORLD_SCENE_NAME_WATER,
} from '@/constants/home';
import { useWindowSize } from '@/hooks';

type Props = {
  /** portal セクション要素の参照 Ref */
  portalRef: RefObject<HTMLDivElement | null>;

  /** ドアグループへの Ref */
  doorRef: React.RefObject<Group | null>;

  /** Leva ストア */
  levaStore: ReturnType<typeof useCreateStore>;

  /** カメラが扉を通過した際の屋内状態変化コールバック */
  onInsideRoomChange: (isInside: boolean) => void;
};

type PortalFrame = Readonly<{
  left: number;
  right: number;
  bottom: number;
  top: number;
  padding: number;
  minDistance: number;
}>;

const PORTAL_MODEL_FRAME_DESKTOP: PortalFrame = {
  left: 0.16,
  right: 0.92,
  bottom: -0.72,
  top: 0.72,
  padding: 1.08,
  minDistance: 4,
};

const PORTAL_MODEL_FRAME_MOBILE: PortalFrame = {
  left: -0.78,
  right: 0.78,
  bottom: -0.94,
  top: -0.12,
  padding: 1.12,
  minDistance: 4,
};

const box = new Box3();
const boxCenter = new Vector3();
const boxSize = new Vector3();

const getPortalFrame = (width: number): PortalFrame =>
  width >= BREAK_POINTS.SM
    ? PORTAL_MODEL_FRAME_DESKTOP
    : PORTAL_MODEL_FRAME_MOBILE;

const getFramedPortalCameraPosition = ({
  camera,
  target,
  frame,
  aspect,
  fallback,
}: {
  camera: PerspectiveCamera;
  target: Group;
  frame: PortalFrame;
  aspect: number;
  fallback: Vector3;
}): Vector3 => {
  box.makeEmpty();
  target.children.forEach((child) => {
    if (child.name === HOME_WORLD_SCENE_NAME_WATER) return;
    box.expandByObject(child, true);
  });

  if (box.isEmpty()) return fallback.clone();

  box.getCenter(boxCenter);
  box.getSize(boxSize);

  const verticalFov = MathUtils.degToRad(camera.fov);
  const tanVertical = Math.tan(verticalFov / 2);
  const tanHorizontal = tanVertical * aspect;
  const frameWidth = Math.max(frame.right - frame.left, 0.01);
  const frameHeight = Math.max(frame.top - frame.bottom, 0.01);
  const distanceForWidth =
    boxSize.x / (frameWidth * tanHorizontal) + boxSize.z * 0.5;
  const distanceForHeight =
    boxSize.y / (frameHeight * tanVertical) + boxSize.z * 0.5;
  const nearDistance =
    Math.max(distanceForWidth, distanceForHeight, frame.minDistance) *
    frame.padding;
  const z = box.max.z + nearDistance;
  const distanceToCenter = z - boxCenter.z;
  const targetX = (frame.left + frame.right) / 2;
  const targetY = (frame.bottom + frame.top) / 2;

  return new Vector3(
    boxCenter.x - targetX * distanceToCenter * tanHorizontal,
    boxCenter.y - targetY * distanceToCenter * tanVertical,
    z,
  );
};

const RigCamera = React.memo(
  ({
    portalRef,
    doorRef,
    levaStore,
    onInsideRoomChange,
  }: Props): JSX.Element => {
    /** カメラリグ格納グループの参照 Ref */
    const ref = useRef<Group | null>(null);

    /** ウィンドウサイズを取得 */
    const { width, height } = useWindowSize();

    /** シーンの参照 */
    const scene = useThree((state) => state.scene);

    /** カメラの参照 */
    const camera = useThree((state) => state.camera);

    /**
     * 現在のブレークポイントに対応するカメラ始終点・モデル Y・ドアアニメーション設定。
     * ウィンドウサイズ変化のたびに再計算する。
     */
    const currentBpConfig = useMemo(() => {
      /** ウィンドウ幅に応じてドアアニメーションの開始・終了位置を決定する */
      const doorStart = width > BREAK_POINTS.XS ? 50 : 54;
      const doorEnd = width > BREAK_POINTS.XS ? 100 : 124;

      switch (true) {
        case width >= BREAK_POINTS['2XL']:
          return {
            ...HOME_WORLD_RIG_CAMERA_POSITIONS.xxl,
            modelsOffsetY: -0.85,
            doorStart,
            doorEnd,
          };
        case width >= BREAK_POINTS.XL:
          return {
            ...HOME_WORLD_RIG_CAMERA_POSITIONS.xl,
            modelsOffsetY: -0.6,
            doorStart,
            doorEnd,
          };
        case width >= BREAK_POINTS.LG:
          return {
            ...HOME_WORLD_RIG_CAMERA_POSITIONS.lg,
            modelsOffsetY: -0.4,
            doorStart,
            doorEnd,
          };
        case width >= BREAK_POINTS.SM:
          return {
            ...HOME_WORLD_RIG_CAMERA_POSITIONS.tb,
            modelsOffsetY: -1.4,
            doorStart,
            doorEnd,
          };
        case width >= BREAK_POINTS.XS:
          if (width < height) {
            return {
              ...HOME_WORLD_RIG_CAMERA_POSITIONS.sm.wrap,
              modelsOffsetY: -3.2,
              doorStart,
              doorEnd,
            };
          }
          return {
            ...HOME_WORLD_RIG_CAMERA_POSITIONS.sm.side,
            modelsOffsetY: -1.2,
            doorStart,
            doorEnd,
          };
        default:
          return {
            ...HOME_WORLD_RIG_CAMERA_POSITIONS.xs,
            modelsOffsetY: -0.5,
            doorStart,
            doorEnd,
          };
      }
    }, [width, height]);

    /** デバッグ用カメラ・ドアコントロール（開発環境のみ Leva パネルに表示） */
    const {
      debugStartX,
      debugStartY,
      debugStartZ,
      debugEndX,
      debugEndY,
      debugEndZ,
      debugModelsOffsetY,
      debugDoorStart,
      debugDoorEnd,
      debugRainHideThreshold,
    } = useControls(
      'カメラ',
      {
        debugStartX: {
          ...HOME_WORLD_DEBUG_RIG_CAMERA_CONTROLS.startX,
          value: currentBpConfig.start.x,
        },
        debugStartY: {
          ...HOME_WORLD_DEBUG_RIG_CAMERA_CONTROLS.startY,
          value: currentBpConfig.start.y,
        },
        debugStartZ: {
          ...HOME_WORLD_DEBUG_RIG_CAMERA_CONTROLS.startZ,
          value: currentBpConfig.start.z,
        },
        debugEndX: {
          ...HOME_WORLD_DEBUG_RIG_CAMERA_CONTROLS.endX,
          value: currentBpConfig.end.x,
        },
        debugEndY: {
          ...HOME_WORLD_DEBUG_RIG_CAMERA_CONTROLS.endY,
          value: currentBpConfig.end.y,
        },
        debugEndZ: {
          ...HOME_WORLD_DEBUG_RIG_CAMERA_CONTROLS.endZ,
          value: currentBpConfig.end.z,
        },
        debugModelsOffsetY: {
          ...HOME_WORLD_DEBUG_RIG_CAMERA_CONTROLS.modelsOffsetY,
          value: currentBpConfig.modelsOffsetY,
        },
        debugDoorStart: {
          ...HOME_WORLD_DEBUG_RIG_CAMERA_CONTROLS.doorStart,
          value: currentBpConfig.doorStart,
        },
        debugDoorEnd: {
          ...HOME_WORLD_DEBUG_RIG_CAMERA_CONTROLS.doorEnd,
          value: currentBpConfig.doorEnd,
        },
        debugRainHideThreshold: {
          ...HOME_WORLD_DEBUG_RIG_CAMERA_CONTROLS.rainHideThreshold,
        },
        _cameraReset: buttonGroup({
          リセット: () =>
            levaStore.set(
              {
                'カメラ.debugStartX': currentBpConfig.start.x,
                'カメラ.debugStartY': currentBpConfig.start.y,
                'カメラ.debugStartZ': currentBpConfig.start.z,
                'カメラ.debugEndX': currentBpConfig.end.x,
                'カメラ.debugEndY': currentBpConfig.end.y,
                'カメラ.debugEndZ': currentBpConfig.end.z,
                'カメラ.debugModelsOffsetY': currentBpConfig.modelsOffsetY,
                'カメラ.debugDoorStart': currentBpConfig.doorStart,
                'カメラ.debugDoorEnd': currentBpConfig.doorEnd,
                'カメラ.debugRainHideThreshold':
                  HOME_WORLD_DEBUG_RIG_CAMERA_CONTROLS.rainHideThreshold.value,
              },
              false,
            ),
        }),
      },
      { collapsed: true },
      { store: levaStore },
    );

    useEffect(() => {
      if (!IS_DEV) return;

      /** ドアの回転角を取得して雨表示状態を更新 */
      const raf = requestAnimationFrame(() => {
        if (!doorRef.current) return;

        /** ドアコンテナを取得 */
        const door = doorRef.current.children.find(
          (c) =>
            c instanceof Group &&
            c.name === HOME_WORLD_SCENE_NAME_DOOR_CONTAINER,
        );

        if (!(door instanceof Group)) return;

        /** 雨表示状態を更新 */
        onInsideRoomChange(
          door.rotation.y >= MathUtils.degToRad(debugRainHideThreshold),
        );
      });

      return () => {
        cancelAnimationFrame(raf);
      };
    }, [debugRainHideThreshold, doorRef, onInsideRoomChange]);

    /** ブレークポイント変更時にスライダーを当該 BP のデフォルト値にリセットする（開発環境のみ） */
    useEffect(() => {
      if (!IS_DEV) return;
      levaStore.set(
        {
          'カメラ.debugStartX': currentBpConfig.start.x,
          'カメラ.debugStartY': currentBpConfig.start.y,
          'カメラ.debugStartZ': currentBpConfig.start.z,
          'カメラ.debugEndX': currentBpConfig.end.x,
          'カメラ.debugEndY': currentBpConfig.end.y,
          'カメラ.debugEndZ': currentBpConfig.end.z,
          'カメラ.debugModelsOffsetY': currentBpConfig.modelsOffsetY,
          'カメラ.debugDoorStart': currentBpConfig.doorStart,
          'カメラ.debugDoorEnd': currentBpConfig.doorEnd,
        },
        false,
      );
    }, [currentBpConfig, levaStore]);

    useLayoutEffect(() => {
      if (!width || !height || !portalRef.current || !doorRef.current) return;

      /** シーン内のモデルグループを取得 */
      const models = scene.children.find(
        (c) => c instanceof Group && c.name === HOME_WORLD_SCENE_NAME_MODELS,
      );

      /** 扉コンテナを取得 */
      const door = doorRef.current.children.find(
        (c) =>
          c instanceof Group && c.name === HOME_WORLD_SCENE_NAME_DOOR_CONTAINER,
      );

      /** 部屋を取得 */
      const room = doorRef.current.children.find(
        (c) => c instanceof Mesh && c.name === HOME_WORLD_SCENE_NAME_ROOM,
      );

      if (
        !(models instanceof Group) ||
        !(door instanceof Group) ||
        !(room instanceof Mesh)
      )
        return;

      const portalModelsY = IS_DEV
        ? debugModelsOffsetY
        : currentBpConfig.modelsOffsetY;

      models.position.y = portalModelsY;
      models.updateWorldMatrix(true, true);

      /** カメラの開始位置を取得 */
      const debugStartPos = new Vector3(debugStartX, debugStartY, debugStartZ);
      const shouldUseDebugStart =
        IS_DEV && !debugStartPos.equals(currentBpConfig.start);
      const startPos =
        shouldUseDebugStart || !(camera instanceof PerspectiveCamera)
          ? debugStartPos
          : getFramedPortalCameraPosition({
              camera,
              target: models,
              frame: getPortalFrame(width),
              aspect: width / height,
              fallback: currentBpConfig.start,
            });

      /** カメラの終了位置を取得 */
      const endPos = IS_DEV
        ? new Vector3(debugEndX, debugEndY, debugEndZ)
        : currentBpConfig.end.clone();

      /** モデルのY座標を取得 */
      const modelsY = IS_DEV
        ? debugModelsOffsetY
        : currentBpConfig.modelsOffsetY;

      /** ドアの開始位置を取得 */
      const doorStart = IS_DEV ? debugDoorStart : currentBpConfig.doorStart;

      /** ドアの終了位置を取得 */
      const doorEnd = IS_DEV ? debugDoorEnd : currentBpConfig.doorEnd;

      /** 雨表示の閾値を取得 */
      const rainThreshold = IS_DEV
        ? debugRainHideThreshold
        : HOME_WORLD_DEBUG_RIG_CAMERA_CONTROLS.rainHideThreshold.value;

      /** カメラの位置を設定 */
      camera.position.copy(startPos);
      models.position.y = modelsY;

      /** カメラリグ格納グループのアニメーションを初期化 */
      const ctx = rigCameraAnimation({
        startPosition: startPos,
        endPosition: endPos,
        portal: portalRef.current!,
        door,
        room,
        ref,
        camera,
        doorAnimStart: doorStart,
        doorAnimEnd: doorEnd,
        onInsideRoomChange,
        doorHideRainThresholdDeg: rainThreshold,
      });

      return () => {
        ctx.revert();
      };
    }, [
      width,
      height,
      scene,
      camera,
      portalRef,
      doorRef,
      currentBpConfig,
      debugStartX,
      debugStartY,
      debugStartZ,
      debugEndX,
      debugEndY,
      debugEndZ,
      debugModelsOffsetY,
      debugDoorStart,
      debugDoorEnd,
      debugRainHideThreshold,
      onInsideRoomChange,
    ]);

    return (
      <group name={HOME_WORLD_SCENE_NAME_CAMERA_CONTAINER} ref={ref}>
        <CameraShake
          maxYaw={0.01}
          maxPitch={0.01}
          maxRoll={0.01}
          yawFrequency={0.2}
          pitchFrequency={0.2}
        />
      </group>
    );
  },
);

RigCamera.displayName = 'RigCamera';

export default RigCamera;
