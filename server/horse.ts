import { NeuralNetwork } from './neural-network';
import { PowerupType, SPEED_MULTIPLIER, MAGNET_STRENGTH } from './powerups';

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
  stunned: boolean;
  shielded: boolean;
  speedBoosted: boolean;
  magnetized: boolean;
  heldPowerup: string | null;
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

  // Powerup state
  stunUntil: number = 0;
  shielded: boolean = false;
  speedBoostUntil: number = 0;
  magnetUntil: number = 0;
  heldPowerup: PowerupType | null = null;

  static readonly MAX_SPEED = 4;
  static readonly BOUNCE_MAX_SPEED = 10;
  static readonly ACCELERATION = 0.5;
  static readonly FRICTION = 0.96;
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

  isStunned(tick: number): boolean {
    return tick < this.stunUntil;
  }

  isSpeedBoosted(tick: number): boolean {
    return tick < this.speedBoostUntil;
  }

  isMagnetized(tick: number): boolean {
    return tick < this.magnetUntil;
  }

  getInputs(goalX: number, goalY: number, nearestWalls: number[]): number[] {
    const dx = goalX - this.x;
    const dy = goalY - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1;
    const angle = Math.atan2(dy, dx) / Math.PI;

    return [
      nearestWalls[0] / 800,
      nearestWalls[1] / 800,
      nearestWalls[2] / 600,
      nearestWalls[3] / 600,
      angle,
      Math.min(dist / 800, 1),
      this.vx / Horse.MAX_SPEED,
      this.vy / Horse.MAX_SPEED,
    ];
  }

  update(goalX: number, goalY: number, nearestWalls: number[], tick: number) {
    if (this.finished || this.dead) return;

    // Stunned wonks can't control themselves
    if (this.isStunned(tick)) {
      this.vx *= 0.9;
      this.vy *= 0.9;
      this.x += this.vx;
      this.y += this.vy;
      return;
    }

    const inputs = this.getInputs(goalX, goalY, nearestWalls);
    const [ax, ay] = this.brain.forward(inputs);

    const accelMult = this.isSpeedBoosted(tick) ? SPEED_MULTIPLIER : 1;
    this.vx += ax * Horse.ACCELERATION * accelMult;
    this.vy += ay * Horse.ACCELERATION * accelMult;

    // Magnet pull toward goal
    if (this.isMagnetized(tick)) {
      const dx = goalX - this.x;
      const dy = goalY - this.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      this.vx += (dx / dist) * MAGNET_STRENGTH;
      this.vy += (dy / dist) * MAGNET_STRENGTH;
    }

    this.vx *= Horse.FRICTION;
    this.vy *= Horse.FRICTION;

    const maxSpd = this.isSpeedBoosted(tick) ? Horse.BOUNCE_MAX_SPEED * 1.5 : Horse.BOUNCE_MAX_SPEED;
    const speed = Math.sqrt(this.vx * this.vx + this.vy * this.vy);
    if (speed > maxSpd) {
      this.vx = (this.vx / speed) * maxSpd;
      this.vy = (this.vy / speed) * maxSpd;
    }

    this.x += this.vx;
    this.y += this.vy;
  }

  calculateFitness(goalX: number, goalY: number, elapsedTicks: number, maxTicks: number) {
    const dx = goalX - this.x;
    const dy = goalY - this.y;
    const distToGoal = Math.sqrt(dx * dx + dy * dy);

    this.fitness = Math.max(0, 1000 - distToGoal);

    if (this.dead) {
      this.fitness *= 0.3;
    } else if (this.finished && this.finishTime !== null) {
      this.fitness += 5000 + (maxTicks - this.finishTime) * 2;
    }
  }

  distanceToGoal(goalX: number, goalY: number): number {
    const dx = goalX - this.x;
    const dy = goalY - this.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  toState(goalX: number | undefined, goalY: number | undefined, tick: number): HorseState {
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
      stunned: this.isStunned(tick),
      shielded: this.shielded,
      speedBoosted: this.isSpeedBoosted(tick),
      magnetized: this.isMagnetized(tick),
      heldPowerup: this.heldPowerup,
    };
  }
}
