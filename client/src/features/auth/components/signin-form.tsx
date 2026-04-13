import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/platform/ui/components/form/form";
import { useForm } from "react-hook-form";
import { signinFormDefaultValue, signinFormSchema } from "@/features/auth/model/schema";
import { zodResolver } from "@hookform/resolvers/zod";
import { Input } from "@/platform/ui/components/input/input";
import { PasswordInput } from "@/features/auth/components/password-input";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/platform/ui/components/button/button";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { signinByEmail } from "@/features/auth/services/auth-api";
import { useAuthStore } from "@/features/auth/model/auth-store";
import { showErrorToast } from "@/platform/ui/hooks/use-toast";
import { isErrorWithErrors } from "@/lib/error";
import { isMfaRequired } from "@/features/auth/model/types";
import { HttpError } from "@/platform/api/idp-http";

export function SigninForm() {
  const navigate = useNavigate();
  const { setAuthenticated } = useAuthStore();
  const form = useForm({
    defaultValues: signinFormDefaultValue,
    resolver: zodResolver(signinFormSchema),
  });

  const { isPending, mutateAsync } = useMutation({
    mutationKey: ["login", "email"],
    mutationFn: ({ username, password }: z.infer<typeof signinFormSchema>) =>
      signinByEmail(username, password),
  });

  const onSubmitHandler = async (values: z.infer<typeof signinFormSchema>) => {
    try {
      const res = await mutateAsync(values);
      if (isMfaRequired(res)) {
        navigate(`/mfa-check?mfa_id=${encodeURIComponent(res.mfaId)}&mfa_type=${res.mfaType}`);
        return;
      }
      setAuthenticated();
      navigate("/console");
    } catch (error: unknown) {
      if (error instanceof HttpError) {
        const desc = error.errors.error_description;
        showErrorToast({
          errors:
            (typeof desc === "string" ? desc : undefined) ||
            error.errors.message ||
            "Something went wrong",
        });
      } else if (isErrorWithErrors(error)) {
        const raw = error.errors.error_description;
        showErrorToast({
          errors: (typeof raw === "string" ? raw : undefined) || "Something went wrong",
        });
      } else {
        showErrorToast({ errors: "Something went wrong" });
      }
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmitHandler)} className="flex flex-col gap-4">
        <FormField
          control={form.control}
          name="username"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email</FormLabel>
              <FormControl>
                <Input placeholder="Enter your email" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Password</FormLabel>
              <FormControl>
                <PasswordInput placeholder="Enter your password" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Link to="/forgot-password" className="ml-auto inline-block text-sm text-primary">
          Forgot password?
        </Link>

        <Button type="submit" className="w-full rounded" disabled={isPending}>
          Log in
        </Button>
      </form>
    </Form>
  );
}
