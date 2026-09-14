/**
 * 실제 위치 대비 출력의 오차를 측정한다.
 * 실제 위치를 항상 알 수 있으므로 각 처리 단계의 효과를 수치로 확인할 수 있다.
 *
 *   평균 오차        실제 위치와 출력의 제곱평균제곱근 오차(RMSE).
 *   멈췄을 때 떨림   대상이 거의 정지한 구간에서 출력이 프레임마다 흔들린 정도.
 *   반응 속도        위치가 갑자기 바뀐 뒤 출력이 그 변화의 90%에 도달하는 시간(ms).
 */

interface Sample {
  t: number;
  gx: number;
  gy: number;
  ox: number;
  oy: number;
}

/** 이 거리보다 적게 움직이면 정지한 것으로 본다(정규화 좌표, 프레임당). */
const STATIONARY_THRESHOLD = 0.01;

export interface MetricsSummary {
  rmse: number;
  stationaryJitter: number;
  sampleCount: number;
  stationarySampleCount: number;
}

export class SignalMetrics {
  private samples: Sample[] = [];

  constructor(private capacity = 600) {}

  sample(t: number, groundX: number, groundY: number, outX: number, outY: number): void {
    this.samples.push({ t, gx: groundX, gy: groundY, ox: outX, oy: outY });
    if (this.samples.length > this.capacity) this.samples.shift();
  }

  reset(): void {
    this.samples = [];
  }

  get count(): number {
    return this.samples.length;
  }

  /** 실제 위치 대비 출력의 평균 오차. */
  rmse(): number {
    if (this.samples.length === 0) return 0;
    let sumSq = 0;
    for (const s of this.samples) {
      sumSq += (s.ox - s.gx) ** 2 + (s.oy - s.gy) ** 2;
    }
    return Math.sqrt(sumSq / this.samples.length);
  }

  /**
   * 대상이 정지한 구간에서만 출력이 프레임마다 흔들린 정도를 잰다.
   * 움직이는 구간까지 섞으면 정상적인 추적과 떨림을 구분할 수 없다.
   */
  stationaryJitter(): number {
    const stationary = this.stationarySegment();
    if (stationary.length < 3) return 0;
    const deltas: number[] = [];
    for (let i = 1; i < stationary.length; i++) {
      deltas.push(Math.hypot(stationary[i]!.ox - stationary[i - 1]!.ox, stationary[i]!.oy - stationary[i - 1]!.oy));
    }
    const mean = deltas.reduce((a, b) => a + b, 0) / deltas.length;
    const variance = deltas.reduce((a, b) => a + (b - mean) ** 2, 0) / deltas.length;
    return Math.sqrt(variance);
  }

  private stationarySegment(): Sample[] {
    const out: Sample[] = [];
    for (let i = 1; i < this.samples.length; i++) {
      const prev = this.samples[i - 1]!;
      const cur = this.samples[i]!;
      const moved = Math.hypot(cur.gx - prev.gx, cur.gy - prev.gy);
      if (moved < STATIONARY_THRESHOLD) out.push(cur);
    }
    return out;
  }

  summary(): MetricsSummary {
    return {
      rmse: this.rmse(),
      stationaryJitter: this.stationaryJitter(),
      sampleCount: this.samples.length,
      stationarySampleCount: this.stationarySegment().length,
    };
  }
}

/**
 * 위치가 갑자기 바뀐 뒤 출력이 따라잡는 데 걸리는 시간을 잰다.
 * 매 프레임 누적하는 대신 변화 시점을 외부에서 알려 줘야 하므로 별도 클래스로 둔다.
 */
export class StepResponseMeter {
  private stepStartT: number | null = null;
  private beforeX = 0;
  private beforeY = 0;
  private targetX = 0;
  private targetY = 0;
  private reachedMs: number | null = null;

  /** 위치가 갑자기 바뀐 시점과 그 전후 좌표를 기록한다. */
  markStep(nowMs: number, fromX: number, fromY: number, toX: number, toY: number): void {
    this.stepStartT = nowMs;
    this.beforeX = fromX;
    this.beforeY = fromY;
    this.targetX = toX;
    this.targetY = toY;
    this.reachedMs = null;
  }

  /** 매 프레임 출력 위치를 전달한다. 변화량의 90%에 처음 도달한 시점을 기록한다. */
  update(nowMs: number, outX: number, outY: number): void {
    if (this.stepStartT === null || this.reachedMs !== null) return;
    const total = Math.hypot(this.targetX - this.beforeX, this.targetY - this.beforeY);
    if (total < 1e-6) return;
    const remaining = Math.hypot(this.targetX - outX, this.targetY - outY);
    const progressed = 1 - remaining / total;
    if (progressed >= 0.9) {
      this.reachedMs = nowMs - this.stepStartT;
    }
  }

  /** 마지막으로 측정한 반응 시간(ms). 아직 90%에 도달하지 못했으면 null. */
  lastResponseMs(): number | null {
    return this.reachedMs;
  }
}
