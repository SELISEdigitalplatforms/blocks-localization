import {
  FileInput,
  FileUploader,
  FileUploaderContent,
  FileUploaderItem,
} from "@/components/file-uploader/file-uploader";
import { Button } from "@/components/ui-kits/button/button";
import {
  DialogClose,
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
import { showErrorToast, showSuccessToast, toast } from "@/hooks/use-toast";
import { isErrorWithErrors } from "@/lib/error";
import { useImportLanguageFile } from "@blocks-localization/hooks/use-language-manager";
import { IImportFile, ILanguageImportRequest } from "@blocks-localization/models/language";
import { ArrowDownToLine, CloudUpload, Paperclip, TriangleAlert } from "lucide-react";
import { useState } from "react";
import { v4 as uuidv4 } from "uuid";
import { useGetPreSignedUrlForUpload, useUploadFile } from "@blocks-storage/hooks/use-storage-file";
import { storageService } from "@blocks-storage/services/storage.service";
import { ModuleName } from "@/constants/modules.constants";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui-kits/tooltip/tooltip";

// Allowed file extensions for import
const ALLOWED_EXTENSIONS = [".csv", ".xlsx", ".json"];

// Validation result type
interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

interface ZipEntry {
  compressionMethod: number;
  compressedSize: number;
  localHeaderOffset: number;
}

const getUploadToastErrors = (error: unknown): unknown => {
  if (isErrorWithErrors(error)) {
    return Array.isArray(error.errors) ? error.errors.join(", ") : error.errors;
  }

  if (error instanceof Error) {
    return error.message;
  }

  if (Array.isArray(error)) {
    return error.join(", ");
  }

  if (typeof error === "string") {
    return error;
  }

  if (error && typeof error === "object") {
    return error;
  }

  return "An unexpected error occurred during upload. Please try again.";
};

/**
 * Detects the delimiter used in a CSV line
 * Returns the most likely delimiter (comma, semicolon, or tab)
 */
const detectDelimiter = (line: string): string => {
  const delimiters = [",", ";", "\t"];
  const counts = delimiters.map((d) => ({
    delimiter: d,
    count: (line.match(new RegExp(`\\${d}`, "g")) || []).length,
  }));
  // Return the delimiter with the highest count, default to comma
  // Seeded so an empty candidate list falls back to the comma rather than throwing.
  const best = counts.reduce<{ delimiter: string; count: number }>(
    (prev, curr) => (curr.count > prev.count ? curr : prev),
    { delimiter: ",", count: 0 },
  );
  return best.count > 0 ? best.delimiter : ",";
};

/**
 * Parses CSV content and returns array of records
 * Handles quoted fields, escaped quotes, and various delimiters
 */
const parseCSVContent = (content: string): { headers: string[]; rows: string[][] } => {
  // Remove BOM (Byte Order Mark) if present
  const cleanContent = content.replace(/^\uFEFF/, "");
  const headerLine = cleanContent.split(/\r?\n/).find((line) => line.trim() !== "");

  if (!headerLine) {
    return { headers: [], rows: [] };
  }

  // Detect delimiter from the header line
  const delimiter = detectDelimiter(headerLine);

  const parseCSVRecords = (csvContent: string, delim: string): string[][] => {
    const records: string[][] = [];
    let record: string[] = [];
    let current = "";
    let inQuotes = false;

    const pushRecord = () => {
      record.push(current.trim());
      if (record.some((field) => field.trim() !== "")) {
        records.push(record);
      }
      record = [];
      current = "";
    };

    for (let i = 0; i < csvContent.length; i++) {
      const char = csvContent[i];
      if (char === '"') {
        if (inQuotes && csvContent[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === delim && !inQuotes) {
        record.push(current.trim());
        current = "";
      } else if ((char === "\n" || char === "\r") && !inQuotes) {
        if (char === "\r" && csvContent[i + 1] === "\n") {
          i++;
        }
        pushRecord();
      } else {
        current += char;
      }
    }

    if (inQuotes) {
      throw new Error("Invalid CSV content");
    }

    if (current !== "" || record.length > 0) {
      pushRecord();
    }

    return records;
  };

  const mergeContinuedRows = (records: string[][], expectedColumnCount: number) => {
    const mergedRows: string[][] = [];
    let pendingRow: string[] | null = null;

    const appendContinuation = (target: string[], continuation: string[]) => {
      if (target.length === 0) {
        target.push(...continuation);
        return;
      }

      const lastIndex = target.length - 1;
      const [firstField, ...remainingFields] = continuation;
      if (firstField !== undefined) {
        target[lastIndex] = target[lastIndex] ? `${target[lastIndex]}\n${firstField}` : firstField;
      }
      target.push(...remainingFields);
    };

    for (const record of records) {
      if (!pendingRow) {
        pendingRow = [...record];
      } else if (pendingRow.length < expectedColumnCount) {
        appendContinuation(pendingRow, record);
      } else {
        mergedRows.push(pendingRow);
        pendingRow = [...record];
      }

      if (pendingRow.length >= expectedColumnCount) {
        mergedRows.push(pendingRow);
        pendingRow = null;
      }
    }

    if (pendingRow) {
      mergedRows.push(pendingRow);
    }

    return mergedRows;
  };

  const records = parseCSVRecords(cleanContent, delimiter);
  const headers = records[0] ?? [];
  const rows = mergeContinuedRows(records.slice(1), headers.length);

  return { headers, rows };
};

const getUint16 = (view: DataView, offset: number) => view.getUint16(offset, true);

const getUint32 = (view: DataView, offset: number) => view.getUint32(offset, true);

const decodeUtf8 = (bytes: Uint8Array) => new TextDecoder().decode(bytes);

const findEndOfCentralDirectory = (bytes: Uint8Array) => {
  const minOffset = Math.max(0, bytes.length - 0xffff - 22);
  for (let offset = bytes.length - 22; offset >= minOffset; offset--) {
    if (
      bytes[offset] === 0x50 &&
      bytes[offset + 1] === 0x4b &&
      bytes[offset + 2] === 0x05 &&
      bytes[offset + 3] === 0x06
    ) {
      return offset;
    }
  }
  return -1;
};

const readZipEntries = (bytes: Uint8Array): Map<string, ZipEntry> => {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const endOffset = findEndOfCentralDirectory(bytes);

  if (endOffset === -1) {
    throw new Error("Invalid XLSX archive");
  }

  const centralDirectorySize = getUint32(view, endOffset + 12);
  const centralDirectoryOffset = getUint32(view, endOffset + 16);
  const entries = new Map<string, ZipEntry>();
  let offset = centralDirectoryOffset;
  const directoryEnd = centralDirectoryOffset + centralDirectorySize;

  while (offset < directoryEnd) {
    if (getUint32(view, offset) !== 0x02014b50) {
      throw new Error("Invalid XLSX archive");
    }

    const compressionMethod = getUint16(view, offset + 10);
    const compressedSize = getUint32(view, offset + 20);
    const fileNameLength = getUint16(view, offset + 28);
    const extraFieldLength = getUint16(view, offset + 30);
    const fileCommentLength = getUint16(view, offset + 32);
    const localHeaderOffset = getUint32(view, offset + 42);
    const fileName = decodeUtf8(bytes.slice(offset + 46, offset + 46 + fileNameLength));

    entries.set(fileName, {
      compressionMethod,
      compressedSize,
      localHeaderOffset,
    });

    offset += 46 + fileNameLength + extraFieldLength + fileCommentLength;
  }

  return entries;
};

const inflateRaw = async (data: Uint8Array): Promise<Uint8Array> => {
  if (typeof DecompressionStream === "undefined") {
    throw new Error("XLSX decompression is not supported");
  }

  const buffer = data.buffer.slice(
    data.byteOffset,
    data.byteOffset + data.byteLength,
  ) as ArrayBuffer;
  const stream = new Blob([buffer]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
  const inflatedBuffer = await new Response(stream).arrayBuffer();
  return new Uint8Array(inflatedBuffer);
};

const readZipFile = async (
  bytes: Uint8Array,
  entries: Map<string, ZipEntry>,
  path: string,
): Promise<string | null> => {
  const entry = entries.get(path);
  if (!entry) return null;

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const offset = entry.localHeaderOffset;

  if (getUint32(view, offset) !== 0x04034b50) {
    throw new Error("Invalid XLSX archive");
  }

  const fileNameLength = getUint16(view, offset + 26);
  const extraFieldLength = getUint16(view, offset + 28);
  const dataOffset = offset + 30 + fileNameLength + extraFieldLength;
  const compressedData = bytes.slice(dataOffset, dataOffset + entry.compressedSize);

  if (entry.compressionMethod === 0) {
    return decodeUtf8(compressedData);
  }

  if (entry.compressionMethod === 8) {
    return decodeUtf8(await inflateRaw(compressedData));
  }

  throw new Error("Unsupported XLSX compression");
};

const parseXml = (xml: string) => {
  const document = new DOMParser().parseFromString(xml, "application/xml");
  if (document.querySelector("parsererror")) {
    throw new Error("Invalid XLSX XML");
  }
  return document;
};

const getCellColumnIndex = (cellReference: string) => {
  const letters = cellReference.match(/^[A-Z]+/i)?.[0]?.toUpperCase() ?? "";
  let index = 0;

  for (const letter of letters) {
    index = index * 26 + letter.charCodeAt(0) - 64;
  }

  return Math.max(0, index - 1);
};

const getTextContent = (element: Element, selector: string) =>
  Array.from(element.querySelectorAll(selector))
    .map((node) => node.textContent ?? "")
    .join("");

const parseSharedStrings = (xml: string | null): string[] => {
  if (!xml) return [];

  const document = parseXml(xml);
  return Array.from(document.querySelectorAll("si")).map((item) => getTextContent(item, "t"));
};

const getSheetCellValue = (cell: Element, sharedStrings: string[]) => {
  const cellType = cell.getAttribute("t");

  if (cellType === "s") {
    const index = Number(cell.querySelector("v")?.textContent ?? -1);
    return Number.isFinite(index) ? (sharedStrings[index] ?? "") : "";
  }

  if (cellType === "inlineStr") {
    return getTextContent(cell, "is t");
  }

  return cell.querySelector("v")?.textContent ?? "";
};

const parseXlsxFirstSheet = async (
  arrayBuffer: ArrayBuffer,
): Promise<{ headers: string[]; rows: string[][] }> => {
  const bytes = new Uint8Array(arrayBuffer);
  if (bytes.length < 4 || bytes[0] !== 0x50 || bytes[1] !== 0x4b) {
    throw new Error("Invalid XLSX archive");
  }

  const entries = readZipEntries(bytes);
  const sheetXml = await readZipFile(bytes, entries, "xl/worksheets/sheet1.xml");

  if (!sheetXml) {
    throw new Error("Missing XLSX worksheet");
  }

  const sharedStrings = parseSharedStrings(
    await readZipFile(bytes, entries, "xl/sharedStrings.xml"),
  );
  const sheetDocument = parseXml(sheetXml);
  const parsedRows = Array.from(sheetDocument.querySelectorAll("sheetData row"))
    .map((row) => {
      const values: string[] = [];
      Array.from(row.querySelectorAll("c")).forEach((cell) => {
        const reference = cell.getAttribute("r") ?? "";
        const columnIndex = getCellColumnIndex(reference);
        values[columnIndex] = getSheetCellValue(cell, sharedStrings).trim();
      });
      return values;
    })
    .filter((row) => row.some((value) => value && value.trim() !== ""));

  if (parsedRows.length === 0) {
    return { headers: [], rows: [] };
  }

  return {
    headers: parsedRows[0],
    rows: parsedRows.slice(1),
  };
};

/**
 * Validates the content of a JSON file before upload
 * Expected format based on UILM_FILE.json template
 */
const validateJsonFileContent = (content: string): ValidationResult => {
  const errors: string[] = [];

  // Early validation: check for empty content
  if (!content || content.trim() === "") {
    errors.push("Invalid file format.");
    return { isValid: false, errors };
  }

  try {
    const data = JSON.parse(content);

    // Check if data is an array of objects
    if (!Array.isArray(data)) {
      errors.push("Invalid file format.");
      return { isValid: false, errors };
    }

    if (data.length === 0) {
      errors.push("Invalid file format.");
      return { isValid: false, errors };
    }

    // Validate each entry has required fields
    let errorCount = 0;

    data.forEach((item: Record<string, unknown>) => {
      // Check for KeyName (case-sensitive as per template)
      const keyName = item.KeyName ?? item.keyName;
      if (keyName === null || keyName === undefined || String(keyName).trim() === "") {
        errorCount++;
      }

      // Validate Resources array if present
      const resources = item.Resources ?? item.resources;
      if (resources !== undefined && resources !== null) {
        if (!Array.isArray(resources)) {
          errorCount++;
        } else {
          resources.forEach((resource: Record<string, unknown>) => {
            const value = resource.Value ?? resource.value;
            const culture = resource.Culture ?? resource.culture;
            if (typeof value !== "string" || typeof culture !== "string") {
              errorCount++;
            }
          });
        }
      }

      // Validate Routes array if present
      const routes = item.Routes ?? item.routes;
      if (routes !== undefined && routes !== null && !Array.isArray(routes)) {
        errorCount++;
      }
    });

    if (errorCount > 0) {
      errors.push("Invalid file format.");
      return { isValid: false, errors };
    }

    return { isValid: true, errors: [] };
  } catch {
    errors.push("Invalid file format.");
    return { isValid: false, errors };
  }
};

/**
 * Validates the content of a CSV file before upload
 * Expected columns: keyName, moduleName, resources, routes
 */
const validateCsvFileContent = (content: string): ValidationResult => {
  const errors: string[] = [];

  // Early validation: check for empty content
  if (!content || content.trim() === "") {
    errors.push("Invalid file format.");
    return { isValid: false, errors };
  }

  try {
    const { headers, rows } = parseCSVContent(content);

    if (headers.length === 0) {
      errors.push("Invalid file format.");
      return { isValid: false, errors };
    }

    // Normalize headers to lowercase for comparison
    const normalizedHeaders = headers.map((h) => h.toLowerCase().trim());

    // Check for required headers - keyName is required
    const hasKeyName = normalizedHeaders.includes("keyname");
    const hasResources = normalizedHeaders.includes("resources");

    if (!hasKeyName) {
      errors.push("Invalid file format.");
      return { isValid: false, errors };
    }

    // Check if file has language columns (like bn-BD, en-US, etc.) - these can serve as resources
    const languageColumnPattern = /^[a-z]{2}-[A-Z]{2}$/;
    const hasLanguageColumns = headers.some((h) => languageColumnPattern.test(h.trim()));

    // resources is optional if language columns exist
    if (!hasResources && !hasLanguageColumns) {
      errors.push("Invalid file format.");
      return { isValid: false, errors };
    }

    if (rows.length === 0) {
      errors.push("Invalid file format.");
      return { isValid: false, errors };
    }

    // Find column indices
    const keyNameIndex = normalizedHeaders.indexOf("keyname");
    const resourcesIndex = normalizedHeaders.indexOf("resources");
    const routesIndex = normalizedHeaders.indexOf("routes");

    // Validate each data row
    let errorCount = 0;

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];

      // Validate keyName is not empty
      const keyName = row[keyNameIndex];
      if (!keyName || keyName.trim() === "") {
        errorCount++;
      }

      // Validate resources format only if resources column exists
      // If using language columns instead, skip this validation
      if (resourcesIndex !== -1) {
        const resources = row[resourcesIndex];
        if (resources && resources.trim() !== "") {
          // Check if it's a simple format (culture:value pairs)
          const resourcePairs = resources.split(";");
          for (const pair of resourcePairs) {
            if (pair.trim() && !pair.includes(":")) {
              errorCount++;
              break;
            }
          }
        }
      }

      // Validate routes format only if routes column exists
      // Routes is optional
      if (routesIndex !== -1) {
        const routes = row[routesIndex];
        if (routes && routes.trim() !== "" && routes !== "[]" && routes !== "{}") {
          if (!routes.startsWith("[")) {
            errorCount++;
          }
        }
      }
    }

    if (errorCount > 0) {
      errors.push("Invalid file format.");
      return { isValid: false, errors };
    }

    return { isValid: true, errors: [] };
  } catch {
    errors.push("Invalid file format.");
    return { isValid: false, errors };
  }
};

/**
 * Validates XLSX file content by parsing and checking the data structure
 * Expected columns: keyName, moduleName, resources, routes
 */
const validateXlsxFileContent = async (arrayBuffer: ArrayBuffer): Promise<ValidationResult> => {
  const errors: string[] = [];

  try {
    const { headers, rows } = await parseXlsxFirstSheet(arrayBuffer);

    if (headers.length === 0 || rows.length === 0) {
      errors.push("Invalid file format.");
      return { isValid: false, errors };
    }

    const normalizedHeaders = headers.map((h) => h.toLowerCase().trim());

    // Check for required headers - keyName is required
    const hasKeyName = normalizedHeaders.includes("keyname");
    const hasResources = normalizedHeaders.includes("resources");

    if (!hasKeyName) {
      errors.push("Invalid file format.");
      return { isValid: false, errors };
    }

    // Check if file has language columns (like bn-BD, en-US, etc.) - these can serve as resources
    const languageColumnPattern = /^[a-z]{2}-[A-Z]{2}$/;
    const hasLanguageColumns = headers.some((h) => languageColumnPattern.test(h.trim()));

    // resources is optional if language columns exist
    if (!hasResources && !hasLanguageColumns) {
      errors.push("Invalid file format.");
      return { isValid: false, errors };
    }

    // Find column indices (case-insensitive)
    const headerMap: Record<string, string> = {};
    headers.forEach((h) => {
      headerMap[h.toLowerCase().trim()] = h;
    });
    const keyNameKey = headerMap["keyname"];
    const resourcesKey = headerMap["resources"];
    const routesKey = headerMap["routes"];
    const keyNameIndex = headers.indexOf(keyNameKey);
    const resourcesIndex = resourcesKey ? headers.indexOf(resourcesKey) : -1;
    const routesIndex = routesKey ? headers.indexOf(routesKey) : -1;

    // Validate each data row
    let errorCount = 0;

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];

      // Validate keyName is not empty (case-insensitive)
      const keyName = row[keyNameIndex];
      if (!keyName || keyName.trim() === "") {
        errorCount++;
      }

      // Validate resources format only if resources column exists
      // If using language columns instead, skip this validation
      if (resourcesIndex !== -1) {
        const resources = row[resourcesIndex];
        if (resources && resources.trim() !== "") {
          const resourcePairs = resources.split(";");
          for (const pair of resourcePairs) {
            if (pair.trim() && !pair.includes(":")) {
              errorCount++;
              break;
            }
          }
        }
      }

      // Validate routes format only if routes column exists
      // Routes is optional
      if (routesIndex !== -1) {
        const routes = row[routesIndex];
        if (routes && routes.trim() !== "") {
          const routesStr = routes.trim();
          if (routesStr !== "[]" && routesStr !== "{}" && !routesStr.startsWith("[")) {
            errorCount++;
          }
        }
      }
    }

    if (errorCount > 0) {
      errors.push("Invalid file format.");
      return { isValid: false, errors };
    }

    return { isValid: true, errors: [] };
  } catch {
    errors.push("Invalid file format.");
    return { isValid: false, errors };
  }
};

/**
 * Reads and validates file content before upload
 * @param file - The file to validate
 * @returns ValidationResult indicating if the file is valid
 */
const validateFileContent = async (file: File): Promise<ValidationResult> => {
  const errors: string[] = [];

  // Guard check: ensure file exists and has a valid name
  if (!file || typeof file.name !== "string" || !file.name.includes(".")) {
    errors.push("Invalid file format.");
    return { isValid: false, errors };
  }

  const fileExtension = "." + file.name.split(".").pop()?.toLowerCase();

  // Check file extension
  if (!ALLOWED_EXTENSIONS.includes(fileExtension)) {
    errors.push("Invalid file format.");
    return { isValid: false, errors };
  }

  try {
    if (fileExtension === ".json") {
      const content = await file.text();
      return validateJsonFileContent(content);
    } else if (fileExtension === ".csv") {
      const content = await file.text();
      return validateCsvFileContent(content);
    } else if (fileExtension === ".xlsx") {
      // For XLSX, use ArrayBuffer to avoid corrupting binary data
      const arrayBuffer = await file.arrayBuffer();
      return await validateXlsxFileContent(arrayBuffer);
    }

    return { isValid: true, errors: [] };
  } catch {
    errors.push("Invalid file format.");
    return { isValid: false, errors };
  }
};

const FileSvgDraw = () => {
  return (
    <>
      <div className="mb-3 h-8 w-8 text-border-medium-emphasis">
        <CloudUpload />
      </div>
      <div className="mb-1 text-sm text-high-emphasis">
        <span className="font-semibold text-primary">Click to upload</span>
        &nbsp; or drag and drop
      </div>
      <div className="text-xs text-low-emphasis">XLSX, CSV, JSON Maximum file 50MB</div>
    </>
  );
};

interface IImportFilesModalProps {
  dialogTitle: string;
  data: [];
  projectKey: string;
  onClose?: () => void;
  onImportStarted?: (request: ILanguageImportRequest) => void;
  onImportRequestFailed?: (correlationId: string) => void;
}

type TemplateFormat = "xlsx" | "csv" | "json";

const TEMPLATE_URLS: Record<TemplateFormat, string> = {
  xlsx: "https://az-cdn.selise.biz/selisecdn/cdn/blocks-cloud/localization_xlsx.xlsx",
  csv: "https://az-cdn.selise.biz/selisecdn/cdn/blocks-cloud/localization_csv.csv",
  json: "https://az-cdn.selise.biz/selisecdn/cdn/blocks-cloud/localization_json.json",
};

export default function ImportCommunicationsModal({
  dialogTitle,
  projectKey,
  onClose,
  onImportStarted,
  onImportRequestFailed,
}: Readonly<IImportFilesModalProps>) {
  const [files, setFiles] = useState<File[] | null>(null);
  const [selectedFormat, setSelectedFormat] = useState<TemplateFormat>("json");

  const { mutateAsync: getPresignedUrl, isPending: isGettingPresignedUrl } =
    useGetPreSignedUrlForUpload();
  const { mutateAsync: uploadFileMutate, isPending: isUploadingFile } = useUploadFile();
  const { mutateAsync: uploadUilmFile, isPending: isUploadingUilmFile } = useImportLanguageFile();
  const [isUploadingBatch, setIsUploadingBatch] = useState(false);

  const isBusy =
    isGettingPresignedUrl || isUploadingFile || isUploadingUilmFile || isUploadingBatch;

  // Handle files change with validation on selection
  const handleFilesChange = async (newFiles: File[] | null) => {
    // If files are being removed (null or empty array), allow it without validation
    if (!newFiles || newFiles.length === 0) {
      setFiles(newFiles);
      return;
    }

    // Validate all newly selected files
    for (const file of newFiles) {
      const validation = await validateFileContent(file);
      if (!validation.isValid) {
        // File format is invalid, show generic error
        toast({
          variant: "destructive",
          title: "Invalid File",
          description: validation.errors[0],
        });
        return;
      }
    }

    // All files are valid, update state
    setFiles(newFiles);
  };

  const downloadTemplate = async () => {
    try {
      const url = TEMPLATE_URLS[selectedFormat];
      const filename = `Uilm_template.${selectedFormat}`;

      if (!url) throw new Error("No URL received");

      // Fetch as blob
      const response = await fetch(url);
      if (!response.ok) throw new Error("File fetch failed");
      const blob = await response.blob();

      // Create a temporary object URL
      const blobUrl = window.URL.createObjectURL(blob);

      // Trigger download
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      // Cleanup
      window.URL.revokeObjectURL(blobUrl);
    } catch (_err) {
      showErrorToast({ errors: "Failed to download template" });
    }
  };

  const dropZoneConfig = {
    maxFiles: 5,
    maxSize: 1024 * 1024 * 50, // 50MB as mentioned in the UI
    multiple: true,
    accept: {
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
      "text/csv": [".csv"],
      "application/json": [".json"],
      "application/x-xliff+xml": [".xlf"],
    },
  };

  const uploadFile = async (file: File) => {
    let correlationId: string | null = null;

    try {
      const res = await getPresignedUrl({
        itemId: "",
        accessModifier: "Public",
        configurationName: "Default",
        name: file.name,
        projectKey,
        tags: "",
        metaData: "",
        parentDirectoryId: "",
        moduleName: ModuleName.Localization,
      });

      if (!res.isSuccess) {
        throw res.errors || new Error("Failed to get pre-signed URL");
      }

      const fileId = res.fileId;
      await uploadFileMutate({ url: res.uploadUrl, file });

      correlationId = uuidv4();
      const payload: IImportFile = {
        messageCoRelationId: correlationId,
        fileId,
        projectKey,
      };

      onImportStarted?.({ correlationId, fileName: file.name });
      await uploadUilmFile(payload);

      try {
        const uploadedFile = await storageService.file.getFileByFileId({
          itemId: fileId,
          projectKey,
        });

        return {
          fileId: uploadedFile.itemId,
          url: uploadedFile.url,
          name: file.name,
        };
      } catch {
        return {
          fileId,
          url: "",
          name: file.name,
        };
      }
    } catch (error) {
      if (correlationId) onImportRequestFailed?.(correlationId);
      throw error;
    }
  };

  const handleUpload = async () => {
    if (!files || files.length === 0) {
      showErrorToast({ errors: "Please select files to upload" });
      return;
    }

    setIsUploadingBatch(true);

    // Capture files at upload start to handle case where files are removed during upload
    const filesToUpload = [...files];

    // Validate all files before uploading
    for (const file of filesToUpload) {
      const validation = await validateFileContent(file);
      if (!validation.isValid) {
        toast({
          variant: "destructive",
          title: "Invalid File",
          description: validation.errors[0],
        });
        setIsUploadingBatch(false);
        return;
      }
    }

    // Only proceed to upload if all validations pass
    try {
      const uploadPromises = filesToUpload.map((file) => uploadFile(file));
      await Promise.all(uploadPromises);

      // reset after successful upload
      setFiles(null);

      showSuccessToast({
        description: "Upload complete. Your translation keys are being processed.",
      });
      onClose?.();
    } catch (error) {
      showErrorToast({ errors: getUploadToastErrors(error) });
    } finally {
      setIsUploadingBatch(false);
    }
  };

  return (
    <DialogContent className="rounded-md max-w-[450px] md:max-w-[490px]">
      <>
        <DialogHeader>
          <DialogTitle className="text-left">{dialogTitle}</DialogTitle>
          <DialogDescription className="text-left">
            Import language keys from a file.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col bg-warning-100 px-[12px] py-[8px]">
          <div className="flex flex-row items-center">
            <TriangleAlert className="h-4 w-4 text-icon-warning" />
            <p className="ml-[8px] text-[14px] font-semibold text-high-emphasis">JSON Format</p>
          </div>
          <p className="mt-[8px] text-[14px] text-high-emphasis">
            Please download the JSON Template and re-upload with your data to avoid any error.
          </p>
        </div>
        <FileUploader
          value={files}
          onValueChange={handleFilesChange}
          dropzoneOptions={dropZoneConfig}
          className="relative my-2 rounded-lg"
        >
          <FileInput className="rounded border border-dashed border-border">
            <div className="flex w-full flex-col items-center justify-center py-4">
              <FileSvgDraw />
            </div>
          </FileInput>
          <FileUploaderContent>
            {files &&
              files.length > 0 &&
              files.map((file, i) => (
                <FileUploaderItem key={i} index={i} disabled={isBusy}>
                  <Paperclip className="h-4 w-4 stroke-current" />
                  <span>{file.name}</span>
                </FileUploaderItem>
              ))}
          </FileUploaderContent>
        </FileUploader>

        <DialogFooter className="mr-1 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-row items-center gap-2">
            <Select
              value={selectedFormat}
              onValueChange={(value) => setSelectedFormat(value as TemplateFormat)}
            >
              <SelectTrigger className="w-[120px]">
                <SelectValue placeholder="Format" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="xlsx">XLSX</SelectItem>
                <SelectItem value="csv">CSV</SelectItem>
                <SelectItem value="json">JSON</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex flex-row gap-2 text-primary">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    {/* The inner Button is the real control, so it owns the handler.
                        A wrapper button here would nest a button inside a button. */}
                    <Button size="icon" variant="ghost" onClick={downloadTemplate}>
                      <ArrowDownToLine size={20} />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent className="border-none bg-neutral-500 text-white shadow-none">
                    Download Template
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </div>
          <div className="flex gap-2">
            <DialogClose asChild>
              <Button variant="outline" size="default">
                Cancel
              </Button>
            </DialogClose>
            <Button
              size="default"
              className="bg-primary"
              onClick={handleUpload}
              disabled={!files || files.length === 0 || isBusy}
            >
              {isBusy ? "Uploading..." : "Upload"}
            </Button>
          </div>
        </DialogFooter>
      </>
    </DialogContent>
  );
}
