import { useWizardStore } from '../stores/wizardStore';
import Topbar from '../components/Topbar';
import WizardShell from './create/WizardShell';
import StepBasics from './create/StepBasics';
import StepArchitecture from './create/StepArchitecture';
import StepModelConfig from './create/StepModelConfig';
import StepDataset from './create/StepDataset';
import StepHyperparameters from './create/StepHyperparameters';
import StepReview from './create/StepReview';
import './create/CreateWizard.css';

const stepLabels = [
  'Step 1 of 6: Model basics',
  'Step 2 of 6: Choose architecture',
  'Step 3 of 6: Configure model dimensions',
  'Step 4 of 6: Select training dataset',
  'Step 5 of 6: Set hyperparameters',
  'Step 6 of 6: Review and start training',
];

export default function CreateModel() {
  const currentStep = useWizardStore((s) => s.currentStep);

  return (
    <>
      <Topbar title="Create Model" subtitle={stepLabels[currentStep - 1]} />
      <div className="page-content">
        <WizardShell>
          {currentStep === 1 && <StepBasics />}
          {currentStep === 2 && <StepArchitecture />}
          {currentStep === 3 && <StepModelConfig />}
          {currentStep === 4 && <StepDataset />}
          {currentStep === 5 && <StepHyperparameters />}
          {currentStep === 6 && <StepReview />}
        </WizardShell>
      </div>
    </>
  );
}
