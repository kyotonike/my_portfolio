'use client';

import React, { useEffect, useRef,useState } from 'react';

import { useCubeTexture } from '@react-three/drei';
import { useThree } from '@react-three/fiber';
import { DepthOfField, EffectComposer } from '@react-three/postprocessing';
import { folder, useControls } from 'leva';
import type { JSX } from 'react';
import {
  type AmbientLight,
  type DirectionalLight,
  type PerspectiveCamera,
} from 'three';

import type { WorldProps } from '@/components/works/workThreeD/World';
import {
  CustomCamera,
  CustomControls,
  CustomModel,
  Room,
} from '@/components/works/workThreeD/World/modules';
import { WORK_WORLD_ENV_COLORS } from '@/constants/colors';
import { BREAK_POINTS, IS_DEV } from '@/constants/common';
import {
  DEBUG_AMBIENT_LIGHT_PARAMS,
  DEBUG_CAMERA_PARAMS,
  DEBUG_DIRECTIONAL_LIGHT_PARAMS,
  WORK_WORLD_AMBIENT_LIGHT_INTENSITY,
  WORK_WORLD_CUBE_TEXTURE_FILES,
  WORK_WORLD_CUBE_TEXTURE_PATH,
  WORK_WORLD_DIRECTIONAL_LIGHT_INTENSITY,
  WORK_WORLD_DIRECTIONAL_LIGHT_POSITION,
  WORK_WORLD_DOF_PARAMS,
  WORK_WORLD_FOG_FAR,
  WORK_WORLD_FOG_NEAR,
  WORK_WORLD_SCENE_ENV_INTENSITY,
  WORK_WORLD_SHADOW_BIAS,
  WORK_WORLD_SHADOW_CAMERA_FAR,
  WORK_WORLD_SHADOW_MAP_SIZE,
} from '@/constants/workThreeD';
import { useWindowSize } from '@/hooks';
import type { WorkControl } from '@/types/api';
import { type ModelChildren } from '@/types/world';

type Props = WorldProps & {
  /** GLB 数値順ソート済み Controls データを通知するコールバック */
  onControlsSorted: (sortedControls: WorkControl[]) => void;
};

const Experience = React.memo(
  ({
    content,
    isInitialControl,
    isStartControls,
    viewerStatus,
    isLoading,
    currentIndex,
    isCameraReady,
    canvasSection,
    dispatch,
    portalRef,
    introductionRef,
    controlsRef,
    toggleButtonRef,
    onControlsSorted,
  }: Props): JSX.Element => {
    /** 環境光の参照 Ref */
    const ambientLightRef = useRef<AmbientLight | null>(null);

    /** 太陽光の参照 Ref */
    const directionalLightRef = useRef<DirectionalLight | null>(null);

    /** カメラの参照 Ref */
    const cameraRef = useRef<PerspectiveCamera | null>(null);

    /** ナビゲーションの表示フラグの状態 */
    const [isNavigationVisible, setIsNavigationVisible] =
      useState<boolean>(false);

    /** モデルの子要素 */
    const [modelChildren, setModelChildren] = useState<ModelChildren>([]);

    /** ウィンドウ幅を取得 */
    const { width } = useWindowSize();

    /** Three.js のシーンオブジェクトを取得 */
    const scene = useThree((state) => state.scene);

    /** キューブマップを設定 */
    const cubeTexture = useCubeTexture(WORK_WORLD_CUBE_TEXTURE_FILES, {
      path: WORK_WORLD_CUBE_TEXTURE_PATH,
    });

    /** カメラパラメータ（開発環境デバッグ用 leva コントロール） */
    const {
      fov,
      near,
      far,
      camPosX,
      camPosY,
      camPosZ,
      camRotX,
      camRotY,
      camRotZ,
    } = useControls('カメラ', {
      fov: {
        value: DEBUG_CAMERA_PARAMS.fov,
        min: 0,
        max: 100,
        label: '視野角',
      },
      near: {
        value: DEBUG_CAMERA_PARAMS.near,
        min: 0,
        max: 100,
        label: '近さ',
      },
      far: { value: DEBUG_CAMERA_PARAMS.far, min: 0, max: 200, label: '遠さ' },
      位置: folder({
        camPosX: {
          value: DEBUG_CAMERA_PARAMS.position.x,
          min: -50,
          max: 50,
          label: 'x',
        },
        camPosY: {
          value: DEBUG_CAMERA_PARAMS.position.y,
          min: -20,
          max: 30,
          label: 'y',
        },
        camPosZ: {
          value: DEBUG_CAMERA_PARAMS.position.z,
          min: -40,
          max: 40,
          label: 'z',
        },
      }),
      回転: folder({
        camRotX: {
          value: DEBUG_CAMERA_PARAMS.rotation.x,
          min: -Math.PI,
          max: Math.PI,
          label: 'x',
        },
        camRotY: {
          value: DEBUG_CAMERA_PARAMS.rotation.y,
          min: -Math.PI,
          max: Math.PI,
          label: 'y',
        },
        camRotZ: {
          value: DEBUG_CAMERA_PARAMS.rotation.z,
          min: -Math.PI,
          max: Math.PI,
          label: 'z',
        },
      }),
    });

    /** 環境光パラメータ（開発環境デバッグ用 leva コントロール） */
    const { ambientColor, ambientIntensity } = useControls(
      '環境光 (Ambient Light)',
      {
        ambientColor: {
          value: DEBUG_AMBIENT_LIGHT_PARAMS.color,
          label: '配色',
        },
        ambientIntensity: {
          value: DEBUG_AMBIENT_LIGHT_PARAMS.intensity,
          min: 0,
          max: 10,
          label: '光強度',
        },
      },
    );

    /** 太陽光パラメータ（開発環境デバッグ用 leva コントロール） */
    const { directionalColor, directionalIntensity } = useControls(
      '太陽光 (Directional Light)',
      {
        directionalColor: {
          value: DEBUG_DIRECTIONAL_LIGHT_PARAMS.color,
          label: '配色',
        },
        directionalIntensity: {
          value: DEBUG_DIRECTIONAL_LIGHT_PARAMS.intensity,
          min: 0,
          max: 100000,
          label: '光強度',
        },
      },
    );

    /** 被写界深度パラメータ（開発環境デバッグ用 leva コントロール） */
    const { dofWorldFocusDistance, dofWorldFocusRange, dofBokehScale } =
      useControls('被写界深度 (DepthOfField)', {
        dofWorldFocusDistance: {
          value: WORK_WORLD_DOF_PARAMS.worldFocusDistance,
          min: 0,
          max: 50,
          step: 0.1,
          label: 'worldFocusDistance (フォーカス距離)',
        },
        dofWorldFocusRange: {
          value: WORK_WORLD_DOF_PARAMS.worldFocusRange,
          min: 0,
          max: 30,
          step: 0.1,
          label: 'worldFocusRange (フォーカス範囲)',
        },
        dofBokehScale: {
          value: WORK_WORLD_DOF_PARAMS.bokehScale,
          min: 0,
          max: 20,
          step: 0.1,
          label: 'bokehScale',
        },
      });

    /** Three.js のシーンオブジェクトへ環境マップを適用する */
    useEffect(() => {
      scene.environment = cubeTexture;
      scene.background = cubeTexture;
      scene.environmentIntensity = WORK_WORLD_SCENE_ENV_INTENSITY;
    }, [cubeTexture, scene]);

    /** カメラの leva コントロール値を Three.js オブジェクトへ同期する (開発環境のみ) */
    useEffect(() => {
      if (!IS_DEV || !cameraRef.current) return;
      cameraRef.current.fov = fov;
      cameraRef.current.near = near;
      cameraRef.current.far = far;
      cameraRef.current.position.set(camPosX, camPosY, camPosZ);
      cameraRef.current.rotation.set(camRotX, camRotY, camRotZ);
      cameraRef.current.updateProjectionMatrix();
    }, [fov, near, far, camPosX, camPosY, camPosZ, camRotX, camRotY, camRotZ]);

    /** 環境光の leva コントロール値を Three.js オブジェクトへ同期する (開発環境のみ) */
    useEffect(() => {
      if (!IS_DEV || !ambientLightRef.current) return;
      ambientLightRef.current.color.set(ambientColor);
      ambientLightRef.current.intensity = ambientIntensity;
    }, [ambientColor, ambientIntensity]);

    /** 太陽光の leva コントロール値を Three.js オブジェクトへ同期する (開発環境のみ) */
    useEffect(() => {
      if (!IS_DEV || !directionalLightRef.current) return;
      directionalLightRef.current.color.set(directionalColor);
      directionalLightRef.current.intensity = directionalIntensity;
    }, [directionalColor, directionalIntensity]);

    return (
      <>
        {/* カスタムカメラ */}
        <CustomCamera
          cameraRef={cameraRef}
          setIsNavigationVisible={setIsNavigationVisible}
          modelChildren={modelChildren}
          content={content}
          portalRef={portalRef}
          introductionRef={introductionRef}
          controlsRef={controlsRef}
          toggleButtonRef={toggleButtonRef}
          isInitialControl={isInitialControl}
          isStartControls={isStartControls}
          viewerStatus={viewerStatus}
          currentIndex={currentIndex}
          isCameraReady={isCameraReady}
          canvasSection={canvasSection}
          dispatch={dispatch}
          onControlsSorted={onControlsSorted}
        />

        {/* 環境光 */}
        <ambientLight
          color={WORK_WORLD_ENV_COLORS.ambientLight}
          intensity={WORK_WORLD_AMBIENT_LIGHT_INTENSITY}
          ref={ambientLightRef}
        />

        {/* 平行光源 */}
        <directionalLight
          color={WORK_WORLD_ENV_COLORS.directionalLight}
          intensity={WORK_WORLD_DIRECTIONAL_LIGHT_INTENSITY}
          position={WORK_WORLD_DIRECTIONAL_LIGHT_POSITION}
          ref={directionalLightRef}
          castShadow
          shadow-mapSize-width={WORK_WORLD_SHADOW_MAP_SIZE}
          shadow-mapSize-height={WORK_WORLD_SHADOW_MAP_SIZE}
          shadow-camera-far={WORK_WORLD_SHADOW_CAMERA_FAR}
          shadow-camera-left={-1}
          shadow-camera-right={1}
          shadow-camera-top={1}
          shadow-camera-bottom={-1}
          shadow-bias={WORK_WORLD_SHADOW_BIAS}
        />

        {/* 霧 */}
        <fog
          attach="fog"
          args={[
            WORK_WORLD_ENV_COLORS.fog,
            width! > BREAK_POINTS.SM
              ? WORK_WORLD_FOG_NEAR.SM
              : WORK_WORLD_FOG_NEAR.default,
            width! > BREAK_POINTS.SM
              ? WORK_WORLD_FOG_FAR.SM
              : WORK_WORLD_FOG_FAR.default,
          ]}
          color={WORK_WORLD_ENV_COLORS.fog}
          near={
            width! > BREAK_POINTS.SM
              ? WORK_WORLD_FOG_NEAR.SM
              : WORK_WORLD_FOG_NEAR.default
          }
          far={
            width! > BREAK_POINTS.SM
              ? WORK_WORLD_FOG_FAR.SM
              : WORK_WORLD_FOG_FAR.default
          }
        />

        <CustomModel
          content={content}
          isNavigationVisible={isNavigationVisible}
          setModelChildren={setModelChildren}
          modelChildren={modelChildren}
          isInitialControl={isInitialControl}
          isStartControls={isStartControls}
          currentIndex={currentIndex}
          isCameraReady={isCameraReady}
          dispatch={dispatch}
        />

        {/* 部屋 */}
        <Room />

        {/* カスタムコントロール */}
        <CustomControls viewerStatus={viewerStatus} />

        <axesHelper args={[10]} visible={false} />

        {/** Canvas 作成完了（isLoading = false）後に EffectComposer を描画する。
         *   WebGL コンテキストが安定する前に addPass が呼ばれるエラーを防ぐ。 */}
        {!isLoading && (
          <EffectComposer>
            {/** 被写界深度の設定 */}
            <DepthOfField
              worldFocusDistance={
                IS_DEV
                  ? dofWorldFocusDistance
                  : WORK_WORLD_DOF_PARAMS.worldFocusDistance
              }
              worldFocusRange={
                IS_DEV
                  ? dofWorldFocusRange
                  : WORK_WORLD_DOF_PARAMS.worldFocusRange
              }
              bokehScale={
                IS_DEV ? dofBokehScale : WORK_WORLD_DOF_PARAMS.bokehScale
              }
              height={WORK_WORLD_DOF_PARAMS.height}
            />
          </EffectComposer>
        )}
      </>
    );
  },
);

Experience.displayName = 'Experience';

export default Experience;
