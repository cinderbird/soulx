import { describe, expect, it } from 'vitest';
import { SignalMetrics, StepResponseMeter } from './signalMetrics';

describe('SignalMetrics — RMSE', () => {
  it('출력이 정답과 완전히 같으면 0이다', () => {
    const m = new SignalMetrics();
    for (let i = 0; i < 10; i++) m.sample(i, 0.1 * i, 0.2 * i, 0.1 * i, 0.2 * i);
    expect(m.rmse()).toBeCloseTo(0);
  });

  it('알려진 고정 오차에서 정확한 값을 낸다', () => {
    // 모든 샘플에서 x가 정확히 0.3만큼 어긋나 있으면 RMSE는 정확히 0.3이어야 한다.
    const m = new SignalMetrics();
    for (let i = 0; i < 5; i++) m.sample(i, 0, 0, 0.3, 0);
    expect(m.rmse()).toBeCloseTo(0.3);
  });

  it('샘플이 없으면 0이다', () => {
    const m = new SignalMetrics();
    expect(m.rmse()).toBe(0);
  });

  it('capacity를 넘으면 오래된 샘플을 버린다', () => {
    const m = new SignalMetrics(3);
    m.sample(0, 0, 0, 5, 5); // 곧 밀려날 큰 오차 샘플
    m.sample(1, 0, 0, 0, 0);
    m.sample(2, 0, 0, 0, 0);
    m.sample(3, 0, 0, 0, 0);
    expect(m.count).toBe(3);
    expect(m.rmse()).toBeCloseTo(0);
  });
});

describe('SignalMetrics — 멈췄을 때의 떨림', () => {
  it('출력이 정답을 정확히 따라가면(정지 구간에서도) 0에 가깝다', () => {
    const m = new SignalMetrics();
    for (let i = 0; i < 20; i++) m.sample(i, 0.5, 0.5, 0.5, 0.5); // 정답도 정지, 출력도 정지
    expect(m.stationaryJitter()).toBeCloseTo(0);
  });

  it('정답이 정지한 구간에서 출력이 흔들리면 양수가 나온다', () => {
    // 흔들림의 "폭"이 프레임마다 달라야 한다 — 진폭이 일정한 순수 왕복은
    // 프레임 간 이동 거리가 매번 같아서 표준편차(=이 지표)가 0이 된다.
    const m = new SignalMetrics();
    const wobbles = [0.01, -0.02, 0.015, -0.005, 0.03, -0.01, 0.02, -0.025];
    for (let i = 0; i < wobbles.length; i++) {
      m.sample(i, 0.5, 0.5, 0.5 + wobbles[i]!, 0.5); // 정답은 정지, 출력만 흔들림
    }
    expect(m.stationaryJitter()).toBeGreaterThan(0);
  });

  it('흔들림의 이동 거리가 매 프레임 똑같으면(진폭 일정한 왕복) 0이다', () => {
    // 이 지표가 재는 것은 "얼마나 흔들렸는가"가 아니라 "흔들림의 크기가
    // 프레임마다 얼마나 들쭉날쭉한가"다 — 문서화된 설계를 고정하는 회귀 테스트.
    const m = new SignalMetrics();
    for (let i = 0; i < 20; i++) {
      const wobble = i % 2 === 0 ? 0.02 : -0.02;
      m.sample(i, 0.5, 0.5, 0.5 + wobble, 0.5);
    }
    expect(m.stationaryJitter()).toBeCloseTo(0);
  });

  it('정답이 계속 움직이는 구간은 멈췄을 때의 떨림 계산에서 제외된다', () => {
    const m = new SignalMetrics();
    // 정답이 매 프레임 크게 움직임 → 정지 구간(threshold 미만)이 없어야 함
    for (let i = 0; i < 20; i++) m.sample(i, i * 0.1, 0, i * 0.1, 0);
    expect(m.summary().stationarySampleCount).toBe(0);
    expect(m.stationaryJitter()).toBe(0);
  });
});

describe('SignalMetrics — summary', () => {
  it('샘플 수와 정지 샘플 수를 함께 보고한다', () => {
    const m = new SignalMetrics();
    for (let i = 0; i < 5; i++) m.sample(i, 0.5, 0.5, 0.5, 0.5);
    const s = m.summary();
    expect(s.sampleCount).toBe(5);
    expect(s.stationarySampleCount).toBeGreaterThan(0);
  });

  it('reset()은 모든 샘플을 지운다', () => {
    const m = new SignalMetrics();
    m.sample(0, 0, 0, 0, 0);
    m.reset();
    expect(m.count).toBe(0);
    expect(m.rmse()).toBe(0);
  });
});

describe('StepResponseMeter', () => {
  it('아직 계단이 없으면 null이다', () => {
    const meter = new StepResponseMeter();
    meter.update(100, 0, 0);
    expect(meter.lastResponseMs()).toBeNull();
  });

  it('출력이 목표의 90%에 도달한 시점을 ms로 낸다', () => {
    const meter = new StepResponseMeter();
    meter.markStep(0, 0, 0, 1, 0); // (0,0) -> (1,0) 계단
    meter.update(10, 0.5, 0); // 50% 진행 — 아직 미도달
    expect(meter.lastResponseMs()).toBeNull();
    meter.update(20, 0.95, 0); // 95% 진행 — 도달
    expect(meter.lastResponseMs()).toBe(20);
  });

  it('한 번 도달하면 이후 갱신에 값이 바뀌지 않는다(마지막 계단 기준)', () => {
    const meter = new StepResponseMeter();
    meter.markStep(0, 0, 0, 1, 0);
    meter.update(20, 0.95, 0);
    expect(meter.lastResponseMs()).toBe(20);
    meter.update(50, 1, 0); // 이후 프레임은 무시되어야 함
    expect(meter.lastResponseMs()).toBe(20);
  });

  it('새 markStep은 이전 도달 기록을 초기화한다', () => {
    const meter = new StepResponseMeter();
    meter.markStep(0, 0, 0, 1, 0);
    meter.update(20, 0.95, 0);
    expect(meter.lastResponseMs()).toBe(20);

    meter.markStep(100, 1, 0, 1, 1); // 새 계단
    expect(meter.lastResponseMs()).toBeNull();
    meter.update(130, 1, 0.95);
    expect(meter.lastResponseMs()).toBe(30);
  });

  it('시작과 목표가 같으면(이동량 0) 계산을 시도하지 않고 null로 남는다', () => {
    const meter = new StepResponseMeter();
    meter.markStep(0, 0.2, 0.2, 0.2, 0.2);
    meter.update(50, 0.2, 0.2);
    expect(meter.lastResponseMs()).toBeNull();
  });
});
