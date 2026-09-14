import * as THREE from 'three';
import { GroundTruthTracker } from './aim/groundTruth';
import { AimSurface, Reticle } from './scene/reticle';
import { MockRecognizer, NO_FAILURES } from './sim/recognizer';

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

scene.add(new THREE.GridHelper(10, 20, 0x2c3446, 0x171c27));
scene.add(new THREE.HemisphereLight(0x8fb4ff, 0x10131a, 0.9));
scene.fog = new THREE.FogExp2(0x0b0d12, 0.035);

const aimSurface = new AimSurface();
const reticle = new Reticle();
scene.add(reticle.group);

const groundTruth = new GroundTruthTracker(window);
// 떨림만 켜 둔다. 처리 단계 없이 인식 결과를 그대로 그리면 무엇이 문제인지 바로 보인다.
const recognizer = new MockRecognizer({ ...NO_FAILURES, jitterSigma: 0.012 });

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

/** 인식 결과를 아직 아무것도 거치지 않고 그린다. 조준점이 눈에 띄게 떨린다. */
function loop(now: number): void {
  const g = groundTruth.sample(now);
  const frame = recognizer.observe(g, now);
  const observed = frame?.observations[0] ?? null;

  reticle.setVisible(observed !== null);
  if (observed) {
    const world = aimSurface.project(observed.x, observed.y, camera);
    if (world) reticle.setPosition(world);
  }
  renderer.render(scene, camera);
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
