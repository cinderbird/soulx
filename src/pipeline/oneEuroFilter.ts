import type { Vec2 } from '../types';

class LowPassFilter {
  private y = 0;
  private initialized = false;

  filter(x: number, alpha: number): number {
    if (!this.initialized) {
      this.y = x;
      this.initialized = true;
      return x;
    }
    this.y = alpha * x + (1 - alpha) * this.y;
    return this.y;
  }

  reset(): void {
    this.initialized = false;
    this.y = 0;
  }
}

function smoothingFactor(dt: number, cutoff: number): number {
  const r = 2 * Math.PI * cutoff * dt;
  return r / (r + 1);
}

export interface OneEuroConfig {
  /** 정지 상태의 차단 주파수(Hz). 낮을수록 멈췄을 때의 떨림을 강하게 억누른다. */
  minCutoff: number;
  /** 속도에 비례해 차단 주파수를 올리는 정도. 클수록 빠른 움직임의 지연이 줄어든다. */
  beta: number;
  /** 속도 추정에 쓰는 차단 주파수(Hz). 대개 1.0으로 충분하다. */
  derivativeCutoff: number;
}

/**
 * 이 필터가 흔히 소개되는 값(minCutoff 약 1.0, beta 약 0.007)은 픽셀 좌표를
 * 전제한다. 여기서는 화면을 -1 ~ 1로 정규화해 쓰므로 떨림의 상대적 크기가 훨씬
 * 커서 그대로 쓰면 보정이 거의 걸리지 않는다.
 *
 * 반응 속도를 실측하며 올린 값이다. beta 1.4는 빠른 스와이프에서도 반응이
 * 지연 예산(40ms) 근처에 머물게 하고, minCutoff 1.2는 정지 구간의 떨림을 잡는다.
 */
export const DEFAULT_ONE_EURO_CONFIG: OneEuroConfig = {
  minCutoff: 1.2,
  beta: 1.4,
  derivativeCutoff: 1.0,
};

class OneEuroFilter1D {
  private xFilter = new LowPassFilter();
  private dxFilter = new LowPassFilter();
  private lastX: number | null = null;
  private lastT: number | null = null;

  constructor(private cfg: OneEuroConfig) {}

  filter(x: number, tMs: number): number {
    if (this.lastT === null) {
      this.lastT = tMs;
      this.lastX = x;
      this.xFilter.filter(x, 1);
      this.dxFilter.filter(0, 1);
      return x;
    }
    const dt = Math.max(1e-3, (tMs - this.lastT) / 1000);
    this.lastT = tMs;

    const dx = (x - (this.lastX ?? x)) / dt;
    this.lastX = x;

    const edx = this.dxFilter.filter(dx, smoothingFactor(dt, this.cfg.derivativeCutoff));
    const cutoff = this.cfg.minCutoff + this.cfg.beta * Math.abs(edx);
    return this.xFilter.filter(x, smoothingFactor(dt, cutoff));
  }

  reset(): void {
    this.xFilter.reset();
    this.dxFilter.reset();
    this.lastX = null;
    this.lastT = null;
  }
}

/**
 * One Euro 필터 구현(Casiez et al., CHI 2012).
 * 이동 속도에 따라 차단 주파수를 조절해, 멈춰 있을 때는 강하게 보정하고
 * 빠르게 움직일 때는 보정을 줄여 지연을 낮춘다.
 *
 * 차단 주파수를 하나로 고정하면 둘 중 하나만 얻는다. 낮게 고정하면 떨림은
 * 줄지만 빠른 움직임에서 지연이 생기고, 높게 고정하면 반응은 빠르지만 떨림이
 * 남는다. 이 상충이 속도에 따라 차단 주파수를 바꾸는 이유다.
 *
 * @see https://gery.casiez.net/1euro/
 */
export class OneEuroFilter2D {
  private fx: OneEuroFilter1D;
  private fy: OneEuroFilter1D;

  constructor(cfg: OneEuroConfig = DEFAULT_ONE_EURO_CONFIG) {
    this.fx = new OneEuroFilter1D(cfg);
    this.fy = new OneEuroFilter1D(cfg);
  }

  filter(x: number, y: number, nowMs: number): Vec2 {
    return { x: this.fx.filter(x, nowMs), y: this.fy.filter(y, nowMs) };
  }

  reset(): void {
    this.fx.reset();
    this.fy.reset();
  }
}
