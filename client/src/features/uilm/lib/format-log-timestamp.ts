/** Parity with `@blocks-lmt/utils` `getLogFormatTimestamp`. */
export function formatLogTimestamp(timestamp: string): string {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return timestamp;
  return date.toISOString().replace("T", " ").replace("Z", "").slice(0, -4);
}
