import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useProjectStore } from "@seliseblocks/genesis-os";
import { formatErrorMessage } from "@/lib/error";
import { localizationQueryKeys } from "@blocks-localization/constants/query-keys";
import { GLOSSARY_CACHE_PREFIXES } from "@blocks-localization/hooks/use-language-manager";
import { GlossaryStatus, IGlossary } from "@blocks-localization/models/language";
import { languageManagerService } from "@blocks-localization/services/language-manager.service";
import { toGlossarySavePayload } from "@blocks-localization/utils/glossary-display";

/** At most this many requests in flight per bulk run (A4). */
export const GLOSSARY_BULK_CONCURRENCY = 4;

export type GlossaryBulkAction =
  | { kind: "status"; status: Extract<GlossaryStatus, "approved" | "deprecated"> }
  | { kind: "set-project" }
  | { kind: "delete" }
  /** `existingIds` must be the module's complete glossary list (C7). */
  | { kind: "tag-module"; moduleId: string; existingIds: string[] };

export interface GlossaryBulkFailure {
  itemId: string;
  name: string;
  message: string;
}

export interface GlossaryBulkResult {
  total: number;
  succeeded: number;
  failed: GlossaryBulkFailure[];
}

export interface GlossaryBulkProgress {
  done: number;
  total: number;
}

/**
 * Runs `task` for every item with at most `limit` in flight. Settles every item: one
 * failure never stops the others (C8), and nothing is retried.
 */
export const runWithConcurrency = async <T, R>(
  items: readonly T[],
  limit: number,
  task: (item: T) => Promise<R>,
  onSettled?: () => void,
): Promise<PromiseSettledResult<R>[]> => {
  const results: PromiseSettledResult<R>[] = new Array(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const index = next++;
      try {
        results[index] = { status: "fulfilled", value: await task(items[index]) };
      } catch (reason) {
        results[index] = { status: "rejected", reason };
      }
      onSettled?.();
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
};

type SaveResponse = Awaited<ReturnType<typeof languageManagerService.saveGlossary>>;

/** The server's message for a rejected save: the first validation error (e.g. `Version`). */
const saveErrorMessage = (res: SaveResponse | undefined) =>
  res?.validationErrors?.[0]?.errorMessage || res?.errorMessage || "Save failed";

const saveWith = async (glossary: IGlossary, change: Partial<ReturnType<typeof toGlossarySavePayload>>) => {
  const res = await languageManagerService.saveGlossary({ ...toGlossarySavePayload(glossary), ...change });
  if (!res?.success) throw new Error(saveErrorMessage(res));
};

const deleteOne = async (glossary: IGlossary) => {
  const res = await languageManagerService.deleteGlossary({ itemId: glossary.itemId });
  if (!res?.isSuccess) throw new Error(formatErrorMessage(res?.errors) || "Delete failed");
};

/**
 * Bulk Approve / Deprecate / Set whole project / Delete / Tag to module over one page of
 * terms. Each save sends the term's full payload with its `version` (no bulk endpoint, A4).
 */
export const useGlossaryBulk = () => {
  const queryClient = useQueryClient();
  const tenantId = useProjectStore()?.selectedProject?.tenantId || "";
  const [progress, setProgress] = useState<GlossaryBulkProgress | null>(null);
  const runningRef = useRef(false);

  const refreshCaches = () => {
    GLOSSARY_CACHE_PREFIXES.forEach((queryKey) => queryClient.invalidateQueries({ queryKey }));
    queryClient.invalidateQueries({ queryKey: localizationQueryKeys.languageKeys.all });
    queryClient.invalidateQueries({ queryKey: localizationQueryKeys.languageKeys.detailPrefix });
  };

  const tagModule = async (
    glossaries: IGlossary[],
    moduleId: string,
    existingIds: string[],
  ): Promise<GlossaryBulkResult> => {
    setProgress({ done: 0, total: glossaries.length });
    const glossaryIds = [...new Set([...existingIds, ...glossaries.map((g) => g.itemId)])];
    try {
      const res = await languageManagerService.tagGlossary({ moduleId, glossaryIds, projectKey: tenantId });
      if (!res?.isSuccess) throw new Error(formatErrorMessage(res?.errors) || "Tagging failed");
      setProgress({ done: glossaries.length, total: glossaries.length });
      return { total: glossaries.length, succeeded: glossaries.length, failed: [] };
    } catch (error) {
      const message = error instanceof Error ? error.message : formatErrorMessage(error);
      return {
        total: glossaries.length,
        succeeded: 0,
        failed: glossaries.map((g) => ({ itemId: g.itemId, name: g.name, message })),
      };
    }
  };

  const run = async (
    action: GlossaryBulkAction,
    glossaries: IGlossary[],
  ): Promise<GlossaryBulkResult | undefined> => {
    if (runningRef.current || glossaries.length === 0) return undefined;
    if (!tenantId) throw new Error("No project selected");
    runningRef.current = true;
    try {
      if (action.kind === "tag-module") {
        return await tagModule(glossaries, action.moduleId, action.existingIds);
      }

      const task = (glossary: IGlossary) => {
        switch (action.kind) {
          case "status":
            return saveWith(glossary, { status: action.status });
          case "set-project":
            return saveWith(glossary, { isGlobal: true, moduleIds: [] });
          case "delete":
            return deleteOne(glossary);
        }
      };

      let done = 0;
      setProgress({ done, total: glossaries.length });
      const results = await runWithConcurrency(glossaries, GLOSSARY_BULK_CONCURRENCY, task, () =>
        setProgress({ done: ++done, total: glossaries.length }),
      );
      const failed = results.flatMap((result, index) =>
        result.status === "rejected"
          ? [
              {
                itemId: glossaries[index].itemId,
                name: glossaries[index].name,
                message:
                  result.reason instanceof Error
                    ? result.reason.message
                    : formatErrorMessage(result.reason),
              },
            ]
          : [],
      );
      return { total: glossaries.length, succeeded: glossaries.length - failed.length, failed };
    } finally {
      refreshCaches();
      setProgress(null);
      runningRef.current = false;
    }
  };

  return { run, progress, isRunning: progress !== null };
};
