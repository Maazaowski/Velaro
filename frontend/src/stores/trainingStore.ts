import { create } from 'zustand';

export interface TrainingMetrics {
  model_name: string;
  status: 'idle' | 'running' | 'paused' | 'completed' | 'failed' | 'stopping' | 'stopped';
  epoch: number;
  total_epochs: number;
  step: number;
  total_steps: number;
  progress_pct: number;
  train_loss: number;
  val_loss: number | null;
  best_val_loss: number | null;
  learning_rate: number;
  grad_norm: number;
  tokens_per_second: number;
  elapsed_seconds: number;
  eta_seconds: number;
  gpu_temp: number | null;
  gpu_utilization: number | null;
  vram_used_gb: number | null;
  cpu_percent: number;
  ram_percent: number;
  log_lines: string[];
  error: string | null;
}

export interface MetricPoint {
  step: number;
  train_loss: number;
  val_loss: number | null;
  learning_rate: number;
}

export interface ResourcePoint {
  step: number;
  cpu: number;
  ram: number;
  gpu: number | null;
  vram: number | null;
}

const defaultMetrics: TrainingMetrics = {
  model_name: '',
  status: 'idle',
  epoch: 0,
  total_epochs: 0,
  step: 0,
  total_steps: 0,
  progress_pct: 0,
  train_loss: 0,
  val_loss: null,
  best_val_loss: null,
  learning_rate: 0,
  grad_norm: 0,
  tokens_per_second: 0,
  elapsed_seconds: 0,
  eta_seconds: 0,
  gpu_temp: null,
  gpu_utilization: null,
  vram_used_gb: null,
  cpu_percent: 0,
  ram_percent: 0,
  log_lines: [],
  error: null,
};

interface TrainingStore {
  metrics: TrainingMetrics;
  lossHistory: MetricPoint[];
  resourceHistory: ResourcePoint[];
  ws: WebSocket | null;
  activeModel: string | null;

  connect: (modelName: string) => void;
  disconnect: () => void;
  setMetrics: (m: TrainingMetrics) => void;
  reset: () => void;
}

const MAX_HISTORY = 500;

export const useTrainingStore = create<TrainingStore>((set, get) => ({
  metrics: defaultMetrics,
  lossHistory: [],
  resourceHistory: [],
  ws: null,
  activeModel: null,

  connect: (modelName: string) => {
    const existing = get().ws;
    if (existing) existing.close();

    const ws = new WebSocket(`ws://localhost:8000/api/training/ws/${modelName}`);

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as TrainingMetrics;
        if ('ping' in data) return;

        const prev = get().metrics;
        set({ metrics: data });

        // Append to history only when step advances
        if (data.step > prev.step) {
          const lossPoint: MetricPoint = {
            step: data.step,
            train_loss: data.train_loss,
            val_loss: data.val_loss,
            learning_rate: data.learning_rate,
          };
          const resPoint: ResourcePoint = {
            step: data.step,
            cpu: data.cpu_percent,
            ram: data.ram_percent,
            gpu: data.gpu_utilization,
            vram: data.vram_used_gb,
          };
          set((s) => ({
            lossHistory: [...s.lossHistory, lossPoint].slice(-MAX_HISTORY),
            resourceHistory: [...s.resourceHistory, resPoint].slice(-MAX_HISTORY),
          }));
        }
      } catch {
        // ignore malformed messages
      }
    };

    ws.onerror = () => {
      console.warn('Training WebSocket error');
    };

    ws.onclose = () => {
      set({ ws: null });
    };

    set({ ws, activeModel: modelName });
  },

  disconnect: () => {
    const ws = get().ws;
    if (ws) ws.close();
    set({ ws: null, activeModel: null });
  },

  setMetrics: (m) => set({ metrics: m }),

  reset: () => set({
    metrics: defaultMetrics,
    lossHistory: [],
    resourceHistory: [],
    activeModel: null,
  }),
}));

// Helpers
export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${Math.round(seconds % 60)}s`;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}h ${m}m`;
}

export function formatLR(lr: number): string {
  if (lr === 0) return '0';
  return lr.toExponential(1);
}
