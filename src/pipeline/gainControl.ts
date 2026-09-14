import type { Vec2 } from '../types';

/**
 * 신뢰도가 낮은 관측을 향해 목표 지점까지 일부만 이동시킨다.
 * 그 값을 그대로 받아들이면 오검출이었을 때 조준점이 튀고, 완전히 무시하면
 * 실제 대상이었을 때 반응이 없다.
 *
 * One Euro 필터가 다루는 불확실성과는 종류가 다르다. 필터는 값이 맞지만
 * 노이즈가 섞였다고 가정하고, 이쪽은 값 자체가 틀렸을 수 있다고 가정한다.
 * 게인을 먼저 적용하므로 필터는 이미 신뢰하기로 한 값만 받는다.
 */
export interface GainConfig {
  /** 신뢰도가 낮을 때 한 프레임에 좁히는 거리의 비율(0.0 ~ 1.0). 낮을수록 신중하다. */
  cautiousGain: number;
}

/** 0.25는 약 4프레임(60fps 기준 65ms)에 걸쳐 목표에 근접한다. */
export const DEFAULT_GAIN_CONFIG: GainConfig = { cautiousGain: 0.25 };

export class GainControl {
  private x: number | null = null;
  private y: number | null = null;

  constructor(private cfg: GainConfig = DEFAULT_GAIN_CONFIG) {}

  /** 신뢰도가 낮지 않으면 목표를 그대로 반환하고, 낮으면 목표 쪽으로 cautiousGain만큼 이동한 위치를 반환한다. */
  apply(targetX: number, targetY: number, unreliable: boolean): Vec2 {
    if (this.x === null || this.y === null || !unreliable) {
      this.x = targetX;
      this.y = targetY;
      return { x: targetX, y: targetY };
    }
    this.x += (targetX - this.x) * this.cfg.cautiousGain;
    this.y += (targetY - this.y) * this.cfg.cautiousGain;
    return { x: this.x, y: this.y };
  }

  reset(): void {
    this.x = null;
    this.y = null;
  }
}
