import { Horse, HorseState } from './horse';
import { NeuralNetwork } from './neural-network';
import { Course, generateCourse } from './course';
import { handleCollisions, getNearestWalls, checkGoal, checkPitfalls } from './physics';
import { evolve } from './genetic-algorithm';
import { generateHorseName, generateUniqueNames } from './names';

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
}

const POPULATION_SIZE = 8;
const MAX_TICKS = 900; // 15 seconds at 60fps
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
  private genomes: { genome: number[]; name: string }[] = [];
  private tickInterval: ReturnType<typeof setInterval> | null = null;
  private onBroadcast: (state: SimState) => void;

  constructor(onBroadcast: (state: SimState) => void) {
    this.onBroadcast = onBroadcast;
    this.course = generateCourse();

    // Initialize first generation with random brains
    const names = generateUniqueNames(POPULATION_SIZE);
    this.genomes = names.map(name => ({
      genome: new NeuralNetwork().weights,
      name,
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
    };
  }

  startNextGeneration() {
    if (this.status === 'racing') return; // Can't start while racing

    this.generation++;
    this.ticks = 0;
    this.winner = null;
    this.status = 'racing';

    // Generate a new course each generation
    this.course = generateCourse();

    // Stagger start positions vertically
    const spacing = this.course.height / (POPULATION_SIZE + 1);
    this.horses = this.genomes.map((g, i) => {
      const brain = new NeuralNetwork(g.genome);
      return new Horse(i, g.name, brain, this.course.startX, spacing * (i + 1));
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

    // Evolve for next generation
    const individuals = this.horses.map(h => ({
      genome: h.brain.weights,
      fitness: h.fitness,
      name: h.name,
    }));

    const existingNames = individuals.map(i => i.name);
    this.genomes = evolve(individuals, () => {
      const [name] = generateUniqueNames(1, existingNames);
      existingNames.push(name);
      return name;
    });

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
    this.course = generateCourse();

    const names = generateUniqueNames(POPULATION_SIZE);
    this.genomes = names.map(name => ({
      genome: new NeuralNetwork().weights,
      name,
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
