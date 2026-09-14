import * as THREE from 'three';
import { GroundTruthTracker } from './aim/groundTruth';
import { AimSurface, Reticle } from './scene/reticle';

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

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

/** 아직 처리 단계가 없다. 마우스 위치를 그대로 조준점에 연결해 기준선으로 삼는다. */
function loop(now: number): void {
  const g = groundTruth.sample(now);
  reticle.setVisible(g !== null);
  if (g) {
    const world = aimSurface.project(g.x, g.y, camera);
    if (world) reticle.setPosition(world);
  }
  renderer.render(scene, camera);
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
