import { Check } from 'lucide-react';
import { useWizardStore } from '../../stores/wizardStore';
import './WizardShell.css';

const steps = [
  { num: 1, label: 'Basics' },
  { num: 2, label: 'Architecture' },
  { num: 3, label: 'Model Config' },
  { num: 4, label: 'Dataset' },
  { num: 5, label: 'Hyperparameters' },
  { num: 6, label: 'Review & Build' },
];

export default function WizardShell({ children }: { children: React.ReactNode }) {
  const { currentStep, setStep } = useWizardStore();

  return (
    <div className="wizard-container">
      <div className="wizard-steps">
        {steps.map((step) => {
          const isActive = currentStep === step.num;
          const isCompleted = currentStep > step.num;
          let cls = 'wizard-step';
          if (isActive) cls += ' active';
          if (isCompleted) cls += ' completed';

          return (
            <div
              key={step.num}
              className={cls}
              onClick={() => {
                if (isCompleted || isActive) setStep(step.num);
              }}
            >
              <span className="step-number">
                {isCompleted ? <Check size={14} /> : step.num}
              </span>
              {step.label}
            </div>
          );
        })}
      </div>
      <div className="wizard-body fade-in">{children}</div>
    </div>
  );
}
