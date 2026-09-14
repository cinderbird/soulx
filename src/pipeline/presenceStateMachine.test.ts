import { describe, expect, it } from 'vitest';
import { PresenceStateMachine } from './presenceStateMachine';
import type { LifecycleSnapshot } from './trackLifecycle';

const searching = (x: number | null = null, y: number | null = null): LifecycleSnapshot => ({
  state: 'searching',
  x,
  y,
  missStreak: 0,
});
const confirmed = (x = 0.1, y = 0.1): LifecycleSnapshot => ({ state: 'confirmed', x, y, missStreak: 0 });
const coasting = (x = 0.1, y = 0.1): LifecycleSnapshot => ({ state: 'coasting', x, y, missStreak: 1 });

describe('PresenceStateMachine — IDLE', () => {
  it('정답이 아직 없으면 소스가 살아 있어도 IDLE이다', () => {
    const psm = new PresenceStateMachine();
    const snap = psm.update({ hasGroundTruth: false, sourceAlive: true, track: searching(), matchedConfidence: null });
    expect(snap.state).toBe('IDLE');
  });
});

describe('PresenceStateMachine — CAMERA_STOPPED', () => {
  it('소스가 짧게 한 번 끊긴 것만으로는 CAMERA_STOPPED이 아니다', () => {
    const psm = new PresenceStateMachine({ sourceDownStreak: 6, degradedConfidence: 0.6 });
    const snap = psm.update({ hasGroundTruth: true, sourceAlive: false, track: searching(), matchedConfidence: null });
    expect(snap.state).not.toBe('CAMERA_STOPPED');
  });

  it('소스가 임계치만큼 연속으로 끊기면 CAMERA_STOPPED이다', () => {
    const psm = new PresenceStateMachine({ sourceDownStreak: 3, degradedConfidence: 0.6 });
    let snap;
    for (let i = 0; i < 3; i++) {
      snap = psm.update({ hasGroundTruth: true, sourceAlive: false, track: searching(), matchedConfidence: null });
    }
    expect(snap!.state).toBe('CAMERA_STOPPED');
  });

  it('CAMERA_STOPPED 상태의 x/y는 null이다(마지막 위치를 신뢰할 근거가 없다)', () => {
    const psm = new PresenceStateMachine({ sourceDownStreak: 1, degradedConfidence: 0.6 });
    const snap = psm.update({
      hasGroundTruth: true,
      sourceAlive: false,
      track: coasting(0.5, 0.5),
      matchedConfidence: null,
    });
    expect(snap.state).toBe('CAMERA_STOPPED');
    expect(snap.x).toBeNull();
  });

  it('소스가 다시 살아나면 스트릭이 리셋된다', () => {
    const psm = new PresenceStateMachine({ sourceDownStreak: 3, degradedConfidence: 0.6 });
    psm.update({ hasGroundTruth: true, sourceAlive: false, track: searching(), matchedConfidence: null });
    psm.update({ hasGroundTruth: true, sourceAlive: false, track: searching(), matchedConfidence: null });
    psm.update({ hasGroundTruth: true, sourceAlive: true, track: searching(), matchedConfidence: null }); // 리셋
    const snap = psm.update({ hasGroundTruth: true, sourceAlive: false, track: searching(), matchedConfidence: null });
    expect(snap.state).not.toBe('CAMERA_STOPPED');
  });
});

describe('PresenceStateMachine — ACQUIRING vs LOST', () => {
  it('한 번도 확정된 적 없으면 searching은 ACQUIRING이다', () => {
    const psm = new PresenceStateMachine();
    const snap = psm.update({ hasGroundTruth: true, sourceAlive: true, track: searching(0.1, 0.1), matchedConfidence: null });
    expect(snap.state).toBe('ACQUIRING');
  });

  it('확정됐다가 다시 searching이 되면 LOST다(ACQUIRING이 아니다)', () => {
    const psm = new PresenceStateMachine();
    psm.update({ hasGroundTruth: true, sourceAlive: true, track: confirmed(), matchedConfidence: 1 });
    const snap = psm.update({ hasGroundTruth: true, sourceAlive: true, track: searching(), matchedConfidence: null });
    expect(snap.state).toBe('LOST');
  });
});

describe('PresenceStateMachine — LIVE vs UNRELIABLE', () => {
  it('확정 + 높은 신뢰도는 LIVE다', () => {
    const psm = new PresenceStateMachine();
    const snap = psm.update({ hasGroundTruth: true, sourceAlive: true, track: confirmed(), matchedConfidence: 1 });
    expect(snap.state).toBe('LIVE');
  });

  it('확정 + 낮은 신뢰도(잘못 인식된 점 수준)는 UNRELIABLE다', () => {
    const psm = new PresenceStateMachine();
    const snap = psm.update({ hasGroundTruth: true, sourceAlive: true, track: confirmed(), matchedConfidence: 0.3 });
    expect(snap.state).toBe('UNRELIABLE');
  });
});

describe('PresenceStateMachine — HOLDING', () => {
  it('트랙이 coasting이면 그대로 HOLDING으로 매핑된다', () => {
    const psm = new PresenceStateMachine();
    const snap = psm.update({ hasGroundTruth: true, sourceAlive: true, track: coasting(0.2, 0.2), matchedConfidence: null });
    expect(snap.state).toBe('HOLDING');
    expect(snap.x).toBeCloseTo(0.2);
  });
});

describe('PresenceStateMachine — reset()', () => {
  it('reset 후에는 다시 확정 이력 없는 상태로 돌아간다(LOST 대신 ACQUIRING)', () => {
    const psm = new PresenceStateMachine();
    psm.update({ hasGroundTruth: true, sourceAlive: true, track: confirmed(), matchedConfidence: 1 });
    psm.reset();
    const snap = psm.update({ hasGroundTruth: true, sourceAlive: true, track: searching(), matchedConfidence: null });
    expect(snap.state).toBe('ACQUIRING');
  });
});
