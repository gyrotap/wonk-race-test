import { Horse, HorseState } from './horse';
import { NeuralNetwork } from './neural-network';
import { Course, generateCourse } from './course';
import { handleCollisions, handleWonkCollisions, getNearestWalls, checkGoal, checkPitfalls } from './physics';
import { evolve } from './genetic-algorithm';
import { WONK_NAMES } from './names';
import {
  PowerupType, PowerupItem, HeldPowerup, Projectile,
  spawnPowerups, POWERUP_RADIUS, POWERUP_DURATION, STUN_DURATION,
  AUTO_FIRE_DELAY, PROJECTILE_SPEED,
} from './powerups';

export type SimStatus = 'waiting' | 'betting' | 'racing' | 'finished';

export interface PowerupItemState {
  id: number;
  type: string;
  x: number;
  y: number;
}

export interface ProjectileState {
  x: number;
  y: number;
  targetSlot: number;
}

export interface SimState {
  horses: HorseState[];
  obstacles: { x: number; y: number; w: number; h: number }[];
  pitfalls: { x: number; y: number; radius: number }[];
  goalX: number;
  goalY: number;
  generation: number;
  status: SimStatus;
  timeLeft: number;
  bettingTimeLeft: number;
  winner: string | null;
  bestFitnessHistory: number[];
  winCounts: { slot: number; name: string; wins: number }[];
  powerupItems: PowerupItemState[];
  projectiles: ProjectileState[];
}

const POPULATION_SIZE = 8;
const MAX_TICKS = 1800; // 30 seconds at 60fps
const TICK_RATE = 1000 / 60;
const BROADCAST_EVERY = 2;
const BETTING_COUNTDOWN_TICKS = 600; // 10 seconds at 60fps

export class Simulation {
  horses: Horse[] = [];
  course: Course;
  generation: number = 0;
  status: SimStatus = 'waiting';
  ticks: number = 0;
  bettingTicks: number = 0;
  winner: string | null = null;
  bestFitnessHistory: number[] = [];
  winCounts: number[] = new Array(8).fill(0);
  private genomes: { genome: number[]; slot: number }[] = [];
  private tickInterval: ReturnType<typeof setInterval> | null = null;
  private onBroadcast: (state: SimState) => void;

  // Powerup state
  powerupItems: PowerupItem[] = [];
  slotPowerups: Map<number, HeldPowerup> = new Map(); // persistent across generations
  projectiles: Projectile[] = [];
  private nextProjectileId = 0;

  // Callback for race end (betting resolution)
  onRaceEnd: ((winnerSlot: number | null) => void) | null = null;

  constructor(onBroadcast: (state: SimState) => void) {
    this.onBroadcast = onBroadcast;
    this.course = generateCourse();

    this.genomes = Array.from({ length: POPULATION_SIZE }, (_, i) => ({
      genome: new NeuralNetwork().weights,
      slot: i,
    }));
  }

  getState(): SimState {
    return {
      horses: this.horses.map(h => h.toState(this.course.goalX, this.course.goalY, this.ticks)),
      obstacles: this.course.obstacles,
      pitfalls: this.course.pitfalls,
      goalX: this.course.goalX,
      goalY: this.course.goalY,
      generation: this.generation,
      status: this.status,
      timeLeft: Math.max(0, Math.ceil((MAX_TICKS - this.ticks) / 60)),
      bettingTimeLeft: this.status === 'betting'
        ? Math.max(0, Math.ceil((BETTING_COUNTDOWN_TICKS - this.bettingTicks) / 60))
        : 0,
      winner: this.winner,
      bestFitnessHistory: this.bestFitnessHistory,
      winCounts: WONK_NAMES.map((name, slot) => ({ slot, name, wins: this.winCounts[slot] })),
      powerupItems: this.powerupItems
        .filter(p => !p.collected)
        .map(p => ({ id: p.id, type: p.type, x: p.x, y: p.y })),
      projectiles: this.projectiles.map(p => {
        const target = this.horses.find(h => h.id === p.targetSlot);
        return {
          x: p.x,
          y: p.y,
          targetSlot: p.targetSlot,
        };
      }),
    };
  }

  activatePowerup(slot: number): boolean {
    if (this.status !== 'racing') return false;
    const held = this.slotPowerups.get(slot);
    if (!held) return false;

    const horse = this.horses.find(h => h.id === slot);
    if (!horse || horse.dead || horse.finished) return false;

    this.applyPowerup(horse, held.type);
    this.slotPowerups.delete(slot);
    horse.heldPowerup = null;
    return true;
  }

  private applyPowerup(horse: Horse, type: PowerupType) {
    switch (type) {
      case 'speed':
        horse.speedBoostUntil = this.ticks + POWERUP_DURATION;
        break;
      case 'shield':
        horse.shielded = true;
        break;
      case 'zap': {
        // Find nearest alive, non-dead wonk to zap
        let nearest: Horse | null = null;
        let nearestDist = Infinity;
        for (const other of this.horses) {
          if (other.id === horse.id || other.dead || other.finished) continue;
          const dx = other.x - horse.x;
          const dy = other.y - horse.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < nearestDist) {
            nearestDist = dist;
            nearest = other;
          }
        }
        if (nearest) {
          this.projectiles.push({
            id: this.nextProjectileId++,
            fromSlot: horse.id,
            targetSlot: nearest.id,
            x: horse.x,
            y: horse.y,
          });
        }
        break;
      }
      case 'magnet':
        horse.magnetUntil = this.ticks + POWERUP_DURATION;
        break;
    }
  }

  startNextGeneration() {
    if (this.status === 'racing' || this.status === 'betting') return;

    this.generation++;
    this.ticks = 0;
    this.bettingTicks = 0;
    this.winner = null;
    this.projectiles = [];

    const baseObstacles = 10;
    const basePitfalls = 4;
    const extraObstacles = Math.min(Math.floor(this.generation / 3), 15);
    const extraPitfalls = Math.min(Math.floor(this.generation / 4), 10);
    this.course = generateCourse(baseObstacles + extraObstacles, basePitfalls + extraPitfalls);

    // Spawn powerups on the course
    const numPowerups = Math.min(4 + Math.floor(this.generation / 5), 8);
    this.powerupItems = spawnPowerups(
      this.course.width, this.course.height,
      this.course.startX, this.course.goalX, this.course.goalY,
      numPowerups
    );

    const spacing = this.course.height / (POPULATION_SIZE + 1);
    this.horses = this.genomes.map((g) => {
      const brain = new NeuralNetwork(g.genome);
      const horse = new Horse(g.slot, WONK_NAMES[g.slot], brain, this.course.startX, spacing * (g.slot + 1));

      // Restore persistent powerup
      const held = this.slotPowerups.get(g.slot);
      if (held) {
        horse.heldPowerup = held.type;
        // Reset pickup tick for auto-fire timer in new generation
        this.slotPowerups.set(g.slot, { ...held, pickedUpTick: 0 });
      }

      return horse;
    });

    // Start betting countdown
    this.status = 'betting';
    if (this.tickInterval) clearInterval(this.tickInterval);
    this.tickInterval = setInterval(() => this.bettingTick(), TICK_RATE);

    this.onBroadcast(this.getState());
  }

  private bettingTick() {
    this.bettingTicks++;

    if (this.bettingTicks >= BETTING_COUNTDOWN_TICKS) {
      // Transition to racing
      this.status = 'racing';
      this.ticks = 0;
      if (this.tickInterval) clearInterval(this.tickInterval);
      this.tickInterval = setInterval(() => this.tick(), TICK_RATE);
      this.onBroadcast(this.getState());
      return;
    }

    // Broadcast every few ticks so clients see the countdown
    if (this.bettingTicks % 6 === 0) {
      this.onBroadcast(this.getState());
    }
  }

  private tick() {
    if (this.status !== 'racing') return;

    this.ticks++;

    // Auto-fire held powerups after delay
    for (const [slot, held] of this.slotPowerups) {
      if (this.ticks - held.pickedUpTick >= AUTO_FIRE_DELAY) {
        this.activatePowerup(slot);
      }
    }

    // Update projectiles
    this.updateProjectiles();

    // Update each horse
    for (const horse of this.horses) {
      if (horse.finished || horse.dead) continue;

      const walls = getNearestWalls(horse, this.course.obstacles);
      horse.update(this.course.goalX, this.course.goalY, walls, this.ticks);
      handleCollisions(horse, this.course.obstacles);

      // Check powerup pickup
      if (!horse.heldPowerup) {
        for (const item of this.powerupItems) {
          if (item.collected) continue;
          const dx = horse.x - item.x;
          const dy = horse.y - item.y;
          if (Math.sqrt(dx * dx + dy * dy) < POWERUP_RADIUS + Horse.RADIUS) {
            item.collected = true;
            horse.heldPowerup = item.type;
            this.slotPowerups.set(horse.id, { type: item.type, pickedUpTick: this.ticks });
            break;
          }
        }
      }

      // Check pitfalls
      if (checkPitfalls(horse, this.course.pitfalls)) {
        if (horse.shielded) {
          horse.shielded = false; // Shield absorbs the hit
        } else {
          horse.dead = true;
          horse.vx = 0;
          horse.vy = 0;
          // Drop held powerup
          this.slotPowerups.delete(horse.id);
          horse.heldPowerup = null;
        }
        continue;
      }

      if (checkGoal(horse, this.course.goalX, this.course.goalY)) {
        horse.finished = true;
        horse.finishTime = this.ticks;
        if (!this.winner) {
          this.winner = horse.name;
          this.winCounts[horse.id]++;
        }
      }
    }

    // Wonk-to-wonk pinball collisions
    handleWonkCollisions(this.horses);

    const allFinished = this.horses.every(h => h.finished || h.dead);
    if (allFinished || this.ticks >= MAX_TICKS) {
      this.endRace();
      return;
    }

    if (this.ticks % BROADCAST_EVERY === 0) {
      this.onBroadcast(this.getState());
    }
  }

  private updateProjectiles() {
    const toRemove: number[] = [];

    for (const proj of this.projectiles) {
      const target = this.horses.find(h => h.id === proj.targetSlot);
      if (!target || target.dead || target.finished) {
        toRemove.push(proj.id);
        continue;
      }

      // Move toward target
      const dx = target.x - proj.x;
      const dy = target.y - proj.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < 15) {
        // Hit! Stun the target (or shield blocks it)
        if (target.shielded) {
          target.shielded = false;
        } else {
          target.stunUntil = this.ticks + STUN_DURATION;
        }
        toRemove.push(proj.id);
      } else {
        proj.x += (dx / dist) * PROJECTILE_SPEED;
        proj.y += (dy / dist) * PROJECTILE_SPEED;
      }
    }

    this.projectiles = this.projectiles.filter(p => !toRemove.includes(p.id));
  }

  private endRace() {
    if (this.tickInterval) {
      clearInterval(this.tickInterval);
      this.tickInterval = null;
    }

    this.status = 'finished';

    for (const horse of this.horses) {
      horse.calculateFitness(this.course.goalX, this.course.goalY, this.ticks, MAX_TICKS);
    }

    const bestFitness = Math.max(...this.horses.map(h => h.fitness));
    this.bestFitnessHistory.push(Math.round(bestFitness));

    // Find winner slot for betting
    const winnerHorse = this.horses.find(h => h.name === this.winner);
    const winnerSlot = winnerHorse ? winnerHorse.id : null;
    if (this.onRaceEnd) this.onRaceEnd(winnerSlot);

    const individuals = this.horses.map(h => ({
      genome: h.brain.weights,
      fitness: h.fitness,
      slot: h.id,
    }));

    this.genomes = evolve(individuals);

    this.onBroadcast(this.getState());
  }

  reset() {
    if (this.tickInterval) {
      clearInterval(this.tickInterval);
      this.tickInterval = null;
    }

    this.horses = [];
    this.generation = 0;
    this.status = 'waiting';
    this.ticks = 0;
    this.bettingTicks = 0;
    this.winner = null;
    this.bestFitnessHistory = [];
    this.winCounts = new Array(8).fill(0);
    this.slotPowerups.clear();
    this.powerupItems = [];
    this.projectiles = [];
    this.course = generateCourse();

    this.genomes = Array.from({ length: POPULATION_SIZE }, (_, i) => ({
      genome: new NeuralNetwork().weights,
      slot: i,
    }));

    this.onBroadcast(this.getState());
    console.log('Simulation reset to gen 0');
  }

  destroy() {
    if (this.tickInterval) {
      clearInterval(this.tickInterval);
      this.tickInterval = null;
    }
  }
}
