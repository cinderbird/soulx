import * as THREE from 'three';

/**
 * 배경에 깊이감을 주는 장식용 오브젝트.
 * 조준면이나 광선 교차 계산에 관여하지 않고 추적 상태에 따라 바뀌지도 않는다.
 */
export class RangeEnvironment {
  readonly group = new THREE.Group();
  private markers: THREE.Mesh[] = [];

  constructor() {
    const geo = new THREE.TorusGeometry(0.32, 0.035, 8, 24);
    // 카메라 시야 안에서 서로 겹치지 않고 높이와 깊이가 각각 다르도록 고른 위치다.
    const positions: ReadonlyArray<readonly [number, number, number]> = [
      [-2.6, 0.9, -1.8],
      [2.3, 1.3, -2.6],
      [0.4, 1.7, -3.6],
      [-1.5, 0.6, -3.0],
    ];
    for (const [x, y, z] of positions) {
      const mat = new THREE.MeshBasicMaterial({ color: 0x2a3242, transparent: true, opacity: 0.85 });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(x, y, z);
      this.group.add(mesh);
      this.markers.push(mesh);
    }
  }

  /** 아주 느린 회전과 위아래 움직임만 준다. 시선을 끌면 조준점과 경쟁하기 때문이다. */
  update(elapsedSec: number): void {
    this.markers.forEach((m, i) => {
      m.rotation.z = elapsedSec * (0.12 + i * 0.02);
      m.position.y += Math.sin(elapsedSec * 0.5 + i) * 0.0004;
    });
  }
}
