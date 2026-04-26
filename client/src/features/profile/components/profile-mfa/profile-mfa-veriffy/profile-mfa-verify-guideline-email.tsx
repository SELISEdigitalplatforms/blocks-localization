
import { useContext } from "react";
import { Button } from "@/platform/ui/components/button/button";
import { useProfileUserById } from "@/features/profile/hooks/use-profile-user-by-id";
import { useProfileResendOtp } from "@/features/profile/hooks/use-profile-resend-otp";
import { profileMfaContext } from "@/features/profile/components/profile-mfa/profile-mfa";

export function ProfileMfaVerifyGuideLineEmail({ mfaId }: { mfaId: string }) {
  const { userId, projectKey } = useContext(profileMfaContext);
  const { data } = useProfileUserById({ id: userId, projectKey });
  const { remainingTime, resend } = useProfileResendOtp({ mfaId });

  const resendButtonLabel = remainingTime
    ? `Resend in (${Math.floor(remainingTime / 60)}:${String(remainingTime % 60).padStart(2, "0")})`
    : "Resend";

  const mailImage = `${import.meta.env.BASE_URL}assets/images/mail-sent.png`;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-center">
        <img src={mailImage} alt="email sent" width={120} height={100} />
      </div>
      <div className="mt-6">
        <h3 className="text-2xl font-bold">Email sent</h3>
        <p className="mt-2">We’ve sent a verification key to your registered email address ({data?.data.email}). </p>
      </div>
      <p>
        Did not receive email?{" "}
        <Button
          variant="link"
          className="p-0 text-sm font-medium !no-underline"
          disabled={Boolean(remainingTime)}
          type="button"
          onClick={() => void resend()}
        >
          {resendButtonLabel}
        </Button>
      </p>
      <p>Please enter the key below to complete your setup. </p>
    </div>
  );
}
