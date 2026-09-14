import * as THREE from 'three';
import type { Vec2 } from './types';
import { GroundTruthTracker } from './aim/groundTruth';
import { AimSurface, Reticle } from './scene/reticle';
import { MockRecognizer } from './sim/recognizer';
import { SCENARIOS, ScenarioPlayer, type ScenarioId } from './sim/scenario';
import { SignalMetrics, StepResponseMeter } from './metrics/signalMetrics';
import { ValidationGate } from './pipeline/validationGate';
import { DataAssociator } from './pipeline/dataAssociation';
import { TrackLifecycle } from './pipeline/trackLifecycle';
import { Deadzone } from './pipeline/deadzone';
import { OneEuroFilter2D } from './pipeline/oneEuroFilter';
import { PresenceStateMachine, type PresenceState } from './pipeline/presenceStateMachine';
import { GainControl } from './pipeline/gainControl';
import { reticleStyleFor } from './scene/reticleStyle';
import { sceneStyleFor } from './scene/sceneStyle';
import { RangeEnvironment } from './scene/rangeEnvironment';
import { RawPointMarker } from './scene/rawPointMarker';
import { IgnoredPointMarkers } from './scene/ignoredPoints';
import { Trail } from './scene/trail';
import { ControlPanel } from './ui/panel';
import { Hud } from './ui/hud';

const container = document.getElementById('stage');
if (!container) throw new Error('#stage 컨테이너를 찾지 못했습니다');

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0b0d12);

const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.set(0, 3.4, 4.4);
camera.lookAt(0, 0, 0);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
container.appendChild(renderer.domElement);

const grid = new THREE.GridHelper(10, 20, 0x2c3446, 0x171c27);
scene.add(grid);
scene.add(new THREE.HemisphereLight(0x8fb4ff, 0x10131a, 0.9));

// 배경과 같은 색으로 깔아 깊이감을 준다. 농도는 아래 루프에서 추적 상태에 따라 조정한다.
scene.fog = new THREE.FogExp2(0x0b0d12, 0.035);

const rangeEnvironment = new RangeEnvironment();
scene.add(rangeEnvironment.group);

const aimSurface = new AimSurface();
const reticle = new Reticle();
scene.add(reticle.group);
const rawMarker = new RawPointMarker();
scene.add(rawMarker.group);
const ignoredMarkers = new IgnoredPointMarkers();
scene.add(ignoredMarkers.group);
const trail = new Trail();
scene.add(trail.group);

function requireElement(id: string): HTMLElement {
  const el = document.getElementById(id);
  if (!el) throw new Error(`#${id}을(를) 찾지 못했습니다`);
  return el;
}
const bannerEl = requireElement('banner');

const hudCanvas = document.getElementById('hud-canvas');
const hudReadout = document.getElementById('hud-readout');
if (!(hudCanvas instanceof HTMLCanvasElement) || !hudReadout) {
  throw new Error('#hud-canvas / #hud-readout을 찾지 못했습니다');
}
const hud = new Hud(hudCanvas, hudReadout);

const groundTruth = new GroundTruthTracker(window);
const defaultScenario = SCENARIOS[0]!; // 'live'
const recognizer = new MockRecognizer(defaultScenario.toggles);
const metrics = new SignalMetrics();
const stepMeter = new StepResponseMeter();
const gate = new ValidationGate();
const associator = new DataAssociator();
const lifecycle = new TrackLifecycle();
const deadzone = new Deadzone();
const smoother = new OneEuroFilter2D();
const presence = new PresenceStateMachine();
const gainControl = new GainControl();

/**
 * 상황을 바꿀 때 초기화할 대상 전부.
 * 여기에 넣는 것을 빠뜨리면 이전 상황의 경로나 누적 지표가 다음 상황에 섞인다.
 * 생성 지점 바로 옆에 모아 두어 추가할 때 눈에 띄게 했다.
 */
const resettables = [
  recognizer, metrics, hud, gate, associator, lifecycle,
  deadzone, smoother, presence, gainControl,
  reticle, rawMarker, ignoredMarkers, trail,
];

let scenario = new ScenarioPlayer(defaultScenario);
let scenarioLabel = defaultScenario.label;

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

const panelEl = document.getElementById('panel');
if (!panelEl) throw new Error('#panel을 찾지 못했습니다');
new ControlPanel(panelEl, {
  onScenarioChange: (id: ScenarioId) => {
    const def = SCENARIOS.find((s) => s.id === id)!;
    // 난수도 시드부터 다시 시작한다. 같은 상황을 다시 고르면 같은 오류가 같은 시점에 나와야 한다.
    for (const r of resettables) r.reset();
    scenarioLabel = def.label;
    scenario = new ScenarioPlayer(def);
  },
  onTogglesChange: (toggles) => {
    recognizer.setConfig(toggles);
  },
});

/**
 * 사용자에게 알려야 하는 상태에만 안내 문구를 반환하고, 나머지는 null을 반환한다.
 * 정상 처리 중인 상태까지 알리면 화면이 산만해진다. 특히 짧은 놓침을 견디는
 * 동안 매번 문구를 띄우면 흔들림을 없애려던 목적 자체가 무너진다.
 */
function bannerFor(state: PresenceState): { text: string; warn: boolean } | null {
  switch (state) {
    case 'LOST':
      return { text: '손을 놓쳤습니다 — 화면 안으로 다시 움직여 주세요', warn: false };
    case 'CAMERA_STOPPED':
      return { text: '카메라가 멈췄습니다 — 신호가 오지 않습니다', warn: false };
    case 'UNRELIABLE':
      return { text: '지금 인식이 불안정합니다 — 조심해서 따라가는 중', warn: true };
    default:
      return null;
  }
}

/**
 * 매 프레임 실행되는 처리 순서:
 * 실제 위치 → 인식 → 속도 검사 → 대상 선택 → 확정 판단 → 게인 → 데드존 → 보정 → 화면.
 *
 * 측정기에는 실제 위치와 보정을 마친 최종 출력을 함께 넣는다. 보정 효과를
 * 느낌이 아니라 숫자로 확인하기 위해서다.
 */
function loop(now: number): void {
  const g = scenario.isLive ? groundTruth.sample(now) : scenario.sample(now);

  const step = scenario.consumeStep();
  if (step) stepMeter.markStep(now, step.fromX, step.fromY, step.toX, step.toY);

  const frame = recognizer.observe(g, now);
  const sourceAlive = frame !== null;
  const candidates = frame ? gate.filter(frame.observations, now) : [];
  const { observation: matched } = associator.associate(candidates, now);

  if (matched) {
    gate.accept(matched.x, matched.y, now);
    associator.updatePrediction(matched.x, matched.y);
    const rawWorld = aimSurface.project(matched.x, matched.y, camera);
    if (rawWorld) rawMarker.setPosition(rawWorld);
  }
  rawMarker.setVisible(matched !== null);

  // 속도 검사를 통과한 후보가 아니라 원본 목록에서 고른다. 고정된 오검출 지점은
  // 대개 속도 검사에서 먼저 걸러지므로, 통과한 후보만 보면 화면에 아예 나타나지 않는다.
  const ignored = (frame?.observations ?? []).filter((o) => o !== matched);
  if (ignored.length > 0) {
    const ignoredWorlds = ignored
      .map((c) => aimSurface.project(c.x, c.y, camera))
      .filter((w): w is THREE.Vector3 => w !== null);
    ignoredMarkers.show(ignoredWorlds);
  } else {
    ignoredMarkers.hide();
  }

  const track = lifecycle.update(matched);
  const presenceSnap = presence.update({
    hasGroundTruth: g !== null,
    sourceAlive,
    track,
    matchedConfidence: matched?.confidence ?? null,
  });

  // 화면 표현에만 관여하므로 처리 단계가 아니라 여기에 둔다. 측정값에는 영향이 없다.
  if (scene.fog instanceof THREE.FogExp2) {
    const targetFog = sceneStyleFor(presenceSnap.state).fogDensity;
    scene.fog.density += (targetFog - scene.fog.density) * 0.06;
  }

  const banner = bannerFor(presenceSnap.state);
  bannerEl.textContent = banner?.text ?? '';
  bannerEl.classList.toggle('hidden', banner === null);
  bannerEl.classList.toggle('warn', banner?.warn ?? false);

  const showing = track.state !== 'searching' && track.x !== null && track.y !== null;

  // 다시 찾은 대상은 새로 시작한다. 이전 위치를 기준으로 계속 보정하면 없던 지연이 생긴다.
  if (!showing) {
    gainControl.reset();
    deadzone.reset();
    smoother.reset();
    trail.reset();
  }

  let smoothed: Vec2 | null = null;
  if (showing) {
    const cautious = gainControl.apply(track.x!, track.y!, presenceSnap.state === 'UNRELIABLE');
    const held = deadzone.apply(cautious.x, cautious.y);
    smoothed = smoother.filter(held.x, held.y, now);
  }

  const hasSample = g !== null && smoothed !== null;
  if (hasSample) {
    metrics.sample(now, g!.x, g!.y, smoothed!.x, smoothed!.y);
    stepMeter.update(now, smoothed!.x, smoothed!.y);
  }

  reticle.setVisible(showing);
  if (smoothed) {
    const style = reticleStyleFor(presenceSnap.state);
    reticle.setRadiusScale(style.radiusScale);
    reticle.setOpacity(style.opacity);
    reticle.setColor(style.colorHex);
    rawMarker.setColor(style.colorHex);
    trail.setColor(style.colorHex);
    const world = aimSurface.project(smoothed.x, smoothed.y, camera);
    if (world) {
      reticle.setPosition(world);
      trail.push(world);
    }
  }

  hud.update(metrics.summary(), stepMeter.lastResponseMs(), scenarioLabel, frame?.observations.length ?? 0, hasSample);

  rangeEnvironment.update(now / 1000);
  renderer.render(scene, camera);
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
