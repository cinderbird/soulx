import { describe, expect, it } from 'vitest';
import { MockRecognizer, NO_FAILURES } from './recognizer';
import { Rng } from './rng';

describe('Rng', () => {
  it('같은 시드는 같은 수열을 낸다 (재현성)', () => {
    const a = new Rng(42);
    const b = new Rng(42);
    const seqA = Array.from({ length: 5 }, () => a.next());
    const seqB = Array.from({ length: 5 }, () => b.next());
    expect(seqA).toEqual(seqB);
  });

  it('0과 1 사이의 값을 낸다', () => {
    const r = new Rng(1);
    for (let i = 0; i < 100; i++) {
      const v = r.next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});

describe('MockRecognizer — 스켈레톤(모든 실패 꺼짐)', () => {
  it('정답을 그대로 통과시킨다', () => {
    const r = new MockRecognizer(NO_FAILURES);
    const frame = r.observe({ t: 0, x: 0.42, y: -0.13 }, 0);
    expect(frame).not.toBeNull();
    expect(frame!.observations).toHaveLength(1);
    expect(frame!.observations[0]!.x).toBeCloseTo(0.42);
    expect(frame!.observations[0]!.y).toBeCloseTo(-0.13);
  });

  it('정답이 없으면(아직 안 움직임) null을 낸다', () => {
    const r = new MockRecognizer(NO_FAILURES);
    expect(r.observe(null, 0)).toBeNull();
  });
});

describe('MockRecognizer — 손 떨림', () => {
  it('꺼져 있으면 정답과 정확히 같다', () => {
    const r = new MockRecognizer(NO_FAILURES);
    for (let i = 0; i < 20; i++) {
      const f = r.observe({ t: i, x: 0.3, y: 0.3 }, i)!;
      expect(f.observations[0]!.x).toBeCloseTo(0.3);
    }
  });

  it('켜면 실제 위치와 달라지지만, 프레임 간 변화는 완만하다', () => {
    const r = new MockRecognizer({ ...NO_FAILURES, jitterSigma: 0.05 });
    const xs: number[] = [];
    for (let i = 0; i < 60; i++) {
      xs.push(r.observe({ t: i * 33, x: 0, y: 0 }, i * 33)!.observations[0]!.x);
    }
    // 최소 몇 개는 정답(0)과 눈에 띄게 달라야 한다
    expect(xs.some((x) => Math.abs(x) > 0.01)).toBe(true);
    // 직전 값에서 이어지므로 프레임 간 변화가 표준편차 자체보다 작아야 한다
    const deltas = xs.slice(1).map((x, i) => Math.abs(x - xs[i]!));
    const meanDelta = deltas.reduce((a, b) => a + b, 0) / deltas.length;
    expect(meanDelta).toBeLessThan(0.05);
  });
});

describe('MockRecognizer — 카메라 멈춤', () => {
  it('확률 1이면 항상 null(프레임 자체가 안 옴)', () => {
    const r = new MockRecognizer({ ...NO_FAILURES, cameraStallProb: 1 });
    for (let i = 0; i < 10; i++) {
      expect(r.observe({ t: i, x: 0, y: 0 }, i)).toBeNull();
    }
  });

  it('확률 0이면 항상 프레임이 온다', () => {
    const r = new MockRecognizer({ ...NO_FAILURES, cameraStallProb: 0 });
    for (let i = 0; i < 10; i++) {
      expect(r.observe({ t: i, x: 0, y: 0 }, i)).not.toBeNull();
    }
  });
});

describe('MockRecognizer — 빠를 때 놓침', () => {
  it('정지해 있으면(속도 0) 놓침이 거의 발생하지 않는다', () => {
    const r = new MockRecognizer({ ...NO_FAILURES, missWhenFastMax: 1 });
    let misses = 0;
    for (let i = 0; i < 30; i++) {
      const f = r.observe({ t: i * 33, x: 0.2, y: 0.2 }, i * 33)!;
      if (f.observations.length === 0) misses++;
    }
    expect(misses).toBe(0);
  });

  it('빠르게 움직이면 놓침이 발생하고, 프레임은 여전히 온다(빈 배열이지 null이 아니다)', () => {
    const r = new MockRecognizer({ ...NO_FAILURES, missWhenFastMax: 1 });
    let sawMiss = false;
    let x = -0.9;
    for (let i = 0; i < 40; i++) {
      x += 0.15; // 빠른 이동
      const f = r.observe({ t: i * 33, x, y: 0 }, i * 33);
      expect(f).not.toBeNull(); // 카메라 멈춤과 달리 프레임 자체는 온다
      if (f!.observations.length === 0) sawMiss = true;
    }
    expect(sawMiss).toBe(true);
  });

  it('놓침은 단일 프레임이 아니라 여러 프레임 지속된다', () => {
    const r = new MockRecognizer({ ...NO_FAILURES, missWhenFastMax: 1 });
    let x = -0.9;
    const misses: boolean[] = [];
    for (let i = 0; i < 40; i++) {
      x += 0.15;
      const f = r.observe({ t: i * 33, x, y: 0 }, i * 33)!;
      misses.push(f.observations.length === 0);
    }
    // 연속 놓침(길이 2 이상인 구간)이 적어도 한 번은 있어야 한다
    let hasStreak = false;
    for (let i = 0; i < misses.length - 1; i++) {
      if (misses[i] && misses[i + 1]) hasStreak = true;
    }
    expect(hasStreak).toBe(true);
  });
});

describe('MockRecognizer — 엉뚱한 곳 오인식(잘못 인식된 점)', () => {
  it('꺼져 있으면 관측이 하나뿐이다', () => {
    const r = new MockRecognizer(NO_FAILURES);
    const f = r.observe({ t: 0, x: 0.1, y: 0.1 }, 0)!;
    expect(f.observations).toHaveLength(1);
  });

  it('켜져 있으면 실제 대상 + 잘못 인식된 점, 총 둘이다', () => {
    const r = new MockRecognizer({ ...NO_FAILURES, falseDetectionEnabled: true });
    const f = r.observe({ t: 0, x: 0.1, y: 0.1 }, 0)!;
    expect(f.observations).toHaveLength(2);
  });

  it('잘못 인식된 점 위치는 프레임이 지나도 고정이다 (포스터는 움직이지 않는다)', () => {
    const r = new MockRecognizer({ ...NO_FAILURES, falseDetectionEnabled: true });
    const ghostAt = (f: ReturnType<typeof r.observe>) =>
      f!.observations.find((o) => o.sourceId === -1)!;

    const first = ghostAt(r.observe({ t: 0, x: -0.5, y: 0.2 }, 0));
    const second = ghostAt(r.observe({ t: 33, x: 0.5, y: -0.2 }, 33));
    expect(second.x).toBeCloseTo(first.x);
    expect(second.y).toBeCloseTo(first.y);
  });

  it('실제 대상이 놓침 상태여도 잘못 인식된 점은 그대로 남는다', () => {
    const r = new MockRecognizer({ ...NO_FAILURES, missWhenFastMax: 1, falseDetectionEnabled: true });
    let x = -0.9;
    let sawGhostAlone = false;
    for (let i = 0; i < 40; i++) {
      x += 0.15;
      const f = r.observe({ t: i * 33, x, y: 0 }, i * 33)!;
      if (f.observations.length === 1 && f.observations[0]!.sourceId === -1) sawGhostAlone = true;
    }
    expect(sawGhostAlone).toBe(true);
  });
});

describe('MockRecognizer — 인식 순서 뒤섞기', () => {
  it('꺼져 있으면 순서가 항상 같다 (실제 대상이 index 0)', () => {
    const r = new MockRecognizer({ ...NO_FAILURES, falseDetectionEnabled: true });
    for (let i = 0; i < 20; i++) {
      const f = r.observe({ t: i * 33, x: 0.1, y: 0.1 }, i * 33)!;
      expect(f.observations[0]!.sourceId).toBeUndefined(); // 실제 대상은 sourceId 없음
      expect(f.observations[1]!.sourceId).toBe(-1); // 잘못 인식된 점
    }
  });

  it('켜져 있으면 실제 대상이 index 0이 아닌 프레임도 나온다', () => {
    const r = new MockRecognizer({ ...NO_FAILURES, falseDetectionEnabled: true, shuffleOrderEnabled: true });
    let sawRealSecond = false;
    for (let i = 0; i < 30; i++) {
      const f = r.observe({ t: i * 33, x: 0.1, y: 0.1 }, i * 33)!;
      if (f.observations[0]!.sourceId === -1) sawRealSecond = true;
    }
    expect(sawRealSecond).toBe(true);
  });

  it('순서 뒤섞기은 순서만 바꾸고 내용(집합)은 그대로 보존한다', () => {
    const r = new MockRecognizer({ ...NO_FAILURES, falseDetectionEnabled: true, shuffleOrderEnabled: true });
    for (let i = 0; i < 15; i++) {
      const f = r.observe({ t: i * 33, x: 0.1, y: 0.1 }, i * 33)!;
      const ids = f.observations.map((o) => o.sourceId ?? 'real').sort();
      expect(ids).toEqual(['real', -1].sort());
    }
  });
});
