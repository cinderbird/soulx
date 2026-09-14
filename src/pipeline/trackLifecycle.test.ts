import { describe, expect, it } from 'vitest';
import { TrackLifecycle } from './trackLifecycle';

describe('TrackLifecycle — 초기 상태', () => {
  it('시작은 searching이고 위치가 없다', () => {
    const lc = new TrackLifecycle();
    const snap = lc.update(null);
    expect(snap.state).toBe('searching');
    expect(snap.x).toBeNull();
    expect(snap.y).toBeNull();
  });
});

describe('TrackLifecycle — M-of-N 확정', () => {
  it('연속으로 매칭되면 M번째에 confirmed가 된다(기본 M=3)', () => {
    const lc = new TrackLifecycle();
    expect(lc.update({ x: 0, y: 0 }).state).toBe('searching');
    expect(lc.update({ x: 0, y: 0 }).state).toBe('searching');
    expect(lc.update({ x: 0, y: 0 }).state).toBe('confirmed'); // 3번째
  });

  it('매칭이 하나뿐이면 확정되지 않는다', () => {
    const lc = new TrackLifecycle();
    const snap = lc.update({ x: 0.2, y: 0.2 });
    expect(snap.state).toBe('searching');
    // 확정 전에도 위치 자체는 잠정적으로 갖고 있다(표시 여부는 상위 레이어의 몫)
    expect(snap.x).toBeCloseTo(0.2);
  });

  it('연속이 아니어도 최근 N번 중 M번이면 확정된다', () => {
    const lc = new TrackLifecycle({ confirmM: 3, confirmN: 5, maxMisses: 8 });
    lc.update({ x: 0, y: 0 }); // hit
    lc.update(null); // miss
    lc.update({ x: 0, y: 0 }); // hit
    lc.update(null); // miss
    const snap = lc.update({ x: 0, y: 0 }); // hit — 최근 5개 중 3개 hit
    expect(snap.state).toBe('confirmed');
  });

  it('윈도우보다 오래된 매칭은 확정 판정에서 밀려난다', () => {
    const lc = new TrackLifecycle({ confirmM: 3, confirmN: 3, maxMisses: 8 });
    lc.update({ x: 0, y: 0 }); // hit #1
    lc.update({ x: 0, y: 0 }); // hit #2
    // 아직 확정 전 상태에서 놓침이 계속되면 오래된 hit이 윈도우 밖으로 밀려난다
    lc.update(null);
    lc.update(null);
    const snap = lc.update(null);
    expect(snap.state).toBe('searching');
  });
});

describe('TrackLifecycle — K-miss 유예(coasting)', () => {
  function confirmed(): TrackLifecycle {
    const lc = new TrackLifecycle();
    lc.update({ x: 0.1, y: 0.1 });
    lc.update({ x: 0.1, y: 0.1 });
    lc.update({ x: 0.1, y: 0.1 }); // confirmed
    return lc;
  }

  it('확정 후 짧은 놓침은 coasting으로 위치를 유지한 채 버틴다', () => {
    const lc = confirmed();
    const snap = lc.update(null);
    expect(snap.state).toBe('coasting');
    expect(snap.x).toBeCloseTo(0.1);
    expect(snap.y).toBeCloseTo(0.1);
  });

  it('coasting 중 다시 매칭되면 confirmed로 복귀한다', () => {
    const lc = confirmed();
    lc.update(null);
    const snap = lc.update({ x: 0.2, y: 0.2 });
    expect(snap.state).toBe('confirmed');
    expect(snap.x).toBeCloseTo(0.2);
  });

  it('maxMisses를 넘기면 searching으로 돌아가고 위치를 잃는다', () => {
    const lc = new TrackLifecycle({ confirmM: 3, confirmN: 5, maxMisses: 2 });
    lc.update({ x: 0.1, y: 0.1 });
    lc.update({ x: 0.1, y: 0.1 });
    lc.update({ x: 0.1, y: 0.1 }); // confirmed

    lc.update(null); // miss 1 -> coasting
    lc.update(null); // miss 2 -> coasting (경계값, maxMisses=2까지는 허용)
    const snap = lc.update(null); // miss 3 -> 초과, searching
    expect(snap.state).toBe('searching');
    expect(snap.x).toBeNull();
    expect(snap.y).toBeNull();
  });

  it('searching으로 돌아간 뒤엔 다시 M-of-N을 통과해야 확정된다', () => {
    const lc = new TrackLifecycle({ confirmM: 3, confirmN: 5, maxMisses: 1 });
    lc.update({ x: 0, y: 0 });
    lc.update({ x: 0, y: 0 });
    lc.update({ x: 0, y: 0 }); // confirmed
    lc.update(null);
    lc.update(null); // maxMisses(1) 초과 -> searching, 이력 초기화

    // 확정 이력이 남아있었다면 한 번만 더 매칭돼도 confirmed가 됐겠지만,
    // 초기화됐으므로 다시 M번 채워야 한다.
    expect(lc.update({ x: 0, y: 0 }).state).toBe('searching');
    expect(lc.update({ x: 0, y: 0 }).state).toBe('searching');
    expect(lc.update({ x: 0, y: 0 }).state).toBe('confirmed');
  });
});

describe('TrackLifecycle — reset()', () => {
  it('reset 후 다시 초기 상태로 돌아간다', () => {
    const lc = new TrackLifecycle();
    lc.update({ x: 0.5, y: 0.5 });
    lc.update({ x: 0.5, y: 0.5 });
    lc.update({ x: 0.5, y: 0.5 }); // confirmed
    lc.reset();
    const snap = lc.update(null);
    expect(snap.state).toBe('searching');
    expect(snap.x).toBeNull();
  });
});
