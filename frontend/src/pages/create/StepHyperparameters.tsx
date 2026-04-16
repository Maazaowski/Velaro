import { useWizardStore } from '../../stores/wizardStore';
import type { Optimizer, Scheduler, Precision } from '../../stores/wizardStore';
import { ArrowLeft, ArrowRight, Zap } from 'lucide-react';

const presets = [
  {
    label: 'Quick Test',
    desc: 'Fast iteration, lower quality',
    values: { epochs: 3, batchSize: 16, learningRate: 5e-4, warmupSteps: 500, gradientAccumulation: 1, precision: 'fp16' as Precision },
  },
  {
    label: 'Balanced',
    desc: 'Good balance of speed and quality',
    values: { epochs: 10, batchSize: 32, learningRate: 3e-4, warmupSteps: 2000, gradientAccumulation: 4, precision: 'fp16' as Precision },
  },
  {
    label: 'High Quality',
    desc: 'Longer training, better results',
    values: { epochs: 20, batchSize: 64, learningRate: 1e-4, warmupSteps: 4000, gradientAccumulation: 8, precision: 'bf16' as Precision },
  },
];

export default function StepHyperparameters() {
  const store = useWizardStore();
  const { optimizer, learningRate, scheduler, batchSize, epochs, warmupSteps, weightDecay, gradientAccumulation, precision, update, nextStep, prevStep } = store;

  const applyPreset = (values: typeof presets[0]['values']) => {
    update(values);
  };

  return (
    <>
      <div className="form-section">
        <div className="form-section-title">Training Presets</div>
        <div className="form-section-desc">Choose a preset to auto-fill hyperparameters, or configure manually below.</div>

        <div className="arch-cards">
          {presets.map((p) => (
            <div key={p.label} className="arch-card" onClick={() => applyPreset(p.values)} style={{ cursor: 'pointer' }}>
              <div className="arch-icon"><Zap size={24} /></div>
              <div className="arch-name">{p.label}</div>
              <div className="arch-desc">{p.desc}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="form-section">
        <div className="form-section-title">Optimizer & Scheduler</div>
        <div className="form-section-desc">Configure the optimization strategy for training.</div>

        <div className="form-grid">
          <div className="form-group">
            <label>Optimizer</label>
            <select value={optimizer} onChange={(e) => update({ optimizer: e.target.value as Optimizer })}>
              <option value="adamw">AdamW (recommended)</option>
              <option value="adam">Adam</option>
              <option value="sgd">SGD</option>
            </select>
            <div className="hint">AdamW is the standard for transformer training.</div>
          </div>
          <div className="form-group">
            <label>Learning Rate Scheduler</label>
            <select value={scheduler} onChange={(e) => update({ scheduler: e.target.value as Scheduler })}>
              <option value="cosine">Cosine Decay</option>
              <option value="linear">Linear Decay</option>
              <option value="constant">Constant</option>
            </select>
            <div className="hint">Cosine decay is the most popular choice.</div>
          </div>
          <div className="form-group">
            <label>Precision</label>
            <select value={precision} onChange={(e) => update({ precision: e.target.value as Precision })}>
              <option value="fp16">FP16 (Mixed Precision)</option>
              <option value="bf16">BF16 (Brain Float)</option>
              <option value="fp32">FP32 (Full Precision)</option>
            </select>
            <div className="hint">FP16 is fastest on most GPUs. BF16 on Ampere+.</div>
          </div>
        </div>
      </div>

      <div className="form-section">
        <div className="form-section-title">Training Parameters</div>
        <div className="form-section-desc">Fine-tune the training loop behavior.</div>

        <div className="form-grid">
          <div className="form-group">
            <label>Learning Rate</label>
            <div className="range-group">
              <input type="range" min={0.00001} max={0.001} step={0.00001} value={learningRate}
                onChange={(e) => update({ learningRate: Number(e.target.value) })} />
              <span className="range-value">{learningRate.toExponential(0)}</span>
            </div>
            <div className="hint">Peak learning rate. Typical range: 1e-5 to 1e-3.</div>
          </div>
          <div className="form-group">
            <label>Batch Size</label>
            <div className="range-group">
              <input type="range" min={1} max={128} step={1} value={batchSize}
                onChange={(e) => update({ batchSize: Number(e.target.value) })} />
              <span className="range-value">{batchSize}</span>
            </div>
            <div className="hint">Samples per training step. Larger = more stable but more VRAM.</div>
          </div>
          <div className="form-group">
            <label>Epochs</label>
            <div className="range-group">
              <input type="range" min={1} max={50} step={1} value={epochs}
                onChange={(e) => update({ epochs: Number(e.target.value) })} />
              <span className="range-value">{epochs}</span>
            </div>
            <div className="hint">Full passes over the dataset.</div>
          </div>
          <div className="form-group">
            <label>Warmup Steps</label>
            <div className="range-group">
              <input type="range" min={0} max={10000} step={100} value={warmupSteps}
                onChange={(e) => update({ warmupSteps: Number(e.target.value) })} />
              <span className="range-value">{warmupSteps.toLocaleString()}</span>
            </div>
            <div className="hint">Gradual LR increase at start. Prevents early instability.</div>
          </div>
          <div className="form-group">
            <label>Weight Decay</label>
            <div className="range-group">
              <input type="range" min={0} max={0.1} step={0.005} value={weightDecay}
                onChange={(e) => update({ weightDecay: Number(e.target.value) })} />
              <span className="range-value">{weightDecay}</span>
            </div>
            <div className="hint">Regularization strength. Typical: 0.01 - 0.1.</div>
          </div>
          <div className="form-group">
            <label>Gradient Accumulation Steps</label>
            <div className="range-group">
              <input type="range" min={1} max={32} step={1} value={gradientAccumulation}
                onChange={(e) => update({ gradientAccumulation: Number(e.target.value) })} />
              <span className="range-value">{gradientAccumulation}</span>
            </div>
            <div className="hint">Effective batch = batch_size × accumulation. Saves VRAM.</div>
          </div>
        </div>

        <div className="card" style={{ marginTop: 16 }}>
          <div className="card-body" style={{ padding: '14px 20px' }}>
            <div style={{ display: 'flex', gap: 32, fontSize: 13 }}>
              <div>
                <span style={{ color: 'var(--text-muted)' }}>Effective Batch Size: </span>
                <span style={{ fontWeight: 600, color: 'var(--accent-light)' }}>{batchSize * gradientAccumulation}</span>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)' }}>Precision: </span>
                <span style={{ fontWeight: 600 }}>{precision.toUpperCase()}</span>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)' }}>Optimizer: </span>
                <span style={{ fontWeight: 600 }}>{optimizer.toUpperCase()}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="wizard-footer">
        <button className="btn btn-outline" onClick={prevStep}>
          <ArrowLeft size={14} /> Back: Dataset
        </button>
        <button className="btn btn-primary" onClick={nextStep}>
          Next: Review & Build <ArrowRight size={14} />
        </button>
      </div>
    </>
  );
}
