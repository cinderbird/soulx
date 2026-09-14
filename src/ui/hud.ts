import type { MetricsSummary } from '../metrics/signalMetrics';

/**
 * 측정값을 실시간으로 보여주는 지표판.
 *
 * 그래프로 그리는 값은 평균 오차 하나뿐이다. 나머지 둘은 특정 구간에서만
 * 의미가 있어서, 시계열로 그리면 "지금은 잴 수 없다"가 "값이 0이다"로
 * 오해된다. 그 둘은 숫자로만 보여준다.
 *
 * 신호가 없어 측정하지 못한 구간은 회색 점선으로 구분한다. 잴 수 없었던
 * 구간과 재 봤더니 오차가 없던 구간은 뜻이 전혀 다르기 때문이다.
 */
export class Hud {
  private ctx: CanvasRenderingContext2D;
  private rmseHistory: number[] = [];
  private sampledHistory: boolean[] = [];

  constructor(
    private canvas: HTMLCanvasElement,
    private readout: HTMLElement,
  ) {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('HUD 캔버스에서 2D 컨텍스트를 얻지 못했습니다');
    this.ctx = ctx;
  }

  /** 그래프를 비운다. 이전 상황의 값이 다음 상황에 섞이지 않게 한다. */
  reset(): void {
    this.rmseHistory = [];
    this.sampledHistory = [];
  }

  /**
   * 지표판을 갱신한다.
   * hasSample이 false이면 이번 프레임에는 새로 측정한 값이 없다는 뜻이고,
   * 그래프에서 해당 구간을 다르게 그린다.
   */
  update(
    summary: MetricsSummary,
    stepResponseMs: number | null,
    scenarioLabel: string,
    frameObservationCount: number,
    hasSample: boolean,
  ): void {
    this.rmseHistory.push(summary.rmse);
    this.sampledHistory.push(hasSample);
    if (this.rmseHistory.length > this.canvas.width) {
      this.rmseHistory.shift();
      this.sampledHistory.shift();
    }
    this.draw();

    const lines = [
      `상황        ${scenarioLabel}`,
      `평균 오차   ${summary.rmse.toFixed(4)}`,
      `멈췄을 때 떨림  ${summary.stationaryJitter.toFixed(4)}`,
      `반응 속도   ${stepResponseMs === null ? '—' : `${stepResponseMs.toFixed(0)}ms`}`,
      `인식된 점   ${frameObservationCount}개  (측정 ${summary.sampleCount}프레임)`,
    ];
    this.readout.textContent = lines.join('\n');
  }

  private draw(): void {
    const { ctx, canvas } = this;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#0e1119';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const PAD_LEFT = 34; // y축 눈금 텍스트 폭
    const PAD_BOTTOM = 14; // x축 라벨 높이
    const plotW = canvas.width - PAD_LEFT;
    const plotH = canvas.height - PAD_BOTTOM;

    ctx.strokeStyle = '#232936';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(PAD_LEFT, 0);
    ctx.lineTo(PAD_LEFT, plotH);
    ctx.lineTo(canvas.width, plotH);
    ctx.stroke();

    ctx.fillStyle = '#8b93a7';
    ctx.font = '10px ui-monospace, monospace';
    // 축 제목은 선 오른쪽, 눈금 숫자는 선 왼쪽에 둔다. 같은 자리에 겹쳐 쓰면 뭉개져 읽을 수 없다.
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText('평균 오차', PAD_LEFT + 4, 3);
    ctx.textAlign = 'right';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText('0', PAD_LEFT - 4, plotH - 4);
    ctx.textAlign = 'left';
    ctx.fillText('← 지난 시간 · 최근 →', PAD_LEFT + 2, canvas.height - 2);

    if (this.rmseHistory.length < 2) return;

    const max = Math.max(0.02, ...this.rmseHistory);
    ctx.textAlign = 'right';
    ctx.textBaseline = 'top';
    ctx.fillText(max.toFixed(3), PAD_LEFT - 4, 15);

    const n = this.rmseHistory.length;
    const px = (i: number) => PAD_LEFT + (i / Math.max(1, n - 1)) * plotW;
    const py = (v: number) => plotH - (v / max) * plotH;

    // 측정된 구간과 아닌 구간을 색을 바꿔 가며 따로 그린다. 하나로 이으면 구간별로 색을 바꿀 수 없다.
    let i = 0;
    while (i < n - 1) {
      const sampled = this.sampledHistory[i + 1];
      let j = i;
      while (j < n - 1 && this.sampledHistory[j + 1] === sampled) j++;
      ctx.strokeStyle = sampled ? '#6ea8fe' : '#4a5064';
      ctx.setLineDash(sampled ? [] : [3, 3]);
      ctx.lineWidth = sampled ? 1.5 : 1.25;
      ctx.beginPath();
      ctx.moveTo(px(i), py(this.rmseHistory[i]!));
      for (let k = i + 1; k <= j; k++) ctx.lineTo(px(k), py(this.rmseHistory[k]!));
      ctx.stroke();
      i = j;
    }
    ctx.setLineDash([]);
  }
}
