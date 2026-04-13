import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { useUilmProjectKey, useUilmSaveLanguageModule } from "@/features/uilm/hooks/use-uilm-queries";
import { Button } from "@/platform/ui/components/button/button";
import {
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/platform/ui/components/dialog/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/platform/ui/components/form/form";
import { Input } from "@/platform/ui/components/input/input";
import { showErrorToast, showSuccessToast } from "@/platform/ui/hooks/use-toast";

interface NewModuleProps {
  onClose: (open: boolean) => void;
}

const schema = z.object({
  moduleName: z
    .string()
    .min(1, { message: "Module name is required" })
    .max(50, { message: "Module name must be less than 50 characters" }),
});

type FormData = z.infer<typeof schema>;

export function NewModuleModal({ onClose }: NewModuleProps) {
  const { isPending, mutateAsync } = useUilmSaveLanguageModule();
  const tenantId = useUilmProjectKey();

  const form = useForm<FormData>({
    defaultValues: {
      moduleName: "",
    },
    resolver: zodResolver(schema),
  });

  const formSubmitHandler = async (data: FormData) => {
    if (!tenantId) {
      showErrorToast({ errors: "Project key not found." });
      return;
    }

    try {
      const payload = {
        ...data,
        projectKey: tenantId,
      };
      const res = await mutateAsync(payload);

      if (res?.success) {
        showSuccessToast({ title: "Success", description: "New module added" });
        form.reset();
        onClose(false);
      } else {
        if (Array.isArray(res?.validationErrors) && res.validationErrors.length > 0) {
          res.validationErrors.forEach((error: any) => {
            showErrorToast({ errors: error.errorMessage });
          });
        } else {
          showErrorToast({ errors: res?.errorMessage ?? "Failed to add module" });
        }
      }
    } catch (error) {
      showErrorToast({ errors: error instanceof Error ? error.message : String(error) });
    }
  };

  return (
    <DialogContent>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(formSubmitHandler)}>
          <DialogHeader className="mb-4">
            <DialogTitle>New module</DialogTitle>
          </DialogHeader>
          <div className="grid gap-2">
            <FormField
              name="moduleName"
              control={form.control}
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-left font-medium text-high-emphasis">
                    Module name
                  </FormLabel>
                  <FormControl>
                    <Input
                      id="moduleName"
                      placeholder="Enter Module name"
                      className="border-default col-span-3 mt-1 border shadow-none"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          <DialogFooter className="mt-6">
            <Button
              type="button"
              disabled={isPending}
              variant="secondary"
              className="min-w-[80px]"
              onClick={() => onClose(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isPending} className="min-w-[80px]">
              Create
            </Button>
          </DialogFooter>
        </form>
      </Form>
    </DialogContent>
  );
}
