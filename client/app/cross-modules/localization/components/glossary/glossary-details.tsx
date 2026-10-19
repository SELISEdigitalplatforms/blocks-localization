import React, { useState } from "react";
import { useNavigate } from "react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui-kits/card/card";
import { Button } from "@/components/ui-kits/button/button";
import { Badge } from "@/components/ui-kits/badge/badge";
import { Dialog, DialogTrigger } from "@/components/ui-kits/dialog/dialog";
import { Skeleton } from "@/components/ui-kits/skeleton/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui-kits/tooltip/tooltip";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui-kits/table/table";
import { Pagination } from "@/components/ui-kits/pagination/pagination";
import { CircleAlert, Pencil, Trash, TriangleAlert } from "lucide-react";
import PageBreadcrumb from "@/components/breadcrumb/breadcrumb";
import { BREADCRUMB_CUSTOM_TITLES } from "@/constants/breadcrumb-custom-title";
import {
  useGetGlossaryById,
  useGetKeysByGlossaryId,
  useGetLanguageModules,
  useGetLanguages,
} from "@blocks-localization/hooks/use-language-manager";
import GlossaryEditorSheet from "@blocks-localization/components/modals/glossary/glossary-editor-sheet";
import GlossaryRuleBadge from "@blocks-localization/components/glossary/glossary-rule-badge";
import { GlossaryMeta } from "@blocks-localization/models/glossary-meta";
import { ILanguageConfig } from "@blocks-localization/models/language";
import { parseGlossaryMeta } from "@blocks-localization/utils/glossary-meta";
import {
  getTargetLanguages,
  stripRuleMarker,
} from "@blocks-localization/utils/glossary-rule-marker";
import DeleteGlossary from "@blocks-localization/components/modals/glossary/delete-glossary";
import { useScopedPath } from "@seliseblocks/genesis-os";

const TAGGED_KEYS_PAGE_SIZE_OPTIONS = [10, 20, 50];

const TAGGED_KEYS_SKELETON_ROW_KEYS = Array.from(
  { length: 5 },
  (_, rowNumber) => `tagged-key-row-skeleton-${rowNumber}`,
);

interface GlossaryDetailsProps {
  itemId: string;
}

const ForbiddenList = ({ values }: Readonly<{ values: string[] }>) =>
  values.length > 0 ? (
    <div className="flex flex-wrap gap-1">
      {values.map((value) => (
        <Badge key={value} variant="error">
          {value}
        </Badge>
      ))}
    </div>
  ) : (
    <span>-</span>
  );

function renderTranslationsTable(meta: GlossaryMeta, targets: ILanguageConfig[]) {
  const showTranslation = meta.rule === "translate";
  return (
    <div className="w-full overflow-x-auto">
      <Table className="text-sm">
        <TableHeader>
          <TableRow className="border-none hover:bg-transparent">
            <TableHead className="font-bold text-medium-emphasis">Language</TableHead>
            {showTranslation && (
              <TableHead className="font-bold text-medium-emphasis">Translation</TableHead>
            )}
            <TableHead className="font-bold text-medium-emphasis">Forbidden alternatives</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {targets.map(({ languageCode, languageName }) => {
            const value = meta.translations[languageCode];
            return (
              <TableRow key={languageCode} className="font-normal text-medium-emphasis">
                <TableCell className="text-high-emphasis">
                  {languageName} ({languageCode})
                </TableCell>
                {showTranslation && (
                  <TableCell>
                    {value ? (
                      <span className="text-high-emphasis">{value}</span>
                    ) : (
                      <Badge variant="warning" className="w-fit gap-1">
                        <TriangleAlert className="h-3 w-3" aria-hidden="true" />
                        Missing
                      </Badge>
                    )}
                  </TableCell>
                )}
                <TableCell>
                  <ForbiddenList values={meta.forbidden[languageCode] ?? []} />
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

function renderTranslationsContent(
  parsed: ReturnType<typeof parseGlossaryMeta>,
  languages: ILanguageConfig[] | undefined,
) {
  const { meta, status } = parsed;
  if (status === "unsupported-version") {
    return (
      <p className="px-6 pb-6 text-sm text-medium-emphasis">
        This term was saved by a newer version and can&apos;t be shown here.
      </p>
    );
  }
  if (meta.rule === "keep") {
    return <p className="px-6 pb-6 text-sm text-medium-emphasis">Kept as-is in all languages.</p>;
  }
  const targets = getTargetLanguages(languages);
  if (targets.length === 0) {
    return (
      <p className="px-6 pb-6 text-sm text-medium-emphasis">
        The project has no languages to translate into.
      </p>
    );
  }
  return (
    <>
      {meta.rule === "forbidden" && (
        <p className="px-6 pb-4 text-sm text-medium-emphasis">Do not use this term.</p>
      )}
      {renderTranslationsTable(meta, targets)}
    </>
  );
}

const GlossaryDetails: React.FC<GlossaryDetailsProps> = ({ itemId }) => {
  const navigate = useNavigate();
  const scoped = useScopedPath();
  const { data: glossary, isLoading } = useGetGlossaryById(itemId);
  const { data: languageListData } = useGetLanguages();
  const { data: moduleListData } = useGetLanguageModules();
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [keysPage, setKeysPage] = useState(0);
  const [keysPageSize, setKeysPageSize] = useState(TAGGED_KEYS_PAGE_SIZE_OPTIONS[0]);
  const {
    data: taggedKeysData,
    isLoading: isTaggedKeysLoading,
    isError: isTaggedKeysError,
  } = useGetKeysByGlossaryId(itemId, keysPage, keysPageSize);

  if (glossary?.name) {
    // eslint-disable-next-line react-hooks/immutability -- The breadcrumb reads this registry during the same render.
    BREADCRUMB_CUSTOM_TITLES[`/app/:itemId/services/glossary/${glossary.itemId}`] = glossary.name;
  }

  if (isLoading) {
    return (
      <div>
        <div className="hidden md:flex">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="ml-4 h-6 w-64" />
          <Skeleton className="ml-4 h-6 w-64" />
        </div>
        <div className="mt-5 flex items-center justify-between">
          <Skeleton className="h-8 w-48" />
          <div className="flex gap-2">
            <Skeleton className="h-9 w-20" />
            <Skeleton className="h-9 w-20" />
          </div>
        </div>
        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Skeleton className="h-48 w-full rounded-sm" />
          <div className="flex flex-col gap-6">
            <Skeleton className="h-24 w-full rounded-sm" />
            <Skeleton className="h-24 w-full rounded-sm" />
          </div>
        </div>
      </div>
    );
  }

  if (!glossary) {
    return <div className="mt-10 text-center text-medium-emphasis">Glossary item not found.</div>;
  }

  const defaultLanguage = languageListData?.find((l) => l.isDefault);
  const parsedMeta = parseGlossaryMeta(glossary.additionalNote);
  const { meta } = parsedMeta;
  const moduleCount = glossary.moduleIds?.length ?? 0;
  const scopeLabel = glossary.isGlobal
    ? "Whole project"
    : `${moduleCount} module${moduleCount === 1 ? "" : "s"}`;
  const definition = stripRuleMarker(glossary.context);

  const resolvedLanguage =
    languageListData?.find((l) => l.languageCode === glossary.language)?.languageName ??
    glossary.language ??
    "-";

  const renderTaggedKeysContent = () => {
    if (isTaggedKeysLoading) {
      return (
        <div className="flex flex-col gap-2 px-6 pb-6">
          {TAGGED_KEYS_SKELETON_ROW_KEYS.map((rowKey) => (
            <Skeleton key={rowKey} className="h-10 w-full rounded-sm" />
          ))}
        </div>
      );
    }

    if (isTaggedKeysError || !taggedKeysData) {
      return <p className="px-6 pb-6 text-sm text-medium-emphasis">Failed to load tagged keys.</p>;
    }

    if (!taggedKeysData.keys?.length) {
      return (
        <p className="px-6 pb-6 text-sm text-medium-emphasis">
          No keys are tagged with this glossary.
        </p>
      );
    }

    return (
      <>
        <div className="w-full overflow-x-auto">
          <Table className="text-sm">
            <TableHeader>
              <TableRow className="border-none hover:bg-transparent">
                <TableHead className="font-bold text-medium-emphasis">Key Name</TableHead>
                <TableHead className="font-bold text-medium-emphasis">Module</TableHead>
                <TableHead className="font-bold text-medium-emphasis">
                  {defaultLanguage
                    ? `${defaultLanguage.languageName} (Default)`
                    : "Default Language"}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {taggedKeysData.keys.map((key) => {
                const mod = moduleListData?.find((m) => m.itemId === key.moduleId);
                const defaultResource = key.resources?.find(
                  (r) => r.culture === defaultLanguage?.languageCode,
                );
                return (
                  <TableRow
                    key={key.itemId}
                    className="cursor-pointer font-normal text-medium-emphasis"
                    onClick={() => navigate(scoped(`services/language/translations/${key.itemId}`))}
                  >
                    <TableCell className="font-mono text-xs text-high-emphasis">
                      {key.keyName}
                    </TableCell>
                    <TableCell>{mod?.moduleName ?? key.moduleId}</TableCell>
                    <TableCell className="line-clamp-2">{defaultResource?.value || "-"}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
        <div className="flex flex-col gap-3 border-t px-6 py-3 md:flex-row md:items-center md:justify-between">
          <span className="text-sm text-medium-emphasis">
            {taggedKeysData.totalCount} key
            {taggedKeysData.totalCount === 1 ? "" : "s"} total
          </span>
          <Pagination
            page={keysPage}
            pageSize={keysPageSize}
            totalCount={taggedKeysData.totalCount ?? 0}
            pageSizeOptions={TAGGED_KEYS_PAGE_SIZE_OPTIONS}
            onChange={setKeysPage}
            onPageSizeChange={(size) => {
              setKeysPageSize(size);
              setKeysPage(0);
            }}
          />
        </div>
      </>
    );
  };

  return (
    <div>
      <div className="hidden md:flex">
        <PageBreadcrumb />
      </div>

      <div className="mt-5 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{glossary.name}</h1>
        <div className="flex gap-2">
          <GlossaryEditorSheet
            open={editModalOpen}
            onOpenChange={setEditModalOpen}
            glossary={glossary}
            trigger={
              <Button size="default" variant="outline" className="gap-2">
                <Pencil className="h-4 w-4" />
                <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">Edit</span>
              </Button>
            }
          />

          <Dialog open={deleteModalOpen} onOpenChange={setDeleteModalOpen}>
            <DialogTrigger asChild>
              <Button size="default" variant="outline" className="gap-2">
                <Trash className="h-4 w-4 text-error" />
                <span className="sr-only text-error sm:not-sr-only sm:whitespace-nowrap">
                  Delete
                </span>
              </Button>
            </DialogTrigger>
            {deleteModalOpen && (
              <DeleteGlossary
                itemId={glossary.itemId}
                glossaryName={glossary.name}
                onClose={() => {
                  setDeleteModalOpen(false);
                  navigate(scoped("services/glossary"));
                }}
              />
            )}
          </Dialog>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {parsedMeta.status !== "unsupported-version" && <GlossaryRuleBadge rule={meta.rule} />}
        <Badge variant="outline" className="w-fit">
          {scopeLabel}
        </Badge>
        {meta.caseSensitive && (
          <Badge variant="outline" className="w-fit">
            Case-sensitive
          </Badge>
        )}
      </div>
      {meta.variants.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="text-sm text-medium-emphasis">Variants:</span>
          {meta.variants.map((variant) => (
            <Badge key={variant} variant="secondary" className="w-fit">
              {variant}
            </Badge>
          ))}
        </div>
      )}

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="rounded-sm shadow-none lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-xl">Translations</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {renderTranslationsContent(parsedMeta, languageListData)}
          </CardContent>
        </Card>

        <Card className="h-min rounded-sm shadow-none">
          <CardHeader>
            <CardTitle className="text-xl">Details</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-1">
                <h3 className="text-sm font-medium text-low-emphasis">Language</h3>
                <p className="text-base font-normal text-high-emphasis">{resolvedLanguage}</p>
              </div>
              <div className="grid gap-1">
                <h3 className="text-sm font-medium text-low-emphasis">Type</h3>
                <p className="text-base font-normal text-high-emphasis">{glossary.type ?? "-"}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-1">
                <h3 className="text-sm font-medium text-low-emphasis">Created on</h3>
                <p className="text-base font-normal text-high-emphasis">
                  {glossary.createDate ? new Date(glossary.createDate).toLocaleDateString() : "-"}
                </p>
              </div>
            </div>

            {(glossary.moduleIds?.length ?? 0) > 0 && (
              <div className="grid gap-2">
                <h3 className="text-sm font-medium text-low-emphasis">Tagged Modules</h3>
                <div className="flex flex-wrap gap-2">
                  {glossary.moduleIds?.map((id) => {
                    const mod = moduleListData?.find((m) => m.itemId === id);
                    return (
                      <Badge key={id} variant="secondary">
                        {mod?.moduleName ?? id}
                      </Badge>
                    );
                  })}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="flex flex-col gap-6">
          <Card className="rounded-sm shadow-none">
            <CardHeader>
              <CardTitle className="text-xl">Definition</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-base text-medium-emphasis">
                {definition || "No definition provided."}
              </p>
            </CardContent>
          </Card>

          <Card className="rounded-sm shadow-none">
            <CardHeader>
              <CardTitle className="text-xl">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="inline-flex w-fit cursor-help items-center gap-1.5">
                        Internal Note
                        <CircleAlert className="h-4 w-4 text-medium-emphasis" />
                      </span>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-80 text-sm font-normal">
                      Not utilized for auto translation, only given for additional comments by the
                      user
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-base text-medium-emphasis">{meta.note || "No internal note."}</p>
            </CardContent>
          </Card>
        </div>
      </div>

      <Card className="mt-6 rounded-sm shadow-none">
        <CardHeader>
          <CardTitle className="text-xl">Tagged Keys</CardTitle>
        </CardHeader>
        <CardContent className="p-0">{renderTaggedKeysContent()}</CardContent>
      </Card>
    </div>
  );
};

export default GlossaryDetails;
