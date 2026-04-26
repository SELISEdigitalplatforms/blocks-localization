
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/platform/ui/components/dialog/dialog";
import { ProfileMfaVerifyForm } from "@/features/profile/components/profile-mfa/profile-mfa-veriffy/profile-mfa-verify-form";
import { ProfileMfaVerifyGuideLineTotp } from "@/features/profile/components/profile-mfa/profile-mfa-veriffy/profile-mfa-verify-guideline-totp";
import { ProfileMfaVerifyGuideLineEmail } from "@/features/profile/components/profile-mfa/profile-mfa-veriffy/profile-mfa-verify-guideline-email";
import { useProfileGenerateUserMfaOtp } from "@/features/profile/hooks/use-profile-mfa";
import { profileMfaContext } from "@/features/profile/components/profile-mfa/profile-mfa";
import { useCallback, useContext, useEffect, useRef, useState } from "react";

export function ProfileMFAVerify() {
  const { isVerifyModalOpen, setIsVerifyModalOpen, mfaMethodType, projectKey, userId } =
    useContext(profileMfaContext);
  const { mutateAsync } = useProfileGenerateUserMfaOtp();
  const isFirstMount = useRef<boolean>(true);
  const [mfaId, setMfaId] = useState<string>("");

  const generateOtp = useCallback(async () => {
    try {
      const res = await mutateAsync({ projectKey, userId, mfaType: mfaMethodType });
      if (!res.isSuccess) {
        isFirstMount.current = true;
        setIsVerifyModalOpen(false);
      }
      setMfaId(res.mfaId);
    } catch {
      /* ignore */
    }
  }, [mfaMethodType, mutateAsync, projectKey, setIsVerifyModalOpen, userId]);

  useEffect(() => {
    if (isFirstMount.current && isVerifyModalOpen) {
      isFirstMount.current = false;
      void generateOtp();
    }
  }, [generateOtp, isVerifyModalOpen]);

  return (
    <Dialog
      open={isVerifyModalOpen}
      onOpenChange={(value) => {
        if (!value) isFirstMount.current = true;
        setIsVerifyModalOpen(value);
      }}
    >
      <DialogContent aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>{mfaMethodType === 1 ? "Set up your authenticator app" : null}</DialogTitle>
          <DialogDescription>{mfaMethodType === 1 ? "Please follow the instructions below." : null}</DialogDescription>
        </DialogHeader>
        <div className="text-sm font-normal text-high-emphasis">
          {mfaMethodType === 1 ? (
            <ProfileMfaVerifyGuideLineTotp verifyOpen={isVerifyModalOpen} />
          ) : (
            <ProfileMfaVerifyGuideLineEmail mfaId={mfaId} />
          )}
          <div className="mt-4">
            <ProfileMfaVerifyForm mfaId={mfaId} />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
