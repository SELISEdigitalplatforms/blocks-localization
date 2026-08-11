export const FORBIDDEN_ERROR_MESSAGE =
  "You don't have permission to perform this action. Contact your administrator for access.";

type UnknownRecord = Record<string, unknown>;

const isRecord = (value: unknown): value is UnknownRecord =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const parseJson = (value: unknown): unknown => {
  if (typeof value !== "string") return value;

  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
};

const collectErrorRecords = (error: unknown): UnknownRecord[] => {
  const records: UnknownRecord[] = [];
  const queue = [parseJson(error)];
  const visited = new Set<UnknownRecord>();

  while (queue.length > 0) {
    const value = queue.shift();
    if (!isRecord(value) || visited.has(value)) continue;

    visited.add(value);
    records.push(value);

    for (const key of ["response", "data", "error", "errorMessage"]) {
      const nestedValue = parseJson(value[key]);
      if (isRecord(nestedValue)) queue.push(nestedValue);
    }
  }

  return records;
};

const getStatusCode = (record: UnknownRecord): number | undefined => {
  const status = record.status ?? record.Status ?? record.statusCode ?? record.StatusCode;
  const numericStatus = Number(status);
  return Number.isFinite(numericStatus) ? numericStatus : undefined;
};

const collectText = (value: unknown): string[] => {
  if (typeof value === "string") {
    const message = value.trim();
    return message ? [message] : [];
  }

  if (Array.isArray(value)) return value.flatMap(collectText);
  if (isRecord(value)) return Object.values(value).flatMap(collectText);
  return [];
};

const getBackendErrorMessages = (records: UnknownRecord[]): string[] => {
  const messages = records.flatMap((record) =>
    [record.errors, record.errorMessage, record.description, record.detail].flatMap(collectText),
  );

  if (messages.length > 0) return messages;

  return records
    .flatMap((record) => collectText(record.message))
    .filter((message) => !/status code\s*403|^forbidden$/i.test(message));
};

export const getForbiddenErrorMessage = (error: unknown): string | null => {
  const records = collectErrorRecords(error);
  if (!records.some((record) => getStatusCode(record) === 403)) return null;

  const backendMessages = getBackendErrorMessages(records);
  return backendMessages.length > 0 ? backendMessages.join(" ") : FORBIDDEN_ERROR_MESSAGE;
};

export const getErrorMessage = (
  error: Record<string, string | string[]>,
  messageMap: Record<string, string> = {},
): string | string[] => {
  if (!error || Object.keys(error).length === 0) {
    return "Something went wrong.";
  }

  const messages: string[] = [];

  for (const key in error) {
    const value = error[key];

    if (messageMap[key]) {
      messages.push(messageMap[key]);
      continue;
    }

    if (typeof value === "string") {
      messages.push(value);
    } else if (Array.isArray(value) && value.length > 0) {
      messages.push(value.join(", "));
    }
  }

  return messages.length ? messages : "Something went wrong.";
};

export const isErrorWithErrors = (
  error: unknown,
): error is { errors: Record<string, string | string[]> } => {
  return (
    typeof error === "object" &&
    error !== null &&
    "errors" in error &&
    typeof (error as { errors: unknown }).errors === "object"
  );
};

export const handleErrorMessages = (
  errors: unknown,
  customMessages?: Record<string, string>,
): string | string[] => {
  const forbiddenMessage = getForbiddenErrorMessage(errors);
  if (forbiddenMessage) return forbiddenMessage;

  if (typeof errors === "string") return errors;

  if (errors && typeof errors === "object" && !Array.isArray(errors)) {
    return getErrorMessage(errors as Record<string, string | string[]>, customMessages);
  }

  return "An unexpected error occurred.";
};
