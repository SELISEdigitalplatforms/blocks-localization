import StepperWithoutIndicator from "../../../../../components/stepper/stepper-without-indicator";
import { Button } from "@/components/ui-kits/button/button";
import { Checkbox } from "@/components/ui-kits/checkbox/checkbox";
import {
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui-kits/dialog/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui-kits/form/form";
import { Label } from "@/components/ui-kits/label/label";
import {
  RadioGroup,
  RadioGroupItem,
} from "@/components/ui-kits/radio-group/radio-group";
import { toast } from "@/hooks/use-toast";
import { isErrorWithErrors } from "@/lib/error";
import { useProjectStore } from "@seliseblocks/blocks-kit";
import {
  useGetLanguageModule,
  useGetLanguages,
  useSaveLanguageKeyUilmExport,
} from "@blocks-localization/hooks/use-language-manager";
import { useQueryClient } from "@tanstack/react-query";

import { ModuleName } from "@/constants/modules.constants";
import { IUilmExportNotificationData } from "@blocks-localization/models/language";
import {
  useGetPreSignedUrlForUpload,
  useUploadFile,
} from "@blocks-storage/hooks/use-storage-file";
import { storageService } from "@blocks-storage/services/storage.service";
import { Calendar } from "@/components/ui-kits/calendar/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui-kits/popover/popover";
import { zodResolver } from "@hookform/resolvers/zod";
import { DialogTrigger } from "@radix-ui/react-dialog";
import { Upload, X, CalendarIcon } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { v4 as uuidv4 } from "uuid";
import { z } from "zod";
import { useNotificationListener } from "@blocks-utilities/notification";

const outputTypes = [
  { id: 0, label: "Json" },
  // { id: 1, label: "Xml" },
  // { id: 2, label: "Text" },
  { id: 3, label: "Xlsx" },
  { id: 4, label: "Csv" },
  // { id: 5, label: "Xlf" },
] as const;

type DateRangeType = { from?: Date; to?: Date } | null;

const FormSchema = z.object({
  items: z.array(z.string()).refine((value) => value.some((item) => item), {
    message: "You have to select at least one item.",
  }),
});

export default function ExportKey() {
  const [currentStep, setCurrentStep] = useState(1);
  const projectKey = useProjectStore().selectedProject?.tenantId || "";
  const { data: languageModules } = useGetLanguageModule(projectKey);
  const { data: availableLanguages } = useGetLanguages();
  const itemId = useProjectStore().selectedProject?.itemId || "";
  // const { language } = useLanguage();

  const [date, setDate] = useState<DateRangeType>(null);
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [selectedModuleIds, setSelectedModuleIds] = useState<string[]>([]);
  const [selectedOutputType, setSelectedOutputType] = useState<number>(
    outputTypes[0].id,
  );
  const [downloadChecked, setDownloadChecked] = useState(false);
  const [referenceFileId, setReferenceFileId] = useState(uuidv4());
  const [xlfFile, setXlfFile] = useState<File | null>(null);
  const [isUploadingXlf, setIsUploadingXlf] = useState(false);
  const [selectedLanguages, setSelectedLanguages] = useState<string[]>([]);
  const pendingExportCorrelationIdRef = useRef<string | null>(null);

  const { mutateAsync: exportAsync } = useSaveLanguageKeyUilmExport();
  const { mutateAsync: getPresignedUrl } = useGetPreSignedUrlForUpload();
  const { mutateAsync: uploadFileMutate } = useUploadFile();
  const queryClient = useQueryClient();

  const handleSelectFileType = () => {
    setCurrentStep(2);
  };

  const handleBack = () => {
    setCurrentStep(1);
  };

  const handleXlfFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.name.endsWith(".xlf") && !file.name.endsWith(".xliff")) {
      toast({
        title: "Invalid File",
        description: "Please upload a valid XLF file.",
        variant: "destructive",
      });
      return;
    }

    // Store the file for later upload in onSubmit
    setXlfFile(file);
  };

  const handleRemoveXlfFile = () => {
    setXlfFile(null);
  };

  const handleDateSelect = (selectedDateRange: DateRangeType | undefined) => {
    setDate(selectedDateRange ?? null);
  };

  const form = useForm<z.infer<typeof FormSchema>>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      items: [],
    },
  });

  const onSubmit = async () => {
    setIsUploadingXlf(true);

    try {
      let exportReferenceFileId = referenceFileId;

      // For XLF export, upload the file first
      if (selectedOutputType === 5 && xlfFile) {
        // Get pre-signed URL
        const res = await getPresignedUrl({
          itemId: "",
          accessModifier: "Public",
          configurationName: "Default",
          name: xlfFile.name,
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

        setReferenceFileId(fileId);

        // Upload file to storage
        await uploadFileMutate({ url: res.uploadUrl, file: xlfFile });

        // Use uploaded file ID for XLF export
        exportReferenceFileId = fileId;
      }

      const messageCoRelationId = uuidv4();
      pendingExportCorrelationIdRef.current = messageCoRelationId;

      const payload = {
        outputType: selectedOutputType,
        messageCoRelationId,
        appIds: selectedModuleIds,
        languages:
          selectedOutputType === 5
            ? selectedLanguages
            : availableLanguages
              ? availableLanguages.map((lang) => lang.languageCode)
              : ["en-US"],
        referenceFileId: exportReferenceFileId,
        callerTenantId: itemId,
        startDate: date?.from ? date.from.toISOString() : undefined,
        endDate: date?.to ? addOneDay(date.to).toString() : undefined,
      };

      const exportResult = await exportAsync(payload);

      if (exportResult?.isSuccess === false) {
        pendingExportCorrelationIdRef.current = null;
        showErrorToast();
        return;
      }

      toast({
        title: "Export Started",
        description:
          "Your export is being prepared. The download will start when the file is ready.",
        variant: "success",
      });

      // Reset modal after export
      setCurrentStep(1);
      form.reset();
      setSelectedModuleIds([]);
      setDownloadChecked(false);
      setXlfFile(null);
      setSelectedLanguages([]);
    } catch (error) {
      pendingExportCorrelationIdRef.current = null;
      console.error("Error during export:", error);
      if (isErrorWithErrors(error)) return showErrorToast();
      showErrorToast();
    } finally {
      setIsUploadingXlf(false);
    }
  };

  const addOneDay = (date: Date) => {
    const nextDate = new Date(date);
    nextDate.setDate(nextDate.getDate() + 1);
    return nextDate.toISOString();
  };

  const handleExport = () => {
    // close();
    onSubmit();
  };

  // const checkActivity = () => {
  //   router.push(`/services/language?languageActivity=activity`);
  // };

  const parseJson = (value: unknown): Record<string, unknown> | null => {
    if (!value) return null;
    if (typeof value === "object") return value as Record<string, unknown>;
    if (typeof value !== "string") return null;

    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === "object"
        ? (parsed as Record<string, unknown>)
        : null;
    } catch {
      return null;
    }
  };

  const getStringValue = (
    source: Record<string, unknown> | null | undefined,
    keys: string[],
  ) => {
    for (const key of keys) {
      const value = source?.[key];
      if (typeof value === "string" && value.trim() !== "") {
        return value;
      }
    }
    return undefined;
  };

  const getBooleanValue = (
    source: Record<string, unknown> | null | undefined,
    keys: string[],
  ) => {
    for (const key of keys) {
      const value = source?.[key];
      if (typeof value === "boolean") return value;
      if (typeof value === "string") return value.toLowerCase() === "true";
    }
    return undefined;
  };

  const extractExportNotification = (
    notificationData: IUilmExportNotificationData,
  ) => {
    const root = parseJson(notificationData);
    const message = parseJson(root?.message ?? root?.Message);
    const notification = message ?? root;
    const payload = parseJson(notification?.payload ?? notification?.Payload);
    const denormalizedPayload = parseJson(
      notification?.denormalizedPayload ??
        notification?.DenormalizedPayload ??
        root?.denormalizedPayload ??
        root?.DenormalizedPayload,
    );
    const denormalizedMessage = parseJson(
      denormalizedPayload?.Message ?? denormalizedPayload?.message,
    );

    return {
      correlationId: getStringValue(payload, [
        "responseKey",
        "ResponseKey",
        "correlationId",
        "CorrelationId",
      ]),
      fileId:
        getStringValue(root, ["FileId", "fileId"]) ??
        getStringValue(notification, ["FileId", "fileId"]) ??
        getStringValue(denormalizedPayload, ["FileId", "fileId"]) ??
        getStringValue(denormalizedMessage, ["FileId", "fileId"]),
      isSuccess:
        getBooleanValue(denormalizedPayload, ["IsSuccess", "isSuccess"]) ??
        getBooleanValue(denormalizedMessage, ["IsSuccess", "isSuccess"]),
    };
  };

  useEffect(() => {
    setSelectedModuleIds(form.getValues("items") || []);
  }, [form.watch("items")]);

  const handleNotificationData = useCallback(
    async (notificationData: IUilmExportNotificationData) => {
      const { correlationId, fileId, isSuccess } =
        extractExportNotification(notificationData);
      const pendingCorrelationId = pendingExportCorrelationIdRef.current;

      if (!pendingCorrelationId) {
        return;
      }

      if (correlationId && correlationId !== pendingCorrelationId) {
        return;
      }

      try {
        if (isSuccess === false) {
          pendingExportCorrelationIdRef.current = null;
          showErrorToast();
          return;
        }

        if (fileId) {
          try {
            // Fetch the download URL directly using queryClient
            const fileIdToUse = fileId;
            const result = await queryClient.fetchQuery({
              queryKey: ["getFilesDownload", fileIdToUse, projectKey],
              queryFn: () =>
                storageService.file.getFilesDownloadUrl({
                  fileId: fileIdToUse,
                  projectKey,
                }),
            });

            if (result?.url) {
              const link = document.createElement("a");
              link.href = result.url;
              link.download = result.name || "";
              document.body.appendChild(link);
              link.click();
              document.body.removeChild(link);
              pendingExportCorrelationIdRef.current = null;
              showSuccessToast();
            } else {
              console.error("No download URL found after all retries");
              showErrorToast();
            }
          } catch (error) {
            console.error(error);
            showErrorToast();
          }
        } else {
          console.error("No fileId found in notification message");
          showErrorToast();
        }
      } catch (error) {
        console.error("Error handling notification data:", error);
        showErrorToast();
        return;
      }
    },

    [projectKey, queryClient],
  );

  useNotificationListener("language-import-export", handleNotificationData);

  const showSuccessToast = () => {
    toast({
      title: "Status",
      description: "Successfully downloaded the export keys.",
      variant: "success",
    });
  };

  const showErrorToast = () => {
    toast({
      title: "Download Failed",
      description: "Download failed. Please check the logs for more details.",
      variant: "destructive",
    });
  };

  return (
    <DialogContent className="flex max-h-[85vh] flex-col overflow-hidden rounded-md sm:max-w-[425px]">
      {/* {!showConfirmation ? ( */}
      <>
        <DialogHeader>
          <DialogTitle className="text-left">Export keys</DialogTitle>
          <DialogDescription className="!mt-[12px] text-sm text-medium-emphasis">
            Select the modules you’d like to export
          </DialogDescription>
        </DialogHeader>
        <div className="!mt-[8px] mb-8 flex-1 overflow-y-auto p-1 text-left text-high-emphasis">
          <StepperWithoutIndicator currentStep={currentStep} stepNumber={1}>
            <div className="mb-6 flex flex-col gap-1.5">
              <p className="text-sm text-high-emphasis">Date Range</p>
              <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="flex w-full justify-between"
                    type="button"
                  >
                    {!date?.from ? (
                      <div className="flex w-full items-center justify-between">
                        <span className="font-normal text-low-emphasis">
                          Set date range
                        </span>
                        <CalendarIcon className="ml-2 h-4 w-4" />
                      </div>
                    ) : (
                      <div className="flex w-full items-center justify-between">
                        <span className="font-normal">
                          {date.from?.toLocaleDateString()}
                          {date.to && (
                            <>
                              {" - "}
                              {date.to?.toLocaleDateString()}
                            </>
                          )}
                        </span>
                        <CalendarIcon className="ml-2 h-4 w-4" />
                      </div>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    initialFocus
                    mode="range"
                    defaultMonth={date?.from}
                    selected={
                      date?.from ? { from: date.from, to: date.to } : undefined
                    }
                    onSelect={handleDateSelect}
                    numberOfMonths={2}
                  />
                  <div className="flex items-center gap-4 px-3 pb-4">
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full"
                      onClick={() => {
                        setDate(null);
                        setPopoverOpen(false);
                      }}
                    >
                      Reset
                    </Button>
                    <Button
                      type="button"
                      className="w-full"
                      onClick={() => setPopoverOpen(false)}
                    >
                      Apply
                    </Button>
                  </div>
                </PopoverContent>
              </Popover>
            </div>
            <Form {...form}>
              <form
                onSubmit={form.handleSubmit(onSubmit)}
                className="space-y-8"
              >
                <FormField
                  control={form.control}
                  name="items"
                  render={({ field }) => (
                    <FormItem>
                      <div className="mb-6">
                        {languageModules && languageModules.length > 0 ? (
                          <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                            <FormControl>
                              <Checkbox
                                id="select-all"
                                checked={
                                  field.value?.length ===
                                    languageModules.length &&
                                  languageModules.length > 0
                                }
                                onCheckedChange={(checked) => {
                                  if (checked) {
                                    field.onChange(
                                      languageModules.map(
                                        (item) => item.itemId,
                                      ),
                                    );
                                  } else {
                                    field.onChange([]);
                                  }
                                }}
                              />
                            </FormControl>
                            <FormLabel className="font-normal">
                              Select all
                            </FormLabel>
                          </FormItem>
                        ) : (
                          <div className="text-sm text-medium-emphasis">
                            No module found.
                          </div>
                        )}
                      </div>
                      <div className="max-h-80 overflow-y-auto">
                        <div className="grid grid-cols-2 gap-x-4 gap-y-6">
                          {languageModules &&
                            languageModules.map((item) => (
                              <FormField
                                key={item.itemId}
                                control={form.control}
                                name="items"
                                render={({ field }) => (
                                  <FormItem
                                    key={item.itemId}
                                    className="ml-3 flex flex-row items-start space-x-3 space-y-0"
                                  >
                                    <FormControl>
                                      <Checkbox
                                        checked={field.value?.includes(
                                          item.itemId,
                                        )}
                                        onCheckedChange={(checked) => {
                                          if (checked) {
                                            field.onChange([
                                              ...field.value,
                                              item.itemId,
                                            ]);
                                          } else {
                                            field.onChange(
                                              field.value?.filter(
                                                (value) =>
                                                  value !== item.itemId,
                                              ),
                                            );
                                          }
                                        }}
                                      />
                                    </FormControl>
                                    <FormLabel className="font-normal">
                                      {item.moduleName}
                                    </FormLabel>
                                  </FormItem>
                                )}
                              />
                            ))}
                        </div>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </form>
            </Form>
          </StepperWithoutIndicator>
          <StepperWithoutIndicator currentStep={currentStep} stepNumber={2}>
            <Form {...form}>
              <form
                onSubmit={form.handleSubmit(onSubmit)}
                className="space-y-4 pr-4"
              >
                <RadioGroup
                  value={
                    outputTypes.find((t) => t.id === selectedOutputType)?.label
                  }
                  onValueChange={(label) => {
                    const selected = outputTypes.find(
                      (type) => type.label === label,
                    );
                    if (selected) setSelectedOutputType(selected.id);
                  }}
                  className="space-y-4"
                >
                  {outputTypes.map((type) => (
                    <div
                      key={type.label}
                      className="flex items-center space-x-2"
                    >
                      <RadioGroupItem value={type.label} id={type.label} />
                      <Label htmlFor={type.label}>
                        {type.label.toUpperCase()}
                      </Label>
                    </div>
                  ))}
                </RadioGroup>

                {/* XLF File Upload Section */}
                {selectedOutputType === 5 && (
                  <div className="mt-4 space-y-2 rounded-md border border-border-default p-4">
                    <p className="text-sm font-medium text-high-emphasis">
                      Upload XLF File
                    </p>
                    <p className="text-xs text-medium-emphasis">
                      Please upload an XLF file to use as a template for export.
                    </p>
                    {!xlfFile ? (
                      <div className="mt-2">
                        <label
                          htmlFor="xlf-upload"
                          className="bg-surface-default hover:bg-surface-hover flex cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed border-border-default px-4 py-3 text-sm"
                        >
                          <Upload className="h-4 w-4 text-medium-emphasis" />
                          <span className="text-medium-emphasis">
                            Click to select XLF file
                          </span>
                        </label>
                        <input
                          id="xlf-upload"
                          type="file"
                          accept=".xlf,.xliff"
                          className="hidden"
                          onChange={handleXlfFileChange}
                          disabled={isUploadingXlf}
                        />
                      </div>
                    ) : (
                      <div className="bg-surface-default mt-2 flex items-center justify-between rounded-md border border-border-default px-3 py-2">
                        <div className="flex items-center gap-2">
                          <Upload className="h-4 w-4 text-success" />
                          <span className="text-sm text-high-emphasis">
                            {xlfFile.name}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={handleRemoveXlfFile}
                          className="text-medium-emphasis hover:text-high-emphasis"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    )}

                    {/* Language Selection Section for XLF */}
                    <div className="mt-4 space-y-2">
                      <p className="text-sm font-medium text-high-emphasis">
                        Select Languages
                      </p>
                      <p className="text-xs text-medium-emphasis">
                        Choose one or more languages to export.
                      </p>
                      {availableLanguages && availableLanguages.length > 0 ? (
                        <div className="mt-2 space-y-3">
                          {/* Select All Languages */}
                          <div className="flex items-start space-x-3">
                            <Checkbox
                              id="select-all-languages"
                              checked={
                                selectedLanguages.length ===
                                  availableLanguages.length &&
                                availableLanguages.length > 0
                              }
                              onCheckedChange={(checked) => {
                                if (checked) {
                                  setSelectedLanguages(
                                    availableLanguages.map(
                                      (lang) => lang.languageCode,
                                    ),
                                  );
                                } else {
                                  setSelectedLanguages([]);
                                }
                              }}
                            />
                            <Label
                              htmlFor="select-all-languages"
                              className="font-normal"
                            >
                              Select all
                            </Label>
                          </div>

                          {/* Individual Language Checkboxes */}
                          <div className="max-h-40 space-y-3 overflow-y-auto pl-6">
                            {availableLanguages.map((lang) => (
                              <div
                                key={lang.itemId}
                                className="flex items-start space-x-3"
                              >
                                <Checkbox
                                  id={`lang-${lang.languageCode}`}
                                  checked={selectedLanguages.includes(
                                    lang.languageCode,
                                  )}
                                  onCheckedChange={(checked) => {
                                    if (checked) {
                                      setSelectedLanguages([
                                        ...selectedLanguages,
                                        lang.languageCode,
                                      ]);
                                    } else {
                                      setSelectedLanguages(
                                        selectedLanguages.filter(
                                          (code) => code !== lang.languageCode,
                                        ),
                                      );
                                    }
                                  }}
                                />
                                <Label
                                  htmlFor={`lang-${lang.languageCode}`}
                                  className="font-normal"
                                >
                                  {lang.languageName} ({lang.languageCode})
                                </Label>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <div className="mt-2 text-sm text-medium-emphasis">
                          No languages found.
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <div className="mt-2 text-sm text-medium-emphasis">
                  How would you like to export?
                </div>
                {/* <FormField
                    control={form.control}
                    name="items"
                    render={() => (
                      <FormItem>
                        <div className="mb-2">
                          <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                            <FormControl>
                              <Checkbox id="email" />
                            </FormControl>
                            <FormLabel className="font-normal">Email</FormLabel>
                          </FormItem>
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  /> */}
                <FormField
                  control={form.control}
                  name="items"
                  render={() => (
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                      <FormControl>
                        <Checkbox
                          id="download"
                          checked={downloadChecked}
                          onCheckedChange={(checked) =>
                            setDownloadChecked(checked === true)
                          }
                        />
                      </FormControl>
                      <FormLabel className="font-normal">Download</FormLabel>
                    </FormItem>
                  )}
                />
              </form>
            </Form>
          </StepperWithoutIndicator>
        </div>
      </>
      {/* ) : ( */}
      {/* <>
          <DialogHeader>
            <DialogTitle className="text-left">Processing request</DialogTitle>
            <DialogDescription className="mt-8 text-sm text-medium-emphasis">
              You’ll be notified once the file is ready to download. You can check activity for
              details.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-0 flex flex-row-reverse gap-2">
            <DialogTrigger asChild onClick={checkActivity}>
              <Button size="default" variant="outline">
                Check Activity
              </Button>
            </DialogTrigger>
          </div>
        </> */}
      {/* )} */}
      {/* { */}
      <div className="mt-auto border-t pt-4">
        {currentStep === 1 ? (
          <div className="flex flex-row-reverse gap-2">
            <Button
              size="default"
              onClick={handleSelectFileType}
              disabled={selectedModuleIds.length === 0}
            >
              Select file type
            </Button>
            <DialogClose asChild>
              <Button variant="outline" size="default">
                Cancel
              </Button>
            </DialogClose>
          </div>
        ) : (
          <div className="flex justify-between">
            <DialogClose asChild>
              <Button variant="outline" size="default">
                Cancel
              </Button>
            </DialogClose>
            <div className="space-x-2">
              <Button size="default" variant="outline" onClick={handleBack}>
                Back
              </Button>
              <Button
                size="default"
                onClick={handleExport}
                disabled={
                  downloadChecked === false ||
                  (selectedOutputType === 5 &&
                    (!xlfFile || selectedLanguages.length === 0)) ||
                  isUploadingXlf
                }
              >
                Export
              </Button>
            </div>
          </div>
        )}
      </div>
    </DialogContent>
  );
}
