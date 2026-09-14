import type { FailureToggles } from '../sim/recognizer';
import { NO_FAILURES } from '../sim/recognizer';
import { SCENARIOS, type ScenarioId } from '../sim/scenario';

export interface ControlPanelCallbacks {
  onScenarioChange(id: ScenarioId): void;
  onTogglesChange(toggles: FailureToggles): void;
}

type NumericKey = 'jitterSigma' | 'missWhenFastMax' | 'cameraStallProb';
type BooleanKey = 'falseDetectionEnabled' | 'shuffleOrderEnabled';

/**
 * 상황을 고르고 인식 오류를 조절하는 제어판.
 *
 * 정해진 상황을 고르면 그 상황이 쓰는 값을 읽기 전용으로 보여준다. 재생 중에
 * 값을 바꾸면 매번 다른 결과가 나오기 때문이다. 직접 조준하는 모드에서만
 * 조절이 풀린다.
 */
export class ControlPanel {
  private toggles: FailureToggles = { ...NO_FAILURES };
  private scenarioId: ScenarioId = 'live';
  private inputs = new Map<NumericKey | BooleanKey, HTMLInputElement>();
  private readouts = new Map<NumericKey, HTMLElement>();

  constructor(
    private root: HTMLElement,
    private callbacks: ControlPanelCallbacks,
  ) {
    this.render();
  }

  private render(): void {
    this.root.innerHTML = '';
    this.root.appendChild(this.buildScenarioSection());
    this.root.appendChild(this.buildFailureSection());
    this.setManualControlsDisabled(this.scenarioId !== 'live');
  }

  private buildScenarioSection(): HTMLElement {
    const section = document.createElement('details');
    section.open = true;
    const summary = document.createElement('summary');
    summary.textContent = '상황 고르기';
    section.appendChild(summary);

    const body = document.createElement('div');
    body.className = 'section-body';

    const select = document.createElement('select');
    for (const s of SCENARIOS) {
      const opt = document.createElement('option');
      opt.value = s.id;
      opt.textContent = s.label;
      select.appendChild(opt);
    }
    select.value = this.scenarioId;

    const desc = document.createElement('p');
    desc.className = 'note';
    desc.textContent = SCENARIOS.find((s) => s.id === this.scenarioId)!.description;

    select.addEventListener('change', () => {
      const id = select.value as ScenarioId;
      const def = SCENARIOS.find((s) => s.id === id)!;
      this.scenarioId = id;
      this.toggles = { ...def.toggles };
      this.syncInputsToToggles();
      this.setManualControlsDisabled(id !== 'live');
      desc.textContent = def.description;
      this.callbacks.onScenarioChange(id);
      this.callbacks.onTogglesChange(this.toggles);
    });

    body.append(select, desc);
    section.appendChild(body);
    return section;
  }

  private buildFailureSection(): HTMLElement {
    const section = document.createElement('details');
    section.open = true;
    const summary = document.createElement('summary');
    summary.textContent = '인식 오류 직접 켜 보기';
    section.appendChild(summary);

    const body = document.createElement('div');
    body.className = 'section-body';
    body.appendChild(this.numberField('jitterSigma', '손 떨림', 0, 0.15, 0.005));
    body.appendChild(this.numberField('missWhenFastMax', '빠를 때 놓칠 확률', 0, 1, 0.02));
    body.appendChild(this.boolField('falseDetectionEnabled', '엉뚱한 곳 잘못 인식'));
    body.appendChild(this.boolField('shuffleOrderEnabled', '인식 순서 뒤섞기'));
    body.appendChild(this.numberField('cameraStallProb', '카메라 멈출 확률', 0, 1, 0.02));
    section.appendChild(body);
    return section;
  }

  private numberField(key: NumericKey, label: string, min: number, max: number, step: number): HTMLElement {
    const field = document.createElement('label');
    field.className = 'field';

    const span = document.createElement('span');
    span.textContent = label;

    const value = document.createElement('b');
    value.textContent = this.toggles[key].toFixed(3);

    const input = document.createElement('input');
    input.type = 'range';
    input.min = String(min);
    input.max = String(max);
    input.step = String(step);
    input.value = String(this.toggles[key]);
    input.addEventListener('input', () => {
      const v = Number(input.value);
      value.textContent = v.toFixed(3);
      this.toggles = { ...this.toggles, [key]: v };
      this.callbacks.onTogglesChange(this.toggles);
    });

    this.inputs.set(key, input);
    this.readouts.set(key, value);
    field.append(span, value, input);
    return field;
  }

  private boolField(key: BooleanKey, label: string): HTMLElement {
    const field = document.createElement('label');
    field.className = 'field toggle';

    const input = document.createElement('input');
    input.type = 'checkbox';
    input.checked = this.toggles[key];
    input.addEventListener('change', () => {
      this.toggles = { ...this.toggles, [key]: input.checked };
      this.callbacks.onTogglesChange(this.toggles);
    });

    const span = document.createElement('span');
    span.textContent = label;

    this.inputs.set(key, input);
    field.append(input, span);
    return field;
  }

  private syncInputsToToggles(): void {
    for (const [key, input] of this.inputs) {
      if (input.type === 'checkbox') {
        input.checked = this.toggles[key as BooleanKey];
      } else {
        const v = this.toggles[key as NumericKey];
        input.value = String(v);
        const readout = this.readouts.get(key as NumericKey);
        if (readout) readout.textContent = v.toFixed(3);
      }
    }
  }

  private setManualControlsDisabled(disabled: boolean): void {
    for (const input of this.inputs.values()) input.disabled = disabled;
  }
}
