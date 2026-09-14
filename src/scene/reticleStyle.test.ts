import { describe, expect, it } from 'vitest';
import { reticleStyleFor } from './reticleStyle';

describe('reticleStyleFor', () => {
  it('LIVE는 기본 크기·기본 불투명도다', () => {
    const s = reticleStyleFor('LIVE');
    expect(s.radiusScale).toBeCloseTo(1.0);
  });

  it('UNRELIABLE는 LIVE보다 크고, 색이 다르다(경고색)', () => {
    const live = reticleStyleFor('LIVE');
    const degraded = reticleStyleFor('UNRELIABLE');
    expect(degraded.radiusScale).toBeGreaterThan(live.radiusScale);
    expect(degraded.colorHex).not.toBe(live.colorHex);
  });

  it('HOLDING은 LIVE보다 흐리다(불투명도가 낮다)', () => {
    const live = reticleStyleFor('LIVE');
    const coasting = reticleStyleFor('HOLDING');
    expect(coasting.opacity).toBeLessThan(live.opacity);
  });

  it('UNRELIABLE와 HOLDING은 서로 다른 색으로 구분된다', () => {
    const degraded = reticleStyleFor('UNRELIABLE');
    const coasting = reticleStyleFor('HOLDING');
    expect(degraded.colorHex).not.toBe(coasting.colorHex);
  });

  it('조준점이 숨겨지는 상태들도 항상 유효한 값을 돌려준다', () => {
    for (const s of ['IDLE', 'ACQUIRING', 'LOST', 'CAMERA_STOPPED'] as const) {
      const style = reticleStyleFor(s);
      expect(style.radiusScale).toBeGreaterThan(0);
      expect(style.opacity).toBeGreaterThan(0);
    }
  });
});
