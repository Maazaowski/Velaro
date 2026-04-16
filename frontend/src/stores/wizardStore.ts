import { create } from 'zustand';

export type UseCase = 'text-generation' | 'code' | 'qa' | 'summarization' | 'chat';
export type Architecture = 'transformer' | 'rnn-lstm' | 'mamba-ssm';
export type Optimizer = 'adamw' | 'adam' | 'sgd';
export type Scheduler = 'cosine' | 'linear' | 'constant';
export type Precision = 'fp32' | 'fp16' | 'bf16';
export type DatasetSource = 'local' | 'huggingface' | 'paste';
export type Tokenizer = 'bpe' | 'sentencepiece' | 'custom';

export interface WizardState {
  currentStep: number;

  // Step 1: Basics
  modelName: string;
  description: string;
  useCase: UseCase;

  // Step 2: Architecture
  architecture: Architecture;

  // Step 3: Model Config
  hiddenSize: number;
  numLayers: number;
  numAttentionHeads: number;
  vocabSize: number;
  contextLength: number;
  intermediateSize: number;

  // Step 4: Dataset
  datasetSource: DatasetSource;
  datasetPath: string;
  huggingfaceId: string;
  pasteText: string;
  tokenizer: Tokenizer;

  // Step 5: Hyperparameters
  optimizer: Optimizer;
  learningRate: number;
  scheduler: Scheduler;
  batchSize: number;
  epochs: number;
  warmupSteps: number;
  weightDecay: number;
  gradientAccumulation: number;
  precision: Precision;

  // Actions
  setStep: (step: number) => void;
  nextStep: () => void;
  prevStep: () => void;
  update: (fields: Partial<WizardState>) => void;
  reset: () => void;
}

const initialState = {
  currentStep: 1,
  modelName: '',
  description: '',
  useCase: 'text-generation' as UseCase,
  architecture: 'transformer' as Architecture,
  hiddenSize: 768,
  numLayers: 12,
  numAttentionHeads: 12,
  vocabSize: 50257,
  contextLength: 1024,
  intermediateSize: 3072,
  datasetSource: 'huggingface' as DatasetSource,
  datasetPath: '',
  huggingfaceId: '',
  pasteText: '',
  tokenizer: 'bpe' as Tokenizer,
  optimizer: 'adamw' as Optimizer,
  learningRate: 3e-4,
  scheduler: 'cosine' as Scheduler,
  batchSize: 32,
  epochs: 10,
  warmupSteps: 2000,
  weightDecay: 0.01,
  gradientAccumulation: 4,
  precision: 'fp16' as Precision,
};

export const useWizardStore = create<WizardState>((set) => ({
  ...initialState,
  setStep: (step) => set({ currentStep: step }),
  nextStep: () => set((s) => ({ currentStep: Math.min(s.currentStep + 1, 6) })),
  prevStep: () => set((s) => ({ currentStep: Math.max(s.currentStep - 1, 1) })),
  update: (fields) => set(fields),
  reset: () => set(initialState),
}));

// Utility: estimate parameter count
export function estimateParams(state: Pick<WizardState, 'hiddenSize' | 'numLayers' | 'intermediateSize' | 'vocabSize' | 'contextLength'>): number {
  const { hiddenSize, numLayers, intermediateSize, vocabSize, contextLength } = state;
  const embedding = vocabSize * hiddenSize + contextLength * hiddenSize;
  const attention = numLayers * (4 * hiddenSize * hiddenSize + 4 * hiddenSize);
  const ffn = numLayers * (2 * hiddenSize * intermediateSize + intermediateSize + hiddenSize);
  const layerNorm = numLayers * 4 * hiddenSize;
  const head = hiddenSize * vocabSize;
  return embedding + attention + ffn + layerNorm + head;
}

export function formatParams(count: number): string {
  if (count >= 1e9) return `${(count / 1e9).toFixed(1)}B`;
  if (count >= 1e6) return `${(count / 1e6).toFixed(0)}M`;
  if (count >= 1e3) return `${(count / 1e3).toFixed(0)}K`;
  return `${count}`;
}

export function estimateModelSizeMB(params: number, precision: Precision): number {
  const bytesPerParam = precision === 'fp32' ? 4 : 2;
  return Math.round((params * bytesPerParam) / (1024 * 1024));
}

export function estimateVramTrainingGB(params: number): number {
  // Rough: ~20 bytes per param for training (model + gradients + optimizer states + activations)
  return parseFloat(((params * 20) / (1024 ** 3)).toFixed(1));
}

export function estimateVramInferenceGB(params: number, precision: Precision): number {
  const bytesPerParam = precision === 'fp32' ? 4 : 2;
  return parseFloat(((params * bytesPerParam * 1.2) / (1024 ** 3)).toFixed(1));
}
