const MUTATION_RATE = 0.08;      // Higher mutation rate for faster exploration
const MUTATION_STRENGTH = 0.3;   // Bigger mutations to escape local minima
const ELITISM_COUNT = 2;         // Keep top 2 so good strategies persist

interface Individual {
  genome: number[];
  fitness: number;
  slot: number; // permanent slot index (0-7), tied to name + sprite
}

function tournamentSelect(population: Individual[]): Individual {
  // Pick 3 random, return the best
  const candidates: Individual[] = [];
  for (let i = 0; i < 3; i++) {
    candidates.push(population[Math.floor(Math.random() * population.length)]);
  }
  candidates.sort((a, b) => b.fitness - a.fitness);
  return candidates[0];
}

function singlePointCrossover(parent1: number[], parent2: number[]): number[] {
  const point = Math.floor(Math.random() * parent1.length);
  const child = new Array(parent1.length);
  for (let i = 0; i < parent1.length; i++) {
    child[i] = i < point ? parent1[i] : parent2[i];
  }
  return child;
}

function mutate(genome: number[]): number[] {
  return genome.map(w => {
    if (Math.random() < MUTATION_RATE) {
      // Gaussian-ish noise using Box-Muller
      const u1 = Math.random();
      const u2 = Math.random();
      const noise = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
      return w + noise * MUTATION_STRENGTH;
    }
    return w;
  });
}

export function evolve(
  horses: { genome: number[]; fitness: number; slot: number }[]
): { genome: number[]; slot: number }[] {
  const sorted = [...horses].sort((a, b) => b.fitness - a.fitness);
  const newPopulation: { genome: number[]; slot: number }[] = [];

  // Elitism: keep the top horse unchanged (same slot = same name + sprite)
  for (let i = 0; i < ELITISM_COUNT && i < sorted.length; i++) {
    newPopulation.push({
      genome: [...sorted[i].genome],
      slot: sorted[i].slot,
    });
  }

  // Fill rest with offspring — assign remaining slots
  const usedSlots = new Set(newPopulation.map(p => p.slot));
  const freeSlots = horses.map(h => h.slot).filter(s => !usedSlots.has(s));

  let slotIdx = 0;
  while (newPopulation.length < horses.length) {
    const parent1 = tournamentSelect(sorted);
    const parent2 = tournamentSelect(sorted);
    const childGenome = mutate(singlePointCrossover(parent1.genome, parent2.genome));
    newPopulation.push({
      genome: childGenome,
      slot: freeSlots[slotIdx++],
    });
  }

  return newPopulation;
}
