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
import { showErrorToast, showSuccessToast } from "@/hooks/use-toast";
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
 * Parses CSV content and returns array of records
 */
const parseCSVContent = (
  content: string,
): { headers: string[]; rows: string[][] } => {
  const lines = content.split(/\r?\n/).filter((line) => line.trim() !== "");
  if (lines.length === 0) {
    return { headers: [], rows: [] };
  }

  const parseCSVLine = (line: string): string[] => {
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
      } else if (char === "," && !inQuotes) {
        result.push(current.trim());
        current = "";
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    return result;
  };

  const headers = parseCSVLine(lines[0]);
  const rows = lines.slice(1).map((line) => parseCSVLine(line));

  return { headers, rows };
};

/**
 * Validates the content of a JSON file before upload
 * Expected format based on UILM_FILE.json template
 */
const validateJsonFileContent = (content: string): ValidationResult => {
  const errors: string[] = [];

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
  } catch {
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

  try {
    const { headers, rows } = parseCSVContent(content);

    if (headers.length === 0) {
      errors.push("The CSV file is empty or has no headers.");
      return { isValid: false, errors };
    }

    // Normalize headers to lowercase for comparison
    const normalizedHeaders = headers.map((h) => h.toLowerCase().trim());

    // Check for required headers
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
    const resourcesIndex = normalizedHeaders.indexOf("resources");
    const routesIndex = normalizedHeaders.indexOf("routes");

    // Validate each data row
    rows.forEach((row, index) => {
      const keyName = row[keyNameIndex];
      if (!keyName || keyName.trim() === "") {
        errors.push(
          `Row ${index + 2}: Empty 'keyName' value. All entries must have a valid keyName.`,
        );
      }

      // Validate resources format (expected: culture:value;culture:value or JSON string)
      const resources = row[resourcesIndex];
      if (resources) {
        // If resources is a JSON string, try to parse and validate
        if (resources.startsWith("[") || resources.startsWith("{")) {
          try {
            const parsedResources = JSON.parse(resources);
            if (!Array.isArray(parsedResources)) {
              errors.push(
                `Row ${index + 2}: 'resources' must be a JSON array.`,
              );
            }
          } catch {
            // If not JSON, check if it's in culture:value format
            const resourcePairs = resources.split(";");
            resourcePairs.forEach((pair) => {
              if (pair && !pair.includes(":")) {
                errors.push(
                  `Row ${index + 2}: Invalid resource format. Expected 'culture:value' pairs separated by semicolons or a JSON array.`,
                );
              }
            });
          }
        }
      }

      // Validate routes format (expected: JSON array or empty)
      const routes = row[routesIndex];
      if (routes && routes !== "[]" && routes !== "{}") {
        if (!routes.startsWith("[") && !routes.startsWith("{")) {
          errors.push(
            `Row ${index + 2}: Invalid 'routes' format. Expected a JSON array.`,
          );
        }
      }
    });

    return { isValid: errors.length === 0, errors };
  } catch {
    errors.push("Invalid CSV format. Please ensure the file is a valid CSV.");
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
  const fileExtension = "." + file.name.split(".").pop()?.toLowerCase();

  // Check file extension
  if (!ALLOWED_EXTENSIONS.includes(fileExtension)) {
    errors.push(
      `Invalid file format. Allowed formats: ${ALLOWED_EXTENSIONS.join(", ")}`,
    );
    return { isValid: false, errors };
  }

  try {
    const content = await file.text();

    if (fileExtension === ".json") {
      return validateJsonFileContent(content);
    } else if (fileExtension === ".csv") {
      return validateCsvFileContent(content);
    } else if (fileExtension === ".xlsx") {
      // For XLSX files, client-side validation is limited without additional libraries
      // We do a basic check to ensure the file is not empty and appears to be a valid XLSX
      if (content.length < 100) {
        errors.push("The XLSX file appears to be empty or invalid.");
        return { isValid: false, errors };
      }
      // XLSX is a binary format (ZIP), so we check for the ZIP signature
      // PK (50 4B) is the signature for ZIP/XLSX files
      const isValidXlsx = content
        .slice(0, 4)
        .split("")
        .every((char) => char.charCodeAt(0) !== 0);
      if (!isValidXlsx) {
        errors.push("The file does not appear to be a valid XLSX file.");
        return { isValid: false, errors };
      }
      return { isValid: true, errors: [] };
    }

    return { isValid: true, errors: [] };
  } catch {
    errors.push("Failed to read file content. Please try again.");
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

    try {
      // Validate all files before uploading
      for (const file of filesToUpload) {
        const validation = await validateFileContent(file);
        if (!validation.isValid) {
          showErrorToast({ errors: validation.errors });
          setIsUploadingBatch(false);
          return;
        }
      }

      const uploadPromises = filesToUpload.map((file) => uploadFile(file));
      await Promise.all(uploadPromises);

      // reset & close
      setFiles(null);
      onClose(); // <-- close the modal

      showSuccessToast({ description: "Files uploaded successfully" });
    } catch (error) {
      if (isErrorWithErrors(error)) {
        showErrorToast({ errors: error.errors });
      } else {
        showErrorToast({ errors: "Something went wrong during upload" });
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
          onValueChange={setFiles}
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
