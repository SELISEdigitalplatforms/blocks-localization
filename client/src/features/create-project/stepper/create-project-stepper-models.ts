export type CreateProjectSteps = Array<{ id: number; title: string }>;

export type CreateProjectStepperContextType = {
  currentStep: number;
  nextStep: () => void;
  previousStep: () => void;
  goToStep: (step: number) => void;
  setCompletedSteps: (steps: number[]) => void;
  completedSteps: number[];
  totalSteps: number;
  getSteps: () => CreateProjectSteps;
};
