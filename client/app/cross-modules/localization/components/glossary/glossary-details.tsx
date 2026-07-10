import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useScopedPath } from "@seliseblocks/blocks-kit/hooks";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui-kits/card/card";
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
import { CircleAlert, Pencil, Trash } from "lucide-react";
import PageBreadcrumb from "@/components/breadcrumb/breadcrumb";
import { BREADCRUMB_CUSTOM_TITLES } from "@/constants/breadcrumb-custom-title";
import {
  useGetGlossaryById,
  useGetKeysByGlossaryId,
  useGetLanguageModules,
  useGetLanguages,
} from "@blocks-localization/hooks/use-language-manager";
import AddEditGlossary from "@blocks-localization/components/modals/glossary/add-edit-glossary";
import DeleteGlossary from "@blocks-localization/components/modals/glossary/delete-glossary";

interface GlossaryDetailsProps {
  itemId: string;
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
  const PAGE_SIZE = 10;
  const {
    data: taggedKeysData,
    isLoading: isTaggedKeysLoading,
    isError: isTaggedKeysError,
  } = useGetKeysByGlossaryId(
    itemId,
    glossary?.moduleIds ?? [],
    keysPage,
    PAGE_SIZE,
  );

  // Set breadcrumb title synchronously when glossary data is available
  if (glossary?.name) {
    BREADCRUMB_CUSTOM_TITLES[`/app/:itemId/services/glossary/${glossary.itemId}`] =
      glossary.name;
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
    return (
      <div className="mt-10 text-center text-medium-emphasis">
        Glossary item not found.
      </div>
    );
  }

  const defaultLanguage = languageListData?.find((l) => l.isDefault);

  const resolvedLanguage =
    languageListData?.find((l) => l.languageCode === glossary.language)
      ?.languageName ??
    glossary.language ??
    "-";

  return (
    <div>
      <div className="hidden md:flex">
        <PageBreadcrumb />
      </div>

      <div className="mt-5 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{glossary.name}</h1>
        <div className="flex gap-2">
          <Dialog open={editModalOpen} onOpenChange={setEditModalOpen}>
            <DialogTrigger asChild>
              <Button size="default" variant="outline" className="gap-2">
                <Pencil className="h-4 w-4" />
                <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">
                  Edit
                </span>
              </Button>
            </DialogTrigger>
            {editModalOpen && (
              <AddEditGlossary
                glossary={glossary}
                onClose={() => setEditModalOpen(false)}
              />
            )}
          </Dialog>

          <Dialog open={deleteModalOpen} onOpenChange={setDeleteModalOpen}>
            <DialogTrigger asChild>
              <Button size="default" variant="outline" className="gap-2">
                <Trash className="h-4 w-4 text-error" />
                <span className="sr-only text-error sm:not-sr-only sm:whitespace-nowrap">
                  Delete
                </span>
              </Button>
            </DialogTrigger>
            <DeleteGlossary
              itemId={glossary.itemId}
              glossaryName={glossary.name}
              onClose={() => {
                setDeleteModalOpen(false);
                navigate(scoped("services/glossary"));
              }}
            />
          </Dialog>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="h-min rounded-sm shadow-none">
          <CardHeader>
            <CardTitle className="text-xl">Details</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-1">
                <h3 className="text-sm font-medium text-low-emphasis">
                  Language
                </h3>
                <p className="text-base font-normal text-high-emphasis">
                  {resolvedLanguage}
                </p>
              </div>
              <div className="grid gap-1">
                <h3 className="text-sm font-medium text-low-emphasis">Type</h3>
                <p className="text-base font-normal text-high-emphasis">
                  {glossary.type ?? "-"}
                </p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-1">
                <h3 className="text-sm font-medium text-low-emphasis">
                  Is Global
                </h3>
                <p className="text-base font-normal text-high-emphasis">
                  {glossary.isGlobal ? "True" : "False"}
                </p>
              </div>
              <div className="grid gap-1">
                <h3 className="text-sm font-medium text-low-emphasis">
                  Created on
                </h3>
                <p className="text-base font-normal text-high-emphasis">
                  {glossary.createDate
                    ? new Date(glossary.createDate).toLocaleDateString()
                    : "-"}
                </p>
              </div>
            </div>

            {(glossary.moduleIds?.length ?? 0) > 0 && (
              <div className="grid gap-2">
                <h3 className="text-sm font-medium text-low-emphasis">
                  Tagged Modules
                </h3>
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
              <CardTitle className="text-xl">Context</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-base text-medium-emphasis">
                {glossary.context || "No context provided."}
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
                        Additional Notes
                        <CircleAlert className="h-4 w-4 text-medium-emphasis" />
                      </span>
                    </TooltipTrigger>
                    <TooltipContent
                      side="top"
                      className="max-w-80 text-sm font-normal"
                    >
                      Not utilized for auto translation, only given for
                      additional comments by the user
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-base text-medium-emphasis">
                {glossary.additionalNote || "No additional user notes."}
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      <Card className="mt-6 rounded-sm shadow-none">
        <CardHeader>
          <CardTitle className="text-xl">Tagged Keys</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isTaggedKeysLoading ? (
            <div className="flex flex-col gap-2 px-6 pb-6">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full rounded-sm" />
              ))}
            </div>
          ) : isTaggedKeysError || !taggedKeysData ? (
            <p className="px-6 pb-6 text-sm text-medium-emphasis">
              Failed to load tagged keys.
            </p>
          ) : !taggedKeysData.keys?.length ? (
            <p className="px-6 pb-6 text-sm text-medium-emphasis">
              No keys tagged with this glossary.
            </p>
          ) : (
            <>
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
                        {defaultLanguage
                          ? `${defaultLanguage.languageName} (Default)`
                          : "Default Language"}
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {taggedKeysData.keys.map((key) => {
                      const mod = moduleListData?.find(
                        (m) => m.itemId === key.moduleId,
                      );
                      const defaultResource = key.resources?.find(
                        (r) => r.culture === defaultLanguage?.languageCode,
                      );
                      return (
                        <TableRow
                          key={key.itemId}
                          className="cursor-pointer font-normal text-medium-emphasis"
                          onClick={() =>
                            navigate(
                              scoped(
                                `services/language/translations/${key.itemId}`,
                              ),
                            )
                          }
                        >
                          <TableCell className="font-mono text-xs text-high-emphasis">
                            {key.keyName}
                          </TableCell>
                          <TableCell>
                            {mod?.moduleName ?? key.moduleId}
                          </TableCell>
                          <TableCell className="line-clamp-2">
                            {defaultResource?.value || "-"}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
              <div className="flex items-center justify-between border-t px-6 py-3">
                <span className="text-sm text-medium-emphasis">
                  {taggedKeysData.totalCount} key
                  {taggedKeysData.totalCount !== 1 ? "s" : ""} total
                </span>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={keysPage === 0}
                    onClick={() => setKeysPage((p) => p - 1)}
                  >
                    Previous
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={
                      (keysPage + 1) * PAGE_SIZE >=
                      (taggedKeysData.totalCount ?? 0)
                    }
                    onClick={() => setKeysPage((p) => p + 1)}
                  >
                    Next
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default GlossaryDetails;
