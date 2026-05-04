'use client';

import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
} from 'react';

import { PerspectiveCamera as CustomPerspectiveCamera } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import type { Dispatch, JSX, RefObject, SetStateAction } from 'react';
import type { PerspectiveCamera } from 'three';
import { Vector3 } from 'three';

import {
  controlsAnimation,
  sectionsAnimation,
  viewerToggleAnimation,
} from '@/animations/workWorld';
import type { WorldProps } from '@/components/works/workThreeD/World';
import { useWindowSize } from '@/hooks';
import type { WorkControl } from '@/types/api';
import type { CanvasSection, ModelChildren } from '@/types/world';
import { getWorkWorldFov } from '@/utils/world/work/autoFrame';
import {
  generateControlsCameraConfigs,
  getSectionsCameraParams,
  getViwerToggleCameraParams,
} from '@/utils/world/work/getCameraParams';

type Props = Omit<WorldProps, 'isLoading'> & {
  cameraRef: RefObject<PerspectiveCamera | null>;
  setIsNavigationVisible: Dispatch<SetStateAction<boolean>>;
  modelChildren: ModelChildren;
  onControlsSorted: (sortedControls: WorkControl[]) => void;
};

const CustomCamera = React.memo(
  ({
    cameraRef,
    setIsNavigationVisible,
    modelChildren,
    content,
    portalRef,
    introductionRef,
    controlsRef,
    toggleButtonRef,
    isStartControls,
    viewerStatus,
    currentIndex,
    dispatch,
    onControlsSorted,
  }: Props): JSX.Element => {
    const { width, height } = useWindowSize();
    const fov = getWorkWorldFov(width);
    const gl = useThree((state) => state.gl);
    const controls = useThree((state) => state.controls);

    const updateStartControls = useCallback(
      (value: boolean): void => {
        dispatch({ type: 'SET_START_CONTROLS', payload: value });
      },
      [dispatch],
    );

    const updateCanvasSection = useCallback(
      (section: CanvasSection): void => {
        dispatch({ type: 'SET_CANVAS_SECTION', payload: section });
      },
      [dispatch],
    );

    const sectionsCameraParams = useMemo(
      () => getSectionsCameraParams(modelChildren, width, height, fov),
      [fov, height, modelChildren, width],
    );

    useFrame(() => {
      if (!cameraRef.current) return;
      cameraRef.current.updateProjectionMatrix();
    });

    useLayoutEffect(() => {
      if (
        modelChildren.length === 0 ||
        !cameraRef.current ||
        !portalRef.current ||
        !introductionRef.current ||
        !controlsRef.current
      ) {
        return;
      }

      const sectionsAnimationCtx = sectionsAnimation({
        portal: portalRef.current,
        introduction: introductionRef.current,
        controls: controlsRef.current,
        camera: cameraRef.current,
        updateStartControls,
        setIsNavigationVisible,
        setCanvasSection: updateCanvasSection,
        cameraParams: sectionsCameraParams,
      });

      return () => {
        sectionsAnimationCtx.forEach((ctx) => ctx.revert());
      };
    }, [
      controlsRef,
      cameraRef,
      introductionRef,
      modelChildren,
      portalRef,
      sectionsCameraParams,
      setIsNavigationVisible,
      updateCanvasSection,
      updateStartControls,
    ]);

    useLayoutEffect(() => {
      if (
        modelChildren.length === 0 ||
        !introductionRef.current ||
        !toggleButtonRef.current
      ) {
        return;
      }

      const {
        cameraParams: viewerCameraParams,
        zoom,
        offset,
      } = getViwerToggleCameraParams(sectionsCameraParams, width);

      const viewerAnimationCtx = viewerToggleAnimation({
        introduction: introductionRef.current,
        cameraRef,
        cameraParams: viewerCameraParams,
        zoom,
        offset,
        onStartComplete: () =>
          dispatch({ type: 'SET_VIEWER_STATUS', payload: 'active' }),
        onEndComplete: () =>
          dispatch({ type: 'SET_VIEWER_STATUS', payload: 'passive' }),
      });

      const handleStart = (): void => {
        dispatch({ type: 'SET_VIEWER_STATUS', payload: 'entering' });
        viewerAnimationCtx.onStart();
      };
      const handleEnd = (): void => viewerAnimationCtx.onEnd();
      const startButton = toggleButtonRef.current.children[1].children[0];
      const endButton = toggleButtonRef.current.children[2].children[0];

      startButton.addEventListener('click', handleStart);
      endButton.addEventListener('click', handleEnd);

      return () => {
        viewerAnimationCtx.revert();
        startButton.removeEventListener('click', handleStart);
        endButton.removeEventListener('click', handleEnd);
      };
    }, [
      cameraRef,
      dispatch,
      introductionRef,
      modelChildren.length,
      sectionsCameraParams,
      toggleButtonRef,
      width,
    ]);

    useLayoutEffect(() => {
      if (modelChildren.length === 0 || !cameraRef.current) return;

      const { configs: cameraConfigs, sortedControls } =
        generateControlsCameraConfigs(
          modelChildren,
          width,
          height,
          fov,
          content.controls || [],
        );

      onControlsSorted(sortedControls);

      const ctx = controlsAnimation({
        cameraRef,
        currentIndex,
        isStartControls,
        cameraConfigs,
        width,
        height,
        onComplete: () => dispatch({ type: 'SET_CAMERA_READY', payload: true }),
      });

      return () => {
        ctx.kill(false);
      };
    }, [
      cameraRef,
      content.controls,
      currentIndex,
      dispatch,
      fov,
      height,
      isStartControls,
      modelChildren,
      onControlsSorted,
      width,
    ]);

    useEffect(() => {
      gl.domElement.style.zIndex = viewerStatus === 'active' ? '200' : '20';
    }, [gl, viewerStatus]);

    useEffect(() => {
      if (viewerStatus !== 'active' || !cameraRef.current || !controls) return;

      const cam = cameraRef.current;
      const dir = new Vector3();
      cam.getWorldDirection(dir);

      const orbitControls = controls as unknown as {
        target: Vector3;
        update: () => void;
      };
      orbitControls.target.copy(cam.position).addScaledVector(dir, 10);
      orbitControls.update();
    }, [cameraRef, controls, viewerStatus]);

    return (
      <CustomPerspectiveCamera
        ref={cameraRef}
        name="my-camera"
        fov={fov}
        near={0.1}
        far={200}
        makeDefault
        onUpdate={(camera) => camera.updateProjectionMatrix()}
      />
    );
  },
);

CustomCamera.displayName = 'CustomCamera';

export default CustomCamera;
