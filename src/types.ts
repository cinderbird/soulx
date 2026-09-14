/**
 * 정규화 화면 좌표. x는 왼쪽 -1에서 오른쪽 1, y는 아래 -1에서 위 1이다.
 * 모든 계층이 이 좌표계만 쓰고, 3D 월드 좌표로의 변환은 화면에 그리기 직전
 * AimSurface 한 곳에서만 일어난다.
 */
export interface Vec2 {
  readonly x: number;
  readonly y: number;
}

/** 대상의 실제 위치. 오차와 지연을 재는 기준이 된다. */
export interface GroundTruthSample extends Vec2 {
  readonly t: number; // ms, performance.now() 기준
}

/** 인식 장치가 한 프레임에 내놓은 관측 하나. 실제 위치일 수도, 오검출일 수도 있다. */
export interface RawObservation extends Vec2 {
  /** 인식 장치가 붙인 임시 id. 프레임마다 바뀔 수 있고 목록 순서와는 무관하다. */
  readonly sourceId?: number;
  readonly confidence: number;
}

/** 한 프레임의 인식 결과. 아무것도 찾지 못하면 observations가 빈 배열이다. */
export interface RawFrame {
  readonly t: number;
  readonly observations: readonly RawObservation[];
}
