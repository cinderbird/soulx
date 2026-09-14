import type { PresenceState } from '../pipeline/presenceStateMachine';

/**
 * 추적 상태에 따른 화면 전체의 흐림 정도.
 *
 * 카메라가 멈춘 상태를 가장 짙게 흐린다. 안내 문구와 조준점 색만으로는 화면
 * 일부에서만 차이가 드러나므로, 대상만 놓친 것과 카메라가 멈춘 것의 차이를
 * 화면 전체의 분위기로도 구분한다.
 */
export interface SceneStyle {
  readonly fogDensity: number;
}

export function sceneStyleFor(state: PresenceState): SceneStyle {
  switch (state) {
    case 'IDLE':
      return { fogDensity: 0.035 };
    case 'ACQUIRING':
      return { fogDensity: 0.045 };
    case 'LIVE':
      return { fogDensity: 0.035 };
    case 'HOLDING':
      return { fogDensity: 0.055 };
    case 'UNRELIABLE':
      return { fogDensity: 0.07 };
    case 'LOST':
      return { fogDensity: 0.1 };
    case 'CAMERA_STOPPED':
      return { fogDensity: 0.2 };
  }
}
