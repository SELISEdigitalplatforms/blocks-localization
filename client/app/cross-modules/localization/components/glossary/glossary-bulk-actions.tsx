import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useProjectStore } from "@seliseblocks/genesis-os";
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
import { formatErrorMessage } from "@/lib/error";
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

const pluralizeTerms = (count: number) => `${count} term${count === 1 ? "" : "s"}`;

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
      const failed = results.find((result) => result.status === "rejected");
      if (failed) throw failed.reason;
      return results.reduce(
        (sum, result) => sum + (result.status === "fulfilled" ? (result.value.keyCount ?? 0) : 0),
        0,
      );
    },
    enabled: enabled && ids.length > 0 && !!tenantId,
    staleTime: 0,
    retry: false,
  });
};

const DeleteTermsDialog = ({
  glossaries,
  onConfirm,
  onCancel,
}: Readonly<{ glossaries: IGlossary[]; onConfirm: () => void; onCancel: () => void }>) => {
  const { data: keyCount, isLoading, isError, refetch } = useSummedUsage(glossaries, true);
  const [confirmText, setConfirmText] = useState("");
  const phrase = `delete ${pluralizeTerms(glossaries.length)}`;
  const needsTyping = (keyCount ?? 0) >= BULK_DELETE_CONFIRM_THRESHOLD;
  const canDelete =
    typeof keyCount === "number" && (!needsTyping || confirmText.trim() === phrase);

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Delete {pluralizeTerms(glossaries.length)}</DialogTitle>
        <DialogDescription>
          This can&apos;t be undone. Deleting removes the terms from every key that uses them.
        </DialogDescription>
      </DialogHeader>
      <ul className="max-h-40 list-disc overflow-y-auto pl-5 text-sm text-high-emphasis">
        {glossaries.map((glossary) => (
          <li key={glossary.itemId}>{glossary.name}</li>
        ))}
      </ul>
      {isLoading && <p className="text-sm text-medium-emphasis">Checking usage…</p>}
      {isError && (
        <div className="flex items-center gap-2">
          <p className="text-sm text-error">Failed to check how many keys use these terms.</p>
          <Button type="button" size="sm" variant="outline" onClick={() => void refetch()}>
            Retry
          </Button>
        </div>
      )}
      {typeof keyCount === "number" && (
        <p className="text-sm text-medium-emphasis">
          Used by {keyCount} key{keyCount === 1 ? "" : "s"} in total.
        </p>
      )}
      {needsTyping && (
        <div className="grid gap-2">
          <Label htmlFor="glossary-bulk-delete-confirm">
            Type &quot;{phrase}&quot; to confirm
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
          Cancel
        </Button>
        <Button type="button" variant="destructive" disabled={!canDelete} onClick={onConfirm}>
          Delete
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
  const { data: modules } = useGetLanguageModules();
  const [moduleId, setModuleId] = useState("");
  // Tagging replaces the module's whole list, so it must start from every existing tag (C7).
  const { data: existing, isLoading, isError } = useGetAllModuleGlossaries(moduleId);
  const canTag = !!moduleId && !isLoading && !isError && !!existing;

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Tag {pluralizeTerms(count)} to a module</DialogTitle>
        <DialogDescription>The module keeps the terms it already has.</DialogDescription>
      </DialogHeader>
      <Select value={moduleId} onValueChange={setModuleId}>
        <SelectTrigger aria-label="Module">
          <SelectValue placeholder="Select module" />
        </SelectTrigger>
        <SelectContent>
          {modules?.map((module) => (
            <SelectItem key={module.itemId} value={module.itemId}>
              {module.moduleName}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {moduleId && isLoading && (
        <p className="text-sm text-medium-emphasis">Loading the module&apos;s glossaries…</p>
      )}
      {moduleId && isError && (
        <p role="alert" className="text-sm text-error">
          Couldn&apos;t load the module&apos;s glossaries
        </p>
      )}
      <DialogFooter className="mt-2">
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          type="button"
          disabled={!canTag}
          onClick={() => onConfirm(moduleId, (existing ?? []).map((glossary) => glossary.itemId))}
        >
          Tag
        </Button>
      </DialogFooter>
    </DialogContent>
  );
};

const SetProjectDialog = ({
  count,
  onConfirm,
  onCancel,
}: Readonly<{ count: number; onConfirm: () => void; onCancel: () => void }>) => (
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Set {pluralizeTerms(count)} to whole project</DialogTitle>
      <DialogDescription>
        The terms will apply to every key in the project. Removes their module links.
      </DialogDescription>
    </DialogHeader>
    <DialogFooter className="mt-2">
      <Button type="button" variant="secondary" onClick={onCancel}>
        Cancel
      </Button>
      <Button type="button" onClick={onConfirm}>
        Set whole project
      </Button>
    </DialogFooter>
  </DialogContent>
);

const GlossaryBulkActions = ({
  selected,
  onClearSelection,
  onReload,
}: Readonly<GlossaryBulkActionsProps>) => {
  const { run, progress, isRunning } = useGlossaryBulk();
  const [dialog, setDialog] = useState<DialogKind>(null);
  const [failures, setFailures] = useState<GlossaryBulkFailure[]>([]);

  const execute = async (action: GlossaryBulkAction) => {
    setDialog(null);
    setFailures([]);
    const verb = action.kind === "delete" ? "Deleted" : "Updated";
    let result: GlossaryBulkResult | undefined;
    try {
      result = await run(action, selected);
    } catch (error) {
      toast({ variant: "destructive", title: "Error", description: formatErrorMessage(error) });
      return;
    }
    if (!result) return;
    toast({
      variant: result.failed.length === 0 ? "success" : "destructive",
      title: result.failed.length === 0 ? "Success" : "Some terms failed",
      description: `${verb} ${result.succeeded} of ${pluralizeTerms(result.total)}`,
    });
    setFailures(result.failed);
    onClearSelection();
  };

  return (
    <>
      {selected.length > 0 && (
        <div
          role="toolbar"
          aria-label="Bulk actions"
          className="mb-3 flex flex-wrap items-center gap-2 rounded-md border border-border bg-muted/40 px-3 py-2"
        >
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="h-8 w-8 shrink-0"
            aria-label="Clear selection"
            title="Clear selection"
            disabled={isRunning}
            onClick={onClearSelection}
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </Button>
          <span className="mr-2 text-sm font-medium text-high-emphasis" aria-live="polite">
            {progress
              ? `Updating ${progress.done} / ${progress.total}…`
              : `${selected.length} selected`}
          </span>
          <Button
            size="sm"
            variant="outline"
            disabled={isRunning}
            onClick={() => void execute({ kind: "status", status: "approved" })}
          >
            <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
            Approve
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={isRunning}
            onClick={() => void execute({ kind: "status", status: "deprecated" })}
          >
            <Archive className="h-4 w-4" aria-hidden="true" />
            Deprecate
          </Button>
          <Button size="sm" variant="outline" disabled={isRunning} onClick={() => setDialog("tag-module")}>
            <Tag className="h-4 w-4" aria-hidden="true" />
            Tag to module
          </Button>
          <Button size="sm" variant="outline" disabled={isRunning} onClick={() => setDialog("set-project")}>
            <Globe className="h-4 w-4" aria-hidden="true" />
            Set whole project
          </Button>
          <Button size="sm" variant="destructive" disabled={isRunning} onClick={() => setDialog("delete")}>
            <Trash className="h-4 w-4" aria-hidden="true" />
            Delete
          </Button>
          {isRunning && <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />}
        </div>
      )}

      {failures.length > 0 && (
        <Alert variant="destructive" className="mb-3">
          <TriangleAlert />
          <AlertDescription>
            <p>{pluralizeTerms(failures.length)} couldn&apos;t be changed:</p>
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
              Reload
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
          <DeleteTermsDialog
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
