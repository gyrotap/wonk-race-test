export class NeuralNetwork {
  weights: number[];

  // 10 inputs -> 10 hidden -> 2 outputs
  static readonly INPUT_SIZE = 10;
  static readonly HIDDEN_SIZE = 10;
  static readonly OUTPUT_SIZE = 2;

  static readonly GENOME_LENGTH =
    (NeuralNetwork.INPUT_SIZE * NeuralNetwork.HIDDEN_SIZE) + NeuralNetwork.HIDDEN_SIZE + // input->hidden weights + hidden biases
    (NeuralNetwork.HIDDEN_SIZE * NeuralNetwork.OUTPUT_SIZE) + NeuralNetwork.OUTPUT_SIZE;  // hidden->output weights + output biases

  constructor(weights?: number[]) {
    if (weights) {
      this.weights = [...weights];
    } else {
      // Balanced random weights — enough to move but not saturate tanh
      this.weights = Array.from({ length: NeuralNetwork.GENOME_LENGTH }, () =>
        (Math.random() - 0.5) * 1.0
      );
    }
  }

  forward(inputs: number[]): [number, number] {
    const { INPUT_SIZE, HIDDEN_SIZE, OUTPUT_SIZE } = NeuralNetwork;
    let idx = 0;

    // Hidden layer
    const hidden: number[] = new Array(HIDDEN_SIZE);
    for (let h = 0; h < HIDDEN_SIZE; h++) {
      let sum = 0;
      for (let i = 0; i < INPUT_SIZE; i++) {
        sum += inputs[i] * this.weights[idx++];
      }
      sum += this.weights[idx++]; // bias
      hidden[h] = Math.tanh(sum);
    }

    // Output layer
    const output: number[] = new Array(OUTPUT_SIZE);
    for (let o = 0; o < OUTPUT_SIZE; o++) {
      let sum = 0;
      for (let h = 0; h < HIDDEN_SIZE; h++) {
        sum += hidden[h] * this.weights[idx++];
      }
      sum += this.weights[idx++]; // bias
      output[o] = Math.tanh(sum);
    }

    return [output[0], output[1]];
  }

  clone(): NeuralNetwork {
    return new NeuralNetwork([...this.weights]);
  }
}
