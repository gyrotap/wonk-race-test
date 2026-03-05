export interface Obstacle {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Pitfall {
  x: number;
  y: number;
  radius: number;
}

export interface Course {
  obstacles: Obstacle[];
  pitfalls: Pitfall[];
  goalX: number;
  goalY: number;
  startX: number;
  startY: number;
  width: number;
  height: number;
}

export const COURSE_WIDTH = 800;
export const COURSE_HEIGHT = 600;
const START_MARGIN = 60;
const OBSTACLE_MIN_SIZE = 30;
const OBSTACLE_MAX_SIZE = 100;
const PITFALL_MIN_RADIUS = 10;
const PITFALL_MAX_RADIUS = 25;

function rectsOverlap(a: Obstacle, b: Obstacle, padding = 0): boolean {
  return (
    a.x - padding < b.x + b.w &&
    a.x + a.w + padding > b.x &&
    a.y - padding < b.y + b.h &&
    a.y + a.h + padding > b.y
  );
}

function isInStartOrGoalZone(x: number, y: number, startX: number, goalX: number, goalY: number, margin = 80): boolean {
  if (x < startX + margin) return true;
  const dx = x - goalX;
  const dy = y - goalY;
  return Math.sqrt(dx * dx + dy * dy) < margin;
}

function isObsInStartOrGoalZone(obs: Obstacle, startX: number, goalX: number, goalY: number): boolean {
  if (obs.x < startX + 80) return true;
  const goalObs: Obstacle = { x: goalX - 50, y: goalY - 50, w: 100, h: 100 };
  return rectsOverlap(obs, goalObs);
}

// Simple flood fill to check if a path exists from start to goal
function pathExists(obstacles: Obstacle[], startX: number, startY: number, goalX: number, goalY: number): boolean {
  const cellSize = 20;
  const cols = Math.ceil(COURSE_WIDTH / cellSize);
  const rows = Math.ceil(COURSE_HEIGHT / cellSize);
  const grid = new Uint8Array(cols * rows);

  for (const obs of obstacles) {
    const x0 = Math.max(0, Math.floor(obs.x / cellSize));
    const y0 = Math.max(0, Math.floor(obs.y / cellSize));
    const x1 = Math.min(cols - 1, Math.floor((obs.x + obs.w) / cellSize));
    const y1 = Math.min(rows - 1, Math.floor((obs.y + obs.h) / cellSize));
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        grid[y * cols + x] = 1;
      }
    }
  }

  const startCol = Math.floor(startX / cellSize);
  const startRow = Math.floor(startY / cellSize);
  const goalCol = Math.floor(goalX / cellSize);
  const goalRow = Math.floor(goalY / cellSize);

  if (grid[startRow * cols + startCol] === 1 || grid[goalRow * cols + goalCol] === 1) {
    return false;
  }

  const visited = new Uint8Array(cols * rows);
  const queue: [number, number][] = [[startCol, startRow]];
  visited[startRow * cols + startCol] = 1;

  while (queue.length > 0) {
    const [cx, cy] = queue.shift()!;
    if (cx === goalCol && cy === goalRow) return true;

    for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
      const nx = cx + dx;
      const ny = cy + dy;
      if (nx >= 0 && nx < cols && ny >= 0 && ny < rows) {
        const idx = ny * cols + nx;
        if (!visited[idx] && !grid[idx]) {
          visited[idx] = 1;
          queue.push([nx, ny]);
        }
      }
    }
  }

  return false;
}

export function generateCourse(numObstacles = 12, numPitfalls = 5): Course {
  const startX = START_MARGIN;
  const startY = COURSE_HEIGHT / 2;

  // Randomize goal position — anywhere in the right 60% of the map, with some Y variance
  const goalX = COURSE_WIDTH * 0.4 + Math.random() * (COURSE_WIDTH * 0.55 - START_MARGIN);
  const goalY = 60 + Math.random() * (COURSE_HEIGHT - 120);

  let obstacles: Obstacle[];
  let attempts = 0;

  do {
    obstacles = [];
    for (let i = 0; i < numObstacles; i++) {
      const w = OBSTACLE_MIN_SIZE + Math.random() * (OBSTACLE_MAX_SIZE - OBSTACLE_MIN_SIZE);
      const h = OBSTACLE_MIN_SIZE + Math.random() * (OBSTACLE_MAX_SIZE - OBSTACLE_MIN_SIZE);
      const x = Math.random() * (COURSE_WIDTH - w);
      const y = Math.random() * (COURSE_HEIGHT - h);

      const obs: Obstacle = { x, y, w, h };

      if (isObsInStartOrGoalZone(obs, startX, goalX, goalY)) continue;

      let overlaps = false;
      for (const existing of obstacles) {
        if (rectsOverlap(obs, existing, 10)) {
          overlaps = true;
          break;
        }
      }
      if (!overlaps) {
        obstacles.push(obs);
      }
    }
    attempts++;
  } while (!pathExists(obstacles, startX, startY, goalX, goalY) && attempts < 50);

  if (!pathExists(obstacles, startX, startY, goalX, goalY)) {
    obstacles = obstacles.slice(0, Math.floor(obstacles.length / 2));
  }

  // Generate pitfalls — these don't block pathfinding, they just kill horses
  const pitfalls: Pitfall[] = [];
  for (let i = 0; i < numPitfalls; i++) {
    const radius = PITFALL_MIN_RADIUS + Math.random() * (PITFALL_MAX_RADIUS - PITFALL_MIN_RADIUS);
    const x = radius + Math.random() * (COURSE_WIDTH - radius * 2);
    const y = radius + Math.random() * (COURSE_HEIGHT - radius * 2);

    if (isInStartOrGoalZone(x, y, startX, goalX, goalY)) continue;

    pitfalls.push({ x, y, radius });
  }

  return { obstacles, pitfalls, goalX, goalY, startX, startY, width: COURSE_WIDTH, height: COURSE_HEIGHT };
}
