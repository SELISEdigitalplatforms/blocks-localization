import { Button } from "@/platform/ui/components/button/button";
import { cn } from "@/platform/ui/lib/cn";
import { Check } from "lucide-react";
import { useCreateProjectStepper } from "./create-project-stepper-provider";

export function StepVerticalTrackBar() {
  const { currentStep, totalSteps, goToStep, completedSteps, getSteps } = useCreateProjectStepper();
  const steps = getSteps();
  return (
    <div>
      {steps.map((step, i) => {
        const stepNum = i + 1;
        const completedMarker = completedSteps[i];
        return (
          <div
            className={cn("relative flex flex-col [&:not(:last-child)]:flex-1")}
            key={step.id}
            data-completed={Boolean(completedMarker)}
          >
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                className={cn(
                  "h-8 w-8 rounded-full border p-0 text-lg font-bold text-gray-300",
                  "data-[current=true]:border-gray-700 data-[current=true]:text-foreground",
                  "data-[completed=true]:border-gray-700 data-[completed=true]:text-foreground",
                )}
                data-current={currentStep - 1 === i}
                // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- mirrors monolith track bar indexing
                data-completed={Boolean(completedSteps[i])}
                onClick={() => goToStep(stepNum)}
              >
                {completedSteps[i] ? <Check size={18} /> : i + 1}
              </Button>
              <div
                className={cn(
                  "ml-4 text-base font-medium text-gray-300",
                  "data-[current=true]:text-foreground",
                  "data-[completed=true]:text-foreground",
                )}
                data-current={currentStep - 1 === i}
                data-completed={Boolean(completedSteps[i])}
              >
                {step.title}
              </div>
            </div>
            {i !== totalSteps - 1 && (
              <div
                className={cn(
                  "solid-line my-2 ml-4 h-11 w-px bg-gray-300",
                  "data-[completed=true]:bg-gray-700",
                )}
                data-current={currentStep - 1 === i}
                data-completed={Boolean(completedSteps[i])}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
