
import { Button } from "@/platform/ui/components/button/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/platform/ui/components/dialog/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/platform/ui/components/form/form";
import { Input } from "@/platform/ui/components/input/input";
import { showErrorToast, showSuccessToast } from "@/platform/ui/hooks/use-toast";
import { isErrorWithErrors } from "@/lib/error";
import { useProfileUpdateUser } from "@/features/profile/hooks/use-profile-update-user";
import { useProfileUserById } from "@/features/profile/hooks/use-profile-user-by-id";
import { zodResolver } from "@hookform/resolvers/zod";
import { Pen } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

const inviteUserFormDefaultValue = { firstName: "", lastName: "" };

const inviteUserFormSchema = z.object({
  firstName: z.string().trim().min(1, "First name is required").max(150, "First name must be at most 150 characters"),
  lastName: z.string().trim().min(1, "Last name is required").max(150, "Last name must be at most 150 characters"),
});

type UpdateUserProps = {
  id: string;
  projectKey: string;
  own?: boolean;
};

export function ProfileUpdateUserDialog({ id, projectKey, own = false }: UpdateUserProps) {
  const [open, setOpen] = useState<boolean>(false);
  const { data, isLoading, isFetching } = useProfileUserById({ id, projectKey });
  const { isPending, mutateAsync } = useProfileUpdateUser({ id, projectKey, own });

  const form = useForm({
    defaultValues: inviteUserFormDefaultValue,
    resolver: zodResolver(inviteUserFormSchema),
    values: data?.data
      ? { firstName: data.data.firstName, lastName: data.data.lastName }
      : inviteUserFormDefaultValue,
  });

  const {
    formState: { isDirty },
  } = form;

  const onSubmitHandler = async (values: z.infer<typeof inviteUserFormSchema>) => {
    try {
      const res = await mutateAsync({
        ...data?.data,
        ...values,
        itemId: id,
        projectKey,
      });
      if (!res.isSuccess) return showErrorToast({ errors: res.errors });
      showSuccessToast({ description: "User updated successfully" });
      form.reset();
      setOpen(false);
    } catch (error) {
      if (isErrorWithErrors(error)) return showErrorToast({ errors: error.errors });
      showErrorToast({ errors: "Something went wrong" });
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        form.reset(data?.data ? { firstName: data.data.firstName, lastName: data.data.lastName } : inviteUserFormDefaultValue);
        setOpen(value);
      }}
    >
      <DialogTrigger asChild>
        <Button type="button" className="gap-2">
          <Pen className="h-4 w-4" />
          Edit User
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit User</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmitHandler)}>
            <div className="flex flex-col gap-4">
              <FormField
                control={form.control}
                name="firstName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>First name</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter first name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="lastName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Last name</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter last name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <DialogFooter className="mt-6">
              <DialogClose asChild>
                <Button variant="secondary" disabled={isPending} type="button">
                  Cancel
                </Button>
              </DialogClose>
              <Button disabled={isPending || isLoading || isFetching || !isDirty} type="submit">
                Save
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
