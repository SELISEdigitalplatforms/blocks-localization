import { useInvitePeopleMutation } from "@/features/console/hooks/use-project-overview-mutations";
import { useConsoleProjectStore } from "@/features/console/state/console-project-store";
import { Button } from "@/platform/ui/components/button/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/platform/ui/components/dialog/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from "@/platform/ui/components/form/form";
import { Input } from "@/platform/ui/components/input/input";
import { MultiSelect } from "@/platform/ui/components/multi-select/multi-select";
import { showErrorToast, showSuccessToast } from "@/platform/ui/hooks/use-toast";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { z } from "zod";

const emailRegex = /^(?=.{1,320}$)[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

const formSchema = z.object({
  invitations: z.array(
    z.object({
      recipients: z
        .string()
        .min(1, "Recipient is required")
        .refine((val) => {
          const emails = val
            .split(/[\s,]+/)
            .map((e) => e.trim())
            .filter((e) => e.length > 0);
          if (emails.length === 0) return false;
          return emails.every((email) => emailRegex.test(email));
        }, "Invalid email format"),
      projectKeys: z.array(z.string()).min(1, "At least one environment is required"),
    }),
  ),
});

export type ProjectEnvOption = { tenantId: string; label: string };

type InvitePeopleProps = {
  existingEmails?: string[];
  isViewerOwner?: boolean;
  environmentOptions: ProjectEnvOption[];
};

export function ProjectOverviewInvitePeople({
  existingEmails = [],
  isViewerOwner = false,
  environmentOptions,
}: InvitePeopleProps) {
  const groupId = useConsoleProjectStore((s) => s.selectedTenantGroup) ?? "";
  const { mutateAsync, isPending } = useInvitePeopleMutation();
  const [open, setOpen] = useState(false);

  const multiSelectOptions = useMemo(
    () => environmentOptions.map((o) => ({ value: o.tenantId, label: o.label })),
    [environmentOptions],
  );

  const existingEmailSet = useMemo(
    () => new Set(existingEmails.map((e) => e.toLowerCase())),
    [existingEmails],
  );

  const dynamicFormSchema = useMemo(
    () =>
      formSchema.superRefine((data, ctx) => {
        const emailCounts = new Map<string, number>();

        data.invitations.forEach((inv) => {
          const emails = inv.recipients
            .split(/[\s,]+/)
            .map((e) => e.trim().toLowerCase())
            .filter((e) => e.length > 0 && emailRegex.test(e));

          emails.forEach((email) => {
            emailCounts.set(email, (emailCounts.get(email) || 0) + 1);
          });
        });

        data.invitations.forEach((inv, index) => {
          const emails = inv.recipients
            .split(/[\s,]+/)
            .map((e) => e.trim().toLowerCase())
            .filter((e) => e.length > 0 && emailRegex.test(e));

          const duplicates = emails.filter((email) => existingEmailSet.has(email));
          if (duplicates.length > 0) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: `Already invited: ${duplicates.join(", ")}`,
              path: ["invitations", index, "recipients"],
            });
          }

          const duplicatesInForm = emails.filter((email) => (emailCounts.get(email) || 0) > 1);
          const uniqueDuplicates = Array.from(new Set(duplicatesInForm));
          const finalDuplicates = uniqueDuplicates.filter((email) => !existingEmailSet.has(email));

          if (finalDuplicates.length > 0) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: `Duplicate email: ${finalDuplicates.join(", ")}`,
              path: ["invitations", index, "recipients"],
            });
          }
        });
      }),
    [existingEmailSet],
  );

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(dynamicFormSchema),
    defaultValues: { invitations: [{ recipients: "", projectKeys: [] }] },
    mode: "onChange",
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "invitations",
  });

  useEffect(() => {
    if (open) {
      form.reset({ invitations: [{ recipients: "", projectKeys: [] }] });
      form.clearErrors();
    }
  }, [open, form]);

  const onSubmit = form.handleSubmit(async (values) => {
    const invitationsMap: Record<string, string[]> = {};
    for (const inv of values.invitations) {
      const emails = inv.recipients
        .split(/[\s,]+/)
        .map((e) => e.trim())
        .filter((e) => e.length > 0 && emailRegex.test(e));
      const uniqueEmails = Array.from(new Set(emails.map((e) => e.toLowerCase())));
      for (const email of uniqueEmails) {
        if (!invitationsMap[email]) invitationsMap[email] = [];
        for (const pk of inv.projectKeys) {
          if (!invitationsMap[email].includes(pk)) invitationsMap[email].push(pk);
        }
      }
    }
    if (Object.keys(invitationsMap).length === 0) {
      showErrorToast({ errors: "Please add at least one valid recipient and environment" });
      return;
    }
    try {
      const res = await mutateAsync({ invitations: invitationsMap, groupId });
      if (!res.isSuccess) {
        const err = res.errors as { exceed_limit?: string; resource_limit_exceeded?: string } | null;
        const msg =
          err?.exceed_limit ||
          err?.resource_limit_exceeded ||
          "Invitation could not be sent";
        showErrorToast({ errors: msg });
        return;
      }
      showSuccessToast({ description: "Invitation is sent" });
      form.reset();
      setOpen(false);
    } catch (error) {
      const err = error as { errors?: { exceed_limit?: string; resource_limit_exceeded?: string } };
      const msg =
        err?.errors?.exceed_limit ||
        err?.errors?.resource_limit_exceeded ||
        (error instanceof Error ? error.message : "An error occurred");
      showErrorToast({ errors: String(msg) });
    }
  });

  if (!isViewerOwner) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="default" className="h-10 text-sm text-primary-foreground" type="button">
          <Plus className="mr-2 h-4 w-4" />
          <span>Invite</span>
        </Button>
      </DialogTrigger>
      <DialogContent
        hideCloseButton
        className="flex max-h-[85vh] flex-col overflow-hidden sm:max-w-md md:min-w-[900px]"
      >
        <DialogHeader>
          <DialogTitle>Invite people</DialogTitle>
          <DialogDescription className="!mt-2 text-sm text-medium-emphasis">
            Invite new people to the project
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={onSubmit} className="flex min-h-0 flex-col">
            <div className="flex-1 overflow-y-auto p-1 pr-2">
              <div className="space-y-6">
                <div className="hidden w-full gap-4 text-sm font-medium text-muted-foreground sm:flex">
                  <div className="w-[45%]">Recipient(s)</div>
                  <div className="w-[45%]">Environments</div>
                  <div className="w-[10%]" />
                </div>
                {fields.map((field, index) => (
                  <div
                    key={field.id}
                    className="relative flex w-full flex-col items-start gap-4 sm:flex-row"
                  >
                    <div className="flex w-full gap-2 sm:w-[45%]">
                      <FormField
                        control={form.control}
                        name={`invitations.${index}.recipients`}
                        render={({ field: emailField, fieldState }) => (
                          <FormItem className="w-full">
                            <FormControl>
                              <Input {...emailField} placeholder="Enter email" />
                            </FormControl>
                            {fieldState.isTouched ? <FormMessage /> : null}
                          </FormItem>
                        )}
                      />
                      {fields.length > 1 ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="text-muted-foreground hover:text-destructive sm:hidden"
                          onClick={() => remove(index)}
                          aria-label="Remove row"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      ) : null}
                    </div>
                    <FormField
                      control={form.control}
                      name={`invitations.${index}.projectKeys`}
                      render={({ field: projectField }) => (
                        <FormItem className="w-full sm:w-[45%]">
                          <FormControl>
                            <MultiSelect
                              title="Select environments"
                              options={multiSelectOptions}
                              selected={projectField.value}
                              onSelectChange={(val) => projectField.onChange(val)}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className="hidden w-[10%] justify-center sm:flex">
                      {fields.length > 1 ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="text-muted-foreground hover:text-destructive"
                          onClick={() => remove(index)}
                          aria-label="Remove row"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      ) : null}
                    </div>
                  </div>
                ))}

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-2"
                  onClick={() => append({ recipients: "", projectKeys: [] })}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add another
                </Button>
              </div>
            </div>

            <DialogFooter className="mt-auto pt-4 sm:justify-end">
              <DialogClose asChild>
                <Button type="button" variant="secondary" disabled={isPending}>
                  Cancel
                </Button>
              </DialogClose>
              <Button type="submit" disabled={isPending || !form.formState.isValid}>
                {isPending ? "Sending…" : "Send"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
