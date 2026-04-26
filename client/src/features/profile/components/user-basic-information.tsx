
import { Badge } from "@/platform/ui/components/badge/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/platform/ui/components/card/card";
import { Skeleton } from "@/platform/ui/components/skeleton/skeleton";
import { ProfileCopyToClipboardButton } from "@/features/profile/components/profile-copy-button";
import { UserCreationType } from "@/features/profile/lib/user-creation-type";
import { checkValidDate } from "@/features/profile/lib/check-valid-date";
import { formatFullDate } from "@/features/console/lib/format-full-date";
import { useProfileUserById } from "@/features/profile/hooks/use-profile-user-by-id";
import { cn } from "@/platform/ui/lib/cn";

function Item({ label, children, isLoading = false }: { label: string; children?: React.ReactNode; isLoading?: boolean }) {
  return (
    <div className="space-y-1.5">
      <p className="text-sm text-muted-foreground">{label}</p>
      {isLoading ? <Skeleton className="h-6 w-32" /> : <div className="text-base">{children}</div>}
    </div>
  );
}

export function UserBasicInformation({
  id,
  projectKey,
  detailsGridClassName = "",
}: {
  id: string;
  projectKey: string;
  detailsGridClassName?: string;
}) {
  const { isLoading, data } = useProfileUserById({ id, projectKey });

  if (!isLoading && !data) return null;
  const user = data?.data;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Basic Information</CardTitle>
      </CardHeader>
      <CardContent>
        <div className={cn("grid grid-cols-1 gap-4 md:grid-cols-3 md:gap-y-[22px]", detailsGridClassName)}>
          <Item label="Name" isLoading={isLoading}>
            {user?.firstName} {user?.lastName}
          </Item>

          <Item label="Email" isLoading={isLoading}>
            <div className="flex items-center gap-2">
              {user?.email ? (
                <ProfileCopyToClipboardButton textToCopy={user.email}>{user.email}</ProfileCopyToClipboardButton>
              ) : null}
            </div>
          </Item>

          <Item label="No. of logins" isLoading={isLoading}>
            {user?.logInCount ?? "-"}
          </Item>

          <Item label="Status" isLoading={isLoading}>
            <Badge variant={user?.active ? "success" : "error"} className="w-fit rounded-sm py-1.5">
              {user?.active ? "Active" : " Inactive"}
            </Badge>
          </Item>
          <Item label="Latest login" isLoading={isLoading}>
            {user?.lastLoggedInTime && checkValidDate(user.lastLoggedInTime)
              ? formatFullDate(new Date(user.lastLoggedInTime))
              : "-"}
          </Item>

          <Item label="Signed up" isLoading={isLoading}>
            {user?.userCreationType !== undefined && UserCreationType[user.userCreationType] ? (
              <Badge variant="info" className="w-fit">
                {UserCreationType[user.userCreationType]}
              </Badge>
            ) : (
              ""
            )}
          </Item>
        </div>
      </CardContent>
    </Card>
  );
}
