import { useCreateProjectStepper } from "@/features/create-project/stepper/create-project-stepper-provider";
import { useCreateProjectFormStore } from "@/features/create-project/state/create-project-form-store";
import {
  createProjectResourcesFormDefaultValue,
  createProjectResourcesFormSchema,
} from "@/features/create-project/form/create-project-resources-form/utils";
import { Button } from "@/platform/ui/components/button/button";
import { Form } from "@/platform/ui/components/form/form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";

/**
 * Monolith step wires GitHub repo pickers (`@blocks-devops`). In UILM we keep the step
 * for flow parity and allow submitting with **no resources** (valid for the API).
 */
export function CreateProjectResourcesForm() {
  const { nextStep } = useCreateProjectStepper();
  const { formData, setFormData } = useCreateProjectFormStore();
  const form = useForm({
    values: formData[1],
    resolver: zodResolver(createProjectResourcesFormSchema),
  });

  const onSubmit = (values: typeof createProjectResourcesFormDefaultValue) => {
    setFormData(1, values);
    nextStep();
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)}>
        <div className="mt-4 flex flex-col gap-1 text-left">
          <p className="text-3xl font-bold tracking-tight">Add resources</p>
          <p className="text-base font-normal tracking-tight text-muted-foreground">
            Repository linking from GitHub is available in the main Blocks app. You can continue without resources and
            attach them later.
          </p>
        </div>
        <div className="mt-10">
          <Button type="submit" size="lg">
            Continue
          </Button>
        </div>
      </form>
    </Form>
  );
}
