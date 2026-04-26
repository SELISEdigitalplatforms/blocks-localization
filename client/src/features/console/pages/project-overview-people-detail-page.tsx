import { ProjectOverviewPeopleDetailsTab } from "@/features/console/components/project-overview/people-detail/project-overview-people-details-tab";
import { ProjectOverviewPeopleEnvironments } from "@/features/console/components/project-overview/people-detail/project-overview-people-environments";
import { useConsoleProjects } from "@/features/console/hooks/use-console-projects";
import { useIdentifierPeople } from "@/features/console/hooks/use-identifier-people";
import { useConsoleProjectStore } from "@/features/console/state/console-project-store";
import { env } from "@/config/env";
import { ProfileUserDevices } from "@/features/profile/components/profile-user-devices";
import { useProfileUserById } from "@/features/profile/hooks/use-profile-user-by-id";
import { Badge } from "@/platform/ui/components/badge/badge";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/platform/ui/components/breadcrumb/breadcrumb";
import { Button } from "@/platform/ui/components/button/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/platform/ui/components/select/select";
import { Skeleton } from "@/platform/ui/components/skeleton/skeleton";
import {
  segmentedTabsListClass,
  segmentedTabsTriggerClass,
} from "@/platform/ui/components/tabs/segmented-tabs-classes";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/platform/ui/components/tabs/tabs";
import { PageMeta } from "@/seo/page-meta";
import { ArrowLeft } from "lucide-react";
import { useCallback, useMemo } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";

const VALID_TAB = ["details", "environments", "devices"] as const;
type TabValue = (typeof VALID_TAB)[number];

function isTabValue(v: string): v is TabValue {
  return (VALID_TAB as readonly string[]).includes(v);
}

function PendingInviteBadge() {
  return (
    <Badge className="w-fit bg-amber-100 px-2 py-0.5 text-xs font-normal text-amber-800 dark:bg-amber-950 dark:text-amber-200">
      Pending Invite
    </Badge>
  );
}

function InactiveUserBadge() {
  return (
    <Badge className="w-fit bg-red-100 px-2 py-0.5 text-xs font-normal text-red-800 dark:bg-red-950 dark:text-red-200">
      Inactive
    </Badge>
  );
}

export function ProjectOverviewPeopleDetailPage() {
  const { userId = "" } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const groupId = useConsoleProjectStore((s) => s.selectedTenantGroup) ?? "";
  const projectKey = env.xBlocksKey || "";

  const currentTab = useMemo(() => {
    const raw = searchParams.get("tab") ?? "details";
    return isTabValue(raw) ? raw : "details";
  }, [searchParams]);

  const setTab = useCallback(
    (value: string) => {
      const next = isTabValue(value) ? value : "details";
      setSearchParams(
        (prev) => {
          const p = new URLSearchParams(prev);
          if (next === "details") p.delete("tab");
          else p.set("tab", next);
          return p;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  const { data: userResponse, isLoading: isUserLoading } = useProfileUserById({
    id: userId,
    projectKey,
  });
  const user = userResponse?.data;
  const fullName = user ? `${user.firstName} ${user.lastName || ""}`.trim() : "";

  const { data: peoplePack, isLoading: isPeopleLoading } = useIdentifierPeople({
    page: 0,
    pageSize: 100,
    filter: user?.email ?? "",
    enabled: Boolean(user?.email),
  });

  const { data: environmentList, isLoading: isProjectLoading } = useConsoleProjects(groupId);

  const peoples = peoplePack?.peoples ?? [];
  const isViewerOwner = peoplePack?.isOwner ?? false;

  const sharedEnvironments = peoples[0]?.sharedEnviroments ?? [];
  const isPendingInvite =
    sharedEnvironments.some((e) => !e.isInvitationConfirmed) &&
    !sharedEnvironments.some((e) => e.isCreator);
  const showInactive = Boolean(user && (!user.active || !user.isVarified));

  const headerLoading =
    isUserLoading || Boolean(user && (isPeopleLoading || isProjectLoading));

  const tabs = [
    { value: "details" as const, label: "Details" },
    { value: "environments" as const, label: "Environments" },
    { value: "devices" as const, label: "Devices" },
  ];

  if (!userId) {
    return (
      <main className="min-h-0 flex-1 p-6 md:p-8">
        <PageMeta title="Person" />
        <p className="text-sm text-muted-foreground">Missing user id.</p>
        <Button className="mt-4" variant="outline" asChild>
          <Link to="/project-overview/people">Back to People</Link>
        </Button>
      </main>
    );
  }

  return (
    <main className="flex min-h-0 flex-1 flex-col gap-6 p-6 md:p-8">
      <PageMeta title={fullName || "Person"} />

      <div className="flex flex-col gap-4">
        <Breadcrumb className="hidden md:flex">
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link to="/project-overview/people">People</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>
                {headerLoading ? <Skeleton className="h-4 w-24" /> : fullName || userId}
              </BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="ghost" size="icon" onClick={() => navigate(-1)} aria-label="Go back">
            <ArrowLeft className="h-6 w-6" />
          </Button>
          {headerLoading ? (
            <Skeleton className="h-8 w-48" />
          ) : (
            <>
              <h1 className="mr-4 text-2xl font-bold tracking-tight">
                {fullName || "Person's details"}
              </h1>
              {isPendingInvite ? <PendingInviteBadge /> : null}
              {showInactive ? <InactiveUserBadge /> : null}
            </>
          )}
        </div>
      </div>

      <Tabs value={currentTab} onValueChange={setTab} className="mt-2 flex w-full flex-col md:mt-6">
        <div className="mb-5 flex items-center justify-between text-base">
          <div className="md:hidden">
            <Select value={currentTab} onValueChange={setTab}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {tabs.map((tab) => (
                  <SelectItem key={tab.value} value={tab.value}>
                    {tab.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="hidden items-center md:flex">
            <TabsList className={segmentedTabsListClass}>
              {tabs.map((tab) => (
                <TabsTrigger key={tab.value} value={tab.value} className={segmentedTabsTriggerClass}>
                  {tab.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>
        </div>

        <TabsContent
          value="details"
          className="mt-0 focus-visible:ring-0 focus-visible:ring-offset-0 data-[state=inactive]:hidden"
        >
          <ProjectOverviewPeopleDetailsTab user={user} isLoading={isUserLoading} />
        </TabsContent>

        <TabsContent
          value="environments"
          className="mt-0 focus-visible:ring-0 focus-visible:ring-offset-0 data-[state=inactive]:hidden"
        >
          <ProjectOverviewPeopleEnvironments
            user={user}
            peopleData={peoples}
            environmentList={environmentList}
            isViewerOwner={isViewerOwner}
          />
        </TabsContent>

        <TabsContent
          value="devices"
          className="mt-0 focus-visible:ring-0 focus-visible:ring-offset-0 data-[state=inactive]:hidden"
        >
          <ProfileUserDevices id={userId} projectKey={projectKey} />
        </TabsContent>
      </Tabs>
    </main>
  );
}
