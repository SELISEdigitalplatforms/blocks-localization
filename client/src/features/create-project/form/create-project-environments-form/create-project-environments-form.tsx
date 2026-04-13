import { useProjectForm } from "@/features/create-project/hooks/use-project-form";
import { useCreateProjectFormStore } from "@/features/create-project/state/create-project-form-store";
import {
  createProjectEnvironmentFormDefaultValue,
  createProjectEnvironmentFormSchema,
  createProjectEnvironmentOptions,
} from "@/features/create-project/form/create-project-environments-form/utils";
import { Button } from "@/platform/ui/components/button/button";
import { Checkbox } from "@/platform/ui/components/checkbox/checkbox";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/platform/ui/components/form/form";
import { zodResolver } from "@hookform/resolvers/zod";
import { GitBranch } from "lucide-react";
import { useForm } from "react-hook-form";

export function CreateProjectEnvironmentsForm() {
  const { isPending, saveProject } = useProjectForm();
  const { formData, setFormData } = useCreateProjectFormStore();
  const form = useForm({
    values: formData[2],
    resolver: zodResolver(createProjectEnvironmentFormSchema),
  });

  const onSubmit = (values: typeof createProjectEnvironmentFormDefaultValue) => {
    const sortedEnvironments = [...values.environments].sort((a, b) => {
      const aIndex = createProjectEnvironmentOptions.find((opt) => opt.value === a.value)?.index ?? 0;
      const bIndex = createProjectEnvironmentOptions.find((opt) => opt.value === b.value)?.index ?? 0;
      return aIndex - bIndex;
    });
    setFormData(2, { ...values, environments: sortedEnvironments });
    void saveProject();
  };

  const { isValid } = form.formState;

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)}>
        <div className="mt-4 flex flex-col gap-1 text-left">
          <p className="text-3xl font-bold tracking-tight">Select environments</p>
          <p className="text-base font-normal tracking-tight">
            Select the environments you want to enable for this project. You can configure each one individually later.
          </p>
          <div className="mt-2 flex min-h-10 w-fit flex-row items-center gap-1 rounded border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100">
            <span>
              Please ensure that the branch name in your Git repository matches the environment&apos;s label exactly —
              for example, use &apos;dev&apos; for the Development environment.
            </span>
          </div>
          <div className="mt-8 text-sm">
            <FormField
              control={form.control}
              name="environments"
              render={() => (
                <FormItem>
                  {createProjectEnvironmentOptions.map((option) => (
                    <FormField
                      key={option.value}
                      control={form.control}
                      name="environments"
                      render={({ field }) => {
                        const isSelected = field.value?.some((env) => env.value === option.value);
                        return (
                          <FormItem className="mb-4 flex flex-col">
                            <div className="flex items-center gap-2">
                              <FormControl>
                                <Checkbox
                                  className="h-5 w-5"
                                  checked={isSelected}
                                  onCheckedChange={(checked) => {
                                    const currentValues = [...(field.value ?? [])];
                                    if (checked) {
                                      field.onChange([...currentValues, { value: option.value }]);
                                    } else {
                                      field.onChange(currentValues.filter((env) => env.value !== option.value));
                                    }
                                  }}
                                />
                              </FormControl>
                              <FormLabel className="!m-0 text-lg font-bold">
                                <div className="flex flex-row items-center gap-2">
                                  <span>{option.label}</span>
                                  <div className="flex flex-row items-center gap-1">
                                    <GitBranch className="h-3 w-3 text-muted-foreground" />
                                    <span className="text-sm text-muted-foreground">
                                      {option.value === "prod" ? "main" : option.value}
                                    </span>
                                  </div>
                                </div>
                              </FormLabel>
                            </div>
                            <div className="ml-7 text-base font-normal">{option.subtext}</div>
                          </FormItem>
                        );
                      }}
                    />
                  ))}
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>
        <div className="mb-4 mt-10">
          <Button type="submit" size="lg" disabled={!isValid || isPending}>
            Submit
          </Button>
        </div>
      </form>
    </Form>
  );
}
