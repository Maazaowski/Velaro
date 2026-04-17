import { useState, useEffect } from 'react';
import {
  Cpu,
  FolderOpen,
  Bell,
  Palette,
  Download,
  Zap,
  Save,
  RotateCcw,
  CheckCircle,
  Loader,
} from 'lucide-react';
import Topbar from '../components/Topbar';
import { useSettingsStore } from '../stores/settingsStore';
import { useModelStore } from '../stores/modelStore';
import './settings/Settings.css';

type Category = 'compute' | 'general' | 'notifications' | 'appearance' | 'import' | 'finetune';

const categories: { id: Category; label: string; icon: React.ReactNode }[] = [
  { id: 'compute',       label: 'Compute',        icon: <Cpu size={14} /> },
  { id: 'general',       label: 'General',         icon: <FolderOpen size={14} /> },
  { id: 'notifications', label: 'Notifications',   icon: <Bell size={14} /> },
  { id: 'appearance',    label: 'Appearance',      icon: <Palette size={14} /> },
  { id: 'import',        label: 'Import Model',    icon: <Download size={14} /> },
  { id: 'finetune',      label: 'Fine-Tune',       icon: <Zap size={14} /> },
];

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<Category>('compute');
  const [saved, setSaved] = useState(false);

  const settings = useSettingsStore();
  const { models, fetchModels, importFromHuggingFace, importLocal, importProgress } = useModelStore();

  // Import tab state
  const [importTab, setImportTab] = useState<'hf' | 'local'>('hf');
  const [hfModelId, setHfModelId] = useState('');
  const [hfLocalName, setHfLocalName] = useState('');
  const [localFilePath, setLocalFilePath] = useState('');
  const [localModelName, setLocalModelName] = useState('');
  const [localArchitecture, setLocalArchitecture] = useState('transformer');

  // Fine-tune state
  const [ftBaseModel, setFtBaseModel] = useState('');
  const [ftNewName, setFtNewName] = useState('');
  const [ftDatasetSource, setFtDatasetSource] = useState('paste');
  const [ftDatasetValue, setFtDatasetValue] = useState('');
  const [ftLoraRank, setFtLoraRank] = useState(8);
  const [ftLoraAlpha, setFtLoraAlpha] = useState(16);
  const [ftLR, setFtLR] = useState(0.0002);
  const [ftEpochs, setFtEpochs] = useState(3);
  const [ftStatus, setFtStatus] = useState('');

  useEffect(() => {
    settings.loadSettings();
    fetchModels();
  }, []);

  const handleSave = async () => {
    await settings.saveSettings();
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const handleHfImport = async () => {
    if (!hfModelId || !hfLocalName) return;
    await importFromHuggingFace(hfModelId, hfLocalName);
  };

  const handleLocalImport = async () => {
    if (!localFilePath || !localModelName) return;
    await importLocal(localFilePath, localModelName, localArchitecture);
  };

  const handleFinetune = async () => {
    if (!ftBaseModel || !ftNewName) return;
    setFtStatus('Starting fine-tune…');
    try {
      const res = await fetch('http://localhost:8000/api/finetune/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          base_model: ftBaseModel,
          new_model_name: ftNewName,
          dataset_source: ftDatasetSource,
          dataset_value: ftDatasetValue,
          lora_rank: ftLoraRank,
          lora_alpha: ftLoraAlpha,
          learning_rate: ftLR,
          epochs: ftEpochs,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setFtStatus(`✓ Fine-tune started — ${data.lora_params?.toLocaleString()} LoRA params`);
      } else {
        setFtStatus(`Error: ${data.error}`);
      }
    } catch {
      setFtStatus('Error: backend offline');
    }
  };

  const Toggle = ({
    checked,
    onChange,
  }: {
    checked: boolean;
    onChange: (v: boolean) => void;
  }) => (
    <label className="toggle-wrap">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="toggle-track" />
    </label>
  );

  return (
    <>
      <Topbar title="Settings" subtitle="Configure Velaro preferences" />
      <div className="settings-layout">
        {/* Left nav */}
        <nav className="settings-nav">
          <div className="settings-nav-title">Preferences</div>
          {categories.map((cat) => (
            <div
              key={cat.id}
              className={`settings-nav-item ${activeTab === cat.id ? 'active' : ''}`}
              onClick={() => setActiveTab(cat.id)}
            >
              {cat.icon}
              {cat.label}
            </div>
          ))}
        </nav>

        {/* Content */}
        <div className="settings-content">

          {/* ── Compute ── */}
          <div className={`settings-section ${activeTab === 'compute' ? 'active' : ''}`}>
            <div className="settings-section-title">Compute</div>
            <div className="settings-section-desc">Hardware and precision preferences for training and inference.</div>

            <div className="settings-group">
              <div className="settings-group-label">Device</div>
              <div className="settings-row">
                <div className="settings-row-left">
                  <div className="settings-label">Training Device</div>
                  <div className="settings-sublabel">auto detects CUDA → MPS → CPU</div>
                </div>
                <select
                  className="settings-select"
                  value={settings.device}
                  onChange={(e) => settings.updateSetting('device', e.target.value as 'auto' | 'cpu' | 'cuda' | 'mps')}
                >
                  <option value="auto">Auto Detect</option>
                  <option value="cuda">CUDA (NVIDIA)</option>
                  <option value="mps">MPS (Apple)</option>
                  <option value="cpu">CPU Only</option>
                </select>
              </div>
              <div className="settings-row">
                <div className="settings-row-left">
                  <div className="settings-label">Precision</div>
                  <div className="settings-sublabel">FP16 / BF16 require CUDA or MPS</div>
                </div>
                <select
                  className="settings-select"
                  value={settings.precision}
                  onChange={(e) => settings.updateSetting('precision', e.target.value as 'fp32' | 'fp16' | 'bf16')}
                >
                  <option value="fp32">FP32 — Full</option>
                  <option value="fp16">FP16 — Mixed (faster)</option>
                  <option value="bf16">BF16 — Brain Float</option>
                </select>
              </div>
            </div>

            <div className="settings-group">
              <div className="settings-group-label">Memory</div>
              <div className="settings-row">
                <div className="settings-row-left">
                  <div className="settings-label">Max GPU Memory Usage</div>
                  <div className="settings-sublabel">Reserve headroom for the OS</div>
                </div>
                <div className="settings-slider-row">
                  <input
                    type="range" min={50} max={100} step={5}
                    className="settings-slider"
                    value={settings.maxGpuMemoryPercent}
                    onChange={(e) => settings.updateSetting('maxGpuMemoryPercent', Number(e.target.value))}
                  />
                  <span className="settings-slider-value">{settings.maxGpuMemoryPercent}%</span>
                </div>
              </div>
            </div>

            <div className="settings-actions">
              <button className="settings-save-btn" onClick={handleSave} disabled={settings.isSaving}>
                {settings.isSaving ? <Loader size={14} className="spin" /> : <Save size={14} />}
                Save Changes
              </button>
              <button className="settings-reset-btn" onClick={settings.resetToDefaults}>
                <RotateCcw size={14} /> Reset to Defaults
              </button>
              {saved && (
                <span className="settings-saved-badge">
                  <CheckCircle size={14} /> Saved
                </span>
              )}
            </div>
          </div>

          {/* ── General ── */}
          <div className={`settings-section ${activeTab === 'general' ? 'active' : ''}`}>
            <div className="settings-section-title">General</div>
            <div className="settings-section-desc">File paths, auto-save, and logging.</div>

            <div className="settings-group">
              <div className="settings-group-label">Auto-Save</div>
              <div className="settings-row">
                <div className="settings-row-left">
                  <div className="settings-label">Checkpoint Interval</div>
                  <div className="settings-sublabel">Minutes between auto-saves during training</div>
                </div>
                <input
                  type="number" min={1} max={60}
                  className="settings-number"
                  value={settings.autoSaveInterval}
                  onChange={(e) => settings.updateSetting('autoSaveInterval', Number(e.target.value))}
                />
              </div>
            </div>

            <div className="settings-group">
              <div className="settings-group-label">Logging</div>
              <div className="settings-row">
                <div className="settings-row-left">
                  <div className="settings-label">Log Level</div>
                  <div className="settings-sublabel">Verbosity of backend log output</div>
                </div>
                <select
                  className="settings-select"
                  value={settings.logLevel}
                  onChange={(e) => settings.updateSetting('logLevel', e.target.value as 'DEBUG' | 'INFO' | 'WARN' | 'ERROR')}
                >
                  <option value="DEBUG">Debug</option>
                  <option value="INFO">Info</option>
                  <option value="WARN">Warning</option>
                  <option value="ERROR">Error Only</option>
                </select>
              </div>
            </div>

            <div className="settings-group">
              <div className="settings-group-label">Directories</div>
              <div className="settings-row">
                <div className="settings-row-left">
                  <div className="settings-label">Models Directory</div>
                  <div className="settings-sublabel">Where model checkpoints are stored</div>
                </div>
                <input
                  className="settings-input"
                  value={settings.modelsDir}
                  onChange={(e) => settings.updateSetting('modelsDir', e.target.value)}
                />
              </div>
              <div className="settings-row">
                <div className="settings-row-left">
                  <div className="settings-label">Exports Directory</div>
                  <div className="settings-sublabel">Where exported model files are placed</div>
                </div>
                <input
                  className="settings-input"
                  value={settings.exportsDir}
                  onChange={(e) => settings.updateSetting('exportsDir', e.target.value)}
                />
              </div>
            </div>

            <div className="settings-actions">
              <button className="settings-save-btn" onClick={handleSave} disabled={settings.isSaving}>
                {settings.isSaving ? <Loader size={14} className="spin" /> : <Save size={14} />}
                Save Changes
              </button>
              <button className="settings-reset-btn" onClick={settings.resetToDefaults}>
                <RotateCcw size={14} /> Reset
              </button>
              {saved && <span className="settings-saved-badge"><CheckCircle size={14} /> Saved</span>}
            </div>
          </div>

          {/* ── Notifications ── */}
          <div className={`settings-section ${activeTab === 'notifications' ? 'active' : ''}`}>
            <div className="settings-section-title">Notifications</div>
            <div className="settings-section-desc">Desktop alerts for training events.</div>

            <div className="settings-group">
              <div className="settings-group-label">Events</div>
              <div className="settings-row">
                <div className="settings-row-left">
                  <div className="settings-label">Training Complete</div>
                  <div className="settings-sublabel">Alert when a training run finishes</div>
                </div>
                <Toggle
                  checked={settings.notifyTrainingComplete}
                  onChange={(v) => settings.updateSetting('notifyTrainingComplete', v)}
                />
              </div>
              <div className="settings-row">
                <div className="settings-row-left">
                  <div className="settings-label">Errors & Failures</div>
                  <div className="settings-sublabel">Alert when training fails or crashes</div>
                </div>
                <Toggle
                  checked={settings.notifyErrors}
                  onChange={(v) => settings.updateSetting('notifyErrors', v)}
                />
              </div>
            </div>

            <div className="settings-actions">
              <button className="settings-save-btn" onClick={handleSave} disabled={settings.isSaving}>
                {settings.isSaving ? <Loader size={14} className="spin" /> : <Save size={14} />}
                Save Changes
              </button>
              {saved && <span className="settings-saved-badge"><CheckCircle size={14} /> Saved</span>}
            </div>
          </div>

          {/* ── Appearance ── */}
          <div className={`settings-section ${activeTab === 'appearance' ? 'active' : ''}`}>
            <div className="settings-section-title">Appearance</div>
            <div className="settings-section-desc">Visual theme preferences.</div>

            <div className="settings-group">
              <div className="settings-group-label">Theme</div>
              <div className="settings-row">
                <div className="settings-row-left">
                  <div className="settings-label">Color Theme</div>
                  <div className="settings-sublabel">Light theme coming in a future update</div>
                </div>
                <select
                  className="settings-select"
                  value={settings.theme}
                  onChange={(e) => settings.updateSetting('theme', e.target.value as 'dark' | 'light')}
                >
                  <option value="dark">Dark (Default)</option>
                  <option value="light">Light (Beta)</option>
                </select>
              </div>
            </div>

            <div className="settings-actions">
              <button className="settings-save-btn" onClick={handleSave} disabled={settings.isSaving}>
                {settings.isSaving ? <Loader size={14} className="spin" /> : <Save size={14} />}
                Save Changes
              </button>
              {saved && <span className="settings-saved-badge"><CheckCircle size={14} /> Saved</span>}
            </div>
          </div>

          {/* ── Import Model ── */}
          <div className={`settings-section ${activeTab === 'import' ? 'active' : ''}`}>
            <div className="settings-section-title">Import Model</div>
            <div className="settings-section-desc">
              Bring in models from HuggingFace Hub or a local checkpoint file.
            </div>

            <div className="import-panel">
              <div className="import-tabs">
                <button
                  className={`import-tab ${importTab === 'hf' ? 'active' : ''}`}
                  onClick={() => setImportTab('hf')}
                >
                  HuggingFace Hub
                </button>
                <button
                  className={`import-tab ${importTab === 'local' ? 'active' : ''}`}
                  onClick={() => setImportTab('local')}
                >
                  Local File
                </button>
              </div>

              <div className={`import-body ${importTab === 'hf' ? 'active' : ''}`}>
                <div className="import-field">
                  <label>HuggingFace Model ID</label>
                  <input
                    placeholder="e.g. gpt2, mistralai/Mistral-7B-v0.1"
                    value={hfModelId}
                    onChange={(e) => setHfModelId(e.target.value)}
                  />
                </div>
                <div className="import-field">
                  <label>Local Name</label>
                  <input
                    placeholder="e.g. my-gpt2"
                    value={hfLocalName}
                    onChange={(e) => setHfLocalName(e.target.value)}
                  />
                </div>
                <button
                  className="settings-save-btn"
                  onClick={handleHfImport}
                  disabled={!hfModelId || !hfLocalName}
                >
                  <Download size={14} /> Import from HuggingFace
                </button>
                {importProgress && (
                  <div className={`import-progress ${importProgress.startsWith('✓') ? 'success' : importProgress.startsWith('Error') ? 'error' : ''}`}>
                    {importProgress}
                  </div>
                )}
              </div>

              <div className={`import-body ${importTab === 'local' ? 'active' : ''}`}>
                <div className="import-field">
                  <label>Checkpoint File Path</label>
                  <input
                    placeholder="C:\path\to\model.safetensors"
                    value={localFilePath}
                    onChange={(e) => setLocalFilePath(e.target.value)}
                  />
                </div>
                <div className="import-field">
                  <label>Model Name</label>
                  <input
                    placeholder="e.g. imported-gpt2"
                    value={localModelName}
                    onChange={(e) => setLocalModelName(e.target.value)}
                  />
                </div>
                <div className="import-field">
                  <label>Architecture</label>
                  <select
                    className="settings-select"
                    value={localArchitecture}
                    onChange={(e) => setLocalArchitecture(e.target.value)}
                    style={{ width: '100%' }}
                  >
                    <option value="transformer">Transformer (GPT-style)</option>
                    <option value="llama">LLaMA</option>
                    <option value="mistral">Mistral</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <button
                  className="settings-save-btn"
                  onClick={handleLocalImport}
                  disabled={!localFilePath || !localModelName}
                >
                  <Download size={14} /> Import Local File
                </button>
                {importProgress && (
                  <div className={`import-progress ${importProgress.startsWith('✓') ? 'success' : importProgress.startsWith('Error') ? 'error' : ''}`}>
                    {importProgress}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ── Fine-Tune ── */}
          <div className={`settings-section ${activeTab === 'finetune' ? 'active' : ''}`}>
            <div className="settings-section-title">Fine-Tune with LoRA</div>
            <div className="settings-section-desc">
              Adapt an existing model on new data using Low-Rank Adaptation — trains only a small fraction of parameters.
            </div>

            <div className="settings-group">
              <div className="settings-group-label">Model & Output</div>
              <div className="settings-row">
                <div className="settings-row-left">
                  <div className="settings-label">Base Model</div>
                  <div className="settings-sublabel">Select an existing ready model</div>
                </div>
                <select
                  className="settings-select"
                  value={ftBaseModel}
                  onChange={(e) => setFtBaseModel(e.target.value)}
                >
                  <option value="">Select model…</option>
                  {models
                    .filter((m) => m.status === 'ready' || m.status === 'published')
                    .map((m) => (
                      <option key={m.name} value={m.name}>{m.name}</option>
                    ))}
                </select>
              </div>
              <div className="settings-row">
                <div className="settings-row-left">
                  <div className="settings-label">Fine-Tuned Model Name</div>
                  <div className="settings-sublabel">Name for the output model</div>
                </div>
                <input
                  className="settings-input"
                  placeholder="e.g. my-model-finetuned"
                  value={ftNewName}
                  onChange={(e) => setFtNewName(e.target.value)}
                />
              </div>
            </div>

            <div className="settings-group">
              <div className="settings-group-label">Dataset</div>
              <div className="settings-row">
                <div className="settings-row-left">
                  <div className="settings-label">Source</div>
                </div>
                <select
                  className="settings-select"
                  value={ftDatasetSource}
                  onChange={(e) => setFtDatasetSource(e.target.value)}
                >
                  <option value="paste">Paste Text</option>
                  <option value="local">Local File</option>
                  <option value="huggingface">HuggingFace Dataset</option>
                </select>
              </div>
              <div className="settings-row" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 8 }}>
                <div className="settings-label">
                  {ftDatasetSource === 'paste' ? 'Training Text' : ftDatasetSource === 'local' ? 'File Path' : 'Dataset Name'}
                </div>
                {ftDatasetSource === 'paste' ? (
                  <textarea
                    rows={5}
                    placeholder="Paste training text here…"
                    style={{
                      width: '100%', background: 'var(--bg-secondary)', border: '1px solid var(--border)',
                      borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)', fontSize: 13,
                      padding: '8px 12px', fontFamily: 'inherit', resize: 'vertical', boxSizing: 'border-box',
                    }}
                    value={ftDatasetValue}
                    onChange={(e) => setFtDatasetValue(e.target.value)}
                  />
                ) : (
                  <input
                    className="settings-input"
                    style={{ width: '100%', boxSizing: 'border-box' }}
                    placeholder={ftDatasetSource === 'local' ? 'C:\\path\\to\\dataset.txt' : 'wikitext/wikitext-103-raw-v1'}
                    value={ftDatasetValue}
                    onChange={(e) => setFtDatasetValue(e.target.value)}
                  />
                )}
              </div>
            </div>

            <div className="settings-group">
              <div className="settings-group-label">LoRA Config</div>
              <div className="settings-row">
                <div className="settings-row-left">
                  <div className="settings-label">Rank (r)</div>
                  <div className="settings-sublabel">Higher = more capacity, more params</div>
                </div>
                <div className="settings-slider-row">
                  <input
                    type="range" min={2} max={64} step={2}
                    className="settings-slider"
                    value={ftLoraRank}
                    onChange={(e) => setFtLoraRank(Number(e.target.value))}
                  />
                  <span className="settings-slider-value">{ftLoraRank}</span>
                </div>
              </div>
              <div className="settings-row">
                <div className="settings-row-left">
                  <div className="settings-label">Alpha (α)</div>
                  <div className="settings-sublabel">Scaling factor for LoRA updates</div>
                </div>
                <div className="settings-slider-row">
                  <input
                    type="range" min={4} max={128} step={4}
                    className="settings-slider"
                    value={ftLoraAlpha}
                    onChange={(e) => setFtLoraAlpha(Number(e.target.value))}
                  />
                  <span className="settings-slider-value">{ftLoraAlpha}</span>
                </div>
              </div>
            </div>

            <div className="settings-group">
              <div className="settings-group-label">Hyperparameters</div>
              <div className="settings-row">
                <div className="settings-row-left">
                  <div className="settings-label">Learning Rate</div>
                </div>
                <select
                  className="settings-select"
                  value={String(ftLR)}
                  onChange={(e) => setFtLR(Number(e.target.value))}
                >
                  <option value="0.0001">1e-4</option>
                  <option value="0.0002">2e-4 (default)</option>
                  <option value="0.0005">5e-4</option>
                  <option value="0.001">1e-3</option>
                </select>
              </div>
              <div className="settings-row">
                <div className="settings-row-left">
                  <div className="settings-label">Epochs</div>
                </div>
                <input
                  type="number" min={1} max={20}
                  className="settings-number"
                  value={ftEpochs}
                  onChange={(e) => setFtEpochs(Number(e.target.value))}
                />
              </div>
            </div>

            <div className="settings-actions">
              <button
                className="settings-save-btn"
                onClick={handleFinetune}
                disabled={!ftBaseModel || !ftNewName}
              >
                <Zap size={14} /> Start Fine-Tuning
              </button>
              {ftStatus && (
                <span
                  className="settings-saved-badge"
                  style={{ color: ftStatus.startsWith('Error') ? 'var(--danger)' : ftStatus.startsWith('✓') ? 'var(--success)' : 'var(--text-muted)' }}
                >
                  {ftStatus}
                </span>
              )}
            </div>

            <div style={{ marginTop: 16, fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6 }}>
              <strong style={{ color: 'var(--text-secondary)' }}>How LoRA works:</strong> Instead of retraining all weights,
              LoRA inserts small trainable rank-decomposition matrices (A and B) into attention layers.
              With rank=8 on a 125M model, you train ~0.1% of the parameters while preserving the base model's knowledge.
            </div>
          </div>

        </div>
      </div>
    </>
  );
}
