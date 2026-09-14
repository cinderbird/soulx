import type { Vec2 } from '../types';

/**
 * 의도적인 움직임으로 보기 어려운 미세한 이동을 무시한다.
 * 저주파 통과 필터는 입력을 뒤따라가므로, 손을 가만히 두어도 보정을 거친
 * 조준점에는 미세한 흔들림이 남는다.
 *
 * 직전 입력값이 아니라 마지막으로 받아들인 출력과 비교한다. 그래서 천천히
 * 움직이는 의도적인 이동은 반경을 넘을 때까지 누적됐다가 한 번에 반영되며,
 * 영영 묻히지 않는다. 대가는 그만큼의 지연이다.
 */
export interface DeadzoneConfig {
  /** 이 거리보다 짧은 이동은 움직이지 않은 것으로 본다(정규화 좌표, -1 ~ 1). */
  radius: number;
}

/** 0.006은 보정 후 프레임당 남는 흔들림보다 조금 작다. 더 키우면 느린 조준의 반응이 눈에 띄게 나빠진다. */
export const DEFAULT_DEADZONE_CONFIG: DeadzoneConfig = { radius: 0.006 };

export class Deadzone {
  private lastX: number | null = null;
  private lastY: number | null = null;

  constructor(private cfg: DeadzoneConfig = DEFAULT_DEADZONE_CONFIG) {}

  /** 입력이 반경 안이면 마지막으로 받아들인 위치를, 반경을 넘으면 입력을 그대로 반환한다. */
  apply(x: number, y: number): Vec2 {
    if (this.lastX === null || this.lastY === null) {
      this.lastX = x;
      this.lastY = y;
      return { x, y };
    }
    const d = Math.hypot(x - this.lastX, y - this.lastY);
    if (d < this.cfg.radius) {
      return { x: this.lastX, y: this.lastY };
    }
    this.lastX = x;
    this.lastY = y;
    return { x, y };
  }

  reset(): void {
    this.lastX = null;
    this.lastY = null;
  }
}
