import { gsap } from 'gsap';
import type { Dispatch, RefObject, SetStateAction } from 'react';
import { Euler, type PerspectiveCamera, Quaternion, Vector3 } from 'three';

import { IS_DEV } from '@/constants/common';
import {
  CONTROLS_ANIMATION_DELAY,
  CONTROLS_ANIMATION_DURATION,
  NAVIGATION_ANIMATION_DURATION,
  SECTION_ANIMATION_DURATION,
  SECTION_ANIMATION_SCRUB,
  VIEWER_TOGGLE_END_DURATION,
  VIEWER_TOGGLE_START_DURATION,
} from '@/constants/workThreeD';
import type {
  CameraParams,
  CanvasSection,
  ControlCameraConfigs,
  Position,
  Rotation,
  WorkWorldSectionsCameraParams,
} from '@/types/world';

type SectionAnimationPoint = {
  startPoint: string;
  endPoint: string;
  sectionName: string;
};

type CreateSectionAnimationProps = {
  element: HTMLElement;
  updateStartControls?: (valueOrUpdater: boolean) => void;
  setIsNavigationVisible?: Dispatch<SetStateAction<boolean>>;
  setCanvasSection: (section: CanvasSection) => void;
};

type SectionsAnimationProps = {
  portal: HTMLElement;
  introduction: HTMLElement;
  controls: HTMLElement;
  camera: PerspectiveCamera;
  updateStartControls: (valueOrUpdater: boolean) => void;
  setIsNavigationVisible: Dispatch<SetStateAction<boolean>>;
  setCanvasSection: (section: CanvasSection) => void;
  cameraParams: WorkWorldSectionsCameraParams;
};

type ViewerToggleAnimationProps = {
  introduction: HTMLElement;
  cameraRef: RefObject<PerspectiveCamera | null>;
  cameraParams: CameraParams;
  zoom: number;
  offset: number;
  onStartComplete: () => void;
  onEndComplete: () => void;
};

type ControlsAnimationProps = {
  cameraRef: RefObject<PerspectiveCamera | null>;
  currentIndex: number;
  isStartControls: boolean;
  cameraConfigs: ControlCameraConfigs;
  width: number;
  height: number;
  onComplete?: () => void;
};

type NavigationVisibleAnimationProps = {
  ref: RefObject<HTMLSpanElement | null>;
  isVisible: boolean;
};

const applyCameraParams = (
  camera: PerspectiveCamera,
  position: Position,
  rotation: Rotation,
): void => {
  camera.position.set(position.x, position.y, position.z);
  camera.rotation.set(rotation.x, rotation.y, rotation.z);
  camera.clearViewOffset();
  camera.updateProjectionMatrix();
};

const interpolateCameraState = (
  camera: PerspectiveCamera,
  from: { position: Position; rotation: Rotation },
  to: { position?: Position; rotation?: Rotation },
  t: number,
): void => {
  if (to.position) {
    camera.position.set(
      gsap.utils.interpolate(from.position.x, to.position.x, t),
      gsap.utils.interpolate(from.position.y, to.position.y, t),
      gsap.utils.interpolate(from.position.z, to.position.z, t),
    );
  }

  if (to.rotation) {
    camera.rotation.set(
      gsap.utils.interpolate(from.rotation.x, to.rotation.x, t),
      gsap.utils.interpolate(from.rotation.y, to.rotation.y, t),
      gsap.utils.interpolate(from.rotation.z, to.rotation.z, t),
    );
  }

  camera.clearViewOffset();
  camera.updateProjectionMatrix();
};

const getSectionAnimationParams = (
  elementId: string,
): SectionAnimationPoint => {
  switch (elementId) {
    case 'model-viewer':
      return {
        startPoint: 'top top',
        endPoint: '85% top',
        sectionName: 'Model Viewer',
      };
    case 'introduction':
      return {
        startPoint: '0% top',
        endPoint: '90% top',
        sectionName: 'Introduction',
      };
    case 'controls':
      return {
        startPoint: '0% top',
        endPoint: '100% top',
        sectionName: 'Controls',
      };
    default:
      return { startPoint: '', endPoint: '', sectionName: '' };
  }
};

const createJourneyAnimation = ({
  portal,
  introduction,
  cameraParams,
  camera,
  setCanvasSection,
}: {
  portal: HTMLElement;
  introduction: HTMLElement;
  cameraParams: WorkWorldSectionsCameraParams;
  camera: PerspectiveCamera;
  setCanvasSection: (section: CanvasSection) => void;
}): gsap.Context => {
  return gsap.context(() => {
    const absTop = (el: HTMLElement): number =>
      el.getBoundingClientRect().top + window.scrollY;
    const portalRange = portal.offsetHeight * 0.85;
    const introRange = introduction.offsetHeight * 0.9;
    const gapRange = Math.max(
      0,
      absTop(introduction) - absTop(portal) - portalRange,
    );
    const totalRange = portalRange + gapRange + introRange;

    if (totalRange <= 0) return;

    const portalTweenEnd = portalRange / totalRange;
    const introTweenStart = (portalRange + gapRange) / totalRange;
    const portalInterp = { value: 0 };
    const introInterp = { value: 0 };

    gsap
      .timeline({
        scrollTrigger: {
          trigger: portal,
          start: 'top top',
          end: `+=${totalRange}`,
          scrub: SECTION_ANIMATION_SCRUB,
          id: 'Journey',
          markers: IS_DEV
            ? {
                startColor: 'blue',
                endColor: 'orange',
                fontSize: '12px',
                fontWeight: 'bold',
                indent: 20,
              }
            : false,
          onUpdate: (self) => {
            setCanvasSection(
              self.progress >= introTweenStart ? 'introduction' : 'portal',
            );
          },
          onLeaveBack: () => setCanvasSection('portal'),
        },
      })
      .to(
        portalInterp,
        {
          value: 1,
          duration: portalTweenEnd,
          ease: 'power4.out',
          onUpdate: () => {
            if (camera.userData.isLocked) return;
            interpolateCameraState(
              camera,
              cameraParams.portal,
              cameraParams.introduction,
              portalInterp.value,
            );
          },
        },
        0,
      )
      .to(
        introInterp,
        {
          value: 1,
          duration: 1 - introTweenStart,
          ease: 'power4.out',
          onUpdate: () => {
            if (camera.userData.isLocked) return;
            applyCameraParams(
              camera,
              cameraParams.introduction.position,
              cameraParams.introduction.rotation,
            );
          },
        },
        introTweenStart,
      );
  }, portal);
};

const createSectionAnimation = ({
  element,
  updateStartControls,
  setIsNavigationVisible,
  setCanvasSection,
}: CreateSectionAnimationProps): gsap.Context => {
  const { startPoint, endPoint, sectionName } = getSectionAnimationParams(
    element.id,
  );

  return gsap.context(() => {
    gsap.timeline({
      ease: 'power4.out',
      duration: SECTION_ANIMATION_DURATION,
      scrollTrigger: {
        trigger: element,
        markers: IS_DEV
          ? {
              startColor: 'green',
              endColor: 'red',
              fontSize: '12px',
              fontWeight: 'bold',
              indent: 20,
            }
          : false,
        scrub: SECTION_ANIMATION_SCRUB,
        start: startPoint,
        end: endPoint,
        id: ` ${sectionName}`,
        refreshPriority: 0,
        onEnter: () => {
          if (element.id !== 'controls') return;
          setCanvasSection('controls');
          updateStartControls?.(true);
          setIsNavigationVisible?.(true);
        },
        onLeaveBack: () => {
          if (element.id !== 'controls') return;
          setCanvasSection('introduction');
          updateStartControls?.(false);
          setIsNavigationVisible?.(false);
        },
      },
    });
  }, element);
};

export const sectionsAnimation = ({
  portal,
  introduction,
  controls,
  camera,
  updateStartControls,
  setIsNavigationVisible,
  setCanvasSection,
  cameraParams,
}: SectionsAnimationProps): gsap.Context[] => {
  applyCameraParams(
    camera,
    cameraParams.portal.position,
    cameraParams.portal.rotation,
  );

  const journeyCtx = createJourneyAnimation({
    portal,
    introduction,
    cameraParams,
    camera,
    setCanvasSection,
  });

  const controlsCtx = createSectionAnimation({
    element: controls,
    updateStartControls,
    setIsNavigationVisible,
    setCanvasSection,
  });

  return [journeyCtx, controlsCtx];
};

export const controlsAnimation = ({
  cameraRef,
  currentIndex,
  isStartControls,
  cameraConfigs,
  width,
  height,
  onComplete,
}: ControlsAnimationProps): gsap.Context => {
  const currentCameraConfig = cameraConfigs[currentIndex];

  if (cameraRef.current) {
    cameraRef.current.aspect = width / height;
    cameraRef.current.updateProjectionMatrix();
  }

  return gsap.context(() => {
    if (!isStartControls || !cameraRef.current || !currentCameraConfig) return;

    const camera = cameraRef.current;
    const startPos = camera.position.clone();
    const endPos = new Vector3(
      currentCameraConfig.position.x,
      currentCameraConfig.position.y,
      currentCameraConfig.position.z,
    );
    const startQuat = camera.quaternion.clone();
    const endQuat = new Quaternion().setFromEuler(
      new Euler(
        currentCameraConfig.rotation.x,
        currentCameraConfig.rotation.y,
        currentCameraConfig.rotation.z,
      ),
    );
    const progress = { value: 0 };

    gsap.to(progress, {
      value: 1,
      ease: 'power2.inOut',
      duration: CONTROLS_ANIMATION_DURATION,
      delay: CONTROLS_ANIMATION_DELAY,
      onUpdate: () => {
        camera.position.lerpVectors(startPos, endPos, progress.value);
        camera.quaternion.slerpQuaternions(startQuat, endQuat, progress.value);
        camera.clearViewOffset();
        camera.updateProjectionMatrix();
      },
      onComplete,
    });
  }, cameraRef);
};

export const viewerToggleAnimation = ({
  introduction,
  cameraRef,
  cameraParams,
  zoom,
  offset,
  onStartComplete,
  onEndComplete,
}: ViewerToggleAnimationProps): gsap.Context => {
  return gsap.context((self) => {
    const elementOffsetTop =
      introduction.getBoundingClientRect().top + window.scrollY + offset;
    const html = document.getElementsByTagName('html')[0];
    const body = document.body;

    self.add('onStart', () => {
      if (!cameraRef.current) return;

      cameraRef.current.userData.isLocked = true;
      html.style.overflow = 'hidden';
      body.style.overflow = 'hidden';
      window.scrollTo({ top: elementOffsetTop, behavior: 'instant' });

      gsap.to(cameraRef.current.position, {
        x: cameraParams.position.x,
        y: cameraParams.position.y - zoom,
        z: cameraParams.position.z - zoom,
        duration: VIEWER_TOGGLE_START_DURATION,
        ease: 'power1.in',
        onComplete: onStartComplete,
      });
    });

    self.add('onEnd', () => {
      if (!cameraRef.current) return;

      const startPos = cameraRef.current.position.clone();
      const endPos = new Vector3(
        cameraParams.position.x,
        cameraParams.position.y,
        cameraParams.position.z,
      );
      const startDir = new Vector3();
      cameraRef.current.getWorldDirection(startDir);
      const startLookAt = startPos.clone().addScaledVector(startDir, 10);
      const endQuat = new Quaternion().setFromEuler(
        new Euler(
          cameraParams.rotation.x,
          cameraParams.rotation.y,
          cameraParams.rotation.z,
        ),
      );
      const endDir = new Vector3(0, 0, -1).applyQuaternion(endQuat);
      const endLookAt = endPos.clone().addScaledVector(endDir, 10);
      const progress = { value: 0 };

      cameraRef.current.userData.isLocked = true;

      gsap.to(progress, {
        value: 1,
        duration: VIEWER_TOGGLE_END_DURATION,
        ease: 'power2.inOut',
        onUpdate: () => {
          if (!cameraRef.current) return;
          cameraRef.current.position.lerpVectors(
            startPos,
            endPos,
            progress.value,
          );
          const lookTarget = new Vector3().lerpVectors(
            startLookAt,
            endLookAt,
            progress.value,
          );
          cameraRef.current.lookAt(lookTarget);
          cameraRef.current.clearViewOffset();
          cameraRef.current.updateProjectionMatrix();
        },
        onComplete: () => {
          if (!cameraRef.current) return;
          html.style.overflow = 'auto';
          body.style.overflow = 'auto';
          cameraRef.current.userData.isLocked = false;
          onEndComplete();
        },
      });
    });
  }, cameraRef);
};

export const navigationVisibleAnimation = ({
  ref,
  isVisible,
}: NavigationVisibleAnimationProps): gsap.Context => {
  return gsap.context(() => {
    const animate = gsap.timeline({ paused: true });

    if (isVisible) {
      animate.fromTo(
        ref.current!,
        { opacity: 0, display: 'block' },
        {
          opacity: 1,
          duration: NAVIGATION_ANIMATION_DURATION,
          ease: 'sine.out',
        },
      );
    } else {
      animate.fromTo(
        ref.current!,
        { opacity: 1 },
        {
          opacity: 0,
          display: 'none',
          duration: NAVIGATION_ANIMATION_DURATION,
          ease: 'sine.out',
        },
      );
    }

    animate.play();
  }, ref);
};
