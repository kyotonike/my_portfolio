import { Vector3 } from 'three';

/**
 * シーン中心を軸にした球面線形補間（slerp）でカメラ位置を補間する。
 *
 * カメラは常にシーン中心を「中心」とした球面上を移動するため、
 * 前後対称経路では「上を越える」、左右対称経路では「外周を回る」
 * 自然な経路になる。
 *
 * @param startPos    アニメーション開始時のカメラ位置
 * @param endPos      目標カメラ位置
 * @param sceneCenter シーンのバウンディングボックス中心
 * @param t           補間パラメータ [0, 1]
 * @param bboxRadius  バウンディングボックスの外接球半径。
 *   横バイアスの実ワールド変位をこの値以内に制限する（遠距離での過剰なスイングを防ぐ）。
 * @param arcBias     横バイアスの強度倍率。0=バイアスなし、1=デフォルト、2=2倍。
 * @param midCameraForward t=0.5 時点のカメラ前方ベクトル。
 *   対蹠点補正のバイアス方向（biasDir）がカメラ視線と同方向の場合、符号を反転して
 *   カメラがシーンを向く側に弧を曲げる。null の場合は符号を変更しない。
 * @returns {Vector3} 補間後のカメラ位置
 
 *
 * @example
 * computeArcPosition(startPos, endPos, sceneCenter, t, bboxRadius, arcBias);
 */
export function computeArcPosition(
  startPos: Vector3,
  endPos: Vector3,
  sceneCenter: Vector3,
  t: number,
  bboxRadius: number = Infinity,
  arcBias: number = 1.0,
  midCameraForward: Vector3 | null = null,
): Vector3 {
  const fromS = startPos.clone().sub(sceneCenter);
  const fromE = endPos.clone().sub(sceneCenter);
  const distS = fromS.length();
  const distE = fromE.length();

  /** カメラがシーン中心に重なるエッジケースはフォールバック */
  if (distS < 0.001 || distE < 0.001) {
    return new Vector3().lerpVectors(startPos, endPos, t);
  }

  const dirS = fromS.divideScalar(distS);
  /** 正規化済み（fromS を上書き） */
  const dirE = fromE.divideScalar(distE);

  /** 距離はリニア補間（始点・終点距離が異なる場合もスムーズに追従） */
  const dist = distS * (1 - t) + distE * t;

  /** 方向を球面線形補間（slerp） */
  const cosTheta = Math.max(-1, Math.min(1, dirS.dot(dirE)));
  let dir: Vector3;

  if (cosTheta > 0.9999) {
    /** ほぼ同じ方向 → lerp で十分 */
    dir = new Vector3().lerpVectors(dirS, dirE, t);
    const len = dir.length();
    if (len > 0.001) dir.divideScalar(len);
    else dir.copy(dirS);
  } else {
    const theta = Math.acos(cosTheta);
    const sinTheta = Math.sin(theta);

    if (sinTheta < 0.0001) {
      /** ほぼ反対方向 (sinTheta ≈ 0) → lerp の結果は中点付近で ≈ 0 になる */
      /** 下の水平バイアスで補正するのでまずそのまま lerp */
      dir = new Vector3().lerpVectors(dirS, dirE, t);
    } else {
      /** 通常の slerp */
      const w1 = Math.sin((1 - t) * theta) / sinTheta;
      const w2 = Math.sin(t * theta) / sinTheta;
      dir = new Vector3().addScaledVector(dirS, w1).addScaledVector(dirE, w2);
    }

    /** 対蹠点付近の「垂直経路」補正 */
    /** cosTheta < -0.9（角度 > 約 154°）のとき、XZ移動に垂直な水平方向へ */
    /** sin(πt) のベル形状でバイアスを加え、カメラが「横に回り込む」弧になるよう誘導する */
    if (cosTheta < -0.9) {
      const antipodality = Math.min(1, (-cosTheta - 0.9) / 0.1);

      /** XZ 平面上の移動方向を求め、それに 90° 垂直な水平方向をバイアス軸とする */
      const ovXZ = new Vector3(endPos.x - startPos.x, 0, endPos.z - startPos.z);
      if (ovXZ.lengthSq() < 0.01) ovXZ.set(1, 0, 0);
      else ovXZ.normalize();

      /** XZ で 90° 回転（右手系） */
      const biasDir = new Vector3(-ovXZ.z, 0, ovXZ.x);

      /**
       * midCameraForward が biasDir と同方向（XZ ドット積 > 0）の場合、
       * バイアスがカメラの向いている側へ弧を押し出してしまうため符号を反転する。
       * null の場合は従来通り +1 を使用する。
       */
      const biasSign =
        midCameraForward !== null &&
        midCameraForward.x * biasDir.x + midCameraForward.z * biasDir.z > 0
          ? -1
          : 1;

      /** dist が bboxRadius を超えるほど遠くにあるとき、横変位をバウンディングボックス半径に収める */
      const biasCap = isFinite(bboxRadius)
        ? Math.min(1.0, bboxRadius / Math.max(dist, 0.001))
        : 1.0;

      dir.addScaledVector(
        biasDir,
        biasSign * antipodality * arcBias * biasCap * Math.sin(Math.PI * t),
      );
    }

    const len = dir.length();
    if (len > 0.001) dir.divideScalar(len);
    else dir.copy(dirS);
  }

  return sceneCenter.clone().addScaledVector(dir, dist);
}
