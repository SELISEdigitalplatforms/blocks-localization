import { verifyMfa } from "@/features/auth/services/auth-api";
import { useAuthStore } from "@/features/auth/model/auth-store";
import { useResendMfaOtp } from "@/features/auth/hooks/use-resend-mfa-otp";
import { isErrorWithErrors } from "@/lib/error";
import { HttpError } from "@/platform/api/idp-http";
import { persistLocalApiBearerFromOAuthBody } from "@/platform/api/local-api-bearer";
import { Button } from "@/platform/ui/components/button/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from "@/platform/ui/components/form/form";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/platform/ui/components/input-otp/input-otp";
import { showErrorToast } from "@/platform/ui/hooks/use-toast";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { useNavigate, useSearchParams } from "react-router-dom";
import { z } from "zod";

function CustomInputOTPSlot({ index }: { index: number }) {
  return (
    <InputOTPSlot
      index={index}
      className="h-12 w-11.5 rounded-sm border px-4 py-3.5 first:rounded-l-sm first:border-l last:rounded-r-sm"
    />
  );
}

function getFormSchema(type: number) {
  return z.object({
    code: z.string().min(type === 2 ? 5 : 6),
  });
}

export function MfaCheckForm() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const mfaId = searchParams.get("mfa_id") ?? "";
  const mfaTypeRaw = searchParams.get("mfa_type");
  const mfaType = mfaTypeRaw != null && mfaTypeRaw !== "" ? Number(mfaTypeRaw) : 0;

  const { setAuthenticated } = useAuthStore();
  const { remainingTime, resend } = useResendMfaOtp({ mfaId });

  const form = useForm<{ code: string }>({
    resolver: zodResolver(getFormSchema(mfaType)),
    defaultValues: { code: "" },
  });

  const { isPending, mutateAsync } = useMutation({
    mutationKey: ["mfa", "verify", mfaId, mfaType],
    mutationFn: (code: string) =>
      verifyMfa({ code, mfa_id: mfaId, mfa_type: mfaType }),
  });

  const submitHandler = async ({ code }: { code: string }) => {
    try {
      const tokenRes = await mutateAsync(code);
      persistLocalApiBearerFromOAuthBody(tokenRes);
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

  const { isValid } = form.formState;

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(submitHandler)}>
        <FormField
          control={form.control}
          name="code"
          render={({ field }) => (
            <FormItem>
              <FormControl>
                <InputOTP maxLength={mfaType === 1 ? 6 : 5} {...field}>
                  <InputOTPGroup className="w-full justify-between gap-6">
                    <CustomInputOTPSlot index={0} />
                    <CustomInputOTPSlot index={1} />
                    <CustomInputOTPSlot index={2} />
                    <CustomInputOTPSlot index={3} />
                    <CustomInputOTPSlot index={4} />
                    {mfaType === 1 && <CustomInputOTPSlot index={5} />}
                  </InputOTPGroup>
                </InputOTP>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        {mfaType === 2 && (
          <div className="mt-4 text-right">
            <Button
              type="button"
              variant="link"
              className="p-0 text-sm font-medium !no-underline"
              onClick={() => void resend()}
              disabled={!!remainingTime}
            >
              Resend Otp
              {remainingTime > 0 &&
                ` (${Math.floor(remainingTime / 60)}:${String(remainingTime % 60).padStart(2, "0")})`}
            </Button>
          </div>
        )}

        <div className="mt-4">
          <Button className="w-full" disabled={!isValid || isPending}>
            Verify
          </Button>
        </div>
      </form>
    </Form>
  );
}
