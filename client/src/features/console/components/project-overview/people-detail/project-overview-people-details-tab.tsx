import type { User } from "@/features/profile/model/profile-user.types";
import { User as UserIcon } from "lucide-react";
import { ProjectOverviewPeopleBasicInfo } from "./project-overview-people-basic-info";

export function ProjectOverviewPeopleDetailsTab({
  user,
  isLoading,
}: {
  user?: User;
  isLoading?: boolean;
}) {
  const url = user?.profileImageUrl;

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
      <div className="col-span-full lg:col-span-2">
        <div className="relative aspect-square w-full max-w-[200px] overflow-hidden rounded-full bg-muted">
          {url ? (
            <img src={url} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-muted-foreground">
              <UserIcon className="h-16 w-16" aria-hidden />
            </div>
          )}
        </div>
      </div>
      <div className="lg:col-span-10">
        <ProjectOverviewPeopleBasicInfo user={user} isLoading={isLoading} />
      </div>
    </div>
  );
}
