import * as THREE from 'three';

const TRAIL_LENGTH = 16;

/**
 * 조준점이 지나온 최근 경로를 옅어지는 점으로 남긴다.
 *
 * 보정 전 마커가 어지럽게 떨리는 동안 이 경로는 매끄러운 곡선을 그린다.
 * 지표가 숫자로 보여주는 것을 눈으로 확인할 수 있게 한다.
 */
export class Trail {
  readonly group = new THREE.Group();
  private readonly dots: THREE.Mesh[];
  private points: Array<THREE.Vector3 | null> = new Array(TRAIL_LENGTH).fill(null);
  private colorHex: number;

  constructor(colorHex = 0x6ea8fe) {
    this.colorHex = colorHex;
    this.dots = [];
    for (let i = 0; i < TRAIL_LENGTH; i++) {
      const mat = new THREE.MeshBasicMaterial({ color: colorHex, transparent: true, opacity: 0 });
      const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 8), mat);
      mesh.position.y = 0.01;
      this.group.add(mesh);
      this.dots.push(mesh);
    }
  }

  /** 새 위치를 맨 앞에 넣고 가장 오래된 점을 버린다. */
  push(world: THREE.Vector3): void {
    this.points.pop();
    this.points.unshift(world.clone());
    this.points.forEach((p, i) => {
      const mesh = this.dots[i]!;
      const mat = mesh.material as THREE.MeshBasicMaterial;
      if (p) {
        mesh.position.x = p.x;
        mesh.position.z = p.z;
        // 오래된 점일수록 옅어진다.
        mat.opacity = 0.3 * (1 - i / TRAIL_LENGTH);
      } else {
        mat.opacity = 0;
      }
    });
  }

  setColor(hex: number): void {
    if (hex === this.colorHex) return;
    this.colorHex = hex;
    this.dots.forEach((d) => (d.material as THREE.MeshBasicMaterial).color.setHex(hex));
  }

  /** 경로를 지운다. 대상을 다시 찾았을 때 이전 경로가 이어져 보이면 안 된다. */
  reset(): void {
    this.points = new Array(TRAIL_LENGTH).fill(null);
    this.dots.forEach((d) => {
      (d.material as THREE.MeshBasicMaterial).opacity = 0;
    });
  }
}
