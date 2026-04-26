import { Button } from "@/platform/ui/components/button/button";
import { cn } from "@/platform/ui/lib/cn";
import { Check } from "lucide-react";
import { useCreateProjectStepper } from "./create-project-stepper-provider";

export function StepHorizontalTrackBar() {
  const { currentStep, completedSteps, goToStep, getSteps } = useCreateProjectStepper();
  const steps = getSteps();
  return (
    <div className="flex w-full flex-row flex-wrap " style={{ justifyContent: "space-between" }}>
      {steps.map((step, i) => {
        const stepNum = i + 1;
        return (
          <div
            className={cn(
              "relative flex items-center after:h-0.5 after:border-gray-500 after:bg-gray-300 after:content-[''] [&:not(:last-child)]:flex-1 [&:not(:last-child)]:after:me-[35px] [&:not(:last-child)]:after:ms-[35px] [&:not(:last-child)]:after:flex-1",
              "data-[completed=true]:after:border-gray-700 data-[completed=true]:after:bg-gray-700",
            )}
            key={step.id}
            data-completed={Boolean(completedSteps[i])}
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
                data-completed={Boolean(completedSteps[i])}
                onClick={() => goToStep(stepNum)}
              >
                {completedSteps[i] ? <Check size={18} /> : i + 1}
              </Button>
              <div className="hidden md:block">{step.title}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
