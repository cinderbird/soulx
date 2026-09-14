/**
 * 매 프레임 독립적으로 내려진 판단을 여러 프레임에 걸쳐 누적한다.
 * 한 프레임의 우연으로 화면이 흔들리지 않게 하는 것이 목적이다.
 *
 * 최근 몇 번 중 몇 번 이상 찾아야 대상을 확정하고, 확정된 뒤에는 몇 프레임까지
 * 놓침을 견딜지를 정한다. 견디는 동안에는 마지막 위치를 유지한다.
 */
export interface LifecycleConfig {
  /** 최근 confirmN번 중 이 횟수 이상 찾아야 대상을 확정한다. */
  confirmM: number;
  /** 확정 여부를 판단할 때 돌아보는 프레임 수. */
  confirmN: number;
  /** 확정된 대상이 견디는 최대 연속 놓침 횟수(프레임). 넘으면 잃은 것으로 본다. */
  maxMisses: number;
}

/**
 * 5번 중 3번(과반)으로 확정한다. 5번 모두를 요구하면 첫 확정이 느려지고,
 * 1번이면 규칙을 두는 의미가 없다.
 *
 * 8프레임(60fps 기준 130ms)은 모의 입력기의 놓침 지속 상한(15프레임)보다
 * 짧다. 상한까지 버티면 대상을 잃었다고 인정하는 상황 자체가 일어나지 않는다.
 */
export const DEFAULT_LIFECYCLE_CONFIG: LifecycleConfig = {
  confirmM: 3,
  confirmN: 5,
  maxMisses: 8,
};

export type TrackState = 'searching' | 'confirmed' | 'coasting';

export interface LifecycleSnapshot {
  readonly state: TrackState;
  readonly x: number | null;
  readonly y: number | null;
  readonly missStreak: number;
}

export class TrackLifecycle {
  private state: TrackState = 'searching';
  private x: number | null = null;
  private y: number | null = null;
  private hits: boolean[] = [];
  private missStreak = 0;

  constructor(private cfg: LifecycleConfig = DEFAULT_LIFECYCLE_CONFIG) {}

  /** 이번 프레임에 고른 관측(없으면 null)을 반영하고 갱신된 상태를 반환한다. */
  update(matched: { readonly x: number; readonly y: number } | null): LifecycleSnapshot {
    this.pushHit(matched !== null);

    if (matched) {
      this.missStreak = 0;
      this.x = matched.x;
      this.y = matched.y;

      if (this.state === 'searching') {
        if (this.hitCountInWindow() >= this.cfg.confirmM) this.state = 'confirmed';
      } else {
        this.state = 'confirmed';
      }
    } else {
      this.missStreak++;
      if (this.state === 'confirmed' || this.state === 'coasting') {
        if (this.missStreak <= this.cfg.maxMisses) {
          this.state = 'coasting';
        } else {
          // 위치와 확정 이력을 모두 버리고 처음부터 다시 확정을 요구한다.
          this.state = 'searching';
          this.x = null;
          this.y = null;
          this.hits = [];
        }
      }
      // searching 상태의 놓침은 상태를 바꾸지 않는다. 아직 확정 전이라 더 잃을 것이 없다.
    }

    return { state: this.state, x: this.x, y: this.y, missStreak: this.missStreak };
  }

  private hitCountInWindow(): number {
    return this.hits.filter(Boolean).length;
  }

  private pushHit(hit: boolean): void {
    this.hits.push(hit);
    if (this.hits.length > this.cfg.confirmN) this.hits.shift();
  }

  reset(): void {
    this.state = 'searching';
    this.x = null;
    this.y = null;
    this.hits = [];
    this.missStreak = 0;
  }
}
