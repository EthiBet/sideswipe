import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';

// ---------- CONFIG ----------
const CAR_URL = 'https://raw.githubusercontent.com/EthiBet/sideswipe/main/origincar.glb';

// Arena dimensions (units are arbitrary but consistent across everything below)
const ARENA_LENGTH = 24;   // long axis (X) - side to side
const ARENA_HEIGHT = 10;   // vertical (Y)
const ARENA_DEPTH = 6;     // short axis (Z) - "2D" gameplay depth, kept shallow
const GOAL_WIDTH = 4;      // how wide the goal opening is (vertically, since goals are elevated)
const GOAL_GAP_FROM_FLOOR = 2; // gap between floor and bottom of goal opening, per your spec

const BALL_RADIUS = 1.0;

// ---------- DEBUG PANEL (no DevTools available, so we print to the page) ----------
const debugPanel = document.getElementById('debug-panel');
const debugLines = [];
function debugLog(msg) {
  debugLines.push(msg);
  debugPanel.textContent = debugLines.join('\n');
}

// ---------- RENDERER / SCENE / CAMERA ----------
const canvas = document.getElementById('scene-canvas');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x111318);

const camera = new THREE.PerspectiveCamera(
  55,
  window.innerWidth / window.innerHeight,
  0.1,
  200
);
// Angled view looking down the long axis of the arena - typical Sideswipe-style side view
camera.position.set(0, 9, 16);
camera.lookAt(0, 2, 0);

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ---------- LIGHTING ----------
const ambient = new THREE.AmbientLight(0xffffff, 0.6);
scene.add(ambient);

const dirLight = new THREE.DirectionalLight(0xffffff, 1.0);
dirLight.position.set(5, 12, 8);
scene.add(dirLight);

// ---------- ARENA (built from primitives - no external model) ----------
const arenaGroup = new THREE.Group();

// Floor
const floorGeo = new THREE.PlaneGeometry(ARENA_LENGTH, ARENA_DEPTH);
const floorMat = new THREE.MeshStandardMaterial({ color: 0x2a2d33, roughness: 0.9 });
const floor = new THREE.Mesh(floorGeo, floorMat);
floor.rotation.x = -Math.PI / 2;
arenaGroup.add(floor);

// Ceiling (glass-ish, semi-transparent)
const ceilingGeo = new THREE.PlaneGeometry(ARENA_LENGTH, ARENA_DEPTH);
const ceilingMat = new THREE.MeshStandardMaterial({
  color: 0x88ccff,
  transparent: true,
  opacity: 0.15,
  side: THREE.DoubleSide,
});
const ceiling = new THREE.Mesh(ceilingGeo, ceilingMat);
ceiling.rotation.x = Math.PI / 2;
ceiling.position.y = ARENA_HEIGHT;
arenaGroup.add(ceiling);

// Back and front walls (long side walls, along X axis) - curved is approximated
// later with multiple segments; for Stage 1 we start with flat walls to confirm scale.
const sideWallGeo = new THREE.PlaneGeometry(ARENA_LENGTH, ARENA_HEIGHT);
const sideWallMat = new THREE.MeshStandardMaterial({
  color: 0x3a3f47,
  transparent: true,
  opacity: 0.35,
  side: THREE.DoubleSide,
});

const wallBack = new THREE.Mesh(sideWallGeo, sideWallMat);
wallBack.position.set(0, ARENA_HEIGHT / 2, -ARENA_DEPTH / 2);
arenaGroup.add(wallBack);

const wallFront = new THREE.Mesh(sideWallGeo, sideWallMat);
wallFront.position.set(0, ARENA_HEIGHT / 2, ARENA_DEPTH / 2);
arenaGroup.add(wallFront);

// End walls with elevated goal openings cut out.
// Built from 3 panels per end (bottom solid panel, top solid panel, sides beside the
// goal opening) rather than a boolean cut, since boolean ops aren't available without
// extra libraries - this is a simple, reliable way to get the same visual result.
function buildEndWallWithGoal(xPosition, colorHex) {
  const group = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: colorHex, roughness: 0.7 });

  const goalTop = GOAL_GAP_FROM_FLOOR + GOAL_WIDTH;

  // Bottom panel (floor up to the start of the goal gap)
  const bottomHeight = GOAL_GAP_FROM_FLOOR;
  if (bottomHeight > 0) {
    const bottomGeo = new THREE.PlaneGeometry(ARENA_DEPTH, bottomHeight);
    const bottomPanel = new THREE.Mesh(bottomGeo, mat);
    bottomPanel.rotation.y = Math.PI / 2;
    bottomPanel.position.set(xPosition, bottomHeight / 2, 0);
    group.add(bottomPanel);
  }

  // Top panel (from top of goal gap up to ceiling)
  const topHeight = ARENA_HEIGHT - goalTop;
  if (topHeight > 0) {
    const topGeo = new THREE.PlaneGeometry(ARENA_DEPTH, topHeight);
    const topPanel = new THREE.Mesh(topGeo, mat);
    topPanel.rotation.y = Math.PI / 2;
    topPanel.position.set(xPosition, goalTop + topHeight / 2, 0);
    group.add(topPanel);
  }

  return group;
}

const wallLeft = buildEndWallWithGoal(-ARENA_LENGTH / 2, 0x1e5fbf);  // blue side
const wallRight = buildEndWallWithGoal(ARENA_LENGTH / 2, 0xd97706);  // orange side
arenaGroup.add(wallLeft, wallRight);

scene.add(arenaGroup);

// ---------- BALL (primitive sphere - no external model) ----------
const ballGeo = new THREE.SphereGeometry(BALL_RADIUS, 32, 32);
const ballMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4 });
const ball = new THREE.Mesh(ballGeo, ballMat);
ball.position.set(0, BALL_RADIUS + 0.5, 0);
scene.add(ball);

// ---------- CAR (loaded from GitHub-hosted GLB) ----------
const loader = new GLTFLoader();
const dracoLoader = new DRACOLoader();
dracoLoader.setDecoderPath('https://unpkg.com/three@0.160.0/examples/jsm/libs/draco/');
loader.setDRACOLoader(dracoLoader);
let car = null;

debugLog('Loading car model...');

loader.load(
  CAR_URL,
  (gltf) => {
    car = gltf.scene;

    // Measure the raw imported size before we do anything else, since AI-exported
    // models can come in at wildly different scales
    const box = new THREE.Box3().setFromObject(car);
    const size = new THREE.Vector3();
    box.getSize(size);
    debugLog(
      `Car loaded. Raw size: ${size.x.toFixed(2)} x ${size.y.toFixed(2)} x ${size.z.toFixed(2)}`
    );

    // Collect mesh names so we know whether tires can be targeted separately
    const meshNames = [];
    car.traverse((child) => {
      if (child.isMesh) meshNames.push(child.name || '(unnamed)');
    });
    debugLog(`Model parts: ${meshNames.join(', ')}`);

    // Normalize scale: target a car length of ~2 units along its longest horizontal axis
    const longestSide = Math.max(size.x, size.z);
    const targetLength = 2.0;
    const scaleFactor = targetLength / longestSide;
    car.scale.setScalar(scaleFactor);

    // Re-measure after scaling to know how high off the floor to sit it
    const scaledBox = new THREE.Box3().setFromObject(car);
    const scaledSize = new THREE.Vector3();
    scaledBox.getSize(scaledSize);
    debugLog(
      `Scaled by ${scaleFactor.toFixed(4)}. New size: ${scaledSize.x.toFixed(2)} x ${scaledSize.y.toFixed(2)} x ${scaledSize.z.toFixed(2)}`
    );

    car.position.set(-4, scaledSize.y / 2, 0);

    // Apply team color (orange) - single-mesh models recolor entirely for now
    car.traverse((child) => {
      if (child.isMesh) {
        child.material = child.material.clone();
        child.material.color.set(0xff6600);
      }
    });

    scene.add(car);
    debugLog('Car added to scene.');
  },
  (progress) => {
    if (progress.total) {
      const pct = ((progress.loaded / progress.total) * 100).toFixed(0);
      debugLog(`Loading car: ${pct}%`);
    }
  },
  (error) => {
    debugLog(`ERROR loading car: ${error.message || error}`);
  }
);

// ---------- RENDER LOOP ----------
function animate() {
  requestAnimationFrame(animate);
  renderer.render(scene, camera);
}
animate();
