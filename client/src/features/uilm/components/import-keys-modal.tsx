import { ModuleName } from "@/features/uilm/constants/modules.constants";
import {
  useGetPreSignedUrlForUpload,
  useUploadFileToBlob,
} from "@/features/uilm/hooks/use-storage-upload";
import { useUilmImportLanguageFile, useUilmProjectKey } from "@/features/uilm/hooks/use-uilm-queries";
import type { IImportFile } from "@/features/uilm/types/language";
import { storageFileService } from "@/platform/storage/storage-file.service";
import { Button } from "@/platform/ui/components/button/button";
import {
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/platform/ui/components/dialog/dialog";
import {
  FileInput,
  FileUploader,
  FileUploaderContent,
  FileUploaderItem,
} from "@/platform/ui/components/file-uploader/file-uploader";
import { showErrorToast, showSuccessToast } from "@/platform/ui/hooks/use-toast";
import { HttpError } from "@/platform/api/idp-http";
import { isErrorWithErrors } from "@/lib/error";
import { ArrowDownToLine, CloudUpload, Paperclip, TriangleAlert } from "lucide-react";
import { useState } from "react";
import { v4 as uuidv4 } from "uuid";

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
      <div className="text-xs text-low-emphasis">XLSX, CSV, JSON or XLF. Maximum file 50MB</div>
    </>
  );
};

interface IImportFilesModalProps {
  dialogTitle: string;
  onClose: () => void;
}

export function ImportKeysModal({ dialogTitle, onClose }: IImportFilesModalProps) {
  const projectKey = useUilmProjectKey();
  const [files, setFiles] = useState<File[] | null>(null);

  const { mutateAsync: getPresignedUrl, isPending: isGettingPresignedUrl } = useGetPreSignedUrlForUpload();
  const { mutateAsync: uploadFileMutate, isPending: isUploadingFile } = useUploadFileToBlob();
  const { mutateAsync: uploadUilmFile, isPending: isUploadingUilmFile } = useUilmImportLanguageFile();
  const [isUploadingBatch, setIsUploadingBatch] = useState(false);

  const isBusy =
    isGettingPresignedUrl || isUploadingFile || isUploadingUilmFile || isUploadingBatch;

  const downloadTemplate = async () => {
    try {
      const url =
        "https://blocksdev.blob.core.windows.net/02d1397241f3489d8182a90ff1f2510a/Public/612067c1-090f-4659-9b56-f1e8fb88884f/4fae24d7-4258-4e70-8c60-7c913d5b6727/UILM_FILE.json";
      const filename = "UILM_FILE.json";

      if (!url) throw new Error("No URL received");

      const response = await fetch(url);
      if (!response.ok) throw new Error("File fetch failed");
      const blob = await response.blob();

      const blobUrl = window.URL.createObjectURL(blob);

      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      window.URL.revokeObjectURL(blobUrl);
    } catch (err) {
      console.error(err);
      showErrorToast({ errors: "Failed to download template" });
    }
  };

  const dropZoneConfig = {
    maxFiles: 5,
    maxSize: 1024 * 1024 * 50,
    multiple: true,
    accept: {
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
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

      const uploadedFile = await storageFileService.getFileByFileId({
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
    if (!projectKey) {
      showErrorToast({ errors: "Please select a project in the console header or configure a project key." });
      return;
    }
    if (!files || files.length === 0) {
      showErrorToast({ errors: "Please select files to upload" });
      return;
    }

    setIsUploadingBatch(true);

    try {
      const uploadPromises = files.map((file) => uploadFile(file));
      await Promise.all(uploadPromises);

      setFiles(null);
      onClose();

      showSuccessToast({ description: "Files uploaded successfully" });
    } catch (error) {
      if (error instanceof HttpError) {
        showErrorToast({ errors: error.errors });
      } else if (isErrorWithErrors(error)) {
        showErrorToast({ errors: error.errors });
      } else {
        showErrorToast({ errors: "Something went wrong during upload" });
      }
    } finally {
      setIsUploadingBatch(false);
    }
  };

  return (
    <DialogContent className="rounded-md sm:max-w-[450px]">
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
                <FileUploaderItem key={i} index={i}>
                  <Paperclip className="h-4 w-4 stroke-current" />
                  <span>{file.name}</span>
                </FileUploaderItem>
              ))}
          </FileUploaderContent>
        </FileUploader>

        <DialogFooter className="mr-1 grid grid-cols-2 gap-2">
          <div
            className="mt-2 flex cursor-pointer flex-row gap-2 text-primary"
            onClick={downloadTemplate}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                void downloadTemplate();
              }
            }}
            role="button"
            tabIndex={0}
          >
            <ArrowDownToLine size={20} />
            <h3 className="text-sm font-medium">Template</h3>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" size="default" onClick={onClose}>
              Cancel
            </Button>
            <Button
              size="default"
              className="bg-primary"
              onClick={() => void handleUpload()}
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
