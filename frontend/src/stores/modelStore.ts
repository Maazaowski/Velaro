import { create } from 'zustand';

export interface VelaroModel {
  name: string;
  architecture: string;
  status: 'draft' | 'training' | 'ready' | 'published';
  hidden_size?: number;
  num_layers?: number;
  num_attention_heads?: number;
  vocab_size?: number;
  context_length?: number;
  train_loss?: number;
  val_loss?: number;
  source?: string;
  model_id?: string;
  base_model?: string;
  lora_rank?: number;
}

interface ModelStore {
  models: VelaroModel[];
  isLoading: boolean;
  importProgress: string;
  error: string;
  fetchModels: () => Promise<void>;
  deleteModel: (name: string) => Promise<boolean>;
  renameModel: (name: string, newName: string) => Promise<boolean>;
  cloneModel: (name: string, newName: string) => Promise<boolean>;
  importFromHuggingFace: (modelId: string, localName: string) => Promise<boolean>;
  importLocal: (filePath: string, modelName: string, architecture: string) => Promise<boolean>;
  updateStatus: (name: string, status: VelaroModel['status']) => Promise<boolean>;
}

const BACKEND = 'http://localhost:8000';

export const useModelStore = create<ModelStore>((set, get) => ({
  models: [],
  isLoading: false,
  importProgress: '',
  error: '',

  fetchModels: async () => {
    set({ isLoading: true, error: '' });
    try {
      const res = await fetch(`${BACKEND}/api/system/models`);
      const data = await res.json();
      set({ models: data.models ?? [], isLoading: false });
    } catch {
      set({ isLoading: false, error: 'Backend offline — showing demo data' });
    }
  },

  deleteModel: async (name) => {
    try {
      const res = await fetch(
        `${BACKEND}/api/system/models/${encodeURIComponent(name)}`,
        { method: 'DELETE' }
      );
      const data = await res.json();
      if (data.success) {
        set((s) => ({ models: s.models.filter((m) => m.name !== name) }));
        return true;
      }
      set({ error: data.error ?? 'Delete failed' });
    } catch {
      set({ error: 'Backend offline' });
    }
    return false;
  },

  renameModel: async (name, newName) => {
    try {
      const res = await fetch(
        `${BACKEND}/api/system/models/${encodeURIComponent(name)}/rename`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ new_name: newName }),
        }
      );
      const data = await res.json();
      if (data.success) {
        await get().fetchModels();
        return true;
      }
      set({ error: data.error ?? 'Rename failed' });
    } catch {
      set({ error: 'Backend offline' });
    }
    return false;
  },

  cloneModel: async (name, newName) => {
    try {
      const res = await fetch(
        `${BACKEND}/api/system/models/${encodeURIComponent(name)}/clone`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ new_name: newName }),
        }
      );
      const data = await res.json();
      if (data.success) {
        await get().fetchModels();
        return true;
      }
      set({ error: data.error ?? 'Clone failed' });
    } catch {
      set({ error: 'Backend offline' });
    }
    return false;
  },

  importFromHuggingFace: async (modelId, localName) => {
    set({ importProgress: `Downloading ${modelId} from HuggingFace…` });
    try {
      const res = await fetch(`${BACKEND}/api/system/models/import/huggingface`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model_id: modelId, local_name: localName }),
      });
      const data = await res.json();
      if (data.success) {
        set({ importProgress: '✓ Import complete' });
        await get().fetchModels();
        return true;
      }
      set({ importProgress: `Error: ${data.error}` });
    } catch (e) {
      set({ importProgress: `Error: ${e}` });
    }
    return false;
  },

  importLocal: async (filePath, modelName, architecture) => {
    set({ importProgress: `Importing ${modelName}…` });
    try {
      const res = await fetch(`${BACKEND}/api/system/models/import/local`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ file_path: filePath, model_name: modelName, architecture }),
      });
      const data = await res.json();
      if (data.success) {
        set({ importProgress: '✓ Import complete' });
        await get().fetchModels();
        return true;
      }
      set({ importProgress: `Error: ${data.error}` });
    } catch (e) {
      set({ importProgress: `Error: ${e}` });
    }
    return false;
  },

  updateStatus: async (name, status) => {
    try {
      const res = await fetch(
        `${BACKEND}/api/system/models/${encodeURIComponent(name)}/status`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status }),
        }
      );
      const data = await res.json();
      if (data.success) {
        set((s) => ({
          models: s.models.map((m) => (m.name === name ? { ...m, status } : m)),
        }));
        return true;
      }
    } catch { /* noop */ }
    return false;
  },
}));
