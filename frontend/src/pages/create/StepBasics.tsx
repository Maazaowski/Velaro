import { useWizardStore } from '../../stores/wizardStore';
import type { UseCase } from '../../stores/wizardStore';
import { ArrowRight, MessageSquare, Code, HelpCircle, FileText, MessagesSquare } from 'lucide-react';

const useCases: { value: UseCase; label: string; desc: string; icon: typeof MessageSquare }[] = [
  { value: 'text-generation', label: 'Text Generation', desc: 'Generate articles, stories, creative writing', icon: MessageSquare },
  { value: 'code', label: 'Code Generation', desc: 'Write and complete source code', icon: Code },
  { value: 'qa', label: 'Question & Answer', desc: 'Answer questions from context or knowledge', icon: HelpCircle },
  { value: 'summarization', label: 'Summarization', desc: 'Condense long documents into summaries', icon: FileText },
  { value: 'chat', label: 'Conversational Chat', desc: 'Multi-turn dialogue and assistant behavior', icon: MessagesSquare },
];

export default function StepBasics() {
  const { modelName, description, useCase, update, nextStep } = useWizardStore();

  const canProceed = modelName.trim().length > 0;

  return (
    <>
      <div className="form-section">
        <div className="form-section-title">Model Basics</div>
        <div className="form-section-desc">Give your model a name and describe what it will do.</div>

        <div className="form-grid">
          <div className="form-group">
            <label>Model Name *</label>
            <input
              type="text"
              placeholder="e.g., MyTextGen-125M"
              value={modelName}
              onChange={(e) => update({ modelName: e.target.value })}
            />
            <div className="hint">A unique name to identify your model. Use letters, numbers, and hyphens.</div>
          </div>
          <div className="form-group">
            <label>Description</label>
            <input
              type="text"
              placeholder="e.g., A small text generation model trained on web data"
              value={description}
              onChange={(e) => update({ description: e.target.value })}
            />
            <div className="hint">Optional. Helps you remember the purpose of this model.</div>
          </div>
        </div>
      </div>

      <div className="form-section">
        <div className="form-section-title">Use Case</div>
        <div className="form-section-desc">Select the primary purpose of your model. This helps pre-configure optimal defaults.</div>

        <div className="usecase-grid">
          {useCases.map((uc) => {
            const Icon = uc.icon;
            return (
              <div
                key={uc.value}
                className={`usecase-card ${useCase === uc.value ? 'selected' : ''}`}
                onClick={() => update({ useCase: uc.value })}
              >
                <Icon size={24} />
                <div className="usecase-label">{uc.label}</div>
                <div className="usecase-desc">{uc.desc}</div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="wizard-footer">
        <div />
        <button className="btn btn-primary" disabled={!canProceed} onClick={nextStep}>
          Next: Architecture <ArrowRight size={14} />
        </button>
      </div>
    </>
  );
}
