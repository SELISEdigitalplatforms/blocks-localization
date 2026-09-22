import { useCallback, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useNotificationListener } from "@blocks-utilities/notification";
import { localizationQueryKeys } from "@blocks-localization/constants/query-keys";
import type { ILanguageImportRequest } from "@blocks-localization/models/language";
import { toast } from "@/hooks/use-toast";

export type LanguageImportStatus = "processing" | "finalizing" | "delayed" | "failed";

export interface LanguageImportProgress {
  status: LanguageImportStatus;
  pendingCorrelationIds: string[];
  fileNames: string[];
  baselineTotalCount: number;
}

interface LanguageKeysQueryResult {
  data?: { totalCount?: number };
}

interface UseLanguageImportProgressOptions {
  totalCount: number;
  refetch?: () => Promise<LanguageKeysQueryResult>;
}

const parseObject = (value: unknown): Record<string, unknown> | null => {
  if (!value) return null;
  if (typeof value === "object") return value as Record<string, unknown>;
  if (typeof value !== "string") return null;

  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
};

const getString = (source: Record<string, unknown> | null | undefined, keys: string[]) => {
  for (const key of keys) {
    const value = source?.[key];
    if (typeof value === "string" && value.trim()) return value;
  }
  return undefined;
};

const getBoolean = (source: Record<string, unknown> | null | undefined, keys: string[]) => {
  for (const key of keys) {
    const value = source?.[key];
    if (typeof value === "boolean") return value;
    if (typeof value === "string" && ["true", "false"].includes(value.toLowerCase())) {
      return value.toLowerCase() === "true";
    }
  }
  return undefined;
};

const extractImportNotification = (notificationData: unknown) => {
  const root = parseObject(notificationData);
  const message = parseObject(root?.message ?? root?.Message);
  const notification = message ?? root;
  const payload = parseObject(notification?.payload ?? notification?.Payload);
  const denormalizedPayload = parseObject(
    notification?.denormalizedPayload ??
      notification?.DenormalizedPayload ??
      root?.denormalizedPayload ??
      root?.DenormalizedPayload,
  );
  const denormalizedMessage = parseObject(
    denormalizedPayload?.message ?? denormalizedPayload?.Message,
  );

  return {
    correlationId:
      getString(payload, ["responseKey", "ResponseKey", "correlationId", "CorrelationId"]) ??
      getString(notification, ["responseKey", "ResponseKey", "correlationId", "CorrelationId"]),
    isSuccess:
      getBoolean(denormalizedPayload, ["isSuccess", "IsSuccess"]) ??
      getBoolean(denormalizedMessage, ["isSuccess", "IsSuccess"]) ??
      getBoolean(notification, ["isSuccess", "IsSuccess"]),
  };
};

export const getImportFileLabel = (fileNames: string[]) => {
  if (fileNames.length === 0) return "Your file";
  if (fileNames.length === 1) return fileNames[0];
  return `${fileNames[0]} and ${fileNames.length - 1} more`;
};

export const useLanguageImportProgress = ({
  totalCount,
  refetch,
}: Readonly<UseLanguageImportProgressOptions>) => {
  const queryClient = useQueryClient();
  const [progress, setProgress] = useState<LanguageImportProgress | null>(null);
  const progressRef = useRef<LanguageImportProgress | null>(null);

  const onImportStarted = useCallback(
    ({ correlationId, fileName }: ILanguageImportRequest) => {
      setProgress((current) => {
        const joinsCurrentBatch = current?.status === "processing";
        const next: LanguageImportProgress = joinsCurrentBatch
          ? {
              ...current,
              pendingCorrelationIds: current.pendingCorrelationIds.includes(correlationId)
                ? current.pendingCorrelationIds
                : [...current.pendingCorrelationIds, correlationId],
              fileNames: current.fileNames.includes(fileName)
                ? current.fileNames
                : [...current.fileNames, fileName],
            }
          : {
              status: "processing",
              pendingCorrelationIds: [correlationId],
              fileNames: [fileName],
              baselineTotalCount: totalCount,
            };
        progressRef.current = next;
        return next;
      });
    },
    [totalCount],
  );

  const onImportRequestFailed = useCallback((correlationId: string) => {
    setProgress((current) => {
      if (!current) return null;
      const pendingCorrelationIds = current.pendingCorrelationIds.filter(
        (id) => id !== correlationId,
      );
      const next = pendingCorrelationIds.length > 0 ? { ...current, pendingCorrelationIds } : null;
      progressRef.current = next;
      return next;
    });
  }, []);

  const handleNotification = useCallback(
    (notificationData: unknown) => {
      const current = progressRef.current;
      if (!current || current.pendingCorrelationIds.length === 0) return;

      const { correlationId, isSuccess } = extractImportNotification(notificationData);

      const findMatchingCorrelationId = () => {
        if (correlationId) {
          return current.pendingCorrelationIds.find((id) => id === correlationId);
        }
        if (current.pendingCorrelationIds.length === 1) {
          return current.pendingCorrelationIds[0];
        }
        return undefined;
      };

      const matchingId = findMatchingCorrelationId();
      if (!matchingId) return;

      const pendingCorrelationIds = current.pendingCorrelationIds.filter((id) => id !== matchingId);
      const nextStatus: LanguageImportProgress["status"] = (() => {
        if (isSuccess === false) return "failed";
        if (pendingCorrelationIds.length === 0) return "finalizing";
        return "processing";
      })();
      const next: LanguageImportProgress =
        isSuccess === false
          ? { ...current, status: "failed", pendingCorrelationIds: [] }
          : { ...current, status: nextStatus, pendingCorrelationIds };

      progressRef.current = next;
      setProgress(next);

      if (isSuccess === false) {
        toast({
          variant: "destructive",
          title: "Import failed",
          description: "The uploaded file could not be processed.",
        });
        return;
      }

      void queryClient.invalidateQueries({ queryKey: localizationQueryKeys.languageKeys.all });
      void queryClient.invalidateQueries({ queryKey: localizationQueryKeys.modules.all });
      void queryClient.invalidateQueries({ queryKey: localizationQueryKeys.languages.all });
    },
    [queryClient],
  );

  useNotificationListener("language-import-export", handleNotification);

  // Normally the completion notification flips status to "finalizing" and this effect
  // takes it from there. But the websocket notification can be dropped or delayed, which
  // would otherwise leave the progress UI stuck on "processing" forever even though the
  // import already finished server-side. To guard against that, this effect also polls
  // as a fallback while still "processing" (after a grace period so the fast notification
  // path stays the common case) and keeps polling through "delayed" instead of giving up,
  // so the table recovers on its own without requiring a hard reload.
  useEffect(() => {
    const activeProgress = progress;
    if (!refetch || !activeProgress) return;
    if (
      activeProgress.status !== "finalizing" &&
      activeProgress.status !== "processing" &&
      activeProgress.status !== "delayed"
    ) {
      return;
    }

    let cancelled = false;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    let attempts = 0;
    const baselineTotalCount = activeProgress.baselineTotalCount;

    const poll = async () => {
      attempts += 1;

      const current = progressRef.current;
      if (!current || current.status === "failed") return;

      try {
        const result = await refetch();
        if (cancelled) return;

        const refreshedTotalCount = result.data?.totalCount ?? 0;
        if (refreshedTotalCount > baselineTotalCount) {
          progressRef.current = null;
          setProgress(null);
          toast({
            variant: "success",
            title: "Import complete",
            description: "Your imported translation keys are ready.",
          });
          return;
        }
      } catch {
        // Keep polling through transient list-query failures.
      }

      if (cancelled) return;

      if (attempts >= 60) {
        setProgress((current) => {
          if (!current || current.status === "failed" || current.status === "delayed") {
            return current;
          }
          const next = { ...current, status: "delayed" as const };
          progressRef.current = next;
          return next;
        });
      }

      timeoutId = setTimeout(poll, 5000);
    };

    const initialDelay = activeProgress.status === "processing" ? 15000 : 0;
    timeoutId = setTimeout(poll, initialDelay);

    return () => {
      cancelled = true;
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [progress?.baselineTotalCount, progress?.status, refetch]);

  return { progress, onImportStarted, onImportRequestFailed };
};
