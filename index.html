import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';

// ---------- NETWORK CONFIG (set by lobby.js before this file loads) ----------
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
const SHOT_MIN_IMPACT_SPEED = 3.0;
const SHOT_COOLDOWN = 0.4;
const ASSIST_WINDOW_SECONDS = 5;
const SAVE_DANGER_ZONE = 8;

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
  if (debugLines.length > 12) debugLines.shift();
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
scene.add(new THREE.AmbientLight(0xffffff, 0.6));
const dirLight = new THREE.DirectionalLight(0xffffff, 1.0);
dirLight.position.set(5, 12, 8);
scene.add(dirLight);

// ---------- ARENA ----------
const arenaGroup = new THREE.Group();
const floor = new THREE.Mesh(new THREE.PlaneGeometry(ARENA_LENGTH, ARENA_DEPTH), new THREE.MeshStandardMaterial({ color: 0x2a2d33, roughness: 0.9 }));
floor.rotation.x = -Math.PI / 2;
arenaGroup.add(floor);
const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(ARENA_LENGTH, ARENA_DEPTH), new THREE.MeshStandardMaterial({ color: 0x88ccff, transparent: true, opacity: 0.15, side: THREE.DoubleSide }));
ceiling.rotation.x = Math.PI / 2;
ceiling.position.y = ARENA_HEIGHT;
arenaGroup.add(ceiling);
const sideWallMat = new THREE.MeshStandardMaterial({ color: 0x3a3f47, transparent: true, opacity: 0.35, side: THREE.DoubleSide });
const wallBack = new THREE.Mesh(new THREE.PlaneGeometry(ARENA_LENGTH, ARENA_HEIGHT), sideWallMat);
wallBack.position.set(0, ARENA_HEIGHT / 2, -ARENA_DEPTH / 2);
arenaGroup.add(wallBack);
const wallFront = new THREE.Mesh(new THREE.PlaneGeometry(ARENA_LENGTH, ARENA_HEIGHT), sideWallMat);
wallFront.position.set(0, ARENA_HEIGHT / 2, ARENA_DEPTH / 2);
arenaGroup.add(wallFront);
function buildEndWallWithGoal(xPosition, colorHex) {
  const group = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: colorHex, roughness: 0.7 });
  const goalTop = GOAL_GAP_FROM_FLOOR + GOAL_WIDTH;
  const bottomHeight = GOAL_GAP_FROM_FLOOR;
  if (bottomHeight > 0) {
    const p = new THREE.Mesh(new THREE.PlaneGeometry(ARENA_DEPTH, bottomHeight), mat);
    p.rotation.y = Math.PI / 2;
    p.position.set(xPosition, bottomHeight / 2, 0);
    group.add(p);
  }
  const topHeight = ARENA_HEIGHT - goalTop;
  if (topHeight > 0) {
    const p = new THREE.Mesh(new THREE.PlaneGeometry(ARENA_DEPTH, topHeight), mat);
    p.rotation.y = Math.PI / 2;
    p.position.set(xPosition, goalTop + topHeight / 2, 0);
    group.add(p);
  }
  return group;
}
arenaGroup.add(buildEndWallWithGoal(-ARENA_LENGTH / 2, 0x1e5fbf), buildEndWallWithGoal(ARENA_LENGTH / 2, 0xd97706));
scene.add(arenaGroup);

// ---------- BALL ----------
const ball = new THREE.Mesh(new THREE.SphereGeometry(BALL_RADIUS, 32, 32), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4 }));
scene.add(ball);
const ballState = { x: 0, y: BALL_RADIUS + 3, vx: 0, vy: 0 };
function resetBallToCenter() {
  ballState.x = 0; ballState.y = BALL_RADIUS + 3; ballState.vx = 0; ballState.vy = 0;
}

// ---------- USERNAME SPRITE FACTORY ----------
function makeUsernameSprite(text) {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 64;
  const ctx = c.getContext('2d');
  ctx.font = 'bold 36px sans-serif';
  ctx.fillStyle = 'white'; ctx.strokeStyle = 'black'; ctx.lineWidth = 5;
  ctx.textAlign = 'center';
  ctx.strokeText(text, 128, 44);
  ctx.fillText(text, 128, 44);
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), depthTest: false }));
  sprite.scale.set(1.6, 0.4, 1);
  return sprite;
}

// ---------- PLAYERS ----------
const players = {};
let carHalfHeight = 0.3;
let carHalfLength = 1.0;
let carTemplate = null;

function spawnXForIndex(i, team) {
  const side = team === 'blue' ? -1 : 1;
  const slot = Math.floor(i / 2) + 1;
  return side * (4 * slot);
}
function freshStats() { return { goals: 0, assists: 0, shots: 0, saves: 0 }; }

function createPlayerEntry(rosterEntry, index) {
  const state = { x: spawnXForIndex(index, rosterEntry.team), y: 0, vx: 0, vy: 0, grounded: true, facingFlipped: false, boost: 100, isRolling: false, lastMoveDir: 1 };
  const mesh = carTemplate.clone(true);
  mesh.traverse((child) => {
    if (child.isMesh) { child.material = child.material.clone(); child.material.color.set(TEAM_COLORS[rosterEntry.team] || 0xffffff); }
  });
  mesh.position.set(state.x, carHalfHeight, 0);
  scene.add(mesh);
  const usernameSprite = makeUsernameSprite(rosterEntry.username);
  scene.add(usernameSprite);
  players[rosterEntry.id] = {
    id: rosterEntry.id, username: rosterEntry.username, team: rosterEntry.team,
    isLocal: rosterEntry.id === LOCAL_ID, mesh, usernameSprite, state, stats: freshStats(),
  };
}

// ---------- MATCH / SCORE STATE ----------
const matchState = { scoreBlue: 0, scoreOrange: 0, timeRemaining: 120, overtime: false, gameOver: false, controlsFrozen: false };
const scoreBlueEl = document.getElementById('score-blue');
const scoreOrangeEl = document.getElementById('score-orange');
const matchTimerEl = document.getElementById('match-timer');
const matchBannerEl = document.getElementById('match-banner');

function formatTime(t) { const m = Math.floor(t / 60), s = Math.floor(t % 60); return `${m}:${s.toString().padStart(2, '0')}`; }
function setControlsVisible(v) {
  document.getElementById('joystick-base').style.display = v ? '' : 'none';
  document.getElementById('button-cluster').style.display = v ? '' : 'none';
}
function resetAllPlayersToStart() {
  Object.values(players).forEach((p, i) => {
    p.state.x = spawnXForIndex(i, p.team); p.state.y = 0; p.state.vx = 0; p.state.vy = 0;
    p.state.grounded = true; p.state.facingFlipped = false; p.state.isRolling = false;
    p.mesh.position.set(p.state.x, carHalfHeight, 0);
    p.mesh.rotation.set(0, 0, 0);
  });
}

let kickoffTimeoutHandles = [];
function clearKickoffTimeouts() { kickoffTimeoutHandles.forEach((h) => clearTimeout(h)); kickoffTimeoutHandles = []; }
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

// ---------- TOUCH TRACKING (for goal/assist/save attribution) ----------
let lastToucherId = null;
let lastToucherTime = -999;
let secondLastToucherId = null;

function awardGoal(scoringTeam, now) {
  if (scoringTeam === 'blue') matchState.scoreBlue += 1; else matchState.scoreOrange += 1;
  scoreBlueEl.textContent = matchState.scoreBlue;
  scoreOrangeEl.textContent = matchState.scoreOrange;

  const scorer = lastToucherId ? players[lastToucherId] : null;
  if (scorer && scorer.team === scoringTeam) {
    scorer.stats.goals += 1;
    if (secondLastToucherId && secondLastToucherId !== lastToucherId && (now - lastToucherTime) < ASSIST_WINDOW_SECONDS) {
      const assister = players[secondLastToucherId];
      if (assister && assister.team === scoringTeam) assister.stats.assists += 1;
    }
  }
  debugLog(`GOAL ${scoringTeam}! ${matchState.scoreBlue}-${matchState.scoreOrange}`);
  lastToucherId = null; secondLastToucherId = null;

  if (matchState.overtime) endMatch(scoringTeam);
  else startKickoffCountdown();
}

function buildLeaderboard() {
  return Object.values(players).map((p) => ({ username: p.username, team: p.team, stats: { ...p.stats } }));
}

function endMatch(winner) {
  matchState.gameOver = true;
  matchState.controlsFrozen = true;
  matchBannerEl.style.display = 'block';
  if (winner === 'tie') { matchBannerEl.textContent = "IT'S A TIE"; matchBannerEl.style.color = 'white'; }
  else { matchBannerEl.textContent = `${winner.toUpperCase()} WINS!`; matchBannerEl.style.color = winner === 'blue' ? '#3b82f6' : '#f97316'; }
  setControlsVisible(false);
  showLeaderboard(winner, buildLeaderboard());
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

// ---------- LEADERBOARD / END-GAME UI ----------
const leaderboardScreen = document.getElementById('leaderboard-screen');
const leaderboardTitle = document.getElementById('leaderboard-title');
const leaderboardBlueEl = document.getElementById('leaderboard-blue');
const leaderboardOrangeEl = document.getElementById('leaderboard-orange');
const rematchBtn = document.getElementById('rematch-btn');
const returnHomeBtn = document.getElementById('return-home-btn');

function renderLeaderboardColumn(container, entries) {
  container.innerHTML = '';
  entries.forEach((e) => {
    const div = document.createElement('div');
    div.className = 'leaderboard-entry';
    div.innerHTML = `<div class="lb-name">${e.username}</div><div class="lb-stats">Goals ${e.stats.goals} · Assists ${e.stats.assists} · Shots ${e.stats.shots} · Saves ${e.stats.saves}</div>`;
    container.appendChild(div);
  });
}

function showLeaderboard(winner, leaderboard) {
  leaderboardTitle.textContent = winner === 'tie' ? "It's a Tie" : `${winner.charAt(0).toUpperCase() + winner.slice(1)} Wins!`;
  renderLeaderboardColumn(leaderboardBlueEl, leaderboard.filter((e) => e.team === 'blue'));
  renderLeaderboardColumn(leaderboardOrangeEl, leaderboard.filter((e) => e.team === 'orange'));
  rematchBtn.style.display = IS_HOST ? 'block' : 'none';
  document.getElementById('game-screen').style.display = 'none';
  leaderboardScreen.style.display = 'flex';
}

returnHomeBtn.addEventListener('click', () => {
  // Simplest reliable full reset of both lobby and game state
  location.reload();
});

rematchBtn.addEventListener('click', () => {
  if (!IS_HOST) return;
  matchState.scoreBlue = 0; matchState.scoreOrange = 0; matchState.timeRemaining = 120;
  matchState.overtime = false; matchState.gameOver = false;
  Object.values(players).forEach((p) => { p.stats = freshStats(); });
  lastToucherId = null; secondLastToucherId = null;
  leaderboardScreen.style.display = 'none';
  document.getElementById('game-screen').style.display = 'block';
  scoreBlueEl.textContent = '0'; scoreOrangeEl.textContent = '0';
  matchTimerEl.textContent = formatTime(matchState.timeRemaining);
  startKickoffCountdown();
});

// ---------- BALL PHYSICS (HOST ONLY) ----------
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

  const now = performance.now() / 1000;

  if (ballState.x - BALL_RADIUS <= WALL_X_LEFT) {
    const inGoal = ballState.y > GOAL_BOTTOM && ballState.y < GOAL_TOP;
    if (inGoal) { if (ballState.x + BALL_RADIUS <= WALL_X_LEFT) awardGoal('orange', now); }
    else { ballState.x = WALL_X_LEFT + BALL_RADIUS; ballState.vx = -ballState.vx * BALL_RESTITUTION; }
  }
  if (ballState.x + BALL_RADIUS >= WALL_X_RIGHT) {
    const inGoal = ballState.y > GOAL_BOTTOM && ballState.y < GOAL_TOP;
    if (inGoal) { if (ballState.x - BALL_RADIUS >= WALL_X_RIGHT) awardGoal('blue', now); }
    else { ballState.x = WALL_X_RIGHT - BALL_RADIUS; ballState.vx = -ballState.vx * BALL_RESTITUTION; }
  }

  let anyTouch = false;
  Object.values(players).forEach((p) => {
    const s = p.state;
    const closestX = Math.max(s.x - carHalfLength, Math.min(ballState.x, s.x + carHalfLength));
    const carTopY = carHalfHeight + s.y + carHalfHeight;
    const carBottomY = s.y;
    const closestY = Math.max(carBottomY, Math.min(ballState.y, carTopY));
    const dx = ballState.x - closestX, dy = ballState.y - closestY;
    const distSq = dx * dx + dy * dy;

    if (distSq < BALL_RADIUS * BALL_RADIUS) {
      anyTouch = true;
      const dist = Math.sqrt(distSq) || 0.001;
      const nx = dx / dist, ny = dy / dist;
      const overlap = BALL_RADIUS - dist;
      ballState.x += nx * overlap;
      ballState.y += ny * overlap;

      // Relative velocity of ball with respect to the car
      const relVelX = ballState.vx - s.vx;
      const relVelY = ballState.vy - Math.max(s.vy, 0);
      const velAlongNormal = relVelX * nx + relVelY * ny; // negative = sinking into the car

      if (velAlongNormal < 0) {
        const closingSpeed = -velAlongNormal;
        // Split into normal (into-surface) and tangential (sideways/rolling) components.
        // Only the normal component bounces - tangential is preserved fully, which is
        // what lets the ball roll off naturally instead of feeling glued to the car.
        const tangentRelX = relVelX - velAlongNormal * nx;
        const tangentRelY = relVelY - velAlongNormal * ny;
        const carSpeed = Math.sqrt(s.vx * s.vx + Math.max(s.vy, 0) ** 2);
        const bounceStrength = closingSpeed * BALL_RESTITUTION + Math.min(carSpeed * 0.5, 6);

        const preHitVx = ballState.vx;
        ballState.vx = s.vx + tangentRelX + nx * bounceStrength;
        ballState.vy = Math.max(s.vy, 0) + tangentRelY + ny * bounceStrength;

        if (closingSpeed >= SHOT_MIN_IMPACT_SPEED) {
          const isNewTouch = lastToucherId !== p.id || (now - lastToucherTime) > SHOT_COOLDOWN;
          if (isNewTouch && shotCooldownRemaining <= 0) {
            p.stats.shots += 1;
            shotCooldownRemaining = SHOT_COOLDOWN;

            // Save: this player is on defense, ball was heading toward their
            // own goal, and they're inside the danger zone in front of it
            const defendingGoalX = p.team === 'blue' ? WALL_X_LEFT : WALL_X_RIGHT;
            const wasHeadingTowardOwnGoal = (p.team === 'blue' && preHitVx < -1) || (p.team === 'orange' && preHitVx > 1);
            const distanceToOwnGoal = Math.abs(ballState.x - defendingGoalX);
            if (wasHeadingTowardOwnGoal && distanceToOwnGoal < SAVE_DANGER_ZONE) {
              p.stats.saves += 1;
            }
          }
          if (lastToucherId !== p.id) { secondLastToucherId = lastToucherId; }
          lastToucherId = p.id;
          lastToucherTime = now;
        }
      }
      // else: resting or separating contact - leave velocity untouched entirely,
      // so the ball just settles/rolls under its existing motion, no artificial pop
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
  if (s.isRolling) local.mesh.rotation.z += dt * 6;
  else if (!s.grounded) local.mesh.rotation.z = THREE.MathUtils.lerp(local.mesh.rotation.z, joystickY * 0.6, dt * 8);
  else local.mesh.rotation.z = THREE.MathUtils.lerp(local.mesh.rotation.z, 0, dt * 8);
}

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
    carsPayload[p.id] = { x: p.state.x, y: p.state.y, facingFlipped: p.state.facingFlipped, isRolling: p.state.isRolling, stats: p.stats };
  });
  const packet = {
    type: 'state', ball: { x: ballState.x, y: ballState.y }, cars: carsPayload,
    scoreBlue: matchState.scoreBlue, scoreOrange: matchState.scoreOrange,
    timeRemaining: matchState.timeRemaining, overtime: matchState.overtime, gameOver: matchState.gameOver,
    controlsFrozen: matchState.controlsFrozen,
    bannerText: matchBannerEl.textContent, bannerVisible: matchBannerEl.style.display === 'block', bannerColor: matchBannerEl.style.color,
  };
  if (matchState.gameOver) {
    packet.leaderboard = buildLeaderboard();
    packet.winner = matchState.scoreBlue === matchState.scoreOrange ? 'tie' : (matchState.scoreBlue > matchState.scoreOrange ? 'blue' : 'orange');
  }
  PEER_CONNECTIONS.forEach((conn) => { try { conn.send(packet); } catch (e) {} });
}

function sendClientInput() {
  const local = players[LOCAL_ID];
  if (!local || PEER_CONNECTIONS.length === 0) return;
  const s = local.state;
  const packet = { type: 'input', x: s.x, y: s.y, vx: s.vx, vy: s.vy, facingFlipped: s.facingFlipped, isRolling: s.isRolling, boost: s.boost };
  try { PEER_CONNECTIONS[0].send(packet); } catch (e) {}
}

let clientShownLeaderboard = false;

if (IS_HOST) {
  PEER_CONNECTIONS.forEach((conn) => {
    conn.on('data', (data) => {
      if (data.type === 'input') {
        const remote = players[conn.peer];
        if (remote) { remote.state.vx = data.vx; remote.state.vy = data.vy; applyRemoteState(remote, data); }
      } else if (data.type === 'rematchRequest') {
        // Host owns the rematch button; clients can't trigger it directly, ignored.
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
        if (!p) return;
        if (p.stats) Object.assign(p.stats, s.stats);
        if (!p.isLocal) applyRemoteState(p, s);
        else if (p.stats) updateStatsUI(p.stats); // keep local HUD numbers in sync with host-authoritative stats
      });

      matchState.scoreBlue = data.scoreBlue; matchState.scoreOrange = data.scoreOrange;
      matchState.timeRemaining = data.timeRemaining; matchState.overtime = data.overtime;
      matchState.gameOver = data.gameOver; matchState.controlsFrozen = data.controlsFrozen;

      if (matchState.controlsFrozen && !wasControlsFrozen) resetLocalPlayerToSpawn();
      wasControlsFrozen = matchState.controlsFrozen;

      scoreBlueEl.textContent = matchState.scoreBlue;
      scoreOrangeEl.textContent = matchState.scoreOrange;
      matchTimerEl.textContent = matchState.overtime ? 'OVERTIME' : formatTime(matchState.timeRemaining);
      matchBannerEl.textContent = data.bannerText;
      matchBannerEl.style.display = data.bannerVisible ? 'block' : 'none';
      matchBannerEl.style.color = data.bannerColor;
      setControlsVisible(!matchState.controlsFrozen && !matchState.gameOver);

      if (matchState.gameOver && data.leaderboard && !clientShownLeaderboard) {
        clientShownLeaderboard = true;
        showLeaderboard(data.winner, data.leaderboard);
      }
      if (!matchState.gameOver) {
        clientShownLeaderboard = false;
        if (leaderboardScreen.style.display !== 'none') {
          leaderboardScreen.style.display = 'none';
          document.getElementById('game-screen').style.display = 'block';
        }
      }
    });
  });
}

// ---------- STATS HUD ----------
const statGoalsEl = document.getElementById('stat-goals');
const statAssistsEl = document.getElementById('stat-assists');
const statShotsEl = document.getElementById('stat-shots');
const statSavesEl = document.getElementById('stat-saves');
function updateStatsUI(stats) {
  statGoalsEl.textContent = stats.goals;
  statAssistsEl.textContent = stats.assists;
  statShotsEl.textContent = stats.shots;
  statSavesEl.textContent = stats.saves;
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
  let px = halfW + screenPos.x * halfW, py = halfH - screenPos.y * halfH;
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
loader.load(CAR_URL, (gltf) => {
  carTemplate = gltf.scene;
  const box = new THREE.Box3().setFromObject(carTemplate);
  const size = new THREE.Vector3();
  box.getSize(size);
  const scaleFactor = 2.0 / Math.max(size.x, size.z);
  carTemplate.scale.setScalar(scaleFactor);
  const scaledBox = new THREE.Box3().setFromObject(carTemplate);
  const scaledSize = new THREE.Vector3();
  scaledBox.getSize(scaledSize);
  carHalfHeight = scaledSize.y / 2;
  carHalfLength = scaledSize.x / 2;
  debugLog(`Car scaled: ${scaledSize.x.toFixed(2)} x ${scaledSize.y.toFixed(2)} x ${scaledSize.z.toFixed(2)}`);
  ROSTER.forEach((r, i) => createPlayerEntry(r, i));
  debugLog(`Created ${Object.keys(players).length} player car(s)`);
}, (progress) => { if (progress.total) debugLog(`Loading car: ${((progress.loaded / progress.total) * 100).toFixed(0)}%`); },
(error) => debugLog(`ERROR loading car: ${error.message || error}`));

// ---------- INPUT: JOYSTICK ----------
const joystickBase = document.getElementById('joystick-base');
const joystickKnob = document.getElementById('joystick-knob');
const JOYSTICK_RADIUS = 65;
let joystickActive = false, joystickX = 0, joystickY = 0, joystickPointerId = null;
let lastJoystickTapTime = 0;
const DOUBLE_TAP_WINDOW_MS = 350;
function getJoystickBaseCenter() { const r = joystickBase.getBoundingClientRect(); return { cx: r.left + r.width / 2, cy: r.top + r.height / 2 }; }
function updateJoystickFromPointer(clientX, clientY) {
  const { cx, cy } = getJoystickBaseCenter();
  let dx = clientX - cx, dy = clientY - cy;
  const dist = Math.sqrt(dx * dx + dy * dy);
  if (dist > JOYSTICK_RADIUS) { dx = (dx / dist) * JOYSTICK_RADIUS; dy = (dy / dist) * JOYSTICK_RADIUS; }
  joystickKnob.style.transform = `translate(${dx}px, ${dy}px)`;
  joystickX = dx / JOYSTICK_RADIUS; joystickY = -dy / JOYSTICK_RADIUS;
}
function resetJoystick() { joystickKnob.style.transform = 'translate(0px, 0px)'; joystickX = 0; joystickY = 0; }
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
joystickBase.addEventListener('pointermove', (e) => { if (joystickActive && e.pointerId === joystickPointerId) updateJoystickFromPointer(e.clientX, e.clientY); });
function endJoystick(e) { if (e.pointerId === joystickPointerId) { joystickActive = false; joystickPointerId = null; resetJoystick(); } }
joystickBase.addEventListener('pointerup', endJoystick);
joystickBase.addEventListener('pointercancel', endJoystick);

// ---------- INPUT: BUTTONS ----------
const jumpBtn = document.getElementById('jump-btn');
const boostBtn = document.getElementById('boost-btn');
const rotateBtn = document.getElementById('rotate-btn');
const boostFill = document.getElementById('boost-fill');
let boostHeld = false;
jumpBtn.addEventListener('pointerdown', (e) => { e.preventDefault(); const l = players[LOCAL_ID]; if (l && l.state.grounded) { l.state.vy = JUMP_VELOCITY; l.state.grounded = false; } });
boostBtn.addEventListener('pointerdown', (e) => { e.preventDefault(); boostHeld = true; });
boostBtn.addEventListener('pointerup', () => { boostHeld = false; });
boostBtn.addEventListener('pointercancel', () => { boostHeld = false; });
boostBtn.addEventListener('pointerleave', () => { boostHeld = false; });
rotateBtn.addEventListener('pointerdown', (e) => { e.preventDefault(); const l = players[LOCAL_ID]; if (l) l.state.facingFlipped = !l.state.facingFlipped; });
function updateBoostMeterUI(v) { const d = (v / 100) * 360; boostFill.style.background = `conic-gradient(#fbbf24 ${d}deg, transparent ${d}deg)`; }

// ---------- RENDER LOOP ----------
const clock = new THREE.Clock();
let networkTickAccumulator = 0;
const NETWORK_TICK_RATE = 0.05;
let wasControlsFrozen = false;

function resetLocalPlayerToSpawn() {
  const local = players[LOCAL_ID];
  if (!local) return;
  const idx = ROSTER.findIndex((r) => r.id === LOCAL_ID);
  const spawnX = spawnXForIndex(idx, local.team);
  const s = local.state;
  s.x = spawnX; s.y = 0; s.vx = 0; s.vy = 0; s.grounded = true; s.facingFlipped = false; s.isRolling = false;
  local.mesh.position.set(s.x, carHalfHeight, 0);
  local.mesh.rotation.set(0, 0, 0);
}

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.1);

  if (carTemplate) {
    updateLocalCarPhysics(dt);
    if (IS_HOST) { updateBallPhysicsHostOnly(dt); updateMatchTimer(dt); }

    networkTickAccumulator += dt;
    if (networkTickAccumulator >= NETWORK_TICK_RATE) {
      networkTickAccumulator = 0;
      if (IS_HOST) broadcastHostState(); else sendClientInput();
    }

    const local = players[LOCAL_ID];
    if (local) {
      camera.position.x = THREE.MathUtils.lerp(camera.position.x, local.mesh.position.x, dt * 3);
      camera.lookAt(camera.position.x, 2, 0);
      if (IS_HOST) updateStatsUI(local.stats);
    }
    Object.values(players).forEach((p) => { p.usernameSprite.position.set(p.mesh.position.x, p.mesh.position.y + carHalfHeight + 0.6, 0); });
    if (IS_HOST) ball.position.set(ballState.x, ballState.y, 0);
  }

  updateBallArrow();
  renderer.render(scene, camera);
}
animate();
