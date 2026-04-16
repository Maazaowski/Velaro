import { create } from 'zustand';

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  metrics?: ResponseMetrics;
}

export interface ResponseMetrics {
  totalTokens: number;
  tokensPerSecond: number;
  latencyMs: number;
  perplexity: number | null;
  elapsedMs: number;
}

export interface GenerationSettings {
  temperature: number;
  topP: number;
  topK: number;
  maxNewTokens: number;
  repetitionPenalty: number;
}

export interface AvailableModel {
  name: string;
  status: string;
  train_loss: number | null;
  val_loss: number | null;
  step: number | null;
  loaded: boolean;
}

const BACKEND_WS = 'ws://localhost:8000/api/inference/ws/generate';
const BACKEND_HTTP = 'http://localhost:8000';

const defaultSettings: GenerationSettings = {
  temperature: 0.7,
  topP: 0.9,
  topK: 50,
  maxNewTokens: 256,
  repetitionPenalty: 1.1,
};

interface PlaygroundStore {
  // Chat
  messages: Message[];
  isGenerating: boolean;
  selectedModel: string;
  availableModels: AvailableModel[];

  // Settings
  settings: GenerationSettings;

  // Benchmark
  benchmarkResults: BenchmarkResult[];
  isBenchmarking: boolean;

  // Actions
  fetchModels: () => Promise<void>;
  selectModel: (name: string) => void;
  sendMessage: (content: string) => Promise<void>;
  clearChat: () => void;
  updateSettings: (s: Partial<GenerationSettings>) => void;
  applyPreset: (preset: 'creative' | 'balanced' | 'precise') => void;
  runBenchmark: () => Promise<void>;
}

export interface BenchmarkResult {
  prompt: string;
  response: string;
  metrics: ResponseMetrics;
}

const BENCHMARK_PROMPTS = [
  'Once upon a time in a land far away,',
  'The capital of France is',
  'def fibonacci(n):',
  'The main difference between supervised and unsupervised learning is',
  'To make a cup of tea, you need to',
];

let _ws: WebSocket | null = null;

export const usePlaygroundStore = create<PlaygroundStore>((set, get) => ({
  messages: [],
  isGenerating: false,
  selectedModel: '',
  availableModels: [],
  settings: defaultSettings,
  benchmarkResults: [],
  isBenchmarking: false,

  fetchModels: async () => {
    try {
      const res = await fetch(`${BACKEND_HTTP}/api/inference/models`);
      const data = await res.json();
      const models: AvailableModel[] = data.models ?? [];
      set({ availableModels: models });
      // Auto-select first model
      if (models.length > 0 && !get().selectedModel) {
        set({ selectedModel: models[0].name });
      }
    } catch {
      // Backend not running — use demo models
      const demo: AvailableModel[] = [
        { name: 'CodeAssist-125M', status: 'ready', train_loss: 1.82, val_loss: 2.01, step: 12000, loaded: false },
        { name: 'TextGen-350M', status: 'ready', train_loss: 2.34, val_loss: 2.51, step: 8000, loaded: false },
      ];
      set({ availableModels: demo, selectedModel: demo[0].name });
    }
  },

  selectModel: (name) => set({ selectedModel: name, messages: [] }),

  sendMessage: async (content: string) => {
    const { selectedModel, settings, messages } = get();
    if (!selectedModel || !content.trim()) return;

    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content,
      timestamp: new Date(),
    };

    const assistantId = crypto.randomUUID();
    const assistantMsg: Message = {
      id: assistantId,
      role: 'assistant',
      content: '',
      timestamp: new Date(),
    };

    set({ messages: [...messages, userMsg, assistantMsg], isGenerating: true });

    // Build prompt from conversation history
    const prompt = [...messages, userMsg]
      .map((m) => (m.role === 'user' ? `User: ${m.content}` : `Assistant: ${m.content}`))
      .join('\n') + '\nAssistant:';

    const startTime = Date.now();
    let totalTokens = 0;
    let latencyMs = 0;
    let tokensPerSecond = 0;
    let perplexity: number | null = null;
    let generatedText = '';

    try {
      if (_ws) _ws.close();
      _ws = new WebSocket(BACKEND_WS);

      await new Promise<void>((resolve, reject) => {
        _ws!.onopen = () => {
          _ws!.send(JSON.stringify({
            model_name: selectedModel,
            prompt,
            max_new_tokens: settings.maxNewTokens,
            temperature: settings.temperature,
            top_k: settings.topK,
            top_p: settings.topP,
            repetition_penalty: settings.repetitionPenalty,
          }));
        };

        _ws!.onmessage = (e) => {
          const chunk = JSON.parse(e.data);
          if (chunk.error) { reject(new Error(chunk.error)); return; }

          generatedText += chunk.token ?? '';
          totalTokens = chunk.total_tokens ?? totalTokens + 1;
          tokensPerSecond = chunk.tokens_per_second ?? tokensPerSecond;
          if (chunk.latency_ms != null) latencyMs = chunk.latency_ms;
          if (chunk.perplexity != null) perplexity = chunk.perplexity;

          // Update assistant message in real-time
          set((s) => ({
            messages: s.messages.map((m) =>
              m.id === assistantId ? { ...m, content: generatedText } : m
            ),
          }));

          if (chunk.done) resolve();
        };

        _ws!.onerror = () => reject(new Error('WebSocket error'));
        _ws!.onclose = () => resolve();
      });
    } catch (err) {
      // Fallback: show error in chat
      generatedText = `[Error: ${err instanceof Error ? err.message : 'Generation failed. Is the backend running?'}]`;
      set((s) => ({
        messages: s.messages.map((m) =>
          m.id === assistantId ? { ...m, content: generatedText } : m
        ),
      }));
    }

    const elapsed = Date.now() - startTime;
    const finalMetrics: ResponseMetrics = {
      totalTokens,
      tokensPerSecond,
      latencyMs,
      perplexity,
      elapsedMs: elapsed,
    };

    set((s) => ({
      isGenerating: false,
      messages: s.messages.map((m) =>
        m.id === assistantId ? { ...m, metrics: finalMetrics } : m
      ),
    }));
  },

  clearChat: () => set({ messages: [] }),

  updateSettings: (s) => set((prev) => ({ settings: { ...prev.settings, ...s } })),

  applyPreset: (preset) => {
    const presets: Record<string, GenerationSettings> = {
      creative:  { temperature: 1.1, topP: 0.95, topK: 80,  maxNewTokens: 400, repetitionPenalty: 1.05 },
      balanced:  { temperature: 0.7, topP: 0.9,  topK: 50,  maxNewTokens: 256, repetitionPenalty: 1.1  },
      precise:   { temperature: 0.2, topP: 0.7,  topK: 20,  maxNewTokens: 128, repetitionPenalty: 1.2  },
    };
    set({ settings: presets[preset] });
  },

  runBenchmark: async () => {
    const { selectedModel, settings } = get();
    if (!selectedModel) return;
    set({ isBenchmarking: true, benchmarkResults: [] });

    const results: BenchmarkResult[] = [];
    for (const prompt of BENCHMARK_PROMPTS) {
      try {
        const res = await fetch(`${BACKEND_HTTP}/api/inference/generate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model_name: selectedModel,
            prompt,
            max_new_tokens: 80,
            temperature: settings.temperature,
            top_k: settings.topK,
            top_p: settings.topP,
            repetition_penalty: settings.repetitionPenalty,
          }),
        });
        const data = await res.json();
        results.push({
          prompt,
          response: data.text ?? '',
          metrics: {
            totalTokens: data.total_tokens ?? 0,
            tokensPerSecond: data.tokens_per_second ?? 0,
            latencyMs: data.latency_ms ?? 0,
            perplexity: data.perplexity ?? null,
            elapsedMs: data.elapsed_ms ?? 0,
          },
        });
        set({ benchmarkResults: [...results] });
      } catch {
        results.push({ prompt, response: '[Error]', metrics: { totalTokens: 0, tokensPerSecond: 0, latencyMs: 0, perplexity: null, elapsedMs: 0 } });
      }
    }
    set({ isBenchmarking: false });
  },
}));
