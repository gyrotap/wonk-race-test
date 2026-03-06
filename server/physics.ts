import { Horse } from './horse';
import { Obstacle, Pitfall, COURSE_WIDTH, COURSE_HEIGHT } from './course';

const BOUNCE_FACTOR = 1.8; // Wonks ricochet HARD like pinball bumpers
const MIN_BOUNCE_SPEED = 4.0; // Strong minimum bounce so they never get stuck
const DEFLECT_RANDOMNESS = 0.5; // Random angle change on bounce for chaotic trajectories
const WONK_COLLISION_BOUNCE = 5.0; // How hard wonks bounce off each other

// Add random deflection so bounces change trajectory unpredictably
function deflect(vx: number, vy: number): [number, number] {
  const angle = Math.atan2(vy, vx);
  const speed = Math.sqrt(vx * vx + vy * vy);
  const newAngle = angle + (Math.random() - 0.5) * DEFLECT_RANDOMNESS * Math.PI;
  return [Math.cos(newAngle) * speed, Math.sin(newAngle) * speed];
}

function ensureMinBounce(vx: number, vy: number): [number, number] {
  const speed = Math.sqrt(vx * vx + vy * vy);
  if (speed < MIN_BOUNCE_SPEED) {
    if (speed === 0) {
      // Wonk had zero velocity — launch in random direction
      const angle = Math.random() * Math.PI * 2;
      return [Math.cos(angle) * MIN_BOUNCE_SPEED, Math.sin(angle) * MIN_BOUNCE_SPEED];
    }
    const scale = MIN_BOUNCE_SPEED / speed;
    return [vx * scale, vy * scale];
  }
  return [vx, vy];
}

export function handleCollisions(horse: Horse, obstacles: Obstacle[]) {
  const r = Horse.RADIUS;

  // Boundary collisions — aggressive bounce off walls
  if (horse.x - r < 0) {
    horse.x = r;
    horse.vx = Math.abs(horse.vx) * BOUNCE_FACTOR;
    [horse.vx, horse.vy] = ensureMinBounce(horse.vx, horse.vy);
    [horse.vx, horse.vy] = deflect(horse.vx, horse.vy);
    horse.vx = Math.abs(horse.vx); // ensure still going right after deflect
  }
  if (horse.x + r > COURSE_WIDTH) {
    horse.x = COURSE_WIDTH - r;
    horse.vx = -Math.abs(horse.vx) * BOUNCE_FACTOR;
    [horse.vx, horse.vy] = ensureMinBounce(horse.vx, horse.vy);
    [horse.vx, horse.vy] = deflect(horse.vx, horse.vy);
    horse.vx = -Math.abs(horse.vx); // ensure still going left after deflect
  }
  if (horse.y - r < 0) {
    horse.y = r;
    horse.vy = Math.abs(horse.vy) * BOUNCE_FACTOR;
    [horse.vx, horse.vy] = ensureMinBounce(horse.vx, horse.vy);
    [horse.vx, horse.vy] = deflect(horse.vx, horse.vy);
    horse.vy = Math.abs(horse.vy); // ensure still going down after deflect
  }
  if (horse.y + r > COURSE_HEIGHT) {
    horse.y = COURSE_HEIGHT - r;
    horse.vy = -Math.abs(horse.vy) * BOUNCE_FACTOR;
    [horse.vx, horse.vy] = ensureMinBounce(horse.vx, horse.vy);
    [horse.vx, horse.vy] = deflect(horse.vx, horse.vy);
    horse.vy = -Math.abs(horse.vy); // ensure still going up after deflect
  }

  // Obstacle collisions (AABB vs circle) — chaotic bouncing with trajectory change
  for (const obs of obstacles) {
    const closestX = Math.max(obs.x, Math.min(horse.x, obs.x + obs.w));
    const closestY = Math.max(obs.y, Math.min(horse.y, obs.y + obs.h));
    const dx = horse.x - closestX;
    const dy = horse.y - closestY;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < r) {
      if (dist === 0) {
        // Horse center is inside obstacle — launch it out in a random direction hard
        const angle = Math.random() * Math.PI * 2;
        horse.vx = Math.cos(angle) * MIN_BOUNCE_SPEED * 2;
        horse.vy = Math.sin(angle) * MIN_BOUNCE_SPEED * 2;
        horse.x += horse.vx;
        horse.y += horse.vy;
      } else {
        const nx = dx / dist;
        const ny = dy / dist;
        const overlap = r - dist;
        horse.x += nx * (overlap + 2); // Push well clear of the wall
        horse.y += ny * (overlap + 2);

        // Reflect velocity along the collision normal and amplify
        const dot = horse.vx * nx + horse.vy * ny;
        if (dot < 0) {
          horse.vx -= 2 * dot * nx * BOUNCE_FACTOR;
          horse.vy -= 2 * dot * ny * BOUNCE_FACTOR;
        }

        // Add trajectory change
        [horse.vx, horse.vy] = deflect(horse.vx, horse.vy);
      }
      [horse.vx, horse.vy] = ensureMinBounce(horse.vx, horse.vy);
    }
  }
}

export function getNearestWalls(horse: Horse, obstacles: Obstacle[]): [number, number, number, number] {
  let left = horse.x;
  let right = COURSE_WIDTH - horse.x;
  let up = horse.y;
  let down = COURSE_HEIGHT - horse.y;

  for (const obs of obstacles) {
    // Check if obstacle is in each direction from horse
    // Left: obstacle to the left, overlapping in Y
    if (obs.x + obs.w <= horse.x && horse.y >= obs.y && horse.y <= obs.y + obs.h) {
      left = Math.min(left, horse.x - (obs.x + obs.w));
    }
    // Right: obstacle to the right, overlapping in Y
    if (obs.x >= horse.x && horse.y >= obs.y && horse.y <= obs.y + obs.h) {
      right = Math.min(right, obs.x - horse.x);
    }
    // Up: obstacle above, overlapping in X
    if (obs.y + obs.h <= horse.y && horse.x >= obs.x && horse.x <= obs.x + obs.w) {
      up = Math.min(up, horse.y - (obs.y + obs.h));
    }
    // Down: obstacle below, overlapping in X
    if (obs.y >= horse.y && horse.x >= obs.x && horse.x <= obs.x + obs.w) {
      down = Math.min(down, obs.y - horse.y);
    }
  }

  return [left, right, up, down];
}

export function checkGoal(horse: Horse, goalX: number, goalY: number, goalRadius = 20): boolean {
  const dx = horse.x - goalX;
  const dy = horse.y - goalY;
  return Math.sqrt(dx * dx + dy * dy) < goalRadius + Horse.RADIUS;
}

export function checkPitfalls(horse: Horse, pitfalls: Pitfall[]): boolean {
  for (const pit of pitfalls) {
    const dx = horse.x - pit.x;
    const dy = horse.y - pit.y;
    if (Math.sqrt(dx * dx + dy * dy) < pit.radius + Horse.RADIUS) {
      return true; // horse fell in a pitfall
    }
  }
  return false;
}

export function handleWonkCollisions(horses: Horse[]) {
  for (let i = 0; i < horses.length; i++) {
    const a = horses[i];
    if (a.finished || a.dead) continue;

    for (let j = i + 1; j < horses.length; j++) {
      const b = horses[j];
      if (b.finished || b.dead) continue;

      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const minDist = Horse.RADIUS * 2;

      if (dist < minDist && dist > 0) {
        // Push apart
        const nx = dx / dist;
        const ny = dy / dist;
        const overlap = minDist - dist;
        a.x -= nx * (overlap / 2 + 1);
        a.y -= ny * (overlap / 2 + 1);
        b.x += nx * (overlap / 2 + 1);
        b.y += ny * (overlap / 2 + 1);

        // Elastic-ish collision with pinball bounce
        const relVx = a.vx - b.vx;
        const relVy = a.vy - b.vy;
        const relDot = relVx * nx + relVy * ny;

        if (relDot > 0) {
          a.vx -= relDot * nx;
          a.vy -= relDot * ny;
          b.vx += relDot * nx;
          b.vy += relDot * ny;
        }

        // Add pinball bounce force pushing them apart
        a.vx -= nx * WONK_COLLISION_BOUNCE;
        a.vy -= ny * WONK_COLLISION_BOUNCE;
        b.vx += nx * WONK_COLLISION_BOUNCE;
        b.vy += ny * WONK_COLLISION_BOUNCE;

        // Deflect both for chaos
        [a.vx, a.vy] = deflect(a.vx, a.vy);
        [b.vx, b.vy] = deflect(b.vx, b.vy);
      }
    }
  }
}
