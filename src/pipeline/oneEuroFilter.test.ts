import { describe, expect, it } from 'vitest';
import { OneEuroFilter2D } from './oneEuroFilter';

describe('OneEuroFilter2D — 초기화', () => {
  it('첫 호출은 입력을 그대로 돌려준다', () => {
    const f = new OneEuroFilter2D();
    const r = f.filter(0.3, -0.2, 0);
    expect(r.x).toBeCloseTo(0.3);
    expect(r.y).toBeCloseTo(-0.2);
  });
});

describe('OneEuroFilter2D — 정상 상태', () => {
  it('같은 값이 계속 들어오면 출력도 그 값에서 안정된다(드리프트 없음)', () => {
    const f = new OneEuroFilter2D();
    let last = { x: 0, y: 0 };
    for (let i = 0; i < 30; i++) last = f.filter(0.4, 0.4, i * 16);
    expect(last.x).toBeCloseTo(0.4, 3);
    expect(last.y).toBeCloseTo(0.4, 3);
  });
});

describe('OneEuroFilter2D — 떨림 억제', () => {
  it('정지된 신호 위의 고주파 노이즈를 원래 진폭보다 크게 줄인다', () => {
    const f = new OneEuroFilter2D();
    const raw: number[] = [];
    const filtered: number[] = [];
    for (let i = 0; i < 120; i++) {
      const t = i * 16;
      const noisy = 0.5 + (i % 2 === 0 ? 0.03 : -0.03); // 고주파 왕복 떨림
      raw.push(noisy);
      filtered.push(f.filter(noisy, 0.5, t).x);
    }
    const stdev = (xs: number[]): number => {
      const mean = xs.reduce((a, b) => a + b, 0) / xs.length;
      return Math.sqrt(xs.reduce((a, b) => a + (b - mean) ** 2, 0) / xs.length);
    };
    // 초반 수렴 구간 제외하고 뒤쪽 구간만 비교
    const rawTail = raw.slice(40);
    const filteredTail = filtered.slice(40);
    expect(stdev(filteredTail)).toBeLessThan(stdev(rawTail) * 0.5);
  });
});

describe('OneEuroFilter2D — 계단 응답', () => {
  it('계단 입력 후 여러 프레임에 걸쳐 목표에 수렴한다', () => {
    const f = new OneEuroFilter2D();
    f.filter(0, 0, 0); // 초기값에서 정지
    for (let i = 1; i < 10; i++) f.filter(0, 0, i * 16);

    let last = { x: 0, y: 0 };
    for (let i = 10; i < 40; i++) last = f.filter(1, 0, i * 16); // 계단: 0 -> 1
    expect(last.x).toBeGreaterThan(0.9); // 충분한 프레임 후엔 목표 근처까지 수렴
  });

  it('beta가 클수록(고속 반응성) 같은 시간 안에 목표에 더 가까이 도달한다', () => {
    const low = new OneEuroFilter2D({ minCutoff: 1.2, beta: 0, derivativeCutoff: 1.0 });
    const high = new OneEuroFilter2D({ minCutoff: 1.2, beta: 3.0, derivativeCutoff: 1.0 });
    for (const f of [low, high]) {
      f.filter(0, 0, 0);
      for (let i = 1; i < 5; i++) f.filter(0, 0, i * 16);
    }
    let lastLow = { x: 0, y: 0 };
    let lastHigh = { x: 0, y: 0 };
    for (let i = 5; i < 12; i++) {
      lastLow = low.filter(1, 0, i * 16);
      lastHigh = high.filter(1, 0, i * 16);
    }
    expect(lastHigh.x).toBeGreaterThan(lastLow.x);
  });
});

describe('OneEuroFilter2D — reset()', () => {
  it('reset 이후 첫 호출은 다시 입력을 그대로 돌려준다', () => {
    const f = new OneEuroFilter2D();
    f.filter(0, 0, 0);
    for (let i = 1; i < 10; i++) f.filter(0, 0, i * 16);
    f.reset();
    const r = f.filter(0.7, 0.7, 1000);
    expect(r.x).toBeCloseTo(0.7);
  });
});
