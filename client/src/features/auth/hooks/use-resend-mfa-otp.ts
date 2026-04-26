import { resendMfaOtp } from "@/features/auth/services/auth-api";
import { useCountDown } from "@/hooks/use-count-down";
import { useMutation } from "@tanstack/react-query";
import { useCallback } from "react";

type UseResendMfaOtpOptions = {
  mfaId: string;
};

/**
 * Parity with `idp/mfa/hooks/use-resend-otp.ts`: 300s cooldown after successful resend;
 * POST body is the `mfaId` string (JSON).
 */
export function useResendMfaOtp({ mfaId }: UseResendMfaOtpOptions) {
  const { remainingTime, reset } = useCountDown(300);
  const { mutateAsync } = useMutation({
    mutationKey: ["mfa", "resend-otp", mfaId],
    mutationFn: () => resendMfaOtp(mfaId),
  });

  const resend = useCallback(async () => {
    if (!mfaId) return;
    try {
      await mutateAsync();
      reset();
    } catch {
      // Monolith only logs; keep same low-noise behavior.
    }
  }, [mfaId, mutateAsync, reset]);

  return { remainingTime, resend };
}
