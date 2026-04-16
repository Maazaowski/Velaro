import { useNavigate } from 'react-router-dom';
import { useWizardStore, estimateParams, formatParams, estimateModelSizeMB, estimateVramTrainingGB } from '../../stores/wizardStore';
import { ArrowLeft, Rocket, AlertTriangle } from 'lucide-react';

export default function StepReview() {
  const store = useWizardStore();
  const navigate = useNavigate();
  const { prevStep } = store;

  const params = estimateParams(store);
  const sizeMB = estimateModelSizeMB(params, store.precision);
  const vramTrain = estimateVramTrainingGB(params);

  const handleStartTraining = () => {
    // TODO: POST config to backend, then navigate to training monitor
    navigate('/training');
  };

  return (
    <>
      <div className="form-section">
        <div className="form-section-title">Review Your Model</div>
        <div className="form-section-desc">Review all settings before starting the build. You can go back to any step to make changes.</div>
      </div>

      <div className="review-grid">
        <div className="card">
          <div className="card-header"><h3>Basics</h3></div>
          <div className="card-body">
            <div className="metric-row">
              <span className="metric-label">Model Name</span>
              <span className="metric-value">{store.modelName || '(not set)'}</span>
            </div>
            <div className="metric-row">
              <span className="metric-label">Description</span>
              <span className="metric-value">{store.description || '(none)'}</span>
            </div>
            <div className="metric-row">
              <span className="metric-label">Use Case</span>
              <span className="metric-value">{store.useCase}</span>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header"><h3>Architecture</h3></div>
          <div className="card-body">
            <div className="metric-row">
              <span className="metric-label">Type</span>
              <span className="metric-value">{store.architecture}</span>
            </div>
            <div className="metric-row">
              <span className="metric-label">Hidden Size</span>
              <span className="metric-value">{store.hiddenSize}</span>
            </div>
            <div className="metric-row">
              <span className="metric-label">Layers</span>
              <span className="metric-value">{store.numLayers}</span>
            </div>
            <div className="metric-row">
              <span className="metric-label">Attention Heads</span>
              <span className="metric-value">{store.numAttentionHeads}</span>
            </div>
            <div className="metric-row">
              <span className="metric-label">Vocabulary Size</span>
              <span className="metric-value">{store.vocabSize.toLocaleString()}</span>
            </div>
            <div className="metric-row">
              <span className="metric-label">Context Length</span>
              <span className="metric-value">{store.contextLength.toLocaleString()}</span>
            </div>
            <div className="metric-row">
              <span className="metric-label">FFN Size</span>
              <span className="metric-value">{store.intermediateSize.toLocaleString()}</span>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header"><h3>Dataset</h3></div>
          <div className="card-body">
            <div className="metric-row">
              <span className="metric-label">Source</span>
              <span className="metric-value">{store.datasetSource}</span>
            </div>
            <div className="metric-row">
              <span className="metric-label">Path / ID</span>
              <span className="metric-value">
                {store.datasetSource === 'local' && (store.datasetPath || '(not set)')}
                {store.datasetSource === 'huggingface' && (store.huggingfaceId || '(not set)')}
                {store.datasetSource === 'paste' && `${store.pasteText.length} chars`}
              </span>
            </div>
            <div className="metric-row">
              <span className="metric-label">Tokenizer</span>
              <span className="metric-value">{store.tokenizer.toUpperCase()}</span>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header"><h3>Hyperparameters</h3></div>
          <div className="card-body">
            <div className="metric-row">
              <span className="metric-label">Optimizer</span>
              <span className="metric-value">{store.optimizer.toUpperCase()}</span>
            </div>
            <div className="metric-row">
              <span className="metric-label">Learning Rate</span>
              <span className="metric-value">{store.learningRate.toExponential(0)} ({store.scheduler})</span>
            </div>
            <div className="metric-row">
              <span className="metric-label">Batch Size</span>
              <span className="metric-value">{store.batchSize} (eff. {store.batchSize * store.gradientAccumulation})</span>
            </div>
            <div className="metric-row">
              <span className="metric-label">Epochs</span>
              <span className="metric-value">{store.epochs}</span>
            </div>
            <div className="metric-row">
              <span className="metric-label">Warmup Steps</span>
              <span className="metric-value">{store.warmupSteps.toLocaleString()}</span>
            </div>
            <div className="metric-row">
              <span className="metric-label">Weight Decay</span>
              <span className="metric-value">{store.weightDecay}</span>
            </div>
            <div className="metric-row">
              <span className="metric-label">Precision</span>
              <span className="metric-value">{store.precision.toUpperCase()}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginTop: 20 }}>
        <div className="card-header"><h3>Resource Estimate</h3></div>
        <div className="card-body">
          <div style={{ display: 'flex', gap: 40, flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>PARAMETERS</div>
              <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--accent-light)' }}>~{formatParams(params)}</div>
            </div>
            <div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>MODEL SIZE</div>
              <div style={{ fontSize: 24, fontWeight: 700 }}>
                ~{sizeMB >= 1024 ? `${(sizeMB / 1024).toFixed(1)} GB` : `${sizeMB} MB`}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>VRAM NEEDED</div>
              <div style={{ fontSize: 24, fontWeight: 700, color: vramTrain > 8 ? 'var(--warning)' : 'var(--success)' }}>
                ~{vramTrain} GB
              </div>
            </div>
          </div>

          {vramTrain > 16 && (
            <div style={{
              marginTop: 16, padding: 14,
              background: 'rgba(255,118,117,0.1)', border: '1px solid rgba(255,118,117,0.3)',
              borderRadius: 'var(--radius-sm)', fontSize: 13, color: 'var(--danger)',
              display: 'flex', gap: 10, alignItems: 'center',
            }}>
              <AlertTriangle size={18} />
              This model requires ~{vramTrain}GB VRAM for training. Most consumer GPUs have 8-24GB. Consider reducing model size.
            </div>
          )}
        </div>
      </div>

      <div className="wizard-footer">
        <button className="btn btn-outline" onClick={prevStep}>
          <ArrowLeft size={14} /> Back: Hyperparameters
        </button>
        <button
          className="btn btn-success"
          style={{ fontSize: 15, padding: '12px 28px' }}
          onClick={handleStartTraining}
        >
          <Rocket size={16} /> Start Training
        </button>
      </div>
    </>
  );
}
