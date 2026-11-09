import { useMemo } from "react";
import { useT, type TFunction } from "@seliseblocks/genesis-os/i18n";
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
  useGetLanguages,
  useGetModuleGlossaries,
} from "@blocks-localization/hooks/use-language-manager";
import { IGlossary, ILanguageConfig } from "@blocks-localization/models/language";
import {
  getTargetLanguages,
  stripRuleMarker,
} from "@blocks-localization/utils/glossary-rule-marker";
import { isUnsupportedGlossaryNote, toGlossaryMeta } from "@blocks-localization/utils/glossary-display";
import { findCultureEntry } from "@blocks-localization/utils/glossary-text";
import GlossaryRuleBadge from "@blocks-localization/components/glossary/glossary-rule-badge";
import { useCurrentUser } from "@blocks-localization/hooks/use-user-lookup";

const hasDisplayValue = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;

const compareStrings = (a: string, b: string): number => {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
};

const getDisplayNamePart = (value: string | null | undefined): string | null => {
  if (typeof value === "string" && value.trim()) {
    return value.trim();
  }
  return null;
};

const getUserDisplayName = (
  user:
    | {
        firstName: string | null;
        lastName: string | null;
        email: string | null;
        userName: string | null;
      }
    | null
    | undefined,
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

/** "2 / 3 languages" for Translate terms; "—" for Keep, Forbidden or no target languages (H13). */
export const getGlossaryCoverage = (
  glossary: IGlossary,
  languages: ILanguageConfig[] | undefined,
  t: TFunction,
): string => {
  const meta = toGlossaryMeta(glossary);
  const targets = getTargetLanguages(languages);
  if (isUnsupportedGlossaryNote(glossary) || meta.rule !== "translate" || targets.length === 0) {
    return "—";
  }
  const translated = targets.filter(({ languageCode }) => !!findCultureEntry(meta.translations, languageCode)?.trim());
  return t("MODULE_DETAILS.COVERAGE", { translated: translated.length, total: targets.length });
};

function renderGlossaryTable(
  items: IGlossary[],
  visibleColumns: VisibleGlossaryColumns,
  languages: ILanguageConfig[] | undefined,
  t: TFunction,
) {
  return (
    <div className="w-full overflow-x-auto">
      <Table className="text-sm">
        <TableHeader>
          <TableRow className="border-none hover:bg-transparent">
            <TableHead className="font-bold text-medium-emphasis">{t("common:NAME")}</TableHead>
            <TableHead className="font-bold text-medium-emphasis">
              {t("MODULE_DETAILS.COLUMN_RULE")}
            </TableHead>
            <TableHead className="font-bold text-medium-emphasis">
              {t("MODULE_DETAILS.COLUMN_COVERAGE")}
            </TableHead>
            {visibleColumns.language && (
              <TableHead className="font-bold text-medium-emphasis">
                {t("MODULE_DETAILS.COLUMN_LANGUAGE")}
              </TableHead>
            )}
            {visibleColumns.type && (
              <TableHead className="font-bold text-medium-emphasis">{t("common:TYPE")}</TableHead>
            )}
            {visibleColumns.context && (
              <TableHead className="font-bold text-medium-emphasis">
                {t("MODULE_DETAILS.COLUMN_CONTEXT")}
              </TableHead>
            )}
            {visibleColumns.createDate && (
              <TableHead className="font-bold text-medium-emphasis">
                {t("MODULE_DETAILS.CREATED_DATE")}
              </TableHead>
            )}
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((glossary) => (
            <TableRow key={glossary.itemId} className="font-normal text-medium-emphasis">
              <TableCell className="font-medium">{glossary.name}</TableCell>
              <TableCell>
                {isUnsupportedGlossaryNote(glossary) ? (
                  "—"
                ) : (
                  <GlossaryRuleBadge rule={toGlossaryMeta(glossary).rule} />
                )}
              </TableCell>
              <TableCell className="whitespace-nowrap">
                {getGlossaryCoverage(glossary, languages, t)}
              </TableCell>
              {visibleColumns.language && (
                <TableCell>
                  {hasDisplayValue(glossary.language)
                    ? (languages?.find((language) => language.languageCode === glossary.language)
                        ?.languageName ?? glossary.language)
                    : "—"}
                </TableCell>
              )}
              {visibleColumns.type && (
                <TableCell>{hasDisplayValue(glossary.type) ? glossary.type : "—"}</TableCell>
              )}
              {visibleColumns.context && (
                <TableCell className="max-w-[200px] truncate">
                  {stripRuleMarker(glossary.context) || "—"}
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
    description?: string | null;
  };
  moduleId: string;
  userMap?: Record<
    string,
    { firstName: string; lastName: string; email: string; userName: string }
  >;
}) {
  const { t } = useT("localization.modules");
  const [activeTab, setActiveTab] = useQueryState("moduleTab", {
    defaultValue: "details",
  });

  // Glossary tab - fetch glossaries for this module
  const { data: glossariesData, isLoading: isGlossariesLoading } = useGetModuleGlossaries(moduleId);
  const { data: languageListData } = useGetLanguages();
  const { data: currentUser } = useCurrentUser();
  const visibleGlossaryColumns = useMemo(() => {
    const glossaries = glossariesData?.items ?? [];

    return {
      language: glossaries.some((glossary) => hasDisplayValue(glossary.language)),
      type: glossaries.some((glossary) => hasDisplayValue(glossary.type)),
      context: glossaries.some((glossary) => hasDisplayValue(stripRuleMarker(glossary.context))),
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
    renderGlossaryTable(glossariesData.items, visibleGlossaryColumns, languageListData, t)
  ) : (
    <div className="flex h-24 items-center justify-center text-muted-foreground">
      {t("MODULE_DETAILS.NO_GLOSSARIES")}
    </div>
  );

  return (
    <div className="space-y-6">
      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value)} className="w-full">
        <TabsList className="h-[42px] bg-blocks-primary-shades-300">
          <TabsTrigger value="details" className="h-8">
            {t("common:DETAILS")}
          </TabsTrigger>
          <TabsTrigger value="glossary" className="h-8">
            {t("MODULE_DETAILS.TAB_GLOSSARY")}
          </TabsTrigger>
        </TabsList>
        <TabsContent value="details" className="mt-4">
          <Card className="rounded-sm border border-border shadow-none">
            <CardHeader>
              <CardTitle className="text-lg text-high-emphasis">
                {t("MODULE_DETAILS.ABOUT")}
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <div className="grid gap-4">
                <div className="grid gap-1">
                  <h3 className="text-sm font-medium text-low-emphasis">
                    {t("MODULE_DETAILS.MODULE_NAME")}
                  </h3>
                  <p className="text-base font-normal text-high-emphasis">{module.moduleName}</p>
                </div>
                <div className="grid gap-1">
                  <h3 className="text-sm font-medium text-low-emphasis">
                    {t("MODULE_DETAILS.CREATED_DATE")}
                  </h3>
                  <p className="text-base font-normal text-high-emphasis">
                    {module.createDate ? new Date(module.createDate).toLocaleDateString() : "—"}
                  </p>
                </div>
                <div className="grid gap-1">
                  <h3 className="text-sm font-medium text-low-emphasis">
                    {t("MODULE_DETAILS.LAST_UPDATE_DATE")}
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
                    {t("MODULE_DETAILS.CREATED_BY")}
                  </h3>
                  <p className="text-base font-normal text-high-emphasis">
                    {getUserDisplayNameById(module.createdBy)}
                  </p>
                </div>
                <div className="grid gap-1">
                  <h3 className="text-sm font-medium text-low-emphasis">
                    {t("MODULE_DETAILS.LAST_UPDATED_BY")}
                  </h3>
                  <p className="text-base font-normal text-high-emphasis">
                    {getUserDisplayNameById(module.lastUpdatedBy)}
                  </p>
                </div>
              </div>
              <div className="grid gap-1 lg:col-span-2">
                <h3 className="text-sm font-medium text-low-emphasis">
                  {t("MODULE_DETAILS.DESCRIPTION")}
                </h3>
                {hasDisplayValue(module.description) ? (
                  <p className="whitespace-pre-line text-base font-normal text-high-emphasis">
                    {module.description}
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground">{t("MODULE_DETAILS.NO_DESCRIPTION")}</p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="glossary" className="mt-4">
          <Card className="rounded-sm border border-border shadow-none">
            <CardHeader>
              <CardTitle className="text-lg text-high-emphasis">
                {t("MODULE_DETAILS.TAGGED_GLOSSARIES", { count: glossariesData?.totalCount ?? 0 })}
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
  const { t } = useT("localization.modules");
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
    queryKey: ["module-detail-users", [...uniqueUserIds].sort(compareStrings)],
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
        <p className="text-muted-foreground">{t("MODULE_DETAILS.INVALID_MODULE_ID")}</p>
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
        <p className="text-muted-foreground">{t("MODULE_DETAILS.MODULE_NOT_FOUND")}</p>
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
