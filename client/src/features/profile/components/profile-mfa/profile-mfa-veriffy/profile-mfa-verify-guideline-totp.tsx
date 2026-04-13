
import { useContext } from "react";
import { Skeleton } from "@/platform/ui/components/skeleton/skeleton";
import { useProfileTotpSetup } from "@/features/profile/hooks/use-profile-mfa";
import { profileMfaContext } from "@/features/profile/components/profile-mfa/profile-mfa";

export function ProfileMfaVerifyGuideLineTotp({ verifyOpen }: { verifyOpen: boolean }) {
  const { userId, projectKey } = useContext(profileMfaContext);
  const { data } = useProfileTotpSetup({ id: userId, projectKey, enabled: verifyOpen });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-1">
        <span>1.</span>
        <span>Scan the QR code below or enter the setup key to connect your account with an authenticator app.</span>
      </div>
      <div className="flex flex-col items-center gap-4">
        <div className="relative aspect-square w-40 rounded-sm border p-2">
          {data?.qrImageUrl ? (
            <img alt="qr_code" src={data.qrImageUrl} className="h-full w-full object-contain" />
          ) : (
            <Skeleton className="h-full w-full" />
          )}
        </div>
        <div className="text-center">
          <p className="text-medium-emphasis">Or enter this code manually in your app:</p>
          <p className="mt-2 font-semibold">{data?.qrCode}</p>
        </div>
      </div>
      <div className="flex gap-1">
        <span>2.</span>
        <span>Verify the pairing was successful by entering the key displayed on the app</span>
      </div>
    </div>
  );
}
