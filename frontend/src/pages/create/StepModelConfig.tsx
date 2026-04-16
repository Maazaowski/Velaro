import { useWizardStore, estimateParams, formatParams, estimateModelSizeMB, estimateVramTrainingGB, estimateVramInferenceGB } from '../../stores/wizardStore';
import { ArrowLeft, ArrowRight, AlertTriangle } from 'lucide-react';

export default function StepModelConfig() {
  const store = useWizardStore();
  const { hiddenSize, numLayers, numAttentionHeads, vocabSize, contextLength, intermediateSize, precision, update, nextStep, prevStep } = store;

  const params = estimateParams(store);
  const sizeMB = estimateModelSizeMB(params, precision);
  const vramTrain = estimateVramTrainingGB(params);
  const vramInfer = estimateVramInferenceGB(params, precision);

  return (
    <div className="config-layout">
      <div className="config-main">
        <div className="form-section">
          <div className="form-section-title">Model Configuration</div>
          <div className="form-section-desc">Configure the dimensions and layers of your model. Adjust sliders and watch the stats update in real-time.</div>

          <div className="form-grid">
            <SliderField
              label="Hidden Size"
              hint="Width of each layer. Larger = more capacity but slower."
              value={hiddenSize}
              min={128} max={4096} step={128}
              onChange={(v) => update({ hiddenSize: v })}
            />
            <SliderField
              label="Number of Layers"
              hint="Depth of the model. More layers = deeper reasoning."
              value={numLayers}
              min={2} max={48} step={2}
              onChange={(v) => update({ numLayers: v })}
            />
            <SliderField
              label="Attention Heads"
              hint="Parallel attention patterns. Must divide hidden size."
              value={numAttentionHeads}
              min={2} max={32} step={2}
              onChange={(v) => update({ numAttentionHeads: v })}
            />
            <SliderField
              label="Vocabulary Size"
              hint="Number of unique tokens. Use BPE tokenizer default."
              value={vocabSize}
              min={10000} max={100000} step={1000}
              display={vocabSize.toLocaleString()}
              onChange={(v) => update({ vocabSize: v })}
            />
            <SliderField
              label="Context Length"
              hint="Max input tokens the model can process at once."
              value={contextLength}
              min={256} max={8192} step={256}
              display={contextLength.toLocaleString()}
              onChange={(v) => update({ contextLength: v })}
            />
            <SliderField
              label="Intermediate (FFN) Size"
              hint="Feed-forward network width. Typically 4x hidden size."
              value={intermediateSize}
              min={512} max={16384} step={256}
              display={intermediateSize.toLocaleString()}
              onChange={(v) => update({ intermediateSize: v })}
            />
          </div>
        </div>

        <div className="wizard-footer">
          <button className="btn btn-outline" onClick={prevStep}>
            <ArrowLeft size={14} /> Back: Architecture
          </button>
          <button className="btn btn-primary" onClick={nextStep}>
            Next: Dataset <ArrowRight size={14} />
          </button>
        </div>
      </div>

      <div className="config-sidebar">
        <div className="card sticky-card">
          <div className="card-header"><h3>Estimated Model Stats</h3></div>
          <div className="card-body">
            <div className="metric-row">
              <span className="metric-label">Total Parameters</span>
              <span className="metric-value" style={{ color: 'var(--accent-light)' }}>~{formatParams(params)}</span>
            </div>
            <div className="metric-row">
              <span className="metric-label">Model Size ({precision.toUpperCase()})</span>
              <span className="metric-value">~{sizeMB >= 1024 ? `${(sizeMB / 1024).toFixed(1)} GB` : `${sizeMB} MB`}</span>
            </div>
            <div className="metric-row">
              <span className="metric-label">Est. VRAM (Training)</span>
              <span className="metric-value" style={{ color: 'var(--warning)' }}>~{vramTrain} GB</span>
            </div>
            <div className="metric-row">
              <span className="metric-label">Est. VRAM (Inference)</span>
              <span className="metric-value" style={{ color: 'var(--success)' }}>~{vramInfer} GB</span>
            </div>
            <div className="metric-row">
              <span className="metric-label">Architecture</span>
              <span className="metric-value">Transformer</span>
            </div>
            <div className="metric-row">
              <span className="metric-label">Layers</span>
              <span className="metric-value">{numLayers}</span>
            </div>
            <div className="metric-row">
              <span className="metric-label">Hidden Size</span>
              <span className="metric-value">{hiddenSize}</span>
            </div>
            <div className="metric-row">
              <span className="metric-label">Heads</span>
              <span className="metric-value">{numAttentionHeads}</span>
            </div>

            {vramTrain > 8 && (
              <div style={{
                marginTop: 16,
                padding: 12,
                background: 'rgba(253,203,110,0.1)',
                borderRadius: 'var(--radius-sm)',
                fontSize: 12,
                color: 'var(--warning)',
                display: 'flex',
                gap: 8,
                alignItems: 'flex-start',
              }}>
                <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: 1 }} />
                <span>
                  Training requires ~{vramTrain}GB VRAM. If your GPU has less, consider reducing layers or hidden size, or use gradient checkpointing.
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function SliderField({
  label, hint, value, min, max, step, display, onChange,
}: {
  label: string; hint: string; value: number; min: number; max: number; step: number;
  display?: string; onChange: (v: number) => void;
}) {
  return (
    <div className="form-group">
      <label>{label}</label>
      <div className="range-group">
        <input
          type="range"
          min={min} max={max} step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
        />
        <span className="range-value">{display ?? value}</span>
      </div>
      <div className="hint">{hint}</div>
    </div>
  );
}
