import {
  FileInput,
  FileUploader,
  FileUploaderContent,
  FileUploaderItem,
} from "@/components/file-uploader/file-uploader";
import { Button } from "@/components/ui-kits/button/button";
import {
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
import { IImportFile } from "@blocks-localization/models/language";
import {
  ArrowDownToLine,
  CloudUpload,
  Paperclip,
  TriangleAlert,
} from "lucide-react";
import { useState } from "react";
import { v4 as uuidv4 } from "uuid";
import {
  useGetPreSignedUrlForUpload,
  useUploadFile,
} from "@blocks-storage/hooks/use-storage-file";
import { storageService } from "@blocks-storage/services/storage.service";
import { ModuleName } from "@/constants/modules.constants";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui-kits/tooltip/tooltip";
import * as XLSX from "xlsx";

// Allowed file extensions for import
const ALLOWED_EXTENSIONS = [".csv", ".xlsx", ".json"];

// Expected CSV column headers based on template
const EXPECTED_CSV_HEADERS = ["keyName", "moduleName", "resources", "routes"];

// Validation result type
interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

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
  const best = counts.reduce((prev, curr) =>
    curr.count > prev.count ? curr : prev,
  );
  return best.count > 0 ? best.delimiter : ",";
};

/**
 * Parses CSV content and returns array of records
 * Handles quoted fields, escaped quotes, and various delimiters
 */
const parseCSVContent = (
  content: string,
): { headers: string[]; rows: string[][] } => {
  // Remove BOM (Byte Order Mark) if present
  const cleanContent = content.replace(/^\uFEFF/, "");
  const lines = cleanContent.split(/\r?\n/);

  if (lines.length === 0) {
    return { headers: [], rows: [] };
  }

  // Find the first non-empty line for header
  let headerLine = "";
  let firstDataLineIndex = 1;
  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (trimmed !== "") {
      headerLine = lines[i];
      firstDataLineIndex = i + 1;
      break;
    }
  }

  if (headerLine === "") {
    return { headers: [], rows: [] };
  }

  // Detect delimiter from the header line
  const delimiter = detectDelimiter(headerLine);

  const parseCSVLine = (line: string, delim: string): string[] => {
    const result: string[] = [];
    let current = "";
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === delim && !inQuotes) {
        result.push(current.trim());
        current = "";
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    return result;
  };

  const headers = parseCSVLine(headerLine, delimiter);
  const rows: string[][] = [];

  // Parse remaining lines, only including non-empty lines
  for (let i = firstDataLineIndex; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line !== "") {
      rows.push(parseCSVLine(lines[i], delimiter));
    }
  }

  return { headers, rows };
};

/**
 * Validates the content of a JSON file before upload
 * Expected format based on UILM_FILE.json template
 */
const validateJsonFileContent = (content: string): ValidationResult => {
  const errors: string[] = [];

  // Early validation: check for empty content
  if (!content || content.trim() === "") {
    errors.push("The JSON file is empty.");
    return { isValid: false, errors };
  }

  try {
    const data = JSON.parse(content);

    // Check if data is an array of objects
    if (!Array.isArray(data)) {
      errors.push(
        "Invalid JSON structure. Expected an array of localization keys.",
      );
      return { isValid: false, errors };
    }

    if (data.length === 0) {
      errors.push("The file contains no data entries.");
      return { isValid: false, errors };
    }

    // Validate each entry has required fields
    data.forEach((item: Record<string, unknown>, index: number) => {
      // Check for KeyName (case-sensitive as per template)
      const keyName = item.KeyName ?? item.keyName;
      if (
        keyName === null ||
        keyName === undefined ||
        String(keyName).trim() === ""
      ) {
        errors.push(
          `Entry at index ${index} has an empty or null 'KeyName'. All entries must have a valid KeyName.`,
        );
      }

      // Validate Resources array if present
      const resources = item.Resources ?? item.resources;
      if (resources !== undefined && resources !== null) {
        if (!Array.isArray(resources)) {
          errors.push(`Entry at index ${index}: 'Resources' must be an array.`);
        } else {
          resources.forEach(
            (resource: Record<string, unknown>, rIndex: number) => {
              const value = resource.Value ?? resource.value;
              const culture = resource.Culture ?? resource.culture;
              if (typeof value !== "string" || typeof culture !== "string") {
                errors.push(
                  `Entry at index ${index}, Resource ${rIndex}: Each resource must have 'Culture' and 'Value' fields.`,
                );
              }
            },
          );
        }
      }

      // Validate Routes array if present
      const routes = item.Routes ?? item.routes;
      if (routes !== undefined && routes !== null && !Array.isArray(routes)) {
        errors.push(`Entry at index ${index}: 'Routes' must be an array.`);
      }
    });

    return { isValid: errors.length === 0, errors };
  } catch (parseError) {
    console.error("JSON parse error:", parseError);
    errors.push(
      "Invalid JSON format. Please ensure the file contains valid JSON.",
    );
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
    errors.push("The CSV file is empty.");
    return { isValid: false, errors };
  }

  try {
    const { headers, rows } = parseCSVContent(content);

    if (headers.length === 0) {
      errors.push("The CSV file is empty or has no headers.");
      return { isValid: false, errors };
    }

    // Normalize headers to lowercase for comparison
    const normalizedHeaders = headers.map((h) => h.toLowerCase().trim());

    // Check for required headers (all 4 are required)
    const requiredHeaders = ["keyname", "modulename", "resources", "routes"];
    const missingHeaders = requiredHeaders.filter(
      (h) => !normalizedHeaders.includes(h),
    );

    if (missingHeaders.length > 0) {
      errors.push(
        `Missing required columns: ${missingHeaders.join(", ")}. Expected columns: ${EXPECTED_CSV_HEADERS.join(", ")}`,
      );
      return { isValid: false, errors };
    }

    if (rows.length === 0) {
      errors.push("The CSV file contains no data rows.");
      return { isValid: false, errors };
    }

    // Find column indices
    const keyNameIndex = normalizedHeaders.indexOf("keyname");
    const moduleNameIndex = normalizedHeaders.indexOf("modulename");
    const resourcesIndex = normalizedHeaders.indexOf("resources");
    const routesIndex = normalizedHeaders.indexOf("routes");

    // Validate each data row
    let errorCount = 0;
    const maxErrorsToReport = 5; // Limit error reporting to avoid too many toast messages

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 2; // +2 because of header row and 0-indexing

      // Validate keyName is not empty
      const keyName = row[keyNameIndex];
      if (!keyName || keyName.trim() === "") {
        if (errorCount < maxErrorsToReport) {
          errors.push(
            `Row ${rowNum}: Empty 'keyName' value. All entries must have a valid keyName.`,
          );
        }
        errorCount++;
      }

      // Validate resources format - should be culture:value pairs separated by semicolons
      // e.g., "en-US:Email;bn-BD:ইমেইল;de-DE:E-Mail"
      const resources = row[resourcesIndex];
      if (resources && resources.trim() !== "") {
        // Check if it's a simple format (culture:value pairs)
        const resourcePairs = resources.split(";");
        for (const pair of resourcePairs) {
          if (pair.trim() && !pair.includes(":")) {
            if (errorCount < maxErrorsToReport) {
              errors.push(
                `Row ${rowNum}: Invalid resource format. Expected 'culture:value' pairs separated by semicolons (e.g., 'en-US:Email;bn-BD:ইমেইল').`,
              );
            }
            errorCount++;
            break;
          }
        }
      }

      // Validate routes format - should be JSON array or empty
      const routes = row[routesIndex];
      if (
        routes &&
        routes.trim() !== "" &&
        routes !== "[]" &&
        routes !== "{}"
      ) {
        if (!routes.startsWith("[")) {
          if (errorCount < maxErrorsToReport) {
            errors.push(
              `Row ${rowNum}: Invalid 'routes' format. Expected empty or JSON array (e.g., '[]').`,
            );
          }
          errorCount++;
        }
      }
    }

    if (errorCount > maxErrorsToReport) {
      errors.push(
        `And ${errorCount - maxErrorsToReport} more errors. Please fix the issues and re-upload.`,
      );
    }

    return { isValid: errors.length === 0, errors };
  } catch (csvError) {
    console.error("CSV parse error:", csvError);
    errors.push("Invalid CSV format. Please ensure the file is a valid CSV.");
    return { isValid: false, errors };
  }
};

/**
 * Validates XLSX file content by parsing and checking the data structure
 * Expected columns: keyName, moduleName, resources, routes
 */
const validateXlsxFileContent = (
  arrayBuffer: ArrayBuffer,
): ValidationResult => {
  const errors: string[] = [];

  try {
    // XLSX is a ZIP archive, check for ZIP signature (PK)
    const bytes = new Uint8Array(arrayBuffer);
    if (bytes.length < 4) {
      errors.push("The XLSX file appears to be empty or invalid.");
      return { isValid: false, errors };
    }

    // Check for ZIP signature (PK at start)
    const isZip = bytes[0] === 0x50 && bytes[1] === 0x4b;
    if (!isZip) {
      errors.push(
        "The file does not appear to be a valid XLSX file. Expected ZIP signature.",
      );
      return { isValid: false, errors };
    }

    // Parse the XLSX file
    const workbook = XLSX.read(arrayBuffer, { type: "array" });

    // Get the first sheet
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) {
      errors.push("The XLSX file contains no worksheets.");
      return { isValid: false, errors };
    }

    const sheet = workbook.Sheets[sheetName];

    // Convert sheet to JSON
    const sheetData = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
      defval: "",
    });

    if (sheetData.length === 0) {
      errors.push("The XLSX file contains no data rows.");
      return { isValid: false, errors };
    }

    // Get headers from the first row
    const headers = Object.keys(sheetData[0]);
    const normalizedHeaders = headers.map((h) => h.toLowerCase().trim());

    // Check for required headers (all 4 are required)
    const requiredHeaders = ["keyname", "modulename", "resources", "routes"];
    const missingHeaders = requiredHeaders.filter(
      (h) => !normalizedHeaders.includes(h),
    );

    if (missingHeaders.length > 0) {
      errors.push(
        `Missing required columns: ${missingHeaders.join(", ")}. Expected columns: ${EXPECTED_CSV_HEADERS.join(", ")}`,
      );
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

    // Validate each data row
    let errorCount = 0;
    const maxErrorsToReport = 5;

    for (let i = 0; i < sheetData.length; i++) {
      const row = sheetData[i];
      const rowNum = i + 2; // +2 because of header row and 0-indexing

      // Validate keyName is not empty (case-insensitive)
      const keyName = row[keyNameKey];
      if (
        keyName === null ||
        keyName === undefined ||
        String(keyName).trim() === ""
      ) {
        if (errorCount < maxErrorsToReport) {
          errors.push(
            `Row ${rowNum}: Empty 'keyName' value. All entries must have a valid keyName.`,
          );
        }
        errorCount++;
      }

      // Validate resources format - should be culture:value pairs separated by semicolons
      // e.g., "en-US:Email;bn-BD:ইমেইল;de-DE:E-Mail"
      const resources = row[resourcesKey];
      if (resources && String(resources).trim() !== "") {
        const resourcesStr = String(resources);
        // Check if it's a simple format (culture:value pairs)
        const resourcePairs = resourcesStr.split(";");
        for (const pair of resourcePairs) {
          if (pair.trim() && !pair.includes(":")) {
            if (errorCount < maxErrorsToReport) {
              errors.push(
                `Row ${rowNum}: Invalid resource format. Expected 'culture:value' pairs separated by semicolons (e.g., 'en-US:Email;bn-BD:ইমেইল').`,
              );
            }
            errorCount++;
            break;
          }
        }
      }

      // Validate routes format - should be JSON array or empty
      const routes = row[routesKey];
      if (routes !== undefined && routes !== null && String(routes).trim() !== "") {
        const routesStr = String(routes).trim();
        if (routesStr !== "[]" && routesStr !== "{}" && !routesStr.startsWith("[")) {
          if (errorCount < maxErrorsToReport) {
            errors.push(
              `Row ${rowNum}: Invalid 'routes' format. Expected empty or JSON array (e.g., '[]').`,
            );
          }
          errorCount++;
        }
      }
    }

    if (errorCount > maxErrorsToReport) {
      errors.push(
        `And ${errorCount - maxErrorsToReport} more errors. Please fix the issues and re-upload.`,
      );
    }

    return { isValid: errors.length === 0, errors };
  } catch (xlsxError) {
    console.error("XLSX parse error:", xlsxError);
    errors.push("Failed to parse XLSX file. Please ensure it's a valid Excel file.");
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
    errors.push("Invalid file object. Please try selecting the file again.");
    return { isValid: false, errors };
  }

  const fileExtension = "." + file.name.split(".").pop()?.toLowerCase();

  // Check file extension
  if (!ALLOWED_EXTENSIONS.includes(fileExtension)) {
    errors.push(
      `Invalid file format. Allowed formats: ${ALLOWED_EXTENSIONS.join(", ")}`,
    );
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
      return validateXlsxFileContent(arrayBuffer);
    }

    return { isValid: true, errors: [] };
  } catch (err) {
    console.error("File validation error:", err);
    errors.push("Failed to read or validate file content. Please try again.");
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
      {/* <div className="text-xs text-low-emphasis">XLSX, CSV, JSON or XLF. Maximum file 50MB</div> */}
      <div className="text-xs text-low-emphasis">
        XLSX, CSV, JSON Maximum file 50MB
      </div>
    </>
  );
};

interface IImportFilesModalProps {
  dialogTitle: string;
  data: [];
  projectKey: string;
  onClose(): void;
}

type TemplateFormat = "xlsx" | "csv" | "json";

//TODO FE: add those file in the storage accordingly
const TEMPLATE_URLS: Record<TemplateFormat, string> = {
  xlsx: "https://blocksdev.blob.core.windows.net/02d1397241f3489d8182a90ff1f2510a/Public/612067c1-090f-4659-9b56-f1e8fb88884f/4fae24d7-4258-4e70-8c60-7c913d5b6727/UILM_FILE.xlsx",
  csv: "https://blocksdev.blob.core.windows.net/02d1397241f3489d8182a90ff1f2510a/Public/612067c1-090f-4659-9b56-f1e8fb88884f/4fae24d7-4258-4e70-8c60-7c913d5b6727/UILM_FILE.csv",
  json: "https://blocksdev.blob.core.windows.net/02d1397241f3489d8182a90ff1f2510a/Public/612067c1-090f-4659-9b56-f1e8fb88884f/4fae24d7-4258-4e70-8c60-7c913d5b6727/UILM_FILE.json",
};

export default function ImportCommunicationsModal({
  dialogTitle,
  projectKey,
  onClose,
}: IImportFilesModalProps) {
  const [files, setFiles] = useState<File[] | null>(null);
  const [selectedFormat, setSelectedFormat] = useState<TemplateFormat>("json");

  const { mutateAsync: getPresignedUrl, isPending: isGettingPresignedUrl } =
    useGetPreSignedUrlForUpload();
  const { mutateAsync: uploadFileMutate, isPending: isUploadingFile } =
    useUploadFile();
  const { mutateAsync: uploadUilmFile, isPending: isUploadingUilmFile } =
    useImportLanguageFile();
  const [isUploadingBatch, setIsUploadingBatch] = useState(false);

  const isBusy =
    isGettingPresignedUrl ||
    isUploadingFile ||
    isUploadingUilmFile ||
    isUploadingBatch;

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
        // File format is invalid, show error with detailed validation errors
        toast({
          variant: "destructive",
          title: "Invalid File Format",
          description: validation.errors.join("\n"),
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
    } catch (err) {
      console.error(err);
      showErrorToast({ errors: "Failed to download template" });
    }
  };

  const dropZoneConfig = {
    maxFiles: 5,
    maxSize: 1024 * 1024 * 50, // 50MB as mentioned in the UI
    multiple: true,
    accept: {
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [
        ".xlsx",
      ],
      "text/csv": [".csv"],
      "application/json": [".json"],
      "application/x-xliff+xml": [".xlf"],
    },
  };

  const uploadFile = async (file: File) => {
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
        throw new Error("Failed to get pre-signed URL");
      }

      const fileId = res.fileId;
      await uploadFileMutate({ url: res.uploadUrl, file });

      const uploadedFile = await storageService.file.getFileByFileId({
        itemId: fileId,
        projectKey,
      });

      const payload: IImportFile = {
        messageCoRelationId: uuidv4(),
        fileId,
        projectKey,
      };

      await uploadUilmFile(payload);

      return {
        fileId: uploadedFile.itemId,
        url: uploadedFile.url,
        name: file.name,
      };
    } catch (error) {
      console.error(`Error uploading file ${file.name}:`, error);

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
          title: "Invalid File Format",
          description: validation.errors.join("\n"),
        });
        setIsUploadingBatch(false);
        return;
      }
    }

    // Only proceed to upload if all validations pass
    try {
      const uploadPromises = filesToUpload.map((file) => uploadFile(file));
      await Promise.all(uploadPromises);

      // reset & close
      setFiles(null);
      onClose(); // <-- close the modal

      showSuccessToast({ description: "Files uploaded successfully" });
    } catch (error) {
      console.error("Upload error:", error);
      if (isErrorWithErrors(error)) {
        showErrorToast({ errors: error.errors });
      } else if (error instanceof Error) {
        showErrorToast({ errors: [error.message] });
      } else {
        showErrorToast({
          errors:
            "An unexpected error occurred during upload. Please try again.",
        });
      }
    } finally {
      setIsUploadingBatch(false);
    }
  };

  // const checkActivity = () => {
  //   router.push(`/services/language?languageActivity=activity`);
  // };

  return (
    <DialogContent className="rounded-md max-w-[450px] md:max-w-[490px]">
      {/* {!showConfirmation ? ( */}
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
            <p className="ml-[8px] text-[14px] font-semibold text-high-emphasis">
              JSON Format
            </p>
          </div>
          <p className="mt-[8px] text-[14px] text-high-emphasis">
            Please download the JSON Template and re-upload with your data to
            avoid any error.
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
              onValueChange={(value) =>
                setSelectedFormat(value as TemplateFormat)
              }
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
            <div
              className="flex cursor-pointer flex-row gap-2 text-primary"
              onClick={downloadTemplate}
            >
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button size="icon" variant="ghost">
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
            <Button variant="outline" size="default" onClick={onClose}>
              Cancel
            </Button>
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
      {/* ) : ( */}
      <>
        {/* <DialogHeader>
            <DialogTitle className="text-left">Processing request</DialogTitle>
            <DialogDescription className="mt-4 text-sm text-medium-emphasis">
              You&apos;ll be notified once the file is ready to upload. You can check the activity
              page for details
            </DialogDescription>
          </DialogHeader> */}

        {/* Display uploaded files info */}
        {/* {uploadedFiles.length > 0 && (
            <div className="mt-4 space-y-2">
              <p className="text-sm font-medium">Uploaded files:</p>
              {uploadedFiles.map((file, index) => (
                <div key={index} className="flex items-center gap-2 text-sm text-medium-emphasis">
                  <Paperclip className="h-4 w-4" />
                  <span>{file.name}</span>
                </div>
              ))}
            </div>
          )} */}

        {/* <div className="mt-0 flex flex-row-reverse gap-2">
            <DialogTrigger asChild onClick={checkActivity}>
              <Button size="default" variant="outline">
                Check Activity
              </Button>
            </DialogTrigger>
          </div> */}
      </>
      {/* )} */}
    </DialogContent>
  );
}
