import { describe, expect, it } from 'vitest';
import { ScenarioPlayer, type ScenarioDef } from './scenario';
import { NO_FAILURES } from './recognizer';

const twoPointDef: ScenarioDef = {
  id: 'target-loss',
  label: 'test',
  description: 'test',
  toggles: NO_FAILURES,
  path: [
    { x: -1, y: 0, holdMs: 100 },
    { x: 1, y: 0, holdMs: 100 },
  ],
  transitionMs: 50,
};

const instantDef: ScenarioDef = {
  id: 'target-multiply',
  label: 'test',
  description: 'test',
  toggles: NO_FAILURES,
  path: [{ x: 0.3, y: 0.4, holdMs: 1000 }],
};

const liveDef: ScenarioDef = {
  id: 'live',
  label: 'test',
  description: 'test',
  toggles: NO_FAILURES,
};

describe('ScenarioPlayer — live', () => {
  it('경로가 없으면 항상 null을 낸다', () => {
    const p = new ScenarioPlayer(liveDef);
    expect(p.sample(0)).toBeNull();
    expect(p.sample(1000)).toBeNull();
    expect(p.isLive).toBe(true);
  });
});

describe('ScenarioPlayer — 재생', () => {
  it('시작 시점엔 첫 경유점 근처에 있다', () => {
    const p = new ScenarioPlayer(instantDef);
    const s = p.sample(0)!;
    expect(s.x).toBeCloseTo(0.3);
    expect(s.y).toBeCloseTo(0.4);
    expect(p.isLive).toBe(false);
  });

  it('전환 구간에서는 두 경유점 사이를 선형 보간한다', () => {
    const p = new ScenarioPlayer(twoPointDef);
    p.sample(0); // 첫 샘플로 시작 시각 고정
    // 첫 leg(경유점0 hold 100ms)가 끝나고 전환(50ms)의 중간 지점
    const mid = p.sample(100 + 25)!;
    expect(mid.x).toBeCloseTo(0); // -1과 1의 중간
  });

  it('한 바퀴를 돌면(주기) 같은 위치로 되돌아온다', () => {
    const p = new ScenarioPlayer(twoPointDef);
    const period = (50 + 100) * 2; // transitionMs+holdMs, 경유점 2개
    const first = p.sample(0)!;
    const afterOneLoop = p.sample(period)!;
    expect(afterOneLoop.x).toBeCloseTo(first.x);
    expect(afterOneLoop.y).toBeCloseTo(first.y);
  });

  it('같은 정의로 만든 두 플레이어는 완전히 같은 수열을 낸다(결정적)', () => {
    const a = new ScenarioPlayer(twoPointDef);
    const b = new ScenarioPlayer(twoPointDef);
    for (let t = 0; t < 500; t += 17) {
      expect(a.sample(t)).toEqual(b.sample(t));
    }
  });

  it('reset() 이후에는 다시 새로운 시작 시각 기준으로 재생한다', () => {
    const p = new ScenarioPlayer(instantDef);
    p.sample(1000);
    p.reset();
    const s = p.sample(5000)!; // reset 후 첫 호출이므로 다시 경유점 시작 근처
    expect(s.x).toBeCloseTo(0.3);
  });
});

describe('ScenarioPlayer — consumeStep', () => {
  it('구간이 바뀔 때만 한 번 계단 이벤트를 낸다', () => {
    const p = new ScenarioPlayer(twoPointDef);
    p.sample(0);
    expect(p.consumeStep()).not.toBeNull(); // 첫 샘플에서 최초 진입 계단

    p.sample(50); // 같은 구간 안
    expect(p.consumeStep()).toBeNull();

    p.sample(100 + 50 + 1); // 다음 구간으로 넘어간 직후
    const step = p.consumeStep();
    expect(step).not.toBeNull();
  });

  it('계단의 from/to가 실제 경유점 값과 일치한다', () => {
    const p = new ScenarioPlayer(twoPointDef);
    p.sample(0);
    p.consumeStep();
    p.sample(100 + 50 + 1); // 경유점0 -> 경유점1
    const step = p.consumeStep()!;
    expect(step.fromX).toBeCloseTo(-1);
    expect(step.toX).toBeCloseTo(1);
  });

  it('단일 경유점(전환 없음)에서는 시간이 지나도 새 계단이 다시 나지 않는다', () => {
    const p = new ScenarioPlayer(instantDef);
    p.sample(0);
    p.consumeStep();
    p.sample(500);
    expect(p.consumeStep()).toBeNull();
  });
});
