
import { Card, CardContent, CardHeader, CardTitle } from "@/platform/ui/components/card/card";
import { Button } from "@/platform/ui/components/button/button";
import { Skeleton } from "@/platform/ui/components/skeleton/skeleton";
import { ProfileMFADetails } from "@/features/profile/components/profile-mfa/profile-mfa-detail";
import { ProfileMfaMethodSelectList } from "@/features/profile/components/profile-mfa/profile-mfa-methods-select-list";
import { useProfileMfaConfig } from "@/features/profile/hooks/use-profile-mfa";
import { mainAppPath } from "@/features/console/lib/main-app-url";
import { createContext, useState } from "react";

type ProfileMFAProps = {
  userId: string;
  projectKey: string;
};

export const ProfileConfigMFA = () => {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Multi-factor Authentication</CardTitle>
      </CardHeader>
      <CardContent>
        <ProfileMFADetails />
        <div className="mt-6">
          <ProfileMfaMethodSelectList />
        </div>
      </CardContent>
    </Card>
  );
};

export const ProjectMFA = () => {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Multi-factor Authentication</CardTitle>
          <Button asChild variant="outline" size="sm">
            <a href={mainAppPath("/services/mfa")} target="_blank" rel="noreferrer">
              Go to MFA Settings
            </a>
          </Button>
        </div>
      </CardHeader>
      <CardContent className="!pt-0">
        <div className="space-y-2 text-base font-normal text-high-emphasis">
          <p>
            Multi-Factor Authentication (MFA) enhances your account security by requiring an additional
            verification step. To enable MFA, you need to first activate it for your project.
          </p>
        </div>
      </CardContent>
    </Card>
  );
};

const LoadingSkelton = () => {
  return (
    <Card className="rounded shadow-none">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-xl text-high-emphasis">Multi-factor Authentication</CardTitle>
          <Skeleton className="h-6 w-1/6" />
        </div>
      </CardHeader>
      <CardContent className="!pt-0">
        <Skeleton className="h-6 w-1/2" />
        <Skeleton className="my-2 h-6" />
        <Skeleton className="my-2 h-6" />
      </CardContent>
    </Card>
  );
};

export const profileMfaContext = createContext<
  ProfileMFAProps & {
    isVerifyModalOpen: boolean;
    setIsVerifyModalOpen: (value: boolean) => void;
    isDisableModalOpen: boolean;
    setIsDisableModalOpen: (value: boolean) => void;
    showVerifyModal: (type: number) => void;
    mfaMethodType: number;
  }
>({
  projectKey: "",
  userId: "",
  isVerifyModalOpen: false,
  setIsVerifyModalOpen: () => {},
  isDisableModalOpen: false,
  setIsDisableModalOpen: () => {},
  showVerifyModal: () => {},
  mfaMethodType: 0,
});

export function ProfileMFA(props: ProfileMFAProps) {
  const { projectKey } = props;
  const [isVerifyModalOpen, setIsVerifyModalOpen] = useState<boolean>(false);
  const [isDisableModalOpen, setIsDisableModalOpen] = useState<boolean>(false);
  const [mfaMethodType, setMfaMethodType] = useState<number>(0);
  const { isLoading, data } = useProfileMfaConfig({ projectKey });
  if (isLoading) return <LoadingSkelton />;
  if (!data?.enableMfa) return <ProjectMFA />;

  const showVerifyModal = (type: number) => {
    setMfaMethodType(type);
    setIsVerifyModalOpen(true);
  };

  return (
    <profileMfaContext.Provider
      value={{
        ...props,
        isVerifyModalOpen,
        setIsVerifyModalOpen,
        showVerifyModal,
        mfaMethodType,
        isDisableModalOpen,
        setIsDisableModalOpen,
      }}
    >
      <ProfileConfigMFA />
    </profileMfaContext.Provider>
  );
}
