
import { profileMfaContext } from "@/features/profile/components/profile-mfa/profile-mfa";
import { ProfileMFAVerify } from "@/features/profile/components/profile-mfa/profile-mfa-veriffy/profile-mfa-verify";
import { UserMFAConfirmationDisable } from "./profile-mfa-confirmation-disable";
import { MFA_Provider_Data } from "@/features/profile/constants/mfa-provider-data";
import { useProfileMfaConfig } from "@/features/profile/hooks/use-profile-mfa";
import { useProfileUserById } from "@/features/profile/hooks/use-profile-user-by-id";
import { Button } from "@/platform/ui/components/button/button";
import { Badge } from "@/platform/ui/components/badge/badge";
import { cn } from "@/platform/ui/lib/cn";
import { CircleOff } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { useContext, useMemo } from "react";

type MethodsOptionProps = {
  method: {
    type: number;
    label: string;
    description: ReactNode;
    Icon: LucideIcon;
  };
  onSaveClick: () => void;
  activeType: string;
  isVerified: boolean;
};

function MethodsOption({ method, onSaveClick, activeType, isVerified }: MethodsOptionProps) {
  const isActive = method.type.toString() === activeType;

  return (
    <div className="flex gap-2 border-b p-4 py-6">
      <div className="w-full">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 text-medium-emphasis">
              <method.Icon className="aspect-square w-4" />
              {method.label}
              {isActive && isVerified ? (
                <Badge variant="outline" className={cn("inline rounded-full border-success py-0 text-xs text-success")}>
                  Active
                </Badge>
              ) : null}
            </div>
            <p className="text-low-emphasis">{method.description}</p>
          </div>
          <div>
            {!isActive ? (
              <Button size="xs" onClick={onSaveClick} variant="outline">
                {method.type === 0 ? "Disable" : "Enable"}
              </Button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

export function ProfileMfaMethodSelectList() {
  const { userId, projectKey, showVerifyModal, setIsDisableModalOpen } = useContext(profileMfaContext);
  const { data } = useProfileMfaConfig({ projectKey });
  const { data: userData } = useProfileUserById({ id: userId, projectKey });

  const availableMFaMethod = useMemo(() => {
    if (!data?.userMfaType?.length) return [];
    return MFA_Provider_Data.filter((item) => data.userMfaType.includes(item.type));
  }, [data?.userMfaType]);

  const saveHandler = (t: number) => {
    showVerifyModal(t);
  };

  const mfaType = userData?.data.userMfaType;
  const activeType = mfaType !== undefined && mfaType !== null ? String(mfaType) : "";

  return (
    <>
      <div className="rounded-sm border">
        <MethodsOption
          method={{
            type: 0,
            label: "None",
            description: "No two-factor authentication.",
            Icon: CircleOff,
          }}
          onSaveClick={() => setIsDisableModalOpen(true)}
          isVerified={true}
          activeType={activeType}
        />
        {availableMFaMethod.map((item) => (
          <MethodsOption
            key={item.type}
            method={item}
            onSaveClick={() => saveHandler(item.type)}
            isVerified={Boolean(userData?.data.isMfaVerified)}
            activeType={activeType}
          />
        ))}
      </div>

      <ProfileMFAVerify />
      <UserMFAConfirmationDisable />
    </>
  );
}
