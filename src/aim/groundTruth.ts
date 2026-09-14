import type { GroundTruthSample } from '../types';

/**
 * 마우스 위치를 대상의 실제 위치로 사용한다.
 *
 * 카메라 대신 마우스를 쓰면 웹캠 없이 모든 상황을 그대로 재현할 수 있고,
 * 사용자가 의도한 지점을 항상 알 수 있어 오차와 지연을 수치로 잴 수 있다.
 * 인식 장치의 출력은 이 위치에 오류를 얹어 만든다.
 */
export class GroundTruthTracker {
  private x = 0;
  private y = 0;
  private hasMoved = false;

  constructor(private target: Window | HTMLElement = window) {
    target.addEventListener('pointermove', this.onMove as EventListener);
  }

  private onMove = (e: PointerEvent): void => {
    this.x = (e.clientX / window.innerWidth) * 2 - 1;
    this.y = -((e.clientY / window.innerHeight) * 2 - 1);
    this.hasMoved = true;
  };

  /** 마우스가 아직 한 번도 움직이지 않았으면 null을 반환한다. */
  sample(nowMs: number): GroundTruthSample | null {
    if (!this.hasMoved) return null;
    return { t: nowMs, x: this.x, y: this.y };
  }

  dispose(): void {
    this.target.removeEventListener('pointermove', this.onMove as EventListener);
  }
}
