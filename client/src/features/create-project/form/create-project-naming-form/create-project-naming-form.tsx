import { useCreateProjectStepper } from "@/features/create-project/stepper/create-project-stepper-provider";
import { useCreateProjectFormStore } from "@/features/create-project/state/create-project-form-store";
import {
  createProjectNamingFormDefaultValue,
  createProjectNamingFormSchema,
} from "@/features/create-project/form/create-project-naming-form/utils";
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
import { Input } from "@/platform/ui/components/input/input";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";

export function CreateProjectNamingForm() {
  const { formData, setFormData } = useCreateProjectFormStore();
  const { nextStep } = useCreateProjectStepper();
  const form = useForm({
    values: formData[0],
    resolver: zodResolver(createProjectNamingFormSchema),
  });

  const onSubmit = (values: typeof createProjectNamingFormDefaultValue) => {
    setFormData(0, values);
    nextStep();
  };

  const { isValid } = form.formState;

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)}>
        <div className="mt-4 flex flex-col gap-1 text-left">
          <h3 className="text-3xl font-semibold tracking-tight">Name your project</h3>
          <div className="mt-5 max-w-[437px] sm:mt-5">
            <FormField
              name="name"
              control={form.control}
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <Input
                      {...field}
                      onChange={(e) => form.setValue("name", e.target.value, { shouldValidate: true })}
                      type="text"
                      className="h-auto w-full px-3 py-3 text-base"
                      placeholder="Enter your project name"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="mt-10">
              <FormField
                control={form.control}
                name="isUseBlocksExclusively"
                render={({ field }) => (
                  <FormItem>
                    <div className="flex gap-2">
                      <FormControl>
                        <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                      <FormLabel className="-mt-[2px] flex-1 text-sm font-medium">
                        I confirm that I will use Blocks exclusively for purposes relating to my trade, business, craft,
                        or profession
                      </FormLabel>
                    </div>
                  </FormItem>
                )}
              />
            </div>
            <div className="mt-4">
              <FormField
                control={form.control}
                name="isAcceptBlocksTerms"
                render={({ field }) => (
                  <FormItem>
                    <div className="flex items-center gap-2">
                      <FormControl>
                        <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                      <FormLabel className="!m-0 text-sm font-medium">
                        I accept the{" "}
                        <a
                          href="https://selisegroup.com/software-development-term/"
                          className="text-primary underline"
                          target="_blank"
                          rel="noreferrer"
                        >
                          Terms of services
                        </a>
                      </FormLabel>
                    </div>
                  </FormItem>
                )}
              />
            </div>
          </div>
        </div>
        <div className="mt-10">
          <Button type="submit" size="lg" disabled={!isValid}>
            Continue
          </Button>
        </div>
      </form>
    </Form>
  );
}
