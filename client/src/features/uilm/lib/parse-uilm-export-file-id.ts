/**
 * Extracts storage file id from UILM export completion notifications.
 * Mirrors `localization/components/modals/export-key/export-key.tsx` `handleNotificationData`.
 */
export function parseUilmExportFileIdFromNotificationDetail(detail: unknown): string | null {
  if (!detail || typeof detail !== "object") return null;
  const root = detail as Record<string, unknown>;
  const message = root.message;
  if (!message || typeof message !== "object") return null;
  const msg = message as Record<string, unknown>;
  const den = msg.denormalizedPayload;

  let deploymentMessage: unknown;
  if (typeof den === "string") {
    try {
      const parsed = JSON.parse(den) as Record<string, unknown>;
      deploymentMessage = parsed.Message;
    } catch {
      return null;
    }
  } else if (den && typeof den === "object") {
    deploymentMessage = (den as Record<string, unknown>).Message;
  } else {
    return null;
  }

  if (!deploymentMessage || typeof deploymentMessage !== "object") return null;
  const dm = deploymentMessage as Record<string, unknown>;
  const fileId = dm.FileId ?? dm.fileId;
  return typeof fileId === "string" && fileId.length > 0 ? fileId : null;
}
