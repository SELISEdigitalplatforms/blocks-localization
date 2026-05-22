import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
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
import { ArrowLeft, FileText, BookOpen } from "lucide-react";
import { Button } from "@/components/ui-kits/button/button";
import {
  useGetLanguageModules,
  useGetModuleGlossaries,
  useGetBlocksLanguageKey,
} from "@blocks-localization/hooks/use-language-manager";
import { IBlocksLanguageKey } from "@blocks-localization/models/language";

function ModuleDetailsContent({ moduleId }: { moduleId: string }) {
  const [activeTab, setActiveTab] = useQueryState("moduleTab", {
    defaultValue: "keys",
  });
  const [pageNumber, setPageNumber] = useState(0);
  const [pageSize] = useState(20);

  const { data: modules, isLoading: isModulesLoading } =
    useGetLanguageModules();
  const module = modules?.find((m) => m.itemId === moduleId);

  // Keys tab - fetch keys by module
  const { data: keysData, isLoading: isKeysLoading } = useGetBlocksLanguageKey(
    pageNumber,
    pageSize,
    "",
    [moduleId],
    false,
  );

  // Glossary tab - fetch glossaries for this module
  const { data: glossariesData, isLoading: isGlossariesLoading } =
    useGetModuleGlossaries(moduleId);

  if (isModulesLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-12 w-full rounded" />
        <Skeleton className="h-6 w-48 rounded" />
        <Skeleton className="h-[400px] w-full rounded" />
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
    <div className="space-y-6">
      {/* Module Header */}
      <div className="space-y-4">
        <div className="flex items-center gap-4">
          <h2 className="text-2xl font-bold text-high-emphasis">
            {module.moduleName}
          </h2>
        </div>
        <div className="flex gap-6 text-sm text-medium-emphasis">
          <div>
            <span className="font-semibold">Created Date:</span>{" "}
            {module.createDate
              ? new Date(module.createDate).toLocaleDateString()
              : "—"}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs
        value={activeTab}
        onValueChange={(value) => setActiveTab(value)}
        className="w-full"
      >
        <TabsList className="h-[42px] bg-blocks-primary-shades-300">
          <TabsTrigger value="keys" className="h-8">
            <FileText className="mr-2 h-4 w-4" />
            Keys
          </TabsTrigger>
          <TabsTrigger value="glossary" className="h-8">
            <BookOpen className="mr-2 h-4 w-4" />
            Glossary
          </TabsTrigger>
        </TabsList>

        {/* Keys Tab Content */}
        <TabsContent value="keys" className="mt-4">
          <Card className="rounded-sm border border-border shadow-none">
            <CardHeader>
              <CardTitle className="text-lg text-high-emphasis">
                Language Keys ({keysData?.totalCount ?? 0})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isKeysLoading ? (
                <div className="space-y-2">
                  {Array.from({ length: 5 }).map((_, index) => (
                    <Skeleton key={index} className="h-12 w-full rounded" />
                  ))}
                </div>
              ) : keysData?.keys && keysData.keys.length > 0 ? (
                <div className="w-full overflow-x-auto">
                  <Table className="text-sm">
                    <TableHeader>
                      <TableRow className="border-none hover:bg-transparent">
                        <TableHead className="font-bold text-medium-emphasis">
                          Key Name
                        </TableHead>
                        <TableHead className="font-bold text-medium-emphasis">
                          Module
                        </TableHead>
                        <TableHead className="font-bold text-medium-emphasis">
                          Created Date
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {keysData.keys.map((key: IBlocksLanguageKey) => (
                        <TableRow
                          key={key.itemId}
                          className="cursor-pointer font-normal text-medium-emphasis hover:bg-muted/50"
                          onClick={() => {
                            // Navigate to key details if needed
                          }}
                        >
                          <TableCell className="font-medium">
                            {key.keyName}
                          </TableCell>
                          <TableCell>{module.moduleName}</TableCell>
                          <TableCell>
                            {key.createDate
                              ? new Date(key.createDate).toLocaleDateString()
                              : "—"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="flex h-24 items-center justify-center text-muted-foreground">
                  No keys found in this module
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Glossary Tab Content */}
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
                          onClick={() => {
                            // Navigate to glossary details if needed
                          }}
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
  const navigate = useNavigate();

  if (!moduleId) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-muted-foreground">Invalid module ID</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Back Button */}
      <Button
        variant="ghost"
        size="sm"
        className="gap-2 text-medium-emphasis hover:text-high-emphasis"
        onClick={() => navigate("/services/modules")}
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Modules
      </Button>

      <ModuleDetailsContent moduleId={moduleId} />
    </div>
  );
}
