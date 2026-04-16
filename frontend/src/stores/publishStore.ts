import { create } from 'zustand';

export type DeployMode = 'api' | 'export' | 'docker';
export type ExportFormat = 'safetensors' | 'onnx' | 'int8' | 'fp16';

export interface ExportFile {
  name: string;
  path: string;
  size_mb: number;
  type: string;
}

export interface ServerStatus {
  running: boolean;
  pid?: number;
  config?: {
    host: string;
    port: number;
    model_name: string;
  };
}

interface PublishStore {
  // Selected model + mode
  selectedModel: string;
  deployMode: DeployMode;

  // API server
  serverStatus: ServerStatus;
  serverHost: string;
  serverPort: number;

  // Export
  exportFormat: ExportFormat;
  exportLogs: string[];
  exportFiles: ExportFile[];
  isExporting: boolean;

  // Docker
  dockerfile: string;
  dockerCompose: string;
  dockerGenerated: boolean;

  // Model card
  modelCard: string;
  cardGenerated: boolean;

  // Actions
  setSelectedModel: (name: string) => void;
  setDeployMode: (mode: DeployMode) => void;
  setServerHost: (h: string) => void;
  setServerPort: (p: number) => void;
  setExportFormat: (f: ExportFormat) => void;
  fetchServerStatus: () => Promise<void>;
  startServer: () => Promise<void>;
  stopServer: () => Promise<void>;
  runExport: () => Promise<void>;
  fetchExportFiles: () => Promise<void>;
  generateDocker: () => Promise<void>;
  generateModelCard: () => Promise<void>;
}

const BACKEND = 'http://localhost:8000';

export const usePublishStore = create<PublishStore>((set, get) => ({
  selectedModel: '',
  deployMode: 'api',
  serverStatus: { running: false },
  serverHost: '0.0.0.0',
  serverPort: 8080,
  exportFormat: 'safetensors',
  exportLogs: [],
  exportFiles: [],
  isExporting: false,
  dockerfile: '',
  dockerCompose: '',
  dockerGenerated: false,
  modelCard: '',
  cardGenerated: false,

  setSelectedModel: (name) => set({ selectedModel: name, exportLogs: [], exportFiles: [], dockerGenerated: false, cardGenerated: false }),
  setDeployMode: (mode) => set({ deployMode: mode }),
  setServerHost: (h) => set({ serverHost: h }),
  setServerPort: (p) => set({ serverPort: p }),
  setExportFormat: (f) => set({ exportFormat: f }),

  fetchServerStatus: async () => {
    try {
      const res = await fetch(`${BACKEND}/api/publish/server/status`);
      const data = await res.json();
      set({ serverStatus: data });
    } catch {
      set({ serverStatus: { running: false } });
    }
  },

  startServer: async () => {
    const { selectedModel, serverHost, serverPort } = get();
    try {
      const res = await fetch(`${BACKEND}/api/publish/server/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model_name: selectedModel, host: serverHost, port: serverPort }),
      });
      const data = await res.json();
      if (data.success) {
        set({ serverStatus: { running: true, pid: data.pid, config: { host: serverHost, port: serverPort, model_name: selectedModel } } });
      }
    } catch (e) {
      console.error('Failed to start server', e);
    }
  },

  stopServer: async () => {
    try {
      await fetch(`${BACKEND}/api/publish/server/stop`, { method: 'POST' });
      set({ serverStatus: { running: false } });
    } catch (e) {
      console.error('Failed to stop server', e);
    }
  },

  runExport: async () => {
    const { selectedModel, exportFormat } = get();
    if (!selectedModel) return;
    set({ isExporting: true, exportLogs: [] });
    try {
      const res = await fetch(`${BACKEND}/api/publish/export`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model_name: selectedModel, format: exportFormat }),
      });
      const data = await res.json();
      set({ exportLogs: data.logs ?? [], isExporting: false });
      if (data.success) {
        get().fetchExportFiles();
      }
    } catch (e) {
      set({ exportLogs: [`Error: ${e}`], isExporting: false });
    }
  },

  fetchExportFiles: async () => {
    const { selectedModel } = get();
    if (!selectedModel) return;
    try {
      const res = await fetch(`${BACKEND}/api/publish/export/${selectedModel}/files`);
      const data = await res.json();
      set({ exportFiles: data.files ?? [] });
    } catch {
      set({ exportFiles: [] });
    }
  },

  generateDocker: async () => {
    const { selectedModel } = get();
    if (!selectedModel) return;
    try {
      const res = await fetch(`${BACKEND}/api/publish/docker/${selectedModel}`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        set({ dockerfile: data.dockerfile, dockerCompose: data.docker_compose, dockerGenerated: true });
      }
    } catch (e) {
      console.error('Docker generation failed', e);
    }
  },

  generateModelCard: async () => {
    const { selectedModel } = get();
    if (!selectedModel) return;
    try {
      const res = await fetch(`${BACKEND}/api/publish/model-card/${selectedModel}`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        set({ modelCard: data.content, cardGenerated: true });
      }
    } catch (e) {
      console.error('Model card generation failed', e);
    }
  },
}));
