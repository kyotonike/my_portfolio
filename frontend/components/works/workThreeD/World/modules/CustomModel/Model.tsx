import React, { useEffect, useMemo, useRef } from 'react';

import { useGLTF } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import type { Dispatch, JSX, SetStateAction } from 'react';

import type {
  AnimationAction,
 AnimationClip,
  Group,
  Mesh,
  Object3D,
} from 'three';
import { AnimationMixer, FrontSide, LoopOnce } from 'three';

import { DRACO_DECODER_PATH } from '@/constants/common';
import {
  WORK_WORLD_ANIMATION_NAME_REGEX,
  WORK_WORLD_FLOOR_PLANE_REGEX,
  WORK_WORLD_MODEL_API_BASE_PATH,
} from '@/constants/workThreeD';
import { type WorkDetail } from '@/types/api';
import { type ModelChildren } from '@/types/world';

type Props = {
  /** 表示する作品の詳細データ */
  content: WorkDetail;

  /** モデル子要素の更新関数 */
  setModelChildren: Dispatch<SetStateAction<ModelChildren>>;

  /** 初期コントロール状態フラグ */
  isInitialControl: boolean;

  /** コントロール開始フラグ */
  isStartControls: boolean;

  /** 現在選択中のコントロールインデックス */
  currentIndex: number;

  /** カメアニメーション完了フラグ（true: 完了済み → モデルアニメーション再生可） */
  isCameraReady: boolean;
};

/** DRACO デコーダーパスを設定 */
useGLTF.setDecoderPath(DRACO_DECODER_PATH);

/**
 * 「アニメーション名」と 「アニメーションクリップ名」 の部位名を正規化する処理
 *
 * 正規化することで、AnimationClip.name に部位名以外の情報が含まれていても、
 * animationName と対応する AnimationClip を特定できるようにする。
 *
 * @param str - 正規化対象文字列
 * @returns {string} 記号除去・小文字化した文字列
 *
 * @example
 * normalize(str);
 */
const normalize = (str: string): string =>
  str.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();

const Model = React.memo(
  ({
    content,
    setModelChildren,
    isStartControls,
    currentIndex,
    isCameraReady,
  }: Props): JSX.Element => {
    /** AnimationMixer の参照 Ref */
    const actionsRef = useRef<AnimationMixer | null>(null);

    /** 現在再生中の _S_ AnimationAction の参照（クロスフェード用）*/
    const activeActionRef = useRef<AnimationAction[]>([]);

    /** Controls セクション在籍フラグの前回値（初回ロード時のリセット再生を防ぐ） */
    const wasStartControlsRef = useRef<boolean>(false);

    /** Group オブジェクトの参照 Ref */
    const groupRef = useRef<Group | null>(null);

    /** useGLTF でモデルをプロキシ経由で読み込む（Storage URL をクライアントに公開しない） */
    const gltf = useGLTF(
      `${WORK_WORLD_MODEL_API_BASE_PATH}${content.key}`,
      true,
    );

    /** アニメーションを更新 */
    useFrame((_, delta) => {
      if (!actionsRef.current) return;
      actionsRef.current.update(delta);
    });

    /** [DEBUG] GLB データ構造確認 */
    useEffect(() => {
      if (process.env.NODE_ENV !== 'development') return;

      console.group(`[GLB DEBUG] key=${content.key}`);

      console.group('▼ アニメーションクリップ一覧');
      gltf.animations.forEach((clip: AnimationClip) => console.log(clip.name));
      console.groupEnd();

      console.group('▼ シーン内オブジェクト名一覧');
      gltf.scene.traverse((child: Object3D) => {
        if (child.name) console.log(`[${child.type}] ${child.name}`);
      });
      console.groupEnd();

      console.group('▼ content.controls アイテム一覧');
      content.controls.forEach((item, i) =>
        console.log(`  [${i}] animation_name="${item.animation_name}"`, item),
      );
      console.groupEnd();

      console.groupEnd();
    }, [gltf, content.key, content.controls]);

    /**
     * GLB シーン内 Cam_Sec3_<n> カメラ名を走査して
     * 数値インデックス <n> 順にソートしたアニメーション名リストを生成する。
     * このリストが currentIndex の正規順序になる。
     */
    const sortedAnimationNames = useMemo((): string[] => {
      const regex = /^Cam_Sec3_(\d+)$/;
      const found: { n: number; name: string }[] = [];
      gltf.scene.traverse((child: Object3D) => {
        const match = child.name.match(regex);
        if (match) {
          const n = parseInt(match[1], 10);
          const name = content.controls[n]?.animation_name;
          if (name && !found.some((f) => f.n === n)) {
            found.push({ n, name });
          }
        }
      });
      return found.sort((a, b) => a.n - b.n).map((f) => f.name);
    }, [content.controls, gltf]);

    /** 裏面を非表示 */
    useEffect(() => {
      gltf.scene.traverse((child: Object3D) => {
        if (!(child as Mesh).isMesh) return;

        /** 影を有効化 */
        child.castShadow = true;
        child.receiveShadow = true;

        /** 床の場合は影を無効化 */
        if (WORK_WORLD_FLOOR_PLANE_REGEX.test(child.name)) {
          child.castShadow = false;
        }

        const mesh = child as Mesh;

        /** メッシュのマテリアルのサイドをフロントサイドに設定 */
        if (Array.isArray(mesh.material)) {
          mesh.material.forEach((material) => {
            material.side = FrontSide;
          });
        } else {
          mesh.material.side = FrontSide;
        }
      });
    }, [gltf]);

    /**
     * gltf が変わるたびに AnimationMixer を1度だけ生成し、
     * 全クリップアクションをプリウォームする。
     * ナビゲーションやセクション遷移のたびにミキサーが作り直されなくなることで
     * 離脱時リセット不能・クロスフェード不能の問題を根本解消する。
     */
    useEffect(() => {
      if (!groupRef.current) return;

      actionsRef.current?.stopAllAction();
      actionsRef.current = new AnimationMixer(groupRef.current);
      activeActionRef.current = [];
      wasStartControlsRef.current = false;

      /** 全クリップアクションをプリウォーム（再生はしない） */
      gltf.animations.forEach((clip: AnimationClip) => {
        actionsRef.current!.clipAction(clip);
      });
    }, [gltf]);

    /**
     * セクション離脱時（isStartControls: true → false）に
     * 全 _E_（リセット）アニメーションを再生してモデルを初期ポーズに戻す。
     * wasStartControlsRef により初回ロード時（まだ Controls に入っていない状態）はスキップする。
     */
    useEffect(() => {
      if (isStartControls) {
        wasStartControlsRef.current = true;
        return;
      }

      /** 初回ロード時はまだ Controls に入っていないためスキップ */
      if (!wasStartControlsRef.current) return;
      wasStartControlsRef.current = false;

      if (!actionsRef.current) return;

      actionsRef.current.stopAllAction();
      activeActionRef.current = [];

      /** 全 _E_ アニメーションを再生してモデルを初期ポーズに戻す */
      gltf.animations.forEach((clip: AnimationClip) => {
        if (clip.name.includes('_E_')) {
          actionsRef.current!.clipAction(clip).reset().play();
        }
      });
    }, [isStartControls, gltf]);

    /**
     * currentIndex または isStartControls 変化時にモデルアニメーションを制御する。
     *
     * - 初回入場・再入場: 対象 _S_ を再生、非対象パーツの _E_ を再生
     * - ナビゲーション切り替え: 旧 _S_ を fadeOut、新 _S_ を fadeIn でスムーズ遷移
     * - 非選択パーツの _E_ は常に再生（リセット）
     */
    useEffect(() => {
      if (!isStartControls || !isCameraReady || !actionsRef.current) return;

      /** 現在のアニメーション名を GLB 数値順リストから取得 */
      const currentAnimName = sortedAnimationNames[currentIndex] ?? '';

      /** is_loop は content.controls から animation_name で逆引き */
      const currentControl = content.controls.find(
        (c) => c.animation_name === currentAnimName,
      );

      /** 正規化されたアニメーション名を取得 */
      const normalizedAnimName = normalize(currentAnimName);

      /** クロスフェードの継続時間（秒） */
      const CROSS_FADE_DURATION = 0.3;

      /** フェードアウト対象: 前回の _S_ アクション群を保持 */
      const previousActions = activeActionRef.current;

      /** 今回再生する _S_ アクション群を収集 */
      const nextActions: AnimationAction[] = [];

      gltf.animations.forEach((animation: AnimationClip) => {
        /** アニメーション名部分を抽出 */
        const match = animation.name.match(WORK_WORLD_ANIMATION_NAME_REGEX);

        /** 部位名を取得 */
        const partName = match ? match[1] : '';

        /** 正規化された部位名を取得 */
        const normalizedPartName = normalize(partName);

        /** 選択中のパーツと一致するかを確認 */
        const isMatchingPart = normalizedPartName.includes(normalizedAnimName);

        const action = actionsRef.current!.clipAction(animation);

        if (animation.name.includes('_S_') && isMatchingPart) {
          /** ループ設定 */
          if (!currentControl?.is_loop) {
            action.clampWhenFinished = true;
            action.setLoop(LoopOnce, 0);
          }

          if (previousActions.length > 0 && !previousActions.includes(action)) {
            /** ナビゲーション切り替え: 新アクションをフェードイン */
            action.reset().fadeIn(CROSS_FADE_DURATION).play();
          } else if (!previousActions.includes(action)) {
            /** 初回入場または再入場: そのまま再生 */
            action.reset().play();
          }
          /** 同一インデックスの再実行（isStartControls 変化など）はすでに再生中のためスキップ */

          nextActions.push(action);
        }

        if (animation.name.includes('_E_') && !isMatchingPart) {
          /** 非選択パーツ: _E_ アニメーションでリセット */
          action.reset().play();
        }

        if (animation.name.includes('_E_') && isMatchingPart) {
          /** 選択パーツ: _E_ は停止（_S_ が再生されるため） */
          action.stop();
        }
      });

      /** 前回の _S_ アクションのうち次の選択に含まれないものをフェードアウト */
      previousActions.forEach((prev) => {
        if (!nextActions.includes(prev)) {
          prev.fadeOut(CROSS_FADE_DURATION);
        }
      });

      activeActionRef.current = nextActions;
    }, [
      content.controls,
      currentIndex,
      isStartControls,
      isCameraReady,
      gltf,
      sortedAnimationNames,
    ]);

    /** モデル子要素の更新 */
    useEffect(() => {
      setModelChildren(groupRef.current!.children[0].children as ModelChildren);
    }, [setModelChildren]);

    return (
      <group name="model-container" ref={groupRef}>
        <primitive object={gltf.scene} />
      </group>
    );
  },
);

Model.displayName = 'Model';

export default Model;
