import React from "react";
import { Button } from "@/components/ui-kits/button/button";
import {
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui-kits/dialog/dialog";
import { Input } from "@/components/ui-kits/input/input";
import { useSaveLanguageModule } from "@blocks-localization/hooks/use-language-manager";
import { showErrorToast, toast } from "@/hooks/use-toast";
import { formatErrorMessage } from "@/lib/error";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { ILanguageModule } from "@blocks-localization/models/language";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui-kits/form/form";
import { useProjectStore } from "@seliseblocks/genesis-os";

interface NewModuleProps {
  onClose: (value?: boolean) => void;
}
const schema = z.object({
  moduleName: z
    .string()
    .trim()
    .min(1, { message: "Module name is required" })
    .max(50, { message: "Module name must be less than 50 characters" }),
});

type FormValues = z.infer<typeof schema>;

const NewModule: React.FC<NewModuleProps> = ({ onClose }) => {
  const { isPending, mutateAsync } = useSaveLanguageModule();
  const tenantId = useProjectStore()?.selectedProject?.tenantId || "";

  const form = useForm<FormValues>({
    defaultValues: {
      moduleName: "",
    },
    resolver: zodResolver(schema),
    mode: "onChange",
  });

  const formSubmitHandler = async (data: FormValues) => {
    try {
      const payload = {
        ...data,
      } as ILanguageModule;
      const res = await mutateAsync(payload);
      if (res?.success) {
        toast({
          variant: "success",
          title: "Success",
          description: "New module added",
        });
        form.reset();
        onClose(false);
      } else {
        if (Array.isArray(res?.validationErrors) && res.validationErrors.length > 0) {
          res?.validationErrors?.forEach((error) => {
            showErrorToast({ errors: formatErrorMessage(error.errorMessage) });
          });
        } else {
          showErrorToast({ errors: formatErrorMessage(res?.errorMessage) });
        }
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: formatErrorMessage(error),
      });
    }
  };

  return (
    <DialogContent>
      <Form {...form}>
        {" "}
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
                    Module name <span className="text-destructive">*</span>
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
            <DialogTrigger asChild>
              <Button disabled={isPending} variant="secondary">
                Cancel
              </Button>
            </DialogTrigger>
            <Button disabled={isPending || !form.formState.isValid}>Create</Button>
          </DialogFooter>
        </form>
      </Form>
    </DialogContent>
  );
};

export default NewModule;
