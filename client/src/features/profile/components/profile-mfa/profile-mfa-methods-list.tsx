
import { Badge } from "@/platform/ui/components/badge/badge";
import { Label } from "@/platform/ui/components/label/label";
import { RadioGroup, RadioGroupItem } from "@/platform/ui/components/radio-group/radio-group";
import { Skeleton } from "@/platform/ui/components/skeleton/skeleton";
import { MFA_Provider_Data } from "@/features/profile/constants/mfa-provider-data";
import { useProfileMfaConfig } from "@/features/profile/hooks/use-profile-mfa";
import { useProfileUserById } from "@/features/profile/hooks/use-profile-user-by-id";
import { profileMfaContext } from "@/features/profile/components/profile-mfa/profile-mfa";
import { useContext, useMemo } from "react";

type UserMFAMethodListProps = {
  selected: number;
  setSelected: (selected: number) => void;
};

export function ProfileMFAMethodList({ selected, setSelected }: UserMFAMethodListProps) {
  const { userId, projectKey } = useContext(profileMfaContext);
  const { isLoading, isFetching, data } = useProfileMfaConfig({ projectKey });
  const { data: userData } = useProfileUserById({ id: userId, projectKey });
  const availableMFaMethod = useMemo(() => {
    if (!data?.userMfaType.length) return [];
    return MFA_Provider_Data.filter((item) => data.userMfaType.includes(item.type));
  }, [data?.userMfaType]);

  return (
    <>
      {isLoading || isFetching ? (
        <div>
          <Skeleton className="h-5 w-1/2" />
          <Skeleton className="mt-2 h-5 w-full" />
          <Skeleton className="mt-2 h-5 w-full" />
        </div>
      ) : (
        <RadioGroup
          defaultValue={selected.toString()}
          onValueChange={(val) => setSelected(Number(val))}
          className="gap-5"
        >
          {availableMFaMethod.map((item) => (
            <div key={item.type} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <RadioGroupItem value={item.type.toString()} id={item.type.toString()} />
                <Label htmlFor={item.type.toString()} className="cursor-pointer text-sm font-medium">
                  {item.label}
                </Label>
              </div>
              {userData && userData.data.mfaEnabled && userData.data.userMfaType === item.type ? (
                <Badge variant="success"> Enabled</Badge>
              ) : null}
            </div>
          ))}
        </RadioGroup>
      )}
    </>
  );
}
