export function isErrorWithErrors(
  error: unknown,
): error is { errors: Record<string, string | string[]> } {
  return (
    typeof error === "object" &&
    error !== null &&
    "errors" in error &&
    typeof (error as { errors: unknown }).errors === "object" &&
    (error as { errors: unknown }).errors !== null
  );
}
