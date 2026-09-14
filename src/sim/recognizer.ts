import type { GroundTruthSample, RawFrame, RawObservation } from '../types';
import { Rng } from './rng';

/**
 * 인식 오류를 하나씩 켜고 끄는 스위치.
 * 각 처리 단계가 왜 필요한지를 오류 하나씩 켜 가며 보여주기 위한 것이다.
 */
export interface FailureToggles {
  /** 떨림의 표준편차(정규화 좌표, -1 ~ 1). 0이면 끔. */
  jitterSigma: number;
  /** 놓칠 확률의 상한(0.0 ~ 1.0). 대상이 빠르게 움직일수록 이 값에 가까워진다. 0이면 끔. */
  missWhenFastMax: number;
  /** 켜면 고정된 위치에 신뢰도가 낮은 관측을 하나 더 만든다. */
  falseDetectionEnabled: boolean;
  /** 켜면 관측 목록의 순서를 매 프레임 무작위로 섞는다. */
  shuffleOrderEnabled: boolean;
  /** 프레임 자체가 오지 않을 확률(0.0 ~ 1.0). 0이면 끔. */
  cameraStallProb: number;
}

export const NO_FAILURES: FailureToggles = {
  jitterSigma: 0,
  missWhenFastMax: 0,
  falseDetectionEnabled: false,
  shuffleOrderEnabled: false,
  cameraStallProb: 0,
};

/** 오검출 관측에 붙이는 id. 실제 대상의 id와 겹치지 않도록 음수를 쓴다. */
const FALSE_DETECTION_SOURCE_ID = -1;

/**
 * 실제 위치 위에 인식 오류를 얹어 카메라의 출력을 흉내 낸다.
 *
 * 무작위 노이즈만으로는 부족하다. 실제 인식 장치는 균일하게 틀리지 않는다.
 * 빠르게 움직일 때 더 자주 놓치고, 배경을 대상으로 착각하며, 결과의 순서를
 * 보장하지 않는다. 이 클래스는 그 편향된 실패 방식을 재현한다.
 */
export class MockRecognizer {
  private rng: Rng;
  /** 떨림의 현재 상태. 매 프레임 새로 뽑지 않고 직전 값에서 이어진다. */
  private jx = 0;
  private jy = 0;
  /** 속도 계산에 쓰는 직전 위치와 시각. */
  private lastGx: number | null = null;
  private lastGy = 0;
  private lastGt = 0;
  /** 놓침이 이어질 남은 프레임 수. 0이면 정상 검출 중이다. */
  private missHoldFrames = 0;
  /** 오검출 지점의 위치. 한 번 정한 뒤 바뀌지 않는다. 벽에 붙은 물체는 움직이지 않는다. */
  private falseSpotX = 0;
  private falseSpotY = 0;
  private falseSpotInited = false;

  constructor(
    private cfg: FailureToggles,
    private seed = 0x5eed,
  ) {
    this.rng = new Rng(seed);
  }

  setConfig(cfg: FailureToggles): void {
    this.cfg = cfg;
  }

  /** 이번 프레임의 인식 결과를 반환한다. null이면 카메라가 프레임을 내보내지 않은 것이다. */
  observe(ground: GroundTruthSample | null, nowMs: number): RawFrame | null {
    if (!ground) return null;

    // 가장 먼저 판정한다. 프레임 자체가 없으면 그 안의 좌표나 신뢰도는 의미가 없다.
    if (this.cfg.cameraStallProb > 0 && this.rng.next() < this.cfg.cameraStallProb) {
      return null;
    }

    // 떨림을 더하기 전, 실제 위치의 속도로 판정한다. 놓치는 원인은 실제 움직임이지
    // 나중에 얹을 노이즈가 아니다.
    let speed = 0;
    if (this.lastGx !== null) {
      const dt = Math.max(1e-3, (ground.t - this.lastGt) / 1000);
      speed = Math.hypot(ground.x - this.lastGx, ground.y - this.lastGy) / dt;
    }
    this.lastGx = ground.x;
    this.lastGy = ground.y;
    this.lastGt = ground.t;

    let missed = false;
    if (this.missHoldFrames > 0) {
      this.missHoldFrames--;
      missed = true;
    } else if (this.cfg.missWhenFastMax > 0) {
      // 이 속도를 넘으면 놓칠 확률이 상한에 도달한다. 화면 절반을 0.3초에
      // 가로지르는 정도를 "빠르다"의 기준으로 잡았다.
      const SPEED_FOR_MAX_MISS = 3.3;
      const p = Math.min(1, speed / SPEED_FOR_MAX_MISS) * this.cfg.missWhenFastMax;
      if (this.rng.next() < p) {
        // 놓침은 한 프레임으로 끝나지 않는다. 흔들린 영상은 여러 프레임에 걸쳐 인식을 방해한다.
        this.missHoldFrames = 1 + Math.floor(this.rng.next() * 15);
        missed = true;
      }
    }

    const observations: RawObservation[] = [];

    if (!missed) {
      let x = ground.x;
      let y = ground.y;

      // 매 프레임 독립적인 노이즈를 쓰지 않는다. 실제 인식 오차는 한쪽으로 치우친 채
      // 몇 프레임 이어지는 경향이 있다.
      if (this.cfg.jitterSigma > 0) {
        // 계수가 낮을수록 떨림이 더 느리고 크게 흔들린다.
        const LOWPASS = 0.35;
        this.jx = lerp(this.jx, this.rng.gauss() * this.cfg.jitterSigma, LOWPASS);
        this.jy = lerp(this.jy, this.rng.gauss() * this.cfg.jitterSigma, LOWPASS);
        x += this.jx;
        y += this.jy;
      }

      observations.push({ x, y, confidence: 1 });
    }

    // 실제 대상을 놓쳤는지와 무관하게 존재한다. 벽에 붙은 물체는 사람을 놓쳤다고 사라지지 않는다.
    if (this.cfg.falseDetectionEnabled) {
      if (!this.falseSpotInited) {
        this.falseSpotX = (this.rng.next() * 2 - 1) * 0.8;
        this.falseSpotY = (this.rng.next() * 2 - 1) * 0.8;
        this.falseSpotInited = true;
      }
      // 0.3은 실제 대상과 구분되면서도, 신뢰도만으로 곧장 걸러지지는 않는 값이다.
      observations.push({ sourceId: FALSE_DETECTION_SOURCE_ID, x: this.falseSpotX, y: this.falseSpotY, confidence: 0.3 });
    }

    // 마지막에 둔다. 앞선 오류가 만든 목록의 내용은 그대로 두고 순서만 바꿔야,
    // 뒤 단계가 순서에 의존하고 있었는지 드러난다.
    if (this.cfg.shuffleOrderEnabled && observations.length > 1) {
      shuffleInPlace(observations, this.rng);
    }

    return { t: nowMs, observations };
  }

  reset(): void {
    this.rng = new Rng(this.seed);
    this.jx = 0;
    this.jy = 0;
    this.lastGx = null;
    this.lastGy = 0;
    this.lastGt = 0;
    this.missHoldFrames = 0;
    this.falseSpotInited = false;
  }
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Fisher-Yates 셔플. 재현할 수 있도록 Math.random 대신 주어진 난수 생성기를 쓴다. */
function shuffleInPlace<T>(arr: T[], rng: Rng): void {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng.next() * (i + 1));
    const tmp = arr[i]!;
    arr[i] = arr[j]!;
    arr[j] = tmp;
  }
}
