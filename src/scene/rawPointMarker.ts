import * as THREE from 'three';

/**
 * 이번 프레임에 고른 관측을 보정 전 상태 그대로 표시한다.
 *
 * 보정된 조준점만 보이면 그 보정이 왜 필요한지가 화면에 드러나지 않는다.
 * 이 마커가 떨림을 그대로 보여줘서 둘을 비교할 수 있게 한다.
 *
 * 고른 관측이 없는 프레임에는 숨긴다. 없는 값을 있는 것처럼 그리면 오해를 준다.
 */
export class RawPointMarker {
  readonly group = new THREE.Group();
  private material: THREE.MeshBasicMaterial;

  constructor() {
    this.material = new THREE.MeshBasicMaterial({
      color: 0x6ea8fe,
      transparent: true,
      opacity: 0.35,
    });
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.06, 12, 12), this.material);
    this.group.add(mesh);
    this.group.position.y = 0.015; // 그리드·조준점과 z-fighting을 피하는 정도의 offset
    this.group.visible = false;
  }

  setPosition(world: THREE.Vector3): void {
    this.group.position.x = world.x;
    this.group.position.z = world.z;
  }

  setVisible(visible: boolean): void {
    this.group.visible = visible;
  }

  setColor(hex: number): void {
    this.material.color.setHex(hex);
  }

  /** 숨김 상태로 되돌린다. */
  reset(): void {
    this.setVisible(false);
  }
}
