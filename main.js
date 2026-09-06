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

// ---------- MOVEMENT / PHYSICS CONSTANTS ----------
// This is a 2D side-view game: X = left/right (ground movement), Y = up/down
// (jump + gravity). Z stays fixed - it's just the "3D depth" of the car model.
const MOVE_SPEED = 6;          // ground horizontal speed, units/sec at full joystick deflection
const AIR_STEER_SPEED = 2.5;   // how much horizontal drift the joystick gives while airborne
const GRAVITY = 18;            // downward acceleration, units/sec^2
const JUMP_VELOCITY = 8;       // upward speed applied on jump
const FAST_FALL_MULTIPLIER = 2.5; // extra downward pull when pulling joystick down/back in air
const BOOST_ACCEL = 10;        // extra acceleration/sec while boosting
const BOOST_DRAIN_PER_SEC = 40;   // meter points drained per second while held
const BOOST_RECHARGE_PER_SEC = 15; // meter points regained per second while not held
const ARENA_HALF_LENGTH = ARENA_LENGTH / 2 - 1.5; // leaves room so car doesn't clip through goal walls

// Car physics state - separate from the Three.js object's own transform,
// since we compute position/velocity ourselves each frame.
const carState = {
  x: -4,
  y: 0,           // 0 = resting on the floor; car's own half-height is added visually
  vx: 0,
  vy: 0,
  grounded: true,
  facingFlipped: false, // toggled by the rotate/turnaround button
  boost: 100,
  isRolling: false,     // continuous air roll toggled by double-tapping the joystick
};
let carHalfHeight = 0.3; // updated once the real model size is known

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
    carHalfHeight = scaledSize.y / 2;

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

// ---------- INPUT: JOYSTICK ----------
const joystickBase = document.getElementById('joystick-base');
const joystickKnob = document.getElementById('joystick-knob');
const JOYSTICK_RADIUS = 65; // matches half of #joystick-base width in CSS

let joystickActive = false;
let joystickX = 0; // -1 (left) to 1 (right)
let joystickY = 0; // -1 (pulled down/back) to 1 (pushed up)
let joystickPointerId = null;

let lastJoystickTapTime = 0;
const DOUBLE_TAP_WINDOW_MS = 350;

function getJoystickBaseCenter() {
  const rect = joystickBase.getBoundingClientRect();
  return { cx: rect.left + rect.width / 2, cy: rect.top + rect.height / 2 };
}

function updateJoystickFromPointer(clientX, clientY) {
  const { cx, cy } = getJoystickBaseCenter();
  let dx = clientX - cx;
  let dy = clientY - cy;
  const dist = Math.sqrt(dx * dx + dy * dy);
  if (dist > JOYSTICK_RADIUS) {
    dx = (dx / dist) * JOYSTICK_RADIUS;
    dy = (dy / dist) * JOYSTICK_RADIUS;
  }
  joystickKnob.style.transform = `translate(${dx}px, ${dy}px)`;
  joystickX = dx / JOYSTICK_RADIUS;
  joystickY = -dy / JOYSTICK_RADIUS; // invert so "up" on screen = positive
}

function resetJoystick() {
  joystickKnob.style.transform = 'translate(0px, 0px)';
  joystickX = 0;
  joystickY = 0;
}

joystickBase.addEventListener('pointerdown', (e) => {
  joystickActive = true;
  joystickPointerId = e.pointerId;
  joystickBase.setPointerCapture(e.pointerId);
  updateJoystickFromPointer(e.clientX, e.clientY);
  debugLog(`Joystick down at (${e.clientX.toFixed(0)}, ${e.clientY.toFixed(0)})`);

  // Double-tap detection - toggles continuous air roll while airborne
  const now = performance.now();
  if (now - lastJoystickTapTime < DOUBLE_TAP_WINDOW_MS) {
    if (!carState.grounded) {
      carState.isRolling = !carState.isRolling;
      debugLog(`Air roll ${carState.isRolling ? 'started' : 'stopped'}`);
    }
  }
  lastJoystickTapTime = now;
});

joystickBase.addEventListener('pointermove', (e) => {
  if (joystickActive && e.pointerId === joystickPointerId) {
    updateJoystickFromPointer(e.clientX, e.clientY);
  }
});

function endJoystick(e) {
  if (e.pointerId === joystickPointerId) {
    joystickActive = false;
    joystickPointerId = null;
    resetJoystick();
  }
}
joystickBase.addEventListener('pointerup', endJoystick);
joystickBase.addEventListener('pointercancel', endJoystick);

// ---------- INPUT: BUTTONS ----------
const jumpBtn = document.getElementById('jump-btn');
const boostBtn = document.getElementById('boost-btn');
const rotateBtn = document.getElementById('rotate-btn');
const boostFill = document.getElementById('boost-fill');

let boostHeld = false;

jumpBtn.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  debugLog(`Jump pressed. grounded=${carState.grounded}`);
  if (carState.grounded) {
    carState.vy = JUMP_VELOCITY;
    carState.grounded = false;
  }
});

boostBtn.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  boostHeld = true;
  debugLog('Boost pressed');
});
boostBtn.addEventListener('pointerup', () => { boostHeld = false; debugLog('Boost released'); });
boostBtn.addEventListener('pointercancel', () => { boostHeld = false; });
boostBtn.addEventListener('pointerleave', () => { boostHeld = false; });

rotateBtn.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  carState.facingFlipped = !carState.facingFlipped;
  debugLog(`Rotate pressed. facingFlipped=${carState.facingFlipped}`);
});

function updateBoostMeterUI() {
  const degrees = (carState.boost / 100) * 360;
  boostFill.style.background = `conic-gradient(#fbbf24 ${degrees}deg, transparent ${degrees}deg)`;
}

// ---------- PHYSICS UPDATE ----------
function updateCarPhysics(dt) {
  if (!car) return;

  if (carState.grounded) {
    // Ground movement: direct horizontal control from the joystick
    carState.vx = joystickX * MOVE_SPEED;
  } else {
    // Airborne: joystick gives light steering drift, not full control
    carState.vx += joystickX * AIR_STEER_SPEED * dt;
    carState.vx *= 0.98; // slight air drag so drift doesn't run away

    // Pulling the joystick down/back triggers a fast-fall
    if (joystickY < -0.5) {
      carState.vy -= GRAVITY * FAST_FALL_MULTIPLIER * dt;
    }
  }

  // Boost: applies in the direction the car is currently facing
  if (boostHeld && carState.boost > 0) {
    const facingDir = carState.facingFlipped ? -1 : 1;
    carState.vx += facingDir * BOOST_ACCEL * dt;
    carState.boost = Math.max(0, carState.boost - BOOST_DRAIN_PER_SEC * dt);
  } else if (carState.boost < 100) {
    carState.boost = Math.min(100, carState.boost + BOOST_RECHARGE_PER_SEC * dt);
  }
  updateBoostMeterUI();

  // Gravity always applies except when resting on the ground
  if (!carState.grounded) {
    carState.vy -= GRAVITY * dt;
  }

  // Integrate position
  carState.x += carState.vx * dt;
  carState.y += carState.vy * dt;

  // Clamp to arena bounds so the car can't drive through the goal walls
  carState.x = Math.max(-ARENA_HALF_LENGTH, Math.min(ARENA_HALF_LENGTH, carState.x));

  // Ground collision
  if (carState.y <= 0) {
    carState.y = 0;
    carState.vy = 0;
    carState.grounded = true;
  }

  // Apply to the actual 3D object
  car.position.x = carState.x;
  car.position.y = carHalfHeight + carState.y;

  // Facing flip (turnaround button) - rotates the model 180 degrees around Y
  // so it visually still looks like it's driving forward while reversing
  const baseFacing = carState.facingFlipped ? Math.PI : 0;

  if (carState.isRolling) {
    // Continuous air roll - spin around the car's forward (Z) axis
    car.rotation.z += dt * 6;
  } else {
    car.rotation.z = 0;
  }
  car.rotation.y = baseFacing;
}


// ---------- RENDER LOOP ----------
const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.1); // clamp dt to avoid big jumps on tab-switch lag
  updateCarPhysics(dt);
  renderer.render(scene, camera);
}
animate();
