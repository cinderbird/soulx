import type { RawObservation } from '../types';

/**
 * 직전에 받아들인 위치에서 물리적으로 도달할 수 없는 속도로 이동한 관측을 버린다.
 *
 * 여기서 모든 오검출을 잡지는 않는다. 오검출 지점이 우연히 실제 대상 근처에
 * 나타나면 통과한다. 그 판단은 데이터 연관이 맡는다. 이 단계는 누구에게나
 * 적용되는 물리적 한계만 보고, 연관은 트랙과 이어지는지를 본다.
 */
export interface GateConfig {
  /** 허용하는 최대 이동 속도(정규화 좌표 기준 초당 거리). */
  maxSpeed: number;
}

/**
 * 6.5는 모의 입력기가 "빠른 움직임"으로 보는 기준의 약 2배다. 의도적으로 빠르게
 * 그은 스와이프는 통과시키되, 한 프레임 만에 화면 반대편으로 튀는 값은 막는다.
 */
export const DEFAULT_GATE_CONFIG: GateConfig = { maxSpeed: 6.5 };

export class ValidationGate {
  private lastX: number | null = null;
  private lastY: number | null = null;
  private lastT = 0;

  constructor(private cfg: GateConfig = DEFAULT_GATE_CONFIG) {}

  /** 이번 프레임 동안 도달 가능한 거리 안의 관측만 남긴다. 비교할 기준 위치가 없으면 전부 통과시킨다. */
  filter(observations: readonly RawObservation[], nowMs: number): RawObservation[] {
    if (this.lastX === null || this.lastY === null) return [...observations];
    const dt = Math.max(1e-3, (nowMs - this.lastT) / 1000);
    const maxDist = this.cfg.maxSpeed * dt;
    const lx = this.lastX;
    const ly = this.lastY;
    return observations.filter((o) => Math.hypot(o.x - lx, o.y - ly) <= maxDist);
  }

  /**
   * 다음 프레임의 기준이 될 위치를 등록한다.
   * filter()가 직접 하지 않는 이유는, 통과한 여러 후보 중 무엇을 받아들일지는
   * 데이터 연관이 정하기 때문이다. 이 단계는 후보를 좁히기만 한다.
   */
  accept(x: number, y: number, nowMs: number): void {
    this.lastX = x;
    this.lastY = y;
    this.lastT = nowMs;
  }

  reset(): void {
    this.lastX = null;
    this.lastY = null;
    this.lastT = 0;
  }
}
