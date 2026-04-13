import { CreateProjectEnvironmentsForm } from "@/features/create-project/form/create-project-environments-form/create-project-environments-form";
import { CreateProjectNamingForm } from "@/features/create-project/form/create-project-naming-form/create-project-naming-form";
import { CreateProjectResourcesForm } from "@/features/create-project/form/create-project-resources-form/create-project-resources-form";
import {
  CreateProjectStepperProvider,
  useCreateProjectStepper,
} from "@/features/create-project/stepper/create-project-stepper-provider";
import { StepHorizontalTrackBar } from "@/features/create-project/stepper/step-horizontal-track-bar";
import { StepVerticalTrackBar } from "@/features/create-project/stepper/step-vertical-track-bar";
import { useCreateProjectFormStore } from "@/features/create-project/state/create-project-form-store";
import { useEffect } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { X } from "lucide-react";

const stepData = [
  { id: 1, title: "Name your project" },
  { id: 2, title: "Add resources" },
  { id: 3, title: "Configure environments" },
] as const;

export function CreateProjectViewRoot() {
  return (
    <CreateProjectStepperProvider steps={[...stepData]}>
      <CreateProjectView />
    </CreateProjectStepperProvider>
  );
}

function CreateProjectView() {
  const { resetFormData } = useCreateProjectFormStore();
  const [searchParams, setSearchParams] = useSearchParams();
  const { currentStep, goToStep, setCompletedSteps } = useCreateProjectStepper();

  useEffect(() => {
    const tab = searchParams.get("tab");
    if (!tab) return;
    const step = Number.parseInt(tab, 10);
    if (!Number.isNaN(step) && step > 0 && step <= stepData.length && step === 2) {
      setCompletedSteps([1]);
      goToStep(step);
      setSearchParams(
        (prev) => {
          prev.delete("tab");
          return prev;
        },
        { replace: true },
      );
    }
  }, [searchParams, goToStep, setCompletedSteps, setSearchParams]);

  return (
    <>
      <div className="flex flex-col md:hidden">
        <div className="mt-16 flex-1 p-5">
          <div className="flex flex-col items-center justify-center md:hidden">
            <div className="flex gap-2">
              <Link to="/console" onClick={() => resetFormData()} aria-label="Close">
                <X size={32} strokeWidth={1} />
              </Link>
              <p className="mt-[2px] text-lg font-semibold">Create a project</p>
            </div>
            <p className="mb-7 mt-2 text-sm font-normal text-muted-foreground">
              Let&apos;s get started by setting up the basics for your new project.
            </p>
            <StepHorizontalTrackBar />
          </div>
        </div>
        <div className="p-5">
          {currentStep === 1 && <CreateProjectNamingForm />}
          {currentStep === 2 && <CreateProjectResourcesForm />}
          {currentStep === 3 && <CreateProjectEnvironmentsForm />}
        </div>
      </div>

      <div className="hidden gap-12 px-10 md:flex">
        <div className="min-h-full max-w-80 gap-5 bg-background p-5 pt-24 dark:bg-gray-900">
          <div className="mx-2 my-3">
            <div className="flex gap-2">
              <Link to="/console" onClick={() => resetFormData()} aria-label="Close">
                <X size={32} strokeWidth={1} />
              </Link>
              <p className="mt-[2px] text-lg font-semibold">Create a project</p>
            </div>
            <p className="mb-7 mt-2 text-sm font-normal text-muted-foreground">
              Let&apos;s get started by setting up the basics for your new project.
            </p>
          </div>
          <StepVerticalTrackBar />
        </div>
        <div className="mt-24 w-full">
          {currentStep === 1 && <CreateProjectNamingForm />}
          {currentStep === 2 && <CreateProjectResourcesForm />}
          {currentStep === 3 && <CreateProjectEnvironmentsForm />}
        </div>
      </div>
    </>
  );
}
