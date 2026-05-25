import React from "react";

interface StepContentProps {
  currentStep: number;
  stepNumber: number;
  children: React.ReactNode;
}

const StepperWithoutIndicator: React.FC<StepContentProps> = ({
  currentStep,
  stepNumber,
  children,
}) => {
  if (currentStep !== stepNumber) {
    return null;
  }

  return <>{children}</>;
};

export default StepperWithoutIndicator;
