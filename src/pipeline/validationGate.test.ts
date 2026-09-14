import { describe, expect, it } from 'vitest';
import { ValidationGate } from './validationGate';
import type { RawObservation } from '../types';

const obs = (x: number, y: number): RawObservation => ({ x, y, confidence: 1 });

describe('ValidationGate — 기준이 없을 때', () => {
  it('채택 위치가 아직 없으면(첫 프레임) 전부 통과시킨다', () => {
    const gate = new ValidationGate();
    const result = gate.filter([obs(0.9, -0.9), obs(-0.9, 0.9)], 0);
    expect(result).toHaveLength(2);
  });

  it('reset() 이후에도 다시 기준 없는 상태로 돌아가 전부 통과시킨다', () => {
    const gate = new ValidationGate();
    gate.accept(0, 0, 0);
    expect(gate.filter([obs(5, 5)], 16)).toHaveLength(0); // 채택 위치가 있으니 걸러짐

    gate.reset();
    expect(gate.filter([obs(5, 5)], 16)).toHaveLength(1); // 리셋 후엔 다시 기준 없음
  });
});

describe('ValidationGate — 속도 판정', () => {
  it('허용 속도 이내의 이동은 통과한다', () => {
    const gate = new ValidationGate({ maxSpeed: 6.5 });
    gate.accept(0, 0, 0);
    // 16ms 동안 0.05 이동 => 속도 ≈3.1/초, 6.5 이내
    const result = gate.filter([obs(0.05, 0)], 16);
    expect(result).toHaveLength(1);
  });

  it('허용 속도를 크게 넘는 이동(잘못 인식된 점으로의 순간이동)은 걸러진다', () => {
    const gate = new ValidationGate({ maxSpeed: 6.5 });
    gate.accept(0.1, 0, 0);
    // 16ms 동안 0.7 이동 => 속도 ≈43.75/초, 6.5를 훨씬 초과
    const result = gate.filter([obs(-0.6, 0)], 16);
    expect(result).toHaveLength(0);
  });

  it('여러 관측 중 통과하는 것만 남긴다(실제 대상은 통과, 잘못 인식된 점은 거절)', () => {
    const gate = new ValidationGate({ maxSpeed: 6.5 });
    gate.accept(0.1, 0.1, 0);
    const real = obs(0.12, 0.1); // 근접 이동 — 통과
    const ghost = obs(-0.7, 0.6); // 화면 반대편 — 거절
    const result = gate.filter([ghost, real], 16); // 순서 뒤섞기로 순서가 뒤바뀐 상황
    expect(result).toHaveLength(1);
    expect(result[0]).toBe(real);
  });

  it('dt가 클수록(프레임 드롭 등) 더 먼 이동도 허용한다', () => {
    const gate = new ValidationGate({ maxSpeed: 6.5 });
    gate.accept(0, 0, 0);
    // 500ms 동안 1.0 이동 => 속도 2.0/초, 충분히 허용 범위
    const result = gate.filter([obs(1.0, 0)], 500);
    expect(result).toHaveLength(1);
  });
});

describe('ValidationGate — accept()', () => {
  it('accept로 갱신한 위치가 다음 프레임의 판정 기준이 된다', () => {
    const gate = new ValidationGate({ maxSpeed: 6.5 });
    gate.accept(0, 0, 0);
    gate.accept(0.05, 0, 16); // 대상이 실제로 이동했다고 채택

    // 새 기준(0.05,0)에서 가까운 이동은 통과해야 한다
    const result = gate.filter([obs(0.09, 0)], 32);
    expect(result).toHaveLength(1);
  });
});
