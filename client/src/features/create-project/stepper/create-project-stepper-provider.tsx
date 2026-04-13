import {
  createContext,
  useContext,
  useState,
  type ReactNode,
} from "react";
import type { CreateProjectStepperContextType, CreateProjectSteps } from "./create-project-stepper-models";

const CreateProjectStepperContext = createContext<CreateProjectStepperContextType | undefined>(undefined);

export function useCreateProjectStepper(): CreateProjectStepperContextType {
  const ctx = useContext(CreateProjectStepperContext);
  if (!ctx) {
    throw new Error("useCreateProjectStepper must be used within CreateProjectStepperProvider");
  }
  return ctx;
}

type ProviderProps = {
  children: ReactNode;
  steps: CreateProjectSteps;
  isStepValid?: (step: number) => boolean;
  initialStep?: number;
};

export function CreateProjectStepperProvider({
  children,
  steps,
  isStepValid = () => true,
  initialStep = 1,
}: ProviderProps) {
  const [currentStep, setCurrentStep] = useState(initialStep);
  const [completedSteps, setCompletedSteps] = useState<number[]>(() =>
    Array.from({ length: initialStep - 1 }, (_, i) => i + 1),
  );
  const totalSteps = steps.length;

  const nextStep = () => {
    if (currentStep < totalSteps) {
      setCurrentStep((prev) => prev + 1);
      setCompletedSteps((prev) =>
        prev.includes(currentStep) ? prev : [...prev, currentStep],
      );
    }
  };

  const previousStep = () => {
    if (currentStep > 1) {
      setCurrentStep((prev) => prev - 1);
      setCompletedSteps((prev) => prev.filter((s) => s !== currentStep - 1));
    }
  };

  const goToStep = (step: number) => {
    const canNavigate =
      step > 0 &&
      step <= totalSteps &&
      (step === 1 || completedSteps.includes(step - 1)) &&
      isStepValid(step);

    if (canNavigate) {
      setCurrentStep(step);
      setCompletedSteps(Array.from({ length: step - 1 }, (_, i) => i + 1));
    }
  };

  const value: CreateProjectStepperContextType = {
    currentStep,
    nextStep,
    previousStep,
    goToStep,
    setCompletedSteps,
    completedSteps,
    totalSteps,
    getSteps: () => steps,
  };

  return (
    <CreateProjectStepperContext.Provider value={value}>{children}</CreateProjectStepperContext.Provider>
  );
}
