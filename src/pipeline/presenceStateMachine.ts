import type { LifecycleSnapshot } from './trackLifecycle';

/**
 * 추적 상태를 화면에 안내할 수 있는 형태로 번역한다.
 *
 * LOST와 CAMERA_STOPPED을 나누는 것이 핵심이다. 인식기가 프레임 자체를 내지 않으면
 * 카메라가 멈춘 것이고, 빈 프레임을 내면 카메라는 살아 있는데 대상만 못 찾은 것이다.
 * 사용자가 해야 할 일이 다르므로 끝까지 구분해서 전달한다.
 *
 *   IDLE            추적할 대상이 아직 한 번도 들어오지 않았다.
 *   ACQUIRING       한 번도 확정된 적 없는 대상을 확정하는 중이다.
 *   LIVE            확정된 대상을 정상적으로 추적하고 있다.
 *   HOLDING         잠깐 놓쳐서 마지막 위치를 유지하는 중이다.
 *   UNRELIABLE      추적 중이지만 고른 관측의 신뢰도가 낮다.
 *   LOST            확정됐던 대상을 견딜 수 있는 한계를 넘겨 놓쳤다.
 *   CAMERA_STOPPED  인식기가 프레임을 내지 않는 상태가 이어진다.
 */
export type PresenceState = 'IDLE' | 'ACQUIRING' | 'LIVE' | 'HOLDING' | 'UNRELIABLE' | 'LOST' | 'CAMERA_STOPPED';

export interface PresenceConfig {
  /** 이 횟수만큼 연속으로 프레임이 오지 않으면 카메라가 멈춘 것으로 본다. */
  sourceDownStreak: number;
  /** 고른 관측의 신뢰도가 이 값보다 낮으면 UNRELIABLE로 본다(0.0 ~ 1.0). */
  degradedConfidence: number;
}

/**
 * 프레임 끊김은 프레임마다 독립적으로 일어나므로 연속 6번은 우연히 발생하기 어렵다
 * (확률이 0.3이어도 0.3^6 ≈ 0.07%). 한 프레임의 우연한 결측에는 반응하지 않으면서,
 * 60fps 기준 100ms 안에 판정할 수 있는 지점이다.
 */
export const DEFAULT_PRESENCE_CONFIG: PresenceConfig = {
  sourceDownStreak: 6,
  degradedConfidence: 0.6,
};

export interface PresenceInput {
  /** 추적할 대상이 지금까지 한 번이라도 있었는지. */
  readonly hasGroundTruth: boolean;
  /** 이번 프레임에 인식기가 프레임을 내보냈는지. */
  readonly sourceAlive: boolean;
  /** 이번 프레임의 추적 상태. */
  readonly track: LifecycleSnapshot;
  /** 이번 프레임에 고른 관측의 신뢰도. 고른 것이 없으면 null. */
  readonly matchedConfidence: number | null;
}

export interface PresenceSnapshot {
  readonly state: PresenceState;
  readonly x: number | null;
  readonly y: number | null;
}

export class PresenceStateMachine {
  private everConfirmed = false;
  private sourceMissStreak = 0;

  constructor(private cfg: PresenceConfig = DEFAULT_PRESENCE_CONFIG) {}

  update(input: PresenceInput): PresenceSnapshot {
    this.sourceMissStreak = input.sourceAlive ? 0 : this.sourceMissStreak + 1;

    if (!input.hasGroundTruth) {
      return { state: 'IDLE', x: null, y: null };
    }

    if (this.sourceMissStreak >= this.cfg.sourceDownStreak) {
      return { state: 'CAMERA_STOPPED', x: null, y: null };
    }

    if (input.track.state === 'confirmed') {
      this.everConfirmed = true;
      const degraded = input.matchedConfidence !== null && input.matchedConfidence < this.cfg.degradedConfidence;
      return { state: degraded ? 'UNRELIABLE' : 'LIVE', x: input.track.x, y: input.track.y };
    }

    if (input.track.state === 'coasting') {
      return { state: 'HOLDING', x: input.track.x, y: input.track.y };
    }

    return this.everConfirmed
      ? { state: 'LOST', x: null, y: null }
      : { state: 'ACQUIRING', x: input.track.x, y: input.track.y };
  }

  reset(): void {
    this.everConfirmed = false;
    this.sourceMissStreak = 0;
  }
}
