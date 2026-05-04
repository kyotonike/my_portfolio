'use client';

import React, { useCallback, useEffect } from 'react';
import dynamic from 'next/dynamic';

import { Canvas } from '@react-three/fiber';
import { Leva } from 'leva';
import type { Dispatch, JSX, RefObject } from 'react';
import { ACESFilmicToneMapping, PCFShadowMap } from 'three';

import Experience from '@/components/works/workThreeD/World/Experience';
import { IS_DEV } from '@/constants/common';
import s from '@/styles/workThreeD.module.css';
import { type WorkDetail } from '@/types/api';
import { type WorkControl } from '@/types/api';
import { type WorkThreeDAction, type WorkThreeDState } from '@/types/contexts';

/** r3f-perf は内部で useLayoutEffect + createRoot を使用するため SSR を無効化 */
const Perf = dynamic(() => import('r3f-perf').then((mod) => mod.Perf), {
  ssr: false,
});

export type Props = Omit<WorkThreeDState, 'isFingerVisible'> & {
  /** 表示する作品の詳細データ */
  content: WorkDetail;

  /** work 個別ページの状態 (3D) を更新する関数 */
  dispatch: Dispatch<WorkThreeDAction>;

  /** portal セクションの参照 Ref */
  portalRef: RefObject<HTMLElement | null>;

  /** introduction セクションの参照 Ref */
  introductionRef: RefObject<HTMLDivElement | null>;

  /** controls セクションの参照 Ref */
  controlsRef: RefObject<HTMLDivElement | null>;

  /** toggleButton の参照 Ref */
  toggleButtonRef: RefObject<HTMLDivElement | null>;

  /** GLB 数値順ソート済み Controls データを通知するコールバック */
  onControlsSorted: (sortedControls: WorkControl[]) => void;
};

const World = React.memo(
  ({
    content,
    isLoading,
    isInitialControl,
    isStartControls,
    viewerStatus,
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
    /** Canvas の作成完了時のコールバック */
    const handleCreated = useCallback((): void => {
      dispatch({ type: 'SET_LOADING', payload: false });
    }, [dispatch]);

    /** ポインター操作開始時のコールバック */
    const handlePointerDown = useCallback((): void => {
      dispatch({ type: 'SET_FINGER_VISIBLE', payload: false });
    }, [dispatch]);

    /**
     * React Strict Mode のアンマウント/リマウント時にローディング状態をリセットする。
     * これにより EffectComposer が未初期化の WebGL コンテキストで addPass を
     * 呼び出すのを防ぐ。
     */
    useEffect(() => {
      return () => {
        dispatch({ type: 'SET_LOADING', payload: true });
      };
    }, [dispatch]);

    return (
      <>
        {/** ページ遷移時の自動スクロールリセットをスキップさせないため空 div を配置 */}
        <div></div>

        {/** 開発環境のみ leva デバッグパネルを表示。ヘッダー高さ（最大 70px）分を下にオフセット */}
        {IS_DEV && <Leva titleBar={{ position: { x: 0, y: 70 } }} />}

        <div className={s.portal}>
          <Canvas
            shadows={{ type: PCFShadowMap }}
            dpr={[1, 2]}
            gl={{
              antialias: true,
              toneMapping: ACESFilmicToneMapping,
              toneMappingExposure: 2,
              outputColorSpace: 'srgb',
            }}
            className={`${s.canvas} ${s[`canvas_${canvasSection}`]}`}
            onCreated={handleCreated}
            onMouseDown={handlePointerDown}
            onTouchStart={handlePointerDown}
          >
            {/** 開発環境のみパフォーマンスモニターを表示。ヘッダー高さ（最大 70px）分を下にオフセット */}
            {IS_DEV && <Perf position="top-left" style={{ top: '70px' }} />}

            <Experience
              content={content}
              isLoading={isLoading}
              isInitialControl={isInitialControl}
              isStartControls={isStartControls}
              viewerStatus={viewerStatus}
              currentIndex={currentIndex}
              isCameraReady={isCameraReady}
              canvasSection={canvasSection}
              dispatch={dispatch}
              portalRef={portalRef}
              introductionRef={introductionRef}
              controlsRef={controlsRef}
              toggleButtonRef={toggleButtonRef}
              onControlsSorted={onControlsSorted}
            />
          </Canvas>
        </div>
      </>
    );
  },
);

World.displayName = 'World';

export default World;
