import * as THREE from 'three';

/**
 * 정규화 좌표를 3D 월드 좌표로 바꾸는 유일한 지점.
 * 카메라에서 쏜 광선과 y=0 평면의 교차점을 구한다.
 *
 * 변환을 한 곳에 모아 두면 좌표 문제를 디버깅할 때 처리 결과가 틀린 것인지
 * 3D 투영이 틀린 것인지 섞이지 않는다.
 */
export class AimSurface {
  private raycaster = new THREE.Raycaster();
  private plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  private hit = new THREE.Vector3();

  /** 정규화 좌표를 평면 위의 월드 좌표로 변환한다. 시선이 평면과 평행하면 null을 반환한다. */
  project(x: number, y: number, camera: THREE.Camera): THREE.Vector3 | null {
    this.raycaster.setFromCamera(new THREE.Vector2(x, y), camera);
    const found = this.raycaster.ray.intersectPlane(this.plane, this.hit);
    return found ? this.hit.clone() : null;
  }
}

/** 최종 판단된 위치를 화면에 표시하는 조준점. 크기, 색, 투명도로 추적 상태를 함께 나타낸다. */
export class Reticle {
  readonly group = new THREE.Group();
  private ring: THREE.Mesh;
  private dot: THREE.Mesh;
  private ringMaterial: THREE.MeshBasicMaterial;
  private dotMaterial: THREE.MeshBasicMaterial;

  constructor() {
    this.ringMaterial = new THREE.MeshBasicMaterial({
      color: 0x6ea8fe,
      transparent: true,
      opacity: 0.85,
    });
    this.ring = new THREE.Mesh(new THREE.RingGeometry(0.22, 0.27, 40), this.ringMaterial);
    this.ring.rotation.x = -Math.PI / 2;

    this.dotMaterial = new THREE.MeshBasicMaterial({ color: 0x6ea8fe });
    this.dot = new THREE.Mesh(new THREE.SphereGeometry(0.05, 16, 12), this.dotMaterial);

    this.group.add(this.ring, this.dot);
    this.group.position.y = 0.02;
  }

  setPosition(world: THREE.Vector3): void {
    this.group.position.x = world.x;
    this.group.position.z = world.z;
  }

  /** 대상이 확정되지 않았거나 놓친 동안에는 숨긴다. */
  setVisible(visible: boolean): void {
    this.group.visible = visible;
  }

  /** 반경 배율로 위치의 불확실한 정도를 나타낸다. 1.0이 기본 크기다. */
  setRadiusScale(scale: number): void {
    this.ring.scale.setScalar(scale);
  }

  setColor(hex: number): void {
    this.ringMaterial.color.setHex(hex);
    this.dotMaterial.color.setHex(hex);
  }

  setOpacity(v: number): void {
    this.ringMaterial.opacity = v;
  }

  /** 숨김 상태로 되돌린다. */
  reset(): void {
    this.setVisible(false);
  }
}
