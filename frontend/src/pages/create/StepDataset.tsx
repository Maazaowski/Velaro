import { useWizardStore } from '../../stores/wizardStore';
import type { DatasetSource, Tokenizer } from '../../stores/wizardStore';
import { ArrowLeft, ArrowRight, FolderOpen, Globe, FileText } from 'lucide-react';

const sources: { value: DatasetSource; icon: typeof FolderOpen; label: string; desc: string }[] = [
  { value: 'local', icon: FolderOpen, label: 'Local Files', desc: 'Upload .txt, .csv, .jsonl files from your machine' },
  { value: 'huggingface', icon: Globe, label: 'HuggingFace Hub', desc: 'Load a dataset by name from HuggingFace' },
  { value: 'paste', icon: FileText, label: 'Paste Text', desc: 'Paste raw text directly for quick experiments' },
];

const tokenizers: { value: Tokenizer; label: string; desc: string }[] = [
  { value: 'bpe', label: 'BPE (Byte-Pair Encoding)', desc: 'Standard for GPT-style models. Good general purpose.' },
  { value: 'sentencepiece', label: 'SentencePiece', desc: 'Used by LLaMA, T5. Good for multilingual.' },
  { value: 'custom', label: 'Custom Tokenizer', desc: 'Load your own trained tokenizer.' },
];

export default function StepDataset() {
  const { datasetSource, datasetPath, huggingfaceId, pasteText, tokenizer, update, nextStep, prevStep } = useWizardStore();

  const canProceed =
    (datasetSource === 'local' && datasetPath.trim().length > 0) ||
    (datasetSource === 'huggingface' && huggingfaceId.trim().length > 0) ||
    (datasetSource === 'paste' && pasteText.trim().length > 0);

  return (
    <>
      <div className="form-section">
        <div className="form-section-title">Dataset Source</div>
        <div className="form-section-desc">Choose where your training data comes from.</div>

        <div className="arch-cards">
          {sources.map((src) => {
            const Icon = src.icon;
            return (
              <div
                key={src.value}
                className={`arch-card ${datasetSource === src.value ? 'selected' : ''}`}
                onClick={() => update({ datasetSource: src.value })}
              >
                <div className="arch-icon"><Icon size={28} /></div>
                <div className="arch-name">{src.label}</div>
                <div className="arch-desc">{src.desc}</div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="form-section">
        <div className="form-section-title">Dataset Configuration</div>
        <div className="form-section-desc">
          {datasetSource === 'local' && 'Provide the path to your dataset file or directory.'}
          {datasetSource === 'huggingface' && 'Enter a HuggingFace dataset identifier.'}
          {datasetSource === 'paste' && 'Paste your training text below.'}
        </div>

        {datasetSource === 'local' && (
          <div className="form-group" style={{ maxWidth: 500 }}>
            <label>File / Directory Path</label>
            <input
              type="text"
              placeholder="C:\data\my-dataset.txt or ./data/"
              value={datasetPath}
              onChange={(e) => update({ datasetPath: e.target.value })}
            />
            <div className="hint">Supports .txt, .csv, .jsonl, or a directory of text files.</div>
          </div>
        )}

        {datasetSource === 'huggingface' && (
          <div className="form-group" style={{ maxWidth: 500 }}>
            <label>Dataset ID</label>
            <input
              type="text"
              placeholder="e.g., wikitext, openwebtext, roneneldan/TinyStories"
              value={huggingfaceId}
              onChange={(e) => update({ huggingfaceId: e.target.value })}
            />
            <div className="hint">Enter the HuggingFace dataset name. Will be downloaded automatically.</div>
          </div>
        )}

        {datasetSource === 'paste' && (
          <div className="form-group" style={{ maxWidth: 600 }}>
            <label>Training Text</label>
            <textarea
              rows={8}
              placeholder="Paste your training text here..."
              value={pasteText}
              onChange={(e) => update({ pasteText: e.target.value })}
              style={{ resize: 'vertical' }}
            />
            <div className="hint">For quick experiments. For serious training, use a file or HuggingFace dataset.</div>
          </div>
        )}
      </div>

      <div className="form-section">
        <div className="form-section-title">Tokenizer</div>
        <div className="form-section-desc">Choose how text is split into tokens for the model.</div>

        <div className="arch-cards">
          {tokenizers.map((tok) => (
            <div
              key={tok.value}
              className={`arch-card ${tokenizer === tok.value ? 'selected' : ''}`}
              onClick={() => update({ tokenizer: tok.value })}
            >
              <div className="arch-name">{tok.label}</div>
              <div className="arch-desc">{tok.desc}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="wizard-footer">
        <button className="btn btn-outline" onClick={prevStep}>
          <ArrowLeft size={14} /> Back: Model Config
        </button>
        <button className="btn btn-primary" disabled={!canProceed} onClick={nextStep}>
          Next: Hyperparameters <ArrowRight size={14} />
        </button>
      </div>
    </>
  );
}
