import { useCountDown } from "@/features/profile/hooks/use-count-down";
import { useProfileResendMfaOtp } from "@/features/profile/hooks/use-profile-mfa";
import { useCallback } from "react";

export function useProfileResendOtp({ mfaId }: { mfaId: string }) {
  const { remainingTime, reset } = useCountDown(300);
  const { mutateAsync } = useProfileResendMfaOtp();

  const resend = useCallback(async () => {
    try {
      await mutateAsync({ mfaId });
      reset();
    } catch {
      /* ignore */
    }
  }, [mfaId, mutateAsync, reset]);

  return { remainingTime, reset, resend };
}
