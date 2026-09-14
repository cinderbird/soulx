import type { RawObservation } from '../types';

/**
 * 통과한 후보 중 어느 것이 추적 중인 대상인지 고른다.
 *
 * 배열 순서를 전혀 보지 않는다. 인식 결과의 순서는 보장되지 않으므로
 * "첫 번째가 우리 대상"이라는 가정 자체를 쓰지 않는다. 순서가 섞이든
 * 아니든 결과가 같다는 것은 테스트로 고정해 두었다.
 */
export interface AssociationConfig {
  /** 예측 위치에서 이 거리를 넘는 후보는 다른 대상으로 본다(정규화 좌표, -1 ~ 1). */
  maxAssociationDist: number;
}

export const DEFAULT_ASSOCIATION_CONFIG: AssociationConfig = { maxAssociationDist: 0.5 };

export interface AssociationResult {
  /** 추적 중인 대상으로 판단한 관측. 없으면 null. */
  readonly observation: RawObservation | null;
  /** 예측 위치까지의 거리. 고른 후보가 없으면 null. */
  readonly distance: number | null;
}

export class DataAssociator {
  private predX: number | null = null;
  private predY: number | null = null;

  constructor(private cfg: AssociationConfig = DEFAULT_ASSOCIATION_CONFIG) {}

  /**
   * 예측 위치에 가장 가까운 후보를 반환한다. 후보가 없거나 모두 너무 멀면 null을 반환한다.
   *
   * 예측 위치가 아직 없는 첫 프레임에는 비교 기준이 없으므로 신뢰도가 가장 높은
   * 후보를 잠정 선택한다. 이 선택을 몇 프레임 뒤에 확정할지는 다음 단계가 정한다.
   *
   * 알려진 한계: 오검출 지점이 실제 대상보다 예측 위치에 가까우면 그쪽을 고른다.
   * 신뢰도로는 구분되지 않는다. 실제 대상도 흔들리면 신뢰도가 떨어지기 때문이다.
   */
  associate(candidates: readonly RawObservation[], _nowMs: number): AssociationResult {
    if (candidates.length === 0) return { observation: null, distance: null };

    if (this.predX === null || this.predY === null) {
      let best = candidates[0]!;
      for (const c of candidates) if (c.confidence > best.confidence) best = c;
      return { observation: best, distance: 0 };
    }

    const px = this.predX;
    const py = this.predY;
    let best: RawObservation | null = null;
    let bestDist = Infinity;
    for (const c of candidates) {
      const d = Math.hypot(c.x - px, c.y - py);
      if (d < bestDist) {
        bestDist = d;
        best = c;
      }
    }

    if (best === null || bestDist > this.cfg.maxAssociationDist) {
      return { observation: null, distance: best === null ? null : bestDist };
    }
    return { observation: best, distance: bestDist };
  }

  /**
   * 매칭에 성공했을 때 트랙 쪽(추후 생애주기 관리자)이 호출해 예측 위치를
   * 갱신한다. associate() 자신이 자동으로 하지 않는 이유: 매칭된 값을
   * 실제로 "채택"할지(예: 아직 확정되지 않은 트랙이라 버릴지)는 연관의
   * 책임 밖이다.
   */
  updatePrediction(x: number, y: number): void {
    this.predX = x;
    this.predY = y;
  }

  reset(): void {
    this.predX = null;
    this.predY = null;
  }
}
