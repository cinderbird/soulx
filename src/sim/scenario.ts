import type { GroundTruthSample } from '../types';
import type { FailureToggles } from './recognizer';
import { NO_FAILURES } from './recognizer';

/**
 * 네 가지 비정상 상황을 버튼 하나로 항상 같게 재현한다.
 *
 * 마우스로 직접 재현하려면 같은 움직임을 매번 손으로 만들어야 하는데 그것은
 * 일정할 수 없다. 대상의 이동 경로를 미리 정해 두면 같은 오류가 같은 시점에
 * 나온다.
 *
 *   탐지 대상 소실   빠른 좌우 왕복으로 속도를 계속 임계 위로 올린다.
 *   탐지 대상 증가   오검출 지점이 실제 대상과 함께 잡힌다.
 *   뒤바뀜          오검출과 순서 섞기를 함께 켠다. 목록 순서를 믿는 코드가 있으면
 *                  값이 뒤집혀 보인다. 지금은 순서 대신 위치로 고르므로 재현되지 않는다.
 *   먹통            프레임 자체가 오지 않는다. 대상이 화면 밖으로 나가는 것과는 다르다.
 */
export type ScenarioId = 'live' | 'target-loss' | 'target-multiply' | 'value-flip' | 'input-halt';

export interface ScenarioWaypoint {
  readonly x: number;
  readonly y: number;
  /** 이 지점에 도착한 뒤 머무는 시간(ms). */
  readonly holdMs: number;
}

export interface ScenarioDef {
  readonly id: ScenarioId;
  readonly label: string;
  readonly description: string;
  readonly toggles: FailureToggles;
  /** 정해진 경로. 없으면 마우스 위치를 그대로 쓴다. */
  readonly path?: readonly ScenarioWaypoint[];
  /** 지점 사이를 이동하는 데 걸리는 시간(ms). 0이거나 없으면 즉시 이동한다. */
  readonly transitionMs?: number;
}

export const SCENARIOS: readonly ScenarioDef[] = [
  {
    id: 'live',
    label: '직접 조준해 보기 (마우스)',
    description:
      '마우스가 "진짜 손 위치"입니다. 아래 스위치로 인식 오류를 직접 켜 보세요. ' +
      '오류를 다 꺼도 화면을 가로지르듯 아주 빠르게 움직이면 조준점이 잠깐 사라질 수 있는데, ' +
      '이건 고장이 아니라 "사람 손이 이렇게 빠를 리 없다"고 판단해 그 값을 버리는 안전장치입니다.',
    toggles: NO_FAILURES,
  },
  {
    id: 'target-loss',
    label: '① 탐지 대상 소실 — 빠르게 움직이면 인식이 끊긴다',
    description:
      '손이 빠르게 좌우로 오갑니다. 카메라는 빠른 움직임을 자주 놓치기 때문에, ' +
      '조준점이 멈췄다 사라졌다를 반복합니다. 얼마나 오래 놓쳐야 "정말 놓쳤다"고 인정할지가 이 상황의 관건입니다.',
    toggles: { ...NO_FAILURES, missWhenFastMax: 0.9 },
    path: [
      { x: -0.85, y: 0, holdMs: 260 },
      { x: 0.85, y: 0, holdMs: 260 },
    ],
    transitionMs: 160,
  },
  {
    id: 'target-multiply',
    label: '② 탐지 대상 증가 — 엉뚱한 곳이 같이 인식된다',
    description:
      '진짜 손은 천천히 돌며 움직이고, 화면 한쪽에서는 카메라가 엉뚱한 곳(벽에 붙은 포스터 같은 것)을 ' +
      '손이라고 잘못 인식합니다. 빨간 점이 그 잘못 인식된 위치입니다. ' +
      '조준점이 빨간 점에는 전혀 끌려가지 않고 진짜 손만 따라가는지 보세요.',
    toggles: { ...NO_FAILURES, falseDetectionEnabled: true },
    // 대상을 한 점에 고정하면 화면 전체가 멈춰 보여 고장과 구분되지 않는다.
    // 완만하게 순회시키면 움직이는 실제 대상만 따라가고 고정된 오검출은 무시한다는 것이 드러난다.
    path: [
      { x: 0.15, y: 0.35, holdMs: 700 },
      { x: 0.4, y: 0.1, holdMs: 700 },
      { x: 0.15, y: -0.15, holdMs: 700 },
      { x: -0.1, y: 0.1, holdMs: 700 },
    ],
    transitionMs: 500,
  },
  {
    id: 'value-flip',
    label: '③ 뒤바뀜 — 진짜와 가짜의 순서가 섞인다',
    description:
      '카메라는 인식한 것들을 목록으로 넘겨주는데, 그 순서를 보장하지 않습니다. ' +
      '진짜 손과 잘못 인식된 곳이 목록에서 자리를 바꿔 가며 들어옵니다. ' +
      '"목록의 첫 번째가 진짜"라고 믿고 짜면 조준점이 두 위치를 왔다 갔다 뒤집히는데, ' +
      '여기서는 순서 대신 위치를 보고 고르기 때문에 그런 일이 생기지 않습니다.',
    toggles: { ...NO_FAILURES, falseDetectionEnabled: true, shuffleOrderEnabled: true },
    path: [
      { x: -0.2, y: 0.1, holdMs: 700 },
      { x: 0.05, y: -0.15, holdMs: 700 },
      { x: -0.2, y: -0.4, holdMs: 700 },
      { x: -0.45, y: -0.15, holdMs: 700 },
    ],
    transitionMs: 500,
  },
  {
    id: 'input-halt',
    label: '④ 먹통 — 카메라가 신호를 아예 안 보낸다',
    description:
      '카메라 연결이 끊긴 상황입니다. "손은 있는데 못 찾는 것"과 달리, 아무 신호도 오지 않습니다. ' +
      '이 둘은 사용자가 해야 할 일이 다릅니다 — 앞은 손을 다시 화면 안으로 넣으면 되지만, ' +
      '이건 카메라를 확인해야 합니다. 그래서 화면 안내 문구도 다르게 띄웁니다.',
    toggles: { ...NO_FAILURES, cameraStallProb: 1 },
    // 마우스를 움직이지 않아도 바로 재현되도록 고정된 지점을 준다. 관측 자체가
    // 오지 않으므로 대상이 움직여도 화면에 아무 영향이 없다.
    path: [{ x: 0, y: 0, holdMs: 6000 }],
  },
];

/** 정해진 경로 없이 마우스를 그대로 쓰는 상황인지. */
function isLiveDef(def: ScenarioDef): boolean {
  return !def.path || def.path.length === 0;
}

/**
 * 정해진 경로를 시간에 따라 재생한다.
 * 난수를 쓰지 않고 시각만으로 위치를 계산하므로 시드를 관리할 필요 없이 항상 같다.
 * 무작위성은 인식 오류 쪽에만 있다.
 */
export class ScenarioPlayer {
  private startMs: number | null = null;
  private lastLegIndex = -1;
  private pendingStep: { fromX: number; fromY: number; toX: number; toY: number } | null = null;

  constructor(private def: ScenarioDef) {}

  get isLive(): boolean {
    return isLiveDef(this.def);
  }

  /** 현재 위치를 반환한다. 정해진 경로가 없으면 null을 반환하고, 호출한 쪽이 마우스를 쓴다. */
  sample(nowMs: number): GroundTruthSample | null {
    const path = this.def.path;
    if (!path || path.length === 0) return null;

    if (this.startMs === null) this.startMs = nowMs;
    const transitionMs = Math.max(0, this.def.transitionMs ?? 0);
    const legDurations = path.map((wp) => transitionMs + wp.holdMs);
    const total = legDurations.reduce((a, b) => a + b, 0);
    if (total <= 0) return { t: nowMs, x: path[0]!.x, y: path[0]!.y };

    let elapsed = (nowMs - this.startMs) % total;
    let legIndex = 0;
    while (elapsed >= legDurations[legIndex]!) {
      elapsed -= legDurations[legIndex]!;
      legIndex = (legIndex + 1) % path.length;
    }

    if (legIndex !== this.lastLegIndex) {
      const prevIndex = (legIndex - 1 + path.length) % path.length;
      const from = path[prevIndex]!;
      const to = path[legIndex]!;
      this.pendingStep = { fromX: from.x, fromY: from.y, toX: to.x, toY: to.y };
      this.lastLegIndex = legIndex;
    }

    // 지점에 머무는 시간이 먼저고 다음 지점으로의 이동이 그 뒤에 온다.
    const at = path[legIndex]!;
    if (transitionMs > 0 && elapsed >= at.holdMs) {
      const nextIndex = (legIndex + 1) % path.length;
      const next = path[nextIndex]!;
      const progress = (elapsed - at.holdMs) / transitionMs;
      return { t: nowMs, x: lerp(at.x, next.x, progress), y: lerp(at.y, next.y, progress) };
    }
    return { t: nowMs, x: at.x, y: at.y };
  }

  /** 방금 다음 지점으로 출발했다면 그 전후 좌표를 한 번만 반환한다. 반응 속도 측정에 쓴다. */
  consumeStep(): { fromX: number; fromY: number; toX: number; toY: number } | null {
    const step = this.pendingStep;
    this.pendingStep = null;
    return step;
  }

  reset(): void {
    this.startMs = null;
    this.lastLegIndex = -1;
    this.pendingStep = null;
  }
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}
