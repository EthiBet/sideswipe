import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';

// ---------- NETWORK CONFIG (set by lobby.js before this file loads) ----------
// Falls back to a single local player if this file is ever loaded standalone
// (e.g. during earlier-stage testing), so nothing breaks.
const NET = window.gameNetwork || {
  isHost: true,
  myId: 'local',
  myUsername: 'You',
  peerConnections: [],
  roster: [{ id: 'local', username: 'You', team: 'blue' }],
};
const IS_HOST = NET.isHost;
const LOCAL_ID = NET.myId;
const ROSTER = NET.roster;
const PEER_CONNECTIONS = NET.peerConnections || [];

// ---------- CONFIG ----------
const CAR_URL = 'https://raw.githubusercontent.com/EthiBet/sideswipe/main/origincar.glb';

const ARENA_LENGTH = 50;
const ARENA_HEIGHT = 10;
const ARENA_DEPTH = 6;
const GOAL_WIDTH = 4;
const GOAL_GAP_FROM_FLOOR = 2;
const BALL_RADIUS = 1.0;

// ---------- MOVEMENT / PHYSICS CONSTANTS ----------
const MOVE_SPEED = 6;
const AIR_STEER_SPEED = 2.5;
const GRAVITY = 18;
const JUMP_VELOCITY = 8;
const FAST_FALL_MULTIPLIER = 2.5;
const BOOST_ACCEL = 10;
const BOOST_GROUND_SPEED_BONUS = 5;
const BOOST_DRAIN_PER_SEC = 40;
const BOOST_RECHARGE_PER_SEC = 15;
const ARENA_HALF_LENGTH = ARENA_LENGTH / 2 - 1.5;

const BALL_GRAVITY = 14;
const BALL_RESTITUTION = 0.45;
const MIN_HIT_PUSH = 1.2;
const SHOT_MIN_IMPACT_SPEED = 3.0;
const SHOT_COOLDOWN = 0.4;

const WALL_X_LEFT = -ARENA_LENGTH / 2;
const WALL_X_RIGHT = ARENA_LENGTH / 2;
const GOAL_BOTTOM = GOAL_GAP_FROM_FLOOR;
const GOAL_TOP = GOAL_GAP_FROM_FLOOR + GOAL_WIDTH;

const TEAM_COLORS = { blue: 0x2563eb, orange: 0xff6600 };

// ---------- DEBUG PANEL ----------
const debugPanel = document.getElementById('debug-panel');
const debugLines = [];
function debugLog(msg) {
  debugLines.push(msg);
  if (debugLines.length > 12) debugLines.shift(); // cap so it doesn't grow forever in long matches
  debugPanel.textContent = debugLines.join('\n');
}
debugLog(`Network: isHost=${IS_HOST}, myId=${LOCAL_ID}, players=${ROSTER.length}`);

// ---------- RENDERER / SCENE / CAMERA ----------
const canvas = document.getElementById('scene-canvas');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x111318);

const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 200);
camera.position.set(0, 9, 16);
camera.lookAt(0, 2, 0);

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

const ambient = new THREE.AmbientLight(0xffffff, 0.6);
scene.add(ambient);
const dirLight = new THREE.DirectionalLight(0xffffff, 1.0);
dirLight.position.set(5, 12, 8);
scene.add(dirLight);

// ---------- ARENA ----------
const arenaGroup = new THREE.Group();
const floorGeo = new THREE.PlaneGeometry(ARENA_LENGTH, ARENA_DEPTH);
const floorMat = new THREE.MeshStandardMaterial({ color: 0x2a2d33, roughness: 0.9 });
const floor = new THREE.Mesh(floorGeo, floorMat);
floor.rotation.x = -Math.PI / 2;
arenaGroup.add(floor);

const ceilingGeo = new THREE.PlaneGeometry(ARENA_LENGTH, ARENA_DEPTH);
const ceilingMat = new THREE.MeshStandardMaterial({ color: 0x88ccff, transparent: true, opacity: 0.15, side: THREE.DoubleSide });
const ceiling = new THREE.Mesh(ceilingGeo, ceilingMat);
ceiling.rotation.x = Math.PI / 2;
ceiling.position.y = ARENA_HEIGHT;
arenaGroup.add(ceiling);

const sideWallGeo = new THREE.PlaneGeometry(ARENA_LENGTH, ARENA_HEIGHT);
const sideWallMat = new THREE.MeshStandardMaterial({ color: 0x3a3f47, transparent: true, opacity: 0.35, side: THREE.DoubleSide });
const wallBack = new THREE.Mesh(sideWallGeo, sideWallMat);
wallBack.position.set(0, ARENA_HEIGHT / 2, -ARENA_DEPTH / 2);
arenaGroup.add(wallBack);
const wallFront = new THREE.Mesh(sideWallGeo, sideWallMat);
wallFront.position.set(0, ARENA_HEIGHT / 2, ARENA_DEPTH / 2);
arenaGroup.add(wallFront);

function buildEndWallWithGoal(xPosition, colorHex) {
  const group = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: colorHex, roughness: 0.7 });
  const goalTop = GOAL_GAP_FROM_FLOOR + GOAL_WIDTH;
  const bottomHeight = GOAL_GAP_FROM_FLOOR;
  if (bottomHeight > 0) {
    const bottomGeo = new THREE.PlaneGeometry(ARENA_DEPTH, bottomHeight);
    const bottomPanel = new THREE.Mesh(bottomGeo, mat);
    bottomPanel.rotation.y = Math.PI / 2;
    bottomPanel.position.set(xPosition, bottomHeight / 2, 0);
    group.add(bottomPanel);
  }
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
arenaGroup.add(buildEndWallWithGoal(-ARENA_LENGTH / 2, 0x1e5fbf), buildEndWallWithGoal(ARENA_LENGTH / 2, 0xd97706));
scene.add(arenaGroup);

// ---------- BALL ----------
const ballGeo = new THREE.SphereGeometry(BALL_RADIUS, 32, 32);
const ballMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4 });
const ball = new THREE.Mesh(ballGeo, ballMat);
scene.add(ball);

const ballState = { x: 0, y: BALL_RADIUS + 3, vx: 0, vy: 0 };
function resetBallToCenter() {
  ballState.x = 0;
  ballState.y = BALL_RADIUS + 3;
  ballState.vx = 0;
  ballState.vy = 0;
}

// ---------- USERNAME SPRITE FACTORY ----------
function makeUsernameSprite(text) {
  const canvas2 = document.createElement('canvas');
  canvas2.width = 256;
  canvas2.height = 64;
  const ctx = canvas2.getContext('2d');
  ctx.font = 'bold 36px sans-serif';
  ctx.fillStyle = 'white';
  ctx.strokeStyle = 'black';
  ctx.lineWidth = 5;
  ctx.textAlign = 'center';
  ctx.strokeText(text, 128, 44);
  ctx.fillText(text, 128, 44);
  const texture = new THREE.CanvasTexture(canvas2);
  const material = new THREE.SpriteMaterial({ map: texture, depthTest: false });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(1.6, 0.4, 1);
  return sprite;
}

// ---------- PLAYERS ----------
// Each entry: { id, username, team, isLocal, mesh, usernameSprite, state:{x,y,vx,vy,grounded,facingFlipped,boost,isRolling,lastMoveDir} }
const players = {};
let carHalfHeight = 0.3;
let carHalfLength = 1.0;
let carTemplate = null; // the loaded GLTF scene, cloned per player once available

function spawnXForIndex(i, team) {
  const side = team === 'blue' ? -1 : 1;
  const slot = Math.floor(i / 2) + 1;
  return side * (4 * slot);
}

function createPlayerEntry(rosterEntry, index) {
  const state = {
    x: spawnXForIndex(index, rosterEntry.team),
    y: 0, vx: 0, vy: 0,
    grounded: true, facingFlipped: false, boost: 100, isRolling: false, lastMoveDir: 1,
  };

  const mesh = carTemplate.clone(true);
  mesh.traverse((child) => {
    if (child.isMesh) {
      child.material = child.material.clone();
      child.material.color.set(TEAM_COLORS[rosterEntry.team] || 0xffffff);
    }
  });
  mesh.scale.copy(carTemplate.scale);
  mesh.position.set(state.x, carHalfHeight, 0);
  scene.add(mesh);

  const usernameSprite = makeUsernameSprite(rosterEntry.username);
  scene.add(usernameSprite);

  players[rosterEntry.id] = {
    id: rosterEntry.id,
    username: rosterEntry.username,
    team: rosterEntry.team,
    isLocal: rosterEntry.id === LOCAL_ID,
    mesh,
    usernameSprite,
    state,
  };
}

// ---------- MATCH / SCORE STATE (authoritative on host; mirrored on clients) ----------
const matchState = {
  scoreBlue: 0, scoreOrange: 0, timeRemaining: 120,
  overtime: false, gameOver: false, controlsFrozen: false,
};
const scoreBlueEl = document.getElementById('score-blue');
const scoreOrangeEl = document.getElementById('score-orange');
const matchTimerEl = document.getElementById('match-timer');
const matchBannerEl = document.getElementById('match-banner');

function formatTime(totalSeconds) {
  const m = Math.floor(totalSeconds / 60);
  const s = Math.floor(totalSeconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function setControlsVisible(visible) {
  document.getElementById('joystick-base').style.display = visible ? '' : 'none';
  document.getElementById('button-cluster').style.display = visible ? '' : 'none';
}

function resetAllPlayersToStart() {
  Object.values(players).forEach((p, i) => {
    p.state.x = spawnXForIndex(i, p.team);
    p.state.y = 0; p.state.vx = 0; p.state.vy = 0;
    p.state.grounded = true; p.state.facingFlipped = false; p.state.isRolling = false;
    p.mesh.position.set(p.state.x, carHalfHeight, 0);
    p.mesh.rotation.set(0, 0, 0);
  });
}

let kickoffTimeoutHandles = [];
function clearKickoffTimeouts() {
  kickoffTimeoutHandles.forEach((h) => clearTimeout(h));
  kickoffTimeoutHandles = [];
}

function startKickoffCountdown() {
  matchState.controlsFrozen = true;
  resetAllPlayersToStart();
  resetBallToCenter();
  setControlsVisible(false);
  matchBannerEl.style.color = 'white';
  matchBannerEl.style.display = 'block';

  let count = 3;
  matchBannerEl.textContent = count;
  clearKickoffTimeouts();
  for (let step = 1; step <= 3; step++) {
    kickoffTimeoutHandles.push(setTimeout(() => {
      count -= 1;
      matchBannerEl.textContent = count > 0 ? count : 'GO!';
      if (count <= 0) {
        kickoffTimeoutHandles.push(setTimeout(() => {
          matchBannerEl.style.display = 'none';
          setControlsVisible(true);
          matchState.controlsFrozen = false;
        }, 500));
      }
    }, step * 1000));
  }
}

function awardGoal(scoringTeam) {
  if (scoringTeam === 'blue') matchState.scoreBlue += 1; else matchState.scoreOrange += 1;
  scoreBlueEl.textContent = matchState.scoreBlue;
  scoreOrangeEl.textContent = matchState.scoreOrange;
  debugLog(`GOAL ${scoringTeam}! ${matchState.scoreBlue}-${matchState.scoreOrange}`);

  const scorer = Object.values(players).find((p) => p.isLocal && p.team === scoringTeam);
  if (scorer) { playerStats.goals += 1; updateStatsUI(); }

  if (matchState.overtime) endMatch(scoringTeam);
  else startKickoffCountdown();
}

function endMatch(winner) {
  matchState.gameOver = true;
  matchState.controlsFrozen = true;
  matchBannerEl.style.display = 'block';
  if (winner === 'tie') {
    matchBannerEl.textContent = "IT'S A TIE";
    matchBannerEl.style.color = 'white';
  } else {
    matchBannerEl.textContent = `${winner.toUpperCase()} WINS!`;
    matchBannerEl.style.color = winner === 'blue' ? '#3b82f6' : '#f97316';
  }
  setControlsVisible(false);
}

function updateMatchTimer(dt) {
  if (matchState.gameOver || matchState.overtime || matchState.controlsFrozen) return;
  matchState.timeRemaining -= dt;
  if (matchState.timeRemaining <= 0) {
    matchState.timeRemaining = 0;
    if (matchState.scoreBlue === matchState.scoreOrange) {
      matchState.overtime = true;
      matchTimerEl.textContent = 'OVERTIME';
      startKickoffCountdown();
    } else {
      endMatch(matchState.scoreBlue > matchState.scoreOrange ? 'blue' : 'orange');
    }
  } else {
    matchTimerEl.textContent = formatTime(matchState.timeRemaining);
  }
}

// ---------- BALL PHYSICS (HOST ONLY - clients just render received state) ----------
let shotCooldownRemaining = 0;
let wasTouchingBallLocal = false;

function updateBallPhysicsHostOnly(dt) {
  if (matchState.gameOver || matchState.controlsFrozen) return;
  if (shotCooldownRemaining > 0) shotCooldownRemaining -= dt;

  ballState.vy -= BALL_GRAVITY * dt;
  ballState.x += ballState.vx * dt;
  ballState.y += ballState.vy * dt;

  if (ballState.y - BALL_RADIUS <= 0) {
    ballState.y = BALL_RADIUS;
    if (ballState.vy < 0) ballState.vy = -ballState.vy * BALL_RESTITUTION;
  }
  if (ballState.y + BALL_RADIUS >= ARENA_HEIGHT) {
    ballState.y = ARENA_HEIGHT - BALL_RADIUS;
    if (ballState.vy > 0) ballState.vy = -ballState.vy * BALL_RESTITUTION;
  }

  if (ballState.x - BALL_RADIUS <= WALL_X_LEFT) {
    const inGoal = ballState.y > GOAL_BOTTOM && ballState.y < GOAL_TOP;
    if (inGoal) {
      if (ballState.x + BALL_RADIUS <= WALL_X_LEFT) awardGoal('orange');
    } else {
      ballState.x = WALL_X_LEFT + BALL_RADIUS;
      ballState.vx = -ballState.vx * BALL_RESTITUTION;
    }
  }
  if (ballState.x + BALL_RADIUS >= WALL_X_RIGHT) {
    const inGoal = ballState.y > GOAL_BOTTOM && ballState.y < GOAL_TOP;
    if (inGoal) {
      if (ballState.x - BALL_RADIUS >= WALL_X_RIGHT) awardGoal('blue');
    } else {
      ballState.x = WALL_X_RIGHT - BALL_RADIUS;
      ballState.vx = -ballState.vx * BALL_RESTITUTION;
    }
  }

  // Check collision against every player's car (host trusts each player's
  // self-reported position for their own car - see input handling below)
  let anyTouch = false;
  Object.values(players).forEach((p) => {
    const s = p.state;
    const closestX = Math.max(s.x - carHalfLength, Math.min(ballState.x, s.x + carHalfLength));
    const carTopY = carHalfHeight + s.y + carHalfHeight;
    const carBottomY = s.y;
    const closestY = Math.max(carBottomY, Math.min(ballState.y, carTopY));
    const dx = ballState.x - closestX;
    const dy = ballState.y - closestY;
    const distSq = dx * dx + dy * dy;

    if (distSq < BALL_RADIUS * BALL_RADIUS) {
      anyTouch = true;
      const dist = Math.sqrt(distSq) || 0.001;
      const nx = dx / dist, ny = dy / dist;
      const overlap = BALL_RADIUS - dist;
      ballState.x += nx * overlap;
      ballState.y += ny * overlap;

      const relVelX = ballState.vx - s.vx;
      const relVelY = ballState.vy - Math.max(s.vy, 0);
      const closingSpeed = -(relVelX * nx + relVelY * ny);

      if (closingSpeed > 0) {
        const carSpeed = Math.sqrt(s.vx * s.vx + Math.max(s.vy, 0) ** 2);
        const pushStrength = MIN_HIT_PUSH + carSpeed * 0.5;
        ballState.vx = s.vx + nx * pushStrength;
        ballState.vy = Math.max(s.vy, 0) + ny * pushStrength;

        if (!wasTouchingBallLocal && shotCooldownRemaining <= 0 && pushStrength >= SHOT_MIN_IMPACT_SPEED && p.isLocal) {
          playerStats.shots += 1;
          updateStatsUI();
          shotCooldownRemaining = SHOT_COOLDOWN;
        }
      }
    }
  });
  wasTouchingBallLocal = anyTouch;
}

// ---------- LOCAL CAR PHYSICS ----------
function updateLocalCarPhysics(dt) {
  const local = players[LOCAL_ID];
  if (!local || matchState.gameOver || matchState.controlsFrozen) return;
  const s = local.state;

  const isBoosting = boostHeld && s.boost > 0;
  if (Math.abs(joystickX) > 0.05) s.lastMoveDir = Math.sign(joystickX);
  const boostDir = s.lastMoveDir;

  if (s.grounded) {
    const boostBonus = isBoosting ? boostDir * BOOST_GROUND_SPEED_BONUS : 0;
    s.vx = joystickX * MOVE_SPEED + boostBonus;
  } else {
    s.vx += joystickX * AIR_STEER_SPEED * dt;
    s.vx *= 0.98;
    if (joystickY < -0.5) s.vy -= GRAVITY * FAST_FALL_MULTIPLIER * dt;
    if (isBoosting) s.vx += boostDir * BOOST_ACCEL * dt;
  }

  if (isBoosting) s.boost = Math.max(0, s.boost - BOOST_DRAIN_PER_SEC * dt);
  else if (s.boost < 100) s.boost = Math.min(100, s.boost + BOOST_RECHARGE_PER_SEC * dt);
  updateBoostMeterUI(s.boost);

  if (!s.grounded) s.vy -= GRAVITY * dt;

  s.x += s.vx * dt;
  s.y += s.vy * dt;
  s.x = Math.max(-ARENA_HALF_LENGTH, Math.min(ARENA_HALF_LENGTH, s.x));

  if (s.y <= 0) { s.y = 0; s.vy = 0; s.grounded = true; }

  local.mesh.position.x = s.x;
  local.mesh.position.y = carHalfHeight + s.y;
  local.mesh.rotation.y = s.facingFlipped ? Math.PI : 0;

  if (s.isRolling) {
    local.mesh.rotation.z += dt * 6;
  } else if (!s.grounded) {
    local.mesh.rotation.z = THREE.MathUtils.lerp(local.mesh.rotation.z, joystickY * 0.6, dt * 8);
  } else {
    local.mesh.rotation.z = THREE.MathUtils.lerp(local.mesh.rotation.z, 0, dt * 8);
  }
}

// Apply a remote player's reported state directly to their mesh (used both
// when the host receives client input, and when a client receives the
// host's broadcast for players that aren't itself)
function applyRemoteState(player, s) {
  player.state.x = s.x; player.state.y = s.y;
  player.state.facingFlipped = s.facingFlipped; player.state.isRolling = s.isRolling;
  player.mesh.position.x = s.x;
  player.mesh.position.y = carHalfHeight + s.y;
  player.mesh.rotation.y = s.facingFlipped ? Math.PI : 0;
  if (s.isRolling) player.mesh.rotation.z += 0.1;
}

// ---------- NETWORKING ----------
function broadcastHostState() {
  const carsPayload = {};
  Object.values(players).forEach((p) => {
    carsPayload[p.id] = { x: p.state.x, y: p.state.y, facingFlipped: p.state.facingFlipped, isRolling: p.state.isRolling };
  });
  const packet = {
    type: 'state',
    ball: { x: ballState.x, y: ballState.y },
    cars: carsPayload,
    scoreBlue: matchState.scoreBlue, scoreOrange: matchState.scoreOrange,
    timeRemaining: matchState.timeRemaining, overtime: matchState.overtime, gameOver: matchState.gameOver,
    controlsFrozen: matchState.controlsFrozen,
    bannerText: matchBannerEl.textContent, bannerVisible: matchBannerEl.style.display === 'block',
    bannerColor: matchBannerEl.style.color,
  };
  PEER_CONNECTIONS.forEach((conn) => { try { conn.send(packet); } catch (e) { /* ignore send errors from a dropped peer */ } });
}

function sendClientInput() {
  const local = players[LOCAL_ID];
  if (!local || PEER_CONNECTIONS.length === 0) return;
  const s = local.state;
  const packet = { type: 'input', x: s.x, y: s.y, vx: s.vx, vy: s.vy, facingFlipped: s.facingFlipped, isRolling: s.isRolling, boost: s.boost };
  try { PEER_CONNECTIONS[0].send(packet); } catch (e) { /* ignore */ }
}

if (IS_HOST) {
  PEER_CONNECTIONS.forEach((conn) => {
    conn.on('data', (data) => {
      if (data.type === 'input') {
        const remote = players[conn.peer];
        if (remote) {
          remote.state.vx = data.vx; remote.state.vy = data.vy;
          applyRemoteState(remote, data);
        }
      }
    });
  });
} else {
  PEER_CONNECTIONS.forEach((conn) => {
    conn.on('data', (data) => {
      if (data.type !== 'state') return;
      ballState.x = data.ball.x; ballState.y = data.ball.y;
      ball.position.set(ballState.x, ballState.y, 0);

      Object.entries(data.cars).forEach(([id, s]) => {
        const p = players[id];
        if (p && !p.isLocal) applyRemoteState(p, s);
      });

      matchState.scoreBlue = data.scoreBlue; matchState.scoreOrange = data.scoreOrange;
      matchState.timeRemaining = data.timeRemaining; matchState.overtime = data.overtime;
      matchState.gameOver = data.gameOver; matchState.controlsFrozen = data.controlsFrozen;
      scoreBlueEl.textContent = matchState.scoreBlue;
      scoreOrangeEl.textContent = matchState.scoreOrange;
      matchTimerEl.textContent = matchState.overtime ? 'OVERTIME' : formatTime(matchState.timeRemaining);
      matchBannerEl.textContent = data.bannerText;
      matchBannerEl.style.display = data.bannerVisible ? 'block' : 'none';
      matchBannerEl.style.color = data.bannerColor;
      setControlsVisible(!matchState.controlsFrozen && !matchState.gameOver);
    });
  });
}

// ---------- STATS ----------
const playerStats = { goals: 0, assists: 0, shots: 0, saves: 0 };
const statGoalsEl = document.getElementById('stat-goals');
const statAssistsEl = document.getElementById('stat-assists');
const statShotsEl = document.getElementById('stat-shots');
const statSavesEl = document.getElementById('stat-saves');
function updateStatsUI() {
  statGoalsEl.textContent = playerStats.goals;
  statAssistsEl.textContent = playerStats.assists;
  statShotsEl.textContent = playerStats.shots;
  statSavesEl.textContent = playerStats.saves;
}

// ---------- OFF-SCREEN BALL ARROW ----------
const ballArrowEl = document.getElementById('ball-arrow');
function updateBallArrow() {
  const screenPos = new THREE.Vector3(ballState.x, ballState.y, 0).project(camera);
  const isOnScreen = screenPos.x >= -1 && screenPos.x <= 1 && screenPos.y >= -1 && screenPos.y <= 1 && screenPos.z < 1;
  if (isOnScreen) { ballArrowEl.style.display = 'none'; return; }
  ballArrowEl.style.display = 'block';
  const margin = 40;
  const halfW = window.innerWidth / 2, halfH = window.innerHeight / 2;
  let px = halfW + screenPos.x * halfW;
  let py = halfH - screenPos.y * halfH;
  if (screenPos.z > 1) { px = window.innerWidth - px; py = window.innerHeight - py; }
  const clampedX = Math.max(margin, Math.min(window.innerWidth - margin, px));
  const clampedY = Math.max(margin, Math.min(window.innerHeight - margin, py));
  ballArrowEl.style.left = `${clampedX - 14}px`;
  ballArrowEl.style.top = `${clampedY - 12}px`;
  const angle = Math.atan2(clampedY - halfH, clampedX - halfW) * (180 / Math.PI) + 90;
  ballArrowEl.style.transform = `rotate(${angle}deg)`;
}

// ---------- CAR MODEL LOADING ----------
const loader = new GLTFLoader();
const dracoLoader = new DRACOLoader();
dracoLoader.setDecoderPath('https://unpkg.com/three@0.160.0/examples/jsm/libs/draco/');
loader.setDRACOLoader(dracoLoader);

debugLog('Loading car model...');
loader.load(
  CAR_URL,
  (gltf) => {
    carTemplate = gltf.scene;
    const box = new THREE.Box3().setFromObject(carTemplate);
    const size = new THREE.Vector3();
    box.getSize(size);
    const longestSide = Math.max(size.x, size.z);
    const scaleFactor = 2.0 / longestSide;
    carTemplate.scale.setScalar(scaleFactor);

    const scaledBox = new THREE.Box3().setFromObject(carTemplate);
    const scaledSize = new THREE.Vector3();
    scaledBox.getSize(scaledSize);
    carHalfHeight = scaledSize.y / 2;
    carHalfLength = scaledSize.x / 2;
    debugLog(`Car scaled: ${scaledSize.x.toFixed(2)} x ${scaledSize.y.toFixed(2)} x ${scaledSize.z.toFixed(2)}`);

    ROSTER.forEach((rosterEntry, i) => createPlayerEntry(rosterEntry, i));
    debugLog(`Created ${Object.keys(players).length} player car(s)`);
  },
  (progress) => {
    if (progress.total) debugLog(`Loading car: ${((progress.loaded / progress.total) * 100).toFixed(0)}%`);
  },
  (error) => debugLog(`ERROR loading car: ${error.message || error}`)
);

// ---------- INPUT: JOYSTICK ----------
const joystickBase = document.getElementById('joystick-base');
const joystickKnob = document.getElementById('joystick-knob');
const JOYSTICK_RADIUS = 65;
let joystickActive = false, joystickX = 0, joystickY = 0, joystickPointerId = null;
let lastJoystickTapTime = 0;
const DOUBLE_TAP_WINDOW_MS = 350;

function getJoystickBaseCenter() {
  const rect = joystickBase.getBoundingClientRect();
  return { cx: rect.left + rect.width / 2, cy: rect.top + rect.height / 2 };
}
function updateJoystickFromPointer(clientX, clientY) {
  const { cx, cy } = getJoystickBaseCenter();
  let dx = clientX - cx, dy = clientY - cy;
  const dist = Math.sqrt(dx * dx + dy * dy);
  if (dist > JOYSTICK_RADIUS) { dx = (dx / dist) * JOYSTICK_RADIUS; dy = (dy / dist) * JOYSTICK_RADIUS; }
  joystickKnob.style.transform = `translate(${dx}px, ${dy}px)`;
  joystickX = dx / JOYSTICK_RADIUS;
  joystickY = -dy / JOYSTICK_RADIUS;
}
function resetJoystick() {
  joystickKnob.style.transform = 'translate(0px, 0px)';
  joystickX = 0; joystickY = 0;
}
joystickBase.addEventListener('pointerdown', (e) => {
  joystickActive = true; joystickPointerId = e.pointerId;
  joystickBase.setPointerCapture(e.pointerId);
  updateJoystickFromPointer(e.clientX, e.clientY);
  const now = performance.now();
  if (now - lastJoystickTapTime < DOUBLE_TAP_WINDOW_MS) {
    const local = players[LOCAL_ID];
    if (local && !local.state.grounded) local.state.isRolling = !local.state.isRolling;
  }
  lastJoystickTapTime = now;
});
joystickBase.addEventListener('pointermove', (e) => {
  if (joystickActive && e.pointerId === joystickPointerId) updateJoystickFromPointer(e.clientX, e.clientY);
});
function endJoystick(e) {
  if (e.pointerId === joystickPointerId) { joystickActive = false; joystickPointerId = null; resetJoystick(); }
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
  const local = players[LOCAL_ID];
  if (local && local.state.grounded) { local.state.vy = JUMP_VELOCITY; local.state.grounded = false; }
});
boostBtn.addEventListener('pointerdown', (e) => { e.preventDefault(); boostHeld = true; });
boostBtn.addEventListener('pointerup', () => { boostHeld = false; });
boostBtn.addEventListener('pointercancel', () => { boostHeld = false; });
boostBtn.addEventListener('pointerleave', () => { boostHeld = false; });
rotateBtn.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  const local = players[LOCAL_ID];
  if (local) local.state.facingFlipped = !local.state.facingFlipped;
});
function updateBoostMeterUI(boostValue) {
  const degrees = (boostValue / 100) * 360;
  boostFill.style.background = `conic-gradient(#fbbf24 ${degrees}deg, transparent ${degrees}deg)`;
}

// ---------- RENDER LOOP ----------
const clock = new THREE.Clock();
let networkTickAccumulator = 0;
const NETWORK_TICK_RATE = 0.05; // ~20 times/sec

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.1);

  if (carTemplate) {
    updateLocalCarPhysics(dt);
    if (IS_HOST) {
      updateBallPhysicsHostOnly(dt);
      updateMatchTimer(dt);
    }

    networkTickAccumulator += dt;
    if (networkTickAccumulator >= NETWORK_TICK_RATE) {
      networkTickAccumulator = 0;
      if (IS_HOST) broadcastHostState();
      else sendClientInput();
    }

    const local = players[LOCAL_ID];
    if (local) {
      camera.position.x = THREE.MathUtils.lerp(camera.position.x, local.mesh.position.x, dt * 3);
      camera.lookAt(camera.position.x, 2, 0);
    }
    Object.values(players).forEach((p) => {
      p.usernameSprite.position.set(p.mesh.position.x, p.mesh.position.y + carHalfHeight + 0.6, 0);
    });
    if (IS_HOST) ball.position.set(ballState.x, ballState.y, 0);
  }

  updateBallArrow();
  renderer.render(scene, camera);
}
animate();
