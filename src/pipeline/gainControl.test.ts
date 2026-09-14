import { describe, expect, it } from 'vitest';
import { GainControl } from './gainControl';

describe('GainControl — 정상 신뢰도(degraded=false)', () => {
  it('첫 호출은 목표를 그대로 받아들인다', () => {
    const g = new GainControl();
    const r = g.apply(0.3, 0.3, false);
    expect(r.x).toBeCloseTo(0.3);
  });

  it('degraded가 아니면 항상 목표를 그대로 통과시킨다(게인이 끼지 않는다)', () => {
    const g = new GainControl();
    g.apply(0, 0, false);
    const r = g.apply(0.9, -0.9, false); // 큰 점프여도 그대로
    expect(r.x).toBeCloseTo(0.9);
    expect(r.y).toBeCloseTo(-0.9);
  });
});

describe('GainControl — UNRELIABLE(degraded=true)', () => {
  it('목표까지 한 번에 가지 않고 일부만 이동한다', () => {
    const g = new GainControl({ cautiousGain: 0.25 });
    g.apply(0, 0, false); // 기준점 확보
    const r = g.apply(1, 0, true); // 큰 목표, 하지만 degraded
    expect(r.x).toBeCloseTo(0.25);
    expect(r.x).toBeLessThan(1);
  });

  it('같은 목표로 반복 호출하면 점점 목표에 가까워진다(수렴)', () => {
    const g = new GainControl({ cautiousGain: 0.25 });
    g.apply(0, 0, false);
    let last = { x: 0, y: 0 };
    for (let i = 0; i < 20; i++) last = g.apply(1, 0, true);
    expect(last.x).toBeGreaterThan(0.99); // 충분히 반복하면 거의 도달
  });

  it('기준점이 아직 없으면(첫 호출) degraded여도 목표를 그대로 받아들인다', () => {
    const g = new GainControl({ cautiousGain: 0.1 });
    const r = g.apply(0.7, 0.7, true); // 비교할 기준이 없으니 통과
    expect(r.x).toBeCloseTo(0.7);
  });
});

describe('GainControl — reset()', () => {
  it('reset 후 다음 호출은 다시 기준 없는 상태로 돌아간다', () => {
    const g = new GainControl({ cautiousGain: 0.1 });
    g.apply(0, 0, false);
    g.reset();
    const r = g.apply(0.5, 0.5, true); // 리셋 후엔 degraded여도 그대로 통과
    expect(r.x).toBeCloseTo(0.5);
  });
});
