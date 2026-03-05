import { Horse, HorseState } from './horse';
import { NeuralNetwork } from './neural-network';
import { Course, generateCourse } from './course';
import { handleCollisions, getNearestWalls, checkGoal, checkPitfalls } from './physics';
import { evolve } from './genetic-algorithm';
import { WONK_NAMES } from './names';

export type SimStatus = 'waiting' | 'racing' | 'finished';

export interface SimState {
  horses: HorseState[];
  obstacles: { x: number; y: number; w: number; h: number }[];
  pitfalls: { x: number; y: number; radius: number }[];
  goalX: number;
  goalY: number;
  generation: number;
  status: SimStatus;
  timeLeft: number;
  winner: string | null;
  bestFitnessHistory: number[];
  winCounts: { slot: number; name: string; wins: number }[];
}

const POPULATION_SIZE = 8;
const MAX_TICKS = 1800; // 30 seconds at 60fps
const TICK_RATE = 1000 / 60;
const BROADCAST_EVERY = 2; // send state every 2 ticks (~30fps to clients)

export class Simulation {
  horses: Horse[] = [];
  course: Course;
  generation: number = 0;
  status: SimStatus = 'waiting';
  ticks: number = 0;
  winner: string | null = null;
  bestFitnessHistory: number[] = [];
  winCounts: number[] = new Array(8).fill(0); // wins per slot
  private genomes: { genome: number[]; slot: number }[] = [];
  private tickInterval: ReturnType<typeof setInterval> | null = null;
  private onBroadcast: (state: SimState) => void;

  constructor(onBroadcast: (state: SimState) => void) {
    this.onBroadcast = onBroadcast;
    this.course = generateCourse();

    // Initialize first generation with random brains — each slot is permanent
    this.genomes = Array.from({ length: POPULATION_SIZE }, (_, i) => ({
      genome: new NeuralNetwork().weights,
      slot: i,
    }));
  }

  getState(): SimState {
    return {
      horses: this.horses.map(h => h.toState(this.course.goalX, this.course.goalY)),
      obstacles: this.course.obstacles,
      pitfalls: this.course.pitfalls,
      goalX: this.course.goalX,
      goalY: this.course.goalY,
      generation: this.generation,
      status: this.status,
      timeLeft: Math.max(0, Math.ceil((MAX_TICKS - this.ticks) / 60)),
      winner: this.winner,
      bestFitnessHistory: this.bestFitnessHistory,
      winCounts: WONK_NAMES.map((name, slot) => ({ slot, name, wins: this.winCounts[slot] })),
    };
  }

  startNextGeneration() {
    if (this.status === 'racing') return;

    this.generation++;
    this.ticks = 0;
    this.winner = null;
    this.status = 'racing';

    // Generate a new course — difficulty scales with generation
    const baseObstacles = 10;
    const basePitfalls = 4;
    const extraObstacles = Math.min(Math.floor(this.generation / 3), 15);
    const extraPitfalls = Math.min(Math.floor(this.generation / 4), 10);
    this.course = generateCourse(baseObstacles + extraObstacles, basePitfalls + extraPitfalls);

    // Stagger start positions vertically
    const spacing = this.course.height / (POPULATION_SIZE + 1);
    this.horses = this.genomes.map((g) => {
      const brain = new NeuralNetwork(g.genome);
      return new Horse(g.slot, WONK_NAMES[g.slot], brain, this.course.startX, spacing * (g.slot + 1));
    });

    // Start the simulation loop
    if (this.tickInterval) clearInterval(this.tickInterval);
    this.tickInterval = setInterval(() => this.tick(), TICK_RATE);

    // Broadcast initial state
    this.onBroadcast(this.getState());
  }

  private tick() {
    if (this.status !== 'racing') return;

    this.ticks++;

    // Update each horse
    for (const horse of this.horses) {
      if (horse.finished || horse.dead) continue;

      const walls = getNearestWalls(horse, this.course.obstacles);
      horse.update(this.course.goalX, this.course.goalY, walls);
      handleCollisions(horse, this.course.obstacles);

      // Check pitfalls
      if (checkPitfalls(horse, this.course.pitfalls)) {
        horse.dead = true;
        horse.vx = 0;
        horse.vy = 0;
        continue;
      }

      // Check if reached goal
      if (checkGoal(horse, this.course.goalX, this.course.goalY)) {
        horse.finished = true;
        horse.finishTime = this.ticks;
        if (!this.winner) {
          this.winner = horse.name;
          this.winCounts[horse.id]++;
        }
      }
    }

    // Check end conditions
    const allFinished = this.horses.every(h => h.finished || h.dead);
    if (allFinished || this.ticks >= MAX_TICKS) {
      this.endRace();
      return;
    }

    // Broadcast state periodically
    if (this.ticks % BROADCAST_EVERY === 0) {
      this.onBroadcast(this.getState());
    }
  }

  private endRace() {
    if (this.tickInterval) {
      clearInterval(this.tickInterval);
      this.tickInterval = null;
    }

    this.status = 'finished';

    // Calculate fitness for all horses
    for (const horse of this.horses) {
      horse.calculateFitness(this.course.goalX, this.course.goalY, this.ticks, MAX_TICKS);
    }

    // Track best fitness
    const bestFitness = Math.max(...this.horses.map(h => h.fitness));
    this.bestFitnessHistory.push(Math.round(bestFitness));

    // Evolve for next generation — slots stay permanent
    const individuals = this.horses.map(h => ({
      genome: h.brain.weights,
      fitness: h.fitness,
      slot: h.id,
    }));

    this.genomes = evolve(individuals);

    // Broadcast final state
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
    this.winner = null;
    this.bestFitnessHistory = [];
    this.winCounts = new Array(8).fill(0);
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
