import * as THREE from 'three';

const POOL_SIZE = 4; // 동시에 그릴 후보 상한 — 화면 노이즈를 억제하기 위한 의도적 제한

/**
 * 인식은 됐지만 대상으로 고르지 않은 관측을 경고색 점으로 표시한다.
 *
 * 이것이 없으면 오검출을 성공적으로 무시하는 상태와 애초에 오검출이 없는 상태가
 * 화면에서 똑같아 보인다. 무시하고 있다는 사실 자체를 보이게 만든다.
 */
export class IgnoredPointMarkers {
  readonly group = new THREE.Group();
  private readonly dots: THREE.Mesh[];

  constructor() {
    this.dots = [];
    for (let i = 0; i < POOL_SIZE; i++) {
      const mat = new THREE.MeshBasicMaterial({ color: 0xff5c5c, transparent: true, opacity: 0 });
      const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 10), mat);
      mesh.position.y = 0.012; // 그리드·원시 위치 마커·조준점과 다른 offset — 겹칠 때도 z-fighting 없이 구분된다
      this.group.add(mesh);
      this.dots.push(mesh);
    }
  }

  /** 표시할 위치 목록. 미리 만들어 둔 점 개수를 넘으면 앞에서부터만 그린다. */
  show(worlds: readonly THREE.Vector3[]): void {
    this.dots.forEach((mesh, i) => {
      const w = worlds[i];
      const mat = mesh.material as THREE.MeshBasicMaterial;
      if (w) {
        mesh.position.x = w.x;
        mesh.position.z = w.z;
        mat.opacity = 0.55;
      } else {
        mat.opacity = 0;
      }
    });
  }

  hide(): void {
    this.dots.forEach((d) => {
      (d.material as THREE.MeshBasicMaterial).opacity = 0;
    });
  }

  /** 숨김 상태로 되돌린다. */
  reset(): void {
    this.hide();
  }
}
