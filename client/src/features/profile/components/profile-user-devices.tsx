
import { useState } from "react";
import { Card, CardContent } from "@/platform/ui/components/card/card";
import { Pagination } from "@/platform/ui/components/pagination/pagination";
import { ProfileUserDevicesList } from "@/features/profile/components/profile-user-devices-list";
import { useProfileGetSessions } from "@/features/profile/hooks/use-profile-activity";

type DevicesProps = {
  id: string;
  projectKey: string;
};

export function ProfileUserDevices({ id, projectKey }: DevicesProps) {
  const [filter, setFilter] = useState({ page: 0, pageSize: 10, filter: { UserId: id } });
  const { isLoading, isFetching, data } = useProfileGetSessions({
    ...filter,
    projectKey,
  });
  const loading = isLoading || isFetching;
  return (
    <div className="flex w-full flex-col">
      <Card>
        <CardContent>
          <ProfileUserDevicesList isLoading={isLoading || isFetching} data={data?.data || []} />
          {!loading && data && data.totalCount > filter.pageSize ? (
            <div className="mt-5 flex md:justify-end">
              <Pagination
                page={filter.page}
                pageSize={filter.pageSize}
                onChange={(page) => setFilter((f) => ({ ...f, page }))}
                totalCount={data.totalCount || 0}
                pageSizeOptions={[10]}
              />
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
