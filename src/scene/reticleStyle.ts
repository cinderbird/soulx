import type { PresenceState } from '../pipeline/presenceStateMachine';

/** 추적 상태에 따른 조준점의 크기, 투명도, 색. 값 자체가 판단이므로 테스트로 고정한다. */
export interface ReticleStyle {
  readonly radiusScale: number;
  readonly opacity: number;
  readonly colorHex: number;
}

const LIVE_COLOR = 0x6ea8fe; // 기존 기본색 — "정상"
const UNRELIABLE_COLOR = 0xf6c343; // CSS --warn 계열과 맞춘 경고색
const HOLDING_COLOR = 0x8fa0c2; // 채도를 낮춘 톤 — "보고 있는 게 아니라 버티는 중"

export function reticleStyleFor(state: PresenceState): ReticleStyle {
  switch (state) {
    case 'LIVE':
      return { radiusScale: 1.0, opacity: 0.85, colorHex: LIVE_COLOR };
    case 'HOLDING':
      // 크게, 흐리게. 정확한 지점이 아니라 마지막으로 알던 근방이라는 뜻이다.
      return { radiusScale: 1.35, opacity: 0.45, colorHex: HOLDING_COLOR };
    case 'UNRELIABLE':
      // 경고색과 더 큰 반경으로 위치가 확실하지 않다는 것을 알린다.
      return { radiusScale: 1.6, opacity: 0.65, colorHex: UNRELIABLE_COLOR };
    default:
      // 조준점이 숨겨지는 상태들이라 실제로 쓰이지 않지만, 호출한 쪽이 항상 유효한 값을 받도록 둔다.
      return { radiusScale: 1.0, opacity: 0.85, colorHex: LIVE_COLOR };
  }
}
