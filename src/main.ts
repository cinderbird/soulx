import * as THREE from 'three';
import { GroundTruthTracker } from './aim/groundTruth';
import { AimSurface, Reticle } from './scene/reticle';
import { MockRecognizer, NO_FAILURES } from './sim/recognizer';
import { SignalMetrics } from './metrics/signalMetrics';

const container = document.getElementById('stage');
if (!container) throw new Error('#stage 컨테이너를 찾지 못했습니다');

function requireElement(id: string): HTMLElement {
  const el = document.getElementById(id);
  if (!el) throw new Error(`#${id}을(를) 찾지 못했습니다`);
  return el;
}
const readout = requireElement('hud-readout');

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0b0d12);

const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.set(0, 3.4, 4.4);
camera.lookAt(0, 0, 0);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
container.appendChild(renderer.domElement);

scene.add(new THREE.GridHelper(10, 20, 0x2c3446, 0x171c27));
scene.add(new THREE.HemisphereLight(0x8fb4ff, 0x10131a, 0.9));
scene.fog = new THREE.FogExp2(0x0b0d12, 0.035);

const aimSurface = new AimSurface();
const reticle = new Reticle();
scene.add(reticle.group);

const groundTruth = new GroundTruthTracker(window);
const recognizer = new MockRecognizer({ ...NO_FAILURES, jitterSigma: 0.012 });
const metrics = new SignalMetrics();

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

/**
 * 실제 위치와 화면에 그린 위치를 함께 측정기에 넣는다.
 * 이후 추가할 처리 단계가 오차를 실제로 줄이는지 숫자로 확인하기 위한 기준선이다.
 */
function loop(now: number): void {
  const g = groundTruth.sample(now);
  const frame = recognizer.observe(g, now);
  const observed = frame?.observations[0] ?? null;

  reticle.setVisible(observed !== null);
  if (observed) {
    const world = aimSurface.project(observed.x, observed.y, camera);
    if (world) reticle.setPosition(world);
  }

  if (g && observed) {
    metrics.sample(now, g.x, g.y, observed.x, observed.y);
    const s = metrics.summary();
    readout.textContent =
      `평균 오차   ${s.rmse.toFixed(4)}\n` +
      `멈췄을 때 떨림  ${s.stationaryJitter.toFixed(4)}\n` +
      `측정        ${s.sampleCount}프레임`;
  }

  renderer.render(scene, camera);
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
