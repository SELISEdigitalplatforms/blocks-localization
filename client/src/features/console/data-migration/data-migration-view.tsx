
import { useDataMigrationFormState } from "@/features/console/data-migration/data-migration-form-store";
import { EnvironmentServiceSelectionForm } from "@/features/console/data-migration/environment-service-selection-form";
import { ReviewConfirmForm } from "@/features/console/data-migration/review-confirm-form";
import type { CreateProjectSteps } from "@/features/create-project/stepper/create-project-stepper-models";
import {
  CreateProjectStepperProvider,
  useCreateProjectStepper,
} from "@/features/create-project/stepper/create-project-stepper-provider";
import { StepHorizontalTrackBar } from "@/features/create-project/stepper/step-horizontal-track-bar";
import { StepVerticalTrackBar } from "@/features/create-project/stepper/step-vertical-track-bar";
import { X } from "lucide-react";
import { Link } from "react-router-dom";

const stepData: CreateProjectSteps = [
  { id: 1, title: "Environments & services" },
  { id: 2, title: "Review & confirm" },
];

function DataMigrationContent() {
  const { resetFormData } = useDataMigrationFormState();
  const { currentStep } = useCreateProjectStepper();

  return (
    <>
      <div className="flex flex-col md:hidden">
        <div className="mt-16 flex-1 p-5">
          <div className="flex flex-col items-center justify-center md:hidden">
            <div className="flex gap-2">
              <Link to="/project-overview/environments" onClick={resetFormData}>
                <X size={32} strokeWidth={1} />
              </Link>
              <p className="mt-[2px] text-lg font-semibold">Environment migration</p>
            </div>
            <p className="mb-7 mt-2 text-sm font-normal text-muted-foreground">
              Configure your source, target, and services to migrate.
            </p>
            <StepHorizontalTrackBar />
          </div>
        </div>
        <div className="p-5">
          {currentStep === 1 ? <EnvironmentServiceSelectionForm /> : null}
          {currentStep === 2 ? <ReviewConfirmForm /> : null}
        </div>
      </div>

      <div className="hidden gap-12 px-10 md:flex">
        <div className="min-h-screen max-w-80 gap-5 bg-background p-5 pt-24">
          <div className="mx-2 my-3">
            <div className="flex gap-2">
              <Link to="/project-overview/environments" onClick={resetFormData}>
                <X size={32} strokeWidth={1} />
              </Link>
              <p className="mt-[2px] text-lg font-semibold">Environment migration</p>
            </div>
            <p className="mb-7 mt-2 text-sm font-normal text-muted-foreground">
              Configure your source, target, and services to migrate.
            </p>
          </div>
          <StepVerticalTrackBar />
        </div>
        <div className="mt-24 w-full min-w-0">
          {currentStep === 1 ? <EnvironmentServiceSelectionForm /> : null}
          {currentStep === 2 ? <ReviewConfirmForm /> : null}
        </div>
      </div>
    </>
  );
}

export function DataMigrationView() {
  return (
    <CreateProjectStepperProvider steps={stepData}>
      <DataMigrationContent />
    </CreateProjectStepperProvider>
  );
}
