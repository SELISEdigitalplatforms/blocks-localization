import { useMemo } from "react";
import { useParams } from "react-router";
import { useQueryState } from "nuqs";
import { useQuery } from "@tanstack/react-query";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui-kits/tabs/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui-kits/table/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui-kits/card/card";
import { Skeleton } from "@/components/ui-kits/skeleton/skeleton";
import PageBreadcrumb from "@/components/breadcrumb/breadcrumb";
import { BREADCRUMB_CUSTOM_TITLES } from "@/constants/breadcrumb-custom-title";
import { userLookupService } from "@blocks-localization/services/user-lookup.service";
import {
  useGetLanguageModules,
  useGetModuleGlossaries,
} from "@blocks-localization/hooks/use-language-manager";
import { IGlossary } from "@blocks-localization/models/language";
import { useCurrentUser } from "@blocks-localization/hooks/use-user-lookup";

const hasDisplayValue = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;

const compareStrings = (a: string, b: string): number => {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
};

const getDisplayNamePart = (
  value: string | null | undefined,
): string | null => {
  if (typeof value === "string" && value.trim()) {
    return value.trim();
  }
  return null;
};

const getUserDisplayName = (
  user: { firstName: string | null; lastName: string | null; email: string | null; userName: string | null } | null | undefined,
): string => {
  if (!user) return "—";

  const firstName = getDisplayNamePart(user.firstName);
  const lastName = getDisplayNamePart(user.lastName);
  const fullName = firstName && lastName ? `${firstName} ${lastName}` : null;

  return fullName ?? getDisplayNamePart(user.email) ?? getDisplayNamePart(user.userName) ?? "—";
};

type VisibleGlossaryColumns = {
  language: boolean;
  type: boolean;
  context: boolean;
  createDate: boolean;
};

function renderGlossaryTable(
  items: IGlossary[],
  visibleColumns: VisibleGlossaryColumns,
) {
  return (
    <div className="w-full overflow-x-auto">
      <Table className="text-sm">
        <TableHeader>
          <TableRow className="border-none hover:bg-transparent">
            <TableHead className="font-bold text-medium-emphasis">Name</TableHead>
            {visibleColumns.language && (
              <TableHead className="font-bold text-medium-emphasis">Language</TableHead>
            )}
            {visibleColumns.type && (
              <TableHead className="font-bold text-medium-emphasis">Type</TableHead>
            )}
            {visibleColumns.context && (
              <TableHead className="font-bold text-medium-emphasis">Context</TableHead>
            )}
            {visibleColumns.createDate && (
              <TableHead className="font-bold text-medium-emphasis">Created Date</TableHead>
            )}
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((glossary) => (
            <TableRow key={glossary.itemId} className="font-normal text-medium-emphasis">
              <TableCell className="font-medium">{glossary.name}</TableCell>
              {visibleColumns.language && (
                <TableCell>
                  {hasDisplayValue(glossary.language) ? glossary.language : "—"}
                </TableCell>
              )}
              {visibleColumns.type && (
                <TableCell>
                  {hasDisplayValue(glossary.type) ? glossary.type : "—"}
                </TableCell>
              )}
              {visibleColumns.context && (
                <TableCell className="max-w-[200px] truncate">
                  {hasDisplayValue(glossary.context) ? glossary.context : "—"}
                </TableCell>
              )}
              {visibleColumns.createDate && (
                <TableCell>
                  {hasDisplayValue(glossary.createDate)
                    ? new Date(glossary.createDate).toLocaleDateString()
                    : "—"}
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function ModuleDetailsContent({
  module,
  moduleId,
  userMap,
}: {
  module: {
    moduleName: string;
    createDate: string | null;
    lastUpdateDate: string | null;
    createdBy: string | null;
    lastUpdatedBy: string | null;
  };
  moduleId: string;
  userMap?: Record<
    string,
    { firstName: string; lastName: string; email: string; userName: string }
  >;
}) {
  const [activeTab, setActiveTab] = useQueryState("moduleTab", {
    defaultValue: "details",
  });

  // Glossary tab - fetch glossaries for this module
  const { data: glossariesData, isLoading: isGlossariesLoading } = useGetModuleGlossaries(moduleId);
  const { data: currentUser } = useCurrentUser();
  const visibleGlossaryColumns = useMemo(() => {
    const glossaries = glossariesData?.items ?? [];

    return {
      language: glossaries.some((glossary) => hasDisplayValue(glossary.language)),
      type: glossaries.some((glossary) => hasDisplayValue(glossary.type)),
      context: glossaries.some((glossary) => hasDisplayValue(glossary.context)),
      createDate: glossaries.some((glossary) => hasDisplayValue(glossary.createDate)),
    };
  }, [glossariesData?.items]);

  const hasGlossaries = glossariesData?.items && glossariesData.items.length > 0;

  // Helper function to get user display name
  const getUserDisplayNameById = (userId: string | null): string => {
    const user = userId ? userMap?.[userId] : currentUser;
    const resolvedUser = user ?? (currentUser?.itemId === userId ? currentUser : undefined);
    return getUserDisplayName(resolvedUser);
  };

  const glossaryTabContent = hasGlossaries ? (
    renderGlossaryTable(glossariesData.items, visibleGlossaryColumns)
  ) : (
    <div className="flex h-24 items-center justify-center text-muted-foreground">
      No glossaries tagged to this module
    </div>
  );

  return (
    <div className="space-y-6">
      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value)} className="w-full">
        <TabsList className="h-[42px] bg-blocks-primary-shades-300">
          <TabsTrigger value="details" className="h-8">
            Details
          </TabsTrigger>
          <TabsTrigger value="glossary" className="h-8">
            Glossary
          </TabsTrigger>
        </TabsList>
        <TabsContent value="details" className="mt-4">
          <Card className="rounded-sm border border-border shadow-none">
            <CardHeader>
              <CardTitle className="text-lg text-high-emphasis">About</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <div className="grid gap-4">
                <div className="grid gap-1">
                  <h3 className="text-sm font-medium text-low-emphasis">Module Name</h3>
                  <p className="text-base font-normal text-high-emphasis">{module.moduleName}</p>
                </div>
                <div className="grid gap-1">
                  <h3 className="text-sm font-medium text-low-emphasis">Created Date</h3>
                  <p className="text-base font-normal text-high-emphasis">
                    {module.createDate ? new Date(module.createDate).toLocaleDateString() : "—"}
                  </p>
                </div>
                <div className="grid gap-1">
                  <h3 className="text-sm font-medium text-low-emphasis">Last Update Date</h3>
                  <p className="text-base font-normal text-high-emphasis">
                    {module.lastUpdateDate
                      ? new Date(module.lastUpdateDate).toLocaleDateString()
                      : "—"}
                  </p>
                </div>
              </div>
              <div className="grid gap-4">
                <div className="grid gap-1">
                  <h3 className="text-sm font-medium text-low-emphasis">Created By</h3>
                  <p className="text-base font-normal text-high-emphasis">
                    {getUserDisplayNameById(module.createdBy)}
                  </p>
                </div>
                <div className="grid gap-1">
                  <h3 className="text-sm font-medium text-low-emphasis">Last Updated By</h3>
                  <p className="text-base font-normal text-high-emphasis">
                    {getUserDisplayNameById(module.lastUpdatedBy)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="glossary" className="mt-4">
          <Card className="rounded-sm border border-border shadow-none">
            <CardHeader>
              <CardTitle className="text-lg text-high-emphasis">
                Tagged Glossaries ({glossariesData?.totalCount ?? 0})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isGlossariesLoading ? (
                <div className="space-y-2">
                  {Array.from({ length: 5 }).map((_, index) => (
                    <Skeleton key={index} className="h-12 w-full rounded" />
                  ))}
                </div>
              ) : (
                glossaryTabContent
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export function ModuleDetails() {
  const { moduleId } = useParams<{ moduleId: string }>();

  const { data: modules, isLoading: isModulesLoading } = useGetLanguageModules();
  const module = modules?.find((m) => m.itemId === moduleId);

  // Extract unique user IDs from createdBy and lastUpdatedBy
  const uniqueUserIds = useMemo(() => {
    const ids = new Set<string>();
    if (module?.createdBy) ids.add(module.createdBy);
    if (module?.lastUpdatedBy) ids.add(module.lastUpdatedBy);
    return Array.from(ids);
  }, [module]);

  // Fetch users by IDs
  const { data: userMap } = useQuery({
    queryKey: [
      "module-detail-users",
      [...uniqueUserIds].sort(compareStrings),
    ],
    queryFn: async () => {
      return userLookupService.getUsersByIds(uniqueUserIds);
    },
    enabled: uniqueUserIds.length > 0,
    refetchOnMount: true,
  });

  if (module?.moduleName) {
    // eslint-disable-next-line react-hooks/immutability -- The breadcrumb reads this registry during the same render.
    BREADCRUMB_CUSTOM_TITLES[`/app/:itemId/services/modules/${module.itemId}`] = module.moduleName;
  }

  if (!moduleId) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-muted-foreground">Invalid module ID</p>
      </div>
    );
  }

  if (isModulesLoading) {
    return (
      <div className="space-y-4">
        <div className="hidden md:flex">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="ml-4 h-6 w-64" />
        </div>
        <Skeleton className="h-[42px] w-[200px] rounded" />
        <Skeleton className="h-[300px] w-full rounded" />
      </div>
    );
  }

  if (!module) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-muted-foreground">Module not found</p>
      </div>
    );
  }

  return (
    <div>
      <div className="hidden md:flex">
        <PageBreadcrumb />
      </div>
      <div className="mt-5">
        <ModuleDetailsContent module={module} moduleId={moduleId} userMap={userMap} />
      </div>
    </div>
  );
}
