import { useState } from "react";
import { useParams } from "react-router-dom";
import { useQueryState } from "nuqs";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui-kits/tabs/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui-kits/table/table";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui-kits/card/card";
import { Skeleton } from "@/components/ui-kits/skeleton/skeleton";
import { Info, BookOpen } from "lucide-react";
import PageBreadcrumb from "@/components/breadcrumb/breadcrumb";
import { BREADCRUMB_CUSTOM_TITLES } from "@/constants/breadcrumb-custom-title";
import {
  useGetLanguageModules,
  useGetModuleGlossaries,
} from "@blocks-localization/hooks/use-language-manager";

function ModuleDetailsContent({
  module,
  moduleId,
}: {
  module: {
    moduleName: string;
    createDate: string | null;
    lastUpdateDate: string | null;
    createdBy: string | null;
    lastUpdatedBy: string | null;
  };
  moduleId: string;
}) {
  const [activeTab, setActiveTab] = useQueryState("moduleTab", {
    defaultValue: "details",
  });

  // Glossary tab - fetch glossaries for this module
  const { data: glossariesData, isLoading: isGlossariesLoading } =
    useGetModuleGlossaries(moduleId);

  return (
    <div className="space-y-6">
      <Tabs
        value={activeTab}
        onValueChange={(value) => setActiveTab(value)}
        className="w-full"
      >
        <TabsList className="h-[42px] bg-blocks-primary-shades-300">
          <TabsTrigger value="details" className="h-8">
            <Info className="mr-2 h-4 w-4" />
            Details
          </TabsTrigger>
          <TabsTrigger value="glossary" className="h-8">
            <BookOpen className="mr-2 h-4 w-4" />
            Glossary
          </TabsTrigger>
        </TabsList>
        <TabsContent value="details" className="mt-4">
          <Card className="rounded-sm border border-border shadow-none">
            <CardHeader>
              <CardTitle className="text-lg text-high-emphasis">
                About
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <div className="grid gap-4">
                <div className="grid gap-1">
                  <h3 className="text-sm font-medium text-low-emphasis">
                    Module Name
                  </h3>
                  <p className="text-base font-normal text-high-emphasis">
                    {module.moduleName}
                  </p>
                </div>
                <div className="grid gap-1">
                  <h3 className="text-sm font-medium text-low-emphasis">
                    Created Date
                  </h3>
                  <p className="text-base font-normal text-high-emphasis">
                    {module.createDate
                      ? new Date(module.createDate).toLocaleDateString()
                      : "—"}
                  </p>
                </div>
                <div className="grid gap-1">
                  <h3 className="text-sm font-medium text-low-emphasis">
                    Last Update Date
                  </h3>
                  <p className="text-base font-normal text-high-emphasis">
                    {module.lastUpdateDate
                      ? new Date(module.lastUpdateDate).toLocaleDateString()
                      : "—"}
                  </p>
                </div>
              </div>
              <div className="grid gap-4">
                <div className="grid gap-1">
                  <h3 className="text-sm font-medium text-low-emphasis">
                    Created By
                  </h3>
                  <p className="text-base font-normal text-high-emphasis">
                    {module.createdBy ?? "—"}
                  </p>
                </div>
                <div className="grid gap-1">
                  <h3 className="text-sm font-medium text-low-emphasis">
                    Last Updated By
                  </h3>
                  <p className="text-base font-normal text-high-emphasis">
                    {module.lastUpdatedBy ?? "—"}
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
              ) : glossariesData?.items && glossariesData.items.length > 0 ? (
                <div className="w-full overflow-x-auto">
                  <Table className="text-sm">
                    <TableHeader>
                      <TableRow className="border-none hover:bg-transparent">
                        <TableHead className="font-bold text-medium-emphasis">
                          Name
                        </TableHead>
                        <TableHead className="font-bold text-medium-emphasis">
                          Language
                        </TableHead>
                        <TableHead className="font-bold text-medium-emphasis">
                          Type
                        </TableHead>
                        <TableHead className="font-bold text-medium-emphasis">
                          Context
                        </TableHead>
                        <TableHead className="font-bold text-medium-emphasis">
                          Created Date
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {glossariesData.items.map((glossary) => (
                        <TableRow
                          key={glossary.itemId}
                          className="cursor-pointer font-normal text-medium-emphasis hover:bg-muted/50"
                        >
                          <TableCell className="font-medium">
                            {glossary.name}
                          </TableCell>
                          <TableCell>{glossary.language ?? "—"}</TableCell>
                          <TableCell>{glossary.type ?? "—"}</TableCell>
                          <TableCell className="max-w-[200px] truncate">
                            {glossary.context ?? "—"}
                          </TableCell>
                          <TableCell>
                            {glossary.createDate
                              ? new Date(
                                  glossary.createDate,
                                ).toLocaleDateString()
                              : "—"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="flex h-24 items-center justify-center text-muted-foreground">
                  No glossaries tagged to this module
                </div>
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

  const { data: modules, isLoading: isModulesLoading } =
    useGetLanguageModules();
  const module = modules?.find((m) => m.itemId === moduleId);

  if (module?.moduleName) {
    BREADCRUMB_CUSTOM_TITLES[`/services/modules/${module.itemId}`] =
      module.moduleName;
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
        <PageBreadcrumb breadcrumbIndex={2} />
      </div>
      <ModuleDetailsContent module={module} moduleId={moduleId} />
    </div>
  );
}
