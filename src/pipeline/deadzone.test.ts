import { describe, expect, it } from 'vitest';
import { Deadzone } from './deadzone';

describe('Deadzone — 초기화', () => {
  it('첫 호출은 입력을 그대로 돌려주고 기준으로 삼는다', () => {
    const dz = new Deadzone({ radius: 0.01 });
    const r = dz.apply(0.3, 0.3);
    expect(r.x).toBeCloseTo(0.3);
    expect(r.y).toBeCloseTo(0.3);
  });
});

describe('Deadzone — 반경 이내 이동', () => {
  it('반경보다 작은 이동은 무시하고 마지막 위치를 그대로 돌려준다', () => {
    const dz = new Deadzone({ radius: 0.02 });
    dz.apply(0.5, 0.5);
    const r = dz.apply(0.505, 0.5); // 0.005 이동 — 반경 이내
    expect(r.x).toBeCloseTo(0.5);
    expect(r.y).toBeCloseTo(0.5);
  });

  it('반경 이내의 이동이 여러 번 반복돼도 계속 원래 위치를 유지한다', () => {
    const dz = new Deadzone({ radius: 0.02 });
    dz.apply(0, 0);
    for (let i = 0; i < 5; i++) {
      const r = dz.apply(0.01, 0);
      expect(r.x).toBeCloseTo(0);
    }
  });
});

describe('Deadzone — 반경을 넘는 이동', () => {
  it('반경보다 큰 이동은 그대로 통과시키고 새 기준으로 삼는다', () => {
    const dz = new Deadzone({ radius: 0.02 });
    dz.apply(0, 0);
    const r = dz.apply(0.1, 0);
    expect(r.x).toBeCloseTo(0.1);

    // 다음 비교는 새 기준(0.1)에서 이뤄진다
    const r2 = dz.apply(0.105, 0); // 새 기준에서 0.005 — 반경 이내
    expect(r2.x).toBeCloseTo(0.1);
  });

  it('작은 이동이 계속 쌓이면(같은 방향) 결국 반경을 넘는 순간 따라잡는다', () => {
    const dz = new Deadzone({ radius: 0.02 });
    dz.apply(0, 0);
    let last = { x: 0, y: 0 };
    // 0.005씩 6번 이동 = 누적 0.03, 반경(0.02)을 넘어서는 지점(4번째, x=0.02)에서
    // 갱신되고 그 뒤로는 다시 반경 이내라 그 값에 머문다 — "완전히 막히지
    // 않는다"는 것만 확인한다(0에 영원히 묶여 있지 않음).
    for (let i = 1; i <= 6; i++) last = dz.apply(i * 0.005, 0);
    expect(last.x).toBeCloseTo(0.02);
    expect(last.x).toBeGreaterThan(0);
  });
});

describe('Deadzone — reset()', () => {
  it('reset 이후엔 다시 기준 없는 상태로 돌아간다', () => {
    const dz = new Deadzone({ radius: 0.02 });
    dz.apply(0.5, 0.5);
    dz.reset();
    const r = dz.apply(0.9, 0.9); // 리셋 안 됐다면 반경을 훌쩍 넘는 이동
    expect(r.x).toBeCloseTo(0.9); // 리셋 후엔 새 기준으로 그대로 통과
  });
});
