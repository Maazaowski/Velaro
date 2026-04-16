import { useWizardStore } from '../../stores/wizardStore';
import type { Architecture } from '../../stores/wizardStore';
import { ArrowLeft, ArrowRight } from 'lucide-react';

const architectures: { value: Architecture; icon: string; name: string; desc: string; tags: string[] }[] = [
  {
    value: 'transformer',
    icon: '\u2581',
    name: 'Transformer',
    desc: 'Best for text generation, translation, summarization. Industry standard architecture.',
    tags: ['GPT-style', 'Attention', 'Decoder-only'],
  },
  {
    value: 'rnn-lstm',
    icon: '\u21BA',
    name: 'RNN / LSTM',
    desc: 'Sequential processing, good for smaller datasets and simpler tasks.',
    tags: ['Sequential', 'Lightweight', 'Classic'],
  },
  {
    value: 'mamba-ssm',
    icon: '\u29C9',
    name: 'Mamba / SSM',
    desc: 'State-space model, efficient for long sequences with linear scaling.',
    tags: ['Linear', 'Fast', 'Experimental'],
  },
];

export default function StepArchitecture() {
  const { architecture, update, nextStep, prevStep } = useWizardStore();

  return (
    <>
      <div className="form-section">
        <div className="form-section-title">Model Architecture</div>
        <div className="form-section-desc">
          Choose the base architecture for your model. This determines how data flows through the network.
        </div>

        <div className="arch-cards">
          {architectures.map((arch) => (
            <div
              key={arch.value}
              className={`arch-card ${architecture === arch.value ? 'selected' : ''}`}
              onClick={() => update({ architecture: arch.value })}
            >
              <div className="arch-icon">{arch.icon}</div>
              <div className="arch-name">{arch.name}</div>
              <div className="arch-desc">{arch.desc}</div>
              <div style={{ marginTop: 10 }}>
                {arch.tags.map((t) => (
                  <span key={t} className="tag">{t}</span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {architecture === 'transformer' && (
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="card-header"><h3>Transformer Architecture</h3></div>
          <div className="card-body">
            <div className="arch-diagram">
              <div className="arch-diagram-row">
                <div className="arch-block input">Input Tokens</div>
                <div className="arch-arrow">\u2193</div>
              </div>
              <div className="arch-diagram-row">
                <div className="arch-block embedding">Token + Position Embedding</div>
                <div className="arch-arrow">\u2193</div>
              </div>
              <div className="arch-diagram-row">
                <div className="arch-block attention">Multi-Head Self-Attention</div>
                <div className="arch-arrow">\u2193</div>
              </div>
              <div className="arch-diagram-row">
                <div className="arch-block ffn">Feed-Forward Network (FFN)</div>
                <div className="arch-arrow">\u2193</div>
              </div>
              <div className="arch-diagram-row">
                <div className="arch-block repeat">\u00d7 N Layers (stacked)</div>
                <div className="arch-arrow">\u2193</div>
              </div>
              <div className="arch-diagram-row">
                <div className="arch-block output">Layer Norm + Output Head</div>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="wizard-footer">
        <button className="btn btn-outline" onClick={prevStep}>
          <ArrowLeft size={14} /> Back: Basics
        </button>
        <button className="btn btn-primary" onClick={nextStep}>
          Next: Model Config <ArrowRight size={14} />
        </button>
      </div>
    </>
  );
}
