import { formatFullDate } from "@/features/console/lib/format-full-date";
import type { User } from "@/features/profile/model/profile-user.types";
import { checkValidDate } from "@/features/profile/lib/check-valid-date";
import { ProfileCopyToClipboardButton } from "@/features/profile/components/profile-copy-button";
import { Card, CardContent, CardHeader, CardTitle } from "@/platform/ui/components/card/card";
import { Skeleton } from "@/platform/ui/components/skeleton/skeleton";

type UserWithRoles = User & { roles?: string[] };

function Item({
  label,
  children,
  isLoading,
}: {
  label: string;
  children?: React.ReactNode;
  isLoading?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <p className="text-sm text-muted-foreground">{label}</p>
      {isLoading ? <Skeleton className="h-6 w-32" /> : <div className="text-base font-medium">{children}</div>}
    </div>
  );
}

export function ProjectOverviewPeopleBasicInfo({
  className,
  user,
  isLoading,
}: {
  className?: string;
  user?: UserWithRoles;
  isLoading?: boolean;
}) {
  const u = user;
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>Basic Information</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          <Item label="Name" isLoading={isLoading}>
            {u ? `${u.firstName} ${u.lastName || ""}`.trim() || "—" : "—"}
          </Item>

          <Item label="Email" isLoading={isLoading}>
            {u?.email ? (
              <div className="flex items-center gap-2">
                <ProfileCopyToClipboardButton textToCopy={u.email}>
                  <span>{u.email}</span>
                </ProfileCopyToClipboardButton>
              </div>
            ) : (
              "—"
            )}
          </Item>

          <Item label="Role" isLoading={isLoading}>
            {u?.roles?.length ? u.roles.join(", ") : "—"}
          </Item>

          <Item label="Latest Login" isLoading={isLoading}>
            {u?.lastLoggedInTime && checkValidDate(u.lastLoggedInTime)
              ? formatFullDate(new Date(u.lastLoggedInTime))
              : "—"}
          </Item>

          <Item label="Browser" isLoading={isLoading}>
            —
          </Item>

          <Item label="Signed up" isLoading={isLoading}>
            {u?.createdDate && checkValidDate(u.createdDate) ? formatFullDate(new Date(u.createdDate)) : "—"}
          </Item>
        </div>
      </CardContent>
    </Card>
  );
}
