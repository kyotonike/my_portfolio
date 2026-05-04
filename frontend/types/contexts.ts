import type React from 'react';

import type { CanvasSection } from '@/types/world';

/** HomeContextType の型定義 */
export type HomeContextType = {
  /** ホームページのポータルセクションのルート要素の ref */
  portalRef: React.MutableRefObject<HTMLDivElement>;

  /** 3D モデルのロード中かどうか */
  isLoading: boolean;

  /** ローディング状態を更新するセッター */
  setIsLoading: React.Dispatch<React.SetStateAction<boolean>>;
};

/**
 * ビュワーモードの状態を表す文字列リテラル型。
 * - `passive`  : ビュワー無効（初期状態）
 * - `entering` : 開始アニメーション再生中（ボタンは End 表示、OrbitControls は無効）
 * - `active`   : ビュワー完全有効（OrbitControls 有効）
 * - `exiting`  : 終了アニメーション再生中（ボタンは Start 表示、OrbitControls は無効）
 */
export type ViewerStatus = 'passive' | 'entering' | 'active' | 'exiting';

/**
 * 3D作品ビュワーで管理する状態。
 * useReducer に渡す state の型。
 */
/** WorkThreeDState の型定義 */
export type WorkThreeDState = {
  /** 3Dモデルのロード中フラグ */
  isLoading: boolean;

  /** 初期コントロール状態フラグ（Controls セクションに入る前の初期状態） */
  isInitialControl: boolean;

  /** コントロール開始フラグ（Controls セクションに到達したとき true になる） */
  isStartControls: boolean;

  /** 指アイコン表示フラグ */
  isFingerVisible: boolean;

  /** ビュワーモードの状態 */
  viewerStatus: ViewerStatus;

  /** 現在選択中のコントロールインデックス */
  currentIndex: number;

  /** カメラアニメーション完了フラグ（true: 完了済み → モデルアニメーション再生可） */
  isCameraReady: boolean;

  /** Canvas を表示するセクション */
  canvasSection: CanvasSection;
};

/**
 * WorkThreeDContext で useReducer に渡すアクションの Union 型。
 * SET_VIEWER_STATUS は viewerStatus を更新し、active 遷移時は isFingerVisible も true にリセットする。
 * NAVIGATE_TO は isInitialControl を false にし currentIndex を更新する。
 */
export type WorkThreeDAction =
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_INITIAL_CONTROL'; payload: boolean }
  | { type: 'SET_START_CONTROLS'; payload: boolean }
  | { type: 'SET_FINGER_VISIBLE'; payload: boolean }
  | { type: 'SET_CURRENT_INDEX'; payload: number }
  | { type: 'SET_CANVAS_SECTION'; payload: CanvasSection }
  /** viewerStatus を更新する。active 遷移時は isFingerVisible を true にリセットする */
  | { type: 'SET_VIEWER_STATUS'; payload: ViewerStatus }
  /** isInitialControl を false にし currentIndex を payload に更新する */
  | { type: 'NAVIGATE_TO'; payload: number }
  /** カメラアニメーション完了フラグを更新する */
  | { type: 'SET_CAMERA_READY'; payload: boolean };

/**
 * 3D作品ビュワーで使用する DOM ref 群。
 */
/** WorkThreeDRefs の型定義 */
export type WorkThreeDRefs = {
  /** Portal セクションのルート要素の ref */
  portalRef: React.MutableRefObject<HTMLElement>;

  /** Introduction セクションのルート要素の ref */
  introductionRef: React.MutableRefObject<HTMLDivElement>;

  /** Controls セクションのルート要素の ref */
  controlsRef: React.MutableRefObject<HTMLDivElement>;

  /** ビュワー切り替えトグルボタンの ref */
  toggleButtonRef: React.MutableRefObject<HTMLDivElement>;
};

/** PageHeaderContextType の型定義 */
export type PageHeaderContextType = {
  /** ページヘッダー要素の ref */
  pageHeaderRef: React.MutableRefObject<HTMLElement>;
};
