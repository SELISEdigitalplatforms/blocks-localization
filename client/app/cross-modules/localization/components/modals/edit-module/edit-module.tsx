import React from "react";
import { Button } from "@/components/ui-kits/button/button";
import {
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui-kits/dialog/dialog";
import { Input } from "@/components/ui-kits/input/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui-kits/form/form";
import { useSaveLanguageModule } from "@blocks-localization/hooks/use-language-manager";
import { showErrorToast, toast } from "@/hooks/use-toast";
import { useProjectStore } from "@seliseblocks/genesis-os";
import { IModuleGets } from "@blocks-localization/models/language";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";

interface EditModuleProps {
  module: IModuleGets;
  onClose: (open: boolean) => void;
}

const schema = z.object({
  moduleName: z
    .string()
    .min(3, { message: "Module name must be at least 3 characters" })
    .max(100, { message: "Module name must be less than 100 characters" }),
});

interface FormValues {
  moduleName: string;
}

const EditModule: React.FC<EditModuleProps> = ({ module, onClose }) => {
  const { isPending, mutateAsync } = useSaveLanguageModule();
  const tenantId = useProjectStore()?.selectedProject?.tenantId || "";

  const form = useForm<FormValues>({
    defaultValues: {
      moduleName: module.moduleName,
    },
    resolver: zodResolver(schema),
  });

  const formSubmitHandler = async (data: FormValues) => {
    try {
      const payload = {
        itemId: module.itemId,
        moduleName: data.moduleName,
      };
      const res = await mutateAsync(payload);
      if (res?.success) {
        toast({
          variant: "success",
          title: "Success",
          description: "Module updated",
        });
        form.reset();
        onClose(false);
      } else {
        if (Array.isArray(res?.validationErrors) && res.validationErrors.length > 0) {
          res.validationErrors.forEach((error) => {
            showErrorToast({ errors: error.errorMessage });
          });
        } else {
          showErrorToast({ errors: res?.errorMessage });
        }
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: JSON.stringify(error),
      });
    }
  };

  return (
    <DialogContent>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(formSubmitHandler)}>
          <DialogHeader className="mb-4">
            <DialogTitle>Edit module</DialogTitle>
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
                      placeholder="Enter module name"
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
              onClick={() => onClose(false)}
            >
              Cancel
            </Button>
            <Button disabled={isPending || !form.formState.isValid}>Save</Button>
          </DialogFooter>
        </form>
      </Form>
    </DialogContent>
  );
};

export default EditModule;
