import { Horse } from './horse';
import { Obstacle, Pitfall, COURSE_WIDTH, COURSE_HEIGHT } from './course';

const BOUNCE_DAMPING = 0.5;

export function handleCollisions(horse: Horse, obstacles: Obstacle[]) {
  const r = Horse.RADIUS;

  // Boundary collisions
  if (horse.x - r < 0) {
    horse.x = r;
    horse.vx = Math.abs(horse.vx) * BOUNCE_DAMPING;
  }
  if (horse.x + r > COURSE_WIDTH) {
    horse.x = COURSE_WIDTH - r;
    horse.vx = -Math.abs(horse.vx) * BOUNCE_DAMPING;
  }
  if (horse.y - r < 0) {
    horse.y = r;
    horse.vy = Math.abs(horse.vy) * BOUNCE_DAMPING;
  }
  if (horse.y + r > COURSE_HEIGHT) {
    horse.y = COURSE_HEIGHT - r;
    horse.vy = -Math.abs(horse.vy) * BOUNCE_DAMPING;
  }

  // Obstacle collisions (AABB vs circle)
  for (const obs of obstacles) {
    const closestX = Math.max(obs.x, Math.min(horse.x, obs.x + obs.w));
    const closestY = Math.max(obs.y, Math.min(horse.y, obs.y + obs.h));
    const dx = horse.x - closestX;
    const dy = horse.y - closestY;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < r) {
      // Push horse out of obstacle
      if (dist === 0) {
        // Horse center is inside obstacle — push in the direction we came from
        horse.x -= horse.vx * 2;
        horse.y -= horse.vy * 2;
        horse.vx *= -BOUNCE_DAMPING;
        horse.vy *= -BOUNCE_DAMPING;
      } else {
        const nx = dx / dist;
        const ny = dy / dist;
        const overlap = r - dist;
        horse.x += nx * overlap;
        horse.y += ny * overlap;

        // Reflect velocity along the collision normal
        const dot = horse.vx * nx + horse.vy * ny;
        if (dot < 0) {
          horse.vx -= 2 * dot * nx;
          horse.vy -= 2 * dot * ny;
          horse.vx *= BOUNCE_DAMPING;
          horse.vy *= BOUNCE_DAMPING;
        }
      }
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
