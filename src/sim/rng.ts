/**
 * 시드 기반 난수 생성기(mulberry32).
 * 같은 시드에서는 같은 오류가 같은 순서로 재현된다. 버그를 다시 확인하거나
 * 같은 장면을 다시 녹화할 때 필요하다.
 */
export class Rng {
  private s: number;

  constructor(seed = 0x2f6e2b1) {
    this.s = seed >>> 0;
  }

  next(): number {
    this.s = (this.s + 0x6d2b79f5) >>> 0;
    let t = this.s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** 표준정규분포 근사값(Box-Muller 변환). */
  gauss(): number {
    const u = Math.max(1e-9, this.next());
    const v = this.next();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }
}
