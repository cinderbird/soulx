import { describe, expect, it } from 'vitest';
import { DataAssociator } from './dataAssociation';
import type { RawObservation } from '../types';

const obs = (x: number, y: number, confidence = 1): RawObservation => ({ x, y, confidence });

describe('DataAssociator — 후보가 없을 때', () => {
  it('빈 배열이면 매칭 실패다', () => {
    const a = new DataAssociator();
    const r = a.associate([], 0);
    expect(r.observation).toBeNull();
    expect(r.distance).toBeNull();
  });
});

describe('DataAssociator — 예측 위치가 없을 때(트랙 시작 전)', () => {
  it('후보가 하나뿐이면 그걸 채택한다', () => {
    const a = new DataAssociator();
    const target = obs(0.3, 0.3, 1);
    const r = a.associate([target], 0);
    expect(r.observation).toBe(target);
  });

  it('여럿이면 신뢰도가 가장 높은 후보를 채택한다', () => {
    const a = new DataAssociator();
    const ghost = obs(-0.6, 0.5, 0.3);
    const real = obs(0.1, 0.1, 1);
    const r = a.associate([ghost, real], 0);
    expect(r.observation).toBe(real);
  });

  it('순서 뒤섞기로 순서가 바뀌어도 결과는 같다(인식 순서가 섞여도 무관하다)', () => {
    const a1 = new DataAssociator();
    const a2 = new DataAssociator();
    const ghost = obs(-0.6, 0.5, 0.3);
    const real = obs(0.1, 0.1, 1);
    const r1 = a1.associate([ghost, real], 0);
    const r2 = a2.associate([real, ghost], 0); // 순서만 뒤바꿈
    expect(r1.observation).toBe(real);
    expect(r2.observation).toBe(real);
  });
});

describe('DataAssociator — 예측 위치가 있을 때(트랙 진행 중)', () => {
  it('예측 위치에 가장 가까운 후보를 고른다', () => {
    const a = new DataAssociator();
    a.updatePrediction(0.1, 0.1);
    const near = obs(0.12, 0.11, 1);
    const far = obs(0.5, 0.5, 1);
    const r = a.associate([far, near], 0);
    expect(r.observation).toBe(near);
  });

  it('가장 가까운 후보라도 maxAssociationDist를 넘으면 매칭 실패로 본다', () => {
    const a = new DataAssociator({ maxAssociationDist: 0.2 });
    a.updatePrediction(0, 0);
    const r = a.associate([obs(0.9, 0.9, 1)], 0);
    expect(r.observation).toBeNull();
  });

  it('알려진 한계: 잘못 인식된 점이 예측 위치에 더 가까우면 신뢰도와 무관하게 잘못 인식된 점을 고른다', () => {
    const a = new DataAssociator();
    a.updatePrediction(-0.5, 0.4);
    const ghostCloser = obs(-0.48, 0.4, 0.3);
    const realFarther = obs(0.3, 0.3, 1);
    const r = a.associate([realFarther, ghostCloser], 0);
    expect(r.observation).toBe(ghostCloser);
  });

  it('updatePrediction으로 기준을 갱신하면 다음 associate가 그 기준을 쓴다', () => {
    const a = new DataAssociator();
    a.updatePrediction(0, 0);
    a.updatePrediction(0.3, 0.3); // 트랙이 이동했다고 갱신
    const near = obs(0.32, 0.29, 1);
    const stale = obs(0.02, 0.01, 1); // 옛 기준(0,0)에는 가깝지만 새 기준엔 멀다
    const r = a.associate([stale, near], 0);
    expect(r.observation).toBe(near);
  });
});

describe('DataAssociator — reset()', () => {
  it('reset 이후엔 다시 예측 없는 상태(신뢰도 기준)로 돌아간다', () => {
    const a = new DataAssociator();
    a.updatePrediction(5, 5); // 극단적인 위치 — reset 안 되면 아래 후보들이 전부 매칭 실패해야 함
    a.reset();
    const ghost = obs(-0.6, 0.5, 0.3);
    const real = obs(0.1, 0.1, 1);
    const r = a.associate([ghost, real], 0);
    expect(r.observation).toBe(real);
  });
});
