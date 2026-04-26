
import { env } from "@/config/env";
import { ProfileDetails } from "@/features/profile/components/profile-details";
import { ProfileUpdateUserDialog } from "@/features/profile/components/profile-update-user-dialog";
import { ProfileUserDevices } from "@/features/profile/components/profile-user-devices";
import { ProfileUserHistories } from "@/features/profile/components/profile-user-histories";
import { ProfileUserPats } from "@/features/profile/components/profile-user-pats";
import { useProfileUserById } from "@/features/profile/hooks/use-profile-user-by-id";
import {
  segmentedTabsListClass,
  segmentedTabsTriggerClass,
} from "@/platform/ui/components/tabs/segmented-tabs-classes";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/platform/ui/components/tabs/tabs";
import { useCallback, useMemo } from "react";
import { useSearchParams } from "react-router-dom";

const VALID_TAB = ["details", "devices", "history", "personalAccessTokens"] as const;
type TabValue = (typeof VALID_TAB)[number];

function isTabValue(v: string): v is TabValue {
  return (VALID_TAB as readonly string[]).includes(v);
}

export function ProfileConsoleView({ userId }: { userId: string }) {
  const projectKey = env.xBlocksKey || "";
  const [searchParams, setSearchParams] = useSearchParams();

  const tabId = useMemo(() => {
    const raw = searchParams.get("userDetails") ?? "details";
    return isTabValue(raw) ? raw : "details";
  }, [searchParams]);

  const setTabId = useCallback(
    (next: string) => {
      const v = isTabValue(next) ? next : "details";
      setSearchParams(
        (prev) => {
          const p = new URLSearchParams(prev);
          if (v === "details") p.delete("userDetails");
          else p.set("userDetails", v);
          return p;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  const { data } = useProfileUserById({ id: userId, projectKey });

  return (
    <div className="flex w-full flex-col px-5 pt-4 pb-8 md:px-16 md:pb-16">
      <div className="flex items-center justify-between text-base text-high-emphasis md:mt-[20px]">
        <h3 className="text-2xl font-semibold">
          {data?.data.firstName} {data?.data.lastName}
        </h3>
      </div>
      <Tabs value={tabId} onValueChange={setTabId} className="w-full">
        <div className="mb-5 mt-6 flex items-center justify-between rounded text-base">
          <TabsList className={segmentedTabsListClass}>
            <TabsTrigger value="details" className={segmentedTabsTriggerClass}>
              Details
            </TabsTrigger>
            <TabsTrigger value="devices" className={segmentedTabsTriggerClass}>
              Devices
            </TabsTrigger>
            <TabsTrigger value="history" className={segmentedTabsTriggerClass}>
              History
            </TabsTrigger>
            <TabsTrigger value="personalAccessTokens" className={segmentedTabsTriggerClass}>
              PATs
            </TabsTrigger>
          </TabsList>
          {tabId === "details" ? <ProfileUpdateUserDialog id={userId} projectKey={projectKey} own /> : null}
        </div>

        <TabsContent value="details" className="mt-0 focus-visible:ring-0 focus-visible:ring-offset-0 data-[state=inactive]:hidden">
          <ProfileDetails id={userId} />
        </TabsContent>

        <TabsContent value="devices" className="mt-0 focus-visible:ring-0 focus-visible:ring-offset-0 data-[state=inactive]:hidden">
          <ProfileUserDevices id={userId} projectKey={projectKey} />
        </TabsContent>
        <TabsContent value="history" className="mt-0 focus-visible:ring-0 focus-visible:ring-offset-0 data-[state=inactive]:hidden">
          <ProfileUserHistories id={userId} projectKey={projectKey} />
        </TabsContent>
        <TabsContent
          value="personalAccessTokens"
          className="mt-0 focus-visible:ring-0 focus-visible:ring-offset-0 data-[state=inactive]:hidden"
        >
          <ProfileUserPats id={userId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
