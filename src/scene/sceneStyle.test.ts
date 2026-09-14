import { describe, expect, it } from 'vitest';
import { sceneStyleFor } from './sceneStyle';

describe('sceneStyleFor', () => {
  it('LIVE는 가장 옅은 안개다', () => {
    const live = sceneStyleFor('LIVE');
    for (const s of ['ACQUIRING', 'HOLDING', 'UNRELIABLE', 'LOST', 'CAMERA_STOPPED'] as const) {
      expect(sceneStyleFor(s).fogDensity).toBeGreaterThanOrEqual(live.fogDensity);
    }
  });

  it('CAMERA_STOPPED은 LOST보다 안개가 짙다 — "카메라가 죽었다"가 "대상만 안 보인다"보다 더 큰 문제여서다', () => {
    const lost = sceneStyleFor('LOST');
    const sourceDown = sceneStyleFor('CAMERA_STOPPED');
    expect(sourceDown.fogDensity).toBeGreaterThan(lost.fogDensity);
  });

  it('LOST는 UNRELIABLE보다 안개가 짙다', () => {
    expect(sceneStyleFor('LOST').fogDensity).toBeGreaterThan(sceneStyleFor('UNRELIABLE').fogDensity);
  });

  it('모든 상태가 0보다 큰 유효한 밀도를 돌려준다', () => {
    for (const s of ['IDLE', 'ACQUIRING', 'LIVE', 'HOLDING', 'UNRELIABLE', 'LOST', 'CAMERA_STOPPED'] as const) {
      expect(sceneStyleFor(s).fogDensity).toBeGreaterThan(0);
    }
  });
});
