import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useProjectStore } from "@seliseblocks/genesis-os";
import { useT } from "@seliseblocks/genesis-os/i18n";
import { Archive, CheckCircle2, Globe, LoaderCircle, Tag, Trash, TriangleAlert, X } from "lucide-react";
import { Button } from "@/components/ui-kits/button/button";
import { Alert, AlertDescription } from "@/components/ui-kits/alert/alert";
import { Input } from "@/components/ui-kits/input/input";
import { Label } from "@/components/ui-kits/label/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui-kits/dialog/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui-kits/select/select";
import { toast } from "@/hooks/use-toast";
import { formatErrorMessage, getForbiddenErrorMessage } from "@/lib/error";
import {
  useGetAllModuleGlossaries,
  useGetLanguageModules,
} from "@blocks-localization/hooks/use-language-manager";
import {
  GLOSSARY_BULK_CONCURRENCY,
  GlossaryBulkAction,
  GlossaryBulkFailure,
  GlossaryBulkResult,
  runWithConcurrency,
  useGlossaryBulk,
} from "@blocks-localization/hooks/use-glossary-bulk";
import { localizationQueryKeys } from "@blocks-localization/constants/query-keys";
import { IGlossary } from "@blocks-localization/models/language";
import { languageManagerService } from "@blocks-localization/services/language-manager.service";

/** Summed key usage from which a bulk delete needs "delete N terms" typed (Phase 8 A3). */
export const BULK_DELETE_CONFIRM_THRESHOLD = 50;

const LOCALIZATION_GLOSSARY_MODULE = "localization.glossary";

const isForbidden = (error: unknown) => getForbiddenErrorMessage(error) !== null;

type DialogKind = "set-project" | "delete" | "tag-module" | null;

interface GlossaryBulkActionsProps {
  selected: IGlossary[];
  onClearSelection: () => void;
  onReload: () => void;
}

/** Summed `Usage?pageSize=1` key counts of the selected terms, ≤ 4 requests in flight. */
const useSummedUsage = (glossaries: IGlossary[], enabled: boolean) => {
  const tenantId = useProjectStore()?.selectedProject?.tenantId || "";
  const ids = glossaries.map((glossary) => glossary.itemId);
  return useQuery({
    // Under `glossaries.all`, so glossary writes refresh it.
    queryKey: [...localizationQueryKeys.glossaries.all, "bulk-usage", tenantId, ids.join(",")],
    queryFn: async () => {
      const results = await runWithConcurrency(ids, GLOSSARY_BULK_CONCURRENCY, (itemId) =>
        languageManagerService.getGlossaryUsage({ itemId, pageSize: 1 }),
      );
      const rejected = results.flatMap((result) =>
        result.status === "rejected" ? [result.reason as unknown] : [],
      );
      if (rejected.length > 0) throw rejected.find(isForbidden) ?? rejected[0];
      return results.reduce(
        (sum, result) =>
          sum +
          (result.status === "fulfilled"
            ? (result.value.affectedKeyCount ?? result.value.keyCount ?? 0)
            : 0),
        0,
      );
    },
    enabled: enabled && ids.length > 0 && !!tenantId,
    staleTime: 0,
    retry: false,
  });
};

const DeleteGlossariesDialog = ({
  glossaries,
  onConfirm,
  onCancel,
}: Readonly<{ glossaries: IGlossary[]; onConfirm: () => void; onCancel: () => void }>) => {
  const { t } = useT(LOCALIZATION_GLOSSARY_MODULE);
  const { data: keyCount, isLoading, isError, error, refetch } = useSummedUsage(glossaries, true);
  const [confirmText, setConfirmText] = useState("");
  const count = glossaries.length;
  const phrase = t("GLOSSARY_BULK.DELETE_PHRASE", { count });
  const isCountUnavailable = isError && isForbidden(error);
  const needsTyping = isCountUnavailable || (keyCount ?? 0) >= BULK_DELETE_CONFIRM_THRESHOLD;
  const canDelete =
    (typeof keyCount === "number" || isCountUnavailable) &&
    (!needsTyping || confirmText.trim() === phrase);

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>{t("GLOSSARY_BULK.DELETE_TITLE", { count })}</DialogTitle>
        <DialogDescription>{t("GLOSSARY_BULK.DELETE_DESCRIPTION")}</DialogDescription>
      </DialogHeader>
      <ul className="max-h-40 list-disc overflow-y-auto pl-5 text-sm text-high-emphasis">
        {glossaries.map((glossary) => (
          <li key={glossary.itemId}>{glossary.name}</li>
        ))}
      </ul>
      {isLoading && (
        <p className="text-sm text-medium-emphasis">{t("GLOSSARY_BULK.CHECKING_USAGE")}</p>
      )}
      {isCountUnavailable && (
        <p className="text-sm text-medium-emphasis">{t("GLOSSARY_BULK.COUNT_UNAVAILABLE")}</p>
      )}
      {isError && !isCountUnavailable && (
        <div className="flex items-center gap-2">
          <p className="text-sm text-error">{t("GLOSSARY_BULK.CHECK_FAILED")}</p>
          <Button type="button" size="sm" variant="outline" onClick={() => void refetch()}>
            {t("common:RETRY")}
          </Button>
        </div>
      )}
      {typeof keyCount === "number" && (
        <p className="text-sm text-medium-emphasis">
          {/* Summed per glossary, so a key two of them apply to counts twice. */}
          {t("GLOSSARY_BULK.USED_BY_UP_TO", { count: keyCount })}
        </p>
      )}
      {needsTyping && (
        <div className="grid gap-2">
          <Label htmlFor="glossary-bulk-delete-confirm">
            {t("GLOSSARY_BULK.TYPE_TO_CONFIRM", { phrase })}
          </Label>
          <Input
            id="glossary-bulk-delete-confirm"
            value={confirmText}
            onChange={(event) => setConfirmText(event.target.value)}
            autoComplete="off"
          />
        </div>
      )}
      <DialogFooter className="mt-2">
        <Button type="button" variant="secondary" onClick={onCancel}>
          {t("common:CANCEL")}
        </Button>
        <Button type="button" variant="destructive" disabled={!canDelete} onClick={onConfirm}>
          {t("GLOSSARY_BULK.DELETE")}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
};

const TagModuleDialog = ({
  count,
  onConfirm,
  onCancel,
}: Readonly<{
  count: number;
  onConfirm: (moduleId: string, existingIds: string[]) => void;
  onCancel: () => void;
}>) => {
  const { t } = useT(LOCALIZATION_GLOSSARY_MODULE);
  const { data: modules } = useGetLanguageModules();
  const [moduleId, setModuleId] = useState("");
  // Tagging replaces the module's whole list, so it must start from every existing tag (C7).
  // Only data fetched for this dialog counts: a cached list may miss tags added since.
  const { data: existing, isLoading, isError, isFetching, isFetchedAfterMount } =
    useGetAllModuleGlossaries(moduleId);
  const canTag =
    !!moduleId && !isLoading && !isError && !!existing && isFetchedAfterMount && !isFetching;

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>{t("GLOSSARY_BULK.TAG_TITLE", { count })}</DialogTitle>
        <DialogDescription>{t("GLOSSARY_BULK.TAG_DESCRIPTION")}</DialogDescription>
      </DialogHeader>
      <Select value={moduleId} onValueChange={setModuleId}>
        <SelectTrigger aria-label={t("GLOSSARY_BULK.MODULE_ARIA")}>
          <SelectValue placeholder={t("GLOSSARY_BULK.SELECT_MODULE")} />
        </SelectTrigger>
        <SelectContent>
          {modules?.map((module) => (
            <SelectItem key={module.itemId} value={module.itemId}>
              {module.moduleName}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {moduleId && !isError && (isLoading || isFetching) && (
        <p className="text-sm text-medium-emphasis">
          {t("GLOSSARY_BULK.LOADING_MODULE_GLOSSARIES")}
        </p>
      )}
      {moduleId && isError && (
        <p role="alert" className="text-sm text-error">
          {t("GLOSSARY_BULK.LOAD_MODULE_GLOSSARIES_FAILED")}
        </p>
      )}
      <DialogFooter className="mt-2">
        <Button type="button" variant="secondary" onClick={onCancel}>
          {t("common:CANCEL")}
        </Button>
        <Button
          type="button"
          disabled={!canTag}
          onClick={() => onConfirm(moduleId, (existing ?? []).map((glossary) => glossary.itemId))}
        >
          {t("GLOSSARY_BULK.TAG")}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
};

const SetProjectDialog = ({
  count,
  onConfirm,
  onCancel,
}: Readonly<{ count: number; onConfirm: () => void; onCancel: () => void }>) => {
  const { t } = useT(LOCALIZATION_GLOSSARY_MODULE);
  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>{t("GLOSSARY_BULK.SET_PROJECT_TITLE", { count })}</DialogTitle>
        <DialogDescription>{t("GLOSSARY_BULK.SET_PROJECT_DESCRIPTION")}</DialogDescription>
      </DialogHeader>
      <DialogFooter className="mt-2">
        <Button type="button" variant="secondary" onClick={onCancel}>
          {t("common:CANCEL")}
        </Button>
        <Button type="button" onClick={onConfirm}>
          {t("GLOSSARY_BULK.SET_WHOLE_PROJECT")}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
};

const GlossaryBulkActions = ({
  selected,
  onClearSelection,
  onReload,
}: Readonly<GlossaryBulkActionsProps>) => {
  const { t } = useT(LOCALIZATION_GLOSSARY_MODULE);
  const { run, progress, isRunning } = useGlossaryBulk();
  const [dialog, setDialog] = useState<DialogKind>(null);
  const [failures, setFailures] = useState<GlossaryBulkFailure[]>([]);

  const execute = async (action: GlossaryBulkAction) => {
    setDialog(null);
    setFailures([]);
    let result: GlossaryBulkResult | undefined;
    try {
      result = await run(action, selected);
    } catch (error) {
      toast({ variant: "destructive", title: t("common:ERROR"), description: formatErrorMessage(error) });
      return;
    }
    if (!result) return;
    toast({
      variant: result.failed.length === 0 ? "success" : "destructive",
      title: t(
        result.failed.length === 0 ? "GLOSSARY_BULK.RESULT_SUCCESS" : "GLOSSARY_BULK.RESULT_PARTIAL",
      ),
      description: t(
        action.kind === "delete"
          ? "GLOSSARY_BULK.RESULT_DESCRIPTION_DELETED"
          : "GLOSSARY_BULK.RESULT_DESCRIPTION_UPDATED",
        { succeeded: result.succeeded, count: result.total },
      ),
    });
    setFailures(result.failed);
    onClearSelection();
  };

  return (
    <>
      {selected.length > 0 && (
        <div
          role="toolbar"
          aria-label={t("GLOSSARY_BULK.TOOLBAR_ARIA")}
          className="mb-3 flex flex-wrap items-center gap-2 rounded-md border border-border bg-muted/40 px-3 py-2"
        >
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="h-8 w-8 shrink-0"
            aria-label={t("GLOSSARY_BULK.CLEAR_SELECTION")}
            title={t("GLOSSARY_BULK.CLEAR_SELECTION")}
            disabled={isRunning}
            onClick={onClearSelection}
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </Button>
          <span className="mr-2 text-sm font-medium text-high-emphasis" aria-live="polite">
            {progress
              ? t("GLOSSARY_BULK.UPDATING", { done: progress.done, total: progress.total })
              : t("GLOSSARY_BULK.SELECTED", { count: selected.length })}
          </span>
          <Button
            size="sm"
            variant="outline"
            disabled={isRunning}
            onClick={() => void execute({ kind: "status", status: "approved" })}
          >
            <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
            {t("GLOSSARY_BULK.APPROVE")}
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={isRunning}
            onClick={() => void execute({ kind: "status", status: "deprecated" })}
          >
            <Archive className="h-4 w-4" aria-hidden="true" />
            {t("GLOSSARY_BULK.DEPRECATE")}
          </Button>
          <Button size="sm" variant="outline" disabled={isRunning} onClick={() => setDialog("tag-module")}>
            <Tag className="h-4 w-4" aria-hidden="true" />
            {t("GLOSSARY_BULK.TAG_TO_MODULE")}
          </Button>
          <Button size="sm" variant="outline" disabled={isRunning} onClick={() => setDialog("set-project")}>
            <Globe className="h-4 w-4" aria-hidden="true" />
            {t("GLOSSARY_BULK.SET_WHOLE_PROJECT")}
          </Button>
          <Button size="sm" variant="destructive" disabled={isRunning} onClick={() => setDialog("delete")}>
            <Trash className="h-4 w-4" aria-hidden="true" />
            {t("GLOSSARY_BULK.DELETE")}
          </Button>
          {isRunning && <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />}
        </div>
      )}

      {failures.length > 0 && (
        <Alert variant="destructive" className="mb-3">
          <TriangleAlert />
          <AlertDescription>
            <p>{t("GLOSSARY_BULK.FAILURES_TITLE", { count: failures.length })}</p>
            <ul className="mt-1 list-disc pl-5">
              {failures.map((failure) => (
                <li key={failure.itemId}>
                  <span className="font-medium">{failure.name}</span>: {failure.message}
                </li>
              ))}
            </ul>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="mt-2"
              onClick={() => {
                setFailures([]);
                onReload();
              }}
            >
              {t("GLOSSARY_BULK.RELOAD")}
            </Button>
          </AlertDescription>
        </Alert>
      )}

      <Dialog open={dialog !== null} onOpenChange={(open) => !open && setDialog(null)}>
        {dialog === "set-project" && (
          <SetProjectDialog
            count={selected.length}
            onConfirm={() => void execute({ kind: "set-project" })}
            onCancel={() => setDialog(null)}
          />
        )}
        {dialog === "delete" && (
          <DeleteGlossariesDialog
            glossaries={selected}
            onConfirm={() => void execute({ kind: "delete" })}
            onCancel={() => setDialog(null)}
          />
        )}
        {dialog === "tag-module" && (
          <TagModuleDialog
            count={selected.length}
            onConfirm={(moduleId, existingIds) =>
              void execute({ kind: "tag-module", moduleId, existingIds })
            }
            onCancel={() => setDialog(null)}
          />
        )}
      </Dialog>
    </>
  );
};

export default GlossaryBulkActions;
