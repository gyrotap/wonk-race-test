import { NeuralNetwork } from './neural-network';

export const HORSE_COLORS = [
  '#FF4444', // red
  '#4488FF', // blue
  '#44CC44', // green
  '#FFAA00', // orange
  '#CC44CC', // purple
  '#00CCCC', // cyan
  '#FFFF44', // yellow
  '#FF88CC', // pink
];

export interface HorseState {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  name: string;
  spriteId: string;
  fitness: number;
  finished: boolean;
  dead: boolean;
  finishTime: number | null;
  distToGoal: number;
}

export class Horse {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  name: string;
  spriteId: string;
  brain: NeuralNetwork;
  fitness: number;
  finished: boolean;
  dead: boolean;
  finishTime: number | null;

  static readonly MAX_SPEED = 3;
  static readonly ACCELERATION = 0.4;
  static readonly FRICTION = 0.98;
  static readonly RADIUS = 12;

  constructor(id: number, name: string, brain: NeuralNetwork, startX: number, startY: number) {
    this.id = id;
    this.x = startX;
    this.y = startY;
    this.vx = 0;
    this.vy = 0;
    this.color = HORSE_COLORS[id % HORSE_COLORS.length];
    this.name = name;
    this.spriteId = `wonk${id + 1}`;
    this.brain = brain;
    this.fitness = 0;
    this.finished = false;
    this.dead = false;
    this.finishTime = null;
  }

  getInputs(goalX: number, goalY: number, nearestWalls: number[]): number[] {
    const dx = goalX - this.x;
    const dy = goalY - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1;
    const angle = Math.atan2(dy, dx) / Math.PI; // normalize to [-1, 1]

    return [
      nearestWalls[0] / 800, // distance to wall left (normalized)
      nearestWalls[1] / 800, // distance to wall right
      nearestWalls[2] / 600, // distance to wall up
      nearestWalls[3] / 600, // distance to wall down
      angle,                 // angle to goal
      Math.min(dist / 800, 1), // distance to goal (normalized)
      this.vx / Horse.MAX_SPEED, // current velocity x
      this.vy / Horse.MAX_SPEED, // current velocity y
    ];
  }

  update(goalX: number, goalY: number, nearestWalls: number[]) {
    if (this.finished || this.dead) return;

    const inputs = this.getInputs(goalX, goalY, nearestWalls);
    const [ax, ay] = this.brain.forward(inputs);

    this.vx += ax * Horse.ACCELERATION;
    this.vy += ay * Horse.ACCELERATION;

    // Apply friction
    this.vx *= Horse.FRICTION;
    this.vy *= Horse.FRICTION;

    // Cap speed
    const speed = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
    if (speed > Horse.MAX_SPEED) {
      this.vx = (this.vx / speed) * Horse.MAX_SPEED;
      this.vy = (this.vy / speed) * Horse.MAX_SPEED;
    }

    this.x += this.vx;
    this.y += this.vy;
  }

  calculateFitness(goalX: number, goalY: number, elapsedTicks: number, maxTicks: number) {
    const dx = goalX - this.x;
    const dy = goalY - this.y;
    const distToGoal = Math.sqrt(dx * dx + dy * dy);

    // Base fitness: inverse of distance to goal
    this.fitness = Math.max(0, 1000 - distToGoal);

    if (this.dead) {
      // Penalty for dying but still some fitness based on progress
      this.fitness *= 0.3;
    } else if (this.finished && this.finishTime !== null) {
      // Big bonus for finishing + time bonus
      this.fitness += 5000 + (maxTicks - this.finishTime) * 2;
    }
  }

  distanceToGoal(goalX: number, goalY: number): number {
    const dx = goalX - this.x;
    const dy = goalY - this.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  toState(goalX?: number, goalY?: number): HorseState {
    return {
      id: this.id,
      x: this.x,
      y: this.y,
      vx: this.vx,
      vy: this.vy,
      color: this.color,
      name: this.name,
      spriteId: this.spriteId,
      fitness: Math.round(this.fitness),
      finished: this.finished,
      dead: this.dead,
      finishTime: this.finishTime,
      distToGoal: goalX !== undefined && goalY !== undefined
        ? Math.round(this.distanceToGoal(goalX, goalY))
        : 9999,
    };
  }
}
