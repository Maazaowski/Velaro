import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface AppSettings {
  // Compute
  device: 'auto' | 'cpu' | 'cuda' | 'mps';
  precision: 'fp32' | 'fp16' | 'bf16';
  maxGpuMemoryPercent: number;
  // General
  autoSaveInterval: number;
  logLevel: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';
  modelsDir: string;
  exportsDir: string;
  // Notifications
  notifyTrainingComplete: boolean;
  notifyErrors: boolean;
  // Appearance
  theme: 'dark' | 'light';
}

interface SettingsStore extends AppSettings {
  isSaving: boolean;
  isLoaded: boolean;
  updateSetting: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => void;
  saveSettings: () => Promise<void>;
  loadSettings: () => Promise<void>;
  resetToDefaults: () => void;
}

const BACKEND = 'http://localhost:8000';

const defaults: AppSettings = {
  device: 'auto',
  precision: 'fp16',
  maxGpuMemoryPercent: 90,
  autoSaveInterval: 5,
  logLevel: 'INFO',
  modelsDir: './models',
  exportsDir: './exports',
  notifyTrainingComplete: true,
  notifyErrors: true,
  theme: 'dark',
};

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set, get) => ({
      ...defaults,
      isSaving: false,
      isLoaded: false,

      updateSetting: (key, value) =>
        set({ [key]: value } as Partial<SettingsStore>),

      saveSettings: async () => {
        set({ isSaving: true });
        const s = get();
        const payload = {
          device: s.device,
          precision: s.precision,
          max_gpu_memory_percent: s.maxGpuMemoryPercent,
          auto_save_interval: s.autoSaveInterval,
          log_level: s.logLevel,
          models_dir: s.modelsDir,
          exports_dir: s.exportsDir,
          notify_training_complete: s.notifyTrainingComplete,
          notify_errors: s.notifyErrors,
          theme: s.theme,
        };
        try {
          await fetch(`${BACKEND}/api/settings`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });
        } catch {
          // offline — persisted locally via zustand/persist
        }
        set({ isSaving: false });
      },

      loadSettings: async () => {
        try {
          const res = await fetch(`${BACKEND}/api/settings`);
          if (!res.ok) throw new Error('non-ok');
          const d = await res.json();
          set({
            device: d.device ?? defaults.device,
            precision: d.precision ?? defaults.precision,
            maxGpuMemoryPercent: d.max_gpu_memory_percent ?? defaults.maxGpuMemoryPercent,
            autoSaveInterval: d.auto_save_interval ?? defaults.autoSaveInterval,
            logLevel: d.log_level ?? defaults.logLevel,
            modelsDir: d.models_dir ?? defaults.modelsDir,
            exportsDir: d.exports_dir ?? defaults.exportsDir,
            notifyTrainingComplete: d.notify_training_complete ?? defaults.notifyTrainingComplete,
            notifyErrors: d.notify_errors ?? defaults.notifyErrors,
            theme: d.theme ?? defaults.theme,
            isLoaded: true,
          });
        } catch {
          set({ isLoaded: true });
        }
      },

      resetToDefaults: () => set({ ...defaults }),
    }),
    { name: 'velaro-settings' }
  )
);
