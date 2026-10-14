// ============================================================
// SIDESWIPE PHYSICS - pure math, no DOM and no three.js.
// Everything is 2D (x = along the arena, y = up). The arena cross-section is a
// rounded rectangle; cars glue themselves to its inside surface (floor, curves,
// walls, ceiling) and fly freely when they jump or fall off.
// ============================================================

// ---------- ARENA ----------
export const ARENA_LENGTH = 50;
export const ARENA_HEIGHT = 16;
export const ARENA_DEPTH = 6;
export const CORNER_RADIUS = 3;
export const GOAL_BOTTOM = 4;                 // opening starts well above the floor
export const GOAL_TOP = 10;                   // ...and is 6 tall (was 2 up / 4 tall)
export const GOAL_WIDTH = GOAL_TOP - GOAL_BOTTOM;
export const GOAL_DEPTH = 3;
export const HALF_L = ARENA_LENGTH / 2;
export const EDGE_X = HALF_L - CORNER_RADIUS; // where the flat floor/ceiling ends and the curve begins

// ---------- BALL ----------
export const BALL_RADIUS = 1.0;
export const BALL_GRAVITY = 14;
export const BALL_RESTITUTION = 0.55;
export const BALL_ROLL_FRICTION = 0.3;        // sideways slowdown while touching a surface
export const BALL_REST_SPEED = 1.2;           // slower impacts than this don't bounce (stops jitter)
export const BALL_MAX_SPEED = 45;
export const ROOF_DOME = 0.6;                 // car roofs lean outward so a ball can't balance on one
export const MIN_HIT_BOUNCE_CAP = 6;          // max extra pop a moving car adds to a hit

// ---------- CAR ----------
export const GRAVITY = 18;
export const JUMP_VELOCITY = 8;
export const MOVE_SPEED = 9;
export const BOOST_SPEED = 15;
export const DRIVE_ACCEL = 40;
export const BRAKE_ACCEL = 60;
export const BOOST_SURFACE_ACCEL = 35;
export const COAST_DECEL = 6;
export const SURFACE_GRAVITY = 14;            // pull along a slope (so a car released on a wall slides down)
export const CLING_SPEED = 5.5;               // minimum speed to stay stuck to the ceiling
export const AIR_STEER = 7;
export const AIR_BOOST = 30;
export const AIR_MAX_SPEED = 17;
export const FAST_FALL_EXTRA = 1.5;
export const BOOST_DRAIN = 40;
export const BOOST_RECHARGE = 15;

const TWO_PI = Math.PI * 2;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export function lerpAngle(a, b, t) {
  const d = ((((b - a + Math.PI) % TWO_PI) + TWO_PI) % TWO_PI) - Math.PI;
  return a + d * t;
}

// ============================================================
// THE TRACK: the arena outline as one loop, measured by distance s.
//   floor (left->right) -> bottom-right curve -> right wall (up) -> top-right curve
//   -> ceiling (right->left) -> top-left curve -> left wall (down) -> bottom-left curve
// ============================================================
const H = ARENA_HEIGHT, R = CORNER_RADIUS;
const L_FLAT = 2 * EDGE_X, L_ARC = (Math.PI * R) / 2, L_WALL = H - 2 * R;
const S1 = L_FLAT, S2 = S1 + L_ARC, S3 = S2 + L_WALL, S4 = S3 + L_ARC;
const S5 = S4 + L_FLAT, S6 = S5 + L_ARC, S7 = S6 + L_WALL;
export const PERIMETER = S7 + L_ARC;

// Point and travel direction on the outline at distance s
export function boundaryAt(s) {
  s = ((s % PERIMETER) + PERIMETER) % PERIMETER;
  const arc = (cx, cy, a0, d) => { const a = a0 + d / R; return { x: cx + R * Math.cos(a), y: cy + R * Math.sin(a), tx: -Math.sin(a), ty: Math.cos(a) }; };
  if (s < S1) return { x: -EDGE_X + s, y: 0, tx: 1, ty: 0 };
  if (s < S2) return arc(EDGE_X, R, -Math.PI / 2, s - S1);
  if (s < S3) return { x: HALF_L, y: R + (s - S2), tx: 0, ty: 1 };
  if (s < S4) return arc(EDGE_X, H - R, 0, s - S3);
  if (s < S5) return { x: EDGE_X - (s - S4), y: H, tx: -1, ty: 0 };
  if (s < S6) return arc(-EDGE_X, H - R, Math.PI / 2, s - S5);
  if (s < S7) return { x: -HALF_L, y: H - R - (s - S6), tx: 0, ty: -1 };
  return arc(-EDGE_X, R, Math.PI, s - S7);
}

// For ANY point: how far inside the arena it is (sd, negative = outside), the nearest
// outline point, the inward normal there, and that point's distance s along the track.
export function closestOnBoundary(x, y) {
  const cx = clamp(x, -EDGE_X, EDGE_X), cy = clamp(y, R, H - R);
  const dx = x - cx, dy = y - cy;
  const d = Math.hypot(dx, dy);
  const gx = x > EDGE_X ? 1 : (x < -EDGE_X ? -1 : 0);
  const gy = y < R ? -1 : (y > H - R ? 1 : 0);
  let ux, uy, px, py, sd, s;
  if (d > 1e-9) {
    ux = dx / d; uy = dy / d;
    px = cx + ux * R; py = cy + uy * R; sd = R - d;
    const a = Math.atan2(uy, ux);
    if (gx === 0) s = gy < 0 ? x + EDGE_X : S4 + (EDGE_X - x);
    else if (gy === 0) s = gx > 0 ? S2 + (y - R) : S6 + (H - R - y);
    else if (gx > 0 && gy < 0) s = S1 + R * (clamp(a, -Math.PI / 2, 0) + Math.PI / 2);
    else if (gx > 0 && gy > 0) s = S3 + R * clamp(a, 0, Math.PI / 2);
    else if (gx < 0 && gy > 0) s = S5 + R * (clamp(a, Math.PI / 2, Math.PI) - Math.PI / 2);
    else s = S7 + R * ((a < 0 ? a + TWO_PI : a) - Math.PI);
  } else {
    // inside the flat middle: nearest of the four flat walls
    const dl = x + HALF_L, dr = HALF_L - x, df = y, dc = H - y;
    sd = Math.min(dl, dr, df, dc);
    if (sd === df) { ux = 0; uy = -1; px = x; py = 0; s = x + EDGE_X; }
    else if (sd === dc) { ux = 0; uy = 1; px = x; py = H; s = S4 + (EDGE_X - x); }
    else if (sd === dr) { ux = 1; uy = 0; px = HALF_L; py = y; s = S2 + (y - R); }
    else { ux = -1; uy = 0; px = -HALF_L; py = y; s = S6 + (H - R - y); }
  }
  const b = boundaryAt(s);
  return { sd, px, py, nx: -ux, ny: -uy, s, tx: b.tx, ty: b.ty };
}

// Pose of a car (center and tilt) when it sits on the outline at distance s
export function surfacePose(s, hl, hh) {
  const b = boundaryAt(s);
  return { x: b.x - b.ty * hh, y: b.y + b.tx * hh, psi: Math.atan2(b.ty, b.tx) };
}

// ============================================================
// CAR
// ============================================================
export function createCar(hl, hh) {
  const car = {
    hl, hh, x: 0, y: hh, vx: 0, vy: 0, psi: 0, roll: 0, flip: false,
    s: EDGE_X, vs: 0, grounded: true, boost: 100, isRolling: false, lastDir: 1, noAttach: 0,
  };
  applyPose(car);
  return car;
}

function applyPose(car) {
  const p = surfacePose(car.s, car.hl, car.hh), b = boundaryAt(car.s);
  car.x = p.x; car.y = p.y; car.psi = p.psi;
  car.vx = car.vs * b.tx; car.vy = car.vs * b.ty;
}

// Put the car back on the floor at x, stopped, upright, with a full boost tank
export function placeOnFloor(car, x) {
  car.s = clamp(x, -EDGE_X, EDGE_X) + EDGE_X;
  car.vs = 0; car.grounded = true; car.isRolling = false; car.roll = 0; car.flip = false;
  car.boost = 100; car.noAttach = 0;
  applyPose(car);
}

export function jump(car) {
  if (!car.grounded) return false;
  const b = boundaryAt(car.s), nx = -b.ty, ny = b.tx;
  car.vx = car.vs * b.tx + JUMP_VELOCITY * nx;
  car.vy = car.vs * b.ty + JUMP_VELOCITY * ny;
  car.grounded = false; car.noAttach = 0.12;
  return true;
}

function detach(car, noAttach) {
  const b = boundaryAt(car.s);
  car.vx = car.vs * b.tx; car.vy = car.vs * b.ty;
  car.grounded = false; car.noAttach = noAttach;
}

function stepSurface(car, jx, jy, boosting, dt) {
  const b = boundaryAt(car.s), tx = b.tx, ty = b.ty, nx = -ty, ny = tx;
  // stick -> drive amount along the surface. Pushing "into" a wall also drives up it,
  // but that help fades out once the stick already points along the surface.
  const along = jx * tx + jy * ty;
  const intoWall = -(jx * nx + jy * ny) * Math.abs(nx) * Math.sign(ty);
  const u = clamp(along + intoWall * Math.max(0, 1 - Math.abs(along) / 0.3), -1, 1);

  if (Math.abs(jx) > 0.05) car.lastDir = Math.sign(jx);
  let dirT;
  if (Math.abs(u) > 0.1) dirT = Math.sign(u);
  else if (Math.abs(tx) > 0.3) dirT = Math.sign(car.lastDir * tx) || 1;
  else dirT = Math.sign(car.vs) || Math.sign(ty) || 1;

  if (boosting) {
    const target = dirT * BOOST_SPEED;
    car.vs += clamp(target - car.vs, -BOOST_SURFACE_ACCEL * dt, BOOST_SURFACE_ACCEL * dt);
  } else if (Math.abs(u) > 0.05) {
    const target = u * MOVE_SPEED;
    const speedingUp = Math.sign(target) === Math.sign(car.vs) && Math.abs(target) > Math.abs(car.vs);
    const a = speedingUp || Math.abs(car.vs) < 0.01 ? DRIVE_ACCEL : BRAKE_ACCEL;
    car.vs += clamp(target - car.vs, -a * dt, a * dt);
  } else {
    car.vs -= Math.sign(car.vs) * Math.min(Math.abs(car.vs), COAST_DECEL * dt); // coast: gravity does the rest
  }
  if (!boosting && Math.abs(car.vs) > MOVE_SPEED) car.vs -= Math.sign(car.vs) * (Math.abs(car.vs) - MOVE_SPEED) * Math.min(1, 2 * dt);
  car.vs -= SURFACE_GRAVITY * ty * dt;
  car.vs = clamp(car.vs, -BOOST_SPEED * 1.4, BOOST_SPEED * 1.4);

  car.s += car.vs * dt;
  applyPose(car);
  car.roll = 0; car.isRolling = false;

  // Upside down (ceiling side) the car only sticks while it's going fast enough
  const nb = boundaryAt(car.s), nny = nb.tx;
  if (nny < -0.05 && Math.abs(car.vs) < CLING_SPEED * Math.min(1, -nny * 2)) detach(car, 0.2);
}

function stepAir(car, jx, jy, boosting, dt) {
  const mag = Math.hypot(jx, jy);
  if (Math.abs(jx) > 0.05) car.lastDir = Math.sign(jx);
  car.noAttach = Math.max(0, car.noAttach - dt);

  car.vy -= GRAVITY * (jy < -0.5 ? 1 + FAST_FALL_EXTRA : 1) * dt;
  car.vx += jx * AIR_STEER * dt;
  car.vx *= Math.pow(0.98, dt * 60);
  if (boosting) {
    const bx = mag > 0.25 ? jx / mag : car.lastDir, by = mag > 0.25 ? jy / mag : 0;
    car.vx += bx * AIR_BOOST * dt; car.vy += by * AIR_BOOST * dt;
    const sp = Math.hypot(car.vx, car.vy);
    if (sp > AIR_MAX_SPEED) { car.vx *= AIR_MAX_SPEED / sp; car.vy *= AIR_MAX_SPEED / sp; }
  }

  // nose follows the stick (flipped cars face the other way, so their tilt is mirrored)
  const f = car.flip ? -1 : 1;
  const tilt = mag > 0.3 ? clamp(Math.atan2(jy, Math.abs(jx)), -Math.PI / 2, Math.PI / 2) : 0;
  car.psi = lerpAngle(car.psi, f * tilt, Math.min(1, dt * 12));
  if (car.isRolling) car.roll += dt * 8; else car.roll = 0;

  car.x += car.vx * dt; car.y += car.vy * dt;

  const q = closestOnBoundary(car.x, car.y);
  if (q.sd < car.hh) {
    const pen = car.hh - q.sd;
    car.x += q.nx * pen; car.y += q.ny * pen;
    const vn = car.vx * q.nx + car.vy * q.ny;
    if (car.noAttach <= 0 && vn <= 0.3) {
      car.s = q.s; car.vs = car.vx * q.tx + car.vy * q.ty;
      car.grounded = true; car.isRolling = false; car.roll = 0;
      applyPose(car);
      const nny = boundaryAt(car.s).tx;
      if (nny < -0.05 && Math.abs(car.vs) < CLING_SPEED * Math.min(1, -nny * 2)) detach(car, 0.2);
    } else if (vn < 0) {
      car.vx -= vn * q.nx; car.vy -= vn * q.ny; // slide along it instead of sticking
    }
  }
}

// One physics step for a car. input = { jx, jy, boost } (stick -1..1 each, boost button held)
export function stepCar(car, input, dt) {
  const jx = input.jx || 0, jy = input.jy || 0, held = !!input.boost;
  const boosting = held && car.boost > 0;
  if (boosting) car.boost = Math.max(0, car.boost - BOOST_DRAIN * dt);
  else if (!held) car.boost = Math.min(100, car.boost + BOOST_RECHARGE * dt);
  if (car.grounded) stepSurface(car, jx, jy, boosting, dt);
  else stepAir(car, jx, jy, boosting, dt);
}

// ============================================================
// BALL
// ============================================================
export function createBall() { return { x: 0, y: BALL_RADIUS + 3, vx: 0, vy: 0 }; }

function bounceOff(b, nx, ny, e) {
  const vn = b.vx * nx + b.vy * ny;
  if (vn >= 0) return;
  const k = -vn < BALL_REST_SPEED ? 0 : e; // gentle contact = no bounce
  b.vx -= (1 + k) * vn * nx; b.vy -= (1 + k) * vn * ny;
}

// Walls, floor, ceiling, curves, goal lips and the pocket behind each goal
export function collideBallWithArena(b, dt) {
  const r = BALL_RADIUS, sgn = b.x < 0 ? -1 : 1, ax = Math.abs(b.x);

  // behind the goal line: only legal between the lips, inside the pocket
  if (ax > HALF_L) {
    if (b.y <= GOAL_BOTTOM || b.y >= GOAL_TOP) { // can't be here - put it back in play
      b.x = sgn * (HALF_L - r); if (b.vx * sgn > 0) b.vx = -b.vx * BALL_RESTITUTION;
    } else {
      if (b.y < GOAL_BOTTOM + r) { b.y = GOAL_BOTTOM + r; bounceOff(b, 0, 1, BALL_RESTITUTION); }
      if (b.y > GOAL_TOP - r) { b.y = GOAL_TOP - r; bounceOff(b, 0, -1, BALL_RESTITUTION); }
      if (ax > HALF_L + GOAL_DEPTH - r) { b.x = sgn * (HALF_L + GOAL_DEPTH - r); bounceOff(b, -sgn, 0, BALL_RESTITUTION); }
    }
  }

  // the two sharp edges of each goal opening
  for (const side of [-1, 1]) for (const ly of [GOAL_BOTTOM, GOAL_TOP]) {
    const dx = b.x - side * HALF_L, dy = b.y - ly, dist = Math.hypot(dx, dy);
    if (dist < r && dist > 1e-6) {
      const nx = dx / dist, ny = dy / dist;
      b.x = side * HALF_L + nx * r; b.y = ly + ny * r;
      bounceOff(b, nx, ny, BALL_RESTITUTION);
    }
  }

  // everything else: one distance test against the rounded outline
  const q = closestOnBoundary(b.x, b.y);
  const inOpening = Math.abs(q.px) > HALF_L - 1e-4 && q.py > GOAL_BOTTOM && q.py < GOAL_TOP;
  if (q.sd < r && !inOpening) {
    const push = r - q.sd;
    b.x += q.nx * push; b.y += q.ny * push;
    bounceOff(b, q.nx, q.ny, BALL_RESTITUTION);
    if (q.sd > r - 0.05) { // rolling along it: lose a little sideways speed
      const f = Math.exp(-BALL_ROLL_FRICTION * dt);
      const vn = b.vx * q.nx + b.vy * q.ny, tx = b.vx - vn * q.nx, ty = b.vy - vn * q.ny;
      b.vx = vn * q.nx + tx * f; b.vy = vn * q.ny + ty * f;
    }
  }
}

export function stepBall(b, dt) {
  b.vy -= BALL_GRAVITY * dt;
  b.x += b.vx * dt; b.y += b.vy * dt;
  const sp = Math.hypot(b.vx, b.vy);
  if (sp > BALL_MAX_SPEED) { b.vx *= BALL_MAX_SPEED / sp; b.vy *= BALL_MAX_SPEED / sp; }
  collideBallWithArena(b, dt);
}

// Ball vs the car's tilted box. Returns null when apart, otherwise
// { impact, closingSpeed, preVx } (impact = they were actually moving together).
export function collideBallWithCar(b, car) {
  const r = BALL_RADIUS, c = Math.cos(car.psi), sn = Math.sin(car.psi);
  const ddx = b.x - car.x, ddy = b.y - car.y;
  const lx = ddx * c + ddy * sn, ly = -ddx * sn + ddy * c; // ball in the car's own frame
  const qx = clamp(lx, -car.hl, car.hl), qy = clamp(ly, -car.hh, car.hh);
  let ex = lx - qx, ey = ly - qy, dist = Math.hypot(ex, ey), overlap, nlx, nly;
  if (dist >= r) return null;
  if (dist < 1e-6) { // center is inside the box: leave through the nearest face
    const px = car.hl - Math.abs(lx), py = car.hh - Math.abs(ly);
    if (py <= px) { nlx = 0; nly = ly >= 0 ? 1 : -1; overlap = py + r; }
    else { nlx = lx >= 0 ? 1 : -1; nly = 0; overlap = px + r; }
  } else { nlx = ex / dist; nly = ey / dist; overlap = r - dist; }
  if (Math.abs(lx) <= car.hl && Math.abs(nly) > 0.5) { // dome the roof/underside
    nlx += ROOF_DOME * ((Math.abs(lx) < 0.02 ? 0.02 : lx) / car.hl);
    const m = Math.hypot(nlx, nly); nlx /= m; nly /= m;
  }
  const nx = nlx * c - nly * sn, ny = nlx * sn + nly * c;
  b.x += nx * overlap; b.y += ny * overlap;

  const preVx = b.vx;
  const rvx = b.vx - car.vx, rvy = b.vy - car.vy;
  const vn = rvx * nx + rvy * ny;
  if (vn >= 0) return { impact: false, closingSpeed: 0, preVx };
  const closing = -vn;
  const carSpeed = Math.hypot(car.vx, car.vy);
  const bounce = closing * BALL_RESTITUTION + Math.min(carSpeed * 0.5, MIN_HIT_BOUNCE_CAP);
  b.vx = car.vx + (rvx - vn * nx) + nx * bounce;
  b.vy = car.vy + (rvy - vn * ny) + ny * bounce;
  return { impact: true, closingSpeed: closing, preVx };
}
