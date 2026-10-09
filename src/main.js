import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { buildArchitecture } from './garden/architecture.js';
import { buildLandscape } from './garden/landscape.js';
import { buildVegetation } from './garden/vegetation.js';
import { VIEWS, getView, moveWalker, walkHeight } from './garden/layout.js';
import { createPalette } from './garden/materials.js';
import './style.css';

const canvasHost = document.querySelector('#garden-canvas');
const viewList = document.querySelector('#view-list');
const tourButton = document.querySelector('#tour-button');
const walkButton = document.querySelector('#walk-button');
const interactionText = document.querySelector('#interaction-text');
const loadingScreen = document.querySelector('#loading-screen');
const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2('#d8e4dc', 0.008);

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.35));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
canvasHost.append(renderer.domElement);

const camera = new THREE.PerspectiveCamera(43, window.innerWidth / window.innerHeight, 0.1, 350);
const initialId = new URLSearchParams(window.location.search).get('view');
const initialView = getView(initialId) || VIEWS[0];
camera.position.fromArray(initialView.position);
const controls = new OrbitControls(camera, renderer.domElement);
controls.target.fromArray(initialView.target);
controls.enableDamping = true;
controls.dampingFactor = 0.07;
controls.enablePan = false;
controls.minDistance = 3;
controls.maxDistance = 69;
controls.minPolarAngle = 0.2;
controls.maxPolarAngle = Math.PI * 0.48;
controls.update();

const sky = new THREE.Mesh(
  new THREE.SphereGeometry(160, 32, 16),
  new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    vertexShader: 'varying vec3 vDirection; void main(){vDirection=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
    fragmentShader: 'varying vec3 vDirection; void main(){float h=normalize(vDirection).y; vec3 horizon=vec3(0.87,0.89,0.83); vec3 zenith=vec3(0.64,0.78,0.81); vec3 low=vec3(0.79,0.85,0.78); vec3 color=mix(low,horizon,smoothstep(-0.35,0.10,h)); color=mix(color,zenith,smoothstep(0.04,0.88,h)); gl_FragColor=vec4(color,1.0);}'
  })
);
sky.frustumCulled = false;
scene.add(sky);

const ambient = new THREE.HemisphereLight('#f4f5eb', '#789681', 2.05);
scene.add(ambient);
const sun = new THREE.DirectionalLight('#fff1d2', 3.1);
sun.position.set(-22, 37, 16);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -34;
sun.shadow.camera.right = 34;
sun.shadow.camera.top = 32;
sun.shadow.camera.bottom = -32;
sun.shadow.camera.near = 1;
sun.shadow.camera.far = 95;
sun.shadow.bias = -0.00014;
sun.shadow.normalBias = 0.025;
sun.shadow.radius = 2;
sun.target.position.set(0, 0, 0);
scene.add(sun, sun.target);
const fill = new THREE.DirectionalLight('#b3d6d6', 1.0);
fill.position.set(22, 12, -20);
scene.add(fill);

const palette = createPalette();
const outerGround = new THREE.Mesh(new THREE.PlaneGeometry(260, 260), new THREE.MeshStandardMaterial({ color: '#8fa890', roughness: 1 }));
outerGround.rotation.x = -Math.PI / 2;
outerGround.position.y = -0.2;
outerGround.receiveShadow = true;
scene.add(outerGround);

const garden = new THREE.Group();
garden.name = 'suzhou-garden';
scene.add(garden);
buildLandscape(garden, palette);
buildArchitecture(garden, palette);
buildVegetation(garden, palette);
garden.traverse((object) => {
  if (!object.isMesh || object.isInstancedMesh) return;
  if (object.scale.length() < 1.5 && !object.name.includes('roof')) object.castShadow = false;
});

const ripples = [];
const rippleMaterial = new THREE.MeshBasicMaterial({ color: '#e3ece4', transparent: true, opacity: 0.19, depthWrite: false, side: THREE.DoubleSide });
for (const [x, z, scale, phase] of [[-4, 0, 1, 0], [6, -3, 0.85, 1.7], [0, 3, 0.65, 3.2], [8, 1, 0.4, 4.5]]) {
  for (let i = 0; i < 2; i++) {
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.96, 1.0, 64), rippleMaterial.clone());
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(x, 0.07 + i * 0.004, z);
    ring.scale.set(scale, scale * 0.45, 1);
    ring.userData = { phase: phase + i * Math.PI, scale };
    ring.renderOrder = 3;
    garden.add(ring);
    ripples.push(ring);
  }
}

let currentView = initialView;
let transition = null;
let tourTimer = null;
let walkMode = false;
let walkYaw = 0;
let walkPitch = -0.08;
let lookPointer = null;
const pressedKeys = new Set();
const WALK_STARTS = {
  overview: [0, 12], entrance: [0, 12], hall: [-4.3, -8.5],
  pavilion: [13.5, -4], bridge: [2, 7.5], moonGate: [19, 8], rockery: [-17, 5]
};
const clock = new THREE.Clock();
const smooth = (t) => t * t * (3 - 2 * t);

function updateViewUI(view) {
  const index = VIEWS.indexOf(view) + 1;
  document.querySelector('#view-number').textContent = `${String(index).padStart(2, '0')} / ${String(VIEWS.length).padStart(2, '0')}`;
  document.querySelector('#view-title').textContent = view.label;
  document.querySelector('#view-subtitle').textContent = view.subtitle;
  for (const button of viewList.querySelectorAll('.view-item')) {
    const active = button.dataset.view === view.id;
    button.classList.toggle('active', active);
    button.setAttribute('aria-current', active ? 'true' : 'false');
  }
}

function aimWalker() {
  const flat = Math.cos(walkPitch);
  camera.lookAt(
    camera.position.x + Math.sin(walkYaw) * flat,
    camera.position.y + Math.sin(walkPitch),
    camera.position.z - Math.cos(walkYaw) * flat
  );
}

function exitWalk(restoreView = true) {
  if (!walkMode) return;
  walkMode = false;
  lookPointer = null;
  pressedKeys.clear();
  controls.enabled = true;
  walkButton.setAttribute('aria-pressed', 'false');
  walkButton.innerHTML = '自由漫游 <span aria-hidden="true">⌖</span>';
  interactionText.innerHTML = '拖动旋转 <i>·</i> 滚轮缩放 <i>·</i> 点击漫游';
  if (restoreView) selectView(currentView.id, true);
}

function enterWalk() {
  stopTour();
  walkMode = true;
  transition = null;
  controls.enabled = false;
  pressedKeys.clear();
  const [x, z] = WALK_STARTS[currentView.id];
  camera.position.set(x, 1.72 + walkHeight(x, z), z);
  walkYaw = Math.atan2(currentView.target[0] - x, z - currentView.target[2]);
  walkPitch = -0.08;
  aimWalker();
  walkButton.setAttribute('aria-pressed', 'true');
  walkButton.innerHTML = '返回观景 <span aria-hidden="true">↩</span>';
  interactionText.innerHTML = 'WASD 移动 <i>·</i> 拖动视角 <i>·</i> Esc 返回';
}

function selectView(id, immediate = false) {
  const view = getView(id);
  if (!view) return false;
  exitWalk(false);
  currentView = view;
  updateViewUI(view);
  const endPosition = new THREE.Vector3(...view.position);
  const endTarget = new THREE.Vector3(...view.target);
  if (immediate) {
    camera.position.copy(endPosition);
    controls.target.copy(endTarget);
    transition = null;
    controls.update();
    return true;
  }
  transition = {
    start: performance.now(),
    duration: 1750,
    fromPosition: camera.position.clone(),
    fromTarget: controls.target.clone(),
    endPosition,
    endTarget
  };
  return true;
}

function stopTour() {
  if (tourTimer) window.clearInterval(tourTimer);
  tourTimer = null;
  tourButton.querySelector('.tour-icon').textContent = '▶';
  tourButton.querySelector('.tour-label').textContent = '开启游园';
}

function nextView() {
  selectView(VIEWS[(VIEWS.indexOf(currentView) + 1) % VIEWS.length].id);
}

VIEWS.forEach((view) => {
  const button = document.createElement('button');
  button.className = 'view-item';
  button.type = 'button';
  button.dataset.view = view.id;
  button.setAttribute('aria-label', `前往${view.label}`);
  button.innerHTML = `<span class="view-index">${view.index}</span><span class="view-name">${view.label}</span><span class="view-arrow" aria-hidden="true">↗</span>`;
  button.addEventListener('click', () => {
    stopTour();
    selectView(view.id);
  });
  viewList.append(button);
});
updateViewUI(initialView);

walkButton.addEventListener('click', () => {
  if (walkMode) exitWalk();
  else enterWalk();
});

window.addEventListener('keydown', (event) => {
  if (!walkMode) return;
  if (event.code === 'Escape') {
    exitWalk();
    return;
  }
  if (['KeyW', 'KeyA', 'KeyS', 'KeyD'].includes(event.code)) {
    event.preventDefault();
    pressedKeys.add(event.code);
  }
});
window.addEventListener('keyup', (event) => { pressedKeys.delete(event.code); });
window.addEventListener('blur', () => { pressedKeys.clear(); });
renderer.domElement.addEventListener('pointerdown', (event) => {
  if (!walkMode || event.button !== 0) return;
  lookPointer = { id: event.pointerId, x: event.clientX, y: event.clientY };
  renderer.domElement.setPointerCapture(event.pointerId);
});
renderer.domElement.addEventListener('pointermove', (event) => {
  if (!walkMode || lookPointer?.id !== event.pointerId) return;
  walkYaw += (event.clientX - lookPointer.x) * 0.004;
  walkPitch = THREE.MathUtils.clamp(walkPitch - (event.clientY - lookPointer.y) * 0.003, -0.85, 0.85);
  lookPointer.x = event.clientX;
  lookPointer.y = event.clientY;
});
renderer.domElement.addEventListener('pointerup', () => { lookPointer = null; });
renderer.domElement.addEventListener('pointercancel', () => { lookPointer = null; });

tourButton.addEventListener('click', () => {
  if (tourTimer) {
    stopTour();
    return;
  }
  nextView();
  tourTimer = window.setInterval(nextView, 7200);
  tourButton.querySelector('.tour-icon').textContent = 'Ⅱ';
  tourButton.querySelector('.tour-label').textContent = '暂停游园';
});

document.querySelector('#fullscreen-button').addEventListener('click', async () => {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await document.documentElement.requestFullscreen();
  } catch {
    document.querySelector('#fullscreen-button').blur();
  }
});

controls.addEventListener('start', () => { transition = null; });
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

function animate() {
  requestAnimationFrame(animate);
  const delta = Math.min(clock.getDelta(), 0.05);
  const elapsed = clock.elapsedTime;
  if (transition) {
    const t = Math.min(1, (performance.now() - transition.start) / transition.duration);
    const eased = smooth(t);
    camera.position.lerpVectors(transition.fromPosition, transition.endPosition, eased);
    controls.target.lerpVectors(transition.fromTarget, transition.endTarget, eased);
    if (t >= 1) transition = null;
  }
  for (const ring of ripples) {
    const wave = (elapsed * 0.28 + ring.userData.phase) % 1;
    ring.scale.setScalar(ring.userData.scale * (0.64 + wave * 0.68));
    ring.scale.y *= 0.45;
    ring.material.opacity = 0.13 * (1 - wave);
  }
  palette.water.bumpMap.offset.x = elapsed * 0.003;
  palette.water.bumpMap.offset.y = elapsed * 0.002;
  if (walkMode) {
    const [x, z] = moveWalker(
      [camera.position.x, camera.position.z],
      {
        forward: Number(pressedKeys.has('KeyW')) - Number(pressedKeys.has('KeyS')),
        right: Number(pressedKeys.has('KeyD')) - Number(pressedKeys.has('KeyA'))
      },
      walkYaw,
      delta * 3.5
    );
    camera.position.set(x, THREE.MathUtils.lerp(camera.position.y, 1.72 + walkHeight(x, z), Math.min(1, delta * 10)), z);
    aimWalker();
  } else {
    controls.update();
  }
  renderer.render(scene, camera);
  window.__gardenStats.cameraPosition = camera.position.toArray();
}

window.__setGardenView = (id) => selectView(id, true);
window.__gardenReady = true;
window.__gardenStats = { views: VIEWS.length, landmarks: garden.children.length };
animate();
window.setTimeout(() => loadingScreen.classList.add('done'), 450);
