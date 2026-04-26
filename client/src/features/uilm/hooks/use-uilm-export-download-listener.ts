import { parseUilmExportFileIdFromNotificationDetail } from "@/features/uilm/lib/parse-uilm-export-file-id";
import { storageFileService } from "@/platform/storage/storage-file.service";
import { useNotificationListener } from "@/platform/notifications/use-notification-listener";
import { showErrorToast } from "@/platform/ui/hooks/use-toast";
import { useCallback } from "react";

const EVENT_NAME = "language-import-export";

/**
 * When the platform dispatches `language-import-export` with a completed export file id,
 * resolves a download URL and triggers a browser download (parity with monolith export modal).
 */
export function useUilmExportDownloadListener(projectKey: string): void {
  const handleNotificationData = useCallback(
    async (detail: unknown) => {
      const fileId = parseUilmExportFileIdFromNotificationDetail(detail);
      if (!fileId) {
        console.error("Export was not successful or no FileId in message");
        showErrorToast({
          errors: "Download failed. Please check the logs for more details.",
        });
        return;
      }
      if (!projectKey) {
        showErrorToast({ errors: "No project context for download." });
        return;
      }

      try {
        const result = await storageFileService.getFileByFileId({
          itemId: fileId,
          projectKey,
        });
        const url = result?.url;
        if (url) {
          const link = document.createElement("a");
          link.href = url;
          link.download = result.name ?? "";
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
        } else {
          console.error("No download URL found after notification");
          showErrorToast({
            errors: "Download failed. Please check the logs for more details.",
          });
        }
      } catch (error) {
        console.error(error);
        showErrorToast({
          errors: "Download failed. Please check the logs for more details.",
        });
      }
    },
    [projectKey],
  );

  useNotificationListener(EVENT_NAME, handleNotificationData);
}
